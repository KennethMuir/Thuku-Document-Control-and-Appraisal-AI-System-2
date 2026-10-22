import { Router, type Request, type Response } from "express";
import type { Pool } from "pg";
import {
  requireAuthentication,
  requireOrganizationContext,
  type AuthenticatedRequest,
} from "../middleware/auth.js";
import { searchDocumentContent } from "../services/contentSearch.js";

const MAX_QUERY_LENGTH = 200;

export function createContentSearchRouter(pool: Pool) {
  const router = Router();

  router.get(
    "/",
    requireAuthentication(pool),
    requireOrganizationContext(pool),
    async (req: Request, res: Response) => {
      const organizationId =
        (req as AuthenticatedRequest).authOrganization?.organizationId;

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

      if (req.query.q !== undefined && typeof req.query.q !== "string") {
        return res.status(400).json({
          success: false,
          error: "The search query must be a single string.",
        });
      }

      const query =
        typeof req.query.q === "string" ? req.query.q.trim() : "";

      if (query.length > MAX_QUERY_LENGTH) {
        return res.status(400).json({
          success: false,
          error: `The search query must not exceed ${MAX_QUERY_LENGTH} characters.`,
        });
      }

      if (!query) {
        return res.json({
          success: true,
          query: "",
          results: [],
          total: 0,
          limit: 50,
        });
      }

      try {
        const results = await searchDocumentContent(
          pool,
          organizationId,
          query
        );

        return res.json({
          success: true,
          query,
          results,
          total: results.length,
          limit: 50,
        });
      } catch (error) {
        console.error("Document content search failed:", error);
        return res.status(500).json({
          success: false,
          error: "Unable to search document content.",
        });
      }
    }
  );

  return router;
}