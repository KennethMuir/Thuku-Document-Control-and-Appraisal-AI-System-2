import path from "path";
import fs from "fs";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { ocrPdf } from "./ocr.js";

export type ExtractedDocument = {
  text: string;
  title: string | null;
  date: string | null;
  year: number | null;
  personName: string | null;
  referenceCode: string | null;
};

export function extractYearFromText(
  text: string
): number | null {
  const matches =
    text.match(/\b(19|20)\d{2}\b/g);

  if (
    !matches ||
    matches.length === 0
  ) {
    return null;
  }

  const currentYear =
    new Date().getFullYear();

  const validYear =
    matches.find((value) => {
      const year = Number(value);

      return (
        year >= 1900 &&
        year <= currentYear + 1
      );
    });

  return validYear
    ? Number(validYear)
    : null;
}

export function extractDateFromText(
  text: string
): string | null {
  const patterns = [
    /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+((?:19|20)\d{2})\b/i,
    /\b(\d{1,2})[\/\-](\d{1,2})[\/\-]((?:19|20)\d{2})\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (!match) {
      continue;
    }

    if (pattern === patterns[0]) {
      const day = Number(match[1]);
      const monthName = match[2];
      const year = Number(match[3]);

      const months: Record<
        string,
        string
      > = {
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
      };

      const month =
        months[
          monthName?.toLowerCase() ?? ""
        ];

      if (month) {
        return `${year}-${month}-${String(
          day
        ).padStart(2, "0")}`;
      }
    }

    if (pattern === patterns[1]) {
      const first = Number(match[1]);
      const second = Number(match[2]);
      const year = Number(match[3]);

      let day = first;
      let month = second;

      if (
        first <= 12 &&
        second > 12
      ) {
        month = first;
        day = second;
      }

      if (
        day >= 1 &&
        day <= 31 &&
        month >= 1 &&
        month <= 12
      ) {
        return `${year}-${String(
          month
        ).padStart(
          2,
          "0"
        )}-${String(day).padStart(
          2,
          "0"
        )}`;
      }
    }
  }

  return null;
}

export function extractReferenceCode(
  text: string
): string | null {
  const match = text.match(
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
    .replace(/\s+/g, " ")
    .trim();
}

export function extractPersonName(
  text: string
): string | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const namePatterns = [
    /^(?:name|employee name|full name|person|staff name)\s*[:\-]\s*(.+)$/i,
    /^(?:prepared for|submitted by|addressed to)\s*[:\-]\s*(.+)$/i,
  ];

  for (const line of lines) {
    for (const pattern of namePatterns) {
      const match =
        line.match(pattern);

      if (match?.[1]) {
        const candidate =
          cleanCandidateName(
            match[1]
          );

        if (
          candidate.split(" ")
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
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const titlePatterns = [
    /^(?:title|document title|subject)\s*[:\-]\s*(.+)$/i,
  ];

  for (const line of lines) {
    for (const pattern of titlePatterns) {
      const match =
        line.match(pattern);

      if (match?.[1]) {
        const candidate =
          match[1]
            .replace(/\s+/g, " ")
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
    const firstLine = lines[0];

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
      .replace(/[_\-]+/g, " ")
      .replace(/\s+/g, " ")
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

  const parser = new PDFParse({
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
    text = await extractPdf(
      filePath
    );

    const initialText =
      text.trim();

    if (initialText.length < 100) {
      try {
        const ocrResult =
          await ocrPdf(
            filePath
          );

        if (
          ocrResult.text.trim().length >
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
    text = await extractDocx(
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
    year,
    personName,
    referenceCode,
  };
}
