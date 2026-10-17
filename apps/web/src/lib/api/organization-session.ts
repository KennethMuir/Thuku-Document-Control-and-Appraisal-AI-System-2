import { getCurrentUser } from "@/lib/api/auth";
import { clearSelectedOrganizationId } from "@/lib/organization/selection";

type ErrorPayload = {
  code?: string;
};

export async function getCurrentUserWithOrganizationRecovery(): Promise<Response> {
  const response = await getCurrentUser();

  if (response.status !== 403) {
    return response;
  }

  let payload: ErrorPayload;

  try {
    payload = await response.clone().json() as ErrorPayload;
  } catch {
    return response;
  }

  if (
    payload.code !== "ORGANIZATION_ACCESS_DENIED" &&
    payload.code !== "INVALID_ORGANIZATION_SELECTION"
  ) {
    return response;
  }

  clearSelectedOrganizationId();

  // Retry once after clearing only a known stale or invalid selection.
  return getCurrentUser();
}