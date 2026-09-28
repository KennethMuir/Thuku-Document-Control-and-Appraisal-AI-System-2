import {
  Router,
  type Request,
  type Response,
} from "express";

import type { Pool } from "pg";

import {
  requireAuthentication,
  requireOrganizationContext,
  requireRole,
} from "../middleware/auth.js";

import type {
  AuthenticatedRequest,
} from "../middleware/auth.js";

import {
  deleteDocument,
} from "../services/documentDeletion.js";

import {
  LocalFileStorage,
} from "../services/storage.js";

const getOrganizationId = (
  req: Request,
  res: Response
): number | null => {
  const organizationId =
    (req as AuthenticatedRequest)
      .authOrganization?.organizationId;

  if (
    typeof organizationId !== "number" ||
    !Number.isInteger(organizationId) ||
    organizationId <= 0
  ) {
    res.status(403).json({
      success: false,
      error:
        "Organization context is required.",
    });

    return null;
  }

  return organizationId;
};

const getActorUserId = (
  req: Request
): number | null => {
  const authUser =
    (req as AuthenticatedRequest).authUser;

  return authUser?.id ?? null;
};

export function createDocumentDeletionRouter(
  pool: Pool,
  localFileStorage: LocalFileStorage
): Router {
  const router = Router();

  router.delete(
    "/:documentId",
    requireAuthentication(pool),
    requireOrganizationContext(pool),
    requireRole(
      "ADMIN",
      "APPRAISER"
    ),
    async (
      req: Request,
      res: Response
    ) => {
      const organizationId =
        getOrganizationId(req, res);

      if (organizationId === null) {
        return;
      }

      const documentId = Number(
        req.params.documentId
      );

      if (
        !Number.isInteger(documentId) ||
        documentId <= 0
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid document ID.",
        });
      }

      try {
        const result =
          await deleteDocument(
            pool,
            localFileStorage,
            organizationId,
            getActorUserId(req),
            documentId
          );

        if (!result) {
          return res.status(404).json({
            success: false,
            error:
              "Document not found.",
          });
        }

        return res.status(200).json({
          success: true,
          data: result,
          warnings:
            result.fileCleanupWarnings
              .length > 0
              ? result.fileCleanupWarnings
              : undefined,
        });
      } catch (error) {
        console.error(
          "Document deletion failed:",
          error
        );

        return res.status(500).json({
          success: false,
          error:
            "Unable to delete document.",
        });
      }
    }
  );

  return router;
}
