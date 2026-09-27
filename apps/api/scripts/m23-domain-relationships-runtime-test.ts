import "dotenv/config";
import crypto from "crypto";
import { Pool } from "pg";

const API_URL = process.env.API_URL || "http://localhost:4000";

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

async function createTemporarySession(userId: number) {
  const rawToken = crypto.randomBytes(32).toString("hex");

  const tokenHash = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  const result = await pool.query<{ id: number }>(
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
    [userId, tokenHash]
  );

  return {
    id: Number(result.rows[0]!.id),
    token: rawToken,
    headers: {
      Cookie: `session=${rawToken}`,
    },
  };
}

async function main() {
  let adminSessionId: number | null = null;
  let viewerSessionId: number | null = null;
  let temporaryTargetOrganizationId: number | null = null;
  let temporaryTargetUserId: number | null = null;
  let temporaryTargetMembershipId: number | null = null;
  let temporaryTargetSessionId: number | null = null;

  let createdRelationshipId: number | null = null;

  try {
    console.log("\n==============================================");
    console.log("M23 DOMAIN RELATIONSHIP RUNTIME TEST");
    console.log("==============================================");
    console.log(`API: ${API_URL}`);

    // ------------------------------------------------------------
    // 1. Locate an active ADMIN/OWNER context.
    // ------------------------------------------------------------
    const adminResult = await pool.query<{
      user_id: number;
      organization_id: number;
      role: string;
    }>(
      `
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
          AND om.role IN ('OWNER', 'ADMIN', 'APPRAISER')
          AND o.status = 'ACTIVE'
        ORDER BY
          CASE om.role
            WHEN 'OWNER' THEN 1
            WHEN 'ADMIN' THEN 2
            WHEN 'APPRAISER' THEN 3
          END,
          om.user_id
        LIMIT 1
      `
    );

    assertCondition(
      adminResult.rows.length === 1,
      "No active OWNER/ADMIN/APPRAISER membership is available."
    );

    const adminUserId = Number(adminResult.rows[0]!.user_id);
    const organizationId = Number(
      adminResult.rows[0]!.organization_id
    );

    console.log(
      `Mutation context: user=${adminUserId}, organization=${organizationId}, role=${adminResult.rows[0]!.role}`
    );

    // ------------------------------------------------------------
    // 2. Locate an existing metadata record in that organization.
    // ------------------------------------------------------------
    const metadataResult = await pool.query<{
      id: number;
      reference_code: string;
    }>(
      `
        SELECT
          id,
          reference_code
        FROM metadata_records
        WHERE organization_id = $1
        ORDER BY id
        LIMIT 1
      `,
      [organizationId]
    );

    assertCondition(
      metadataResult.rows.length === 1,
      "No metadata record exists in the authenticated organization."
    );

    const metadataRecordId = Number(metadataResult.rows[0]!.id);

    console.log(
      `Test metadata record: ${metadataRecordId} (${metadataResult.rows[0]!.reference_code})`
    );

    // ------------------------------------------------------------
    // 3. Locate a global active domain.
    // ------------------------------------------------------------
    const domainResult = await pool.query<{
      id: number;
      domain_key: string;
      organization_id: number | null;
    }>(
      `
        SELECT
          id,
          domain_key,
          organization_id
        FROM domain_registry
        WHERE
          organization_id IS NULL
          AND is_active = TRUE
        ORDER BY id
        LIMIT 1
      `
    );

    assertCondition(
      domainResult.rows.length === 1,
      "No active global domain exists."
    );

    const domainId = Number(domainResult.rows[0]!.id);
    const domainKey = domainResult.rows[0]!.domain_key;

    console.log(
      `Test global domain: ${domainId} (${domainKey})`
    );

    // ------------------------------------------------------------
    // 4. Create temporary authenticated mutation session.
    // ------------------------------------------------------------
    const adminSession =
      await createTemporarySession(adminUserId);

    adminSessionId = adminSession.id;

    console.log(
      `Temporary mutation session created: ${adminSessionId}`
    );

    // ------------------------------------------------------------
    // 5. Verify relationship-types endpoint.
    // ------------------------------------------------------------
    const typesResponse = await fetch(
      `${API_URL}/api/domain-relationships/relationship-types/list`,
      {
        method: "GET",
        headers: adminSession.headers,
      }
    );

    const typesBody = await typesResponse.json();

    console.log(
      `Relationship types HTTP STATUS: ${typesResponse.status}`
    );

    assertCondition(
      typesResponse.status === 200,
      `Expected relationship types HTTP 200, received ${typesResponse.status}.`
    );

    assertCondition(
      Array.isArray(typesBody?.relationship_types),
      "Relationship types response did not contain relationship_types."
    );

    assertCondition(
      typesBody.relationship_types.includes("SUBJECT"),
      "Relationship types did not contain SUBJECT."
    );

    assertCondition(
      typesBody.relationship_types.includes("REGULATORY_CONTEXT"),
      "Relationship types did not contain REGULATORY_CONTEXT."
    );

    console.log(
      "PASS: Relationship type catalogue is available."
    );

    // ------------------------------------------------------------
    // 6. Verify initial metadata relationship listing.
    // ------------------------------------------------------------
    const initialMetadataResponse = await fetch(
      `${API_URL}/api/domain-relationships/metadata/${metadataRecordId}`,
      {
        method: "GET",
        headers: adminSession.headers,
      }
    );

    const initialMetadataBody =
      await initialMetadataResponse.json();

    console.log(
      `Initial metadata relationships HTTP STATUS: ${initialMetadataResponse.status}`
    );

    assertCondition(
      initialMetadataResponse.status === 200,
      `Expected metadata relationship GET HTTP 200, received ${initialMetadataResponse.status}: ${JSON.stringify(initialMetadataBody)}`
    );

    assertCondition(
      initialMetadataBody?.success === true,
      "Metadata relationship response success was not true."
    );

    assertCondition(
      Array.isArray(initialMetadataBody?.relationships),
      "Metadata relationship response did not contain relationships."
    );

    console.log(
      `PASS: Metadata relationship listing works. Existing relationships: ${initialMetadataBody.relationships.length}`
    );

    // ------------------------------------------------------------
    // 7. Create a temporary relationship.
    // ------------------------------------------------------------
    const createResponse = await fetch(
      `${API_URL}/api/domain-relationships`,
      {
        method: "POST",
        headers: {
          ...adminSession.headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          metadata_record_id: metadataRecordId,
          domain_id: domainId,
          relationship_type: "SUBJECT",
        }),
      }
    );

    const createBody = await createResponse.json();

    console.log(
      `Create relationship HTTP STATUS: ${createResponse.status}`
    );

    assertCondition(
      createResponse.status === 201,
      `Expected relationship creation HTTP 201, received ${createResponse.status}: ${JSON.stringify(createBody)}`
    );

    assertCondition(
      createBody?.success === true,
      "Relationship creation success was not true."
    );

    assertCondition(
      createBody?.relationship,
      "Create response did not contain relationship."
    );

    createdRelationshipId = Number(
      createBody.relationship.id
    );

    assertCondition(
      Number.isInteger(createdRelationshipId) &&
        createdRelationshipId > 0,
      "Created relationship did not return a valid ID."
    );

    console.log(
      `Created relationship ID: ${createdRelationshipId}`
    );

    console.log(
      "PASS: Authorized user can create a domain relationship."
    );

    // ------------------------------------------------------------
    // 8. Verify duplicate prevention.
    // ------------------------------------------------------------
    const duplicateResponse = await fetch(
      `${API_URL}/api/domain-relationships`,
      {
        method: "POST",
        headers: {
          ...adminSession.headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          metadata_record_id: metadataRecordId,
          domain_id: domainId,
          relationship_type: "SUBJECT",
        }),
      }
    );

    const duplicateBody =
      await duplicateResponse.json();

    console.log(
      `Duplicate relationship HTTP STATUS: ${duplicateResponse.status}`
    );

    assertCondition(
      duplicateResponse.status === 409,
      `Expected duplicate relationship HTTP 409, received ${duplicateResponse.status}: ${JSON.stringify(duplicateBody)}`
    );

    console.log(
      "PASS: Duplicate metadata/domain/type relationship is rejected."
    );

    // ------------------------------------------------------------
    // 9. Verify metadata relationship listing contains new row.
    // ------------------------------------------------------------
    const metadataResponse = await fetch(
      `${API_URL}/api/domain-relationships/metadata/${metadataRecordId}`,
      {
        method: "GET",
        headers: adminSession.headers,
      }
    );

    const metadataBody =
      await metadataResponse.json();

    assertCondition(
      metadataResponse.status === 200,
      `Expected metadata relationship GET HTTP 200 after creation, received ${metadataResponse.status}.`
    );

    const createdInMetadata =
      metadataBody.relationships.find(
        (relationship: {
          id?: number;
        }) =>
          Number(relationship.id) ===
          createdRelationshipId
      );

    assertCondition(
      createdInMetadata !== undefined,
      "Created relationship was not returned by metadata relationship listing."
    );

    console.log(
      "PASS: Created relationship appears under the metadata record."
    );

    // ------------------------------------------------------------
    // 10. Verify domain-affiliated metadata/documents endpoint.
    // ------------------------------------------------------------
    const domainResponse = await fetch(
      `${API_URL}/api/domain-relationships/domain/${encodeURIComponent(domainKey)}`,
      {
        method: "GET",
        headers: adminSession.headers,
      }
    );

    const domainBody =
      await domainResponse.json();

    console.log(
      `Domain affiliation HTTP STATUS: ${domainResponse.status}`
    );

    assertCondition(
      domainResponse.status === 200,
      `Expected domain affiliation HTTP 200, received ${domainResponse.status}: ${JSON.stringify(domainBody)}`
    );

    assertCondition(
      domainBody?.success === true,
      "Domain affiliation response success was not true."
    );

    assertCondition(
      Array.isArray(domainBody?.metadata),
      "Domain affiliation response did not contain metadata."
    );

    const createdInDomain =
      domainBody.metadata.find(
        (record: {
          metadata_record_id?: number;
        }) =>
          Number(record.metadata_record_id) ===
          metadataRecordId
      );

    assertCondition(
      createdInDomain !== undefined,
      "Created relationship was not returned by the domain affiliation endpoint."
    );

    assertCondition(
      Array.isArray(createdInDomain.linked_documents),
      "Domain affiliation result did not contain linked_documents."
    );

    console.log(
      "PASS: Domain catalogue can return affiliated metadata and linked documents."
    );

    // ------------------------------------------------------------
    // 11. Update relationship type.
    // ------------------------------------------------------------
    const updateResponse = await fetch(
      `${API_URL}/api/domain-relationships/${createdRelationshipId}`,
      {
        method: "PATCH",
        headers: {
          ...adminSession.headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          relationship_type: "BUSINESS_FUNCTION",
        }),
      }
    );

    const updateBody =
      await updateResponse.json();

    console.log(
      `Update relationship HTTP STATUS: ${updateResponse.status}`
    );

    assertCondition(
      updateResponse.status === 200,
      `Expected relationship update HTTP 200, received ${updateResponse.status}: ${JSON.stringify(updateBody)}`
    );

    assertCondition(
      updateBody?.relationship?.relationship_type ===
        "BUSINESS_FUNCTION",
      "Relationship type was not updated to BUSINESS_FUNCTION."
    );

    console.log(
      "PASS: Authorized user can update relationship type."
    );

    // ------------------------------------------------------------
    // 12. Locate a VIEWER.
    // ------------------------------------------------------------
    const viewerResult = await pool.query<{
      user_id: number;
      organization_id: number;
      role: string;
    }>(
      `
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
          AND om.role = 'VIEWER'
          AND om.organization_id = $1
          AND o.status = 'ACTIVE'
        ORDER BY om.user_id
        LIMIT 1
      `,
      [organizationId]
    );

    assertCondition(
      viewerResult.rows.length === 1,
      "No active VIEWER exists in the test organization."
    );

    const viewerUserId =
      Number(viewerResult.rows[0]!.user_id);

    const viewerSession =
      await createTemporarySession(viewerUserId);

    viewerSessionId = viewerSession.id;

    console.log(
      `Temporary VIEWER session created: ${viewerSessionId}`
    );

    // ------------------------------------------------------------
    // 13. VIEWER cannot create relationships.
    // ------------------------------------------------------------
    const viewerCreateResponse = await fetch(
      `${API_URL}/api/domain-relationships`,
      {
        method: "POST",
        headers: {
          ...viewerSession.headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          metadata_record_id: metadataRecordId,
          domain_id: domainId,
          relationship_type: "PURPOSE",
        }),
      }
    );

    console.log(
      `VIEWER create HTTP STATUS: ${viewerCreateResponse.status}`
    );

    assertCondition(
      viewerCreateResponse.status === 403,
      `Expected VIEWER create HTTP 403, received ${viewerCreateResponse.status}.`
    );

    console.log(
      "PASS: VIEWER cannot create domain relationships."
    );

    // ------------------------------------------------------------
    // 14. Create temporary second organization.
    // ------------------------------------------------------------
    const uniqueSuffix =
      `${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    const targetOrgResult =
      await pool.query<{ id: number }>(
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
          `M23 Temporary Isolation Organization ${uniqueSuffix}`,
          `m23-isolation-${uniqueSuffix}`,
        ]
      );

    temporaryTargetOrganizationId =
      Number(targetOrgResult.rows[0]!.id);

    console.log(
      `Temporary second organization created: ${temporaryTargetOrganizationId}`
    );

    // ------------------------------------------------------------
    // 15. Create a temporary user exclusively for the
    // second organization.
    //
    // This is intentional. The production authentication model
    // selects an organization from the authenticated user's active
    // memberships. Therefore the isolation test must use a user
    // who belongs only to the temporary organization.
    // ------------------------------------------------------------
    const temporaryUserEmail =
      `m23-isolation-${uniqueSuffix}@example.invalid`;

    const temporaryUserResult =
      await pool.query<{ id: number }>(
        `
          INSERT INTO users (
            email,
            password_hash,
            full_name,
            role,
            is_active
          )
          VALUES (
            $1,
            $2,
            $3,
            'VIEWER',
            TRUE
          )
          RETURNING id
        `,
        [
          temporaryUserEmail,
          'M23_TEST_ONLY_PASSWORD_HASH',
          'M23 Temporary Isolation User',
        ]
      );

    temporaryTargetUserId =
      Number(temporaryUserResult.rows[0]!.id);

    console.log(
      `Temporary second-organization user created: ${temporaryTargetUserId}`
    );

    // ------------------------------------------------------------
    // 16. Give temporary user OWNER membership in the
    // second organization.
    // ------------------------------------------------------------
    const membershipResult =
      await pool.query<{ id: number }>(
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
          temporaryTargetOrganizationId,
          temporaryTargetUserId,
        ]
      );

    temporaryTargetMembershipId =
      Number(membershipResult.rows[0]!.id);

    console.log(
      `Temporary second-organization OWNER membership created: ${temporaryTargetMembershipId}`
    );

    // ------------------------------------------------------------
    // 17. Create second-organization session.
    // ------------------------------------------------------------
    const targetSession =
      await createTemporarySession(temporaryTargetUserId);

    temporaryTargetSessionId =
      targetSession.id;

    console.log(
      `Temporary second-organization session created: ${temporaryTargetSessionId}`
    );

    // ------------------------------------------------------------
    // 18. Cross-organization metadata access must fail.
    // ------------------------------------------------------------
    const crossMetadataResponse = await fetch(
      `${API_URL}/api/domain-relationships/metadata/${metadataRecordId}`,
      {
        method: "GET",
        headers: targetSession.headers,
      }
    );

    console.log(
      `Cross-organization metadata GET HTTP STATUS: ${crossMetadataResponse.status}`
    );

    assertCondition(
      crossMetadataResponse.status === 404,
      `Expected cross-organization metadata GET HTTP 404, received ${crossMetadataResponse.status}.`
    );

    console.log(
      "PASS: Metadata relationships are isolated between organizations."
    );

    // ------------------------------------------------------------
    // 19. Cross-organization relationship creation must fail.
    // ------------------------------------------------------------
    const crossCreateResponse = await fetch(
      `${API_URL}/api/domain-relationships`,
      {
        method: "POST",
        headers: {
          ...targetSession.headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          metadata_record_id: metadataRecordId,
          domain_id: domainId,
          relationship_type: "PURPOSE",
        }),
      }
    );

    console.log(
      `Cross-organization create HTTP STATUS: ${crossCreateResponse.status}`
    );

    assertCondition(
      crossCreateResponse.status === 404,
      `Expected cross-organization relationship creation HTTP 404, received ${crossCreateResponse.status}.`
    );

    console.log(
      "PASS: Cross-organization relationship creation is rejected."
    );

    // ------------------------------------------------------------
    // 20. Verify temporary relationship exists in DB with correct org.
    // ------------------------------------------------------------
    const dbRelationship =
      await pool.query<{
        id: number;
        metadata_record_id: number;
        domain_id: number;
        organization_id: number;
        relationship_type: string;
      }>(
        `
          SELECT
            id,
            metadata_record_id,
            domain_id,
            organization_id,
            relationship_type
          FROM metadata_domain_relationships
          WHERE id = $1
        `,
        [createdRelationshipId]
      );

    assertCondition(
      dbRelationship.rows.length === 1,
      "Created relationship was not found in the database."
    );

    assertCondition(
      Number(dbRelationship.rows[0]!.metadata_record_id) ===
        metadataRecordId,
      "Database metadata_record_id is incorrect."
    );

    assertCondition(
      Number(dbRelationship.rows[0]!.domain_id) === domainId,
      "Database domain_id is incorrect."
    );

    assertCondition(
      Number(dbRelationship.rows[0]!.organization_id) ===
        organizationId,
      "Database organization_id is incorrect."
    );

    assertCondition(
      dbRelationship.rows[0]!.relationship_type ===
        "BUSINESS_FUNCTION",
      "Database relationship_type was not updated correctly."
    );

    console.log(
      "PASS: Database relationship ownership and updated type are correct."
    );

    // ------------------------------------------------------------
    // 20. Delete relationship.
    // ------------------------------------------------------------
    const deleteResponse = await fetch(
      `${API_URL}/api/domain-relationships/${createdRelationshipId}`,
      {
        method: "DELETE",
        headers: adminSession.headers,
      }
    );

    const deleteBody =
      await deleteResponse.json();

    console.log(
      `Delete relationship HTTP STATUS: ${deleteResponse.status}`
    );

    assertCondition(
      deleteResponse.status === 200,
      `Expected relationship deletion HTTP 200, received ${deleteResponse.status}: ${JSON.stringify(deleteBody)}`
    );

    console.log(
      "PASS: Authorized user can delete a domain relationship."
    );

    createdRelationshipId = null;

    // ------------------------------------------------------------
    // 21. Verify deletion in database.
    // ------------------------------------------------------------
    const deletedCheck =
      await pool.query(
        `
          SELECT id
          FROM metadata_domain_relationships
          WHERE
            metadata_record_id = $1
            AND domain_id = $2
            AND organization_id = $3
            AND relationship_type = 'BUSINESS_FUNCTION'
        `,
        [
          metadataRecordId,
          domainId,
          organizationId,
        ]
      );

    assertCondition(
      deletedCheck.rows.length === 0,
      "Deleted relationship still exists in the database."
    );

    console.log(
      "PASS: Deleted relationship no longer exists."
    );

    console.log(
      "\n=============================================="
    );
    console.log(
      "M23 DOMAIN RELATIONSHIP RUNTIME TEST PASSED"
    );
    console.log(
      "==============================================\n"
    );
  } finally {
    // ------------------------------------------------------------
    // Cleanup relationship if an unexpected failure happened.
    // ------------------------------------------------------------
    if (createdRelationshipId !== null) {
      await pool.query(
        `
          DELETE FROM metadata_domain_relationships
          WHERE id = $1
        `,
        [createdRelationshipId]
      );

      console.log(
        `Cleanup: removed temporary relationship ${createdRelationshipId}.`
      );
    }

    // Cleanup sessions.
    if (adminSessionId !== null) {
      await pool.query(
        `DELETE FROM sessions WHERE id = $1`,
        [adminSessionId]
      );

      console.log(
        `Cleanup: removed admin test session ${adminSessionId}.`
      );
    }

    if (viewerSessionId !== null) {
      await pool.query(
        `DELETE FROM sessions WHERE id = $1`,
        [viewerSessionId]
      );

      console.log(
        `Cleanup: removed viewer test session ${viewerSessionId}.`
      );
    }

    if (temporaryTargetSessionId !== null) {
      await pool.query(
        `DELETE FROM sessions WHERE id = $1`,
        [temporaryTargetSessionId]
      );

      console.log(
        `Cleanup: removed second-organization test session ${temporaryTargetSessionId}.`
      );
    }

    // Cleanup temporary membership before organization.
    if (temporaryTargetMembershipId !== null) {
      await pool.query(
        `
          DELETE FROM organization_memberships
          WHERE id = $1
        `,
        [temporaryTargetMembershipId]
      );

      console.log(
        `Cleanup: removed temporary organization membership ${temporaryTargetMembershipId}.`
      );
    }

    if (temporaryTargetUserId !== null) {
      await pool.query(
        `
          DELETE FROM users
          WHERE id = $1
        `,
        [temporaryTargetUserId]
      );

      console.log(
        `Cleanup: removed temporary isolation user ${temporaryTargetUserId}.`
      );
    }

    if (temporaryTargetOrganizationId !== null) {
      await pool.query(
        `
          DELETE FROM organizations
          WHERE id = $1
        `,
        [temporaryTargetOrganizationId]
      );

      console.log(
        `Cleanup: removed temporary organization ${temporaryTargetOrganizationId}.`
      );
    }

    await pool.end();
  }
}

main().catch((error) => {
  console.error("\nM23 DOMAIN RELATIONSHIP RUNTIME TEST FAILED.");
  console.error(error);
  process.exitCode = 1;
});




