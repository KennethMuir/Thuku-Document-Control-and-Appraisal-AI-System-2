const ORGANIZATION_SELECTION_KEY = "document-appraisal:selected-organization";

export type OrganizationRole =
  | "OWNER"
  | "ADMIN"
  | "APPRAISER"
  | "VIEWER";

export type OrganizationOption = {
  id: number;
  name: string;
  role: OrganizationRole;
};

export function getSelectedOrganizationId(): number | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const value = window.localStorage.getItem(
      ORGANIZATION_SELECTION_KEY
    );

    if (value === null) {
      return null;
    }

    if (!/^[1-9]\d*$/.test(value)) {
      clearSelectedOrganizationId();
      return null;
    }

    const id = Number(value);

    if (!Number.isSafeInteger(id)) {
      clearSelectedOrganizationId();
      return null;
    }

    return id;
  } catch {
    return null;
  }
}

export function setSelectedOrganizationId(id: number): void {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("A valid organization ID is required.");
  }

  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    ORGANIZATION_SELECTION_KEY,
    String(id)
  );
}

export function clearSelectedOrganizationId(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(
      ORGANIZATION_SELECTION_KEY
    );
  } catch {
    // Storage may be unavailable; callers must still handle API errors.
  }
}