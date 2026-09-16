import "dotenv/config";

import cors from "cors";
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { Pool } from "pg";
import { LocalFileStorage } from "./services/storage.js";
import { findBestMetadataMatch } from "./services/metadataMatching.js";

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
