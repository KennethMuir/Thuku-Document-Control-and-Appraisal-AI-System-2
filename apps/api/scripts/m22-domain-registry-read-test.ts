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

  try {
    console.log("\n==============================================");
    console.log("M22 DOMAIN REGISTRY AUTHENTICATED READ TEST");
    console.log("==============================================");
    console.log(`API: ${API_URL}`);

    // 1. Locate an existing active OWNER/ADMIN organization membership.
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
    const testOrganizationId =
      adminResult.rows[0]!.organization_id;
    const testRole = adminResult.rows[0]!.role;

    console.log(
      `Authenticated context: user=${testUserId}, organization=${testOrganizationId}, role=${testRole}`
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

    // 3. Request Domain Registry using the authenticated session.
    const response = await fetch(
      `${API_URL}/api/domain-registry`,
      {
        method: "GET",
        headers: {
          Cookie: `session=${rawSessionToken}`,
        },
      }
    );

    const body = await response.json();

    console.log(`HTTP STATUS: ${response.status}`);

    assertCondition(
      response.status === 200,
      `Expected HTTP 200, received ${response.status}.`
    );

    assertCondition(
      body &&
        body.success === true &&
        Array.isArray(body.field_registry) === false,
      "Domain Registry response shape is incorrect."
    );

    assertCondition(
      Array.isArray(body.domains) ||
        Array.isArray(body.domain_registry),
      "Domain Registry response does not contain a domain collection."
    );

    const domains =
      Array.isArray(body.domain_registry)
        ? body.domain_registry
        : body.domains;

    console.log(
      `Returned domain count: ${domains.length}`
    );

    const systemDomains = domains.filter(
      (domain: any) =>
        domain.organization_id === null
    );

    const organizationDomains = domains.filter(
      (domain: any) =>
        domain.organization_id !== null
    );

    console.log(
      `System domains returned: ${systemDomains.length}`
    );

    console.log(
      `Organization-specific domains returned: ${organizationDomains.length}`
    );

    assertCondition(
      domains.length === 27,
      `Expected 27 active system domains, received ${domains.length}.`
    );

    assertCondition(
      systemDomains.length === 27,
      `Expected all 27 returned domains to be system domains, received ${systemDomains.length}.`
    );

    assertCondition(
      organizationDomains.length === 0,
      `Expected 0 organization-specific domains, received ${organizationDomains.length}.`
    );

    assertCondition(
      domains.every(
        (domain: any) =>
          domain.is_active === true
      ),
      "Inactive domains were returned."
    );

    console.log(
      "PASS: Authenticated organization member can read the M22 Domain Registry."
    );

    console.log(
      "PASS: All 27 system domains are visible."
    );

    console.log(
      "PASS: No organization-specific domains are present."
    );
  } finally {
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
  console.error("\nM22 AUTHENTICATED READ TEST FAILED.");
  console.error(error);
});

