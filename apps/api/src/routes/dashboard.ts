import { Router, type Request, type Response } from "express";
import type { Pool } from "pg";

import {
  requireAuthentication,
  requireOrganizationContext,
  type AuthenticatedRequest,
} from "../middleware/auth.js";

export function createDashboardRouter(pool: Pool) {
  const router = Router();

  router.get(
    "/",
    requireAuthentication(pool),
    requireOrganizationContext(pool),
    async (
      req: Request,
      res: Response
    ) => {
      const organizationId =
        (req as AuthenticatedRequest)
          .authOrganization?.organizationId;

      if (typeof organizationId !== "number" || !Number.isInteger(organizationId) || organizationId <= 0) {
        return res.status(403).json({
          success: false,
          error: "Organization context is required.",
        });
      }

      try {
        const result =
          await pool.query(`
            SELECT
              (
                SELECT COUNT(*)
                FROM documents
                WHERE organization_id = $1
              ) AS documents,

              (
                SELECT COUNT(*)
                FROM metadata_records
                WHERE organization_id = $1
              ) AS metadata,

              (
                SELECT COUNT(*)
                FROM departments
                WHERE organization_id = $1
              ) AS departments,

              (
                SELECT COUNT(*)
                FROM documents
                WHERE organization_id = $1
                  AND metadata_record_id
                  IS NOT NULL
              ) AS linked,

              (
                SELECT COUNT(*)
                FROM metadata_records
                WHERE organization_id = $1
                  AND status =
                  'AWAITING_DOCUMENT'
              ) AS awaiting,

              (
                SELECT COUNT(*)
                FROM documents
                WHERE organization_id = $1
                  AND status =
                  'REVIEW_REQUIRED'
              ) AS review,

              (
                SELECT COUNT(*)
                FROM documents
                WHERE organization_id = $1
                  AND metadata_record_id
                  IS NULL
              ) AS unlinked
          `, [organizationId]);

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
