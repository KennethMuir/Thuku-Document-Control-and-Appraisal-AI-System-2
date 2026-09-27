const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = process.cwd();

const files = {
  page: path.join(root, "apps", "web", "src", "app", "page.tsx"),
  modals: path.join(root, "apps", "web", "src", "components", "modals", "Modals.tsx"),
  appraisal: path.join(root, "apps", "web", "src", "components", "appraisal", "Appraisal.tsx"),
  domainRegistry: path.join(root, "apps", "web", "src", "components", "metadata", "DomainRegistry.tsx"),
};

const backups = {};

function sha(file) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex")
    .toUpperCase();
}

function backup(file, label) {
  const backupPath = `${file}.before-m23-final-${label}-${Date.now()}.tsx`;
  fs.copyFileSync(file, backupPath);
  backups[file] = {
    backupPath,
    hash: sha(file),
  };
  console.log(`BACKUP: ${backupPath}`);
}

function fail(message) {
  throw new Error(message);
}

function replaceOnce(source, search, replacement, label) {
  const index = source.indexOf(search);
  if (index < 0) {
    fail(`Could not locate ${label}`);
  }

  return (
    source.slice(0, index) +
    replacement +
    source.slice(index + search.length)
  );
}

function insertAfter(source, search, insertion, label) {
  const index = source.indexOf(search);
  if (index < 0) {
    fail(`Could not locate ${label}`);
  }

  const end = index + search.length;

  return (
    source.slice(0, end) +
    insertion +
    source.slice(end)
  );
}

function insertBefore(source, search, insertion, label) {
  const index = source.indexOf(search);
  if (index < 0) {
    fail(`Could not locate ${label}`);
  }

  return (
    source.slice(0, index) +
    insertion +
    source.slice(index)
  );
}

function functionEnd(source, startText) {
  const start = source.indexOf(startText);

  if (start < 0) {
    fail(`Function ${startText} was not found.`);
  }

  const open = source.indexOf("{", start);

  if (open < 0) {
    fail(`Opening brace for ${startText} was not found.`);
  }

  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = open; i < source.length; i++) {
    const c = source[i];
    const n = source[i + 1];

    if (lineComment) {
      if (c === "\n") lineComment = false;
      continue;
    }

    if (blockComment) {
      if (c === "*" && n === "/") {
        blockComment = false;
        i++;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (c === "\\") {
        escaped = true;
        continue;
      }

      if (c === quote) {
        quote = null;
      }

      continue;
    }

    if (c === "/" && n === "/") {
      lineComment = true;
      i++;
      continue;
    }

    if (c === "/" && n === "*") {
      blockComment = true;
      i++;
      continue;
    }

    if (c === "'" || c === '"' || c === "`") {
      quote = c;
      continue;
    }

    if (c === "{") {
      depth++;
    } else if (c === "}") {
      depth--;

      if (depth === 0) {
        return i + 1;
      }
    }
  }

  fail(`Closing brace for ${startText} was not found.`);
}

console.log("\n=== M23 FINAL FRONTEND INTEGRATION ===\n");

for (const [key, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) {
    fail(`Missing ${key} file: ${file}`);
  }
}

console.log("=== VERIFYING VERIFIED BASELINE ===");

const expected = {
  [files.page]:
    "E99A95F50401BA93A21B42D82611AF652FC78E2A928B237E1B42B9B8D5DDE79D",
  [files.modals]:
    "FD0A3D789FCCED0928AABF082859D2D02E93897D8B2BCF0B1926AF0FFE99FD98",
  [files.appraisal]:
    "B9C04590E48C7CAB8D490DFBC174DBF619AC000BF4AF3868475CCEB4DB292572",
};

for (const [file, hash] of Object.entries(expected)) {
  const actual = sha(file);

  if (actual !== hash) {
    fail(
      `Baseline mismatch for ${file}\nExpected: ${hash}\nActual:   ${actual}`
    );
  }

  console.log(`PASS baseline: ${path.basename(file)}`);
}

backup(files.page, "page");
backup(files.modals, "modals");
backup(files.appraisal, "appraisal");
backup(files.domainRegistry, "domain-registry");

let page = fs.readFileSync(files.page, "utf8");
let modals = fs.readFileSync(files.modals, "utf8");
let appraisal = fs.readFileSync(files.appraisal, "utf8");
let domainRegistry = fs.readFileSync(files.domainRegistry, "utf8");

console.log("\n=== PATCHING DOMAIN RELATIONSHIP IMPORTS ===");

if (!page.includes('domainRelationships')) {
  page = insertAfter(
    page,
    'import {',
    '',
    'page import block'
  );

  const lastImport = page.lastIndexOf('import ');
  const importEnd = page.indexOf("\n", lastImport);

  page =
    page.slice(0, importEnd + 1) +
    'import { getDomainRegistry } from "@/lib/api/domainRegistry";\n' +
    'import {\n' +
    '  createDomainRelationship,\n' +
    '  getMetadataDomainRelationships,\n' +
    '  getRelationshipTypes,\n' +
    '} from "@/lib/api/domainRelationships";\n' +
    'import DomainRelationshipSelector, {\n' +
    '  type DomainRelationshipDomain,\n' +
    '  type DomainRelationshipSelection,\n' +
    '  type DomainRelationshipType,\n' +
    '} from "@/components/metadata/DomainRelationshipSelector";\n' +
    page.slice(importEnd + 1);
}

if (!modals.includes('DomainRelationshipSelector')) {
  modals = insertBefore(
    modals,
    'type FormState = {',
    'import DomainRelationshipSelector, {\n' +
      '  type DomainRelationshipDomain,\n' +
      '  type DomainRelationshipSelection,\n' +
      '  type DomainRelationshipType,\n' +
      '} from "@/components/metadata/DomainRelationshipSelector";\n\n',
    'Modals FormState'
  );
}

if (!appraisal.includes('DomainRelationshipSelector')) {
  appraisal = insertBefore(
    appraisal,
    'type AppraisalMetadataForm = {',
    'import DomainRelationshipSelector, {\n' +
      '  type DomainRelationshipDomain,\n' +
      '  type DomainRelationshipSelection,\n' +
      '  type DomainRelationshipType,\n' +
      '} from "@/components/metadata/DomainRelationshipSelector";\n\n',
    'AppraisalMetadataForm'
  );
}

console.log("PASS imports.");

console.log("\n=== PATCHING PAGE STATE ===");

if (!page.includes("domainRelationshipDomains")) {
  const stateAnchor =
    "const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });";

  const stateInsertion = `

  const [domainRelationshipDomains, setDomainRelationshipDomains] =
    useState<DomainRelationshipDomain[]>([]);
  const [domainRelationshipTypes, setDomainRelationshipTypes] =
    useState<DomainRelationshipType[]>([]);
  const [metadataDomainRelationships, setMetadataDomainRelationships] =
    useState<DomainRelationshipSelection[]>([]);
  const [appraisalDomainRelationships, setAppraisalDomainRelationships] =
    useState<DomainRelationshipSelection[]>([]);
  const [domainRelationshipLoading, setDomainRelationshipLoading] =
    useState(false);
`;

  page = insertAfter(
    page,
    stateAnchor,
    stateInsertion,
    "page metadata form state"
  );
}

console.log("PASS state.");

console.log("\n=== PATCHING PAGE DOMAIN HELPERS ===");

if (!page.includes("const loadDomainRelationshipOptions")) {
  const helperAnchor = "const loadData = async () => {";

  const helpers = `
  const loadDomainRelationshipOptions = async () => {
    try {
      setDomainRelationshipLoading(true);

      const [domainsResponse, typesResponse] = await Promise.all([
        getDomainRegistry(),
        getRelationshipTypes(),
      ]);

      if (domainsResponse.ok) {
        const domainsData = await domainsResponse.json();

        const domains = Array.isArray(domainsData)
          ? domainsData
          : Array.isArray(domainsData?.domains)
            ? domainsData.domains
            : Array.isArray(domainsData?.data)
              ? domainsData.data
              : [];

        setDomainRelationshipDomains(
          domains.map((domain: any) => ({
            id: Number(domain.id),
            domain_key: String(domain.domain_key ?? ""),
            display_name: String(
              domain.display_name ?? domain.domain_key ?? ""
            ),
            description: domain.description ?? null,
            domain_family: domain.domain_family ?? null,
          }))
        );
      }

      if (typesResponse.ok) {
        const typesData = await typesResponse.json();

        const types = Array.isArray(typesData)
          ? typesData
          : Array.isArray(typesData?.relationshipTypes)
            ? typesData.relationshipTypes
            : Array.isArray(typesData?.types)
              ? typesData.types
              : Array.isArray(typesData?.data)
                ? typesData.data
                : [];

        setDomainRelationshipTypes(
          types.map((type: any) => ({
            value: String(type.value ?? type.relationship_type ?? ""),
            label: String(
              type.label ??
                String(type.value ?? type.relationship_type ?? "")
                  .replace(/_/g, " ")
                  .toLowerCase()
                  .replace(/\\b\\w/g, (letter: string) =>
                    letter.toUpperCase()
                  )
            ),
          }))
        );
      }
    } catch (error) {
      console.error(
        "Unable to load domain relationship options.",
        error
      );
    } finally {
      setDomainRelationshipLoading(false);
    }
  };

  const syncMetadataDomainRelationships = async (
    metadataRecordId: number | null | undefined,
    selections: DomainRelationshipSelection[]
  ) => {
    if (!metadataRecordId || selections.length === 0) {
      return;
    }

    const uniqueSelections = Array.from(
      new Map(
        selections.map((selection) => [
          \`\${selection.domainId}:\${selection.relationshipType}\`,
          selection,
        ])
      ).values()
    );

    for (const selection of uniqueSelections) {
      const response = await createDomainRelationship({
        metadata_record_id: Number(metadataRecordId),
        domain_id: Number(selection.domainId),
        relationship_type: String(selection.relationshipType),
      });

      if (!response.ok && response.status !== 409) {
        const data = await response.json().catch(() => null);

        throw new Error(
          data?.error ||
            "Unable to save the metadata domain relationship."
        );
      }
    }
  };

  const loadMetadataDomainRelationships = async (
    metadataRecordId: number | null | undefined
  ) => {
    if (!metadataRecordId) {
      setMetadataDomainRelationships([]);
      return;
    }

    try {
      const response = await getMetadataDomainRelationships(
        metadataRecordId
      );

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      const relationships = Array.isArray(data?.relationships)
        ? data.relationships
        : [];

      setMetadataDomainRelationships(
        relationships.map((relationship: any) => ({
          domainId: Number(
            relationship.domain_id ?? relationship.domain?.id
          ),
          relationshipType: String(
            relationship.relationship_type ?? ""
          ),
        }))
      );
    } catch (error) {
      console.error(
        "Unable to load metadata domain relationships.",
        error
      );
    }
  };

`;

  page = insertBefore(
    page,
    helperAnchor,
    helpers,
    "loadData helper"
  );
}

console.log("PASS helpers.");

console.log("\n=== PATCHING DOMAIN OPTIONS INTO INITIAL LOAD ===");

if (!page.includes("loadDomainRelationshipOptions();")) {
  const effectPattern =
    /useEffect\(\(\) => \{\s*loadData\(\);\s*\}, \[\]\);/;

  if (effectPattern.test(page)) {
    page = page.replace(
      effectPattern,
      `useEffect(() => {
    loadData();
    loadDomainRelationshipOptions();
  }, []);`
    );
  } else {
    const loadCall = "await loadData();";
    const first = page.indexOf(loadCall);

    if (first >= 0) {
      page =
        page.slice(0, first + loadCall.length) +
        "\n      await loadDomainRelationshipOptions();" +
        page.slice(first + loadCall.length);
    } else {
      fail("Could not locate initial loadData call.");
    }
  }
}

console.log("PASS initial domain loading.");

console.log("\n=== PATCHING handleMetadataSubmit ===");

{
  const startText = "const handleMetadataSubmit = async";
  const start = page.indexOf(startText);

  if (start < 0) {
    fail("handleMetadataSubmit was not found.");
  }

  const end = functionEnd(page, startText);
  const original = page.slice(start, end);

  if (!original.includes("createMetadata({")) {
    fail("Unexpected handleMetadataSubmit structure.");
  }

  if (!original.includes("const data =")) {
    fail("Metadata response parsing is missing.");
  }

  const patched = original.replace(
    /const data\s*=\s*await response\.json\(\);/,
    `const data =
        await response.json();

      const createdMetadataRecordId =
        Number(data?.metadata?.id ?? data?.data?.id ?? data?.id ?? 0) ||
        null;`
  );

  const withRelationshipSync = patched.replace(
    "closeMetadataModal();",
    `await syncMetadataDomainRelationships(
        createdMetadataRecordId,
        metadataDomainRelationships
      );

      closeMetadataModal();`
  );

  page =
    page.slice(0, start) +
    withRelationshipSync +
    page.slice(end);
}

console.log("PASS handleMetadataSubmit.");

console.log("\n=== PATCHING METADATA MODAL RESET ===");

if (!page.includes("setMetadataDomainRelationships([]);")) {
  const resetAnchor = "closeMetadataModal();";

  const index = page.indexOf(resetAnchor);

  if (index >= 0) {
    page =
      page.slice(0, index + resetAnchor.length) +
      "\n      setMetadataDomainRelationships([]);" +
      page.slice(index + resetAnchor.length);
  }
}

console.log("PASS metadata relationship reset.");

console.log("\n=== PATCHING MODALS PROPS ===");

if (!modals.includes("domainRelationshipDomains")) {
  const propsAnchor =
    "showMetadataModal: boolean;";

  if (!modals.includes(propsAnchor)) {
    fail("Could not locate ModalsProps metadata modal section.");
  }

  modals = insertAfter(
    modals,
    propsAnchor,
    `
  domainRelationshipDomains: DomainRelationshipDomain[];
  domainRelationshipTypes: DomainRelationshipType[];
  metadataDomainRelationships: DomainRelationshipSelection[];
  setMetadataDomainRelationships: React.Dispatch<
    React.SetStateAction<DomainRelationshipSelection[]>
  >;
  domainRelationshipLoading?: boolean;
`,
    "ModalsProps metadata section"
  );
}

console.log("PASS Modals props.");

console.log("\n=== PATCHING MODALS DESTRUCTURING ===");

if (!modals.includes("domainRelationshipDomains,")) {
  const destructureAnchor =
    "showMetadataModal,";

  if (!modals.includes(destructureAnchor)) {
    fail("Could not locate Modals destructuring.");
  }

  modals = insertAfter(
    modals,
    destructureAnchor,
    `
    domainRelationshipDomains,
    domainRelationshipTypes,
    metadataDomainRelationships,
    setMetadataDomainRelationships,
    domainRelationshipLoading,
`,
    "Modals destructuring"
  );
}

console.log("PASS Modals destructuring.");

console.log("\n=== PATCHING NORMAL METADATA FORM ===");

if (!modals.includes('id="manual-domain-relationships"')) {
  const descriptionAnchor =
    '<div id="manual-additional-metadata"';

  const index = modals.indexOf(descriptionAnchor);

  if (index < 0) {
    fail("Could not locate manual additional metadata section.");
  }

  const selector = `
            <div
              id="manual-domain-relationships"
              className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <DomainRelationshipSelector
                domains={domainRelationshipDomains}
                relationshipTypes={domainRelationshipTypes}
                selected={metadataDomainRelationships}
                onChange={setMetadataDomainRelationships}
                disabled={domainRelationshipLoading}
                title="Domain Relationships"
                description="Associate this metadata record with one or more domains and define how each domain relates to the record."
              />
            </div>

`;

  modals =
    modals.slice(0, index) +
    selector +
    modals.slice(index);
}

console.log("PASS normal metadata selector.");

console.log("\n=== PATCHING APPRAISAL PROPS ===");

if (!appraisal.includes("domainRelationshipDomains:")) {
  const propsAnchor =
    "canManageDocuments: boolean;";

  if (!appraisal.includes(propsAnchor)) {
    fail("Could not locate AppraisalProps.");
  }

  appraisal = insertAfter(
    appraisal,
    propsAnchor,
    `
  domainRelationshipDomains: DomainRelationshipDomain[];
  domainRelationshipTypes: DomainRelationshipType[];
  appraisalDomainRelationships: DomainRelationshipSelection[];
  setAppraisalDomainRelationships: React.Dispatch<
    React.SetStateAction<DomainRelationshipSelection[]>
  >;
  domainRelationshipLoading?: boolean;
`,
    "AppraisalProps"
  );
}

console.log("PASS appraisal props.");

console.log("\n=== PATCHING APPRAISAL DESTRUCTURING ===");

if (!appraisal.includes("appraisalDomainRelationships,")) {
  const destructureAnchor =
    "canManageDocuments,";

  if (!appraisal.includes(destructureAnchor)) {
    fail("Could not locate Appraisal destructuring.");
  }

  appraisal = insertAfter(
    appraisal,
    destructureAnchor,
    `
    domainRelationshipDomains,
    domainRelationshipTypes,
    appraisalDomainRelationships,
    setAppraisalDomainRelationships,
    domainRelationshipLoading,
`,
    "Appraisal destructuring"
  );
}

console.log("PASS appraisal destructuring.");

console.log("\n=== PATCHING APPRAISAL SELECTOR UI ===");

if (!appraisal.includes('id="appraisal-domain-relationships"')) {
  const descriptionText =
    "Additional Metadata";

  const headingIndex = appraisal.indexOf(descriptionText);

  if (headingIndex < 0) {
    fail("Could not locate appraisal Additional Metadata section.");
  }

  const sectionStart = appraisal.lastIndexOf("<", headingIndex);

  const selector = `
            <div
              id="appraisal-domain-relationships"
              className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <DomainRelationshipSelector
                domains={domainRelationshipDomains}
                relationshipTypes={domainRelationshipTypes}
                selected={appraisalDomainRelationships}
                onChange={setAppraisalDomainRelationships}
                disabled={domainRelationshipLoading}
                title="Domain Relationships"
                description="Associate this metadata record with one or more domains and define how each domain relates to the record."
              />
            </div>

`;

  appraisal =
    appraisal.slice(0, sectionStart) +
    selector +
    appraisal.slice(sectionStart);
}

console.log("PASS appraisal selector.");

console.log("\n=== PATCHING PAGE APPRAISAL PROPS ===");

if (!page.includes("appraisalDomainRelationships={")) {
  const appraisalComponent =
    "<Appraisal";

  const componentIndex = page.indexOf(appraisalComponent);

  if (componentIndex < 0) {
    fail("Could not locate Appraisal component in page.");
  }

  const propAnchor =
    "canManageDocuments={canManageDocuments}";

  const localIndex = page.indexOf(
    propAnchor,
    componentIndex
  );

  if (localIndex < 0) {
    fail("Could not locate Appraisal canManageDocuments prop.");
  }

  const insertionPoint =
    localIndex + propAnchor.length;

  const props = `
          domainRelationshipDomains={domainRelationshipDomains}
          domainRelationshipTypes={domainRelationshipTypes}
          appraisalDomainRelationships={appraisalDomainRelationships}
          setAppraisalDomainRelationships={setAppraisalDomainRelationships}
          domainRelationshipLoading={domainRelationshipLoading}
`;

  page =
    page.slice(0, insertionPoint) +
    props +
    page.slice(insertionPoint);
}

console.log("PASS Appraisal props.");

console.log("\n=== PATCHING APPRAISAL SYNCHRONIZATION ===");

function patchAppraisalFunction(functionName) {
  const startText = `const ${functionName}`;
  const start = page.indexOf(startText);

  if (start < 0) {
    console.log(`SKIP ${functionName}: not found.`);
    return;
  }

  const end = functionEnd(page, startText);
  const original = page.slice(start, end);

  if (
    original.includes(
      "syncMetadataDomainRelationships("
    )
  ) {
    return;
  }

  const metadataIdPattern =
    /const\s+metadataRecordId\s*=\s*[^;]+;/;

  if (metadataIdPattern.test(original)) {
    const patched = original.replace(
      metadataIdPattern,
      (match) =>
        `${match}

    await syncMetadataDomainRelationships(
      metadataRecordId,
      appraisalDomainRelationships
    );`
    );

    page =
      page.slice(0, start) +
      patched +
      page.slice(end);

    return;
  }

  const successMarker =
    "setIsCreatingNewMetadata(false);";

  if (original.includes(successMarker)) {
    const patched = original.replace(
      successMarker,
      `await syncMetadataDomainRelationships(
      Number(data?.metadata?.id ?? data?.data?.id ?? 0) || null,
      appraisalDomainRelationships
    );

    ${successMarker}`
    );

    page =
      page.slice(0, start) +
      patched +
      page.slice(end);
  }
}

patchAppraisalFunction("handleCreateMetadataFromAppraisal");
patchAppraisalFunction("handleAppraisalReview");
patchAppraisalFunction("handleDoneAppraisal");

console.log("PASS appraisal synchronization.");

console.log("\n=== PATCHING APPRAISAL RELATIONSHIP RESET ===");

if (!page.includes("setAppraisalDomainRelationships([]);")) {
  const closeUpload =
    "closeUploadModal();";

  const idx = page.indexOf(closeUpload);

  if (idx >= 0) {
    page =
      page.slice(0, idx) +
      "setAppraisalDomainRelationships([]);\n    " +
      page.slice(idx);
  }
}

console.log("PASS appraisal reset.");

console.log("\n=== PATCHING DOMAIN REGISTRY AFFILIATIONS ===");

if (!domainRegistry.includes("getDomainAffiliations")) {
  const importAnchor =
    'import';

  const firstImportEnd =
    domainRegistry.indexOf("\n", domainRegistry.indexOf(importAnchor));

  if (firstImportEnd < 0) {
    fail("Could not locate DomainRegistry imports.");
  }

  domainRegistry =
    domainRegistry.slice(0, firstImportEnd + 1) +
    'import { getDomainAffiliations } from "@/lib/api/domainRelationships";\n' +
    domainRegistry.slice(firstImportEnd + 1);
}

if (!domainRegistry.includes("selectedDomainAffiliations")) {
  const stateAnchor =
    "const [";

  const firstState = domainRegistry.indexOf(stateAnchor);

  if (firstState < 0) {
    fail("Could not locate DomainRegistry state.");
  }

  domainRegistry =
    domainRegistry.slice(0, firstState) +
    `const [selectedDomainAffiliations, setSelectedDomainAffiliations] =
  useState<any>(null);
const [loadingDomainAffiliations, setLoadingDomainAffiliations] =
  useState(false);

` +
    domainRegistry.slice(firstState);
}

if (!domainRegistry.includes("loadDomainAffiliations")) {
  const componentStart =
    "export default function DomainRegistry";

  const start = domainRegistry.indexOf(componentStart);

  if (start < 0) {
    fail("Could not locate DomainRegistry component.");
  }

  const open = domainRegistry.indexOf("{", start);

  domainRegistry =
    domainRegistry.slice(0, open + 1) +
    `

  const loadDomainAffiliations = async (domainKey: string) => {
    try {
      setLoadingDomainAffiliations(true);

      const response = await getDomainAffiliations(domainKey);

      if (!response.ok) {
        throw new Error("Unable to load domain affiliations.");
      }

      const data = await response.json();
      setSelectedDomainAffiliations(data);
    } catch (error) {
      console.error(error);
      setSelectedDomainAffiliations(null);
    } finally {
      setLoadingDomainAffiliations(false);
    }
  };

` +
    domainRegistry.slice(open + 1);
}

fs.writeFileSync(files.page, page, "utf8");
fs.writeFileSync(files.modals, modals, "utf8");
fs.writeFileSync(files.appraisal, appraisal, "utf8");
fs.writeFileSync(files.domainRegistry, domainRegistry, "utf8");

console.log("\n=== RUNNING TYPESCRIPT CHECK ===\n");

const { spawnSync } = require("child_process");

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["tsc", "--noEmit"],
  {
    cwd: path.join(root, "apps", "web"),
    stdio: "inherit",
  }
);

if (result.status !== 0) {
  throw new Error(
    `Frontend TypeScript check failed with exit code ${result.status}.`
  );
}

console.log("\n=== TYPESCRIPT CHECK PASSED ===");

console.log("\n=== FINAL HASHES ===");

for (const file of [
  files.page,
  files.modals,
  files.appraisal,
  files.domainRegistry,
]) {
  console.log(`${sha(file)}  ${file}`);
}

console.log("\nM23 FRONTEND INTEGRATION COMPLETED.");
