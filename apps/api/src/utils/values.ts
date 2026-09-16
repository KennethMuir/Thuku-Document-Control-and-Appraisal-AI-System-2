export function normalizeText(
  value: string | null | undefined
): string {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeComparable(
  value: string | null | undefined
): string {
  return normalizeText(value)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function containsNormalized(
  source: string,
  value: string | null | undefined
): boolean {
  const normalizedSource =
    normalizeComparable(source);

  const normalizedValue =
    normalizeComparable(value);

  if (!normalizedValue) {
    return false;
  }

  return normalizedSource.includes(
    normalizedValue
  );
}

export function nullableString(
  value: unknown
): string | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const normalized = String(value).trim();

  return normalized || null;
}

export function nullableNumber(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

export function nullableInteger(
  value: unknown
): number | null {
  const number = nullableNumber(value);

  if (
    number === null ||
    !Number.isInteger(number)
  ) {
    return null;
  }

  return number;
}

export function nullablePositiveInteger(
  value: unknown
): number | null {
  const number =
    nullableInteger(value);

  if (
    number === null ||
    number <= 0
  ) {
    return null;
  }

  return number;
}
