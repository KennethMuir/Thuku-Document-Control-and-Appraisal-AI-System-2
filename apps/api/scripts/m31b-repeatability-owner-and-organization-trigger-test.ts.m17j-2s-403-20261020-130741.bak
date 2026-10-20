import "dotenv/config";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { Pool } from "pg";

const API_URL = process.env.API_URL || "http://localhost:4010";
const DATABASE_URL = process.env.DATABASE_URL || "";

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}

const pool = new Pool({ connectionString: DATABASE_URL });
const suffix = `${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
const orgSlugA = `m31b-owner-a-${suffix}`;
const orgSlugB = `m31b-owner-b-${suffix}`;
const userEmail = `m31b-owner-${suffix}@example.invalid`;

let organizationA: string | undefined;
let organizationB: string | undefined;
let userId: string | undefined;
let sessionId: string | undefined;
let fieldId: string | undefined;
let metadataRecordId: string | undefined;
let token: string | undefined;

function pass(message: string): void {
  console.log(`PASS: ${message}`);
}

async function createSession(): Promise<string> {
  const sessionToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto
    .createHash("sha256")
    .update(sessionToken)
    .digest("hex");

  const result = await pool.query(
    `INSERT INTO sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '1 hour')
     RETURNING id`,
    [userId, tokenHash],
  );

  sessionId = String(result.rows[0].id);
  return sessionToken;
}

async function main(): Promise<void> {
  let passed = false;

  try {
    const database = await pool.query<{
      database_name: string;
      read_only: string;
    }>(
      `SELECT current_database() AS database_name,
              current_setting('transaction_read_only') AS read_only`,
    );

    console.log("\n=== M31B: TEST TARGET PREFLIGHT ===");
    console.log(`Database: ${database.rows[0].database_name}`);
    console.log(`API: ${API_URL}`);

    assert.equal(
      database.rows[0].database_name,
      "m17j_tenant_ownership_test_20261017",
      "Refusing to run against an unexpected database",
    );
    assert.equal(
      database.rows[0].read_only,
      "off",
      "Disposable test database must be writable",
    );
    assert.equal(
      new URL(API_URL).port,
      "4010",
      "Refusing to call an API port other than 4010",
    );
    pass("API and writable disposable database targets verified");

    const apiProbe = await fetch(`${API_URL}/api/field-registry`, {
      method: "GET",
    });
    console.log(`Field registry API probe: HTTP ${apiProbe.status}`);

    const orgAResult = await pool.query(
      `INSERT INTO organizations (name, slug, status)
       VALUES ($1, $2, 'ACTIVE')
       RETURNING id`,
      [`M31B Owner Test A ${suffix}`, orgSlugA],
    );
    organizationA = String(orgAResult.rows[0].id);

    const orgBResult = await pool.query(
      `INSERT INTO organizations (name, slug, status)
       VALUES ($1, $2, 'ACTIVE')
       RETURNING id`,
      [`M31B Owner Test B ${suffix}`, orgSlugB],
    );
    organizationB = String(orgBResult.rows[0].id);

    const userResult = await pool.query(
      `INSERT INTO users
         (email, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, 'APPRAISER', TRUE)
       RETURNING id`,
      [
        userEmail,
        "runtime-test-only-not-a-real-password-hash",
        `M31B Owner Test ${suffix}`,
      ],
    );
    userId = String(userResult.rows[0].id);

    await pool.query(
      `INSERT INTO organization_memberships
         (organization_id, user_id, role, is_active)
       VALUES ($1, $2, 'OWNER', TRUE)`,
      [organizationA, userId],
    );

    const fieldResult = await pool.query(
      `INSERT INTO field_registry
         (field_key, display_name, category, data_type,
          repeatable, organization_id, is_active)
       VALUES ($1, $2, 'Administrative', 'text', TRUE, $3, TRUE)
       RETURNING id`,
      [
        `m31b_owner_repeatable_${suffix}`,
        `M31B Owner Repeatable ${suffix}`,
        organizationA,
      ],
    );
    fieldId = String(fieldResult.rows[0].id);

    const recordResult = await pool.query(
      `INSERT INTO metadata_records (reference_code, title, organization_id)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [
        `M31B-OWNER-${suffix}`,
        `M31B Owner Test Record ${suffix}`,
        organizationA,
      ],
    );
    metadataRecordId = String(recordResult.rows[0].id);

    token = await createSession();

    // Seed two values directly while the field is repeatable.
    await pool.query(
      `INSERT INTO metadata_values
         (metadata_record_id, field_registry_id, value, source,
          confidence, verification_status, organization_id)
       VALUES
         ($1, $2, $3::jsonb, 'USER', NULL, 'UNVERIFIED', $4),
         ($1, $2, $5::jsonb, 'USER', NULL, 'UNVERIFIED', $4)`,
      [
        metadataRecordId,
        fieldId,
        JSON.stringify("first duplicate"),
        organizationA,
        JSON.stringify("second duplicate"),
      ],
    );

    const before = await pool.query(
      `SELECT COUNT(*)::int AS value_count
       FROM metadata_values
       WHERE metadata_record_id = $1
         AND field_registry_id = $2
         AND organization_id = $3`,
      [metadataRecordId, fieldId, organizationA],
    );

    assert.equal(
      before.rows[0].value_count,
      2,
      "Precondition: exactly two values should exist",
    );
    pass("Precondition confirmed: two values exist for the same record and field");

    // Verify an OWNER can use the existing administrative route.
    const patchResponse = await fetch(
      `${API_URL}/api/field-registry/${encodeURIComponent(
        `m31b_owner_repeatable_${suffix}`,
      )}`,
      {
        method: "PATCH",
        headers: {
          Cookie: `session=${token}`,
          "Content-Type": "application/json",
          "X-Organization-Id": organizationA,
        },
        body: JSON.stringify({ repeatable: false }),
      },
    );

    const patchBody = await patchResponse.text();

    assert.equal(
      patchResponse.status,
      409,
      `Expected HTTP 409 when disabling repeatability; got ${patchResponse.status}: ${patchBody}`,
    );
    pass("OWNER field PATCH rejects disabling repeatability with HTTP 409");

    const afterPatch = await pool.query(
      `SELECT fr.repeatable,
              (SELECT COUNT(*)::int
               FROM metadata_values mv
               WHERE mv.metadata_record_id = $2
                 AND mv.field_registry_id = fr.id
                 AND mv.organization_id = $3) AS value_count
       FROM field_registry fr
       WHERE fr.id = $1
         AND fr.organization_id = $3`,
      [fieldId, metadataRecordId, organizationA],
    );

    assert.equal(afterPatch.rows.length, 1, "Field should still exist");
    assert.equal(
      afterPatch.rows[0].repeatable,
      true,
      "Failed PATCH must leave repeatable unchanged",
    );
    assert.equal(
      afterPatch.rows[0].value_count,
      2,
      "Failed PATCH must preserve both existing values",
    );
    pass("Failed PATCH preserved repeatable=true and both values");

    // Exercise the database organization-validation trigger directly.
    // The failing insert is inside its own transaction and is rolled back.
    const client = await pool.connect();
    let triggerRejected = false;

    try {
      await client.query("BEGIN");

      try {
        await client.query(
          `INSERT INTO metadata_values
             (metadata_record_id, field_registry_id, value, source,
              confidence, verification_status, organization_id)
           VALUES ($1, $2, $3::jsonb, 'USER', NULL, 'UNVERIFIED', $4)`,
          [
            metadataRecordId,
            fieldId,
            JSON.stringify("deliberately mismatched organization"),
            organizationB,
          ],
        );
      } catch (error) {
        const pgError = error as { message?: string; code?: string };
        const message = pgError.message || "";
        triggerRejected =
          message.includes(
            "Metadata value organization does not match metadata record organization",
          ) ||
          message.includes(
            "Metadata value organization cannot use a field definition belonging to another organization",
          );

        if (!triggerRejected) {
          throw error;
        }
      }

      assert.equal(
        triggerRejected,
        true,
        "Organization-validation trigger should reject the cross-organization insert",
      );

      await client.query("ROLLBACK");
      pass("Organization-validation trigger rejected the cross-organization insert");
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the original failure.
      }
      throw error;
    } finally {
      client.release();
    }

    const afterTrigger = await pool.query(
      `SELECT COUNT(*)::int AS value_count
       FROM metadata_values
       WHERE metadata_record_id = $1
         AND field_registry_id = $2
         AND organization_id = $3`,
      [metadataRecordId, fieldId, organizationA],
    );

    assert.equal(
      afterTrigger.rows[0].value_count,
      2,
      "Trigger test must not change the original organization's values",
    );

    const persistedWrongOrg = await pool.query(
      `SELECT COUNT(*)::int AS value_count
       FROM metadata_values
       WHERE metadata_record_id = $1
         AND field_registry_id = $2
         AND organization_id = $3`,
      [metadataRecordId, fieldId, organizationB],
    );

    assert.equal(
      persistedWrongOrg.rows[0].value_count,
      0,
      "No cross-organization value should persist",
    );
    pass("Post-rollback counts confirm no cross-organization value persisted");

    passed = true;
    console.log("\nAll M31B owner/organization-trigger checks passed.");
  } finally {
    console.log("\n=== M31B: TEMPORARY FIXTURE CLEANUP ===");

    try {
      if (organizationA || organizationB || metadataRecordId || fieldId) {
        await pool.query(
          `DELETE FROM metadata_values
           WHERE ($1::bigint IS NOT NULL AND organization_id = $1)
              OR ($2::bigint IS NOT NULL AND organization_id = $2)
              OR ($3::bigint IS NOT NULL AND metadata_record_id = $3)
              OR ($4::bigint IS NOT NULL AND field_registry_id = $4)`,
          [
            organizationA ?? null,
            organizationB ?? null,
            metadataRecordId ?? null,
            fieldId ?? null,
          ],
        );
      }

      if (metadataRecordId) {
        await pool.query(
          "DELETE FROM metadata_records WHERE id = $1",
          [metadataRecordId],
        );
      }

      if (fieldId) {
        await pool.query("DELETE FROM field_registry WHERE id = $1", [fieldId]);
      }

      if (sessionId) {
        await pool.query("DELETE FROM sessions WHERE id = $1", [sessionId]);
      }

      if (userId) {
        await pool.query(
          "DELETE FROM organization_memberships WHERE user_id = $1",
          [userId],
        );
      }

      if (organizationA) {
        await pool.query("DELETE FROM organizations WHERE id = $1", [organizationA]);
      }

      if (organizationB) {
        await pool.query("DELETE FROM organizations WHERE id = $1", [organizationB]);
      }

      if (userId) {
        await pool.query("DELETE FROM users WHERE id = $1", [userId]);
      }

      console.log("Cleanup completed.");
    } finally {
      await pool.end();
    }

    if (!passed) {
      console.error("M31B regression test did not complete successfully.");
    }
  }
}

main().catch((error: unknown) => {
  console.error("\nM31B regression test failed:");
  console.error(error);
  process.exitCode = 1;
});
