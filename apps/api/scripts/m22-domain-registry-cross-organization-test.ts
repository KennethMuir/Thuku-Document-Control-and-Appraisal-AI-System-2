import "dotenv/config";
import crypto from "crypto";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const API_URL = process.env.API_URL || "http://localhost:4000";

async function main() {
  console.log("\n==============================================");
  console.log("M22 DOMAIN REGISTRY CROSS-ORGANIZATION TEST");
  console.log("==============================================");

  let temporaryOrganizationId: number | null = null;
  let temporaryMembershipId: number | null = null;
  let temporarySessionId: number | null = null;
  let temporaryDomainKey: string | null = null;
  let sourceOrganizationId: number | null = null;

  try {
    // ------------------------------------------------------------
    // 1. Identify the existing source organization
    // ------------------------------------------------------------
    const sourceOrgResult = await pool.query(`
      SELECT id, name
      FROM organizations
      WHERE status = 'ACTIVE'
      ORDER BY id
      LIMIT 1
    `);

    if (sourceOrgResult.rows.length === 0) {
      throw new Error("No active source organization exists.");
    }

    sourceOrganizationId = Number(sourceOrgResult.rows[0].id);

    console.log(
      `Source organization: ${sourceOrganizationId} (${sourceOrgResult.rows[0].name})`
    );

    // ------------------------------------------------------------
    // 2. Use existing active user 2 identified by M22 verification
    // ------------------------------------------------------------
    const userResult = await pool.query(`
      SELECT id, email
      FROM users
      WHERE id = 2
        AND is_active = TRUE
    `);

    if (userResult.rows.length === 0) {
      throw new Error("Expected active M22 test user 2 was not found.");
    }

    const testUserId = Number(userResult.rows[0].id);

    console.log(
      `Temporary cross-organization test user: ${testUserId} (${userResult.rows[0].email})`
    );

    // ------------------------------------------------------------
    // 3. Create temporary second organization
    // ------------------------------------------------------------
    const uniqueSuffix =
      `${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    const temporarySlug =
      `m22-isolation-${uniqueSuffix}`;

    const organizationResult = await pool.query(
      `
        INSERT INTO organizations (
          name,
          slug,
          status
        )
        VALUES (
          $1,
          $2,
          'ACTIVE'
        )
        RETURNING id
      `,
      [
        `M22 Temporary Isolation Organization ${uniqueSuffix}`,
        temporarySlug,
      ]
    );

    temporaryOrganizationId =
      Number(organizationResult.rows[0].id);

    console.log(
      `Temporary organization created: ${temporaryOrganizationId}`
    );

    // ------------------------------------------------------------
    // 4. Temporarily make user 2 an OWNER of Organization 2
    // ------------------------------------------------------------
    const membershipResult = await pool.query(
      `
        INSERT INTO organization_memberships (
          organization_id,
          user_id,
          role,
          is_active
        )
        VALUES (
          $1,
          $2,
          'OWNER',
          TRUE
        )
        RETURNING id
      `,
      [
        temporaryOrganizationId,
        testUserId,
      ]
    );

    temporaryMembershipId =
      Number(membershipResult.rows[0].id);

    console.log(
      `Temporary Organization 2 OWNER membership created: ${temporaryMembershipId}`
    );

    // ------------------------------------------------------------
    // 5. Create custom domain belonging to Organization 1
    // ------------------------------------------------------------
    temporaryDomainKey =
      `m22_cross_org_${uniqueSuffix}`;

    const domainResult = await pool.query(
      `
        INSERT INTO domain_registry (
          domain_key,
          display_name,
          description,
          domain_family,
          aliases,
          organization_id,
          is_active
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          '[]'::jsonb,
          $5,
          TRUE
        )
        RETURNING id, organization_id
      `,
      [
        temporaryDomainKey,
        "M22 Cross Organization Test Domain",
        "Temporary M22 cross-organization isolation test domain.",
        "General / Administrative",
        sourceOrganizationId,
      ]
    );

    console.log(
      `Temporary Organization 1 domain created: ${domainResult.rows[0].id}`
    );

    if (
      Number(domainResult.rows[0].organization_id) !==
      sourceOrganizationId
    ) {
      throw new Error(
        "Temporary domain was not assigned to the source organization."
      );
    }

    console.log(
      "PASS: Test domain belongs to Organization 1."
    );

    // ------------------------------------------------------------
    // 6. Create temporary session for user 2
    // ------------------------------------------------------------
    const rawToken =
      crypto.randomBytes(32).toString("hex");

    const tokenHash =
      crypto
        .createHash("sha256")
        .update(rawToken)
        .digest("hex");

    const sessionResult = await pool.query(
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

    temporarySessionId =
      Number(sessionResult.rows[0].id);

    console.log(
      `Temporary Organization 2 session created: ${temporarySessionId}`
    );

    const headers = {
      Cookie: `session=${rawToken}`,
    };

    // ------------------------------------------------------------
    // 7. Verify authenticated registry access
    // ------------------------------------------------------------
    const registryResponse = await fetch(
      `${API_URL}/api/domain-registry`,
      {
        method: "GET",
        headers,
      }
    );

    console.log(
      `Organization 2 registry GET HTTP STATUS: ${registryResponse.status}`
    );

    if (registryResponse.status !== 200) {
      const body = await registryResponse.text();

      throw new Error(
        `Expected Organization 2 registry read to return 200, received ${registryResponse.status}. Response: ${body}`
      );
    }

    const registryBody =
      await registryResponse.json();

    const domains =
      Array.isArray(registryBody.domain_registry)
        ? registryBody.domain_registry
        : [];

    const leakedDomain =
      domains.find(
        (domain: { domain_key?: string }) =>
          domain.domain_key === temporaryDomainKey
      );

    if (leakedDomain) {
      throw new Error(
        "Organization 1's custom domain leaked into Organization 2's registry."
      );
    }

    console.log(
      "PASS: Organization 1's custom domain is absent from Organization 2's registry."
    );

    // ------------------------------------------------------------
    // 8. Organization 2 attempts direct retrieval
    // ------------------------------------------------------------
    const getResponse = await fetch(
      `${API_URL}/api/domain-registry/${temporaryDomainKey}`,
      {
        method: "GET",
        headers,
      }
    );

    console.log(
      `Cross-organization GET HTTP STATUS: ${getResponse.status}`
    );

    if (getResponse.status !== 404) {
      const body = await getResponse.text();

      throw new Error(
        `Expected Organization 2 to receive 404 for Organization 1 domain, received ${getResponse.status}. Response: ${body}`
      );
    }

    console.log(
      "PASS: Organization 2 cannot retrieve Organization 1's custom domain."
    );

    console.log(
      "\nM22 CROSS-ORGANIZATION ISOLATION TEST PASSED."
    );
  } finally {
    // ------------------------------------------------------------
    // Cleanup — reverse dependency order
    // ------------------------------------------------------------
    if (temporarySessionId !== null) {
      await pool.query(
        `DELETE FROM sessions WHERE id = $1`,
        [temporarySessionId]
      );

      console.log(
        `Cleanup: removed temporary session ${temporarySessionId}.`
      );
    }

    if (
      temporaryDomainKey !== null &&
      sourceOrganizationId !== null
    ) {
      await pool.query(
        `
          DELETE FROM domain_registry
          WHERE
            domain_key = $1
            AND organization_id = $2
        `,
        [
          temporaryDomainKey,
          sourceOrganizationId,
        ]
      );

      console.log(
        `Cleanup: removed temporary domain ${temporaryDomainKey}.`
      );
    }

    if (temporaryMembershipId !== null) {
      await pool.query(
        `
          DELETE FROM organization_memberships
          WHERE id = $1
        `,
        [temporaryMembershipId]
      );

      console.log(
        `Cleanup: removed temporary membership ${temporaryMembershipId}.`
      );
    }

    if (temporaryOrganizationId !== null) {
      await pool.query(
        `
          DELETE FROM organizations
          WHERE id = $1
        `,
        [temporaryOrganizationId]
      );

      console.log(
        `Cleanup: removed temporary organization ${temporaryOrganizationId}.`
      );
    }

    await pool.end();
  }
}

main().catch(async (error) => {
  console.error(
    "\nM22 CROSS-ORGANIZATION ISOLATION TEST FAILED."
  );
  console.error(error);

  try {
    await pool.end();
  } catch {
    // Pool may already be closed.
  }
});
