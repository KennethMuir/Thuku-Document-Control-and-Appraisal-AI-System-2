const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

const files = {
  page: path.join(ROOT, "apps", "web", "src", "app", "page.tsx"),
  modals: path.join(
    ROOT,
    "apps",
    "web",
    "src",
    "components",
    "modals",
    "Modals.tsx"
  ),
  appraisal: path.join(
    ROOT,
    "apps",
    "web",
    "src",
    "components",
    "appraisal",
    "Appraisal.tsx"
  ),
  domainRegistry: path.join(
    ROOT,
    "apps",
    "web",
    "src",
    "components",
    "metadata",
    "DomainRegistry.tsx"
  ),
  selector: path.join(
    ROOT,
    "apps",
    "web",
    "src",
    "components",
    "metadata",
    "DomainRelationshipSelector.tsx"
  ),
};

const baselineHashes = {
  page:
    "E99A95F50401BA93A21B42D82611AF652FC78E2A928B237E1B42B9B8D5DDE79D",
  modals:
    "FD0A3D789FCCED0928AABF082859D2D02E93897D8B2BCF0B1926AF0FFE99FD98",
  appraisal:
    "B9C04590E48C7CAB8D490DFBC174DBF619AC000BF4AF3868475CCEB4DB292572",
};

function sha256(file) {
  return require("crypto")
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex")
    .toUpperCase();
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function write(file, content) {
  fs.writeFileSync(file, content, "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

console.log("\n=== M23 STRUCTURAL FRONTEND PATCH PRECHECK ===");

for (const key of ["page", "modals", "appraisal"]) {
  assert(fs.existsSync(files[key]), `Missing ${key}: ${files[key]}`);

  const actual = sha256(files[key]);

  assert(
    actual === baselineHashes[key],
    `${key} is not at the verified M23 baseline.\nExpected: ${baselineHashes[key]}\nActual:   ${actual}`
  );

  console.log(`PASS: ${key} baseline verified.`);
}

assert(
  fs.existsSync(
    path.join(
      ROOT,
      "apps",
      "web",
      "src",
      "lib",
      "api",
      "domainRelationships.ts"
    )
  ),
  "M23 domainRelationships API client is missing."
);

assert(
  fs.existsSync(
    path.join(
      ROOT,
      "apps",
      "web",
      "src",
      "lib",
      "api",
      "domainRegistry.ts"
    )
  ),
  "M22 domainRegistry API client is missing."
);

console.log("PASS: M23 API client exists.");
console.log("PASS: M22 domain registry API client exists.");

const page = read(files.page);
const modals = read(files.modals);
const appraisal = read(files.appraisal);
const domainRegistry = read(files.domainRegistry);

assert(
  page.includes("createMetadata"),
  "page.tsx does not contain createMetadata."
);

assert(
  page.includes("handleMetadataSubmit"),
  "page.tsx does not contain handleMetadataSubmit."
);

assert(
  page.includes("handleAppraisalReview"),
  "page.tsx does not contain handleAppraisalReview."
);

assert(
  page.includes("handleCreateMetadataFromAppraisal"),
  "page.tsx does not contain handleCreateMetadataFromAppraisal."
);

assert(
  page.includes("handleDoneAppraisal"),
  "page.tsx does not contain handleDoneAppraisal."
);

assert(
  modals.includes("handleMetadataSubmit"),
  "Modals.tsx does not contain the metadata submit handler prop."
);

assert(
  modals.includes("<Appraisal"),
  "Modals.tsx does not contain the Appraisal component."
);

assert(
  appraisal.includes("Review & Edit Metadata"),
  "Appraisal.tsx does not contain the expected appraisal form."
);

assert(
  appraisal.includes("handleCreateMetadataFromAppraisal"),
  "Appraisal.tsx does not contain the existing create-metadata handler."
);

assert(
  domainRegistry.includes("DomainRegistry"),
  "DomainRegistry.tsx does not contain its expected component."
);

console.log("PASS: Actual M23 application structure verified.");

const pageImportLines = page
  .split(/\r?\n/)
  .slice(0, 140)
  .filter((line) => line.startsWith("import "));

const modalImportLines = modals
  .split(/\r?\n/)
  .slice(0, 120)
  .filter((line) => line.startsWith("import "));

const appraisalImportLines = appraisal
  .split(/\r?\n/)
  .slice(0, 120)
  .filter((line) => line.startsWith("import "));

console.log("\n--- ACTUAL PAGE IMPORTS ---");
console.log(pageImportLines.join("\n"));

console.log("\n--- ACTUAL MODALS IMPORTS ---");
console.log(modalImportLines.join("\n"));

console.log("\n--- ACTUAL APPRAISAL IMPORTS ---");
console.log(appraisalImportLines.join("\n"));

console.log("\n=== PRECHECK COMPLETE ===");
console.log("No application files were modified.");
console.log("No selector was created.");
console.log("No Git commit or push performed.");
