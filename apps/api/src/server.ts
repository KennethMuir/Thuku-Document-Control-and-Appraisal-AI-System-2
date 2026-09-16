import "dotenv/config";

import cors from "cors";
import express, { type Request, type Response } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import path from "path";
import fs from "fs";
import { Pool, type PoolClient } from "pg";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { ocrPdf } from "./services/ocr.js";
import { LocalFileStorage } from "./services/storage.js";
import { createAuditLog } from "./services/audit.js";
import {
  requireAuthentication,
  requireRole,
  type AuthenticatedRequest,
} from "./middleware/auth.js";
import {
  extractDocumentContent,
  type ExtractedDocument,
} from "./services/documentExtraction.js";
import { calculateFieldMatch, type MatchResult, type MetadataCandidate } from "./services/metadataMatching.js";
import {
  normalizeText,
  normalizeComparable,
  containsNormalized,
  nullableString,
  nullableNumber,
  nullableInteger,
  nullablePositiveInteger,
} from "./utils/values.js";
import {
  RESERVED_METADATA_KEYS,
  parseReviewMetadata,
  sanitizeAdditionalMetadata,
  type ReviewMetadataInput,
} from "./services/metadataUtils.js";

const app = express();
const PORT = Number(process.env.PORT || 4000);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const webOrigin = process.env.WEB_ORIGIN || "http://localhost:3000";

app.use(
  cors({
    origin: webOrigin,
    credentials: true,
  })
);
app.use(express.json());

/* ============================================================
   M10 AUTHENTICATION ROUTES
   ============================================================ */

import { createAuthRouter } from "./routes/auth.js";
import { createUsersRouter } from "./routes/users.js";
import { createDepartmentsRouter } from "./routes/departments.js";
import { createDocumentTypesRouter } from "./routes/documentTypes.js";
import { createSearchRouter } from "./routes/search.js";
import { createHealthRouter } from "./routes/health.js";
import { createDashboardRouter } from "./routes/dashboard.js";
import { createMetadataRouter } from "./routes/metadata.js";

app.use("/api/auth", createAuthRouter(pool));
app.use("/api/users", createUsersRouter(pool));
app.use(
  "/api/departments",
  createDepartmentsRouter(pool)
);

app.use(
  "/api/document-types",
  createDocumentTypesRouter(pool)
);
app.use(
  "/api/search",
  createSearchRouter(pool)
);
app.use("/api/health", createHealthRouter(pool));
app.use("/api/dashboard", createDashboardRouter(pool));

app.use("/api/metadata", createMetadataRouter(pool));

const projectRoot = path.resolve(
  process.cwd(),
  "..",
  ".."
);

const storageRoot = path.join(
  projectRoot,
  "storage",
  "documents"
);

const temporaryRoot = path.join(
  projectRoot,
  "storage",
  "temporary"
);

fs.mkdirSync(storageRoot, { recursive: true });
fs.mkdirSync(temporaryRoot, { recursive: true });

const localFileStorage =
  new LocalFileStorage(
    storageRoot
  );

const upload = multer({
  dest: temporaryRoot,
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

async function findBestMetadataMatch(
  client: PoolClient,
  extracted: ExtractedDocument
): Promise<MatchResult> {
  const result =
    await client.query<MetadataCandidate>(
      `
        SELECT
          mr.id,
          mr.reference_code,
          mr.title,
          mr.document_date,
          mr.year,
          mr.person_name,
          mr.description,
          mr.section,
          mr.status,

          d.name AS department_name,
          d.code AS department_code,

          dt.name AS document_type_name

        FROM metadata_records mr

        LEFT JOIN departments d
          ON d.id = mr.department_id

        LEFT JOIN document_types dt
          ON dt.id = mr.document_type_id

        ORDER BY mr.created_at DESC
      `
    );

  let bestMatch: MatchResult = {
    metadataRecordId: null,
    matchType: "NO_MATCH",
    confidence: 0,
    matchingFields: [],
    conflictingFields: [],
  };

  for (
    const candidate of result.rows
  ) {
    const match =
      calculateFieldMatch(
        [
          extracted.text,
          extracted.title || "",
          extracted.personName ||
            "",
          extracted.referenceCode ||
            "",
          extracted.year || "",
        ].join("\n"),
        extracted,
        candidate
      );

    if (
      match.confidence >
      bestMatch.confidence
    ) {
      bestMatch = match;
    }
  }

  return bestMatch;
}

function buildReferencePrefix(
  document: Record<string, any>
): string {
  const extractedText =
    String(
      document.extracted_text || ""
    );

  const referenceMatch =
    extractedText.match(
      /\b([A-Za-z]{2,20})-(\d{1,6})\b/
    );

  if (
    referenceMatch &&
    referenceMatch[1]
  ) {
    return referenceMatch[1]
      .toUpperCase();
  }

  const filenameBase =
    String(
      document.filename || ""
    )
      .replace(
        /\.[^/.]+$/,
        ""
      )
      .replace(
        /[^A-Za-z0-9]+/g,
        " "
      )
      .trim();

  const filenamePrefix =
    filenameBase.match(
      /^[A-Za-z]{2,20}/
    );

  if (
    filenamePrefix &&
    filenamePrefix[0]
  ) {
    return filenamePrefix[0]
      .toUpperCase();
  }

  return "DOC";
}

async function generateMetadataReferenceCode(
  client: PoolClient,
  requestedReferenceCode: string | null,
  document: Record<string, any>
): Promise<string> {
  const normalizedRequestedReferenceCode =
    requestedReferenceCode
      ? requestedReferenceCode
          .trim()
          .toUpperCase()
      : null;

  /*
   * Preserve a reviewer-supplied reference code
   * when it is genuinely new.
   *
   * If the submitted code already exists, fall
   * through to automatic reference generation so
   * Reject Match cannot create a duplicate
   * metadata record.
   */
  if (
    normalizedRequestedReferenceCode
  ) {
    const existingRequestedReferenceResult =
      await client.query(
        `
          SELECT 1
          FROM metadata_records
          WHERE UPPER(reference_code) = $1
          LIMIT 1
        `,
        [
          normalizedRequestedReferenceCode,
        ]
      );

    if (
      existingRequestedReferenceResult
        .rows.length === 0
    ) {
      return normalizedRequestedReferenceCode;
    }
  }

  const referencePrefix =
    buildReferencePrefix(
      document
    );

  const existingReferencesResult =
    await client.query(
      `
        SELECT reference_code
        FROM metadata_records
        WHERE UPPER(reference_code)
          LIKE $1
      `,
      [
        `${referencePrefix}-%`,
      ]
    );

  let highestNumber = 0;

  const escapedPrefix =
    referencePrefix.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

  const referencePattern =
    new RegExp(
      `^${escapedPrefix}-(\\d+)$`,
      "i"
    );

  for (
    const row of
      existingReferencesResult.rows
  ) {
    const match =
      String(
        row.reference_code || ""
      ).match(
        referencePattern
      );

    if (match) {
      const number =
        Number(match[1]);

      if (
        Number.isInteger(number) &&
        number > highestNumber
      ) {
        highestNumber =
          number;
      }
    }
  }

  return `${referencePrefix}-${String(
    highestNumber + 1
  ).padStart(3, "0")}`;
}


/* ============================================================
   M14 USER & ROLE MANAGEMENT
   ============================================================ */


app.post(
  "/api/metadata",
  requireAuthentication(pool),
  requireRole("ADMIN", "APPRAISER"),
  async (
    req: Request,
    res: Response
  ) => {
    const {
      referenceCode,
      title,
      personName,
      departmentId,
      documentTypeId,
      section,
      year,
      documentDate,
      description,
      additionalMetadata,
    } = req.body;

    if (
      !referenceCode ||
      !String(
        referenceCode
      ).trim()
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Reference code is required",
      });
    }

    try {
      const duplicate =
        await pool.query(
          `
            SELECT id
            FROM metadata_records
            WHERE LOWER(reference_code) =
                  LOWER($1)
            LIMIT 1
          `,
          [
            String(
              referenceCode
            ).trim(),
          ]
        );

      if (
        duplicate.rowCount &&
        duplicate.rowCount > 0
      ) {
        return res.status(409).json({
          success: false,
          error:
            "A metadata record with this reference code already exists",
        });
      }

      const result =
        await pool.query(
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
              status
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
              'AWAITING_DOCUMENT'
            )
            RETURNING
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
              status,
              created_at,
              updated_at
          `,
          [
            String(
              referenceCode
            ).trim(),

            nullableString(title),

            nullableString(
              personName
            ),

            nullablePositiveInteger(
              departmentId
            ),

            nullablePositiveInteger(
              documentTypeId
            ),

            nullableString(
              section
            ),

            nullableInteger(year),

            nullableString(
              documentDate
            ),

            nullableString(
              description
            ),

            JSON.stringify(
              sanitizeAdditionalMetadata(
                additionalMetadata
              )
            ),
          ]
        );

      res.status(201).json({
        success: true,
        metadata:
          result.rows[0],
      });
    } catch (error: any) {
      console.error(
        "Metadata creation failed:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          "Unable to create metadata record",
        details:
          process.env.NODE_ENV ===
          "development"
            ? error.message
            : undefined,
      });
    }
  }
);

app.post(
  "/api/metadata/bulk",
  requireAuthentication(pool),
  requireRole("ADMIN", "APPRAISER"),
  upload.single("file"),
  async (
    req: Request,
    res: Response
  ) => {
    const uploadedFile = req.file;

    if (!uploadedFile) {
      return res.status(400).json({
        success: false,
        error: "CSV or XLSX file is required.",
      });
    }

    const originalName =
      uploadedFile.originalname || "";

    const extension =
      path.extname(originalName).toLowerCase();

    if (
      extension !== ".csv" &&
      extension !== ".xlsx"
    ) {
      try {
        await fs.promises.unlink(
          uploadedFile.path
        );
      } catch {
        // Ignore temporary-file cleanup errors.
      }

      return res.status(400).json({
        success: false,
        error:
          "Only CSV and XLSX files are supported.",
      });
    }

    const normalizeHeader = (
      value: unknown
    ): string => {
      return String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_");
    };

    const normalizeLookup = (
      value: unknown
    ): string => {
      return String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
    };

    const headerAliases: Record<
      string,
      string
    > = {
      reference_code: "reference_code",
      reference: "reference_code",
      ref_code: "reference_code",
      ref: "reference_code",

      person_name: "person_name",
      person: "person_name",
      employee_name: "person_name",

      title: "title",
      document_title: "title",

      department: "department",
      department_name: "department",
      department_code: "department_code",

      document_type: "document_type",
      document_type_name: "document_type",

      year: "year",
      document_year: "year",

      document_date: "document_date",
      date: "document_date",

      section: "section",
      description: "description",
    };

    const reservedBulkHeaders =
      new Set(
        Object.keys(headerAliases)
      );

    const normalizeDate = (
      value: unknown
    ): string | null => {
      if (
        value === null ||
        value === undefined ||
        value === ""
      ) {
        return null;
      }

      if (value instanceof Date) {
        if (
          Number.isNaN(
            value.getTime()
          )
        ) {
          return null;
        }

        return value
          .toISOString()
          .slice(0, 10);
      }

      if (
        typeof value === "number" &&
        Number.isFinite(value)
      ) {
        const parsed =
          XLSX.SSF.parse_date_code(
            value
          );

        if (!parsed) {
          return null;
        }

        return [
          String(parsed.y).padStart(4, "0"),
          String(parsed.m).padStart(2, "0"),
          String(parsed.d).padStart(2, "0"),
        ].join("-");
      }

      const text =
        String(value).trim();

      if (!text) {
        return null;
      }

      if (
        /^\d{4}-\d{2}-\d{2}$/.test(
          text
        )
      ) {
        const testDate =
          new Date(`${text}T00:00:00Z`);

        if (
          !Number.isNaN(
            testDate.getTime()
          )
        ) {
          return text;
        }
      }

      const parsed =
        new Date(text);

      if (
        Number.isNaN(
          parsed.getTime()
        )
      ) {
        return null;
      }

      return parsed
        .toISOString()
        .slice(0, 10);
    };

    const normalizeCellValue = (
      value: unknown
    ): string | number | boolean | null => {
      if (
        value === null ||
        value === undefined
      ) {
        return null;
      }

      if (
        typeof value === "string"
      ) {
        return value.trim();
      }

      if (
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        return value;
      }

      if (value instanceof Date) {
        return normalizeDate(value);
      }

      return String(value).trim();
    };

    try {
      const workbook =
        XLSX.readFile(
          uploadedFile.path,
          {
            cellDates: true,
          }
        );

      const firstSheetName =
        workbook.SheetNames[0];

      if (!firstSheetName) {
        return res.status(400).json({
          success: false,
          error:
            "The uploaded file does not contain a worksheet.",
        });
      }

      const worksheet =
        workbook.Sheets[
          firstSheetName
        ];

      const rows =
        XLSX.utils.sheet_to_json<
          Record<string, unknown>
        >(
          worksheet!,
          {
            defval: null,
            raw: true,
          }
        );

      if (rows.length === 0) {
        return res.status(400).json({
          success: false,
          error:
            "The uploaded file contains no metadata rows.",
        });
      }

      const firstRow = rows[0]!;

      const originalHeaders =
        Object.keys(firstRow);

      if (
        !originalHeaders.some(
          (header) =>
            headerAliases[
              normalizeHeader(header)
            ] === "reference_code"
        )
      ) {
        return res.status(400).json({
          success: false,
          error:
            "The upload must contain a reference_code column.",
        });
      }

      const departmentResult =
        await pool.query(`
          SELECT
            id,
            name,
            code
          FROM departments
        `);

      const documentTypeResult =
        await pool.query(`
          SELECT
            id,
            name
          FROM document_types
        `);

      const departmentByName =
        new Map<string, number>();

      const departmentByCode =
        new Map<string, number>();

      for (
        const department
        of departmentResult.rows
      ) {
        departmentByName.set(
          normalizeLookup(
            department.name
          ),
          Number(department.id)
        );

        departmentByCode.set(
          normalizeLookup(
            department.code
          ),
          Number(department.id)
        );
      }

      const documentTypeByName =
        new Map<string, number>();

      for (
        const documentType
        of documentTypeResult.rows
      ) {
        documentTypeByName.set(
          normalizeLookup(
            documentType.name
          ),
          Number(documentType.id)
        );
      }

      const validationErrors: string[] =
        [];

      const preparedRows: Array<{
        rowNumber: number;
        referenceCode: string;
        title: string | null;
        personName: string | null;
        departmentId: number | null;
        documentTypeId: number | null;
        section: string | null;
        year: number | null;
        documentDate: string | null;
        description: string | null;
        additionalMetadata: Record<
          string,
          string | number | boolean | null
        >;
      }> = [];

      const uploadedReferences =
        new Set<string>();

      for (
        let index = 0;
        index < rows.length;
        index += 1
      ) {
        const row =
          rows[index];

        const rowNumber =
          index + 2;

        const normalizedRow:
          Record<string, unknown> =
          {};

        for (
          const [
            rawHeader,
            value,
          ] of Object.entries(row ?? {})
        ) {
          const normalizedHeader =
            normalizeHeader(
              rawHeader
            );

          const canonicalHeader =
            headerAliases[normalizedHeader] ??
            normalizedHeader;

          normalizedRow[
            canonicalHeader
          ] = value;
        }
        const referenceValue =
          normalizedRow.reference_code;

        const referenceCode =
          String(
            referenceValue ?? ""
          ).trim();

        if (!referenceCode) {
          validationErrors.push(
            `Row ${rowNumber}: reference_code is required.`
          );
          continue;
        }

        const normalizedReference =
          normalizeLookup(
            referenceCode
          );

        if (
          uploadedReferences.has(
            normalizedReference
          )
        ) {
          validationErrors.push(
            `Row ${rowNumber}: duplicate reference_code "${referenceCode}" appears more than once in the upload.`
          );
          continue;
        }

        uploadedReferences.add(
          normalizedReference
        );

        const departmentValue =
          normalizedRow.department;

        const departmentCodeValue =
          normalizedRow.department_code;

        let departmentId:
          number | null = null;

        if (
          departmentValue !==
            null &&
          departmentValue !==
            undefined &&
          String(
            departmentValue
          ).trim()
        ) {
          const lookup =
            normalizeLookup(
              departmentValue
            );

          departmentId =
            departmentByName.get(
              lookup
            ) ??
            departmentByCode.get(
              lookup
            ) ??
            null;

          if (
            departmentId === null
          ) {
            validationErrors.push(
              `Row ${rowNumber}: department "${String(departmentValue).trim()}" was not found.`
            );
          }
        }

        if (
          departmentId === null &&
          departmentCodeValue !==
            null &&
          departmentCodeValue !==
            undefined &&
          String(
            departmentCodeValue
          ).trim()
        ) {
          const lookup =
            normalizeLookup(
              departmentCodeValue
            );

          departmentId =
            departmentByCode.get(
              lookup
            ) ?? null;

          if (
            departmentId === null
          ) {
            validationErrors.push(
              `Row ${rowNumber}: department code "${String(departmentCodeValue).trim()}" was not found.`
            );
          }
        }

        const documentTypeValue =
          normalizedRow.document_type;

        let documentTypeId:
          number | null = null;

        if (
          documentTypeValue !==
            null &&
          documentTypeValue !==
            undefined &&
          String(
            documentTypeValue
          ).trim()
        ) {
          const lookup =
            normalizeLookup(
              documentTypeValue
            );

          documentTypeId =
            documentTypeByName.get(
              lookup
            ) ?? null;

          if (
            documentTypeId === null
          ) {
            validationErrors.push(
              `Row ${rowNumber}: document type "${String(documentTypeValue).trim()}" was not found.`
            );
          }
        }

        let year:
          number | null = null;

        const yearValue =
          normalizedRow.year;

        if (
          yearValue !==
            null &&
          yearValue !==
            undefined &&
          String(
            yearValue
          ).trim()
        ) {
          const parsedYear =
            Number(
              String(
                yearValue
              ).trim()
            );

          if (
            !Number.isInteger(
              parsedYear
            )
          ) {
            validationErrors.push(
              `Row ${rowNumber}: year must be a whole number.`
            );
          } else {
            year =
              parsedYear;
          }
        }

        let documentDate:
          string | null = null;

        if (
          normalizedRow.document_date !==
            null &&
          normalizedRow.document_date !==
            undefined &&
          String(
            normalizedRow.document_date
          ).trim()
        ) {
          documentDate =
            normalizeDate(
              normalizedRow.document_date
            );

          if (!documentDate) {
            validationErrors.push(
              `Row ${rowNumber}: document_date is not a valid date.`
            );
          }
        }

        const additionalMetadata:
          Record<
            string,
            string | number | boolean | null
          > = {};

        for (
          const [
            rawHeader,
            rawValue,
          ] of Object.entries(row ?? {})
        ) {
          const normalizedHeader =
            normalizeHeader(
              rawHeader
            );

          if (
            reservedBulkHeaders.has(
              normalizedHeader
            )
          ) {
            continue;
          }

          const key =
            String(
              rawHeader
            ).trim();

          if (!key) {
            continue;
          }

          const value =
            normalizeCellValue(
              rawValue
            );

          if (
            value === null ||
            value === ""
          ) {
            continue;
          }

          additionalMetadata[
            key
          ] = value;
        }

        const sanitizedAdditionalMetadata =
          sanitizeAdditionalMetadata(
            additionalMetadata
          );

        preparedRows.push({
          rowNumber,
          referenceCode,
          title:
            normalizedRow.title !==
              null &&
            normalizedRow.title !==
              undefined
              ? String(
                  normalizedRow.title
                ).trim() || null
              : null,
          personName:
            normalizedRow.person_name !==
              null &&
            normalizedRow.person_name !==
              undefined
              ? String(
                  normalizedRow.person_name
                ).trim() || null
              : null,
          departmentId,
          documentTypeId,
          section:
            normalizedRow.section !==
              null &&
            normalizedRow.section !==
              undefined
              ? String(
                  normalizedRow.section
                ).trim() || null
              : null,
          year,
          documentDate,
          description:
            normalizedRow.description !==
              null &&
            normalizedRow.description !==
              undefined
              ? String(
                  normalizedRow.description
                ).trim() || null
              : null,
          additionalMetadata:
            sanitizedAdditionalMetadata,
        });
      }

      if (
        validationErrors.length > 0
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Bulk metadata validation failed.",
          errors:
            validationErrors.slice(
              0,
              100
            ),
          totalErrors:
            validationErrors.length,
        });
      }

      if (
        preparedRows.length === 0
      ) {
        return res.status(400).json({
          success: false,
          error:
            "No valid metadata rows were found.",
        });
      }

      const existingReferenceResult = await pool.query(
        `
          SELECT reference_code
          FROM metadata_records
          WHERE LOWER(reference_code) = ANY($1::text[])
        `,
        [Array.from(uploadedReferences)]
      );

      const existingReferenceCodes =
        existingReferenceResult.rows.map((row) =>
          String(row.reference_code)
        );

      const previewRequested =
        String(req.query.preview ?? "")
          .trim()
          .toLowerCase() === "true";

      if (previewRequested) {
        return res.status(200).json({
          success: true,
          preview: true,
          totalRows: preparedRows.length,
          rows: preparedRows.slice(0, 100).map((row) => ({
            rowNumber: row.rowNumber,
            referenceCode: row.referenceCode,
            title: row.title,
            personName: row.personName,
            departmentId: row.departmentId,
            documentTypeId: row.documentTypeId,
            section: row.section,
            year: row.year,
            documentDate: row.documentDate,
            description: row.description,
            additionalMetadata: row.additionalMetadata,
          })),
          existingReferenceCodes,
          canImport: existingReferenceCodes.length === 0,
          truncated: preparedRows.length > 100,
        });
      }

      const client =
        await pool.connect();

      try {
        await client.query(
          "BEGIN"
        );

        const existingReferences =
          await client.query(
            `
              SELECT reference_code
              FROM metadata_records
              WHERE LOWER(reference_code) = ANY($1::text[])
            `,
            [
              Array.from(
                uploadedReferences
              ),
            ]
          );

        if (
          existingReferences.rowCount &&
          existingReferences.rowCount >
            0
        ) {
          const existing =
            existingReferences.rows.map(
              (row) =>
                String(
                  row.reference_code
                )
            );

          await client.query(
            "ROLLBACK"
          );

          return res.status(409).json({
            success: false,
            error:
              "One or more reference codes already exist.",
            existingReferenceCodes:
              existing,
          });
        }

        for (
          const row of preparedRows
        ) {
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
                status
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
                'AWAITING_DOCUMENT'
              )
            `,
            [
              row.referenceCode,
              row.title,
              row.personName,
              row.departmentId,
              row.documentTypeId,
              row.section,
              row.year,
              row.documentDate,
              row.description,
              JSON.stringify(
                row.additionalMetadata
              ),
            ]
          );
        }

        await client.query(
          "COMMIT"
        );

        return res.status(201).json({
          success: true,
          imported:
            preparedRows.length,
          message:
            `${preparedRows.length} metadata record(s) imported successfully.`,
        });
      } catch (error) {
        await client.query(
          "ROLLBACK"
        );
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error(
        "Bulk metadata import failed:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Unable to import metadata records.",
      });
    } finally {
      try {
        await fs.promises.unlink(
          uploadedFile.path
        );
      } catch {
        // Ignore temporary-file cleanup errors.
      }
    }
  }
);
app.get(
  "/api/documents",
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

app.get(
  "/api/documents/:documentId/appraisal",
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

app.post(
  "/api/documents/upload",
  requireAuthentication(pool),
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
                owner_user_id
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
                $11
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
                $7
              )
              RETURNING *
            `,
            [
              documentId,
              extracted.text,
              extracted.title,
              extracted.date,
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
            extracted
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
                    mr.document_date,
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
                  LIMIT 1
                `,
                [
                  bestMatch.metadataRecordId,
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
                    $1 IS NOT NULL
                    AND LOWER(code) =
                        LOWER($1)
                  )
                  OR
                  (
                    $2 IS NOT NULL
                    AND LOWER(name) =
                        LOWER($2)
                  )
                LIMIT 1
              `,
              [
                extractedDepartmentCode,
                extractedDepartment,
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
                LIMIT 1
              `,
              [
                extractedDocumentType,
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
            mergeAppraisalField(
              "Reference Code",
              existingAppraisalMetadata
                ?.reference_code,
              extracted.referenceCode
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

app.post(
  "/api/documents/:documentId/link",
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

app.post(
  "/api/documents/:documentId/review",
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

app.get(
  "/api/documents/:documentId/file",
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
            ORDER BY df.uploaded_at DESC
            LIMIT 1
          `,
          [documentId]
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

      const isPrivileged =
        authUser.role === "ADMIN" ||
        authUser.role === "APPRAISER";

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

      const localPath =
        localFileStorage.resolve(
          storageReference
        );

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

      return res.sendFile(
        localPath
      );
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

app.listen(
  PORT,
  () => {
    console.log(
      `Document Appraisal AI API running on http://localhost:${PORT}`
    );
  }
);
