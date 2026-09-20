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

/**
 * Normalizes a human-written document year.
 *
 * Rules:
 * - Four-digit years are preserved exactly.
 *   2000 -> 2000
 *   2009 -> 2009
 *   2018 -> 2018
 *   2026 -> 2026
 *
 * - Two-digit years may represent shortened years.
 *   01 -> 2001
 *   07 -> 2007
 *   18 -> 2018
 *   26 -> 2026
 *   92 -> 1992
 *
 * - "00" is NOT accepted as shorthand for 2000.
 *   The year 2000 must remain explicitly "2000".
 */
export function normalizeDocumentYear(
  value: unknown,
  referenceYear = new Date().getFullYear()
): number | null {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return null;
  }

  // Four-digit years are authoritative and remain unchanged.
  if (/^\d{4}$/.test(raw)) {
    const year = Number(raw);

    if (year < 1 || year > 9999) {
      return null;
    }

    return year;
  }

  // Only two-digit values may use the short-year rule.
  if (!/^\d{2}$/.test(raw)) {
    return null;
  }

  // 2000 must be written as 2000, not 00.
  if (raw === "00") {
    return null;
  }

  const shortYear = Number(raw);
  const currentShortYear = referenceYear % 100;

  /*
   * Current operating context:
   *
   * 00 is explicitly rejected.
   * 01 through the current short year are 20xx.
   * Values after the current short year are treated as 19xx.
   *
   * In 2026:
   * 01 -> 2001
   * 07 -> 2007
   * 18 -> 2018
   * 26 -> 2026
   * 92 -> 1992
   * 99 -> 1999
   */
  if (shortYear <= currentShortYear) {
    return 2000 + shortYear;
  }

  return 1900 + shortYear;
}

/**
 * Builds a PostgreSQL-safe document date from separately
 * extracted day, month, and year components.
 *
 * The year MUST already be identified as a year by the
 * extraction layer. This function does not decide whether
 * an ambiguous number such as "18" is a day or a year.
 */
export function buildDocumentDate(
  day: unknown,
  month: unknown,
  year: unknown
): string | null {
  const dayNumber = Number(day);
  const monthNumber = Number(month);
  const normalizedYear = normalizeDocumentYear(year);

  if (
    !Number.isInteger(dayNumber) ||
    !Number.isInteger(monthNumber) ||
    normalizedYear === null
  ) {
    return null;
  }

  if (monthNumber < 1 || monthNumber > 12) {
    return null;
  }

  if (dayNumber < 1 || dayNumber > 31) {
    return null;
  }

  const candidate = new Date(
    Date.UTC(
      normalizedYear,
      monthNumber - 1,
      dayNumber
    )
  );

  // Reject impossible dates such as 31 February.
  if (
    candidate.getUTCFullYear() !== normalizedYear ||
    candidate.getUTCMonth() !== monthNumber - 1 ||
    candidate.getUTCDate() !== dayNumber
  ) {
    return null;
  }

  const monthText = String(monthNumber).padStart(2, "0");
  const dayText = String(dayNumber).padStart(2, "0");

  return `${normalizedYear}-${monthText}-${dayText}`;
}
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


