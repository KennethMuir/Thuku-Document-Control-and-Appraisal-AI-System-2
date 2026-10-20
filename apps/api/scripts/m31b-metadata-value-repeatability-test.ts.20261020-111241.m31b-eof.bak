import "dotenv/config";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { Pool } from "pg";

const API_URL = process.env.API_URL || "http://localhost:4000";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 16);

const orgSlug = `m31b-repeat-${suffix}`;
const userEmail = `m31b-appraiser-${suffix}@example.invalid`;
const nonRepeatableKey = `m31b_single_${suffix}`;
const repeatableKey = `m31b_multi_${suffix}`;

let organizationId: string | undefined;
let userId: string | undefined;
let sessionId: string | undefined;
const fieldIds: string[] = [];
const metadataRecordIds: string[] = [];
const createdValueIds: string[] = [];
const checks: string[] = [];

function pass(message: string) {
  checks.push(message);
  console.log(`PASS: ${message}`);
}

async function createField(
  fieldKey: string,
  displayName: string,
  repeatable: boolean,
): Promise<string> {
  const result = await pool.query(
    `INSERT INTO field_registry (
       field_key, display_name, category, data_type,
       repeatable, organization_id, is_active
     )
     VALUES ($1, $2, 'Administrative', 'text', $3, $4, TRUE)
     RETURNING id`,
    [fieldKey, displayName, repeatable, organizationId],
  );

  const id = String(result.rows[0].id);
  fieldIds.push(id);
  return id;
}

async function createMetadataRecord(referenceCode: string): Promise<string> {
  const result = await pool.query(
    `INSERT INTO metadata_records (
       reference_code, title, organization_id
     )
     VALUES ($1, $2, $3)
     RETURNING id`,
    [referenceCode, `M31B runtime test ${suffix}`, organizationId],
  );

  const id = String(result.rows[0].id);
  metadataRecordIds.push(id);
  return id;
}

async function createSession(): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const result = await pool.query(
    `INSERT INTO sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '1 hour')
     RETURNING id`,
    [userId, tokenHash],
  );

  sessionId = String(result.rows[0].id);
  return token;
}

async function createValue(
  token: string,
  metadataRecordId: string,
  fieldRegistryId: string,
  value: string,
) {
  return fetch(`${API_URL}/api/metadata-values/`, {
    method: "POST",
    headers: {
      Cookie: `session=${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      metadata_record_id: Number(metadataRecordId),
      field_registry_id: Number(fieldRegistryId),
      value,
      source: "USER",
      confidence: null,
      verification_status: "UNVERIFIED",
    }),
  });
}

async function main() {
  try {
    assert.ok(process.env.DATABASE_URL, "DATABASE_URL is not configured");

    // Check API reachability before creating temporary database fixtures.
    const healthResponse = await fetch(API_URL, { signal: AbortSignal.timeout(5000) });
    console.log(`API reachable at ${API_URL} (HTTP ${healthResponse.status})`);

    const organization = await pool.query(
      `INSERT INTO organizations (name, slug, status)
       VALUES ($1, $2, 'ACTIVE')
       RETURNING id`,
      [`M31B Repeatability Test ${suffix}`, orgSlug],
    );
    organizationId = String(organization.rows[0].id);

    const user = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, 'APPRAISER', TRUE)
       RETURNING id`,
      [
        userEmail,
        "runtime-test-only-not-a-real-password-hash",
        "M31B Runtime Appraiser",
      ],
    );
    userId = String(user.rows[0].id);

    await pool.query(
      `INSERT INTO organization_memberships
         (organization_id, user_id, role, is_active)
       VALUES ($1, $2, 'APPRAISER', TRUE)`,
      [organizationId, userId],
    );

    const nonRepeatableFieldId = await createField(
      nonRepeatableKey,
      `M31B Single ${suffix}`,
      false,
    );

    const repeatableFieldId = await createField(
      repeatableKey,
      `M31B Multiple ${suffix}`,
      true,
    );

    const sequentialRecordId = await createMetadataRecord(`M31B-${suffix}-SEQ`);
    const concurrentRecordId = await createMetadataRecord(`M31B-${suffix}-CON`);
    const repeatableRecordId = await createMetadataRecord(`M31B-${suffix}-REP`);
    const token = await createSession();

    console.log("\n=== M31B: METADATA VALUE REPEATABILITY TEST ===");

    // Sequential duplicate: first succeeds; second must be rejected.
    let response = await createValue(
      token, sequentialRecordId, nonRepeatableFieldId, "sequential first",
    );
    if (response.status !== 201) {
      console.error("First sequential create:", await response.clone().text());
    }
    assert.equal(response.status, 201, "First non-repeatable value should be created");
    pass("First non-repeatable value returns HTTP 201");

    let body = await response.json() as { id?: number | string; data?: { id?: number | string }; value?: { id?: number | string }; metadata_value?: { id?: number | string } };
    let createdId = body.id ?? body.data?.id ?? body.value?.id ?? body.metadata_value?.id;
    if (createdId !== undefined) createdValueIds.push(String(createdId));

    if (createdId === undefined) {
      throw new Error("Create response did not contain metadata_value.id.");
    }

    response = await fetch(`${API_URL}/api/metadata-values/${createdId}`, {
      method: "PATCH",
      headers: {
        Cookie: `session=${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ value: "sequential updated" }),
    });

    if (response.status !== 200) {
      console.error("PATCH existing value response:", response.status, await response.clone().text());
    }
    assert.equal(response.status, 200, "Updating an existing metadata value should return HTTP 200");
    pass("PATCH updates an existing metadata value successfully");

    response = await createValue(
      token, sequentialRecordId, nonRepeatableFieldId, "sequential duplicate",
    );
    if (response.status !== 409) {
      console.error("Sequential duplicate response:", await response.clone().text());
    }
    assert.equal(response.status, 409, "Duplicate non-repeatable value should return HTTP 409");
    pass("Sequential duplicate is rejected with HTTP 409");

    // Two requests race for the same record and non-repeatable field.
    const concurrentResponses = await Promise.all([
      createValue(token, concurrentRecordId, nonRepeatableFieldId, "concurrent A"),
      createValue(token, concurrentRecordId, nonRepeatableFieldId, "concurrent B"),
    ]);

    const concurrentStatuses = concurrentResponses.map((item) => item.status).sort();
    for (const item of concurrentResponses) {
      if (item.status !== 201 && item.status !== 409) {
        console.error("Unexpected concurrent response:", item.status, await item.clone().text());
      }
    }

    assert.deepEqual(
      concurrentStatuses,
      [201, 409],
      "Concurrent requests should yield exactly one create and one conflict",
    );
    pass("Concurrent non-repeatable requests yield one HTTP 201 and one HTTP 409");

    // Repeatable fields must continue to accept multiple values.
    const repeatableResponses = await Promise.all([
      createValue(token, repeatableRecordId, repeatableFieldId, "repeatable A"),
      createValue(token, repeatableRecordId, repeatableFieldId, "repeatable B"),
    ]);

    for (const item of repeatableResponses) {
      if (item.status !== 201) {
        console.error("Repeatable create response:", item.status, await item.clone().text());
      }
    }

    assert.deepEqual(
      repeatableResponses.map((item) => item.status),
      [201, 201],
      "Both repeatable values should be accepted",
    );
    pass("Repeatable field accepts both values");

    // Verify persisted counts for this test's exact record/field combinations.
    const counts = await pool.query(
      `SELECT metadata_record_id, field_registry_id, COUNT(*)::int AS value_count
       FROM metadata_values
       WHERE organization_id = $1
         AND (
           (metadata_record_id = $2 AND field_registry_id = $3)
           OR (metadata_record_id = $4 AND field_registry_id = $3)
           OR (metadata_record_id = $5 AND field_registry_id = $6)
         )
       GROUP BY metadata_record_id, field_registry_id`,
      [
        organizationId,
        sequentialRecordId, nonRepeatableFieldId,
        concurrentRecordId,
        repeatableRecordId, repeatableFieldId,
      ],
    );

    const countByPair = new Map(
      counts.rows.map((row) => [
        `${row.metadata_record_id}:${row.field_registry_id}`,
        Number(row.value_count),
      ]),
    );

    assert.equal(countByPair.get(`${sequentialRecordId}:${nonRepeatableFieldId}`), 1);
    assert.equal(countByPair.get(`${concurrentRecordId}:${nonRepeatableFieldId}`), 1);
    assert.equal(countByPair.get(`${repeatableRecordId}:${repeatableFieldId}`), 2);
    pass("Database counts confirm no duplicate non-repeatable values and two repeatable values");

    console.log(`\nAll ${checks.length} checks passed.`);
    console.log("Scope: API POST/PATCH route behavior only; this script does not apply migrations.");
  } finally {
    try {
      // Scope cleanup to this unique test organization and its fixture IDs.
      if (organizationId) {
        await pool.query(
          `DELETE FROM metadata_values
           WHERE organization_id = $1
             AND (
               metadata_record_id = ANY($2::bigint[])
               OR field_registry_id = ANY($3::bigint[])
             )`,
          [organizationId, metadataRecordIds, fieldIds],
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
        await pool.query(`DELETE FROM organization_memberships WHERE user_id = $1`, [userId]);
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
  console.error("\nM31B METADATA VALUE REPEATABILITY TEST FAILED");
  console.error(error);
  process.exitCode = 1;
});
