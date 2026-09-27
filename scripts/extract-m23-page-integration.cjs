const fs = require("fs");

const file = "apps/web/src/app/page.tsx";
const source = fs.readFileSync(file, "utf8");

function section(label, startPattern, endPattern) {
  const start = source.search(startPattern);
  if (start < 0) {
    console.log(`\n===== ${label}: NOT FOUND =====`);
    return;
  }

  const end = endPattern
    ? source.search(endPattern, start + 1)
    : -1;

  console.log(`\n===== ${label} =====`);
  console.log(
    source.slice(start, end >= 0 ? end : Math.min(source.length, start + 18000))
  );
}

section(
  "FORM STATE",
  /const\s*\[\s*form\s*,\s*setForm\s*\]\s*=\s*useState/,
  /const\s*\[\s*departmentModalOpen/
);

section(
  "APPRAISAL STATES",
  /const\s*\[\s*appraisalMetadataForm\s*,\s*setAppraisalMetadataForm/,
  /const\s*\[\s*showUploadModal/
);

section(
  "DOMAIN / RELATIONSHIP REFERENCES",
  /(domainRelationship|DomainRelationship|relationshipType|relationshipTypes|selectedDomain)/,
  /const\s+(?:handleMetadataSubmit|handleUpload)/
);

section(
  "METADATA SUBMIT HANDLER",
  /const\s+handleMetadataSubmit\s*=\s*async/,
  /const\s+handle(?:FileChange|Upload|AppraisalReview)/
);

section(
  "APPRAISAL REVIEW HANDLERS",
  /const\s+handleAppraisalReview\s*=\s*async/,
  /const\s+handleDoneAppraisal\s*=\s*async/
);

section(
  "CREATE METADATA FROM APPRAISAL",
  /const\s+handleCreateMetadataFromAppraisal\s*=\s*async/,
  /const\s+handleDoneAppraisal\s*=\s*async/
);

section(
  "DONE APPRAISAL",
  /const\s+handleDoneAppraisal\s*=\s*async/,
  /return\s*\(/ 
);

section(
  "MODALS INVOCATION",
  /<Modals\b/,
  /<\/Modals>/
);

console.log("\n===== PAGE HASH =====");
console.log(require("crypto")
  .createHash("sha256")
  .update(source)
  .digest("hex")
  .toUpperCase());
