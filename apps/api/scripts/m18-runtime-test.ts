import "dotenv/config";

import { createHash, randomBytes } from "crypto";
import { Pool } from "pg";

const API_URL =
  process.env.M18_TEST_API_URL ||
  "http://localhost:4000";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

type QueryResultRow = Record<string, unknown>;

function assertCondition(
  condition: unknown,
  message: string
): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

async function apiRequest(
  path: string,
  body: Record<string, unknown>,
  sessionToken: string
) {
  const response = await fetch(
    `${API_URL}${path}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session=${sessionToken}`,
      },
      body: JSON.stringify(body),
    }
  );

  const text = await response.text();

  let parsed: unknown = null;

  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }

  return {
    status: response.status,
    body: parsed,
  };
}

async function main() {
  let testUserId: number | null = null;
  let testOrganizationId: number | null = null;
  let sessionId: number | null = null;

  const metadataIds: number[] = [];
  const documentIds: number[] = [];

  const testSuffix = Date.now().toString();

  try {
    console.log("\nM18 RUNTIME TEST STARTING...");
    console.log(`API: ${API_URL}`);

    // ------------------------------------------------------------
    // 1. Locate an existing ADMIN/OWNER account and organization.
    // ------------------------------------------------------------

    const adminResult = await pool.query<{
      user_id: number;
      organization_id: number;
    }>(`
      SELECT
        om.user_id,
        om.organization_id
      FROM organization_memberships om
      INNER JOIN users u
        ON u.id = om.user_id
      INNER JOIN organizations o
        ON o.id = om.organization_id
      WHERE
        om.is_active = TRUE
        AND u.is_active = TRUE
        AND (
          om.role IN ('OWNER', 'ADMIN')
          OR u.role = 'ADMIN'
        )
        AND o.status = 'ACTIVE'
      ORDER BY
        CASE om.role
          WHEN 'OWNER' THEN 1
          WHEN 'ADMIN' THEN 2
          ELSE 3
        END,
        om.user_id
      LIMIT 1
    `);

    assertCondition(
      adminResult.rows.length === 1,
      "No active ADMIN/OWNER organization membership is available for the M18 test."
    );

    testUserId = adminResult.rows[0]!.user_id;
    testOrganizationId =
      adminResult.rows[0]!.organization_id;

    console.log(
      `Authenticated test context: user=${testUserId}, organization=${testOrganizationId}`
    );

    // ------------------------------------------------------------
    // 2. Create a temporary authenticated session.
    // ------------------------------------------------------------

    const rawSessionToken = randomBytes(32).toString("hex");

    const tokenHash = createHash("sha256")
      .update(rawSessionToken)
      .digest("hex");

    const sessionResult = await pool.query<{
      id: number;
    }>(
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

    // ------------------------------------------------------------
    // 3. Locate organization-owned department/type.
    // ------------------------------------------------------------

    const departmentResult =
      await pool.query<{ id: number }>(
        `
          SELECT id
          FROM departments
          WHERE organization_id = $1
          ORDER BY id
          LIMIT 1
        `,
        [testOrganizationId]
      );

    const documentTypeResult =
      await pool.query<{ id: number }>(
        `
          SELECT id
          FROM document_types
          WHERE organization_id = $1
          ORDER BY id
          LIMIT 1
        `,
        [testOrganizationId]
      );

    assertCondition(
      departmentResult.rows.length === 1,
      "No organization-owned department is available."
    );

    assertCondition(
      documentTypeResult.rows.length === 1,
      "No organization-owned document type is available."
    );

    const departmentId =
      departmentResult.rows[0]!.id;

    const documentTypeId =
      documentTypeResult.rows[0]!.id;

    console.log(
      `Using department=${departmentId}, documentType=${documentTypeId}`
    );

    // ------------------------------------------------------------
    // 4. Helper for temporary documents.
    // ------------------------------------------------------------

    async function createDocument(
      suffix: string
    ): Promise<number> {
      const result = await pool.query<{ id: number }>(
        `
          INSERT INTO documents (
            document_code,
            filename,
            title,
            document_date,
            year,
            person_name,
            file_type,
            file_size,
            status,
            metadata_record_id,
            department_id,
            document_type_id,
            organization_id,
            owner_user_id,
            upload_number
          )
          VALUES (
            $1,
            $2,
            $3,
            DATE '2026-01-15',
            2026,
            $4,
            'PDF',
            1024,
            'UNLINKED',
            NULL,
            NULL,
            NULL,
            $5,
            $6,
            nextval('document_upload_number_seq')
          )
          RETURNING id
        `,
        [
          `M18-TEST-DOC-${testSuffix}-${suffix}`,
          `M18 Runtime Test ${suffix}.pdf`,
          `Original Test Document ${suffix}`,
          `M18 Test Person ${suffix}`,
          testOrganizationId,
          testUserId,
        ]
      );

      const documentId =
        result.rows[0]!.id;

      documentIds.push(documentId);

      await pool.query(
        `
          INSERT INTO document_extractions (
            document_id,
            extracted_text,
            extracted_title,
            extracted_date,
            extracted_year,
            extracted_person_name,
            extraction_status
          )
          VALUES (
            $1,
            $2,
            $3,
            DATE '2026-01-15',
            2026,
            $4,
            'COMPLETED'
          )
        `,
        [
          documentId,
          `M18 runtime test extracted text ${suffix}`,
          `Original Test Document ${suffix}`,
          `M18 Test Person ${suffix}`,
        ]
      );

      return documentId;
    }

    async function createMetadata(
      suffix: string
    ): Promise<number> {
      const result = await pool.query<{ id: number }>(
        `
          INSERT INTO metadata_records (
            reference_code,
            title,
            document_date,
            year,
            person_name,
            description,
            status,
            department_id,
            document_type_id,
            section,
            additional_metadata,
            organization_id
          )
          VALUES (
            $1,
            $2,
            DATE '2026-01-15',
            2026,
            $3,
            $4,
            'AWAITING_DOCUMENT',
            $5,
            $6,
            'Original Section',
            $7::jsonb,
            $8
          )
          RETURNING id
        `,
        [
          `M18-TEST-META-${testSuffix}-${suffix}`,
          `Original Metadata ${suffix}`,
          `Original Person ${suffix}`,
          `Original Description ${suffix}`,
          departmentId,
          documentTypeId,
          JSON.stringify({
            originalKey: "original-value",
          }),
          testOrganizationId,
        ]
      );

      const metadataId =
        result.rows[0]!.id;

      metadataIds.push(metadataId);

      return metadataId;
    }

    async function createMatch(
      documentId: number,
      metadataId: number,
      matchType = "PARTIAL_MATCH"
    ) {
      const result = await pool.query<{ id: number }>(
        `
          INSERT INTO document_matches (
            document_id,
            metadata_record_id,
            match_type,
            confidence,
            matching_fields,
            conflicting_fields,
            decision
          )
          VALUES (
            $1,
            $2,
            $3,
            85.00,
            'title,document_date',
            'person_name',
            'PENDING'
          )
          RETURNING id
        `,
        [
          documentId,
          metadataId,
          matchType,
        ]
      );

      return result.rows[0]!.id;
    }

    // ============================================================
    // TEST 1 — APPROVE EXISTING METADATA
    // ============================================================

    console.log(
      "\n[TEST 1] APPROVE edited existing metadata..."
    );

    const approveDocumentId =
      await createDocument("APPROVE");

    const approveMetadataId =
      await createMetadata("APPROVE");

    await createMatch(
      approveDocumentId,
      approveMetadataId,
      "STRONG_MATCH"
    );

    const approveResponse =
      await apiRequest(
        `/api/documents/${approveDocumentId}/review`,
        {
          decision: "APPROVE",
          metadataRecordId:
            approveMetadataId,
          metadata: {
            referenceCode:
              `M18-TEST-META-${testSuffix}-APPROVE`,
            title:
              "EDITED BY M18 RUNTIME TEST",
            personName:
              "Edited Test Person",
            departmentId:
              String(departmentId),
            documentTypeId:
              String(documentTypeId),
            year:
              "2027",
            documentDate:
              "2027-02-20",
            section:
              "Edited Section",
            description:
              "Edited description persisted by appraisal.",
            additionalMetadata: {
              editedKey:
                "edited-value",
              editedNumber:
                123,
              editedBoolean:
                true,
            },
          },
        },
        rawSessionToken
      );

    console.log(
      `APPROVE HTTP status: ${approveResponse.status}`
    );

    assertCondition(
      approveResponse.status >= 200 &&
        approveResponse.status < 300,
      `APPROVE endpoint failed: ${json(approveResponse.body)}`
    );

    const approveMetadata =
      await pool.query<QueryResultRow>(
        `
          SELECT
            id,
            reference_code,
            title,
            person_name,
            department_id,
            document_type_id,
            section,
            year,
            document_date,
            description,
            additional_metadata,
            status
          FROM metadata_records
          WHERE
            id = $1
            AND organization_id = $2
        `,
        [
          approveMetadataId,
          testOrganizationId,
        ]
      );

    assertCondition(
      approveMetadata.rows.length === 1,
      "Approved metadata record was not found."
    );

    const approvedMeta =
      approveMetadata.rows[0]!;

    assertCondition(
      approvedMeta.title ===
        "EDITED BY M18 RUNTIME TEST",
      "APPROVE did not persist edited title."
    );

    assertCondition(
      approvedMeta.person_name ===
        "Edited Test Person",
      "APPROVE did not persist edited person name."
    );

    assertCondition(
      approvedMeta.section ===
        "Edited Section",
      "APPROVE did not persist edited section."
    );

    assertCondition(
      approvedMeta.year === 2027,
      "APPROVE did not persist edited year."
    );

    const approvedDocumentDate =
      approvedMeta.document_date instanceof Date
        ? [
            approvedMeta.document_date.getFullYear(),
            String(approvedMeta.document_date.getMonth() + 1).padStart(2, "0"),
            String(approvedMeta.document_date.getDate()).padStart(2, "0"),
          ].join("-")
        : String(approvedMeta.document_date).slice(0, 10);

    assertCondition(
      approvedDocumentDate === "2027-02-20",
      `APPROVE did not persist edited document date. Actual value: ${String(
        approvedMeta.document_date
      )}`
    );

    assertCondition(
      approvedMeta.description ===
        "Edited description persisted by appraisal.",
      "APPROVE did not persist edited description."
    );

    const additional =
      approvedMeta.additional_metadata as Record<
        string,
        unknown
      >;

    assertCondition(
      additional.editedKey ===
        "edited-value",
      "APPROVE did not persist additional metadata."
    );

    assertCondition(
      additional.editedNumber === 123,
      "APPROVE did not persist numeric additional metadata."
    );

    assertCondition(
      additional.editedBoolean === true,
      "APPROVE did not persist boolean additional metadata."
    );

    assertCondition(
      approvedMeta.status ===
        "DOCUMENT_LINKED",
      `APPROVE produced incorrect metadata status: ${String(
        approvedMeta.status
      )}`
    );

    const approveDocument =
      await pool.query<QueryResultRow>(
        `
          SELECT
            id,
            metadata_record_id,
            department_id,
            document_type_id,
            status
          FROM documents
          WHERE
            id = $1
            AND organization_id = $2
        `,
        [
          approveDocumentId,
          testOrganizationId,
        ]
      );

    assertCondition(
      approveDocument.rows.length === 1,
      "Approved document was not found."
    );

    const approvedDoc =
      approveDocument.rows[0]!;

    assertCondition(
      approvedDoc.metadata_record_id ===
        approveMetadataId,
      "APPROVE did not link the document to the existing metadata."
    );

    assertCondition(
      approvedDoc.status === "LINKED",
      "APPROVE did not set document status to LINKED."
    );

    const approveMatch =
      await pool.query<{ decision: string }>(
        `
          SELECT decision
          FROM document_matches
          WHERE
            document_id = $1
            AND metadata_record_id = $2
          ORDER BY id DESC
          LIMIT 1
        `,
        [
          approveDocumentId,
          approveMetadataId,
        ]
      );

    assertCondition(
      approveMatch.rows[0]?.decision ===
        "LINKED",
      "APPROVE did not mark the selected match as LINKED."
    );

    const approveAudit =
      await pool.query<{ count: string }>(
        `
          SELECT COUNT(*)::text AS count
          FROM document_audit_logs
          WHERE
            document_id = $1
            AND metadata_record_id = $2
            AND action = 'APPRAISAL_APPROVED'
        `,
        [
          approveDocumentId,
          approveMetadataId,
        ]
      );

    assertCondition(
      Number(approveAudit.rows[0]?.count || 0) >= 1,
      "APPROVE did not create APPRAISAL_APPROVED audit event."
    );

    console.log(
      "PASS: APPROVE persisted edited metadata, linked the document, updated the match, and created audit."
    );

    // ============================================================
    // TEST 2 — REJECT
    // ============================================================

    console.log(
      "\n[TEST 2] REJECT match without creating metadata..."
    );

    const rejectDocumentId =
      await createDocument("REJECT");

    const rejectMetadataId =
      await createMetadata("REJECT");

    await createMatch(
      rejectDocumentId,
      rejectMetadataId,
      "PARTIAL_MATCH"
    );

    const rejectMetadataBefore =
      await pool.query<QueryResultRow>(
        `
          SELECT
            title,
            status,
            additional_metadata
          FROM metadata_records
          WHERE id = $1
        `,
        [rejectMetadataId]
      );

    const rejectResponse =
      await apiRequest(
        `/api/documents/${rejectDocumentId}/review`,
        {
          decision: "REJECT",
          metadataRecordId:
            rejectMetadataId,
        },
        rawSessionToken
      );

    console.log(
      `REJECT HTTP status: ${rejectResponse.status}`
    );

    assertCondition(
      rejectResponse.status >= 200 &&
        rejectResponse.status < 300,
      `REJECT endpoint failed: ${json(rejectResponse.body)}`
    );

    const rejectDocument =
      await pool.query<QueryResultRow>(
        `
          SELECT
            status,
            metadata_record_id
          FROM documents
          WHERE id = $1
        `,
        [rejectDocumentId]
      );

    assertCondition(
      rejectDocument.rows[0]?.status ===
        "UNLINKED",
      "REJECT did not leave document UNLINKED."
    );

    assertCondition(
      rejectDocument.rows[0]?.metadata_record_id ===
        null,
      "REJECT unexpectedly linked metadata."
    );

    const rejectMetadataAfter =
      await pool.query<QueryResultRow>(
        `
          SELECT
            title,
            status,
            additional_metadata
          FROM metadata_records
          WHERE id = $1
        `,
        [rejectMetadataId]
      );

    assertCondition(
      json(rejectMetadataBefore.rows[0]) ===
        json(rejectMetadataAfter.rows[0]),
      "REJECT unexpectedly modified the metadata record."
    );

    const rejectMatch =
      await pool.query<{ decision: string }>(
        `
          SELECT decision
          FROM document_matches
          WHERE
            document_id = $1
            AND metadata_record_id = $2
          ORDER BY id DESC
          LIMIT 1
        `,
        [
          rejectDocumentId,
          rejectMetadataId,
        ]
      );

    assertCondition(
      rejectMatch.rows[0]?.decision ===
        "REJECTED",
      "REJECT did not mark the match as REJECTED."
    );

    const rejectAudit =
      await pool.query<{ count: string }>(
        `
          SELECT COUNT(*)::text AS count
          FROM document_audit_logs
          WHERE
            document_id = $1
            AND action = 'APPRAISAL_REJECTED'
        `,
        [rejectDocumentId]
      );

    assertCondition(
      Number(rejectAudit.rows[0]?.count || 0) >= 1,
      "REJECT did not create APPRAISAL_REJECTED audit event."
    );

    console.log(
      "PASS: REJECT left metadata untouched, kept document UNLINKED, rejected the match, and created audit."
    );

    // ============================================================
    // TEST 3 — CREATE_METADATA AFTER REJECT
    // ============================================================

    console.log(
      "\n[TEST 3] CREATE_METADATA after rejected match..."
    );

    const createDocumentId =
      await createDocument("CREATE");

    const oldMetadataId =
      await createMetadata("CREATE-OLD");

    const oldMatchId =
      await createMatch(
        createDocumentId,
        oldMetadataId,
        "PARTIAL_MATCH"
      );

    const newReferenceCode =
      `M18-TEST-NEW-${testSuffix}`;

    const createResponse =
      await apiRequest(
        `/api/documents/${createDocumentId}/review`,
        {
          decision: "CREATE_METADATA",
          metadataRecordId:
            oldMetadataId,
          metadata: {
            referenceCode:
              newReferenceCode,
            personName:
              "New Metadata Person",
            title:
              "New Metadata Created From Review",
            departmentId:
              String(departmentId),
            documentTypeId:
              String(documentTypeId),
            year:
              "2028",
            documentDate:
              "2028-03-10",
            section:
              "New Review Section",
            description:
              "New metadata created from the rejected appraisal flow.",
            additionalMetadata: {
              source:
                "M18_RUNTIME_TEST",
              reviewed:
                true,
            },
          },
        },
        rawSessionToken
      );

    console.log(
      `CREATE_METADATA HTTP status: ${createResponse.status}`
    );

    assertCondition(
      createResponse.status >= 200 &&
        createResponse.status < 300,
      `CREATE_METADATA endpoint failed: ${json(
        createResponse.body
      )}`
    );

    const newMetadata =
      await pool.query<QueryResultRow>(
        `
          SELECT
            id,
            reference_code,
            title,
            person_name,
            department_id,
            document_type_id,
            section,
            year,
            document_date,
            description,
            additional_metadata,
            status
          FROM metadata_records
          WHERE
            reference_code = $1
            AND organization_id = $2
        `,
        [
          newReferenceCode,
          testOrganizationId,
        ]
      );

    assertCondition(
      newMetadata.rows.length === 1,
      "CREATE_METADATA did not create the new metadata record."
    );

    const createdMeta =
      newMetadata.rows[0]!;

    const newMetadataId =
      Number(createdMeta.id);

    metadataIds.push(newMetadataId);

    assertCondition(
      createdMeta.title ===
        "New Metadata Created From Review",
      "CREATE_METADATA did not persist title."
    );

    assertCondition(
      createdMeta.person_name ===
        "New Metadata Person",
      "CREATE_METADATA did not persist person name."
    );

    assertCondition(
      createdMeta.section ===
        "New Review Section",
      "CREATE_METADATA did not persist section."
    );

    assertCondition(
      createdMeta.year === 2028,
      "CREATE_METADATA did not persist year."
    );

        const createdDocumentDate =
      createdMeta.document_date instanceof Date
        ? [
            createdMeta.document_date.getFullYear(),
            String(createdMeta.document_date.getMonth() + 1).padStart(2, "0"),
            String(createdMeta.document_date.getDate()).padStart(2, "0"),
          ].join("-")
        : String(createdMeta.document_date).slice(0, 10);

    assertCondition(
      createdDocumentDate === "2028-03-10",
      `CREATE_METADATA did not persist document date. Actual value: ${String(
        createdMeta.document_date
      )}`
    );

    assertCondition(
      createdMeta.description ===
        "New metadata created from the rejected appraisal flow.",
      "CREATE_METADATA did not persist description."
    );

    const createdAdditional =
      createdMeta.additional_metadata as Record<
        string,
        unknown
      >;

    assertCondition(
      createdAdditional.source ===
        "M18_RUNTIME_TEST",
      "CREATE_METADATA did not persist additional metadata."
    );

    assertCondition(
      createdAdditional.reviewed === true,
      "CREATE_METADATA did not persist boolean additional metadata."
    );

    assertCondition(
      createdMeta.status ===
        "DOCUMENT_LINKED",
      `CREATE_METADATA produced incorrect metadata status: ${String(
        createdMeta.status
      )}`
    );

    const createdDocument =
      await pool.query<QueryResultRow>(
        `
          SELECT
            metadata_record_id,
            department_id,
            document_type_id,
            status
          FROM documents
          WHERE
            id = $1
            AND organization_id = $2
        `,
        [
          createDocumentId,
          testOrganizationId,
        ]
      );

    assertCondition(
      Number(createdDocument.rows[0]?.metadata_record_id) ===
        newMetadataId,
      `CREATE_METADATA did not link the document to the newly created metadata. Expected ${newMetadataId}, got ${String(
        createdDocument.rows[0]?.metadata_record_id
      )}.`
    );

    assertCondition(
      createdDocument.rows[0]?.status ===
        "LINKED",
      "CREATE_METADATA did not set document status to LINKED."
    );

    const oldMatch =
      await pool.query<{ decision: string }>(
        `
          SELECT decision
          FROM document_matches
          WHERE id = $1
        `,
        [oldMatchId]
      );

    assertCondition(
      oldMatch.rows[0]?.decision ===
        "REJECTED",
      "CREATE_METADATA did not reject the previous proposed match."
    );

    const createAudit =
      await pool.query<{ count: string }>(
        `
          SELECT COUNT(*)::text AS count
          FROM document_audit_logs
          WHERE
            document_id = $1
            AND metadata_record_id = $2
            AND action = 'DOCUMENT_LINKED'
        `,
        [
          createDocumentId,
          newMetadataId,
        ]
      );

    assertCondition(
      Number(createAudit.rows[0]?.count || 0) >= 1,
      "CREATE_METADATA did not create DOCUMENT_LINKED audit event."
    );

    console.log(
      "PASS: CREATE_METADATA created reviewed metadata, linked the document, rejected the old match, and created audit."
    );

    // ------------------------------------------------------------
    // Final result.
    // ------------------------------------------------------------

    console.log("\n==============================================");
    console.log("M18 RUNTIME TEST PASSED");
    console.log("==============================================");
    console.log(
      "APPROVE: edited metadata persisted and linked."
    );
    console.log(
      "REJECT: metadata remained untouched and document stayed unlinked."
    );
    console.log(
      "CREATE_METADATA: new metadata was created and linked."
    );
    console.log(
      "Audit events verified for all appraisal paths."
    );
    console.log("==============================================");
  } catch (error) {
    console.error("\n==============================================");
    console.error("M18 RUNTIME TEST FAILED");
    console.error("==============================================");

    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }

    process.exitCode = 1;
  } finally {
    // ------------------------------------------------------------
    // Cleanup temporary records.
    // Foreign-key cascades remove extractions/matches.
    // Audit references are SET NULL where appropriate.
    // ------------------------------------------------------------

    try {
      if (documentIds.length > 0) {
        await pool.query(
          `
            DELETE FROM documents
            WHERE id = ANY($1::bigint[])
          `,
          [documentIds]
        );

        console.log(
          `Cleanup: removed ${documentIds.length} temporary document(s).`
        );
      }

      if (metadataIds.length > 0) {
        await pool.query(
          `
            DELETE FROM metadata_records
            WHERE id = ANY($1::bigint[])
          `,
          [metadataIds]
        );

        console.log(
          `Cleanup: removed ${metadataIds.length} temporary metadata record(s).`
        );
      }

      if (sessionId !== null) {
        await pool.query(
          `
            DELETE FROM sessions
            WHERE id = $1
          `,
          [sessionId]
        );

        console.log(
          "Cleanup: removed temporary authenticated session."
        );
      }
    } catch (cleanupError) {
      console.error(
        "\nWARNING: M18 test cleanup encountered an error."
      );

      if (cleanupError instanceof Error) {
        console.error(cleanupError.message);
      } else {
        console.error(cleanupError);
      }

      process.exitCode = 1;
    }

    await pool.end();
  }
}

void main();




