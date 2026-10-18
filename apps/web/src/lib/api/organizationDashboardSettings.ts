import { apiFetch } from "@/lib/api/client";

import type {
  OrganizationDashboardSettings,
} from "@/types/organizationDashboardSettings";

type SettingsResponse = {
  success: boolean;
  settings?: OrganizationDashboardSettings;
  updatedAt?: string;
  error?: string;
};

export async function getOrganizationDashboardSettings():
  Promise<SettingsResponse> {
  const response = await apiFetch(
    "/api/organization-dashboard-settings",
    { method: "GET" },
  );

  const result = await response.json() as SettingsResponse;

  if (!response.ok || !result.success || !result.settings) {
    throw new Error(
      result.error ?? "Unable to load dashboard settings.",
    );
  }

  return result;
}

export async function saveOrganizationDashboardSettings(
  settings: Partial<OrganizationDashboardSettings>,
): Promise<SettingsResponse> {
  const response = await apiFetch(
    "/api/organization-dashboard-settings",
    {
      method: "PUT",
      json: settings,
    },
  );

  const result = await response.json() as SettingsResponse;

  if (!response.ok || !result.success || !result.settings) {
    throw new Error(
      result.error ?? "Unable to save dashboard settings.",
    );
  }

  return result;
}

// M29A branding images: binary files are uploaded separately from JSON settings.
export type OrganizationBrandingImageSlot =
  | "SIDEBAR"
  | "DASHBOARD"
  | "INTRODUCTION";

type BrandingImageMutationResponse = {
  success: boolean;
  slot?: OrganizationBrandingImageSlot;
  error?: string;
};

async function readBrandingImageMutationResponse(
  response: Response,
  fallbackMessage: string,
): Promise<BrandingImageMutationResponse> {
  const result = await response.json() as BrandingImageMutationResponse;

  if (!response.ok || !result.success) {
    throw new Error(result.error ?? fallbackMessage);
  }

  return result;
}

export async function uploadOrganizationDashboardBrandingImage(
  slot: OrganizationBrandingImageSlot,
  file: File,
): Promise<BrandingImageMutationResponse> {
  const body = new FormData();
  body.append("file", file);

  const response = await apiFetch(
    `/api/organization-dashboard-settings/images/${slot}`,
    {
      method: "POST",
      body,
    },
  );

  return readBrandingImageMutationResponse(
    response,
    "Unable to upload the branding image.",
  );
}

export async function removeOrganizationDashboardBrandingImage(
  slot: OrganizationBrandingImageSlot,
): Promise<BrandingImageMutationResponse> {
  const response = await apiFetch(
    `/api/organization-dashboard-settings/images/${slot}`,
    {
      method: "DELETE",
    },
  );

  return readBrandingImageMutationResponse(
    response,
    "Unable to remove the branding image.",
  );
}