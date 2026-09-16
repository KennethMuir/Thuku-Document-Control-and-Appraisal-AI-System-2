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
import { createDocumentsRouter } from "./routes/documents.js";
import { createDocumentsUploadRouter } from "./routes/documentsUpload.js";
import { createMetadataBulkRouter } from "./routes/metadataBulk.js";

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

app.use(
  "/api/documents",
  createDocumentsRouter(pool)
);

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

app.use(
  "/api/metadata/bulk",
  createMetadataBulkRouter(pool, upload)
);
app.use(
  "/api/documents/upload",
  createDocumentsUploadRouter(
    pool,
    upload,
    localFileStorage,
    findBestMetadataMatch
  )
);


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
