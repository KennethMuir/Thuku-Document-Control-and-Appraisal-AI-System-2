import { createAuditLog } from "../services/audit.js";
import { parseReviewMetadata, sanitizeAdditionalMetadata } from "../services/metadataUtils.js";
import {
  Router,
  type Request,
  type Response,
} from "express";

import type { Pool } from "pg";

import type { FileStorageService } from "../services/storage.js";

import {
  requireAuthentication,
  requireOrganizationContext,
  requireRole,
  type AuthenticatedRequest,
} from "../middleware/auth.js";

export function createDocumentsRouter(
  pool: Pool,
  localFileStorage?: FileStorageService
) {
  const router = Router();

  const getOrganizationId = (
    req: Request,
    res: Response
  ): number | null => {
    const organizationId =
      (req as AuthenticatedRequest)
        .authOrganization?.organizationId;

    if (typeof organizationId !== "number" || !Number.isInteger(organizationId) || organizationId <= 0) {
      res.status(403).json({
        success: false,
        error: "Organization context is required.",
      });
      return null;
    }

    return organizationId;
  };

  const getActorUserId = (
    req: Request
  ): number | null => {
    const authUser =
      (req as AuthenticatedRequest).authUser;

    return authUser?.id ?? null;
  };

router.get(
  "/",
  requireAuthentication(pool),
  requireOrganizationContext(pool),
  async (
    req: Request,
    res: Response
  ) => {
    const organizationId = getOrganizationId(req, res);
    if (organizationId === null) {
      return;
    }

    try {
      const result = await pool.query(`
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
            dt.name AS document_type_name,

            COALESCE(
              (
                SELECT json_agg(
                  json_build_object(
                    'domain_id', dr.id,
                    'domain_key', dr.domain_key,
                    'domain_name', dr.display_name,
                    'domain_scope',
                      CASE
                        WHEN dr.organization_id IS NOT NULL
                          THEN 'ORGANIZATION'
                        WHEN COALESCE(
                          (to_jsonb(dr) ->> 'specialization_id'),
                          ''
                        ) <> ''
                          THEN 'SPECIALIZED'
                        ELSE 'UNIVERSAL'
                      END
                  )
                  ORDER BY dr.display_name
                )
                FROM metadata_domain_relationships mdr
                INNER JOIN domain_registry dr
                  ON dr.id = mdr.domain_id
                WHERE mdr.metadata_record_id =
                      doc.metadata_record_id
              ),
              '[]'::json
            ) AS domain_classifications

          FROM documents doc

          LEFT JOIN metadata_records mr
            ON mr.id =
               doc.metadata_record_id
            AND mr.organization_id = doc.organization_id

          LEFT JOIN departments d
            ON d.id =
               doc.department_id

          LEFT JOIN document_types dt
            ON dt.id =
               doc.document_type_id

          WHERE doc.organization_id = $1

          ORDER BY
            doc.upload_date DESC
        `, [organizationId]);

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
  requireOrganizationContext(pool),
  requireRole("ADMIN", "APPRAISER"),
  async (
    req: Request,
    res: Response
  ) => {
    const organizationId = getOrganizationId(req, res);
    if (organizationId === null) {
      return;
    }

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
              AND organization_id = $2
            FOR UPDATE
          `,
          [documentId, organizationId]
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
              AND organization_id = $2
            FOR UPDATE
          `,
          [metadataRecordId, organizationId]
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
            AND organization_id = $5
        `,
        [
          metadataRecordId,
          metadata.department_id ||
            null,
          metadata.document_type_id ||
            null,
          documentId,
          organizationId,
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
            AND organization_id = $2
        `,
        [metadataRecordId, organizationId]
      );

      await client.query(
        `
          UPDATE document_matches
          SET
            decision = 'LINKED'
          WHERE document_id = $1
            AND metadata_record_id = $2
            AND EXISTS (
              SELECT 1
              FROM documents doc
              WHERE doc.id = document_matches.document_id
                AND doc.organization_id = $3
            )
        `,
        [
          documentId,
          metadataRecordId,
          organizationId,
        ]
      );

      await createAuditLog(
        client,
        organizationId,
        getActorUserId(req),
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
              AND doc.organization_id = $2
          `,
          [documentId, organizationId]
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
  requireOrganizationContext(pool),
  requireRole("ADMIN", "APPRAISER"),
  async (
    req: Request,
    res: Response
  ) => {
    const organizationId = getOrganizationId(req, res);
    if (organizationId === null) {
      return;
    }

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
              AND organization_id = $2
            FOR UPDATE
          `,
          [documentId, organizationId]
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
       * M18 APPRAISAL DECISION CONTRACT
       * --------------------------------------------------
       *
       * APPROVE:
       * Persist the reviewer's edited metadata and link
       * the document to the existing metadata record.
       *
       * CREATE_METADATA:
       * Explicitly create a new metadata record from the
       * reviewer's edited appraisal form and link the
       * document to that new record.
       *
       * REJECT:
       * Reject only the AI recommendation. It does not
       * create or modify a metadata record.
       */

      const normalizeOptionalString =
        (value: unknown): string | null => {
          const normalized =
            String(value ?? "").trim();

          return normalized.length > 0
            ? normalized
            : null;
        };

      const normalizeOptionalInteger =
        (
          value: unknown,
          fieldName: string
        ): number | null => {
          if (
            value === null ||
            value === undefined ||
            String(value).trim() === ""
          ) {
            return null;
          }

          const normalized =
            Number(value);

          if (
            !Number.isInteger(
              normalized
            )
          ) {
            throw new Error(
              `${fieldName} must be an integer.`
            );
          }

          return normalized;
        };

      const validateOrganizationReferences =
        async (
          departmentId: number | null,
          documentTypeId: number | null
        ) => {
          if (departmentId !== null) {
            const department =
              await client.query(
                `
                  SELECT id
                  FROM departments
                  WHERE id = $1
                    AND organization_id = $2
                `,
                [
                  departmentId,
                  organizationId,
                ]
              );

            if (
              department.rowCount === 0
            ) {
              return {
                valid: false,
                error:
                  "Department does not belong to your organization.",
              };
            }
          }

          if (documentTypeId !== null) {
            const documentType =
              await client.query(
                `
                  SELECT id
                  FROM document_types
                  WHERE id = $1
                    AND organization_id = $2
                `,
                [
                  documentTypeId,
                  organizationId,
                ]
              );

            if (
              documentType.rowCount === 0
            ) {
              return {
                valid: false,
                error:
                  "Document type does not belong to your organization.",
              };
            }
          }

          return {
            valid: true,
            error: null,
          };
        };

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
                AND organization_id = $2
              FOR UPDATE
            `,
            [
              parsedMetadataRecordId,
              organizationId,
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

        let metadata =
          metadataLockResult.rows[0];

        /*
         * If the frontend supplied the review form,
         * persist its values exactly, including cleared
         * fields represented as null.
         *
         * reference_code is intentionally not changed.
         */
        if (submittedMetadata) {
          const departmentId =
            normalizeOptionalInteger(
              submittedMetadata.departmentId,
              "Department"
            );

          const documentTypeId =
            normalizeOptionalInteger(
              submittedMetadata.documentTypeId,
              "Document type"
            );

          const year =
            normalizeOptionalInteger(
              submittedMetadata.year,
              "Year"
            );

          const references =
            await validateOrganizationReferences(
              departmentId,
              documentTypeId
            );

          if (!references.valid) {
            await client.query(
              "ROLLBACK"
            );

            return res.status(400).json({
              success: false,
              error:
                references.error,
            });
          }

          const additionalMetadata =
            JSON.stringify(
              sanitizeAdditionalMetadata(
                submittedMetadata.additionalMetadata
              )
            );

          const updatedMetadataResult =
            await client.query(
              `
                UPDATE metadata_records
                SET
                  title = $1,
                  person_name = $2,
                  department_id = $3,
                  document_type_id = $4,
                  section = $5,
                  year = $6,
                  document_date = $7,
                  description = $8,
                  additional_metadata = $9::jsonb,
                  status = 'DOCUMENT_LINKED',
                  updated_at = NOW()
                WHERE id = $10
                  AND organization_id = $11
                RETURNING *
              `,
              [
                normalizeOptionalString(
                  submittedMetadata.title
                ),
                normalizeOptionalString(
                  submittedMetadata.personName
                ),
                departmentId,
                documentTypeId,
                normalizeOptionalString(
                  submittedMetadata.section
                ),
                year,
                normalizeOptionalString(
                  submittedMetadata.documentDate
                ),
                normalizeOptionalString(
                  submittedMetadata.description
                ),
                additionalMetadata,
                parsedMetadataRecordId,
                organizationId,
              ]
            );

          metadata =
            updatedMetadataResult.rows[0];
        } else {
          const metadataStatusResult =
            await client.query(
              `
                UPDATE metadata_records
                SET
                  status = 'DOCUMENT_LINKED',
                  updated_at = NOW()
                WHERE id = $1
                  AND organization_id = $2
                RETURNING *
              `,
              [
                parsedMetadataRecordId,
                organizationId,
              ]
            );

          metadata =
            metadataStatusResult.rows[0];
        }

        const linkedDocumentResult =
          await client.query(
            `
              UPDATE documents
              SET
                metadata_record_id = $1,
                department_id = $2,
                document_type_id = $3,
                status = 'LINKED',
                updated_at = NOW()
              WHERE id = $4
                AND organization_id = $5
              RETURNING *
            `,
            [
              parsedMetadataRecordId,
              metadata.department_id,
              metadata.document_type_id,
              documentId,
              organizationId,
            ]
          );

        await client.query(
          `
            UPDATE document_matches
            SET
              decision = 'LINKED'
            WHERE document_id = $1
              AND metadata_record_id = $2
              AND EXISTS (
                SELECT 1
                FROM documents doc
                WHERE doc.id = document_matches.document_id
                  AND doc.organization_id = $3
              )
          `,
          [
            documentId,
            parsedMetadataRecordId,
            organizationId,
          ]
        );

        await createAuditLog(
          client,
          organizationId,
          getActorUserId(req),
          documentId,
          parsedMetadataRecordId,
          "APPRAISAL_APPROVED",
          "Human reviewer approved the document-to-metadata match and persisted the reviewed metadata."
        );

        await client.query(
          "COMMIT"
        );

        return res.json({
          success: true,
          message:
            "Document successfully linked to the approved metadata record.",
          document:
            linkedDocumentResult.rows[0],
          metadata,
          decision: "LINKED",
        });
      }

      /*
       * --------------------------------------------------
       * CREATE NEW METADATA
       * --------------------------------------------------
       */
      if (
        normalizedDecision ===
        "CREATE_METADATA"
      ) {
        if (!submittedMetadata) {
          await client.query(
            "ROLLBACK"
          );

          return res.status(400).json({
            success: false,
            error:
              "Metadata is required when creating a new metadata record.",
          });
        }

        const referenceCode =
          normalizeOptionalString(
            submittedMetadata.referenceCode
          );

        if (!referenceCode) {
          await client.query(
            "ROLLBACK"
          );

          return res.status(400).json({
            success: false,
            error:
              "Reference code is required.",
          });
        }

        const duplicateResult =
          await client.query(
            `
              SELECT id
              FROM metadata_records
              WHERE LOWER(reference_code) =
                    LOWER($1)
                AND organization_id = $2
              LIMIT 1
            `,
            [
              referenceCode,
              organizationId,
            ]
          );

        if (
          duplicateResult.rowCount &&
          duplicateResult.rowCount > 0
        ) {
          await client.query(
            "ROLLBACK"
          );

          return res.status(409).json({
            success: false,
            error:
              "A metadata record with this reference code already exists.",
          });
        }

        const departmentId =
          normalizeOptionalInteger(
            submittedMetadata.departmentId,
            "Department"
          );

        const documentTypeId =
          normalizeOptionalInteger(
            submittedMetadata.documentTypeId,
            "Document type"
          );

        const year =
          normalizeOptionalInteger(
            submittedMetadata.year,
            "Year"
          );

        const references =
          await validateOrganizationReferences(
            departmentId,
            documentTypeId
          );

        if (!references.valid) {
          await client.query(
            "ROLLBACK"
          );

          return res.status(400).json({
            success: false,
            error:
              references.error,
          });
        }

        const additionalMetadata =
          JSON.stringify(
            sanitizeAdditionalMetadata(
              submittedMetadata.additionalMetadata
            )
          );

        const createdMetadataResult =
          await client.query(
            `
              INSERT INTO metadata_records (
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
                status,
                organization_id
              )
              VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                $10::jsonb,
                'AWAITING_DOCUMENT',
                $11
              )
              RETURNING *
            `,
            [
              referenceCode,
              normalizeOptionalString(
                submittedMetadata.title
              ),
              normalizeOptionalString(
                submittedMetadata.personName
              ),
              departmentId,
              documentTypeId,
              normalizeOptionalString(
                submittedMetadata.section
              ),
              year,
              normalizeOptionalString(
                submittedMetadata.documentDate
              ),
              normalizeOptionalString(
                submittedMetadata.description
              ),
              additionalMetadata,
              organizationId,
            ]
          );

        let metadata =
          createdMetadataResult.rows[0];

        /*
         * The new metadata is immediately linked to the
         * uploaded document, so its final status is the
         * established DOCUMENT_LINKED status.
         */
        const linkedMetadataResult =
          await client.query(
            `
              UPDATE metadata_records
              SET
                status = 'DOCUMENT_LINKED',
                updated_at = NOW()
              WHERE id = $1
                AND organization_id = $2
              RETURNING *
            `,
            [
              metadata.id,
              organizationId,
            ]
          );

        metadata =
          linkedMetadataResult.rows[0];

        const linkedDocumentResult =
          await client.query(
            `
              UPDATE documents
              SET
                metadata_record_id = $1,
                department_id = $2,
                document_type_id = $3,
                status = 'LINKED',
                updated_at = NOW()
              WHERE id = $4
                AND organization_id = $5
              RETURNING *
            `,
            [
              metadata.id,
              metadata.department_id,
              metadata.document_type_id,
              documentId,
              organizationId,
            ]
          );

        /*
         * The AI recommendation was not approved.
         * The human created a different metadata record.
         */
        await client.query(
          `
            UPDATE document_matches
            SET
              decision = 'REJECTED'
            WHERE document_id = $1
              AND metadata_record_id IS NOT NULL
              AND metadata_record_id <> $2
              AND EXISTS (
                SELECT 1
                FROM documents doc
                WHERE doc.id = document_matches.document_id
                  AND doc.organization_id = $3
              )
          `,
          [
            documentId,
            metadata.id,
            organizationId,
          ]
        );

        await createAuditLog(
          client,
          organizationId,
          getActorUserId(req),
          documentId,
          metadata.id,
          "DOCUMENT_LINKED",
          "Human reviewer created new metadata from the appraisal review and linked the uploaded document to the new metadata record."
        );

        await client.query(
          "COMMIT"
        );

        return res.json({
          success: true,
          message:
            "New metadata record created and document successfully linked.",
          document:
            linkedDocumentResult.rows[0],
          metadata,
          decision:
            "NEW_METADATA_CREATED",
        });
      }

      /*
       * --------------------------------------------------
       * REJECT MATCH
       * --------------------------------------------------
       *
       * REJECT only rejects the AI recommendation.
       * It does not create or modify metadata.
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

        if (latestMatch) {
          await client.query(
            `
              UPDATE document_matches
              SET
                decision = 'REJECTED'
              WHERE id = $1
                AND document_id = $2
            `,
            [latestMatch.id, documentId]
          );
        }

        const unlinkedDocumentResult =
          await client.query(
            `
              UPDATE documents
              SET
                metadata_record_id = NULL,
                status = 'UNLINKED',
                updated_at = NOW()
              WHERE id = $1
                AND organization_id = $2
              RETURNING *
            `,
            [
              documentId,
              organizationId,
            ]
          );

        await createAuditLog(
          client,
          organizationId,
          getActorUserId(req),
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
                  decision:
                    "REJECTED",
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
    requireOrganizationContext(pool),
    async (
      req: Request,
      res: Response
    ) => {
      const organizationId = getOrganizationId(req, res);
      if (organizationId === null) {
        return;
      }

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
                AND mr.organization_id = doc.organization_id

              LEFT JOIN departments d
                ON d.id =
                   doc.department_id

              LEFT JOIN document_types dt
                ON dt.id =
                   doc.document_type_id

              WHERE doc.id = $1
                AND doc.organization_id = $2
            `,
            [documentId, organizationId]
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
               AND mr.organization_id = $2

              LEFT JOIN departments d
                ON d.id =
                   mr.department_id
               AND d.organization_id = $2

              LEFT JOIN document_types dt
                ON dt.id =
                   mr.document_type_id
               AND dt.organization_id = $2

              WHERE dm.document_id = $1
                AND EXISTS (
                  SELECT 1
                  FROM documents doc
                  WHERE doc.id = dm.document_id
                    AND doc.organization_id = $2
                )

              ORDER BY
                dm.created_at DESC
            `,
            [documentId, organizationId]
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

router.get(
  "/:documentId/file",
  requireAuthentication(pool),
  requireOrganizationContext(pool),
  async (
    req: Request,
    res: Response
  ) => {
    const organizationId = getOrganizationId(req, res);
    if (organizationId === null) {
      return;
    }

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
      const result =
        await pool.query(
          `
            SELECT
              df.original_filename,
              df.stored_filename,
              df.storage_provider,
              df.storage_reference,
              df.mime_type,
              d.owner_user_id
            FROM document_files df
            INNER JOIN documents d
              ON d.id = df.document_id
            WHERE df.document_id = $1
              AND d.organization_id = $2
            ORDER BY df.uploaded_at DESC
            LIMIT 1
          `,
          [documentId, organizationId]
        );

      if (
        result.rowCount === 0
      ) {
        return res.status(404).json({
          success: false,
          error:
            "Document file not found",
        });
      }

      const file =
        result.rows[0];

      const authenticatedRequest =
        req as AuthenticatedRequest;

      const authUser =
        authenticatedRequest.authUser;

      if (!authUser) {
        return res.status(401).json({
          success: false,
          error:
            "Authentication required",
        });
      }

      const isOwner =
        Number(file.owner_user_id) ===
        authUser.id;

      const membershipRole =
        authenticatedRequest.authOrganization?.role;

      const isPrivileged =
        membershipRole === "OWNER" ||
        membershipRole === "ADMIN" ||
        membershipRole === "APPRAISER";

      if (
        !isOwner &&
        !isPrivileged
      ) {
        return res.status(403).json({
          success: false,
          error:
            "You do not have access to this document",
        });
      }

      const storageProvider =
        String(
          file.storage_provider || ""
        ).toUpperCase();

      if (
        storageProvider !==
        "LOCAL"
      ) {
        return res.status(500).json({
          success: false,
          error:
            `Unsupported document storage provider: ${storageProvider || "UNKNOWN"}`,
        });
      }

      const storageReference =
        String(
          file.storage_reference || ""
        ).trim();

      if (!storageReference) {
        return res.status(500).json({
          success: false,
          error:
            "Document storage reference is missing",
        });
      }

      if (!localFileStorage) {
        return res.status(500).json({
          success: false,
          error:
            "Document storage service is unavailable",
        });
      }

      const exists =
        await localFileStorage.exists(
          storageReference
        );

      if (!exists) {
        return res.status(404).json({
          success: false,
          error:
            "Stored document file is missing",
        });
      }

      res.setHeader(
        "Content-Type",
        file.mime_type ||
          "application/octet-stream"
      );

      res.setHeader(
        "Content-Disposition",
        `inline; filename="${String(
          file.original_filename
        ).replace(/"/g, "")}"`
      );

      const fileStream =
        localFileStorage.openReadStream(storageReference);

      fileStream.on("error", (streamError) => {
        console.error(
          "Document file stream failed:",
          streamError
        );

        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: "Unable to retrieve document file",
          });
        } else {
          res.destroy(
            streamError instanceof Error
              ? streamError
              : new Error("Document file stream failed")
          );
        }
      });

      return fileStream.pipe(res);
    } catch (error) {
      console.error(
        "Document file retrieval failed:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Unable to retrieve document file",
      });
    }
  }
);

  return router;
}
