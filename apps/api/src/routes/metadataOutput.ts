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
  getPopulatedMetadataOutput,
} from "../services/metadataOutput.js";

const parsePositiveInteger = (
  value: unknown
): number | null => {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" &&
          value.trim() !== ""
        ? Number(value)
        : NaN;

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
};

export function createMetadataOutputRouter(
  pool: Pool
) {
  const router = Router();

  router.get(
    "/:metadata_record_id",
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
        res.status(403).json({
          success: false,
          error:
            "Organization context is required.",
        });

        return;
      }

      const metadataRecordId =
        parsePositiveInteger(
          req.params.metadata_record_id
        );

      if (metadataRecordId === null) {
        res.status(400).json({
          success: false,
          error:
            "A valid metadata_record_id is required.",
        });

        return;
      }

      try {
        const output =
          await getPopulatedMetadataOutput(
            pool,
            organizationId,
            metadataRecordId
          );

        if (!output) {
          res.status(404).json({
            success: false,
            error:
              "Metadata record not found.",
          });

          return;
        }

        res.json({
          success: true,
          ...output,
        });
      } catch (error) {
        console.error(
          "Populated metadata output query failed:",
          error
        );

        res.status(500).json({
          success: false,
          error:
            "Unable to retrieve populated metadata output.",
        });
      }
    }
  );

  return router;
}
