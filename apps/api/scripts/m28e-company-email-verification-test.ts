import assert from "node:assert/strict";
import express from "express";
import type { Pool } from "pg";

import { createAuthRouter } from "../src/routes/auth.js";
import { hashSessionToken } from "../src/middleware/auth.js";

type Scenario =
  | "unknown"
  | "expired"
  | "consumed"
  | "success"
  | "organization-update-failure";

type MockResult = {
  rows: Array<Record<string, unknown>>;
  rowCount: number;
};

function makePool(scenario: Scenario) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  let released = false;
  let connectCount = 0;

  const client = {
    async query(
      sql: string,
      params: unknown[] = [],
    ): Promise<MockResult> {
      const normalized = sql.replace(/\s+/g, " ").trim();
      calls.push({ sql: normalized, params });

      if (
        normalized === "BEGIN" ||
        normalized === "COMMIT" ||
        normalized === "ROLLBACK"
      ) {
        return { rows: [], rowCount: 0 };
      }

      if (
        normalized.includes("FROM company_email_verification_tokens") &&
        normalized.includes("FOR UPDATE")
      ) {
        if (scenario === "unknown") {
          return { rows: [], rowCount: 0 };
        }

        const expired = scenario === "expired";
        const consumed = scenario === "consumed";

        return {
          rows: [{
            id: 91,
            organization_id: 601,
            expires_at: new Date(
              Date.now() + (expired ? -60_000 : 60 * 60 * 1000),
            ).toISOString(),
            consumed_at: consumed ? new Date().toISOString() : null,
          }],
          rowCount: 1,
        };
      }

      if (normalized.includes("UPDATE organizations")) {
        if (scenario === "organization-update-failure") {
          throw new Error("Simulated organization update failure");
        }

        return { rows: [{ id: 601 }], rowCount: 1 };
      }

      if (normalized.includes("UPDATE company_email_verification_tokens")) {
        return { rows: [], rowCount: 1 };
      }

      throw new Error(`Unexpected mock client SQL: ${normalized}`);
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

async function requestVerification(pool: Pool, token: string) {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", createAuthRouter(pool));

  const server = app.listen(0, "127.0.0.1");

  try {
    await new Promise<void>((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });

    const address = server.address();
    assert.ok(address && typeof address !== "string");

    return await fetch(
      `http://127.0.0.1:${address.port}/api/auth/verify-company-email`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      },
    );
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

async function main() {
  const passed: string[] = [];
  const token = "a".repeat(64);

  {
    const mock = makePool("unknown");
    const response = await requestVerification(mock.pool, "not-a-valid-token");
    const payload = await response.json() as {
      success: boolean;
      code: string;
    };

    assert.equal(response.status, 400);
    assert.equal(payload.success, false);
    assert.equal(payload.code, "INVALID_VERIFICATION_TOKEN");
    assert.equal(mock.connectCount(), 0);

    passed.push("Malformed token rejected before database access");
  }

  {
    const mock = makePool("unknown");
    const response = await requestVerification(mock.pool, token);
    const payload = await response.json() as {
      success: boolean;
      code: string;
    };

    assert.equal(response.status, 400);
    assert.equal(payload.code, "INVALID_VERIFICATION_TOKEN");
    assert.ok(mock.calls.some((call) => call.sql === "ROLLBACK"));
    assert.equal(mock.calls.some((call) => call.sql === "COMMIT"), false);
    assert.equal(mock.released(), true);

    const lookup = mock.calls.find(
      (call) => call.sql.includes("FROM company_email_verification_tokens"),
    );
    assert.ok(lookup);
    assert.equal(lookup.params[0], hashSessionToken(token));

    passed.push("Unknown token rejected with rollback and connection release");
  }

  {
    const mock = makePool("expired");
    const response = await requestVerification(mock.pool, token);
    const payload = await response.json() as {
      success: boolean;
      code: string;
    };

    assert.equal(response.status, 400);
    assert.equal(payload.code, "VERIFICATION_TOKEN_EXPIRED");
    assert.ok(mock.calls.some((call) => call.sql === "ROLLBACK"));
    assert.equal(mock.calls.some((call) => call.sql.includes("UPDATE organizations")), false);
    assert.equal(mock.released(), true);

    passed.push("Expired token rejected without verifying organization");
  }

  {
    const mock = makePool("consumed");
    const response = await requestVerification(mock.pool, token);
    const payload = await response.json() as {
      success: boolean;
      code: string;
    };

    assert.equal(response.status, 400);
    assert.equal(payload.code, "VERIFICATION_TOKEN_USED");
    assert.ok(mock.calls.some((call) => call.sql === "ROLLBACK"));
    assert.equal(mock.calls.some((call) => call.sql.includes("UPDATE organizations")), false);
    assert.equal(mock.released(), true);

    passed.push("Consumed token rejected without verifying organization");
  }

  {
    const mock = makePool("success");
    const response = await requestVerification(mock.pool, token);
    const payload = await response.json() as {
      success: boolean;
      verified: boolean;
    };

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.verified, true);

    const organizationUpdate = mock.calls.findIndex(
      (call) => call.sql.includes("UPDATE organizations"),
    );
    const tokenUpdate = mock.calls.findIndex(
      (call) => call.sql.includes("UPDATE company_email_verification_tokens"),
    );
    const commit = mock.calls.findIndex((call) => call.sql === "COMMIT");

    assert.ok(organizationUpdate > -1);
    assert.ok(tokenUpdate > organizationUpdate);
    assert.ok(commit > tokenUpdate);
    assert.equal(mock.calls.some((call) => call.sql === "ROLLBACK"), false);
    assert.equal(mock.released(), true);

    passed.push("Valid token verifies organization and consumes token in one committed transaction");
  }

  {
    const mock = makePool("organization-update-failure");
    const response = await requestVerification(mock.pool, token);
    const payload = await response.json() as { success: boolean };

    assert.equal(response.status, 500);
    assert.equal(payload.success, false);
    assert.ok(mock.calls.some((call) => call.sql === "ROLLBACK"));
    assert.equal(mock.calls.some((call) => call.sql === "COMMIT"), false);
    assert.equal(
      mock.calls.some((call) => call.sql.includes("UPDATE company_email_verification_tokens")),
      false,
    );
    assert.equal(mock.released(), true);

    passed.push("Database failure rolls back, does not consume token, and releases connection");
  }

  console.log("\n=== M28E-43 VERIFICATION TEST ===");
  for (const check of passed) {
    console.log(`PASS: ${check}`);
  }
  console.log(`\n${passed.length} checks passed.`);
}

main().catch((error) => {
  console.error("Verification test failed:", error);
  process.exitCode = 1;
});