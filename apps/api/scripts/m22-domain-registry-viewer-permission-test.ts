import "dotenv/config";
import crypto from "crypto";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const API_URL = process.env.API_URL || "http://localhost:4000";

async function main() {
  console.log("\n==============================================");
  console.log("M22 DOMAIN REGISTRY VIEWER PERMISSION TEST");
  console.log("==============================================");

  const userResult = await pool.query(`
    SELECT
      om.user_id,
      om.organization_id,
      om.role,
      u.email
    FROM organization_memberships om
    INNER JOIN users u
      ON u.id = om.user_id
    INNER JOIN organizations o
      ON o.id = om.organization_id
    WHERE
      om.is_active = TRUE
      AND u.is_active = TRUE
      AND om.role = 'VIEWER'
      AND o.status = 'ACTIVE'
    ORDER BY om.user_id
    LIMIT 1
  `);

  if (userResult.rows.length === 0) {
    console.log("No active VIEWER membership found.");
    await pool.end();
    return;
  }

  const viewer = userResult.rows[0];

  console.log(
    `Authenticated context: user=${viewer.user_id}, organization=${viewer.organization_id}, role=${viewer.role}`
  );

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto
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
    [viewer.user_id, tokenHash]
  );

  const sessionId = sessionResult.rows[0].id;

  console.log(`Temporary authenticated session created: ${sessionId}`);

  const headers = {
    Cookie: `session=${rawToken}`,
  };

  try {
    // ------------------------------------------------------------
    // 1. Viewer can READ the registry
    // ------------------------------------------------------------
    const readResponse = await fetch(
      `${API_URL}/api/domain-registry`,
      {
        method: "GET",
        headers,
      }
    );

    console.log(`Registry GET HTTP STATUS: ${readResponse.status}`);

    if (readResponse.status !== 200) {
      throw new Error(
        `Expected VIEWER registry read to return 200, received ${readResponse.status}.`
      );
    }

    const readBody = await readResponse.json();

    if (
      !readBody.success ||
      !Array.isArray(readBody.domain_registry)
    ) {
      throw new Error(
        "VIEWER registry response did not contain the expected domain_registry array."
      );
    }

    console.log("PASS: VIEWER can read the Domain Registry.");

    // ------------------------------------------------------------
    // 2. Viewer cannot CREATE an organization domain
    // ------------------------------------------------------------
    const testDomainKey = `m22_viewer_forbidden_${Date.now()}`;

    const createResponse = await fetch(
      `${API_URL}/api/domain-registry`,
      {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          domain_key: testDomainKey,
          display_name: "M22 Viewer Forbidden Test Domain",
          description: "Temporary authorization test.",
          domain_family: "General / Administrative",
        }),
      }
    );

    console.log(`Create HTTP STATUS: ${createResponse.status}`);

    if (createResponse.status !== 403) {
      const body = await createResponse.text();

      throw new Error(
        `Expected VIEWER domain creation to return 403, received ${createResponse.status}. Response: ${body}`
      );
    }

    console.log(
      "PASS: VIEWER cannot create an organization-specific domain."
    );

    // ------------------------------------------------------------
    // 3. Confirm the forbidden request did not create anything
    // ------------------------------------------------------------
    const createdCheck = await pool.query(
      `
        SELECT id
        FROM domain_registry
        WHERE
          organization_id = $1
          AND domain_key = $2
      `,
      [viewer.organization_id, testDomainKey]
    );

    if (createdCheck.rows.length !== 0) {
      throw new Error(
        "Forbidden VIEWER request unexpectedly created a domain."
      );
    }

    console.log(
      "PASS: No domain was created by the forbidden VIEWER request."
    );

    console.log("\nM22 VIEWER PERMISSION TEST PASSED.");
  } finally {
    await pool.query(
      `DELETE FROM sessions WHERE id = $1`,
      [sessionId]
    );

    console.log(
      `Cleanup: removed temporary authenticated session ${sessionId}.`
    );

    await pool.end();
  }
}

main().catch(async (error) => {
  console.error("\nM22 VIEWER PERMISSION TEST FAILED.");
  console.error(error);

  try {
    await pool.end();
  } catch {
    // Pool may already be closed.
  }
});
