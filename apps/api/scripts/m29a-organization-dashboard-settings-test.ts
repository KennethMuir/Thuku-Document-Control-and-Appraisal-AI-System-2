import "dotenv/config";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { Pool } from "pg";

const API_URL = process.env.API_URL || "http://localhost:4000";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 16);

type TestUser = {
  id: string;
  token: string;
};

const organizationIds: string[] = [];
const userIds: string[] = [];
const sessionIds: string[] = [];
const checks: string[] = [];

function checkStatus(actual: number, expected: number, label: string) {
  assert.equal(actual, expected, `${label}: expected HTTP ${expected}, received ${actual}`);
  checks.push(`${label}: HTTP ${actual}`);
}

async function createOrganization(label: string) {
  const result = await pool.query(
    `INSERT INTO organizations (name, slug, status)
     VALUES ($1, $2, 'ACTIVE') RETURNING id`,
    [`M29A ${label} ${suffix}`, `m29a-${label.toLowerCase()}-${suffix}`],
  );
  const id = String(result.rows[0].id);
  organizationIds.push(id);
  return id;
}

async function createUser(
  organizationId: string,
  label: string,
  membershipRole: "OWNER" | "ADMIN" | "APPRAISER" | "VIEWER",
): Promise<TestUser> {
  const email = `m29a-${label.toLowerCase()}-${suffix}@example.invalid`;
  const user = await pool.query(
    `INSERT INTO users (email, password_hash, full_name, role, is_active)
     VALUES ($1, $2, $3, $4, TRUE) RETURNING id`,
    [
      email,
      "runtime-test-only-not-a-real-password-hash",
      `M29A ${label}`,
      membershipRole === "APPRAISER" ? "APPRAISER" :
        membershipRole === "VIEWER" ? "VIEWER" : "ADMIN",
    ],
  );
  const userId = String(user.rows[0].id);
  userIds.push(userId);

  await pool.query(
    `INSERT INTO organization_memberships
       (organization_id, user_id, role, is_active)
     VALUES ($1, $2, $3, TRUE)`,
    [organizationId, userId, membershipRole],
  );

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const session = await pool.query(
    `INSERT INTO sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '1 hour') RETURNING id`,
    [userId, tokenHash],
  );
  sessionIds.push(String(session.rows[0].id));

  return { id: userId, token };
}

async function requestSettings(
  method: "GET" | "PUT",
  token?: string,
  body?: unknown,
) {
  const headers: Record<string, string> = {};
  if (token) headers.Cookie = `session=${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  return fetch(`${API_URL}/api/organization-dashboard-settings`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function main() {
  try {
    assert.ok(process.env.DATABASE_URL, "DATABASE_URL is not configured");

    const orgA = await createOrganization("primary");
    const orgB = await createOrganization("foreign");

    const owner = await createUser(orgA, "owner", "OWNER");
    const admin = await createUser(orgA, "admin", "ADMIN");
    const viewer = await createUser(orgA, "viewer", "VIEWER");
    const foreignOwner = await createUser(orgB, "foreign-owner", "OWNER");

    console.log("\n=== M29A ORGANIZATION DASHBOARD SETTINGS TEST ===");
    console.log(`API: ${API_URL}`);

    let response = await requestSettings("GET", owner.token);
    checkStatus(response.status, 200, "Owner reads defaults");
    let payload = await response.json() as {
      success: boolean;
      settings: Record<string, unknown>;
    };
    assert.equal(payload.success, true);
    assert.equal(payload.settings.primaryColor, "#172554");
    assert.equal(payload.settings.headerStyle, "SOLID");
    assert.equal(payload.settings.theme, "LIGHT");
    assert.deepEqual(payload.settings.visibleStatCards, [
      "documents", "metadata", "awaiting", "review", "linked", "unlinked",
    ]);
    checks.push("Default settings returned for organization without saved settings");

    response = await requestSettings("PUT", owner.token, {
      primaryColor: "#abc",
      accentColor: "#123456",
      companyProfile: "HEALTHCARE",
      showWelcomePanel: false,
    });
    checkStatus(response.status, 200, "Owner saves settings");
    payload = await response.json() as typeof payload;
    assert.equal(payload.settings.primaryColor, "#AABBCC");
    assert.equal(payload.settings.accentColor, "#123456");
    assert.equal(payload.settings.companyProfile, "HEALTHCARE");
    assert.equal(payload.settings.showWelcomePanel, false);
    checks.push("Colors normalized and settings persisted");

    response = await requestSettings("PUT", admin.token, {
      theme: "DARK",
      dashboardLayout: "COMPACT",
    });
    checkStatus(response.status, 200, "Admin updates settings");
    payload = await response.json() as typeof payload;
    assert.equal(payload.settings.theme, "DARK");
    assert.equal(payload.settings.dashboardLayout, "COMPACT");
    assert.equal(payload.settings.primaryColor, "#AABBCC");
    assert.equal(payload.settings.companyProfile, "HEALTHCARE");
    checks.push("Partial update preserves previously saved settings");

    response = await requestSettings("PUT", owner.token, {
      primaryColor: "not-a-color",
    });
    checkStatus(response.status, 400, "Invalid HEX color rejected");

    response = await requestSettings("PUT", owner.token, {
      unsupportedSetting: true,
    });
    checkStatus(response.status, 400, "Unsupported setting rejected");

    response = await requestSettings("PUT", owner.token, {
      visibleStatCards: ["documents", "documents"],
    });
    checkStatus(response.status, 400, "Duplicate stat cards rejected");

    response = await requestSettings("PUT", viewer.token, {
      theme: "LIGHT",
    });
    checkStatus(response.status, 403, "Viewer cannot save settings");

    response = await requestSettings("GET");
    checkStatus(response.status, 401, "Unauthenticated read rejected");

    response = await requestSettings("PUT", undefined, {
      theme: "LIGHT",
    });
    checkStatus(response.status, 401, "Unauthenticated write rejected");

    response = await requestSettings("GET", foreignOwner.token);
    checkStatus(response.status, 200, "Foreign owner reads own settings");
    payload = await response.json() as typeof payload;
    assert.equal(payload.settings.primaryColor, "#172554");
    assert.equal(payload.settings.theme, "LIGHT");
    checks.push("Foreign organization receives its own defaults");

    const savedA = await pool.query(
      `SELECT settings FROM organization_dashboard_settings WHERE organization_id = $1`,
      [orgA],
    );
    const savedB = await pool.query(
      `SELECT settings FROM organization_dashboard_settings WHERE organization_id = $1`,
      [orgB],
    );
    assert.equal(savedA.rows.length, 1, "Expected saved settings for primary organization");
    assert.equal(savedB.rows.length, 0, "Foreign read must not create a settings row");
    assert.equal(savedA.rows[0].settings.theme, "DARK");
    assert.equal(savedA.rows[0].settings.primaryColor, "#AABBCC");
    checks.push("Settings remain isolated by organization in the database");

    console.log("\n=== PASSED CHECKS ===");
    for (const item of checks) console.log(`PASS: ${item}`);
    console.log(`\nAll ${checks.length} checks passed.`);
  } finally {
    try {
      if (sessionIds.length) {
        await pool.query(
          `DELETE FROM sessions WHERE id = ANY($1::bigint[])`,
          [sessionIds],
        );
      }

      if (organizationIds.length) {
        await pool.query(
          `DELETE FROM organization_dashboard_settings
           WHERE organization_id = ANY($1::bigint[])`,
          [organizationIds],
        );
      }

      if (userIds.length) {
        await pool.query(
          `DELETE FROM organization_memberships WHERE user_id = ANY($1::bigint[])`,
          [userIds],
        );
      }

      if (organizationIds.length) {
        await pool.query(
          `DELETE FROM organizations WHERE id = ANY($1::bigint[])`,
          [organizationIds],
        );
      }

      if (userIds.length) {
        await pool.query(
          `DELETE FROM users WHERE id = ANY($1::bigint[])`,
          [userIds],
        );
      }

      console.log("\nCleanup completed for this test's temporary records.");
    } finally {
      await pool.end();
    }
  }
}

main().catch((error) => {
  console.error("\nM29A SETTINGS REGRESSION TEST FAILED");
  console.error(error);
  process.exitCode = 1;
});
