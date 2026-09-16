import { createAuditLog } from "../services/audit.js";
import { parseReviewMetadata } from "../services/metadataUtils.js";
import {
  Router,
  type Request,
  type Response,
} from "express";

import type { Pool } from "pg";

import {
  requireAuthentication,
  requireRole,
} from "../middleware/auth.js";

export function createDocumentsRouter(
  pool: Pool
) {
  const router = Router();

router.get(
  "/",
  requireAuthentication(pool),
  async (
    _req: Request,
    res: Response
  ) => {
    try {
      const result =
        await pool.query(`
          SELECT
            doc.id,
            doc.document_code,
            doc.upload_number,
            doc.filename,
            doc.title,
            doc.document_date,
            doc.upload_date,
            doc.year,
            doc.person_name,
            doc.file_type,
            doc.file_size,
            doc.status,

            doc.metadata_record_id,

            mr.reference_code,
            mr.title AS metadata_title,
            mr.person_name
              AS metadata_person_name,
            mr.section
              AS metadata_section,
            mr.status
              AS metadata_status,

            d.id AS department_id,
            d.name AS department_name,
            d.code AS department_code,

            dt.id AS document_type_id,
            dt.name AS document_type_name

          FROM documents doc

          LEFT JOIN metadata_records mr
            ON mr.id =
               doc.metadata_record_id

          LEFT JOIN departments d
            ON d.id =
               doc.department_id

          LEFT JOIN document_types dt
            ON dt.id =
               doc.document_type_id

          ORDER BY
            doc.upload_date DESC
        `);

      res.json({
        success: true,
        documents:
          result.rows,
      });
    } catch (error) {
      console.error(
        "Documents query failed:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          "Unable to retrieve documents",
      });
    }
  }
);

router.post(
  "/:documentId/link",
  requireAuthentication(pool),
  requireRole("ADMIN", "APPRAISER"),
  async (
    req: Request,
    res: Response
  ) => {
    const documentId =
      Number(
        req.params.documentId
      );

    const metadataRecordId =
      Number(
        req.body?.metadataRecordId
      );

    if (
      !Number.isInteger(
        documentId
      ) ||
      documentId <= 0
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Invalid document ID",
      });
    }

    if (
      !Number.isInteger(
        metadataRecordId
      ) ||
      metadataRecordId <= 0
    ) {
      return res.status(400).json({
        success: false,
        error:
          "A valid metadata record ID is required",
      });
    }

    const client =
      await pool.connect();

    try {
      await client.query(
        "BEGIN"
      );

      const documentResult =
        await client.query(
          `
            SELECT *
            FROM documents
            WHERE id = $1
            FOR UPDATE
          `,
          [documentId]
        );

      if (
        documentResult.rowCount ===
        0
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(404).json({
          success: false,
          error:
            "Document not found",
        });
      }

      const metadataResult =
        await client.query(
          `
            SELECT *
            FROM metadata_records
            WHERE id = $1
            FOR UPDATE
          `,
          [metadataRecordId]
        );

      if (
        metadataResult.rowCount ===
        0
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(404).json({
          success: false,
          error:
            "Metadata record not found",
        });
      }

      /*
       * IMPORTANT:
       *
       * There is deliberately NO
       * existing-link restriction here.
       *
       * One metadata record may link
       * to many documents.
       */

      const document =
        documentResult.rows[0];

      const metadata =
        metadataResult.rows[0];

      await client.query(
        `
          UPDATE documents
          SET
            metadata_record_id = $1,

            department_id =
              COALESCE(
                department_id,
                $2
              ),

            document_type_id =
              COALESCE(
                document_type_id,
                $3
              ),

            status = 'LINKED',
            updated_at = NOW()

          WHERE id = $4
        `,
        [
          metadataRecordId,
          metadata.department_id ||
            null,
          metadata.document_type_id ||
            null,
          documentId,
        ]
      );

      await client.query(
        `
          UPDATE metadata_records
          SET
            status =
              'DOCUMENT_LINKED',
            updated_at = NOW()
          WHERE id = $1
        `,
        [metadataRecordId]
      );

      await client.query(
        `
          UPDATE document_matches
          SET
            decision = 'LINKED'
          WHERE document_id = $1
            AND metadata_record_id = $2
        `,
        [
          documentId,
          metadataRecordId,
        ]
      );

      await createAuditLog(
        client,
        documentId,
        metadataRecordId,
        "DOCUMENT_LINKED",
        JSON.stringify({
          documentCode:
            document.document_code,
          referenceCode:
            metadata.reference_code,
          decision:
            "Human confirmed document-to-metadata link",
        })
      );

      await client.query(
        "COMMIT"
      );

      const linkedResult =
        await pool.query(
          `
            SELECT
              doc.*,

              mr.reference_code,
              mr.title
                AS metadata_title,
              mr.person_name
                AS metadata_person_name,
              mr.section
                AS metadata_section,
              mr.status
                AS metadata_status,

              d.name
                AS department_name,

              dt.name
                AS document_type_name

            FROM documents doc

            LEFT JOIN metadata_records mr
              ON mr.id =
                 doc.metadata_record_id

            LEFT JOIN departments d
              ON d.id =
                 doc.department_id

            LEFT JOIN document_types dt
              ON dt.id =
                 doc.document_type_id

            WHERE doc.id = $1
          `,
          [documentId]
        );

      return res.json({
        success: true,
        message:
          "Document linked successfully",
        document:
          linkedResult.rows[0],
      });
    } catch (error) {
      await client.query(
        "ROLLBACK"
      );

      console.error(
        "Document linking failed:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Unable to link document",
        details:
          process.env.NODE_ENV ===
            "development" &&
          error instanceof Error
            ? error.message
            : undefined,
      });
    } finally {
      client.release();
    }
  }
);
  router.post(
  "/:documentId/review",
  requireAuthentication(pool),
  requireRole("ADMIN", "APPRAISER"),
  async (
    req: Request,
    res: Response
  ) => {
    const documentId =
      Number(
        req.params.documentId
      );

    const {
      decision,
      metadataRecordId,
    } = req.body || {};

    const normalizedDecision =
      String(decision || "")
        .trim()
        .toUpperCase();

    const parsedMetadataRecordId =
      metadataRecordId === null ||
      metadataRecordId ===
        undefined ||
      metadataRecordId === ""
        ? null
        : Number(
            metadataRecordId
          );

    const submittedMetadata =
      parseReviewMetadata(
        req.body?.metadata
      );

    if (
      !Number.isInteger(
        documentId
      ) ||
      documentId <= 0
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Invalid document ID",
      });
    }

    if (
      normalizedDecision !==
        "APPROVE" &&
      normalizedDecision !==
        "REJECT" &&
      normalizedDecision !==
        "CREATE_METADATA"
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Decision must be APPROVE, REJECT, or CREATE_METADATA",
      });
    }

    if (
      normalizedDecision ===
        "APPROVE" &&
      (
        parsedMetadataRecordId ===
          null ||
        !Number.isInteger(
          parsedMetadataRecordId
        ) ||
        parsedMetadataRecordId <= 0
      )
    ) {
      return res.status(400).json({
        success: false,
        error:
          "A metadata record is required to approve the match.",
      });
    }

    const client =
      await pool.connect();

    try {
      await client.query(
        "BEGIN"
      );

      /*
       * Lock the document first.
       */
      const documentResult =
        await client.query(
          `
            SELECT *
            FROM documents
            WHERE id = $1
            FOR UPDATE
          `,
          [documentId]
        );

      if (
        documentResult.rows.length ===
        0
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(404).json({
          success: false,
          error:
            "Document not found",
        });
      }

      const document =
        documentResult.rows[0];

      /*
       * Get the latest extraction.
       */
      const extractionResult =
        await client.query(
          `
            SELECT
              extracted_text,
              extracted_title,
              extracted_date,
              extracted_year,
              extracted_person_name
            FROM document_extractions
            WHERE document_id = $1
            ORDER BY created_at DESC
            LIMIT 1
          `,
          [documentId]
        );

      const extraction =
        extractionResult.rows[0] ||
        {};

      document.extracted_text =
        extraction.extracted_text ??
        null;

      document.extracted_title =
        extraction.extracted_title ??
        null;

      document.extracted_date =
        extraction.extracted_date ??
        null;

      document.extracted_year =
        extraction.extracted_year ??
        null;

      document.extracted_person_name =
        extraction.extracted_person_name ??
        null;

      /*
       * --------------------------------------------------
       * APPROVE & LINK
       * --------------------------------------------------
       */
      if (
        normalizedDecision ===
        "APPROVE"
      ) {
        const metadataLockResult =
          await client.query(
            `
              SELECT *
              FROM metadata_records
              WHERE id = $1
              FOR UPDATE
            `,
            [
              parsedMetadataRecordId,
            ]
          );

        if (
          metadataLockResult.rows
            .length === 0
        ) {
          await client.query(
            "ROLLBACK"
          );

          return res.status(404).json({
            success: false,
            error:
              "The recommended metadata record no longer exists.",
          });
        }

        const metadataResult =
          await client.query(
            `
              SELECT
                mr.*,

                d.name
                  AS department_name,
                d.code
                  AS department_code,

                dt.name
                  AS document_type_name

              FROM metadata_records mr

              LEFT JOIN departments d
                ON d.id =
                   mr.department_id

              LEFT JOIN document_types dt
                ON dt.id =
                   mr.document_type_id

              WHERE mr.id = $1
            `,
            [
              parsedMetadataRecordId,
            ]
          );

        const metadata =
          metadataResult.rows[0];

        /*
         * NO existing-link check.
         *
         * A metadata record can be linked
         * to any number of documents.
         */

        const linkedDocumentResult =
          await client.query(
            `
              UPDATE documents
              SET
                metadata_record_id = $1,

                department_id =
                  COALESCE(
                    department_id,
                    $2
                  ),

                document_type_id =
                  COALESCE(
                    document_type_id,
                    $3
                  ),

                status = 'LINKED',
                updated_at = NOW()

              WHERE id = $4

              RETURNING *
            `,
            [
              parsedMetadataRecordId,
              metadata.department_id,
              metadata.document_type_id,
              documentId,
            ]
          );

        await client.query(
          `
            UPDATE document_matches
            SET
              decision = 'LINKED'
            WHERE document_id = $1
              AND metadata_record_id = $2
          `,
          [
            documentId,
            parsedMetadataRecordId,
          ]
        );

        await createAuditLog(
          client,
          documentId,
          parsedMetadataRecordId,
          "APPRAISAL_APPROVED",
          "Human reviewer approved the AI-recommended document-to-metadata match."
        );

        await client.query(
          "COMMIT"
        );

        return res.json({
          success: true,
          message:
            "Document successfully linked to the approved metadata record.",
          document:
            linkedDocumentResult
              .rows[0],
          metadata,
          decision: "LINKED",
        });
      }

      /*
       * --------------------------------------------------
       * REJECT MATCH
       * --------------------------------------------------
       *
       * Rejecting the AI recommendation
       * creates a NEW metadata record.
       *
       * The reviewer may optionally submit:
       *
       * {
       *   metadata: {
       *     referenceCode,
       *     title,
       *     personName,
       *     departmentId,
       *     documentTypeId,
       *     section,
       *     year,
       *     documentDate,
       *     description
       *   }
       * }
       *
       * If the metadata object is supplied,
       * its values are respected exactly,
       * including null/blank values.
       *
       * This means the reviewer is NOT forced
       * to accept every extracted field.
       */
      /*
       * --------------------------------------------------
       * REJECT MATCH
       * --------------------------------------------------
       *
       * Rejecting the AI recommendation does NOT create
       * a metadata record.
       *
       * The reviewer will subsequently review/edit the
       * proposed new metadata in the frontend and use
       * CREATE_METADATA when they explicitly approve
       * creation.
       *
       * Therefore REJECT only:
       *
       * 1. Marks the AI recommendation as REJECTED.
       * 2. Leaves the existing metadata unchanged.
       * 3. Leaves the document unlinked.
       * 4. Records the appraisal rejection in the audit log.
       */
      if (
        normalizedDecision ===
        "REJECT"
      ) {
        const latestMatchResult =
          await client.query(
            `
              SELECT *
              FROM document_matches
              WHERE document_id = $1
              ORDER BY created_at DESC
              LIMIT 1
            `,
            [documentId]
          );

        const latestMatch =
          latestMatchResult.rows[0] ||
          null;

        /*
         * Mark the AI recommendation as rejected.
         *
         * No metadata_records row is inserted or
         * modified here.
         */
        if (latestMatch) {
          await client.query(
            `
              UPDATE document_matches
              SET
                decision = 'REJECTED'
              WHERE id = $1
            `,
            [latestMatch.id]
          );
        }

        /*
         * Explicitly keep the uploaded document
         * unlinked after the AI recommendation
         * has been rejected.
         */
        const unlinkedDocumentResult =
          await client.query(
            `
              UPDATE documents
              SET
                metadata_record_id = NULL,
                status = 'UNLINKED',
                updated_at = NOW()
              WHERE id = $1
              RETURNING *
            `,
            [documentId]
          );

        /*
         * Record the human rejection.
         *
         * The rejected metadata record is referenced
         * for audit history only; it is not modified.
         */
        await createAuditLog(
          client,
          documentId,
          latestMatch?.metadata_record_id ??
            null,
          "APPRAISAL_REJECTED",
          "Human reviewer rejected the AI-recommended document-to-metadata match. No new metadata record was created."
        );

        await client.query(
          "COMMIT"
        );

        return res.json({
          success: true,
          message:
            "AI match rejected. No metadata record was created. The document is ready for new metadata review.",
          document:
            unlinkedDocumentResult.rows[0],
          metadata: null,
          match:
            latestMatch
              ? {
                  ...latestMatch,
                  decision: "REJECTED",
                }
              : null,
          rejectedMetadataRecordId:
            latestMatch?.metadata_record_id ??
            null,
          decision: "REJECTED",
        });
      }
    } catch (error) {
      await client.query(
        "ROLLBACK"
      );

      console.error(
        "Appraisal review failed:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Unable to record appraisal decision",
        details:
          process.env.NODE_ENV ===
            "development" &&
          error instanceof Error
            ? error.message
            : undefined,
      });
    } finally {
      client.release();
    }
  }
);


  router.get(
    "/:documentId/appraisal",
    requireAuthentication(pool),
    async (
      req: Request,
      res: Response
    ) => {
      const documentId =
        Number(
          req.params.documentId
        );

      if (
        !Number.isInteger(
          documentId
        ) ||
        documentId <= 0
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid document ID",
        });
      }

      try {
        const documentResult =
          await pool.query(
            `
              SELECT
                doc.*,

                mr.reference_code,
                mr.title
                  AS metadata_title,
                mr.person_name
                  AS metadata_person_name,
                mr.year
                  AS metadata_year,
                mr.document_date
                  AS metadata_document_date,
                mr.description
                  AS metadata_description,
                mr.section
                  AS metadata_section,
                mr.status
                  AS metadata_status,

                d.name
                  AS department_name,
                dt.name
                  AS document_type_name

              FROM documents doc

              LEFT JOIN metadata_records mr
                ON mr.id =
                   doc.metadata_record_id

              LEFT JOIN departments d
                ON d.id =
                   doc.department_id

              LEFT JOIN document_types dt
                ON dt.id =
                   doc.document_type_id

              WHERE doc.id = $1
            `,
            [documentId]
          );

        if (
          documentResult.rowCount === 0
        ) {
          return res.status(404).json({
            success: false,
            error:
              "Document not found",
          });
        }

        const extractionResult =
          await pool.query(
            `
              SELECT *
              FROM document_extractions
              WHERE document_id = $1
              ORDER BY created_at DESC
              LIMIT 1
            `,
            [documentId]
          );

        const matchResult =
          await pool.query(
            `
              SELECT
                dm.*,

                mr.reference_code,
                mr.title
                  AS metadata_title,
                mr.person_name
                  AS metadata_person_name,
                mr.year
                  AS metadata_year,
                mr.document_date
                  AS metadata_document_date,
                mr.description
                  AS metadata_description,
                mr.section
                  AS metadata_section,
                mr.status
                  AS metadata_status,

                d.name
                  AS department_name,
                dt.name
                  AS document_type_name

              FROM document_matches dm

              LEFT JOIN metadata_records mr
                ON mr.id =
                   dm.metadata_record_id

              LEFT JOIN departments d
                ON d.id =
                   mr.department_id

              LEFT JOIN document_types dt
                ON dt.id =
                   mr.document_type_id

              WHERE dm.document_id = $1

              ORDER BY
                dm.created_at DESC
            `,
            [documentId]
          );

        res.json({
          success: true,
          document:
            documentResult.rows[0],
          extraction:
            extractionResult.rows[0] ||
            null,
          matches:
            matchResult.rows,
        });
      } catch (error) {
        console.error(
          "Appraisal retrieval failed:",
          error
        );

        res.status(500).json({
          success: false,
          error:
            "Unable to retrieve appraisal result",
        });
      }
    }
  );
  return router;
}
