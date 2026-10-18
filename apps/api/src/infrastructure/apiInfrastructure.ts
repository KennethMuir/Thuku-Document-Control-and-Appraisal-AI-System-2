import multer from "multer";
import path from "path";
import fs from "fs";
import { Pool } from "pg";

import { LocalFileStorage } from "../services/storage.js";

export function createApiInfrastructure() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

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

  const brandingRoot = path.join(
    projectRoot,
    "storage",
    "branding"
  );
  const temporaryRoot = path.join(
    projectRoot,
    "storage",
    "temporary"
  );

  fs.mkdirSync(
    storageRoot,
    { recursive: true }
  );

  fs.mkdirSync(
    temporaryRoot,
    { recursive: true }
  );

  fs.mkdirSync(brandingRoot, { recursive: true });

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

  const brandingUpload = multer({
    dest: temporaryRoot,
    limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  });

  return {
    pool,
    brandingRoot,
    brandingUpload,
    localFileStorage,
    upload,
    temporaryRoot,
  };
}

