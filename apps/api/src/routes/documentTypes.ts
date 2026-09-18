import { Router, type Request, type Response } from "express";
import type { Pool } from "pg";
import {
  requireAuthentication,
  requireOrganizationContext,
  type AuthenticatedRequest,
} from "../middleware/auth.js";

export function createDocumentTypesRouter(
  pool: Pool
) {
  const router = Router();

  router.get(
    "/",
    requireAuthentication(pool),
    requireOrganizationContext(pool),
    async (
      req: Request,
      res: Response
    ) => {
      const authReq =
        req as AuthenticatedRequest;

      const organizationId =
        authReq.authOrganization?.organizationId;

      if (
        organizationId === undefined ||
        !Number.isInteger(organizationId) ||
        organizationId <= 0
      ) {
        return res.status(403).json({
          success: false,
          error:
            "Organization context is required.",
        });
      }

      try {
        const result =
          await pool.query(
            `
              SELECT
                id,
                name,
                description
              FROM document_types
              WHERE organization_id = $1
              ORDER BY name
            `,
            [organizationId]
          );

        return res.json({
          success: true,
          documentTypes:
            result.rows,
        });
      } catch (error) {
        console.error(
          "Document types query failed:",
          error
        );

        return res.status(500).json({
          success: false,
          error:
            "Unable to retrieve document types",
        });
      }
    }
  );

  return router;
}
