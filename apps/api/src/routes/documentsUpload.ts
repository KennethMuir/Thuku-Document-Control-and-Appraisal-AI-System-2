import { Router } from "express";
import type { Request, Response } from "express";
import { Pool } from "pg";
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { writeAtomicTextFile } from "../services/atomicFileWrite.js";
import {
  recoverProvisionalUpload,
} from "../services/provisionalUploadRecovery.js";

import {
  requireAuthentication,
  requireOrganizationContext,
  requireRole,
} from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import {
  extractDocumentContent,
} from "../services/documentExtraction.js";
import {
  createAuditLog,
} from "../services/audit.js";
import {
  generateMetadataReferenceCode,
} from "../services/metadataReferenceCode.js";
import type {
  FileStorageService,
  StoredDocument,
} from "../services/storage.js";
import { calculateSha256 } from "../services/fileIntegrity.js";

type ProvisionalUpload = {
  token: string;
  organizationId: number;
  ownerUserId: number;
  temporaryPath: string;
  originalName: string;
  extension: string;
  mimeType: string | null;
  fileSize: number;
  sha256Hash: string;
  duplicate?: {
    existingDocumentId: number;
    existingDocumentCode: string;
    existingFilename: string;
  } | null;
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
    matchType:
      | "STRONG_MATCH"
      | "PARTIAL_MATCH"
      | "NO_MATCH";
    confidence: number;
    metadataRecordId: number | null;
    matchingFields: string[];
    conflictingFields: string[];
  };
  createdAt: string;
  recoveryReference?: string;
  recoveryProvider?: "LOCAL" | "SERVER" | "CLOUD";
  recoveryFilename?: string;
  recoveryStatus?: "RECOVERY_PENDING";
};

function provisionalStatePath(
  temporaryPath: string
): string {
  return `${temporaryPath}.json`;
}

async function writeProvisionalUpload(
  upload: ProvisionalUpload
): Promise<void> {
  await writeAtomicTextFile(
    provisionalStatePath(upload.temporaryPath),
    JSON.stringify(upload)
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
  await fs.promises
    .unlink(upload.temporaryPath)
    .catch(() => undefined);

  await fs.promises
    .unlink(
      provisionalStatePath(upload.temporaryPath)
    )
    .catch(() => undefined);
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
    /*
     * This value may still arrive from extracted metadata
     * or legacy frontend state and may be useful for
     * matching/display purposes.
     *
     * It is NOT used to create a new metadata reference.
     */
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
  metadata: ReturnType<
    typeof normalizeMetadataPayload
  >
): string | null {
  const required: Array<
    [string, unknown]
  > = [
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
  localFileStorage: FileStorageService,
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

      const sha256Hash =
        await calculateSha256(temporaryPath);
      const authenticatedRequest =
        req as AuthenticatedRequest;

      const ownerUser =
        authenticatedRequest.authUser;

      const organizationId =
        authenticatedRequest.authOrganization
          ?.organizationId;

      if (!ownerUser) {
        await fs.promises
          .unlink(temporaryPath)
          .catch(() => undefined);

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
        await fs.promises
          .unlink(temporaryPath)
          .catch(() => undefined);

        return res.status(403).json({
          success: false,
          error:
            "Organization context is required",
        });
      }

      try {
        const originalName =
          req.file.originalname;

        const extension =
          path
            .extname(originalName)
            .toLowerCase();

        if (
          ![".pdf", ".docx"].includes(extension)
        ) {
          await fs.promises
            .unlink(temporaryPath)
            .catch(() => undefined);

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

        let duplicate: ProvisionalUpload["duplicate"] = null;

        const duplicateResult =
          await client.query<{
            document_id: number;
            document_code: string;
            filename: string;
          }>(
            `
              SELECT
                d.id AS document_id,
                d.document_code,
                d.filename
              FROM document_files df
              INNER JOIN documents d
                ON d.id = df.document_id
              WHERE df.sha256_hash = $1
                AND d.organization_id = $2
              ORDER BY d.id ASC
              LIMIT 1
            `,
            [
              sha256Hash,
              organizationId,
            ]
          );

        if (duplicateResult.rows[0]) {
          duplicate = {
            existingDocumentId:
              duplicateResult.rows[0].document_id,
            existingDocumentCode:
              duplicateResult.rows[0].document_code,
            existingFilename:
              duplicateResult.rows[0].filename,
          };
        }

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
          sha256Hash,
          duplicate,
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

          /*
           * Existing metadata keeps its existing
           * reference code.
           *
           * A newly created metadata reference is
           * generated only during confirmation.
           */
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
            duplicate: duplicate
              ? {
                  isDuplicate: true,
                  existingDocumentId:
                    duplicate.existingDocumentId,
                  existingDocumentCode:
                    duplicate.existingDocumentCode,
                  existingFilename:
                    duplicate.existingFilename,
                }
              : {
                  isDuplicate: false,
                  existingDocumentId: null,
                  existingDocumentCode: null,
                  existingFilename: null,
                },
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

        await fs.promises
          .unlink(temporaryPath)
          .catch(() => undefined);

        await fs.promises
          .unlink(
            provisionalStatePath(
              temporaryPath
            )
          )
          .catch(() => undefined);

        return res.status(500).json({
          success: false,
          error:
            "Unable to process document for review",
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

      const duplicateDecision =
        req.body?.duplicateDecision === "SAVE_AS_NEW"
          ? "SAVE_AS_NEW"
          : null;

    const requestedMetadataRecordId =
        req.body?.metadataRecordId
          ? Number(
              req.body.metadataRecordId
            )
          : null;

      try {
        parseToken(token);
      } catch {
        return res.status(400).json({
          success: false,
          error:
            "A valid upload token is required",
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
                  entry.replace(
                    /\.json$/,
                    ""
                  )
                )
              );

            if (
              candidate.token === token &&
              candidate.organizationId ===
                organizationId &&
              candidate.ownerUserId ===
                ownerUser.id
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

      if (provisional.recoveryStatus === "RECOVERY_PENDING") {
        const recoveryResult = await recoverProvisionalUpload(
          provisional,
          {
            storage: localFileStorage,
            persist: writeProvisionalUpload,
          }
        );

        if (recoveryResult.status === "HASH_MISMATCH") {
          return res.status(409).json({
            success: false,
            error: "UPLOAD_RECOVERY_HASH_MISMATCH",
            message:
              "The recovered file does not match the original upload. The recovery state and stored recovery copy have been preserved.",
          });
        }

        if (recoveryResult.status === "STATE_WRITE_FAILED") {
          console.error(
            "Provisional upload recovery state could not be persisted; stored recovery data has been preserved:",
            recoveryResult.error
          );
        }

        if (
          recoveryResult.status === "RECOVERY_PENDING" ||
          recoveryResult.status === "STATE_WRITE_FAILED"
        ) {
          return res.status(409).json({
            success: false,
            error: "UPLOAD_RECOVERY_PENDING",
            message:
              "Upload recovery could not be completed safely. The recovery state has been preserved.",
          });
        }
      }

      if (
        !fs.existsSync(provisional.temporaryPath) &&
        provisional.recoveryStatus !== "RECOVERY_PENDING"
      ) {
        await deleteProvisionalUpload(provisional);

        return res.status(400).json({
          success: false,
          error:
            "The uploaded file is no longer available. Please upload it again.",
        });
      }

      const client = await pool.connect();
      let storedReference: string | null = null;
      let storedDocument: StoredDocument | null = null;
      let storedFilename: string | null = null;

      try {
        await client.query("BEGIN");

        let duplicateDocumentCode: string | null = null;
        let duplicateBaseCode: string | null = null;

        const duplicateLockResult =
          await client.query<{
            document_id: number;
            document_code: string;
            filename: string;
          }>(
            `
              SELECT
                d.id AS document_id,
                d.document_code,
                d.filename
              FROM document_files df
              INNER JOIN documents d
                ON d.id = df.document_id
              WHERE df.sha256_hash = $1
                AND d.organization_id = $2
              ORDER BY d.id ASC
              LIMIT 1
              FOR UPDATE OF d
            `,
            [
              provisional.sha256Hash,
              organizationId,
            ]
          );

        const existingDuplicate =
          duplicateLockResult.rows[0] ?? null;

        if (existingDuplicate) {
          if (duplicateDecision !== "SAVE_AS_NEW") {
            const duplicateError = new Error(
              "This file is already registered and requires explicit duplicate approval."
            );

            (
              duplicateError as Error & {
                code?: string;
                duplicate?: {
                  existingDocumentId: number;
                  existingDocumentCode: string;
                  existingFilename: string;
                };
              }
            ).code = "DUPLICATE_REQUIRES_APPROVAL";

            (
              duplicateError as Error & {
                duplicate?: {
                  existingDocumentId: number;
                  existingDocumentCode: string;
                  existingFilename: string;
                };
              }
            ).duplicate = {
              existingDocumentId:
                Number(existingDuplicate.document_id),
              existingDocumentCode:
                existingDuplicate.document_code,
              existingFilename:
                existingDuplicate.filename,
            };

            throw duplicateError;
          }

          duplicateDocumentCode =
            existingDuplicate.document_code;

          const suffixMatch =
            existingDuplicate.document_code.match(
              /^(.*) \((\d+)\)$/
            );

          duplicateBaseCode =
            suffixMatch?.[1] ??
            existingDuplicate.document_code;
        }

        let metadataRecordId =
          requestedMetadataRecordId;

        /*
         * EXISTING METADATA
         *
         * Preserve the existing metadata reference
         * code. The document gets a new DOC-X number,
         * but the metadata reference is never replaced.
         */
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
            metadataPayload.departmentId !==
            null
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
            metadataPayload.documentTypeId !==
            null
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
                title =
                  COALESCE($1, title),
                person_name =
                  COALESCE($2, person_name),
                department_id =
                  COALESCE($3, department_id),
                document_type_id =
                  COALESCE($4, document_type_id),
                section =
                  COALESCE($5, section),
                year =
                  COALESCE($6, year),
                document_date =
                  COALESCE($7, document_date),
                description =
                  COALESCE($8, description),
                status = 'DOCUMENT_LINKED',
                updated_at = NOW()
              WHERE id = $9
                AND organization_id = $10
            `,
            [
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
          /*
           * NEW METADATA
           *
           * A reference code is NOT supplied by the user.
           * It is generated automatically from the selected
           * department code while the confirmation transaction
           * is active.
           */
          const validationError =
            validateRequiredMetadata(
              metadataPayload
            );

          if (validationError) {
            throw new Error(
              validationError
            );
          }

          if (
            metadataPayload.departmentId ===
            null
          ) {
            throw new Error(
              "Department is required to create metadata."
            );
          }

          const referenceCode =
            await generateMetadataReferenceCode(
              client,
              organizationId,
              metadataPayload.departmentId
            );

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
                referenceCode,
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
            Number(
              inserted.rows[0].id
            );
        }

        /*
         * DOCUMENT NUMBER
         *
         * Normal uploads receive the next global DOC-N code.
         *
         * Approved duplicates retain the original document
         * code family and receive a numeric suffix:
         *
         * DOC-256
         * DOC-256 (1)
         * DOC-256 (2)
         * DOC-256 (3)
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

        let documentCode =
          `DOC-${uploadNumber}`;

        if (duplicateBaseCode) {
          const codeFamilyResult =
            await client.query<{
              document_code: string;
            }>(
              `
                SELECT document_code
                FROM documents
                WHERE document_code = $1
                   OR document_code LIKE $2
                ORDER BY id ASC
                FOR UPDATE
              `,
              [
                duplicateBaseCode,
                `${duplicateBaseCode} (%)`,
              ]
            );

          let highestSuffix = 0;

          for (
            const row of codeFamilyResult.rows
          ) {
            const familyMatch =
              row.document_code.match(
                /^(.*) \((\d+)\)$/
              );

            if (!familyMatch) {
              continue;
            }

            if (
              familyMatch[1] !==
                duplicateBaseCode
            ) {
              continue;
            }

            const suffix =
              Number(
                familyMatch[2]
              );

            if (
              Number.isInteger(suffix) &&
              suffix > highestSuffix
            ) {
              highestSuffix = suffix;
            }
          }

          documentCode =
            `${duplicateBaseCode} (${highestSuffix + 1})`;

          const conflictingCode =
            await client.query(
              `
                SELECT id
                FROM documents
                WHERE document_code = $1
                LIMIT 1
              `,
              [documentCode]
            );

          if (conflictingCode.rows[0]) {
            throw new Error(
              "Unable to allocate a unique duplicate document code. Please retry the upload."
            );
          }
        }

        if (provisional.recoveryStatus === "RECOVERY_PENDING") {
          if (
            !provisional.recoveryReference ||
            !provisional.recoveryProvider ||
            !provisional.recoveryFilename
          ) {
            throw new Error(
              "Upload recovery metadata is incomplete; confirmation is blocked."
            );
          }

          storedFilename = provisional.recoveryFilename;
          storedDocument = {
            provider: provisional.recoveryProvider,
            reference: provisional.recoveryReference,
          };
          storedReference = storedDocument.reference;
        } else {
          storedFilename = `${documentCode}${provisional.extension}`;
          storedDocument = await localFileStorage.store(
            provisional.temporaryPath,
            storedFilename
          );
          storedReference = storedDocument.reference;
        }

        if (!storedDocument || !storedFilename) {
          throw new Error(
            "The stored document reference could not be established."
          );
        }

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
              file_size,
              sha256_hash
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
              $9
            )
          `,
          [
            documentId,
            provisional.originalName,
            storedFilename,
            storedReference,
            storedDocument.provider,
            storedDocument.reference,
            provisional.mimeType,
            provisional.fileSize,
            provisional.sha256Hash
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
              latestMatch.matchingFields
                .join(", ") || null,
              latestMatch.conflictingFields
                .join(", ") || null,
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

        await fs.promises
          .unlink(
            provisionalStatePath(
              provisional.temporaryPath
            )
          )
          .catch(() => undefined);

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
        await client
          .query("ROLLBACK")
          .catch(() => undefined);

        if (storedReference && storedDocument && storedFilename) {
          provisional.recoveryReference = storedReference;
          provisional.recoveryProvider = storedDocument.provider;
          provisional.recoveryFilename = storedFilename;
          provisional.recoveryStatus = "RECOVERY_PENDING";

          let recoveryStatePersisted = false;

          try {
            await writeProvisionalUpload(provisional);
            recoveryStatePersisted = true;
          } catch (stateError) {
            console.error(
              "CRITICAL: Unable to persist provisional upload recovery metadata. The stored file has been preserved; automatic retry is unsafe until the metadata is recovered.",
              stateError
            );
          }

          if (recoveryStatePersisted) {
            const recoveryResult = await recoverProvisionalUpload(
              provisional,
              {
                storage: localFileStorage,
                persist: writeProvisionalUpload,
              }
            );

            if (recoveryResult.status !== "RECOVERED") {
              console.error(
                "Provisional upload recovery remains unresolved:",
                recoveryResult.status
              );
            }
          }

          storedReference = null;
        }

        if (
          error instanceof Error &&
          (error as Error & {
            code?: string;
            duplicate?: {
              existingDocumentId: number;
              existingDocumentCode: string;
              existingFilename: string;
            };
          }).code ===
            "DUPLICATE_REQUIRES_APPROVAL"
        ) {
          const duplicate =
            (
              error as Error & {
                duplicate?: {
                  existingDocumentId: number;
                  existingDocumentCode: string;
                  existingFilename: string;
                };
              }
            ).duplicate;

          return res.status(409).json({
            success: false,
            error:
              "DUPLICATE_REQUIRES_APPROVAL",
            message:
              "This file is already registered. Explicit approval is required to save it as a new document.",
            duplicate: {
              isDuplicate: true,
              existingDocumentId:
                duplicate?.existingDocumentId ?? null,
              existingDocumentCode:
                duplicate?.existingDocumentCode ?? null,
              existingFilename:
                duplicate?.existingFilename ?? null,
            },
          });
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
        typeof organizationId !==
          "number"
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
                  entry.replace(
                    /\.json$/,
                    ""
                  )
                )
              );

            if (
              candidate.token === token &&
              candidate.organizationId ===
                organizationId &&
              candidate.ownerUserId ===
                ownerUser.id
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

      if (provisional.recoveryStatus === "RECOVERY_PENDING") {
        return res.status(409).json({
          success: false,
          error: "UPLOAD_RECOVERY_PENDING",
          message:
            "This upload cannot be cancelled while file recovery is pending. Its state and stored file have been preserved.",
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
