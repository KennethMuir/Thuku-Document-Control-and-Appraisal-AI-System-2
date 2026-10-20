import assert from "node:assert/strict";
import test from "node:test";

import { extractDocumentContent } from "../src/services/documentExtraction.js";

const shortText = "A short embedded text sample.";
const longerOcrText =
  "OCR extracted the complete scanned document with additional text and a reference number REF-2026-104.";

test("PDF shorter than 100 characters attempts OCR and uses longer OCR text", async () => {
  let ocrCalls = 0;

  const result = await extractDocumentContent(
    "unused.pdf",
    ".pdf",
    "scanned-record.pdf",
    {
      async extractPdf() {
        return shortText;
      },
      async extractDocx() {
        assert.fail("DOCX extraction must not run for a PDF");
      },
      async ocrPdf() {
        ocrCalls += 1;
        return { text: longerOcrText, pageCount: 1 };
      },
    }
  );

  assert.equal(ocrCalls, 1);
  assert.equal(result.text, longerOcrText);
});

test("PDF with at least 100 embedded characters skips OCR", async () => {
  const embeddedText = "Embedded PDF text ".repeat(8);
  assert.ok(embeddedText.trim().length >= 100);

  let ocrCalls = 0;

  const result = await extractDocumentContent(
    "unused.pdf",
    ".pdf",
    "digital-record.pdf",
    {
      async extractPdf() {
        return embeddedText;
      },
      async extractDocx() {
        assert.fail("DOCX extraction must not run for a PDF");
      },
      async ocrPdf() {
        ocrCalls += 1;
        return { text: longerOcrText, pageCount: 1 };
      },
    }
  );

  assert.equal(ocrCalls, 0);
  assert.equal(result.text, embeddedText.trim());
});

test("short PDF retains original text when OCR returns less text", async () => {
  let ocrCalls = 0;

  const result = await extractDocumentContent(
    "unused.pdf",
    ".pdf",
    "record.pdf",
    {
      async extractPdf() {
        return shortText;
      },
      async extractDocx() {
        assert.fail("DOCX extraction must not run for a PDF");
      },
      async ocrPdf() {
        ocrCalls += 1;
        return { text: "OCR", pageCount: 1 };
      },
    }
  );

  assert.equal(ocrCalls, 1);
  assert.equal(result.text, shortText);
});

test("short PDF retains original text when OCR throws", async () => {
  const originalError = new Error("Simulated OCR failure");
  const originalConsoleError = console.error;
  let loggedError: unknown;

  console.error = (...args: unknown[]) => {
    loggedError = args[1];
  };

  try {
    const result = await extractDocumentContent(
      "unused.pdf",
      ".pdf",
      "record.pdf",
      {
        async extractPdf() {
          return shortText;
        },
        async extractDocx() {
          assert.fail("DOCX extraction must not run for a PDF");
        },
        async ocrPdf() {
          throw originalError;
        },
      }
    );

    assert.equal(result.text, shortText);
    assert.equal(loggedError, originalError);
  } finally {
    console.error = originalConsoleError;
  }
});

test("DOCX extraction uses Mammoth path without invoking OCR", async () => {
  const docxText = "DOCX content with reference REF-2026-105.";
  let docxCalls = 0;
  let ocrCalls = 0;

  const result = await extractDocumentContent(
    "unused.docx",
    ".docx",
    "meeting-record.docx",
    {
      async extractPdf() {
        assert.fail("PDF extraction must not run for DOCX");
      },
      async extractDocx() {
        docxCalls += 1;
        return docxText;
      },
      async ocrPdf() {
        ocrCalls += 1;
        return { text: longerOcrText, pageCount: 1 };
      },
    }
  );

  assert.equal(docxCalls, 1);
  assert.equal(ocrCalls, 0);
  assert.equal(result.text, docxText);
});
