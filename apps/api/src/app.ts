import cors from "cors";
import express from "express";

import {
  createApiInfrastructure,
} from "./infrastructure/apiInfrastructure.js";

import { findBestMetadataMatch } from "./services/metadataMatching.js";

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

const app = express();

const {
  pool,
  localFileStorage,
  upload,
} = createApiInfrastructure();

const webOrigin =
  process.env.WEB_ORIGIN ||
  "http://localhost:3000";

app.use(
  cors({
    origin: webOrigin,
    credentials: true,
  })
);

app.use(express.json());

app.use(
  "/api/auth",
  createAuthRouter(pool)
);

app.use(
  "/api/users",
  createUsersRouter(pool)
);

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

app.use(
  "/api/health",
  createHealthRouter(pool)
);

app.use(
  "/api/dashboard",
  createDashboardRouter(pool)
);

app.use(
  "/api/metadata",
  createMetadataRouter(pool)
);

app.use(
  "/api/documents",
  createDocumentsRouter(
    pool,
    localFileStorage
  )
);

app.use(
  "/api/metadata/bulk",
  createMetadataBulkRouter(
    pool,
    upload
  )
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

export default app;
