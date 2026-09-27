import { Router, type Request, type Response } from "express";
import type { Pool } from "pg";

import { requireAuthentication } from "../middleware/auth.js";

export function createDashboardRouter(pool: Pool) {
  const router = Router();

  router.get(
    "/",
    requireAuthentication(pool),
    async (
      _req: Request,
      res: Response
    ) => {
      try {
        const result =
          await pool.query(`
            SELECT
              (
                SELECT COUNT(*)
                FROM documents
              ) AS documents,

              (
                SELECT COUNT(*)
                FROM metadata_records
              ) AS metadata,

              (
                SELECT COUNT(*)
                FROM departments
              ) AS departments,

              (
                SELECT COUNT(*)
                FROM documents
                WHERE metadata_record_id
                  IS NOT NULL
              ) AS linked,

              (
                SELECT COUNT(*)
                FROM metadata_records
                WHERE status =
                  'AWAITING_DOCUMENT'
              ) AS awaiting,

              (
                SELECT COUNT(*)
                FROM documents
                WHERE status =
                  'REVIEW_REQUIRED'
              ) AS review,

              (
                SELECT COUNT(*)
                FROM documents
                WHERE metadata_record_id
                  IS NULL
              ) AS unlinked
          `);

        res.json({
          success: true,
          dashboard:
            result.rows[0],
        });
      } catch (error) {
        console.error(
          "Dashboard query failed:",
          error
        );

        res.status(500).json({
          success: false,
          error:
            "Unable to retrieve dashboard statistics",
        });
      }
    }
  );





  return router;
}
