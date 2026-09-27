import { extractDocumentContent } from "./src/services/documentExtraction.js";

const filePath = process.argv[2];

if (!filePath) {
  console.error("Please provide a PDF or DOCX file path.");
} else {
  const extension = filePath.toLowerCase().endsWith(".pdf")
    ? ".pdf"
    : filePath.toLowerCase().endsWith(".docx")
      ? ".docx"
      : "";

  const filename = filePath.split(/[\\/]/).pop() ?? "test-document";

  const result = await extractDocumentContent(
    filePath,
    extension,
    filename
  );

  console.log("\nEXTRACTION RESULT");
  console.log("=================");
  console.log("TITLE:", result.title);
  console.log("YEAR:", result.year);
  console.log("DOCUMENT DATE:", result.date);
  console.log("EXTRACTED DATE TEXT:", result.extractedDateText);
  console.log("PERSON NAME:", result.personName);
  console.log("REFERENCE CODE:", result.referenceCode);
}
