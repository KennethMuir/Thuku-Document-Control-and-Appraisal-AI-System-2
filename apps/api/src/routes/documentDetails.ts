import {
  Router,
  type Request,
  type Response,
} from "express";

import type { Pool } from "pg";

import {
  requireAuthentication,
  requireOrganizationContext,
  type AuthenticatedRequest,
} from "../middleware/auth.js";

import { getDocumentDetails } from "../services/documentDetails.js";

export function createDocumentDetailsRouter(pool: Pool) {
  const router = Router();

  router.get(
    "/:documentId",
    requireAuthentication(pool),
    requireOrganizationContext(pool),
    async (
      req: Request,
      res: Response
    ) => {
      const organizationId =
        (req as AuthenticatedRequest)
          .authOrganization?.organizationId;

      if (
        typeof organizationId !== "number" ||
        !Number.isInteger(organizationId) ||
        organizationId <= 0
      ) {
        return res.status(403).json({
          success: false,
          error: "Organization context is required.",
        });
      }

      const documentId = Number(req.params.documentId);

      if (
        !Number.isInteger(documentId) ||
        documentId <= 0
      ) {
        return res.status(400).json({
          success: false,
          error: "A valid document ID is required.",
        });
      }

      try {
        const details = await getDocumentDetails(
          pool,
          organizationId,
          documentId
        );

        if (!details) {
          return res.status(404).json({
            success: false,
            error: "Document not found.",
          });
        }

        return res.json({
          success: true,
          data: details,
        });
      } catch (error) {
        console.error(
          "Failed to load document details:",
          error
        );

        return res.status(500).json({
          success: false,
          error: "Failed to load document details.",
        });
      }
    }
  );

  return router;
}
