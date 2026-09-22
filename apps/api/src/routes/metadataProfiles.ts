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
  type AuthenticatedRequest,
} from "../middleware/auth.js";

import {
  deleteMetadataFieldProfile,
  getMetadataFieldProfile,
  listMetadataFieldProfiles,
  upsertMetadataFieldProfile,
} from "../services/metadataProfiles.js";

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

const parseNonNegativeInteger = (
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
    parsed < 0
  ) {
    return null;
  }

  return parsed;
};

export function createMetadataProfilesRouter(
  pool: Pool
) {
  const router = Router();

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
        error: "Organization context is required.",
      });

      return null;
    }

    return organizationId;
  };

  // ------------------------------------------------------------
  // LIST ORGANIZATION FIELD PROFILES
  // ------------------------------------------------------------

  router.get(
    "/",
    requireAuthentication(pool),
    requireOrganizationContext(pool),
    async (
      req: Request,
      res: Response
    ) => {
      const organizationId =
        getOrganizationId(req, res);

      if (organizationId === null) {
        return;
      }

      try {
        const profiles =
          await listMetadataFieldProfiles(
            pool,
            organizationId
          );

        res.json({
          success: true,
          profiles,
        });
      } catch (error) {
        console.error(
          "Metadata field profiles query failed:",
          error
        );

        res.status(500).json({
          success: false,
          error:
            "Unable to retrieve metadata field profiles.",
        });
      }
    }
  );

  // ------------------------------------------------------------
  // GET ONE ORGANIZATION FIELD PROFILE
  // ------------------------------------------------------------

  router.get(
    "/:field_registry_id",
    requireAuthentication(pool),
    requireOrganizationContext(pool),
    async (
      req: Request,
      res: Response
    ) => {
      const organizationId =
        getOrganizationId(req, res);

      if (organizationId === null) {
        return;
      }

      const fieldRegistryId =
        parsePositiveInteger(
          req.params.field_registry_id
        );

      if (fieldRegistryId === null) {
        res.status(400).json({
          success: false,
          error:
            "A valid field_registry_id is required.",
        });

        return;
      }

      try {
        const profile =
          await getMetadataFieldProfile(
            pool,
            organizationId,
            fieldRegistryId
          );

        if (!profile) {
          res.status(404).json({
            success: false,
            error:
              "Metadata field definition not found.",
          });

          return;
        }

        res.json({
          success: true,
          profile,
        });
      } catch (error) {
        console.error(
          "Metadata field profile query failed:",
          error
        );

        res.status(500).json({
          success: false,
          error:
            "Unable to retrieve metadata field profile.",
        });
      }
    }
  );

  // ------------------------------------------------------------
  // CREATE / UPDATE ORGANIZATION FIELD PROFILE
  // ------------------------------------------------------------

  router.put(
    "/",
    requireAuthentication(pool),
    requireOrganizationContext(pool),
    requireRole(
      "ADMIN",
      "OWNER"
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

      const fieldRegistryId =
        parsePositiveInteger(
          req.body?.field_registry_id
        );

      if (fieldRegistryId === null) {
        res.status(400).json({
          success: false,
          error:
            "field_registry_id is required and must be a positive integer.",
        });

        return;
      }

      const enabled =
        req.body?.enabled;

      const required =
        req.body?.required;

      const displayOrder =
        req.body?.display_order;

      if (
        enabled !== undefined &&
        typeof enabled !== "boolean"
      ) {
        res.status(400).json({
          success: false,
          error:
            "enabled must be a boolean.",
        });

        return;
      }

      if (
        required !== undefined &&
        typeof required !== "boolean"
      ) {
        res.status(400).json({
          success: false,
          error:
            "required must be a boolean.",
        });

        return;
      }

      let parsedDisplayOrder:
        number | undefined;

      if (displayOrder !== undefined) {
        const parsed =
          parseNonNegativeInteger(
            displayOrder
          );

        if (parsed === null) {
          res.status(400).json({
            success: false,
            error:
              "display_order must be a non-negative integer.",
          });

          return;
        }

        parsedDisplayOrder = parsed;
      }

      if (
        required === true &&
        enabled === false
      ) {
        res.status(400).json({
          success: false,
          error:
            "A disabled field cannot be required.",
        });

        return;
      }

      const profileInput: {
        fieldRegistryId: number;
        enabled?: boolean;
        required?: boolean;
        displayOrder?: number;
      } = {
        fieldRegistryId,
      };

      if (enabled !== undefined) {
        profileInput.enabled = enabled;
      }

      if (required !== undefined) {
        profileInput.required = required;
      }

      if (parsedDisplayOrder !== undefined) {
        profileInput.displayOrder =
          parsedDisplayOrder;
      }

      try {
        const result =
          await upsertMetadataFieldProfile(
            pool,
            organizationId,
            profileInput
          );

        if (
          result.kind === "not_found"
        ) {
          res.status(404).json({
            success: false,
            error:
              "Metadata field definition not found or inactive.",
          });

          return;
        }

        if (
          result.kind === "forbidden"
        ) {
          res.status(403).json({
            success: false,
            error:
              "You cannot configure a field belonging to another organization.",
          });

          return;
        }

        res.json({
          success: true,
          profile: result.profile,
        });
      } catch (error) {
        console.error(
          "Metadata field profile save failed:",
          error
        );

        res.status(500).json({
          success: false,
          error:
            "Unable to save metadata field profile.",
        });
      }
    }
  );

  // ------------------------------------------------------------
  // DELETE ORGANIZATION FIELD PROFILE
  // ------------------------------------------------------------

  router.delete(
    "/:field_registry_id",
    requireAuthentication(pool),
    requireOrganizationContext(pool),
    requireRole(
      "ADMIN",
      "OWNER"
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

      const fieldRegistryId =
        parsePositiveInteger(
          req.params.field_registry_id
        );

      if (fieldRegistryId === null) {
        res.status(400).json({
          success: false,
          error:
            "A valid field_registry_id is required.",
        });

        return;
      }

      try {
        const deleted =
          await deleteMetadataFieldProfile(
            pool,
            organizationId,
            fieldRegistryId
          );

        if (!deleted) {
          res.status(404).json({
            success: false,
            error:
              "Organization field profile not found.",
          });

          return;
        }

        res.json({
          success: true,
          deleted,
        });
      } catch (error) {
        console.error(
          "Metadata field profile deletion failed:",
          error
        );

        res.status(500).json({
          success: false,
          error:
            "Unable to delete metadata field profile.",
        });
      }
    }
  );

  return router;
}
