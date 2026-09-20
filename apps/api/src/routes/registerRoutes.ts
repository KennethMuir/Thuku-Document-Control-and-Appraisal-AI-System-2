import type { Express } from "express";

import { findBestMetadataMatch } from "../services/metadataMatching.js";

import { createAuthRouter } from "./auth.js";
import { createUsersRouter } from "./users.js";
import { createDepartmentsRouter } from "./departments.js";
import { createDocumentTypesRouter } from "./documentTypes.js";
import { createSearchRouter } from "./search.js";
import { createHealthRouter } from "./health.js";
import { createDashboardRouter } from "./dashboard.js";
import { createMetadataRouter } from "./metadata.js";
import { createDocumentsRouter } from "./documents.js";
import { createDocumentsUploadRouter } from "./documentsUpload.js";
import { createMetadataBulkRouter } from "./metadataBulk.js";
import { createFieldRegistryRouter } from "./fieldRegistry.js";
import { createDomainRegistryRouter } from "./domainRegistry.js";
import { createDomainRelationshipsRouter } from "./domainRelationships.js";

import type { Pool } from "pg";
import type multer from "multer";
import { LocalFileStorage } from "../services/storage.js";

export function registerRoutes(
  app: Express,
  pool: Pool,
  localFileStorage: LocalFileStorage,
  upload: multer.Multer
): void {
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
    "/api/field-registry",
    createFieldRegistryRouter(pool)
  );

  app.use(
    "/api/domain-registry",
    createDomainRegistryRouter(pool)
  );

  app.use(
    "/api/domain-relationships",
    createDomainRelationshipsRouter(pool)
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
}



