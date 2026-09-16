export type ReviewMetadataInput = {
  referenceCode?: unknown;
  title?: unknown;
  personName?: unknown;
  departmentId?: unknown;
  documentTypeId?: unknown;
  section?: unknown;
  year?: unknown;
  documentDate?: unknown;
  description?: unknown;
  additionalMetadata?: unknown;
};

export const RESERVED_METADATA_KEYS = new Set([
  "id",
  "reference_code",
  "referenceCode",
  "title",
  "person_name",
  "personName",
  "department",
  "department_id",
  "departmentId",
  "document_type",
  "document_type_id",
  "documentTypeId",
  "section",
  "year",
  "document_date",
  "documentDate",
  "description",
  "status",
  "created_at",
  "updated_at",
  "createdAt",
  "updatedAt",
]);

export function sanitizeAdditionalMetadata(
  value: unknown
): Record<string, string | number | boolean | null> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  const result: Record<
    string,
    string | number | boolean | null
  > = {};

  for (const [rawKey, rawValue] of Object.entries(
    value as Record<string, unknown>
  )) {
    const key = rawKey.trim();

    if (!key) {
      continue;
    }

    if (
      key.length > 100 ||
      RESERVED_METADATA_KEYS.has(key) ||
      key === "__proto__" ||
      key === "constructor" ||
      key === "prototype"
    ) {
      continue;
    }

    if (
      typeof rawValue !== "string" &&
      typeof rawValue !== "number" &&
      typeof rawValue !== "boolean" &&
      rawValue !== null
    ) {
      continue;
    }

    if (
      typeof rawValue === "string" &&
      rawValue.length > 5000
    ) {
      continue;
    }

    if (
      typeof rawValue === "number" &&
      !Number.isFinite(rawValue)
    ) {
      continue;
    }

    result[key] = rawValue;

    if (Object.keys(result).length >= 100) {
      break;
    }
  }

  return result;
}

export function parseReviewMetadata(
  value: unknown
): ReviewMetadataInput | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as ReviewMetadataInput;
}

