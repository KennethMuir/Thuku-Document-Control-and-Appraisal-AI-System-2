import path from "path";
import fs from "fs";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { ocrPdf } from "./ocr.js";

export type ExtractedDocument = {
  text: string;
  title: string | null;
  date: string | null;
  extractedDateText: string | null;
  year: number | null;
  personName: string | null;
  referenceCode: string | null;
};

const DOCUMENT_MONTHS: Record<string, string> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  sept: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

const DOCUMENT_WEEKDAYS =
  "(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)";

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

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return false;
  }

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function normalizeExtractedYear(
  value: string
): number | null {
  const raw = value.trim();

  if (/^\d{4}$/.test(raw)) {
    const year = Number(raw);

    const currentYear =
      new Date().getFullYear();

    return (
      year >= 1900 &&
      year <= currentYear + 1
    )
      ? year
      : null;
  }

  if (!/^\d{2}$/.test(raw)) {
    return null;
  }

  /*
   * "00" is deliberately not treated as 2000.
   *
   * Short-year interpretation:
   * 01 -> 2001
   * 07 -> 2007
   * 10 -> 2010
   * 13 -> 2013
   * 18 -> 2018
   * 26 -> 2026
   * 92 -> 1992
   */
  if (raw === "00") {
    return null;
  }

  const shortYear =
    Number(raw);

  const currentShortYear =
    new Date().getFullYear() % 100;

  return shortYear <= currentShortYear
    ? 2000 + shortYear
    : 1900 + shortYear;
}

export function extractYearFromText(
  text: string
): number | null {
  if (!text) {
    return null;
  }

  /*
   * Four-digit years always take precedence.
   *
   * Examples:
   * 2000
   * 2009
   * 2018
   * 2026
   */
  const fourDigitYear =
    text.match(
      /\b(19\d{2}|20\d{2})\b/
    );

  if (fourDigitYear?.[1]) {
    const year =
      normalizeExtractedYear(
        fourDigitYear[1]
      );

    if (year !== null) {
      return year;
    }
  }

  /*
   * Explicit year/date labels allow
   * two-digit shorthand.
   *
   * Examples:
   * Year: 18 -> 2018
   * Year: 07 -> 2007
   * Year: 92 -> 1992
   */
  const explicitYear =
    text.match(
      /\b(?:year|dated|date)\s*[:\-]?\s*(\d{2}|\d{4})\b/i
    );

  if (explicitYear?.[1]) {
    const year =
      normalizeExtractedYear(
        explicitYear[1]
      );

    if (year !== null) {
      return year;
    }
  }

  /*
   * Numeric dates are DD/MM/YYYY by default.
   *
   * The first number is ALWAYS the day when
   * the DD/MM interpretation is valid.
   *
   * If DD/MM is impossible because the second
   * number is greater than 12, the source is
   * interpreted as MM/DD/YYYY.
   *
   * Examples:
   * 18/01/18 -> 18 January 2018
   * 6/13/17  -> June 13 2017
   */
  const numericDate =
    text.match(
      /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2}|\d{4})\b/
    );

  if (numericDate) {
    const first =
      Number(numericDate[1]);

    const second =
      Number(numericDate[2]);

    const year =
      normalizeExtractedYear(
        numericDate[3] ?? ""
      );

    if (year !== null) {
      if (
        first >= 1 &&
        first <= 31 &&
        second >= 1 &&
        second <= 12
      ) {
        return year;
      }

      if (
        first >= 1 &&
        first <= 12 &&
        second >= 1 &&
        second <= 31
      ) {
        return year;
      }
    }
  }

  /*
   * Partial date:
   *
   * Sun Jan 18
   *
   * Interpretation:
   * Sun = weekday
   * Jan = month
   * 18 = year
   *
   * There is no calendar day in this form.
   */
  const weekdayMonthYear =
    text.match(
      new RegExp(
        "\\b" +
          DOCUMENT_WEEKDAYS +
          "\\s+" +
          "(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)" +
          "\\s+" +
          "(\\d{2}|\\d{4})\\b",
        "i"
      )
    );

  if (weekdayMonthYear?.[3]) {
    const year =
      normalizeExtractedYear(
        weekdayMonthYear[3]
      );

    if (year !== null) {
      return year;
    }
  }

  /*
   * Partial date:
   *
   * Jan 18
   *
   * Interpretation:
   * Jan = month
   * 18 = year
   */
  const monthYear =
    text.match(
      new RegExp(
        "\\b" +
          "(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)" +
          "\\s+" +
          "(\\d{2}|\\d{4})\\b",
        "i"
      )
    );

  if (monthYear?.[2]) {
    const year =
      normalizeExtractedYear(
        monthYear[2]
      );

    if (year !== null) {
      return year;
    }
  }

  return null;
}

export function extractDateFromText(
  text: string
): string | null {
  if (!text) {
    return null;
  }

  /*
   * Complete written date with weekday.
   *
   * Sun Jan 18 2018
   * Sunday January 18 2018
   *
   * The weekday is source information.
   * document_date becomes the canonical
   * calendar date.
   */
  const weekdayWrittenDate =
    text.match(
      new RegExp(
        "\\b" +
          DOCUMENT_WEEKDAYS +
          "\\s+" +
          "(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)" +
          "\\s+" +
          "(\\d{1,2})" +
          "\\s+" +
          "(\\d{2}|\\d{4})\\b",
        "i"
      )
    );

  if (weekdayWrittenDate) {
    const month =
      DOCUMENT_MONTHS[
        weekdayWrittenDate[1]
          ?.toLowerCase() ?? ""
      ];

    const day =
      Number(
        weekdayWrittenDate[2]
      );

    const year =
      normalizeExtractedYear(
        weekdayWrittenDate[3] ?? ""
      );

    if (
      month &&
      year !== null &&
      isValidCalendarDate(
        year,
        Number(month),
        day
      )
    ) {
      return (
        String(year) +
        "-" +
        month +
        "-" +
        String(day).padStart(2, "0")
      );
    }
  }

  /*
   * Written day-month-year.
   *
   * 18 Jan 18
   * 18 January 2018
   */
  const writtenDate =
    text.match(
      new RegExp(
        "\\b" +
          "(\\d{1,2})" +
          "\\s+" +
          "(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)" +
          "\\s+" +
          "(\\d{2}|\\d{4})\\b",
        "i"
      )
    );

  if (writtenDate) {
    const day =
      Number(
        writtenDate[1]
      );

    const month =
      DOCUMENT_MONTHS[
        writtenDate[2]
          ?.toLowerCase() ?? ""
      ];

    const year =
      normalizeExtractedYear(
        writtenDate[3] ?? ""
      );

    if (
      month &&
      year !== null &&
      isValidCalendarDate(
        year,
        Number(month),
        day
      )
    ) {
      return (
        String(year) +
        "-" +
        month +
        "-" +
        String(day).padStart(2, "0")
      );
    }
  }

  /*
   * Written month-day-year.
   *
   * January 18, 2018
   * Jan 18 2018
   */
  const monthFirstDate =
    text.match(
      new RegExp(
        "\\b" +
          "(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)" +
          "\\s+" +
          "(\\d{1,2})" +
          "[,]?\\s+" +
          "(\\d{2}|\\d{4})\\b",
        "i"
      )
    );

  if (monthFirstDate) {
    const month =
      DOCUMENT_MONTHS[
        monthFirstDate[1]
          ?.toLowerCase() ?? ""
      ];

    const day =
      Number(
        monthFirstDate[2]
      );

    const year =
      normalizeExtractedYear(
        monthFirstDate[3] ?? ""
      );

    if (
      month &&
      year !== null &&
      isValidCalendarDate(
        year,
        Number(month),
        day
      )
    ) {
      return (
        String(year) +
        "-" +
        month +
        "-" +
        String(day).padStart(2, "0")
      );
    }
  }

  /*
   * Numeric dates.
   *
   * DEFAULT: DD/MM/YYYY
   *
   * The first component is the day when
   * the DD/MM interpretation is valid.
   *
   * If DD/MM is impossible because the second
   * component is greater than 12, interpret as
   * MM/DD/YYYY.
   *
   * Examples:
   * 18/01/18 -> 2018-01-18
   * 18/01/2018 -> 2018-01-18
   * 6/13/17 -> 2017-06-13
   */
  const numericDate =
    text.match(
      /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2}|\d{4})\b/
    );

  if (numericDate) {
    const first =
      Number(
        numericDate[1]
      );

    const second =
      Number(
        numericDate[2]
      );

    const year =
      normalizeExtractedYear(
        numericDate[3] ?? ""
      );

    if (year !== null) {
      /*
       * First interpretation:
       * DD/MM/YYYY.
       */
      if (
        first >= 1 &&
        first <= 31 &&
        second >= 1 &&
        second <= 12 &&
        isValidCalendarDate(
          year,
          second,
          first
        )
      ) {
        return (
          String(year) +
          "-" +
          String(second).padStart(2, "0") +
          "-" +
          String(first).padStart(2, "0")
        );
      }

      /*
       * Fallback:
       * MM/DD/YYYY.
       *
       * Only reached when DD/MM/YYYY
       * was impossible.
       */
      if (
        first >= 1 &&
        first <= 12 &&
        second >= 1 &&
        second <= 31 &&
        isValidCalendarDate(
          year,
          first,
          second
        )
      ) {
        return (
          String(year) +
          "-" +
          String(first).padStart(2, "0") +
          "-" +
          String(second).padStart(2, "0")
        );
      }
    }
  }

  return null;
}

/*
 * Preserve meaningful partial date information
 * when the source does not contain a calendar day.
 *
 * Examples:
 *
 * Sun Jan 18
 * -> Sun Jan 2018
 *
 * Jan 18
 * -> Jan 2018
 *
 * The complete PostgreSQL DATE remains NULL because
 * PostgreSQL DATE requires a calendar day.
 *
 * IMPORTANT:
 * completeDate is checked first so that:
 *
 * Sun Jan 18 2018
 *
 * does NOT become:
 *
 * Sun Jan 2018
 */
export function extractPartialDateText(
  text: string,
  year: number | null,
  completeDate: string | null
): string | null {
  if (
    !text ||
    year === null ||
    completeDate !== null
  ) {
    return null;
  }

  /*
   * Weekday + month + year.
   *
   * Example:
   * Sun Jan 18
   *
   * 18 is interpreted as the year because
   * the context identifies it as the year.
   */
  const weekdayMonthYear =
    text.match(
      new RegExp(
        "\\b" +
          DOCUMENT_WEEKDAYS +
          "\\s+" +
          "(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)" +
          "\\s+" +
          "(\\d{2}|\\d{4})\\b",
        "i"
      )
    );

  if (
    weekdayMonthYear?.[1] &&
    weekdayMonthYear?.[2]
  ) {
    const sourceYear =
      normalizeExtractedYear(
        weekdayMonthYear[2]
      );

    if (sourceYear === year) {
      const weekday =
        weekdayMonthYear[0]
          .split(/\s+/)[0];

      const month =
        weekdayMonthYear[1];

      return (
        weekday +
        " " +
        month +
        " " +
        String(year)
      );
    }
  }

  /*
   * Month + year.
   *
   * Example:
   * Jan 18
   *
   * 18 is interpreted as the year because
   * it appears immediately after a recognized month.
   */
  const monthYear =
    text.match(
      new RegExp(
        "\\b" +
          "(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)" +
          "\\s+" +
          "(\\d{2}|\\d{4})\\b",
        "i"
      )
    );

  if (
    monthYear?.[1] &&
    monthYear?.[2]
  ) {
    const sourceYear =
      normalizeExtractedYear(
        monthYear[2]
      );

    if (sourceYear === year) {
      return (
        monthYear[1] +
        " " +
        String(year)
      );
    }
  }

  return null;
}

export function extractReferenceCode(
  text: string
): string | null {
  const match =
    text.match(
      /\b[A-Z]{2,10}-\d{1,6}\b/
    );

  return match
    ? match[0].toUpperCase()
    : null;
}

export function cleanCandidateName(
  value: string
): string {
  return value
    .replace(
      /^(name|employee name|full name|person|staff name)\s*[:\-]\s*/i,
      ""
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

export function extractPersonName(
  text: string
): string | null {
  const lines =
    text
      .split(/\r?\n/)
      .map(
        (line) => line.trim()
      )
      .filter(Boolean);

  const namePatterns = [
    /^(?:name|employee name|full name|person|staff name)\s*[:\-]\s*(.+)$/i,
    /^(?:prepared for|submitted by|addressed to)\s*[:\-]\s*(.+)$/i,
  ];

  for (const line of lines) {
    for (
      const pattern of namePatterns
    ) {
      const match =
        line.match(pattern);

      if (match?.[1]) {
        const candidate =
          cleanCandidateName(
            match[1]
          );

        if (
          candidate
            .split(" ")
            .length >= 2 &&
          candidate.length <= 120
        ) {
          return candidate;
        }
      }
    }
  }

  return null;
}

export function extractTitle(
  text: string,
  filename: string
): string | null {
  const lines =
    text
      .split(/\r?\n/)
      .map(
        (line) => line.trim()
      )
      .filter(Boolean);

  const titlePatterns = [
    /^(?:title|document title|subject)\s*[:\-]\s*(.+)$/i,
  ];

  for (const line of lines) {
    for (
      const pattern of titlePatterns
    ) {
      const match =
        line.match(pattern);

      if (match?.[1]) {
        const candidate =
          match[1]
            .replace(
              /\s+/g,
              " "
            )
            .trim();

        if (
          candidate.length > 1
        ) {
          return candidate;
        }
      }
    }
  }

  if (lines.length > 0) {
    const firstLine =
      lines[0];

    if (
      firstLine &&
      firstLine.length >= 3 &&
      firstLine.length <= 200
    ) {
      return firstLine;
    }
  }

  const filenameTitle =
    path
      .basename(
        filename,
        path.extname(filename)
      )
      .replace(
        /[_\-]+/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  return filenameTitle || null;
}

export async function extractPdf(
  filePath: string
): Promise<string> {
  const buffer =
    await fs.promises.readFile(
      filePath
    );

  const parser =
    new PDFParse({
      data: buffer,
    });

  try {
    const result =
      await parser.getText();

    return String(
      result.text || ""
    ).trim();
  } finally {
    await parser.destroy();
  }
}

export async function extractDocx(
  filePath: string
): Promise<string> {
  const result =
    await mammoth.extractRawText({
      path: filePath,
    });

  return String(
    result.value || ""
  ).trim();
}

export async function extractDocumentContent(
  filePath: string,
  extension: string,
  filename: string
): Promise<ExtractedDocument> {
  let text = "";

  if (extension === ".pdf") {
    text =
      await extractPdf(
        filePath
      );

    const initialText =
      text.trim();

    if (
      initialText.length < 100
    ) {
      try {
        const ocrResult =
          await ocrPdf(
            filePath
          );

        if (
          ocrResult.text.trim()
            .length >
          initialText.length
        ) {
          text =
            ocrResult.text;
        }
      } catch (error) {
        console.error(
          "PDF OCR fallback failed:",
          error
        );
      }
    }
  } else if (
    extension === ".docx"
  ) {
    text =
      await extractDocx(
        filePath
      );
  }

  const cleanText =
    text.trim();

  const year =
    extractYearFromText(
      cleanText
    );

  const date =
    extractDateFromText(
      cleanText
    );

  /*
   * Only preserve a partial date when
   * there is no complete calendar date.
   *
   * This prevents:
   *
   * Sun Jan 18 2018
   *
   * from producing both:
   *
   * date = 2018-01-18
   * extractedDateText = Sun Jan 2018
   */
  const extractedDateText =
    extractPartialDateText(
      cleanText,
      year,
      date
    );

  const personName =
    extractPersonName(
      cleanText
    );

  const referenceCode =
    extractReferenceCode(
      cleanText
    );

  const title =
    extractTitle(
      cleanText,
      filename
    );

  return {
    text: cleanText,
    title,
    date,
    extractedDateText,
    year,
    personName,
    referenceCode,
  };
}