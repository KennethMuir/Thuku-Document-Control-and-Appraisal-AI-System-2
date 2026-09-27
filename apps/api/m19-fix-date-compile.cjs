const fs = require("fs");

const file = "src/services/documentExtraction.ts";
let source = fs.readFileSync(file, "utf8");

const helper = `
function isValidCalendarDate(
  year: number,
  month: number,
  day: number
): boolean {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return false;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
`;

if (!source.includes("function isValidCalendarDate(")) {
  const marker = "function normalizeExtractedYear";
  const markerIndex = source.indexOf(marker);

  if (markerIndex === -1) {
    throw new Error(
      "Could not find normalizeExtractedYear. No changes were made."
    );
  }

  source =
    source.slice(0, markerIndex) +
    helper +
    "\n" +
    source.slice(markerIndex);
}

source = source.replace(
  /normalizeExtractedYear\(\s*numericDate\[3\]\s*\)/g,
  "normalizeExtractedYear(numericDate[3] ?? \"\")"
);

source = source.replace(
  /normalizeExtractedYear\(\s*weekdayWrittenDate\[3\]\s*\)/g,
  "normalizeExtractedYear(weekdayWrittenDate[3] ?? \"\")"
);

source = source.replace(
  /normalizeExtractedYear\(\s*writtenDate\[3\]\s*\)/g,
  "normalizeExtractedYear(writtenDate[3] ?? \"\")"
);

source = source.replace(
  /normalizeExtractedYear\(\s*monthFirstDate\[3\]\s*\)/g,
  "normalizeExtractedYear(monthFirstDate[3] ?? \"\")"
);

source = source.replace(
  /normalizeExtractedYear\(\s*numericDate\[3\]\s*\)/g,
  "normalizeExtractedYear(numericDate[3] ?? \"\")"
);

fs.writeFileSync(file, source, "utf8");

console.log("M19 date compile fixes applied successfully.");
