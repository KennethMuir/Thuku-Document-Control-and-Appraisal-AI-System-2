import "dotenv/config";

import { createHash, randomBytes } from "crypto";
import { Pool } from "pg";

const API_URL =
  process.env.M22_TEST_API_URL ||
  "http://localhost:4000";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function assertCondition(
  condition: unknown,
  message: string
): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function main() {
  let sessionId: number | null = null;
  let createdDomainId: number | null = null;
  let createdDomainKey: string | null = null;
  let organizationId: number | null = null;

  try {
    console.log("\n==============================================");
    console.log("M22 DOMAIN REGISTRY ORGANIZATION DOMAIN TEST");
    console.log("==============================================");
    console.log(`API: ${API_URL}`);

    // 1. Locate an existing active OWNER/ADMIN organization.
    const adminResult = await pool.query<{
      user_id: number;
      organization_id: number;
      role: string;
    }>(`
      SELECT
        om.user_id,
        om.organization_id,
        om.role
      FROM organization_memberships om
      INNER JOIN users u
        ON u.id = om.user_id
      INNER JOIN organizations o
        ON o.id = om.organization_id
      WHERE
        om.is_active = TRUE
        AND u.is_active = TRUE
        AND om.role IN ('OWNER', 'ADMIN')
        AND o.status = 'ACTIVE'
      ORDER BY
        CASE om.role
          WHEN 'OWNER' THEN 1
          WHEN 'ADMIN' THEN 2
        END,
        om.user_id
      LIMIT 1
    `);

    assertCondition(
      adminResult.rows.length === 1,
      "No active OWNER/ADMIN organization membership is available."
    );

    const testUserId = adminResult.rows[0]!.user_id;
    organizationId = adminResult.rows[0]!.organization_id;
    const testRole = adminResult.rows[0]!.role;

    console.log(
      `Authenticated context: user=${testUserId}, organization=${organizationId}, role=${testRole}`
    );

    // 2. Create temporary authenticated session.
    const rawSessionToken =
      randomBytes(32).toString("hex");

    const tokenHash =
      createHash("sha256")
        .update(rawSessionToken)
        .digest("hex");

    const sessionResult = await pool.query<{ id: number }>(
      `
        INSERT INTO sessions (
          user_id,
          token_hash,
          expires_at
        )
        VALUES (
          $1,
          $2,
          NOW() + INTERVAL '1 hour'
        )
        RETURNING id
      `,
      [
        testUserId,
        tokenHash,
      ]
    );

    sessionId = sessionResult.rows[0]!.id;

    console.log(
      `Temporary authenticated session created: ${sessionId}`
    );

    // 3. Use a unique organization-specific domain key.
    createdDomainKey =
      `m22_test_domain_${Date.now()}`;

    const createPayload = {
      domain_key: createdDomainKey,
      display_name: "M22 Test Organization Domain",
      description:
        "Temporary domain created by the M22 runtime verification.",
      domain_family: "General / Administrative",
    };

    // 4. Create the organization-specific domain through the API.
    const createResponse = await fetch(
      `${API_URL}/api/domain-registry`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session=${rawSessionToken}`,
        },
        body: JSON.stringify(createPayload),
      }
    );

    const createBody = await createResponse.json();

    console.log(
      `Create HTTP STATUS: ${createResponse.status}`
    );

    assertCondition(
      createResponse.status === 201,
      `Expected HTTP 201, received ${createResponse.status}: ${JSON.stringify(createBody)}`
    );

    assertCondition(
      createBody?.success === true,
      "Create response success was not true."
    );

    assertCondition(
      createBody?.domain_definition,
      "Create response did not contain domain_definition."
    );

    const createdDomain =
      createBody.domain_definition;

    createdDomainId = Number(createdDomain.id);

    assertCondition(
      Number.isInteger(createdDomainId) &&
        createdDomainId > 0,
      "Created domain did not return a valid ID."
    );

    assertCondition(
      createdDomain.domain_key === createdDomainKey,
      "Created domain key does not match the requested key."
    );

    assertCondition(
      createdDomain.organization_id === organizationId,
      `Created domain organization_id ${createdDomain.organization_id} does not match authenticated organization ${organizationId}.`
    );

    assertCondition(
      createdDomain.is_active === true,
      "Created organization domain is not active."
    );

    console.log(
      `Created domain ID: ${createdDomainId}`
    );

    console.log(
      `Created domain organization_id: ${createdDomain.organization_id}`
    );

    console.log(
      "PASS: Organization-specific domain was created with the authenticated organization ID."
    );

    // 5. Verify ownership directly in the database.
    const ownershipResult = await pool.query<{
      id: number;
      organization_id: number;
      is_active: boolean;
    }>(
      `
        SELECT
          id,
          organization_id,
          is_active
        FROM domain_registry
        WHERE id = $1
      `,
      [createdDomainId]
    );

    assertCondition(
      ownershipResult.rows.length === 1,
      "Created domain was not found in the database."
    );

    const dbDomain = ownershipResult.rows[0]!;

    assertCondition(
      dbDomain.organization_id === organizationId,
      "Database ownership does not match the authenticated organization."
    );

    assertCondition(
      dbDomain.is_active === true,
      "Database domain is not active."
    );

    console.log(
      "PASS: Database ownership is correctly organization-scoped."
    );

    // 6. Verify the authenticated organization can retrieve the domain.
    const getResponse = await fetch(
      `${API_URL}/api/domain-registry/${encodeURIComponent(createdDomainKey)}`,
      {
        method: "GET",
        headers: {
          Cookie: `session=${rawSessionToken}`,
        },
      }
    );

    const getBody = await getResponse.json();

    console.log(
      `Authenticated GET HTTP STATUS: ${getResponse.status}`
    );

    assertCondition(
      getResponse.status === 200,
      `Expected authenticated GET HTTP 200, received ${getResponse.status}: ${JSON.stringify(getBody)}`
    );

    assertCondition(
      getBody?.success === true,
      "Authenticated GET success was not true."
    );

    assertCondition(
      getBody?.domain_definition?.organization_id === organizationId,
      "Authenticated GET returned a domain outside the authenticated organization."
    );

    console.log(
      "PASS: Creating organization can retrieve its own domain."
    );

    // 7. Verify the domain appears in the organization registry.
    const listResponse = await fetch(
      `${API_URL}/api/domain-registry`,
      {
        method: "GET",
        headers: {
          Cookie: `session=${rawSessionToken}`,
        },
      }
    );

    const listBody = await listResponse.json();

    assertCondition(
      listResponse.status === 200,
      `Expected registry GET HTTP 200, received ${listResponse.status}.`
    );

    assertCondition(
      listBody?.success === true,
      "Registry GET success was not true."
    );

    assertCondition(
      Array.isArray(listBody?.domain_registry),
      "Registry response did not contain domain_registry."
    );

    const matchingDomain =
      listBody.domain_registry.find(
        (domain: any) =>
          domain.domain_key === createdDomainKey
      );

    assertCondition(
      matchingDomain !== undefined,
      "Created organization domain was not returned by the registry."
    );

    assertCondition(
      matchingDomain.organization_id === organizationId,
      "Listed organization domain has incorrect organization ownership."
    );

    console.log(
      "PASS: Organization-specific domain appears in the authenticated registry."
    );

    // 8. Verify system-domain count remains 27.
    const systemDomainCount =
      listBody.domain_registry.filter(
        (domain: any) =>
          domain.organization_id === null
      ).length;

    assertCondition(
      systemDomainCount === 27,
      `Expected 27 system domains, received ${systemDomainCount}.`
    );

    console.log(
      "PASS: The 27 system domains remain intact."
    );

    console.log(
      "\nM22 ORGANIZATION DOMAIN CREATION TEST PASSED."
    );
  } finally {
    // 9. Remove only the temporary domain created by this test.
    if (
      createdDomainKey !== null &&
      organizationId !== null
    ) {
      await pool.query(
        `
          DELETE FROM domain_registry
          WHERE
            domain_key = $1
            AND organization_id = $2
        `,
        [
          createdDomainKey,
          organizationId,
        ]
      );

      console.log(
        `Cleanup: removed temporary domain ${createdDomainKey}.`
      );
    }

    // 10. Remove temporary session.
    if (sessionId !== null) {
      await pool.query(
        `
          DELETE FROM sessions
          WHERE id = $1
        `,
        [sessionId]
      );

      console.log(
        `Cleanup: removed temporary authenticated session ${sessionId}.`
      );
    }

    await pool.end();
  }
}

main().catch((error) => {
  console.error("\nM22 ORGANIZATION DOMAIN TEST FAILED.");
  console.error(error);
});
