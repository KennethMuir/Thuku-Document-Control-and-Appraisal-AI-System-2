import assert from "node:assert/strict";
import express from "express";
import type { Pool } from "pg";
import { createAuthRouter } from "../src/routes/auth.js";
import { hashSessionToken } from "../src/middleware/auth.js";

type Scenario = "unknown" | "limited" | "success" | "database-failure";

type MockResult = {
  rows: Array<Record<string, unknown>>;
  rowCount: number;
};

function makePool(scenario: Scenario) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  let released = false;
  let connectCount = 0;

  const client = {
    async query(sql: string, params: unknown[] = []): Promise<MockResult> {
      const normalized = sql.replace(/\s+/g, " ").trim();
      calls.push({ sql: normalized, params });

      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(normalized)) {
        return { rows: [], rowCount: 0 };
      }

      if (normalized.includes("FROM organizations")) {
        if (scenario === "unknown") {
          return { rows: [], rowCount: 0 };
        }

        return { rows: [{ id: 601 }], rowCount: 1 };
      }

      if (normalized.includes("COUNT(*)::int AS token_count")) {
        return {
          rows: [{ token_count: scenario === "limited" ? 3 : 1 }],
          rowCount: 1,
        };
      }

      if (normalized.includes("UPDATE company_email_verification_tokens")) {
        return { rows: [], rowCount: 1 };
      }

      if (normalized.includes("INSERT INTO company_email_verification_tokens")) {
        if (scenario === "database-failure") {
          throw new Error("Simulated token insert failure");
        }

        return { rows: [{ id: 902 }], rowCount: 1 };
      }

      throw new Error(`Unexpected mock SQL: ${normalized}`);
    },

    release() {
      released = true;
    },
  };

  const pool = {
    async connect() {
      connectCount += 1;
      return client;
    },
  } as unknown as Pool;

  return {
    pool,
    calls,
    released: () => released,
    connectCount: () => connectCount,
  };
}

async function withServer(
  pool: Pool,
  run: (baseUrl: string) => Promise<void>,
) {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", createAuthRouter(pool));

  const server = await new Promise<import("node:http").Server>(
    (resolve, reject) => {
      const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
      instance.once("error", reject);
    },
  );

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

async function requestResend(baseUrl: string, companyEmail: string) {
  return fetch(`${baseUrl}/api/auth/resend-company-email-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ companyEmail }),
  });
}

async function main() {
  const originalApiKey = process.env.RESEND_API_KEY;
  const originalFromEmail = process.env.RESEND_FROM_EMAIL;

  // Prevent tests from sending real email or using real credentials.
  process.env.RESEND_API_KEY = "";
  process.env.RESEND_FROM_EMAIL = "";

  let passed = 0;

  async function check(name: string, test: () => Promise<void>) {
    await test();
    passed += 1;
    console.log(`PASS: ${name}`);
  }

  try {
    await check("Malformed email returns generic response without database access", async () => {
      const mock = makePool("success");

      await withServer(mock.pool, async (baseUrl) => {
        const response = await requestResend(baseUrl, "not-an-email");
        assert.equal(response.status, 200);
        const payload = await response.json() as { success: boolean; message: string };
        assert.equal(payload.success, true);
        assert.match(payload.message, /If an unverified workspace/);
      });

      assert.equal(mock.connectCount(), 0);
    });

    await check("Unknown email returns generic response", async () => {
      const mock = makePool("unknown");

      await withServer(mock.pool, async (baseUrl) => {
        const response = await requestResend(baseUrl, "unknown@example.com");
        assert.equal(response.status, 200);
        const payload = await response.json() as { success: boolean; message: string };
        assert.equal(payload.success, true);
        assert.match(payload.message, /If an unverified workspace/);
      });

      assert.equal(mock.released(), true);
      assert.ok(mock.calls.some((call) => call.sql === "ROLLBACK"));
      assert.equal(mock.calls.some((call) => call.sql === "COMMIT"), false);
    });

    await check("Hourly limit prevents token rotation and email delivery", async () => {
      const mock = makePool("limited");

      await withServer(mock.pool, async (baseUrl) => {
        const response = await requestResend(baseUrl, "company@example.com");
        assert.equal(response.status, 200);
        const payload = await response.json() as { success: boolean };
        assert.equal(payload.success, true);
      });

      assert.equal(mock.released(), true);
      assert.ok(mock.calls.some((call) => call.sql.includes("COUNT(*)::int")));
      assert.equal(
        mock.calls.some((call) => call.sql.includes("INSERT INTO company_email_verification_tokens")),
        false,
      );
      assert.equal(
        mock.calls.some((call) => call.sql.includes("UPDATE company_email_verification_tokens")),
        false,
      );
      assert.ok(mock.calls.some((call) => call.sql === "ROLLBACK"));
    });

    await check("Successful resend rotates token and commits a hashed 24-hour token", async () => {
      const mock = makePool("success");

      await withServer(mock.pool, async (baseUrl) => {
        const response = await requestResend(baseUrl, "company@example.com");
        assert.equal(response.status, 200);
        const payload = await response.json() as { success: boolean; message: string };
        assert.equal(payload.success, true);
        assert.match(payload.message, /If an unverified workspace/);
      });

      assert.equal(mock.released(), true);
      assert.ok(mock.calls.some((call) => call.sql === "COMMIT"));
      assert.equal(mock.calls.some((call) => call.sql === "ROLLBACK"), false);

      const rotation = mock.calls.find((call) =>
        call.sql.includes("UPDATE company_email_verification_tokens"),
      );
      assert.ok(rotation);
      assert.match(rotation.sql, /consumed_at IS NULL/);

      const insert = mock.calls.find((call) =>
        call.sql.includes("INSERT INTO company_email_verification_tokens"),
      );
      assert.ok(insert);
      assert.match(insert.sql, /NOW\(\) \+ INTERVAL '24 hours'/);
      assert.equal(insert.params[0], 601);
      assert.match(String(insert.params[1]), /^[a-f0-9]{64}$/);
      assert.notEqual(insert.params[1], "");
      assert.ok(mock.calls.some((call) =>
        call.sql.includes("FOR UPDATE") &&
        call.sql.includes("FROM organizations"),
      ));
    });

    await check("Database failure rolls back, releases connection and returns safe error", async () => {
      const mock = makePool("database-failure");

      await withServer(mock.pool, async (baseUrl) => {
        const response = await requestResend(baseUrl, "company@example.com");
        assert.equal(response.status, 500);
        const payload = await response.json() as { success: boolean; error: string };
        assert.equal(payload.success, false);
        assert.match(payload.error, /Unable to process/);
        assert.doesNotMatch(JSON.stringify(payload), /token|company@example\.com/i);
      });

      assert.equal(mock.released(), true);
      assert.ok(mock.calls.some((call) => call.sql === "ROLLBACK"));
      assert.equal(mock.calls.some((call) => call.sql === "COMMIT"), false);
    });

    console.log(`\n${passed} resend endpoint checks passed.`);
  } finally {
    if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalApiKey;

    if (originalFromEmail === undefined) delete process.env.RESEND_FROM_EMAIL;
    else process.env.RESEND_FROM_EMAIL = originalFromEmail;
  }
}

main().catch((error: unknown) => {
  console.error("Resend endpoint regression test failed:", error);
  process.exitCode = 1;
});