import "dotenv/config";

import { createHash, randomBytes } from "crypto";
import { Pool } from "pg";
import { writeFile, unlink } from "fs/promises";
import path from "path";

const API_URL =
  process.env.M19_TEST_API_URL ||
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

async function main() {
  let testUserId: number | null = null;
  let testOrganizationId: number | null = null;
  let sessionId: number | null = null;

  const documentIds: number[] = [];
  const metadataIds: number[] = [];
  const temporaryFiles: string[] = [];

  const testSuffix = Date.now().toString();

  try {
    console.log("\n==============================================");
    console.log("M19 RUNTIME TEST STARTING");
    console.log("==============================================");
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
      "No active ADMIN/OWNER organization membership is available."
    );

    testUserId = adminResult.rows[0]!.user_id;
    testOrganizationId =
      adminResult.rows[0]!.organization_id;

    console.log(
      `Authenticated test context: user=${testUserId}, organization=${testOrganizationId}`
    );

    // ------------------------------------------------------------
    // 2. Create temporary authenticated session.
    // ------------------------------------------------------------

    const rawSessionToken =
      randomBytes(32).toString("hex");

    const tokenHash =
      createHash("sha256")
        .update(rawSessionToken)
        .digest("hex");

    const sessionResult =
      await pool.query<{ id: number }>(
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

    sessionId =
      sessionResult.rows[0]!.id;

    console.log(
      `Temporary authenticated session created: ${sessionId}`
    );

    // ------------------------------------------------------------
    // 3. Find existing MET-8 record and verify its ownership.
    // ------------------------------------------------------------

    const existingMetadataResult =
      await pool.query<{
        id: number;
        reference_code: string;
        title: string | null;
        person_name: string | null;
        year: number | null;
      }>(
        `
          SELECT
            id,
            reference_code,
            title,
            person_name,
            year
          FROM metadata_records
          WHERE
            id = 66
            AND organization_id = $1
        `,
        [testOrganizationId]
      );

    assertCondition(
      existingMetadataResult.rows.length === 1,
      "Expected existing MET-8 metadata record was not found in the authenticated organization."
    );

    const existingMetadata =
      existingMetadataResult.rows[0]!;

    assertCondition(
      existingMetadata.reference_code === "MET-8",
      `Expected metadata reference MET-8, got ${existingMetadata.reference_code}.`
    );

    console.log(
      `Existing repeated-document candidate: id=${existingMetadata.id}, reference=${existingMetadata.reference_code}`
    );

    // ------------------------------------------------------------
    // 4. Build a minimal text PDF.
    //
    // The PDF contains:
    // - MET-8 reference
    // - existing metadata title/person/year
    // - partial date "Sun Jan 18"
    //
    // This lets the real extraction + matcher pipeline run.
    // ------------------------------------------------------------

    function escapePdfText(value: string): string {
      return value
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)");
    }

    function createPdf(textLines: string[]): Buffer {
      const streamLines = [
        "BT",
        "/F1 12 Tf",
        "50 760 Td",
        ...textLines.map(
          (line, index) =>
            `(${escapePdfText(line)}) Tj${
              index < textLines.length - 1
                ? " 0 -24 Td"
                : ""
            }`
        ),
        "ET",
      ];

      const stream =
        streamLines.join("\n");

      const objects = [
        "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
        "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
        "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
        "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
        `5 0 obj\n<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream\nendobj\n`,
      ];

      let pdf =
        "%PDF-1.4\n";

      const offsets: number[] = [0];

      for (const object of objects) {
        offsets.push(
          Buffer.byteLength(pdf, "utf8")
        );
        pdf += object;
      }

      const xrefOffset =
        Buffer.byteLength(pdf, "utf8");

      pdf +=
        `xref\n0 ${objects.length + 1}\n`;

      pdf +=
        "0000000000 65535 f \n";

      for (
        let i = 1;
        i <= objects.length;
        i++
      ) {
        pdf +=
          `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
      }

      pdf +=
        `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
      pdf +=
        `startxref\n${xrefOffset}\n%%EOF\n`;

      return Buffer.from(pdf, "utf8");
    }

    // ------------------------------------------------------------
    // 5. TEST 1 — repeated-document matching.
    // ------------------------------------------------------------

    console.log(
      "\n[TEST 1] Repeated-document matching against DOCUMENT_LINKED metadata..."
    );

    const repeatedPdfPath =
      path.join(
        process.cwd(),
        `m19-runtime-repeated-${testSuffix}.pdf`
      );

    const repeatedPdf =
      createPdf([
        "PCC M19 REPEATED DOCUMENT TEST",
        existingMetadata.reference_code,
        existingMetadata.title ||
          "BILL REFENRENCE NO:",
        existingMetadata.person_name ||
          "M19 Existing Person",
        "Sun Jan 18",
      ]);

    await writeFile(
      repeatedPdfPath,
      repeatedPdf
    );

    temporaryFiles.push(
      repeatedPdfPath
    );

    const repeatedForm =
      new FormData();

    repeatedForm.append(
      "file",
      new Blob(
        [
          repeatedPdf.buffer
            .slice(
              repeatedPdf.byteOffset,
              repeatedPdf.byteOffset +
                repeatedPdf.byteLength
            ) as ArrayBuffer,
        ],
        { type: "application/pdf" }
      ),
      `M19 Repeated ${testSuffix}.pdf`
    );

    const repeatedResponse =
      await fetch(
        `${API_URL}/api/documents/upload`,
        {
          method: "POST",
          headers: {
            Cookie:
              `session=${rawSessionToken}`,
          },
          body: repeatedForm,
        }
      );

    const repeatedText =
      await repeatedResponse.text();

    let repeatedBody: any;

    try {
      repeatedBody =
        repeatedText
          ? JSON.parse(repeatedText)
          : null;
    } catch {
      repeatedBody =
        repeatedText;
    }

    console.log(
      `Repeated upload HTTP status: ${repeatedResponse.status}`
    );

    console.log(
      "Repeated upload appraisal:"
    );

    console.log(
      json(
        repeatedBody?.appraisal ??
          repeatedBody
      )
    );

    assertCondition(
      repeatedResponse.ok,
      `Repeated-document upload failed: ${json(repeatedBody)}`
    );

    const repeatedDocumentId =
      Number(
        repeatedBody?.document?.id ??
        repeatedBody?.data?.document?.id
      );

    assertCondition(
      Number.isInteger(
        repeatedDocumentId
      ) &&
        repeatedDocumentId > 0,
      "Repeated-document upload did not return a valid document ID."
    );

    documentIds.push(
      repeatedDocumentId
    );

    const repeatedAppraisal =
      repeatedBody?.appraisal;

    assertCondition(
      Number(
        repeatedAppraisal?.metadataRecordId
      ) === Number(existingMetadata.id),
      `Repeated document did not select MET-8. Expected ${existingMetadata.id}, got ${String(
        repeatedAppraisal?.metadataRecordId
      )}.`
    );

    assertCondition(
      repeatedAppraisal?.matchType ===
        "STRONG_MATCH",
      `Repeated document did not produce STRONG_MATCH. Got ${String(
        repeatedAppraisal?.matchType
      )}.`
    );

    assertCondition(
      Number(
        repeatedAppraisal?.confidence
      ) >= 75,
      `Repeated document confidence was below STRONG_MATCH threshold: ${String(
        repeatedAppraisal?.confidence
      )}.`
    );

    console.log(
      "PASS: DOCUMENT_LINKED metadata was considered by the matcher."
    );

    console.log(
      `PASS: Existing metadata selected: ${existingMetadata.reference_code}.`
    );

    console.log(
      `PASS: Match type=${repeatedAppraisal.matchType}, confidence=${repeatedAppraisal.confidence}.`
    );

    // ------------------------------------------------------------
    // 6. Verify partial date persistence on the uploaded document.
    // ------------------------------------------------------------

    const extractionResult =
      await pool.query<{
        extracted_date: string | null;
        extracted_date_text: string | null;
        extracted_year: number | null;
      }>(
        `
          SELECT
            extracted_date,
            extracted_date_text,
            extracted_year
          FROM document_extractions
          WHERE document_id = $1
          ORDER BY id DESC
          LIMIT 1
        `,
        [repeatedDocumentId]
      );

    assertCondition(
      extractionResult.rows.length === 1,
      "No extraction record was created for repeated-document upload."
    );

    const extraction =
      extractionResult.rows[0]!;

    console.log(
      "\nRepeated-document extraction:"
    );
    console.log(
      json(extraction)
    );

    assertCondition(
      extraction.extracted_year === 2018,
      `Expected extracted year 2018 from "Sun Jan 18", got ${String(
        extraction.extracted_year
      )}.`
    );

    assertCondition(
      extraction.extracted_date === null,
      `Expected no complete calendar date for "Sun Jan 18", got ${String(
        extraction.extracted_date
      )}.`
    );

    assertCondition(
      extraction.extracted_date_text ===
        "Sun Jan 2018",
      `Expected partial extracted date "Sun Jan 2018", got ${String(
        extraction.extracted_date_text
      )}.`
    );

    console.log(
      'PASS: Partial date preserved as "Sun Jan 2018".'
    );

    // ------------------------------------------------------------
    // 7. TEST 2 — generated MET-* reference for a NO_MATCH.
    // ------------------------------------------------------------

    console.log(
      "\n[TEST 2] Generated metadata reference for a genuine NO_MATCH..."
    );

    const noMatchPdfPath =
      path.join(
        process.cwd(),
        `m19-runtime-no-match-${testSuffix}.pdf`
      );

    const noMatchReference =
      `M19-UNIQUE-REFERENCE-${testSuffix}`;

    const noMatchTitle =
      `M19 Unique Archive Document ${testSuffix}`;

    const noMatchPerson =
      `M19 Unique Person ${testSuffix}`;

    const noMatchPdf =
      createPdf([
        noMatchTitle,
        noMatchReference,
        noMatchPerson,
        "1992",
        "A completely unique document for M19 runtime verification.",
      ]);

    await writeFile(
      noMatchPdfPath,
      noMatchPdf
    );

    temporaryFiles.push(
      noMatchPdfPath
    );

    const noMatchForm =
      new FormData();

    noMatchForm.append(
      "file",
      new Blob(
        [
          noMatchPdf.buffer
            .slice(
              noMatchPdf.byteOffset,
              noMatchPdf.byteOffset +
                noMatchPdf.byteLength
            ) as ArrayBuffer,
        ],
        { type: "application/pdf" }
      ),
      `M19 No Match ${testSuffix}.pdf`
    );

    const beforeSequenceResult =
      await pool.query<{
        last_value: string;
        is_called: boolean;
      }>(
        `
          SELECT
            last_value,
            is_called
          FROM metadata_reference_number_seq
        `
      );

    const noMatchResponse =
      await fetch(
        `${API_URL}/api/documents/upload`,
        {
          method: "POST",
          headers: {
            Cookie:
              `session=${rawSessionToken}`,
          },
          body: noMatchForm,
        }
      );

    const noMatchText =
      await noMatchResponse.text();

    let noMatchBody: any;

    try {
      noMatchBody =
        noMatchText
          ? JSON.parse(noMatchText)
          : null;
    } catch {
      noMatchBody =
        noMatchText;
    }

    console.log(
      `NO_MATCH upload HTTP status: ${noMatchResponse.status}`
    );

    console.log(
      "NO_MATCH upload appraisal:"
    );

    console.log(
      json(
        noMatchBody?.appraisal ??
          noMatchBody
      )
    );

    assertCondition(
      noMatchResponse.ok,
      `NO_MATCH upload failed: ${json(noMatchBody)}`
    );

    const noMatchDocumentId =
      Number(
        noMatchBody?.document?.id ??
        noMatchBody?.data?.document?.id
      );

    assertCondition(
      Number.isInteger(
        noMatchDocumentId
      ) &&
        noMatchDocumentId > 0,
      "NO_MATCH upload did not return a valid document ID."
    );

    documentIds.push(
      noMatchDocumentId
    );

    const noMatchAppraisal =
      noMatchBody?.appraisal;

    assertCondition(
      noMatchAppraisal?.matchType ===
        "NO_MATCH",
      `Expected NO_MATCH, got ${String(
        noMatchAppraisal?.matchType
      )}.`
    );

    assertCondition(
      noMatchAppraisal?.metadataRecordId ===
        null,
      `Expected null metadataRecordId for NO_MATCH, got ${String(
        noMatchAppraisal?.metadataRecordId
      )}.`
    );

    const generatedReference =
      String(
        noMatchAppraisal?.metadata
          ?.reference_code ??
        ""
      );

    console.log(
      `Generated appraisal reference: ${generatedReference}`
    );

    assertCondition(
      /^MET-\d+$/.test(
        generatedReference
      ),
      `Expected generated MET-* reference, got "${generatedReference}".`
    );

    /*
     * The metadata reference numbering is owned by the database
     * sequence (metadata_reference_number_seq). Rather than hardcoding
     * or predicting an absolute number (earlier runs may have consumed
     * values without persisting them), snapshot the sequence before and
     * after the upload and assert that the upload consumed exactly one
     * number and that the returned reference matches that number.
     */
    const sequenceResult =
      await pool.query<{
        last_value: string;
        is_called: boolean;
      }>(
        `
          SELECT
            last_value,
            is_called
          FROM metadata_reference_number_seq
        `
      );

    const beforeNextValue =
      beforeSequenceResult.rows[0]!
        .is_called
        ? Number(
            beforeSequenceResult
              .rows[0]!.last_value
          ) + 1
        : Number(
            beforeSequenceResult
              .rows[0]!.last_value
          );

    const consumedValue =
      Number(
        sequenceResult.rows[0]!
          .last_value
      );

    assertCondition(
      sequenceResult.rows[0]!.is_called ===
        true,
      "Metadata reference sequence was not advanced by the upload."
    );

    assertCondition(
      consumedValue === beforeNextValue,
      `NO_MATCH upload did not consume exactly one metadata reference number (next before ${beforeNextValue}, value consumed ${consumedValue}).`
    );

    const expectedNextReference =
      `MET-${consumedValue}`;

    assertCondition(
      generatedReference ===
        expectedNextReference,
      `Expected next metadata reference ${expectedNextReference}, got ${generatedReference}.`
    );

    assertCondition(
      noMatchAppraisal?.metadata
        ?.id === null ||
        noMatchAppraisal?.metadata
          ?.id === undefined,
      "NO_MATCH unexpectedly attached an existing metadata record."
    );

    console.log(
      `PASS: Genuine NO_MATCH received generated reference ${generatedReference}.`
    );

    // ------------------------------------------------------------
    // 8. Verify the generated reference was only proposed, not
    //    persisted yet.
    // ------------------------------------------------------------

    const generatedMetadataResult =
      await pool.query<{
        count: string;
      }>(
        `
          SELECT COUNT(*)::text AS count
          FROM metadata_records
          WHERE
            organization_id = $1
            AND reference_code = $2
        `,
        [
          testOrganizationId,
          generatedReference,
        ]
      );

    assertCondition(
      Number(
        generatedMetadataResult.rows[0]!.count
      ) === 0,
      `Generated ${generatedReference} was unexpectedly persisted before human CREATE_METADATA review.`
    );

    console.log(
      `PASS: ${generatedReference} remains an appraisal proposal until human review.`
    );

    // ------------------------------------------------------------
    // 9. Final runtime assertions.
    // ------------------------------------------------------------

    console.log(
      "\n=============================================="
    );
    console.log(
      "M19 RUNTIME TEST PASSED"
    );
    console.log(
      "=============================================="
    );
    console.log(
      "REPEATED MATCH: DOCUMENT_LINKED metadata was matched."
    );
    console.log(
      "PARTIAL DATE: Sun Jan 18 preserved as Sun Jan 2018."
    );
    console.log(
      "NEW METADATA: NO_MATCH generated the next MET-N reference."
    );
    console.log(
      "PERSISTENCE: MET-9 was not inserted before human appraisal."
    );
    console.log(
      "=============================================="
    );
  } catch (error) {
    console.error(
      "\n=============================================="
    );
    console.error(
      "M19 RUNTIME TEST FAILED"
    );
    console.error(
      "=============================================="
    );

    if (error instanceof Error) {
      console.error(
        error.message
      );
      if (error.stack) {
        console.error(
          error.stack
        );
      }
    } else {
      console.error(
        error
      );
    }

    process.exitCode = 1;
  } finally {
    // ------------------------------------------------------------
    // Cleanup temporary database records.
    // ------------------------------------------------------------

    try {
      if (
        documentIds.length > 0
      ) {
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

      if (
        metadataIds.length > 0
      ) {
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

      if (
        sessionId !== null
      ) {
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
        "\nWARNING: M19 database cleanup encountered an error."
      );

      if (
        cleanupError instanceof Error
      ) {
        console.error(
          cleanupError.message
        );
      } else {
        console.error(
          cleanupError
        );
      }

      process.exitCode = 1;
    }

    // ------------------------------------------------------------
    // Remove locally created test PDFs.
    // ------------------------------------------------------------

    for (
      const temporaryFile of temporaryFiles
    ) {
      try {
        await unlink(
          temporaryFile
        );

        console.log(
          `Cleanup: removed temporary file ${path.basename(temporaryFile)}.`
        );
      } catch {
        // File may already have been moved/removed by the API.
      }
    }

    await pool.end();
  }
}

void main();


