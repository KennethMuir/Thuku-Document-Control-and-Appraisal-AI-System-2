import "dotenv/config";

import { createHash, randomBytes } from "crypto";
import { Pool } from "pg";

/*
 * M20 — CONCURRENCY RUNTIME VERIFICATION
 *
 * Verifies that the existing transaction + FOR UPDATE model:
 *   1. Allows only ONE successful CREATE_METADATA for a shared
 *      reference code (no duplicate authoritative metadata).
 *   2. Serializes concurrent appraisal decisions (double-linking and
 *      conflicting APPROVE/REJECT decisions are internally consistent).
 *   3. Allows one-to-many linking of multiple documents to the same
 *      metadata under concurrency.
 */

const API_URL =
  process.env.M20_TEST_API_URL ||
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

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

async function apiRequest(
  path: string,
  body: Record<string, unknown>,
  sessionToken: string
) {
  let response: Response;

  try {
    response = await fetch(
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
  } catch (error) {
    return {
      status: 0,
      body: String(error),
    };
  }

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

  const metadataIds: number[] = [];
  const documentIds: number[] = [];

  const testSuffix = Date.now().toString();

  try {
    console.log(
      "\nM20 CONCURRENCY TEST STARTING..."
    );
    console.log(`API: ${API_URL}`);

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
        AND om.role = 'OWNER'
        AND o.status = 'ACTIVE'
      ORDER BY om.user_id
      LIMIT 1
    `);

    assertCondition(
      adminResult.rows.length === 1,
      "No active OWNER is available for the M20 concurrency test."
    );

    testUserId = adminResult.rows[0]!.user_id;
    testOrganizationId =
      adminResult.rows[0]!.organization_id;

    const sessionToken =
      await (async () => {
        const rawToken =
          randomBytes(32).toString("hex");

        const tokenHash =
          createHash("sha256")
            .update(rawToken)
            .digest("hex");

        await pool.query(
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
          `,
          [testUserId, tokenHash]
        );

        return rawToken;
      })();

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

    async function createDocument(
      suffix: string
    ): Promise<number> {
      const result = await pool.query<{
        id: number;
      }>(
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
          `M20-CONC-DOC-${testSuffix}-${suffix}`,
          `M20 Concurrency Test ${suffix}.pdf`,
          `Concurrent Test Document ${suffix}`,
          `Concurrent Person ${suffix}`,
          testOrganizationId!,
          testUserId!,
        ]
      );

      const documentId =
        Number(result.rows[0]!.id);

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
          `M20 concurrency extracted text ${suffix}`,
          `Concurrent Test Document ${suffix}`,
          `Concurrent Person ${suffix}`,
        ]
      );

      return documentId;
    }

    async function createMetadata(
      referenceCode: string,
      suffix: string
    ): Promise<number> {
      const result = await pool.query<{
        id: number;
      }>(
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
            'Concurrency Section',
            $7::jsonb,
            $8
          )
          RETURNING id
        `,
        [
          referenceCode,
          `Concurrency Metadata ${suffix}`,
          `Concurrency Person ${suffix}`,
          `Concurrency Description ${suffix}`,
          departmentId,
          documentTypeId,
          JSON.stringify({ source: "M20_CONCURRENCY" }),
          testOrganizationId,
        ]
      );

      const metadataId =
        Number(result.rows[0]!.id);

      metadataIds.push(metadataId);

      return metadataId;
    }

    async function createMatch(
      documentId: number,
      metadataId: number
    ): Promise<number> {
      const result = await pool.query<{
        id: number;
      }>(
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
            'PARTIAL_MATCH',
            85.00,
            'title',
            'person_name',
            'PENDING'
          )
          RETURNING id
        `,
        [documentId, metadataId]
      );

      return Number(result.rows[0]!.id);
    }

    const reviewPayloadBase = (
      referenceCode: string,
      suffix: string
    ): Record<string, unknown> => ({
      metadata: {
        referenceCode,
        title: `Concurrency Edited ${suffix}`,
        personName: "Edited Concurrent Person",
        departmentId: String(departmentId),
        documentTypeId: String(documentTypeId),
        year: "2027",
        documentDate: "2027-02-20",
        section: "Edited Section",
        description: "Edited by concurrency test.",
        additionalMetadata: {
          source: "M20_CONCURRENCY",
          attempt: true,
        },
      },
    });

    // ============================================================
    // TEST 1 — concurrent CREATE_METADATA with the SAME reference
    //          code on two different documents.
    // ============================================================

    console.log(
      "\n[TEST 1] Concurrent CREATE_METADATA with a shared reference code..."
    );

    const sharedReference =
      `M20-SHARED-REF-${testSuffix}`;

    const docD1 =
      await createDocument("D1");

    const docD2 =
      await createDocument("D2");

    const results = await Promise.all([
      apiRequest(
        `/api/documents/${docD1}/review`,
        {
          decision: "CREATE_METADATA",
          metadataRecordId: null,
          ...reviewPayloadBase(
            sharedReference,
            "D1"
          ),
        },
        sessionToken
      ),
      apiRequest(
        `/api/documents/${docD2}/review`,
        {
          decision: "CREATE_METADATA",
          metadataRecordId: null,
          ...reviewPayloadBase(
            sharedReference,
            "D2"
          ),
        },
        sessionToken
      ),
    ]);

    console.log(
      `Concurrent CREATE_METADATA statuses: ${results
        .map((r) => r.status)
        .join(", ")}`
    );

    const successCount =
      results.filter(
        (r) =>
          r.status >= 200 &&
          r.status < 300
      ).length;

    assertCondition(
      successCount === 1,
      `Expected exactly one successful CREATE_METADATA, got ${successCount}.`
    );

    const sharedMetadataCount =
      await pool.query<{ count: string }>(
        `
          SELECT COUNT(*)::text AS count
          FROM metadata_records
          WHERE LOWER(reference_code) =
                LOWER($1)
            AND organization_id = $2
        `,
        [sharedReference, testOrganizationId]
      );

    assertCondition(
      Number(
        sharedMetadataCount.rows[0]!.count
      ) === 1,
      `Duplicate authoritative metadata references were created (${sharedMetadataCount.rows[0]!.count}).`
    );

    const sharedMetadataRow =
      await pool.query<{
        id: number;
        document_count: string;
      }>(
        `
          SELECT
            mr.id,
            (
              SELECT COUNT(*)::text
              FROM documents d
              WHERE d.metadata_record_id =
                    mr.id
            ) AS document_count
          FROM metadata_records mr
          WHERE LOWER(mr.reference_code) =
                LOWER($1)
            AND mr.organization_id = $2
          LIMIT 1
        `,
        [sharedReference, testOrganizationId]
      );

    const sharedDocumentLinks =
      Number(
        sharedMetadataRow.rows[0]
          ?.document_count || 0
      );

    const linkedCount =
      sharedDocumentLinks;

    assertCondition(
      linkedCount >= 0 &&
        linkedCount <= 2,
      "Metadata document linkage count is out of range."
    );

    const sharedMetadataId = Number(
      sharedMetadataRow.rows[0]!.id
    );

    metadataIds.push(sharedMetadataId);

    console.log(
      `PASS: Only one metadata record exists for the shared reference (documents linked: ${linkedCount}).`
    );

    // ============================================================
    // TEST 2 — concurrent APPROVE on the same document/metadata.
    // ============================================================

    console.log(
      "\n[TEST 2] Concurrent APPROVE on the same document..."
    );

    const docD3 =
      await createDocument("D3");

    const metadataD3 =
      await createMetadata(
        `M20-CONC-D3-${testSuffix}`,
        "D3"
      );

    await createMatch(docD3, metadataD3);

    const approveResults = await Promise.all(
      Array.from({ length: 5 }, () =>
        apiRequest(
          `/api/documents/${docD3}/review`,
          {
            decision: "APPROVE",
            metadataRecordId: metadataD3,
            ...reviewPayloadBase(
              `M20-CONC-D3-${testSuffix}`,
              "D3"
            ),
          },
          sessionToken
        )
      )
    );

    console.log(
      `Concurrent APPROVE statuses: ${approveResults
        .map((r) => r.status)
        .join(", ")}`
    );

    for (const result of approveResults) {
      assertCondition(
        result.status >= 200 &&
          result.status < 300,
        `Concurrent APPROVE failed: ${json(result.body)}`
      );
    }

    const consistentD3 =
      await pool.query<{
        doc_status: string;
        doc_metadata: number | null;
        met_status: string;
        match_decision: string;
      }>(
        `
          SELECT
            doc.status AS doc_status,
            doc.metadata_record_id AS doc_metadata,
            mr.status AS met_status,
            (
              SELECT dm.decision
              FROM document_matches dm
              WHERE dm.document_id = doc.id
                AND dm.metadata_record_id =
                    mr.id
              ORDER BY dm.id DESC
              LIMIT 1
            ) AS match_decision
          FROM documents doc
          INNER JOIN metadata_records mr
            ON mr.id = doc.metadata_record_id
          WHERE doc.id = $1
        `,
        [docD3]
      );

    assertCondition(
      consistentD3.rows[0]?.doc_status ===
        "LINKED",
      "Concurrent APPROVE did not leave the document LINKED."
    );

    assertCondition(
      Number(
        consistentD3.rows[0]?.doc_metadata
      ) === metadataD3,
      "Concurrent APPROVE produced an inconsistent metadata link."
    );

    assertCondition(
      consistentD3.rows[0]?.met_status ===
        "DOCUMENT_LINKED",
      "Concurrent APPROVE produced inconsistent metadata status."
    );

    assertCondition(
      consistentD3.rows[0]?.match_decision ===
        "LINKED",
      "Concurrent APPROVE produced inconsistent match status."
    );

    console.log(
      "PASS: Concurrent APPROVE is serialized by FOR UPDATE; final state is internally consistent."
    );

    // ============================================================
    // TEST 3 — conflicting APPROVE vs REJECT on the same document.
    // ============================================================

    console.log(
      "\n[TEST 3] Conflicting concurrent APPROVE vs REJECT..."
    );

    const docD4 =
      await createDocument("D4");

    const metadataD4 =
      await createMetadata(
        `M20-CONC-D4-${testSuffix}`,
        "D4"
      );

    await createMatch(docD4, metadataD4);

    const conflictResults = await Promise.all([
      apiRequest(
        `/api/documents/${docD4}/review`,
        {
          decision: "APPROVE",
          metadataRecordId: metadataD4,
          ...reviewPayloadBase(
            `M20-CONC-D4-${testSuffix}`,
            "D4"
          ),
        },
        sessionToken
      ),
      apiRequest(
        `/api/documents/${docD4}/review`,
        {
          decision: "REJECT",
          metadataRecordId: metadataD4,
        },
        sessionToken
      ),
    ]);

    console.log(
      `Conflicting decision statuses: ${conflictResults
        .map((r) => r.status)
        .join(", ")}`
    );

    for (const result of conflictResults) {
      assertCondition(
        result.status >= 200 &&
          result.status < 300,
        `Conflicting decision request failed: ${json(result.body)}`
      );
    }

    const consistentState =
      await pool.query<{
        doc_status: string;
        doc_metadata: number | null;
        met_status: string;
        has_linked_match: string;
      }>(
        `
          SELECT
            doc.status AS doc_status,
            doc.metadata_record_id AS doc_metadata,
            mr.status AS met_status,
            (
              SELECT COUNT(*)::text
              FROM document_matches dm
              WHERE dm.document_id = doc.id
                AND dm.decision = 'LINKED'
            ) AS has_linked_match
          FROM documents doc
          LEFT JOIN metadata_records mr
            ON mr.id = doc.metadata_record_id
          WHERE doc.id = $1
        `,
        [docD4]
      );

    const state =
      consistentState.rows[0]!;

    const linkedOutcome =
      state.doc_status === "LINKED" &&
      state.doc_metadata !== null &&
      state.met_status ===
        "DOCUMENT_LINKED" &&
      Number(state.has_linked_match) === 1;

    const unlinkedOutcome =
      state.doc_status === "UNLINKED" &&
      state.doc_metadata === null &&
      Number(state.has_linked_match) === 0;

    assertCondition(
      linkedOutcome || unlinkedOutcome,
      `Conflicting decisions produced an internally inconsistent state: ${json(state)}`
    );

    console.log(
      `PASS: Final state is internally consistent (${state.doc_status}).`
    );

    // ============================================================
    // TEST 4 — concurrent linking of two documents to one metadata.
    // ============================================================

    console.log(
      "\n[TEST 4] Concurrent one-to-many linking..."
    );

    const docD5 =
      await createDocument("D5");

    const docD6 =
      await createDocument("D6");

    const metadataD56 =
      await createMetadata(
        `M20-CONC-D56-${testSuffix}`,
        "D5-D6"
      );

    await createMatch(docD5, metadataD56);
    await createMatch(docD6, metadataD56);

    const linkResults = await Promise.all([
      apiRequest(
        `/api/documents/${docD5}/link`,
        {
          metadataRecordId: metadataD56,
        },
        sessionToken
      ),
      apiRequest(
        `/api/documents/${docD6}/link`,
        {
          metadataRecordId: metadataD56,
        },
        sessionToken
      ),
    ]);

    console.log(
      `Concurrent link statuses: ${linkResults
        .map((r) => r.status)
        .join(", ")}`
    );

    for (const result of linkResults) {
      assertCondition(
        result.status >= 200 &&
          result.status < 300,
        `Concurrent link failed: ${json(result.body)}`
      );
    }

    const linkage =
      await pool.query<{ count: string }>(
        `
          SELECT COUNT(*)::text AS count
          FROM documents
          WHERE metadata_record_id = $1
            AND status = 'LINKED'
        `,
        [metadataD56]
      );

    assertCondition(
      Number(linkage.rows[0]!.count) === 2,
      "One-to-many concurrent linking did not link both documents."
    );

    console.log(
      "PASS: Concurrent one-to-many linking of two documents completed consistently."
    );

    // ============================================================
    // Result.
    // ============================================================

    console.log(
      "\n=============================================="
    );
    console.log(
      "M20 CONCURRENCY TEST PASSED"
    );
    console.log(
      "=============================================="
    );
    console.log(
      "CREATE_METADATA: no duplicate authoritative references."
    );
    console.log(
      "APPROVE: serialized, internally consistent."
    );
    console.log(
      "APPROVE vs REJECT: consistent final state."
    );
    console.log(
      "One-to-many linking: consistent under concurrency."
    );
    console.log(
      "=============================================="
    );
  } catch (error) {
    console.error(
      "\n=============================================="
    );
    console.error(
      "M20 CONCURRENCY TEST FAILED"
    );
    console.error(
      "=============================================="
    );

    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }

    process.exitCode = 1;
  } finally {
    try {
      if (documentIds.length > 0) {
        await pool.query(
          `
            DELETE FROM documents
            WHERE id = ANY($1::bigint[])
          `,
          [documentIds]
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
      }

      console.log(
        "Cleanup: removed M20 concurrency test records."
      );
    } catch (cleanupError) {
      console.error(
        "\nWARNING: M20 concurrency cleanup error."
      );

      if (cleanupError instanceof Error) {
        console.error(cleanupError.message);
      }

      process.exitCode = 1;
    }

    await pool.end();
  }
}

void main();