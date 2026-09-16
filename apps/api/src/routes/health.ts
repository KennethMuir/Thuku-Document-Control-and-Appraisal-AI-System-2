import { Router, type Request, type Response } from "express";
import type { Pool } from "pg";

export function createHealthRouter(pool: Pool) {
  const router = Router();

  router.get(
    "/",
    async (
      _req: Request,
      res: Response
    ) => {
      try {
        const result =
          await pool.query(
            "SELECT NOW() AS database_time"
          );

        res.json({
          success: true,
          service:
            "Document Appraisal AI API",
          status: "online",
          database: "connected",
          databaseTime:
            result.rows[0].database_time,
        });
      } catch (error) {
        console.error(
          "Health check failed:",
          error
        );

        res.status(500).json({
          success: false,
          service:
            "Document Appraisal AI API",
          status: "degraded",
          database: "disconnected",
        });
      }
    }
  );

  return router;
}
