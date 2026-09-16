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
import { findBestMetadataMatch } from "./services/metadataMatching.js";
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

app.use(
  "/api/documents",
  createDocumentsRouter(
    pool,
    localFileStorage
  )
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



app.listen(
  PORT,
  () => {
    console.log(
      `Document Appraisal AI API running on http://localhost:${PORT}`
    );
  }
);
