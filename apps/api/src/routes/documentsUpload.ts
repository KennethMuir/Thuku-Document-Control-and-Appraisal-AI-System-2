import {
  Router,
  type Request,
  type Response,
} from "express";

import type { Pool, PoolClient } from "pg";
import multer from "multer";
import fs from "fs";
import path from "path";

import {
  requireAuthentication,
  requireOrganizationContext,
  requireRole,
  type AuthenticatedRequest,
} from "../middleware/auth.js";

import {
  extractDocumentContent,
} from "../services/documentExtraction.js";

import {
  createAuditLog,
} from "../services/audit.js";

import {
  LocalFileStorage,
} from "../services/storage.js";

async function generateMetadataReferenceCode(
  client: PoolClient
): Promise<string> {
  const result = await client.query(`
    SELECT nextval(
      'metadata_reference_number_seq'
    ) AS reference_number
  `);

  const referenceNumber = Number(
    result.rows[0]?.reference_number
  );

  if (
    !Number.isInteger(referenceNumber) ||
    referenceNumber <= 0
  ) {
    throw new Error(
      "The metadata reference number sequence returned an invalid value."
    );
  }

  return `MET-${referenceNumber}`;
}
export function createDocumentsUploadRouter(
  pool: Pool,
  upload: multer.Multer,
  localFileStorage: LocalFileStorage,
  findBestMetadataMatch: Function
) {
  const router = Router();
router.post(
  "/",
  requireAuthentication(pool),
  requireOrganizationContext(pool),
  requireRole("ADMIN", "APPRAISER"),
  upload.single("file"),
  async (
    req: Request,
    res: Response
  ) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error:
          "A document file is required",
      });
    }

    const temporaryPath =
      req.file.path;

    let targetPath:
      | string
      | null = null;

    const authenticatedRequest =
      req as AuthenticatedRequest;

    const ownerUser =
      authenticatedRequest.authUser;

    const organizationId =
      authenticatedRequest.authOrganization
        ?.organizationId;

    if (!ownerUser) {
      await fs.promises.unlink(
        temporaryPath
      ).catch(() => undefined);

      return res.status(401).json({
        success: false,
        error:
          "Authentication required",
      });
    }

    if (typeof organizationId !== "number" || !Number.isInteger(organizationId) || organizationId <= 0) {
      await fs.promises.unlink(temporaryPath).catch(() => undefined);

      return res.status(403).json({
        success: false,
        error: "Organization context is required",
      });
    }

    try {
      const originalName =
        req.file.originalname;

      const extension =
        path
          .extname(
            originalName
          )
          .toLowerCase();

      const allowedExtensions = [
        ".pdf",
        ".docx",
      ];

      if (
        !allowedExtensions.includes(
          extension
        )
      ) {
        await fs.promises.unlink(
          temporaryPath
        );

        return res.status(400).json({
          success: false,
          error:
            "Only PDF and DOCX files are currently supported",
        });
      }

      const client =
        await pool.connect();

      try {
        await client.query(
          "BEGIN"
        );

        /*
         * The sequence is the permanent
         * source of upload numbers.
         *
         * We intentionally do not calculate
         * the next number from MAX(document_code).
         */
        const codeResult =
          await client.query(`
            SELECT nextval(
              'document_upload_number_seq'
            ) AS upload_number
          `);

        const uploadNumber =
          Number(
            codeResult.rows[0]
              .upload_number
          );

        if (
          !Number.isInteger(
            uploadNumber
          ) ||
          uploadNumber <= 0
        ) {
          throw new Error(
            "The document upload number sequence returned an invalid value."
          );
        }

        const documentCode =
          `DOC-${uploadNumber}`;

        const storedFilename =
          `${documentCode}${extension}`;

        const storedDocument =
          await localFileStorage.store(
            temporaryPath,
            storedFilename
          );

        targetPath =
          storedDocument.localPath;

        const extracted =
          await extractDocumentContent(
            targetPath,
            extension,
            originalName
          );

        const documentResult =
          await client.query(
            `
              INSERT INTO documents (
                document_code,
                upload_number,
                filename,
                title,
                document_date,
                year,
                person_name,
                file_type,
                file_size,
                status,
                owner_user_id,
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
                $10,
                $11,
                $12
              )
              RETURNING *
            `,
            [
              documentCode,
              uploadNumber,
              originalName,
              extracted.title,
              extracted.date,
              extracted.year,
              extracted.personName,
              extension
                .replace(".", "")
                .toUpperCase(),
              req.file.size,
              "UNLINKED",
              ownerUser.id,
              organizationId,
            ]
          );

        const document =
          documentResult.rows[0];

        const documentId =
          Number(document.id);

        await client.query(
          `
            INSERT INTO document_files (
              document_id,
              original_filename,
              stored_filename,
              storage_path,
              storage_provider,
              storage_reference,
              mime_type,
              file_size
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              $8
            )
          `,
          [
            documentId,
            originalName,
            `${documentCode}${extension}`,
            targetPath,
            storedDocument.provider,
            storedDocument.reference,
            req.file.mimetype ||
              null,
            req.file.size,
          ]
        );

        const extractionResult =
          await client.query(
            `
              INSERT INTO document_extractions (
                document_id,
                extracted_text,
                extracted_title,
                extracted_date,
                extracted_date_text,
                extracted_year,
                extracted_person_name,
                extraction_status
              )
              VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8
              )
              RETURNING *
            `,
            [
              documentId,
              extracted.text,
              extracted.title,
              extracted.date,
              extracted.extractedDateText,
              extracted.year,
              extracted.personName,
              "COMPLETED",
            ]
          );

        const extraction =
          extractionResult.rows[0];

        const bestMatch =
          await findBestMetadataMatch(
            client,
            extracted,
            organizationId
          );

        let documentStatus =
          "UNLINKED";

        let decision =
          "PENDING";

        if (
          bestMatch.matchType ===
            "STRONG_MATCH" &&
          bestMatch.confidence >= 75
        ) {
          documentStatus =
            "REVIEW_REQUIRED";

          decision =
            "PENDING";
        } else if (
          bestMatch.matchType ===
          "PARTIAL_MATCH"
        ) {
          documentStatus =
            "REVIEW_REQUIRED";

          decision =
            "PENDING";
        } else {
          documentStatus =
            "UNLINKED";

          decision =
            "NO_MATCH";
        }

        await client.query(
          `
            UPDATE documents
            SET
              status = $1,

              title =
                COALESCE(
                  $2,
                  title
                ),

              document_date =
                COALESCE(
                  $3,
                  document_date
                ),

              year =
                COALESCE(
                  $4,
                  year
                ),

              person_name =
                COALESCE(
                  $5,
                  person_name
                ),

              updated_at =
                NOW()

            WHERE id = $6
          `,
          [
            documentStatus,
            extracted.title,
            extracted.date,
            extracted.year,
            extracted.personName,
            documentId,
          ]
        );

        let matchRow = null;

        if (
          bestMatch.metadataRecordId
        ) {
          const matchInsert =
            await client.query(
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
                  $4,
                  $5,
                  $6,
                  $7
                )
                RETURNING *
              `,
              [
                documentId,
                bestMatch.metadataRecordId,
                bestMatch.matchType,
                bestMatch.confidence,
                bestMatch
                  .matchingFields
                  .join(", ") ||
                  null,
                bestMatch
                  .conflictingFields
                  .join(", ") ||
                  null,
                decision,
              ]
            );

          matchRow =
            matchInsert.rows[0];
        } else {
          const matchInsert =
            await client.query(
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
                  NULL,
                  'NO_MATCH',
                  0,
                  NULL,
                  NULL,
                  'NO_MATCH'
                )
                RETURNING *
              `,
              [documentId]
            );

          matchRow =
            matchInsert.rows[0];
        }

        await createAuditLog(
          client,
          organizationId,
          ownerUser.id,
          documentId,
          bestMatch.metadataRecordId,
          "DOCUMENT_APPRAISED",
          JSON.stringify({
            documentCode,
            uploadNumber,
            matchType:
              bestMatch.matchType,
            confidence:
              bestMatch.confidence,
            matchingFields:
              bestMatch.matchingFields,
            conflictingFields:
              bestMatch.conflictingFields,
            decision,
          })
        );

        await client.query(
          "COMMIT"
        );

        const appraisalMetadataResult =
          bestMatch.metadataRecordId
            ? await client.query(
                `
                  SELECT
                    mr.id,
                    mr.reference_code,
                    mr.title,
                    mr.document_date::text AS document_date,
                    mr.year,
                    mr.person_name,
                    mr.description,
                    mr.section,
                    mr.status,

                    latest.department_id,
                    dep.name AS department_name,
                    dep.code AS department_code,

                    latest.document_type_id,
                    dt.name AS document_type_name

                  FROM metadata_records mr

                  LEFT JOIN LATERAL (
                    SELECT
                      d.department_id,
                      d.document_type_id
                    FROM documents d
                    WHERE d.metadata_record_id = mr.id
                    ORDER BY d.id DESC
                    LIMIT 1
                  ) latest
                    ON TRUE

                  LEFT JOIN departments dep
                    ON dep.id = latest.department_id

                  LEFT JOIN document_types dt
                    ON dt.id = latest.document_type_id

                  WHERE mr.id = $1
                    AND mr.organization_id = $2
                  LIMIT 1
                `,
                [
                  bestMatch.metadataRecordId,
                  organizationId,
                ]
              )
            : { rows: [] };

        const existingAppraisalMetadata =
          appraisalMetadataResult.rows[0] ??
          null;

        const extractedText =
          extraction?.extracted_text ??
          "";

        const extractLabeledValue = (
          labels: string[]
        ): string | null => {
          for (const label of labels) {
            const escapedLabel =
              label.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
              );

            const pattern =
              new RegExp(
                `(?:^|\\n)\\s*${escapedLabel}\\s*[:\\-]\\s*(.+)`,
                "im"
              );

            const match =
              extractedText.match(pattern);

            if (match?.[1]) {
              return match[1].trim();
            }
          }

          return null;
        };

        const extractedSection =
          extractLabeledValue([
            "Section",
          ]);

        const extractedDescription =
          extractLabeledValue([
            "Description",
          ]);

        const extractedDepartment =
          extractLabeledValue([
            "Department",
            "Department Name",
          ]);

        const extractedDepartmentCode =
          extractLabeledValue([
            "Department Code",
            "Department ID",
          ]);

        const extractedDocumentType =
          extractLabeledValue([
            "Document Type",
            "Document Type Name",
          ]);

        const normalizedValue = (
          value: unknown
        ): string => {
          if (
            value === null ||
            value === undefined
          ) {
            return "";
          }

          return String(value)
            .trim()
            .toLowerCase();
        };

        const normalizedDate = (
          value: unknown
        ): string => {
          if (
            value === null ||
            value === undefined
          ) {
            return "";
          }

          if (value instanceof Date) {
            if (Number.isNaN(value.getTime())) {
              return "";
            }

            return value
              .toISOString()
              .slice(0, 10);
          }

          return String(value)
            .trim()
            .slice(0, 10)
            .toLowerCase();
        };
        const appraisalConflicts: Array<{
          field: string;
          existingValue: string | null;
          extractedValue: string | null;
        }> = [];

        const mergeAppraisalField = (
          field: string,
          existingValue: unknown,
          extractedValue: unknown,
          normalize: (
            value: unknown
          ) => string = normalizedValue
        ) => {
          const existing =
            existingValue === null ||
            existingValue === undefined ||
            String(existingValue).trim() === ""
              ? null
              : String(existingValue);

          const extractedValuePresent =
            extractedValue !== null &&
            extractedValue !== undefined &&
            String(extractedValue).trim() !== "";

          if (
            existing &&
            extractedValuePresent &&
            normalize(existing) !==
              normalize(extractedValue)
          ) {
            appraisalConflicts.push({
              field,
              existingValue: existing,
              extractedValue:
                String(extractedValue),
            });
          }

          if (existing) {
            return existing;
          }

          if (extractedValuePresent) {
            return String(extractedValue);
          }

          return null;
        };

        const existingDepartmentId =
          existingAppraisalMetadata
            ?.department_id ??
          null;

        const existingDocumentTypeId =
          existingAppraisalMetadata
            ?.document_type_id ??
          null;

        let extractedDepartmentId:
          | number
          | null = null;

        let extractedDepartmentName:
          | string
          | null = null;

        let extractedDepartmentCodeValue:
          | string
          | null = null;

        if (
          extractedDepartmentCode ||
          extractedDepartment
        ) {
          const departmentLookup =
            await client.query(
              `
                SELECT
                  id,
                  name,
                  code
                FROM departments
                WHERE
                  (
                    (
                      $1::text IS NOT NULL
                      AND LOWER(code) =
                          LOWER($1::text)
                    )
                    OR
                    (
                      $2::text IS NOT NULL
                      AND LOWER(name) =
                          LOWER($2::text)
                    )
                  )
                  AND organization_id = $3::bigint
                LIMIT 1
              `,
              [
                extractedDepartmentCode,
                extractedDepartment,
                organizationId,
              ]
            );

          if (departmentLookup.rows[0]) {
            extractedDepartmentId =
              Number(
                departmentLookup.rows[0].id
              );

            extractedDepartmentName =
              departmentLookup.rows[0].name;

            extractedDepartmentCodeValue =
              departmentLookup.rows[0].code;
          }
        }

        let extractedDocumentTypeId:
          | number
          | null = null;

        let extractedDocumentTypeName:
          | string
          | null = null;

        if (extractedDocumentType) {
          const documentTypeLookup =
            await client.query(
              `
                SELECT
                  id,
                  name
                FROM document_types
                WHERE LOWER(name) =
                      LOWER($1)
                  AND organization_id = $2
                LIMIT 1
              `,
              [
                extractedDocumentType,
                organizationId,
              ]
            );

          if (documentTypeLookup.rows[0]) {
            extractedDocumentTypeId =
              Number(
                documentTypeLookup.rows[0].id
              );

            extractedDocumentTypeName =
              documentTypeLookup.rows[0].name;
          }
        }

        const existingDepartmentName =
          existingAppraisalMetadata
            ?.department_name ??
          null;

        const existingDepartmentCode =
          existingAppraisalMetadata
            ?.department_code ??
          null;

        const existingDocumentTypeName =
          existingAppraisalMetadata
            ?.document_type_name ??
          null;

        const selectedDepartmentId =
          existingDepartmentId ??
          extractedDepartmentId;

        const selectedDocumentTypeId =
          existingDocumentTypeId ??
          extractedDocumentTypeId;

        if (
          (
            existingDepartmentName ||
            existingDepartmentCode
          ) &&
          (
            extractedDepartmentName ||
            extractedDepartmentCodeValue
          )
        ) {
          const existingDepartmentComparison =
            normalizedValue(
              existingDepartmentCode ||
                existingDepartmentName
            );

          const extractedDepartmentComparison =
            normalizedValue(
              extractedDepartmentCodeValue ||
                extractedDepartmentName
            );

          if (
            existingDepartmentComparison !==
            extractedDepartmentComparison
          ) {
            appraisalConflicts.push({
              field: "Department",
              existingValue:
                existingDepartmentName ??
                existingDepartmentCode ??
                null,
              extractedValue:
                extractedDepartmentName ??
                extractedDepartmentCodeValue ??
                null,
            });
          }
        }

        if (
          existingDocumentTypeName &&
          extractedDocumentTypeName &&
          normalizedValue(
            existingDocumentTypeName
          ) !==
            normalizedValue(
              extractedDocumentTypeName
            )
        ) {
          appraisalConflicts.push({
            field: "Document Type",
            existingValue:
              existingDocumentTypeName,
            extractedValue:
              extractedDocumentTypeName,
          });
        }

        const mergedAppraisalMetadata = {
          id:
            existingAppraisalMetadata?.id ??
            bestMatch.metadataRecordId ??
            null,

          reference_code:
            existingAppraisalMetadata?.reference_code ??
            (
              bestMatch.metadataRecordId === null
                ? await generateMetadataReferenceCode(
                    client
                  )
                : mergeAppraisalField(
                    "Reference Code",
                    existingAppraisalMetadata
                      ?.reference_code,
                    extracted.referenceCode
                  )
            ),

          title:
            mergeAppraisalField(
              "Title",
              existingAppraisalMetadata?.title,
              extracted.title
            ),

          document_date:
            mergeAppraisalField(
              "Document Date",
              existingAppraisalMetadata
                ?.document_date
                ? String(
                    existingAppraisalMetadata
                      .document_date
                  ).slice(0, 10)
                : null,
              extracted.date,
              normalizedDate
            ),

          year:
            existingAppraisalMetadata?.year ??
            extracted.year ??
            null,

          person_name:
            mergeAppraisalField(
              "Person Name",
              existingAppraisalMetadata
                ?.person_name,
              extracted.personName
            ),

          department_id:
            selectedDepartmentId,

          department_name:
            existingDepartmentName ??
            extractedDepartmentName ??
            null,

          department_code:
            existingDepartmentCode ??
            extractedDepartmentCodeValue ??
            null,

          document_type_id:
            selectedDocumentTypeId,

          document_type_name:
            existingDocumentTypeName ??
            extractedDocumentTypeName ??
            null,

          section:
            mergeAppraisalField(
              "Section",
              existingAppraisalMetadata?.section,
              extractedSection
            ),

          description:
            mergeAppraisalField(
              "Description",
              existingAppraisalMetadata
                ?.description,
              extractedDescription
            ),
        };
        return res.status(201).json({
          success: true,
          message:
            "Document uploaded and appraised successfully",

          document: {
            ...document,
            status:
              documentStatus,
            title:
              extracted.title,
            document_date:
              extracted.date,
            year:
              extracted.year,
            person_name:
              extracted.personName,
            upload_number:
              uploadNumber,
          },

          extraction,

          appraisal: {
            matchType:
              bestMatch.matchType,
            confidence:
              bestMatch.confidence,
            metadataRecordId:
              bestMatch.metadataRecordId,
            matchingFields:
              bestMatch.matchingFields,
            conflictingFields:
              bestMatch.conflictingFields,

            extractedDateText:
              extracted.extractedDateText,
            decision,

            metadata:
              mergedAppraisalMetadata,

            metadataConflicts:
              appraisalConflicts,

            match:
              matchRow,
          },
        });
      } catch (error) {
        await client.query(
          "ROLLBACK"
        );

        if (
          targetPath &&
          fs.existsSync(
            targetPath
          )
        ) {
          await fs.promises.unlink(
            targetPath
          );
        }

        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error(
        "Document upload/appraisal failed:",
        error
      );

      if (
        fs.existsSync(
          temporaryPath
        )
      ) {
        await fs.promises
          .unlink(
            temporaryPath
          )
          .catch(
            () => undefined
          );
      }

      res.status(500).json({
        success: false,
        error:
          "Unable to upload and appraise document",
        details:
          process.env.NODE_ENV ===
            "development" &&
          error instanceof Error
            ? error.message
            : undefined,
      });
    }
  }
);


  return router;
}



