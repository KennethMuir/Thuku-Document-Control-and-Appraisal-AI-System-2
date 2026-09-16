import cors from "cors";
import express from "express";

import {
  createApiInfrastructure,
} from "./infrastructure/apiInfrastructure.js";

import { registerRoutes } from "./routes/registerRoutes.js";

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

registerRoutes(
  app,
  pool,
  localFileStorage,
  upload
);

export default app;
