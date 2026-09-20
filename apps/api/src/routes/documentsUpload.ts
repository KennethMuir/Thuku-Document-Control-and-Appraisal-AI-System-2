import {
  Router,
  type Request,
  type Response,
} from "express";

import type { Pool } from "pg";
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";

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

type ProvisionalUpload = {
  token: string;
  organizationId: number;
  ownerUserId: number;
  temporaryPath: string;
  originalName: string;
  extension: string;
  mimeType: string | null;
  fileSize: number;
  extracted: {
    text: string;
    title: string | null;
    date: string | null;
    extractedDateText: string | null;
    year: number | null;
    personName: string | null;
    referenceCode?: string | null;
  };
  bestMatch: {
    matchType: "STRONG_MATCH" | "PARTIAL_MATCH" | "NO_MATCH";
    confidence: number;
    metadataRecordId: number | null;
    matchingFields: string[];
    conflictingFields: string[];
  };
  createdAt: string;
};

function provisionalStatePath(
  temporaryPath: string
): string {
  return `${temporaryPath}.json`;
}

async function writeProvisionalUpload(
  upload: ProvisionalUpload
): Promise<void> {
  await fs.promises.writeFile(
    provisionalStatePath(upload.temporaryPath),
    JSON.stringify(upload),
    "utf8"
  );
}

async function readProvisionalUpload(
  temporaryPath: string
): Promise<ProvisionalUpload> {
  const raw = await fs.promises.readFile(
    provisionalStatePath(temporaryPath),
    "utf8"
  );

  return JSON.parse(raw) as ProvisionalUpload;
}

async function deleteProvisionalUpload(
  upload: ProvisionalUpload
): Promise<void> {
  await fs.promises.unlink(
    upload.temporaryPath
  ).catch(() => undefined);

  await fs.promises.unlink(
    provisionalStatePath(upload.temporaryPath)
  ).catch(() => undefined);
}

function parseToken(
  value: unknown
): string {
  if (
    typeof value !== "string" ||
    !/^[a-f0-9-]{36}$/i.test(value)
  ) {
    throw new Error("Invalid upload token.");
  }

  return value;
}

function normalizeMetadataPayload(
  payload: any
) {
  return {
    referenceCode:
      typeof payload?.referenceCode === "string"
        ? payload.referenceCode.trim()
        : null,

    personName:
      typeof payload?.personName === "string"
        ? payload.personName.trim()
        : null,

    title:
      typeof payload?.title === "string"
        ? payload.title.trim()
        : null,

    departmentId:
      payload?.departmentId
        ? Number(payload.departmentId)
        : null,

    documentTypeId:
      payload?.documentTypeId
        ? Number(payload.documentTypeId)
        : null,

    year:
      payload?.year
        ? Number(payload.year)
        : null,

    documentDate:
      typeof payload?.documentDate === "string" &&
      payload.documentDate.trim()
        ? payload.documentDate.trim()
        : null,

    section:
      typeof payload?.section === "string"
        ? payload.section.trim()
        : null,

    description:
      typeof payload?.description === "string"
        ? payload.description.trim()
        : null,

    additionalMetadata:
      payload?.additionalMetadata &&
      typeof payload.additionalMetadata === "object"
        ? payload.additionalMetadata
        : {},
  };
}

function validateRequiredMetadata(
  metadata: ReturnType<typeof normalizeMetadataPayload>
): string | null {
  const required: Array<
    [string, unknown]
  > = [
    ["Reference Code", metadata.referenceCode],
    ["Title", metadata.title],
    ["Document Date", metadata.documentDate],
    ["Year", metadata.year],
    ["Person Name", metadata.personName],
    ["Department", metadata.departmentId],
    ["Document Type", metadata.documentTypeId],
    ["Section", metadata.section],
    ["Description", metadata.description],
  ];

  const missing = required
    .filter(
      ([, value]) =>
        value === null ||
        value === undefined ||
        String(value).trim() === ""
    )
    .map(([label]) => label);

  return missing.length
    ? `Please complete: ${missing.join(", ")}.`
    : null;
}

export function createDocumentsUploadRouter(
  pool: Pool,
  upload: multer.Multer,
  localFileStorage: LocalFileStorage,
  findBestMetadataMatch: Function,
  temporaryRoot: string
) {
  const router = Router();

  /*
   * STEP 1:
   * Upload and process provisionally.
   *
   * Nothing is inserted into the permanent document,
   * document_files, document_extractions or
   * document_matches tables here.
   */
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
          error: "A document file is required",
        });
      }

      const temporaryPath =
        req.file.path;

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
          error: "Authentication required",
        });
      }

      if (
        typeof organizationId !== "number" ||
        !Number.isInteger(organizationId) ||
        organizationId <= 0
      ) {
        await fs.promises.unlink(
          temporaryPath
        ).catch(() => undefined);

        return res.status(403).json({
          success: false,
          error: "Organization context is required",
        });
      }

      try {
        const originalName =
          req.file.originalname;

        const extension =
          path.extname(originalName).toLowerCase();

        if (
          ![".pdf", ".docx"].includes(extension)
        ) {
          await fs.promises.unlink(
            temporaryPath
          ).catch(() => undefined);

          return res.status(400).json({
            success: false,
            error:
              "Only PDF and DOCX files are currently supported",
          });
        }

        const extracted =
          await extractDocumentContent(
            temporaryPath,
            extension,
            originalName
          );

        const client =
          await pool.connect();

        let bestMatch;

        try {
          bestMatch =
            await findBestMetadataMatch(
              client,
              extracted,
              organizationId
            );
        } finally {
          client.release();
        }

        const token =
          crypto.randomUUID();

        const provisional: ProvisionalUpload = {
          token,
          organizationId,
          ownerUserId: ownerUser.id,
          temporaryPath,
          originalName,
          extension,
          mimeType:
            req.file.mimetype || null,
          fileSize:
            req.file.size,
          extracted: {
            text:
              extracted.text ?? "",
            title:
              extracted.title ?? null,
            date:
              extracted.date ?? null,
            extractedDateText:
              extracted.extractedDateText ?? null,
            year:
              extracted.year ?? null,
            personName:
              extracted.personName ?? null,
            referenceCode:
              extracted.referenceCode ?? null,
          },
          bestMatch: {
            matchType:
              bestMatch.matchType,
            confidence:
              bestMatch.confidence,
            metadataRecordId:
              bestMatch.metadataRecordId,
            matchingFields:
              bestMatch.matchingFields ?? [],
            conflictingFields:
              bestMatch.conflictingFields ?? [],
          },
          createdAt:
            new Date().toISOString(),
        };

        await writeProvisionalUpload(
          provisional
        );

        let metadata: any = null;

        if (
          bestMatch.metadataRecordId
        ) {
          const metadataClient =
            await pool.connect();

          try {
            const result =
              await metadataClient.query(
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
                    mr.department_id,
                    dep.name AS department_name,
                    dep.code AS department_code,
                    mr.document_type_id,
                    dt.name AS document_type_name
                  FROM metadata_records mr
                  LEFT JOIN departments dep
                    ON dep.id = mr.department_id
                  LEFT JOIN document_types dt
                    ON dt.id = mr.document_type_id
                  WHERE mr.id = $1
                    AND mr.organization_id = $2
                  LIMIT 1
                `,
                [
                  bestMatch.metadataRecordId,
                  organizationId,
                ]
              );

            metadata =
              result.rows[0] ?? null;
          } finally {
            metadataClient.release();
          }
        }

        const extractedText =
          extracted.text ?? "";

        const extractLabeledValue = (
          labels: string[]
        ): string | null => {
          for (const label of labels) {
            const escapedLabel =
              label.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
              );

            const match =
              extractedText.match(
                new RegExp(
                  `(?:^|\\n)\\s*${escapedLabel}\\s*[:\\-]\\s*(.+)`,
                  "im"
                )
              );

            if (match?.[1]) {
              return match[1].trim();
            }
          }

          return null;
        };

        const extractedSection =
          extractLabeledValue(["Section"]);

        const extractedDescription =
          extractLabeledValue(["Description"]);

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

        let extractedDepartmentId:
          | number
          | null = null;

        let extractedDepartmentName:
          | string
          | null = null;

        let extractedDepartmentCodeValue:
          | string
          | null = null;

        let extractedDocumentTypeId:
          | number
          | null = null;

        let extractedDocumentTypeName:
          | string
          | null = null;

        const lookupClient =
          await pool.connect();

        try {
          if (
            extractedDepartment ||
            extractedDepartmentCode
          ) {
            const result =
              await lookupClient.query(
                `
                  SELECT id, name, code
                  FROM departments
                  WHERE (
                    (
                      $1::text IS NOT NULL
                      AND LOWER(code) = LOWER($1::text)
                    )
                    OR
                    (
                      $2::text IS NOT NULL
                      AND LOWER(name) = LOWER($2::text)
                    )
                  )
                  AND organization_id = $3
                  LIMIT 1
                `,
                [
                  extractedDepartmentCode,
                  extractedDepartment,
                  organizationId,
                ]
              );

            if (result.rows[0]) {
              extractedDepartmentId =
                Number(result.rows[0].id);

              extractedDepartmentName =
                result.rows[0].name;

              extractedDepartmentCodeValue =
                result.rows[0].code;
            }
          }

          if (extractedDocumentType) {
            const result =
              await lookupClient.query(
                `
                  SELECT id, name
                  FROM document_types
                  WHERE LOWER(name) = LOWER($1)
                    AND organization_id = $2
                  LIMIT 1
                `,
                [
                  extractedDocumentType,
                  organizationId,
                ]
              );

            if (result.rows[0]) {
              extractedDocumentTypeId =
                Number(result.rows[0].id);

              extractedDocumentTypeName =
                result.rows[0].name;
            }
          }
        } finally {
          lookupClient.release();
        }

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

        const mergedAppraisalMetadata = {
          id:
            metadata?.id ??
            bestMatch.metadataRecordId ??
            null,

          reference_code:
            metadata?.reference_code ??
            extracted.referenceCode ??
            null,

          title:
            mergeAppraisalField(
              "Title",
              metadata?.title,
              extracted.title
            ),

          document_date:
            mergeAppraisalField(
              "Document Date",
              metadata?.document_date,
              extracted.date,
              normalizedDate
            ),

          year:
            metadata?.year ??
            extracted.year ??
            null,

          person_name:
            mergeAppraisalField(
              "Person Name",
              metadata?.person_name,
              extracted.personName
            ),

          department_id:
            metadata?.department_id ??
            extractedDepartmentId ??
            null,

          department_name:
            metadata?.department_name ??
            extractedDepartmentName ??
            null,

          department_code:
            metadata?.department_code ??
            extractedDepartmentCodeValue ??
            null,

          document_type_id:
            metadata?.document_type_id ??
            extractedDocumentTypeId ??
            null,

          document_type_name:
            metadata?.document_type_name ??
            extractedDocumentTypeName ??
            null,

          section:
            mergeAppraisalField(
              "Section",
              metadata?.section,
              extractedSection
            ),

          description:
            mergeAppraisalField(
              "Description",
              metadata?.description,
              extractedDescription
            ),
        };

        return res.status(201).json({
          success: true,
          message:
            "Document processed and ready for review",
          uploadToken: token,
          document: {
            filename: originalName,
            file_type:
              extension
                .replace(".", "")
                .toUpperCase(),
            file_size:
              req.file.size,
            status: "PENDING_UPLOAD",
          },
          extraction: {
            extracted_text:
              extracted.text ?? "",
            extracted_title:
              extracted.title ?? null,
            extracted_date:
              extracted.date ?? null,
            extracted_date_text:
              extracted.extractedDateText ?? null,
            extracted_year:
              extracted.year ?? null,
            extracted_person_name:
              extracted.personName ?? null,
            extraction_status:
              "COMPLETED",
          },
          appraisal: {
            matchType:
              bestMatch.matchType,
            confidence:
              bestMatch.confidence,
            metadataRecordId:
              bestMatch.metadataRecordId,
            matchingFields:
              bestMatch.matchingFields ?? [],
            conflictingFields:
              bestMatch.conflictingFields ?? [],
            extractedDateText:
              extracted.extractedDateText ?? null,
            decision: "PENDING",
            metadata:
              mergedAppraisalMetadata,
            metadataConflicts:
              appraisalConflicts,
            match: null,
          },
        });
      } catch (error) {
        console.error(
          "Provisional document upload failed:",
          error
        );

        await fs.promises.unlink(
          temporaryPath
        ).catch(() => undefined);

        await fs.promises.unlink(
          provisionalStatePath(temporaryPath)
        ).catch(() => undefined);

        return res.status(500).json({
          success: false,
          error:
            "Unable to process document for review",
          details:
            process.env.NODE_ENV === "development" &&
            error instanceof Error
              ? error.message
              : undefined,
        });
      }
    }
  );

  /*
   * STEP 2:
   * Confirm the upload.
   *
   * This is the ONLY point where permanent document
   * registration, DOC number generation, metadata
   * creation and LINKED status occur.
   */
  router.post(
    "/confirm",
    requireAuthentication(pool),
    requireOrganizationContext(pool),
    requireRole("ADMIN", "APPRAISER"),
    async (
      req: Request,
      res: Response
    ) => {
      const authenticatedRequest =
        req as AuthenticatedRequest;

      const ownerUser =
        authenticatedRequest.authUser;

      const organizationId =
        authenticatedRequest.authOrganization
          ?.organizationId;

      if (
        !ownerUser ||
        typeof organizationId !== "number"
      ) {
        return res.status(403).json({
          success: false,
          error:
            "Authentication and organization context are required",
        });
      }

      const token =
        req.body?.uploadToken;

      const metadataPayload =
        normalizeMetadataPayload(
          req.body?.metadata
        );

      const requestedMetadataRecordId =
        req.body?.metadataRecordId
          ? Number(req.body.metadataRecordId)
          : null;

      try {
        parseToken(token);
      } catch {
        return res.status(400).json({
          success: false,
          error: "A valid upload token is required",
        });
      }

      const searchDirectories = [
        path.resolve(temporaryRoot),
      ];

      let provisional:
        | ProvisionalUpload
        | null = null;

      /*
       * The token itself does not reveal a path.
       * Locate its state file inside the configured
       * upload directory.
       */
      for (
        const directory of searchDirectories
      ) {
        let entries: string[] = [];

        try {
          entries =
            await fs.promises.readdir(
              directory
            );
        } catch {
          continue;
        }

        for (
          const entry of entries
        ) {
          if (!entry.endsWith(".json")) {
            continue;
          }

          try {
            const candidate =
              await readProvisionalUpload(
                path.join(
                  directory,
                  entry.replace(/\.json$/, "")
                )
              );

            if (
              candidate.token === token &&
              candidate.organizationId === organizationId &&
              candidate.ownerUserId === ownerUser.id
            ) {
              provisional = candidate;
              break;
            }
          } catch {
            continue;
          }
        }

        if (provisional) {
          break;
        }
      }
      if (!provisional) {
        return res.status(404).json({
          success: false,
          error:
            "The provisional upload could not be found or has expired",
        });
      }

      if (
        !fs.existsSync(
          provisional.temporaryPath
        )
      ) {
        await deleteProvisionalUpload(
          provisional
        );

        return res.status(400).json({
          success: false,
          error:
            "The uploaded file is no longer available. Please upload it again.",
        });
      }

      const client =
        await pool.connect();

      let targetPath:
        | string
        | null = null;

      try {
        await client.query("BEGIN");

        let metadataRecordId =
          requestedMetadataRecordId;

        if (metadataRecordId) {
          const metadataResult =
            await client.query(
              `
                SELECT *
                FROM metadata_records
                WHERE id = $1
                  AND organization_id = $2
                FOR UPDATE
              `,
              [
                metadataRecordId,
                organizationId,
              ]
            );

          if (!metadataResult.rows[0]) {
            throw new Error(
              "The selected metadata record was not found."
            );
          }

          const metadata =
            metadataResult.rows[0];

          if (
            metadataPayload.departmentId !== null
          ) {
            const department =
              await client.query(
                `
                  SELECT id
                  FROM departments
                  WHERE id = $1
                    AND organization_id = $2
                `,
                [
                  metadataPayload.departmentId,
                  organizationId,
                ]
              );

            if (!department.rows[0]) {
              throw new Error(
                "The selected department is invalid."
              );
            }
          }

          if (
            metadataPayload.documentTypeId !== null
          ) {
            const documentType =
              await client.query(
                `
                  SELECT id
                  FROM document_types
                  WHERE id = $1
                    AND organization_id = $2
                `,
                [
                  metadataPayload.documentTypeId,
                  organizationId,
                ]
              );

            if (!documentType.rows[0]) {
              throw new Error(
                "The selected document type is invalid."
              );
            }
          }

          await client.query(
            `
              UPDATE metadata_records
              SET
                reference_code =
                  COALESCE($1, reference_code),
                title =
                  COALESCE($2, title),
                person_name =
                  COALESCE($3, person_name),
                department_id =
                  COALESCE($4, department_id),
                document_type_id =
                  COALESCE($5, document_type_id),
                section =
                  COALESCE($6, section),
                year =
                  COALESCE($7, year),
                document_date =
                  COALESCE($8, document_date),
                description =
                  COALESCE($9, description),
                status = 'DOCUMENT_LINKED',
                updated_at = NOW()
              WHERE id = $10
                AND organization_id = $11
            `,
            [
              metadataPayload.referenceCode,
              metadataPayload.title,
              metadataPayload.personName,
              metadataPayload.departmentId,
              metadataPayload.documentTypeId,
              metadataPayload.section,
              metadataPayload.year,
              metadataPayload.documentDate,
              metadataPayload.description,
              metadataRecordId,
              organizationId,
            ]
          );
        } else {
          const validationError =
            validateRequiredMetadata(
              metadataPayload
            );

          if (validationError) {
            throw new Error(validationError);
          }

          const duplicate =
            await client.query(
              `
                SELECT id
                FROM metadata_records
                WHERE organization_id = $1
                  AND reference_code = $2
                LIMIT 1
              `,
              [
                organizationId,
                metadataPayload.referenceCode,
              ]
            );

          if (duplicate.rows[0]) {
            throw new Error(
              "That metadata reference code already exists."
            );
          }

          const inserted =
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
                  $10,
                  'DOCUMENT_LINKED',
                  $11
                )
                RETURNING *
              `,
              [
                metadataPayload.referenceCode,
                metadataPayload.title,
                metadataPayload.personName,
                metadataPayload.departmentId,
                metadataPayload.documentTypeId,
                metadataPayload.section,
                metadataPayload.year,
                metadataPayload.documentDate,
                metadataPayload.description,
                JSON.stringify(
                  metadataPayload.additionalMetadata
                ),
                organizationId,
              ]
            );

          metadataRecordId =
            Number(inserted.rows[0].id);
        }

        const codeResult =
          await client.query(`
            SELECT nextval(
              'document_upload_number_seq'
            ) AS upload_number
          `);

        const uploadNumber =
          Number(
            codeResult.rows[0].upload_number
          );

        if (
          !Number.isInteger(uploadNumber) ||
          uploadNumber <= 0
        ) {
          throw new Error(
            "The document upload number sequence returned an invalid value."
          );
        }

        const documentCode =
          `DOC-${uploadNumber}`;

        const storedFilename =
          `${documentCode}${provisional.extension}`;

        const storedDocument =
          await localFileStorage.store(
            provisional.temporaryPath,
            storedFilename
          );

        targetPath =
          storedDocument.localPath;

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
                metadata_record_id,
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
                'LINKED',
                $10,
                $11,
                $12
              )
              RETURNING *
            `,
            [
              documentCode,
              uploadNumber,
              provisional.originalName,
              metadataPayload.title ||
                provisional.extracted.title ||
                null,
              metadataPayload.documentDate ||
                provisional.extracted.date ||
                null,
              metadataPayload.year ||
                provisional.extracted.year ||
                null,
              metadataPayload.personName ||
                provisional.extracted.personName ||
                null,
              provisional.extension
                .replace(".", "")
                .toUpperCase(),
              provisional.fileSize,
              metadataRecordId,
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
            UPDATE metadata_records
            SET
              status = 'DOCUMENT_LINKED',
              updated_at = NOW()
            WHERE id = $1
              AND organization_id = $2
          `,
          [
            metadataRecordId,
            organizationId,
          ]
        );

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
            provisional.originalName,
            storedFilename,
            targetPath,
            storedDocument.provider,
            storedDocument.reference,
            provisional.mimeType,
            provisional.fileSize,
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
                'COMPLETED'
              )
              RETURNING *
            `,
            [
              documentId,
              provisional.extracted.text,
              provisional.extracted.title,
              provisional.extracted.date,
              provisional.extracted.extractedDateText,
              provisional.extracted.year,
              provisional.extracted.personName,
            ]
          );

        const extraction =
          extractionResult.rows[0];

        const latestMatch =
          provisional.bestMatch;

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
                'LINKED'
              )
              RETURNING *
            `,
            [
              documentId,
              metadataRecordId,
              latestMatch.matchType,
              latestMatch.confidence,
              latestMatch.matchingFields.join(", ") ||
                null,
              latestMatch.conflictingFields.join(", ") ||
                null,
            ]
          );

        await createAuditLog(
          client,
          organizationId,
          ownerUser.id,
          documentId,
          metadataRecordId,
          "DOCUMENT_LINKED",
          JSON.stringify({
            documentCode,
            uploadNumber,
            matchType:
              latestMatch.matchType,
            confidence:
              latestMatch.confidence,
            matchingFields:
              latestMatch.matchingFields,
            conflictingFields:
              latestMatch.conflictingFields,
            decision: "LINKED",
          })
        );

        await client.query("COMMIT");

        await fs.promises.unlink(
          provisionalStatePath(
            provisional.temporaryPath
          )
        ).catch(() => undefined);

        return res.status(201).json({
          success: true,
          message:
            "Document registered and linked successfully",
          document,
          extraction,
          appraisal: {
            matchType:
              latestMatch.matchType,
            confidence:
              latestMatch.confidence,
            metadataRecordId,
            matchingFields:
              latestMatch.matchingFields,
            conflictingFields:
              latestMatch.conflictingFields,
            decision: "LINKED",
            metadata:
              metadataPayload,
            match:
              matchInsert.rows[0],
          },
        });
      } catch (error) {
        await client.query("ROLLBACK");

        if (
          targetPath &&
          fs.existsSync(targetPath)
        ) {
          await fs.promises.rename(
            targetPath,
            provisional.temporaryPath
          ).catch((restoreError) => {
            console.error(
              "Unable to restore provisional upload after confirmation failure:",
              restoreError
            );
          });

          targetPath = null;
        }
        console.error(
          "Document confirmation failed:",
          error
        );

        return res.status(500).json({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Unable to register document",
        });
      } finally {
        client.release();
      }
    }
  );

  /*
   * STEP 3:
   * Cancel/discard the provisional upload.
   *
   * No permanent document or metadata is created.
   */
  router.delete(
    "/:uploadToken",
    requireAuthentication(pool),
    requireOrganizationContext(pool),
    requireRole("ADMIN", "APPRAISER"),
    async (
      req: Request,
      res: Response
    ) => {
      const authenticatedRequest =
        req as AuthenticatedRequest;

      const ownerUser =
        authenticatedRequest.authUser;

      const organizationId =
        authenticatedRequest.authOrganization
          ?.organizationId;

      if (
        !ownerUser ||
        typeof organizationId !== "number"
      ) {
        return res.status(403).json({
          success: false,
          error:
            "Authentication and organization context are required",
        });
      }

      const token =
        req.params.uploadToken;

      if (
        typeof token !== "string" ||
        !/^[a-f0-9-]{36}$/i.test(token)
      ) {
        return res.status(400).json({
          success: false,
          error:
            "A valid upload token is required",
        });
      }

      const directories = [
        path.resolve(temporaryRoot),
      ];

      let provisional:
        | ProvisionalUpload
        | null = null;

      for (
        const directory of directories
      ) {
        let entries: string[] = [];

        try {
          entries =
            await fs.promises.readdir(
              directory
            );
        } catch {
          continue;
        }

        for (
          const entry of entries
        ) {
          if (!entry.endsWith(".json")) {
            continue;
          }

          try {
            const candidate =
              await readProvisionalUpload(
                path.join(
                  directory,
                  entry.replace(/\.json$/, "")
                )
              );

            if (
              candidate.token === token &&
              candidate.organizationId === organizationId &&
              candidate.ownerUserId === ownerUser.id
            ) {
              provisional = candidate;
              break;
            }
          } catch {
            continue;
          }
        }

        if (provisional) {
          break;
        }
      }

      if (!provisional) {
        return res.status(404).json({
          success: false,
          error:
            "The provisional upload could not be found",
        });
      }

      await deleteProvisionalUpload(
        provisional
      );

      return res.status(200).json({
        success: true,
        message:
          "Provisional upload cancelled",
      });
    }
  );
  return router;
}


