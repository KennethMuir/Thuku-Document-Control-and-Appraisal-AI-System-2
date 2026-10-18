import assert from "node:assert/strict";
import express from "express";
import type { Pool } from "pg";

import { createAuthRouter } from "../src/routes/auth.js";
import { createPasswordHash } from "../src/middleware/auth.js";

type MockOptions = {
  verified?: boolean;
  legacyOrganization?: boolean;
  wrongPassword?: boolean;
};

type Call = { sql: string; params: unknown[] };

const testPassword = "TestPassword123!";
const testEmail = "login-test@example.invalid";

function makePool(
  passwordHash: string,
  options: MockOptions = {},
) {
  const calls: Call[] = [];

  const userRow = {
    id: 501,
    email: testEmail,
    password_hash: passwordHash,
    full_name: "Login Test",
    role: "VIEWER",
    is_active: true,
  };

  const pool = {
    async query(sql: string, params: unknown[] = []) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      calls.push({ sql: normalized, params });

      if (
        normalized.includes("FROM users") &&
        normalized.includes("LOWER(email)")
      ) {
        return { rows: [userRow], rowCount: 1 };
      }

      if (
        normalized.includes("FROM organization_memberships om") &&
        normalized.includes("JOIN organizations o")
      ) {
        if (options.legacyOrganization || options.verified) {
          return { rows: [], rowCount: 0 };
        }

        return {
          rows: [{ organization_id: 601 }],
          rowCount: 1,
        };
      }

      if (normalized.includes("INSERT INTO sessions")) {
        return { rows: [], rowCount: 1 };
      }

      throw new Error(`Unexpected mock pool SQL: ${normalized}`);
    },
  } as unknown as Pool;

  return { pool, calls };
}

async function requestLogin(
  pool: Pool,
  password = testPassword,
) {
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
      `http://127.0.0.1:${address.port}/api/auth/login`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          password,
        }),
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
  const passwordHash = await createPasswordHash(testPassword);

  {
    const mock = makePool(passwordHash);
    const response = await requestLogin(mock.pool);
    const payload = await response.json() as {
      success: boolean;
      code?: string;
    };

    assert.equal(response.status, 403);
    assert.equal(payload.success, false);
    assert.equal(payload.code, "COMPANY_EMAIL_NOT_VERIFIED");
    assert.ok(
      mock.calls.some((call) =>
        call.sql.includes("FROM organization_memberships om"),
      ),
    );
    assert.equal(
      mock.calls.some((call) => call.sql.includes("INSERT INTO sessions")),
      false,
    );

    passed.push(
      "Unverified company email blocks login before session creation",
    );
  }

  {
    const mock = makePool(passwordHash, { verified: true });
    const response = await requestLogin(mock.pool);
    const payload = await response.json() as {
      success: boolean;
      user?: { id: number };
    };

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.user?.id, 501);
    assert.ok(
      mock.calls.some((call) => call.sql.includes("INSERT INTO sessions")),
    );

    passed.push("Verified company email permits login and session creation");
  }

  {
    const mock = makePool(passwordHash, { legacyOrganization: true });
    const response = await requestLogin(mock.pool);
    const payload = await response.json() as {
      success: boolean;
      user?: { id: number };
    };

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.user?.id, 501);
    assert.ok(
      mock.calls.some((call) => call.sql.includes("INSERT INTO sessions")),
    );

    passed.push(
      "Organization without company email preserves existing login behavior",
    );
  }

  {
    const mock = makePool(passwordHash);
    const response = await requestLogin(mock.pool, "WrongPassword123!");
    const payload = await response.json() as {
      success: boolean;
      error?: string;
      code?: string;
    };

    assert.equal(response.status, 401);
    assert.equal(payload.success, false);
    assert.equal(payload.error, "Invalid email or password");
    assert.equal(payload.code, undefined);
    assert.equal(
      mock.calls.some((call) =>
        call.sql.includes("FROM organization_memberships om"),
      ),
      false,
    );
    assert.equal(
      mock.calls.some((call) => call.sql.includes("INSERT INTO sessions")),
      false,
    );

    passed.push(
      "Incorrect password is rejected without exposing verification status",
    );
  }

  console.log("\n=== M28E-44 LOGIN VERIFICATION TEST ===");
  for (const check of passed) {
    console.log(`PASS: ${check}`);
  }
  console.log(`\n${passed.length} checks passed.`);
}

main().catch((error: unknown) => {
  console.error("FAIL: M28E-44 login verification test", error);
  process.exitCode = 1;
});