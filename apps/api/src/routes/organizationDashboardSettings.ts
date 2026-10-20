import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Router, type Request, type Response } from "express";
import type { Pool } from "pg";

import {
  requireAuthentication,
  requireOrganizationContext,
  requireRole,
  type AuthenticatedRequest,
} from "../middleware/auth.js";

const DEFAULT_SETTINGS = {
  primaryColor: "#172554",
  accentColor: "#6366F1",
  backgroundColor: "#F8FAFC",
  textColor: "#000000",
  headerBackgroundColor: "#172554",
  headerTextColor: "#FFFFFF",
  sidebarBackgroundColor: "#FFFFFF",
  sidebarTextColor: "#000000",
  sidebarActiveColor: "#172554",
  footerBackgroundColor: "#FFFFFF",
  footerTextColor: "#000000",
  surfaceColor: "#FFFFFF",
  borderColor: "#E2E8F0",
  buttonBackgroundColor: "#4F46E5",
  buttonTextColor: "#FFFFFF",
  buttonHoverColor: "#4338CA",
  headerStyle: "SOLID",
  dashboardBackgroundFade: 0,
  brandingImages: {},
  theme: "LIGHT",
  dashboardLayout: "COMFORTABLE",
  companyProfile: "GENERAL",
  showWelcomePanel: true,
  visibleStatCards: [
    "documents",
    "metadata",
    "awaiting",
    "review",
    "linked",
    "unlinked",
  ],
};

const COLOR_KEYS = [
  "primaryColor",
  "accentColor",
  "backgroundColor",
  "textColor",
  "headerBackgroundColor",
  "headerTextColor",
  "sidebarBackgroundColor",
  "sidebarTextColor",
  "sidebarActiveColor",
  "footerBackgroundColor",
  "footerTextColor",
  "surfaceColor",
  "borderColor",
  "buttonBackgroundColor",
  "buttonTextColor",
  "buttonHoverColor",
] as const;

const ENUM_VALUES: Record<string, readonly string[]> = {
  headerStyle: ["SOLID", "GRADIENT", "IMAGE"],
  theme: ["LIGHT", "DARK", "SYSTEM"],
  dashboardLayout: ["COMFORTABLE", "COMPACT"],
  companyProfile: [
    "GENERAL",
    "GOVERNMENT",
    "HEALTHCARE",
    "AVIATION",
    "LEGAL",
    "EDUCATION",
    "OTHER",
  ],
};

const STAT_KEYS = [
  "documents",
  "metadata",
  "awaiting",
  "review",
  "linked",
  "unlinked",
] as const;

type Settings = {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  headerBackgroundColor: string;
  headerTextColor: string;
  sidebarBackgroundColor: string;
  sidebarTextColor: string;
  sidebarActiveColor: string;
  footerBackgroundColor: string;
  footerTextColor: string;
  surfaceColor: string;
  borderColor: string;
  buttonBackgroundColor: string;
  buttonTextColor: string;
  buttonHoverColor: string;
  headerStyle: string;
  dashboardBackgroundFade: number;
  brandingImages?: Partial<Record<"SIDEBAR" | "DASHBOARD" | "INTRODUCTION", unknown>>;
  theme: string;
  dashboardLayout: string;
  companyProfile: string;
  showWelcomePanel: boolean;
  visibleStatCards: string[];
};

function getOrganizationId(req: Request, res: Response): number | null {
  const id = (req as AuthenticatedRequest).authOrganization?.organizationId;

  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) {
    res.status(403).json({
      success: false,
      error: "Organization context is required.",
    });
    return null;
  }

  return id;
}

function validateSettings(
  input: unknown,
  current: Settings,
): { settings?: Settings; error?: string } {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { error: "Settings must be a JSON object." };
  }

  const patch = input as Record<string, unknown>;
  const allowedKeys = new Set([
    ...COLOR_KEYS,
    ...Object.keys(ENUM_VALUES),
    "showWelcomePanel",
    "visibleStatCards",
    "dashboardBackgroundFade",
    // Image references are managed only by the dedicated image endpoints.
    "brandingImages",
  ]);

  for (const key of Object.keys(patch)) {
    if (!allowedKeys.has(key)) {
      return { error: `Unsupported setting: ${key}` };
    }
  }

  const next: Settings = {
    ...current,
    visibleStatCards: [...current.visibleStatCards],
  };

  for (const key of COLOR_KEYS) {
    if (patch[key] === undefined) continue;

    if (
      typeof patch[key] !== "string" ||
      !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(patch[key] as string)
    ) {
      return { error: `${key} must be a valid HEX color.` };
    }

    const normalizedColor = (patch[key] as string).toUpperCase();
    next[key] = normalizedColor.length === 4
      ? "#" + normalizedColor.slice(1).split("").map((character) => character + character).join("")
      : normalizedColor;
  }

  for (const [key, values] of Object.entries(ENUM_VALUES)) {
    const value = patch[key];
    if (value === undefined) continue;

    if (typeof value !== "string" || !values.includes(value)) {
      return { error: `Invalid value for ${key}.` };
    }

    (next as unknown as Record<string, unknown>)[key] = value;
  }

  if (patch.dashboardBackgroundFade !== undefined) {
    if (
      typeof patch.dashboardBackgroundFade !== "number" ||
      !Number.isFinite(patch.dashboardBackgroundFade) ||
      patch.dashboardBackgroundFade < 0 ||
      patch.dashboardBackgroundFade > 0.75
    ) {
      return { error: "dashboardBackgroundFade must be a number between 0 and 0.75." };
    }
    next.dashboardBackgroundFade = patch.dashboardBackgroundFade;
  }

  if (patch.showWelcomePanel !== undefined) {
    if (typeof patch.showWelcomePanel !== "boolean") {
      return { error: "showWelcomePanel must be a boolean." };
    }
    next.showWelcomePanel = patch.showWelcomePanel;
  }

  if (patch.visibleStatCards !== undefined) {
    if (
      !Array.isArray(patch.visibleStatCards) ||
      patch.visibleStatCards.length > STAT_KEYS.length ||
      patch.visibleStatCards.some(
        (value) =>
          typeof value !== "string" ||
          !(STAT_KEYS as readonly string[]).includes(value),
      ) ||
      new Set(patch.visibleStatCards).size !== patch.visibleStatCards.length
    ) {
      return { error: "visibleStatCards contains an invalid or duplicate card." };
    }

    next.visibleStatCards = patch.visibleStatCards as string[];
  }

  return { settings: next };
}

export function createOrganizationDashboardSettingsRouter(pool: Pool, brandingRoot: string, brandingUpload: import("multer").Multer) {
  const router = Router();

  router.get(
    "/",
    requireAuthentication(pool),
    requireOrganizationContext(pool),
    async (req: Request, res: Response) => {
      const organizationId = getOrganizationId(req, res);
      if (organizationId === null) return;

      try {
        const result = await pool.query(
          `SELECT settings
           FROM organization_dashboard_settings
           WHERE organization_id = $1`,
          [organizationId],
        );

        const saved = result.rows[0]?.settings ?? {};
        res.json({
          success: true,
          settings: { ...DEFAULT_SETTINGS, ...saved },
        });
      } catch (error) {
        console.error("Organization dashboard settings read failed:", error);
        res.status(500).json({
          success: false,
          error: "Unable to retrieve dashboard settings.",
        });
      }
    },
  );

  router.put(
    "/",
    requireAuthentication(pool),
    requireOrganizationContext(pool),
    requireRole("ADMIN", "OWNER"),
    async (req: Request, res: Response) => {
      const organizationId = getOrganizationId(req, res);
      if (organizationId === null) return;

      try {
        const existing = await pool.query(
          `SELECT settings
           FROM organization_dashboard_settings
           WHERE organization_id = $1`,
          [organizationId],
        );

        const current = {
          ...DEFAULT_SETTINGS,
          ...(existing.rows[0]?.settings ?? {}),
        } as Settings;

        const validation = validateSettings(req.body, current);
        if (!validation.settings) {
          res.status(400).json({
            success: false,
            error: validation.error ?? "Invalid settings.",
          });
          return;
        }

        const actorId = (req as AuthenticatedRequest).authUser?.id ?? null;
        const saved = await pool.query(
          `INSERT INTO organization_dashboard_settings
             (organization_id, settings, updated_by, created_at, updated_at)
           VALUES ($1, $2::jsonb, $3, NOW(), NOW())
           ON CONFLICT (organization_id)
           DO UPDATE SET
             settings = EXCLUDED.settings
               || jsonb_build_object(
                 'brandingImages',
                 COALESCE(
                   organization_dashboard_settings.settings->'brandingImages',
                   '{}'::jsonb
                 )
               ),
             updated_by = EXCLUDED.updated_by,
             updated_at = NOW()
           RETURNING settings, updated_at`,
          [
            organizationId,
            JSON.stringify(validation.settings),
            actorId,
          ],
        );

        res.json({
          success: true,
          settings: {
            ...DEFAULT_SETTINGS,
            ...saved.rows[0].settings,
          },
          updatedAt: saved.rows[0].updated_at,
        });
      } catch (error) {
        console.error("Organization dashboard settings save failed:", error);
        res.status(500).json({
          success: false,
          error: "Unable to save dashboard settings.",
        });
      }
    },
  );

    // M29A_BRANDING_IMAGE_ROUTES
  const allowedImageSlots = ["SIDEBAR", "DASHBOARD", "INTRODUCTION"] as const;
  type BrandingSlot = typeof allowedImageSlots[number];

  function parseSlot(value: string): BrandingSlot | null {
    return allowedImageSlots.includes(value as BrandingSlot)
      ? value as BrandingSlot
      : null;
  }

  function safeImageFilename(value: unknown): value is string {
    return typeof value === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/.test(value);
  }

  async function readBrandingImages(organizationId: string) {
    const result = await pool.query(
      `SELECT settings->'brandingImages' AS images
       FROM organization_dashboard_settings
       WHERE organization_id = $1`,
      [organizationId],
    );
    return result.rows[0]?.images ?? {};
  }

  router.get(
    "/images/:slot",
    requireAuthentication(pool),
    requireOrganizationContext(pool),
    async (req: Request, res: Response) => {
      const auth = req as AuthenticatedRequest;
      const organizationId = auth.authOrganization?.organizationId;
      const slot = parseSlot(typeof req.params.slot === "string" ? req.params.slot : "");

      if (!organizationId) {
        res.status(403).json({ success: false, error: "Organization context required." });
        return;
      }
      if (!slot) {
        res.status(400).json({ success: false, error: "Unsupported image slot." });
        return;
      }

      try {
        const images = await readBrandingImages(String(organizationId));
        const filename = images[slot];

        if (!safeImageFilename(filename)) {
          res.status(404).json({ success: false, error: "No image is configured for this slot." });
          return;
        }

        const organizationDirectory = path.resolve(brandingRoot, String(organizationId));
        const imagePath = path.resolve(organizationDirectory, filename);

        if (path.dirname(imagePath) !== organizationDirectory) {
          res.status(400).json({ success: false, error: "Invalid image reference." });
          return;
        }

        const extension = path.extname(filename).toLowerCase();
        const contentType = extension === ".jpg"
          ? "image/jpeg"
          : extension === ".png"
            ? "image/png"
            : "image/webp";

        res.setHeader("Content-Type", contentType);
        res.setHeader("Content-Disposition", "inline");
        res.setHeader("Cache-Control", "private, no-cache");
        res.setHeader("X-Content-Type-Options", "nosniff");

        const stream = fs.createReadStream(imagePath);
        stream.on("error", () => {
          if (!res.headersSent) {
            res.status(404).json({ success: false, error: "Image file not found." });
          } else {
            res.destroy();
          }
        });
        stream.pipe(res);
      } catch (error) {
        console.error("Branding image read failed:", error);
        res.status(500).json({ success: false, error: "Unable to load branding image." });
      }
    },
  );

  router.post(
    "/images/:slot",
    requireAuthentication(pool),
    requireOrganizationContext(pool),
    requireRole("ADMIN", "OWNER"),
    brandingUpload.single("file"),
    async (req: Request, res: Response) => {
      const auth = req as AuthenticatedRequest;
      const organizationId = auth.authOrganization?.organizationId;
      const slot = parseSlot(typeof req.params.slot === "string" ? req.params.slot : "");
      const file = req.file;

      if (!organizationId) {
        res.status(403).json({ success: false, error: "Organization context required." });
        return;
      }
      if (!slot) {
        if (file?.path) await fs.promises.rm(file.path, { force: true }).catch(() => undefined);
        res.status(400).json({ success: false, error: "Unsupported image slot." });
        return;
      }
      if (!file) {
        res.status(400).json({ success: false, error: "Choose an image file to upload." });
        return;
      }

      let destination: string | null = null;

      try {
        const handle = await fs.promises.open(file.path, "r");
        const signature = Buffer.alloc(12);
        const readResult = await handle.read(signature, 0, signature.length, 0);
        await handle.close();

        const bytes = signature.subarray(0, readResult.bytesRead);
        let extension: "jpg" | "png" | "webp" | null = null;

        if (bytes.length >= 3 &&
            bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
          extension = "jpg";
        } else if (
          bytes.length >= 8 &&
          bytes[0] === 0x89 && bytes[1] === 0x50 &&
          bytes[2] === 0x4e && bytes[3] === 0x47 &&
          bytes[4] === 0x0d && bytes[5] === 0x0a &&
          bytes[6] === 0x1a && bytes[7] === 0x0a
        ) {
          extension = "png";
        } else if (
          bytes.length >= 12 &&
          bytes.toString("ascii", 0, 4) === "RIFF" &&
          bytes.toString("ascii", 8, 12) === "WEBP"
        ) {
          extension = "webp";
        }

        if (!extension) {
          res.status(400).json({
            success: false,
            error: "Unsupported image content. Use a valid JPEG, PNG, or WebP image.",
          });
          return;
        }

        const organizationDirectory = path.resolve(brandingRoot, String(organizationId));
        await fs.promises.mkdir(organizationDirectory, { recursive: true });

        const filename = `${crypto.randomUUID()}.${extension}`;
        destination = path.join(organizationDirectory, filename);

        const existingImages = await readBrandingImages(String(organizationId));
        const previousFilename = existingImages[slot];

        await fs.promises.rename(file.path, destination);

        const imageMap = JSON.stringify({ [slot]: filename });
        await pool.query(
          `INSERT INTO organization_dashboard_settings (organization_id, settings)
           VALUES ($1, jsonb_build_object('brandingImages', $2::jsonb))
           ON CONFLICT (organization_id) DO UPDATE
           SET settings = jsonb_set(
             COALESCE(organization_dashboard_settings.settings, '{}'::jsonb),
             '{brandingImages}',
             COALESCE(organization_dashboard_settings.settings->'brandingImages', '{}'::jsonb)
               || (EXCLUDED.settings->'brandingImages'),
             true
           ),
           updated_at = NOW()`,
          [organizationId, imageMap],
        );

        destination = null;

        if (safeImageFilename(previousFilename) && previousFilename !== filename) {
          await fs.promises.rm(
            path.join(organizationDirectory, previousFilename),
            { force: true },
          ).catch((error) => console.error("Old branding image cleanup failed:", error));
        }

        res.status(200).json({ success: true, slot });
      } catch (error) {
        if (destination) {
          await fs.promises.rm(destination, { force: true }).catch(() => undefined);
        }
        console.error("Branding image upload failed:", error);
        res.status(500).json({ success: false, error: "Unable to save branding image." });
      } finally {
        await fs.promises.rm(file.path, { force: true }).catch(() => undefined);
      }
    },
  );

  router.delete(
    "/images/:slot",
    requireAuthentication(pool),
    requireOrganizationContext(pool),
    requireRole("ADMIN", "OWNER"),
    async (req: Request, res: Response) => {
      const auth = req as AuthenticatedRequest;
      const organizationId = auth.authOrganization?.organizationId;
      const slot = parseSlot(typeof req.params.slot === "string" ? req.params.slot : "");

      if (!organizationId) {
        res.status(403).json({ success: false, error: "Organization context required." });
        return;
      }
      if (!slot) {
        res.status(400).json({ success: false, error: "Unsupported image slot." });
        return;
      }

      try {
        const images = await readBrandingImages(String(organizationId));
        const previousFilename = images[slot];

        await pool.query(
          `UPDATE organization_dashboard_settings
           SET settings = jsonb_set(
             COALESCE(settings, '{}'::jsonb),
             '{brandingImages}',
             COALESCE(settings->'brandingImages', '{}'::jsonb) - $2,
             true
           ),
           updated_at = NOW()
           WHERE organization_id = $1`,
          [organizationId, slot],
        );

        if (safeImageFilename(previousFilename)) {
          await fs.promises.rm(
            path.join(path.resolve(brandingRoot, String(organizationId)), previousFilename),
            { force: true },
          ).catch((error) => console.error("Branding image cleanup failed:", error));
        }

        res.status(200).json({ success: true, slot });
      } catch (error) {
        console.error("Branding image removal failed:", error);
        res.status(500).json({ success: false, error: "Unable to remove branding image." });
      }
    },
  );
  return router;
}
