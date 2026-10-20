import "dotenv/config";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { Pool } from "pg";

const API_URL = process.env.API_URL || "http://localhost:4000";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
const triggerName = `m32b_fail_audit_${suffix}`;
const functionName = `m32b_fail_audit_fn_${suffix}`;

let organizationId: string | undefined;
let userId: string | undefined;
let sessionId: string | undefined;
let fieldId: string | undefined;
let recordId: string | undefined;
let valueId: string | undefined;
let triggerCreated = false;
let functionCreated = false;

async function cleanup() {
  // Remove the trigger first so it cannot interfere with cleanup.
  if (triggerCreated) {
    await pool.query(`DROP TRIGGER IF EXISTS "${triggerName}" ON document_audit_logs`);
    triggerCreated = false;
  }

  if (functionCreated) {
    await pool.query(`DROP FUNCTION IF EXISTS public."${functionName}"()`);
    functionCreated = false;
  }

  if (organizationId) {
    await pool.query(
      `DELETE FROM document_audit_logs WHERE organization_id = $1`,
      [organizationId],
    );

    await pool.query(
      `DELETE FROM metadata_values
       WHERE organization_id = $1
         AND (
           ($2::bigint IS NOT NULL AND id = $2::bigint)
           OR ($3::bigint IS NOT NULL AND metadata_record_id = $3::bigint)
         )`,
      [organizationId, valueId ?? null, recordId ?? null],
    );

    if (recordId) {
      await pool.query(
        `DELETE FROM metadata_records WHERE organization_id = $1 AND id = $2`,
        [organizationId, recordId],
      );
    }

    if (fieldId) {
      await pool.query(
        `DELETE FROM field_registry WHERE organization_id = $1 AND id = $2`,
        [organizationId, fieldId],
      );
    }
  }

  if (sessionId) {
    await pool.query(`DELETE FROM sessions WHERE id = $1`, [sessionId]);
  }

  if (userId) {
    await pool.query(
      `DELETE FROM organization_memberships WHERE user_id = $1`,
      [userId],
    );
  }

  if (organizationId) {
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [organizationId]);
  }

  if (userId) {
    await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
  }
}

async function main() {
  try {
    assert.ok(process.env.DATABASE_URL, "DATABASE_URL is not configured");

    const database = await pool.query(`
      SELECT current_database() AS database_name,
             current_setting('transaction_read_only') AS read_only
    `);

    const databaseName = String(database.rows[0].database_name);
    console.log("Database:", databaseName);
    assert.match(
      databaseName,
      /test/i,
      "Refusing to install a temporary trigger: database name is not clearly test-only",
    );
    assert.equal(database.rows[0].read_only, "off", "Database is read-only");

    // Verify the API is reachable before preparing fixtures.
    const health = await fetch(`${API_URL}/api/health`, {
      signal: AbortSignal.timeout(5000),
    });
    console.log("API health HTTP status:", health.status);

    const org = await pool.query(
      `INSERT INTO organizations (name, slug, status)
       VALUES ($1, $2, 'ACTIVE') RETURNING id`,
      [`M32B Rollback Test ${suffix}`, `m32b-rollback-${suffix}`],
    );
    organizationId = String(org.rows[0].id);

    const user = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, 'APPRAISER', TRUE) RETURNING id`,
      [
        `m32b-rollback-${suffix}@example.invalid`,
        "runtime-test-only-not-a-real-password-hash",
        "M32B Rollback Test Appraiser",
      ],
    );
    userId = String(user.rows[0].id);

    await pool.query(
      `INSERT INTO organization_memberships
         (organization_id, user_id, role, is_active)
       VALUES ($1, $2, 'APPRAISER', TRUE)`,
      [organizationId, userId],
    );

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const session = await pool.query(
      `INSERT INTO sessions (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '1 hour') RETURNING id`,
      [userId, tokenHash],
    );
    sessionId = String(session.rows[0].id);

    const field = await pool.query(
      `INSERT INTO field_registry
         (field_key, display_name, category, data_type, repeatable,
          organization_id, is_active)
       VALUES ($1, $2, 'Administrative', 'text', FALSE, $3, TRUE)
       RETURNING id`,
      [`m32b_rollback_${suffix}`, `Rollback Test ${suffix}`, organizationId],
    );
    fieldId = String(field.rows[0].id);

    const record = await pool.query(
      `INSERT INTO metadata_records (reference_code, title, organization_id)
       VALUES ($1, $2, $3) RETURNING id`,
      [`M32B-RB-${suffix}`, `Rollback test ${suffix}`, organizationId],
    );
    recordId = String(record.rows[0].id);

    const value = await pool.query(
      `INSERT INTO metadata_values
         (metadata_record_id, field_registry_id, value, source,
          confidence, verification_status, organization_id)
       VALUES ($1, $2, $3::jsonb, 'USER', NULL, 'UNVERIFIED', $4)
       RETURNING id`,
      [recordId, fieldId, JSON.stringify("rollback must preserve this value"), organizationId],
    );
    valueId = String(value.rows[0].id);

    // The function only rejects the delete-audit event for this test organization.
    await pool.query(`
      CREATE FUNCTION public."${functionName}"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $m32b$
      BEGIN
        IF NEW.organization_id = ${Number(organizationId)}
           AND NEW.action = 'METADATA_VALUE_DELETED' THEN
          RAISE EXCEPTION 'M32B test: intentionally reject delete audit';
        END IF;
        RETURN NEW;
      END;
      $m32b$
    `);
    functionCreated = true;

    await pool.query(`
      CREATE TRIGGER "${triggerName}"
      BEFORE INSERT ON document_audit_logs
      FOR EACH ROW
      EXECUTE FUNCTION public."${functionName}"()
    `);
    triggerCreated = true;

    console.log("\n--- Request deletion while audit insertion is forced to fail ---");

    const response = await fetch(`${API_URL}/api/metadata-values/${valueId}`, {
      method: "DELETE",
      headers: { Cookie: `session=${token}` },
      signal: AbortSignal.timeout(10000),
    });

    const responseText = await response.text();
    console.log("Delete HTTP status:", response.status);

    assert.equal(
      response.status,
      500,
      `Expected HTTP 500 when audit insertion fails; response was: ${responseText}`,
    );
    console.log("[PASS] API reports failure when the delete audit cannot be inserted.");

    const persistedValue = await pool.query(
      `SELECT id, value
       FROM metadata_values
       WHERE id = $1 AND organization_id = $2`,
      [valueId, organizationId],
    );

    assert.equal(
      persistedValue.rowCount,
      1,
      "The metadata value must remain because the transaction should roll back",
    );
    assert.equal(
      persistedValue.rows[0].value,
      "rollback must preserve this value",
      "The original metadata value should remain unchanged",
    );
    console.log("[PASS] Failed audit insertion rolls back the deletion; the value remains unchanged.");

    const deleteAudit = await pool.query(
      `SELECT id
       FROM document_audit_logs
       WHERE organization_id = $1
         AND metadata_record_id = $2
         AND action = 'METADATA_VALUE_DELETED'`,
      [organizationId, recordId],
    );

    assert.equal(deleteAudit.rowCount, 0, "Failed delete must not leave a delete audit event");
    console.log("[PASS] No delete audit event was persisted.");

    console.log("\nM32B audit failure rollback test passed.");
  } finally {
    try {
      await cleanup();
      console.log("[PASS] Temporary trigger, function, and test fixtures cleaned up.");
    } finally {
      await pool.end();
    }
  }
}

main().catch((error) => {
  console.error("\nM32B AUDIT FAILURE ROLLBACK TEST FAILED");
  console.error(error);
  process.exitCode = 1;
});
