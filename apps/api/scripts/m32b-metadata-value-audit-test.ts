import "dotenv/config";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { Pool } from "pg";

const API_URL = process.env.API_URL || "http://localhost:4000";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 16);

let organizationId: string | undefined;
let userId: string | undefined;
let sessionId: string | undefined;
const fieldIds: string[] = [];
const metadataRecordIds: string[] = [];
const valueIds: string[] = [];
const checks: string[] = [];

function pass(message: string) {
  checks.push(message);
  console.log(`PASS: ${message}`);
}

async function createField(fieldKey: string, displayName: string) {
  const result = await pool.query(
    `INSERT INTO field_registry
       (field_key, display_name, category, data_type, repeatable,
        organization_id, is_active)
     VALUES ($1, $2, 'Administrative', 'text', FALSE, $3, TRUE)
     RETURNING id`,
    [fieldKey, displayName, organizationId],
  );
  const id = String(result.rows[0].id);
  fieldIds.push(id);
  return id;
}

async function createMetadataRecord(referenceCode: string) {
  const result = await pool.query(
    `INSERT INTO metadata_records (reference_code, title, organization_id)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [referenceCode, `M32B audit test ${suffix}`, organizationId],
  );
  const id = String(result.rows[0].id);
  metadataRecordIds.push(id);
  return id;
}

async function request(
  token: string,
  path: string,
  method: string,
  body?: unknown,
) {
  return fetch(`${API_URL}/api/metadata-values${path}`, {
    method,
    headers: {
      Cookie: `session=${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10000),
  });
}

async function main() {
  try {
    assert.ok(process.env.DATABASE_URL, "DATABASE_URL is not configured");

    const health = await fetch(API_URL, { signal: AbortSignal.timeout(5000) });
    console.log(`API reachable at ${API_URL} (HTTP ${health.status})`);

    const org = await pool.query(
      `INSERT INTO organizations (name, slug, status)
       VALUES ($1, $2, 'ACTIVE') RETURNING id`,
      [`M32B Audit Test ${suffix}`, `m32b-audit-${suffix}`],
    );
    organizationId = String(org.rows[0].id);

    const user = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, 'APPRAISER', TRUE) RETURNING id`,
      [
        `m32b-audit-${suffix}@example.invalid`,
        "runtime-test-only-not-a-real-password-hash",
        "M32B Audit Runtime Appraiser",
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

    const normalFieldId = await createField(
      `m32b_audit_${suffix}`,
      `M32B Audit Field ${suffix}`,
    );
    const referenceFieldId = await createField(
      "reference_code",
      `M32B Reference Code Test ${suffix}`,
    );

    const recordId = await createMetadataRecord(`M32B-AUD-${suffix}`);
    const referenceRecordId = await createMetadataRecord(`M32B-REF-${suffix}`);

    console.log("\n=== M32B METADATA VALUE AUDIT TEST ===");

    // Create through the API.
    let response = await request(token, "/", "POST", {
      metadata_record_id: Number(recordId),
      field_registry_id: Number(normalFieldId),
      value: "initial test value",
      source: "USER",
      confidence: null,
      verification_status: "UNVERIFIED",
    });

    if (response.status !== 201) {
      console.error("Create response:", response.status, await response.clone().text());
    }
    assert.equal(response.status, 201, "Create should return HTTP 201");

    let body = await response.json() as {
      metadata_value?: { id?: number | string };
    };
    assert.ok(body.metadata_value?.id, "Create response should include metadata_value.id");

    const createdValueId = String(body.metadata_value.id);
    valueIds.push(createdValueId);
    pass("Create endpoint returns HTTP 201");

    // Confirm create audit is persisted and does not expose the actual value.
    let audit = await pool.query(
      `SELECT action, details
       FROM document_audit_logs
       WHERE organization_id = $1
         AND metadata_record_id = $2
         AND action = 'METADATA_VALUE_CREATED'`,
      [organizationId, recordId],
    );
    assert.equal(audit.rowCount, 1, "Exactly one create audit should exist");
    const createDetails = JSON.parse(audit.rows[0].details);
    assert.equal(String(createDetails.metadataValueId), createdValueId);
    assert.equal(createDetails.fieldKey, `m32b_audit_${suffix}`);
    assert.ok(createDetails.changedProperties.includes("value"));
    assert.equal(
      Object.values(createDetails).includes("initial test value"),
      false,
      "Audit details must not contain the actual metadata value",
    );
    pass("Create audit persists identifiers and property names without the actual value");

    // Update through the API.
    response = await request(token, `/${createdValueId}`, "PATCH", {
      value: "updated test value",
      verification_status: "VERIFIED",
    });
    if (response.status !== 200) {
      console.error("Update response:", response.status, await response.clone().text());
    }
    assert.equal(response.status, 200, "Update should return HTTP 200");
    pass("Update endpoint returns HTTP 200");

    audit = await pool.query(
      `SELECT details
       FROM document_audit_logs
       WHERE organization_id = $1
         AND metadata_record_id = $2
         AND action = 'METADATA_VALUE_UPDATED'`,
      [organizationId, recordId],
    );
    assert.equal(audit.rowCount, 1, "Exactly one update audit should exist");
    const updateDetails = JSON.parse(audit.rows[0].details);
    assert.equal(String(updateDetails.metadataValueId), createdValueId);
    assert.ok(updateDetails.changedProperties.includes("value"));
    assert.ok(updateDetails.changedProperties.includes("verification_status"));
    assert.equal(
      JSON.stringify(updateDetails).includes("updated test value"),
      false,
      "Update audit details must not contain the actual metadata value",
    );
    pass("Update audit persists changed property names without the actual value");

    // Insert a reference_code value as a test fixture because the API correctly
    // prevents creating this system-managed field through POST.
    const referenceValue = await pool.query(
      `INSERT INTO metadata_values
         (metadata_record_id, field_registry_id, value, source,
          confidence, verification_status, organization_id)
       VALUES ($1, $2, $3::jsonb, 'SYSTEM', NULL, 'VERIFIED', $4)
       RETURNING id`,
      [
        referenceRecordId,
        referenceFieldId,
        JSON.stringify(`M32B-REF-${suffix}`),
        organizationId,
      ],
    );
    const referenceValueId = String(referenceValue.rows[0].id);
    valueIds.push(referenceValueId);

    response = await request(token, `/${referenceValueId}`, "DELETE");
    assert.equal(response.status, 400, "Reference Code deletion should return HTTP 400");

    const referenceStillExists = await pool.query(
      `SELECT id FROM metadata_values
       WHERE id = $1 AND organization_id = $2`,
      [referenceValueId, organizationId],
    );
    assert.equal(referenceStillExists.rowCount, 1);
    pass("Reference Code deletion is rejected and the value remains");

    // Delete the ordinary metadata value through the API.
    response = await request(token, `/${createdValueId}`, "DELETE");
    if (response.status !== 200) {
      console.error("Delete response:", response.status, await response.clone().text());
    }
    assert.equal(response.status, 200, "Delete should return HTTP 200");
    pass("Delete endpoint returns HTTP 200");

    audit = await pool.query(
      `SELECT details
       FROM document_audit_logs
       WHERE organization_id = $1
         AND metadata_record_id = $2
         AND action = 'METADATA_VALUE_DELETED'`,
      [organizationId, recordId],
    );
    assert.equal(audit.rowCount, 1, "Exactly one delete audit should exist");
    const deleteDetails = JSON.parse(audit.rows[0].details);
    assert.equal(String(deleteDetails.metadataValueId), createdValueId);
    assert.ok(deleteDetails.changedProperties.includes("verification_status"));
    pass("Delete audit persists after successful deletion");

    const deletedRow = await pool.query(
      `SELECT id FROM metadata_values
       WHERE id = $1 AND organization_id = $2`,
      [createdValueId, organizationId],
    );
    assert.equal(deletedRow.rowCount, 0);
    pass("Deleted metadata value is absent from the database");

    // A second delete should be a not-found response and must not add an audit.
    response = await request(token, `/${createdValueId}`, "DELETE");
    assert.equal(response.status, 404, "Deleting a missing value should return HTTP 404");

    audit = await pool.query(
      `SELECT id FROM document_audit_logs
       WHERE organization_id = $1
         AND metadata_record_id = $2
         AND action = 'METADATA_VALUE_DELETED'`,
      [organizationId, recordId],
    );
    assert.equal(audit.rowCount, 1, "Missing-value deletion must not add an audit");
    pass("Missing-value deletion returns HTTP 404 without an extra audit");

    console.log(`\nAll ${checks.length} checks passed.`);
    console.log("Note: audit-insert failure rollback is not simulated by this test.");
  } finally {
    try {
      if (organizationId) {
        // Remove only this test organization's audit rows before referenced fixtures.
        await pool.query(
          `DELETE FROM document_audit_logs WHERE organization_id = $1`,
          [organizationId],
        );

        await pool.query(
          `DELETE FROM metadata_values
           WHERE organization_id = $1
             AND (
               metadata_record_id = ANY($2::bigint[])
               OR field_registry_id = ANY($3::bigint[])
               OR id = ANY($4::bigint[])
             )`,
          [organizationId, metadataRecordIds, fieldIds, valueIds],
        );

        if (metadataRecordIds.length) {
          await pool.query(
            `DELETE FROM metadata_records
             WHERE organization_id = $1 AND id = ANY($2::bigint[])`,
            [organizationId, metadataRecordIds],
          );
        }

        if (fieldIds.length) {
          await pool.query(
            `DELETE FROM field_registry
             WHERE organization_id = $1 AND id = ANY($2::bigint[])`,
            [organizationId, fieldIds],
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

      console.log("Cleanup completed for this test's temporary records.");
    } finally {
      await pool.end();
    }
  }
}

main().catch((error) => {
  console.error("\nM32B METADATA VALUE AUDIT TEST FAILED");
  console.error(error);
  process.exitCode = 1;
});
