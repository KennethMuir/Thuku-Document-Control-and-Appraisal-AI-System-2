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
import {
  generateDocumentAiDescription,
} from "../services/documentAiDescription.js";

export function createDocumentAiDescriptionRouter(pool: Pool) {
  const router = Router();

  router.post(
    "/:documentId",
    requireAuthentication(pool),
    requireOrganizationContext(pool),
    async (req: Request, res: Response) => {
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

      if (!Number.isInteger(documentId) || documentId <= 0) {
        return res.status(400).json({
          success: false,
          error: "A valid document ID is required.",
        });
      }

      try {
        const result = await generateDocumentAiDescription(
          pool,
          organizationId,
          documentId
        );

        if (!result) {
          return res.status(404).json({
            success: false,
            error: "Document not found.",
          });
        }

        return res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "";

        if (message === "DOCUMENT_DESCRIPTION_MISSING") {
          return res.status(422).json({
            success: false,
            error: "This document has no saved description to enhance.",
          });
        }

        if (message === "GEMINI_NOT_CONFIGURED") {
          return res.status(503).json({
            success: false,
            error: "AI description service is not configured.",
          });
        }

        console.error("AI document description request failed:", message || "Unknown error");

        return res.status(502).json({
          success: false,
          error: "Could not generate an AI description.",
        });
      }
    }
  );

  return router;
}