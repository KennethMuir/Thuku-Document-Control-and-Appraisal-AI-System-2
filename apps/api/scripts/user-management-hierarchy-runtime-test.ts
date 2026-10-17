import "dotenv/config";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { Pool } from "pg";

const API_URL = process.env.API_URL || "http://localhost:4000";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 16);

const organizationIds: string[] = [];
const userIds: string[] = [];
const sessionIds: string[] = [];
const checks: string[] = [];

type TestUser = {
  id: string;
  email: string;
  token?: string;
};

function checkStatus(actual: number, expected: number, label: string) {
  assert.equal(
    actual,
    expected,
    `${label}: expected HTTP ${expected}, received HTTP ${actual}`,
  );
  checks.push(`${label}: HTTP ${actual}`);
}

async function createOrganization(name: string) {
  const result = await pool.query(
    `INSERT INTO organizations (name, slug, status)
     VALUES ($1, $2, 'ACTIVE')
     RETURNING id`,
    [name, `m24-users-${name.toLowerCase()}-${suffix}`],
  );

  const id = String(result.rows[0].id);
  organizationIds.push(id);
  return id;
}

async function createUser(
  label: string,
  legacyRole: "ADMIN" | "APPRAISER" | "VIEWER",
): Promise<TestUser> {
  const email = `m24-users-${label}-${suffix}@example.invalid`;

  const result = await pool.query(
    `INSERT INTO users (email, password_hash, full_name, role, is_active)
     VALUES ($1, $2, $3, $4, TRUE)
     RETURNING id`,
    [
      email,
      "runtime-test-only-not-a-real-password-hash",
      `Temporary User ${label}`,
      legacyRole,
    ],
  );

  const user: TestUser = { id: String(result.rows[0].id), email };
  userIds.push(user.id);
  return user;
}

async function addMembership(
  organizationId: string,
  userId: string,
  role: "OWNER" | "ADMIN" | "APPRAISER" | "VIEWER",
) {
  await pool.query(
    `INSERT INTO organization_memberships
       (organization_id, user_id, role, is_active)
     VALUES ($1, $2, $3, TRUE)`,
    [organizationId, userId, role],
  );
}

async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const result = await pool.query(
    `INSERT INTO sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '1 hour')
     RETURNING id`,
    [userId, tokenHash],
  );

  sessionIds.push(String(result.rows[0].id));
  return token;
}

async function patchUser(
  targetId: string,
  token: string | undefined,
  body: Record<string, unknown>,
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) headers.Cookie = `session=${token}`;

  return fetch(`${API_URL}/api/users/${encodeURIComponent(targetId)}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
}

async function listUsers(token: string) {
  return fetch(`${API_URL}/api/users`, {
    headers: { Cookie: `session=${token}` },
  });
}

async function readMembership(organizationId: string, userId: string) {
  const result = await pool.query(
    `SELECT role, is_active
     FROM organization_memberships
     WHERE organization_id = $1 AND user_id = $2`,
    [organizationId, userId],
  );

  assert.equal(result.rows.length, 1, "Expected test membership to exist");
  return result.rows[0] as { role: string; is_active: boolean };
}

async function cleanup() {
  if (sessionIds.length) {
    await pool.query(
      `DELETE FROM sessions WHERE id = ANY($1::bigint[])`,
      [sessionIds],
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
}

async function main() {
  try {
    assert.ok(process.env.DATABASE_URL, "DATABASE_URL is not configured");

    console.log("\n=== USER MANAGEMENT HIERARCHY RUNTIME TEST ===");
    console.log(`API: ${API_URL}`);

    const orgId = await createOrganization("primary");
    const foreignOrgId = await createOrganization("foreign");

    const owner = await createUser("owner", "ADMIN");
    const secondOwner = await createUser("second-owner", "ADMIN");
    const admin = await createUser("admin", "ADMIN");
    const adminPeer = await createUser("admin-peer", "ADMIN");
    const appraiser = await createUser("appraiser", "APPRAISER");
    const viewer = await createUser("viewer", "VIEWER");
    const foreignViewer = await createUser("foreign-viewer", "VIEWER");

    await addMembership(orgId, owner.id, "OWNER");
    await addMembership(orgId, secondOwner.id, "OWNER");
    await addMembership(orgId, admin.id, "ADMIN");
    await addMembership(orgId, adminPeer.id, "ADMIN");
    await addMembership(orgId, appraiser.id, "APPRAISER");
    await addMembership(orgId, viewer.id, "VIEWER");
    await addMembership(foreignOrgId, foreignViewer.id, "VIEWER");

    owner.token = await createSession(owner.id);
    admin.token = await createSession(admin.id);
    appraiser.token = await createSession(appraiser.id);
    viewer.token = await createSession(viewer.id);

    console.log("Temporary organizations, memberships, users, and sessions created.");

    // Authenticate each privileged actor before testing authorization outcomes.
    checkStatus(
      (await listUsers(owner.token)).status,
      200,
      "OWNER session authenticates and can list organization users",
    );
    checkStatus(
      (await listUsers(admin.token)).status,
      200,
      "ADMIN session authenticates and can list organization users",
    );

    // Confirm tenant-scoped user listings.
    for (const [actor, label] of [
      [owner, "OWNER"],
      [admin, "ADMIN"],
    ] as const) {
      const response = await listUsers(actor.token!);
      const payload = await response.json() as {
        users?: Array<{ id: string | number }>;
        data?: Array<{ id: string | number }>;
      };
      const listedUsers = payload.users ?? payload.data ?? [];

      assert.ok(
        !listedUsers.some((item) => String(item.id) === foreignViewer.id),
        `${label} user list must exclude foreign-organization users`,
      );
      checks.push(`${label} user list excludes foreign-organization users`);
    }

    // Unauthenticated callers must not change any account.
    checkStatus(
      (await patchUser(viewer.id, undefined, { isActive: false })).status,
      401,
      "Unauthenticated account update is rejected",
    );

    // OWNER cannot deactivate their own account.
    checkStatus(
      (await patchUser(owner.id, owner.token, { isActive: false })).status,
      403,
      "OWNER cannot deactivate own account",
    );

    // OWNER cannot manage another OWNER.
    checkStatus(
      (await patchUser(secondOwner.id, owner.token, { isActive: false })).status,
      403,
      "OWNER cannot deactivate another OWNER",
    );

    // ADMIN cannot deactivate themselves.
    checkStatus(
      (await patchUser(admin.id, admin.token, { isActive: false })).status,
      400,
      "ADMIN cannot deactivate own account",
    );

    // ADMIN cannot manage an OWNER or an equal-role ADMIN.
    checkStatus(
      (await patchUser(owner.id, admin.token, { isActive: false })).status,
      403,
      "ADMIN cannot deactivate OWNER",
    );
    checkStatus(
      (await patchUser(adminPeer.id, admin.token, { isActive: false })).status,
      403,
      "ADMIN cannot deactivate peer ADMIN",
    );

    // ADMIN can manage lower roles.
    const appraiserUpdate = await patchUser(
      appraiser.id,
      admin.token,
      { role: "VIEWER" },
    );
    checkStatus(appraiserUpdate.status, 200, "ADMIN can change APPRAISER to VIEWER");

    const updatedAppraiser = await readMembership(orgId, appraiser.id);
    assert.equal(updatedAppraiser.role, "VIEWER");
    checks.push("APPRAISER membership role updated in database");

    checkStatus(
      (await patchUser(viewer.id, admin.token, { isActive: false })).status,
      200,
      "ADMIN can deactivate VIEWER",
    );
    assert.equal(
      (await readMembership(orgId, viewer.id)).is_active,
      false,
    );
    checks.push("VIEWER membership deactivation verified in database");

    // Lower roles cannot manage users.
    checkStatus(
      (await patchUser(viewer.id, appraiser.token, { isActive: false })).status,
      403,
      "APPRAISER cannot manage users",
    );
    checkStatus(
      (await patchUser(appraiser.id, viewer.token, { isActive: false })).status,
      403,
      "VIEWER cannot manage users",
    );

    // An in-tenant actor must not discover or update another tenant's user.
    checkStatus(
      (await patchUser(foreignViewer.id, owner.token, { isActive: false })).status,
      404,
      "Cross-organization user update returns not found",
    );
    assert.equal(
      (await readMembership(foreignOrgId, foreignViewer.id)).is_active,
      true,
    );
    checks.push("Foreign membership remains active after rejected update");

    // OWNER can manage a lower-role ADMIN. Keep this last because it deactivates
    // a temporary ADMIN and tests the active-administrator protection.
    checkStatus(
      (await patchUser(adminPeer.id, owner.token, { isActive: false })).status,
      200,
      "OWNER can deactivate lower-role ADMIN",
    );
    assert.equal(
      (await readMembership(orgId, adminPeer.id)).is_active,
      false,
    );
    checks.push("OWNER-managed ADMIN deactivation verified in database");

    console.log("\n=== PASSED CHECKS ===");
    for (const item of checks) console.log(`PASS  ${item}`);
    console.log(`\nRESULT: PASS (${checks.length} checks)`);
  } catch (error) {
    console.error("\nRESULT: FAIL");
    console.error(error);
    process.exitCode = 1;
  } finally {
    try {
      await cleanup();
      console.log("Temporary test records cleaned up.");
    } catch (cleanupError) {
      console.error("CLEANUP WARNING: test records may remain.");
      console.error(cleanupError);
      process.exitCode = 1;
    }

    await pool.end();
  }
}

void main();
