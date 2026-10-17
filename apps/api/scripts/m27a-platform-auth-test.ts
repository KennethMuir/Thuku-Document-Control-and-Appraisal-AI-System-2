import assert from "node:assert/strict";
import type {
  NextFunction,
  Request,
  Response,
} from "express";
import type { Pool } from "pg";

import { requirePlatformAdmin } from "../src/middleware/platformAuth.js";
import type { AuthenticatedRequest } from "../src/middleware/auth.js";

type DbRow = {
  account_active: boolean;
  grant_id: number | string | null;
};

function makeHarness(options: {
  rows?: DbRow[];
  error?: Error;
  authUser?: AuthenticatedRequest["authUser"];
}) {
  let statusCode = 200;
  let body: unknown;
  let nextCalled = false;

  const query = async () => {
    if (options.error) throw options.error;
    return {
      rows: options.rows ?? [],
      rowCount: options.rows?.length ?? 0,
    };
  };

  const pool = { query } as unknown as Pool;
  const req = {
    authUser: options.authUser,
  } as AuthenticatedRequest as Request;

  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(value: unknown) {
      body = value;
      return this;
    },
  } as unknown as Response;

  const next: NextFunction = () => {
    nextCalled = true;
  };

  return {
    req,
    res,
    next,
    run: () => requirePlatformAdmin(pool)(req, res, next),
    result: () => ({ statusCode, body, nextCalled }),
  };
}

const activeUser = {
  id: 42,
  email: "platform-test@example.invalid",
  fullName: "Platform Test",
  role: "VIEWER" as const,
  isActive: true,
};

async function main() {
  const checks: string[] = [];

  {
    const h = makeHarness({
      authUser: activeUser,
      rows: [{ account_active: true, grant_id: 1 }],
    });
    await h.run();
    assert.equal(h.result().nextCalled, true);
    checks.push("Active database account and active grant permit access");
  }

  {
    const h = makeHarness({
      authUser: activeUser,
      rows: [{ account_active: true, grant_id: null }],
    });
    await h.run();
    assert.equal(h.result().statusCode, 403);
    assert.equal(h.result().nextCalled, false);
    checks.push("Missing or revoked grant denied");
  }

  {
    const h = makeHarness({
      authUser: activeUser,
      rows: [{ account_active: false, grant_id: 1 }],
    });
    await h.run();
    assert.equal(h.result().statusCode, 403);
    assert.equal(h.result().nextCalled, false);
    checks.push("Inactive database account denied even with a grant");
  }

  {
    const h = makeHarness({ authUser: activeUser });
    await h.run();
    assert.equal(h.result().statusCode, 403);
    checks.push("Missing database user denied");
  }

  {
    const h = makeHarness({});
    await h.run();
    assert.equal(h.result().statusCode, 401);
    assert.equal(h.result().nextCalled, false);
    checks.push("Missing authentication denied");
  }

  {
    const h = makeHarness({
      authUser: activeUser,
      error: new Error("relation does not exist"),
    });
    await h.run();
    assert.equal(h.result().statusCode, 503);
    assert.equal(h.result().nextCalled, false);
    checks.push("Database/schema failure denied");
  }

  console.log("\nM27A platform authorization tests passed:");
  for (const check of checks) console.log(`  PASS: ${check}`);
}

main().catch((error) => {
  console.error("M27A platform authorization tests failed:", error);
  process.exitCode = 1;
});
