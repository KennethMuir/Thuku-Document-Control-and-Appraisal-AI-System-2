const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = process.cwd();

const files = {
  page: path.join(ROOT, "apps", "web", "src", "app", "page.tsx"),
  modals: path.join(ROOT, "apps", "web", "src", "components", "modals", "Modals.tsx"),
  appraisal: path.join(ROOT, "apps", "web", "src", "components", "appraisal", "Appraisal.tsx"),
};

const expected = {
  page: "E99A95F50401BA93A21B42D82611AF652FC78E2A928B237E1B42B9B8D5DDE79D",
  modals: "FD0A3D789FCCED0928AABF082859D2D02E93897D8B2BCF0B1926AF0FFE99FD98",
  appraisal: "B9C04590E48C7CAB8D490DFBC174DBF619AC000BF4AF3868475CCEB4DB292572",
};

function hash(file) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex")
    .toUpperCase();
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function write(file, value) {
  fs.writeFileSync(file, value, "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function findMatchingBrace(source, openIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = openIndex; i < source.length; i++) {
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
        return i;
      }
    }
  }

  return -1;
}

function findFunctionBody(source, declaration) {
  const declarationIndex = source.indexOf(declaration);

  assert(
    declarationIndex >= 0,
    `Could not locate declaration: ${declaration}`
  );

  const open = source.indexOf("{", declarationIndex);

  assert(
    open >= 0,
    `Could not locate function body: ${declaration}`
  );

  const close = findMatchingBrace(source, open);

  assert(
    close >= 0,
    `Could not locate function closing brace: ${declaration}`
  );

  return {
    declarationIndex,
    open,
    close,
    body: source.slice(open + 1, close),
  };
}

function addImport(source, importText) {
  if (source.includes(importText.trim())) {
    return source;
  }

  const lines = source.split(/\r?\n/);

  let lastImportEnd = -1;
  let insideImport = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("import ")) {
      insideImport = !line.trim().endsWith(";");
      lastImportEnd = i;
      continue;
    }

    if (insideImport) {
      lastImportEnd = i;

      if (line.includes(";")) {
        insideImport = false;
      }
    }
  }

  assert(lastImportEnd >= 0, "Could not locate TypeScript import section.");

  lines.splice(lastImportEnd + 1, 0, importText);

  return lines.join("\n");
}

const backups = new Map();

console.log("\n=== M23 CORRECTED FRONTEND INTEGRATION ===");

for (const key of ["page", "modals", "appraisal"]) {
  const actual = hash(files[key]);

  assert(
    actual === expected[key],
    `${key} is not at the verified clean baseline.\nExpected: ${expected[key]}\nActual:   ${actual}`
  );

  const backup = `${files[key]}.before-m23-corrected-${Date.now()}`;
  fs.copyFileSync(files[key], backup);
  backups.set(key, backup);

  console.log(`PASS baseline: ${key}`);
}

try {
  let page = read(files.page);
  let modals = read(files.modals);
  let appraisal = read(files.appraisal);

  /*
   * ------------------------------------------------------------
   * PAGE IMPORTS
   * ------------------------------------------------------------
   */

  page = addImport(
    page,
    `import {
  createDomainRelationship,
  deleteDomainRelationship,
  getMetadataDomainRelationships,
  getRelationshipTypes,
} from "@/lib/api/domainRelationships";`
  );

  page = addImport(
    page,
    `import { getDomainRegistry } from "@/lib/api/domainRegistry";`
  );

  page = addImport(
    page,
    `import {
  DomainRelationshipSelector,
  type DomainRelationshipDomain,
  type DomainRelationshipSelection,
  type DomainRelationshipType,
} from "@/components/metadata/DomainRelationshipSelector";`
  );

  console.log("PASS page imports.");

  /*
   * ------------------------------------------------------------
   * PAGE STATE
   * ------------------------------------------------------------
   */

  const home = findFunctionBody(page, "export default function Home");

  const stateAnchor =
    "const [appraisalMetadataForm";

  const stateIndex = home.body.indexOf(stateAnchor);

  assert(
    stateIndex >= 0,
    "Could not locate appraisalMetadataForm state."
  );

  const stateAbsolute =
    home.open + 1 + stateIndex;

  if (!page.includes("const [m23Domains")) {
    page =
      page.slice(0, stateAbsolute) +
      `
  const [m23Domains, setM23Domains] = useState<DomainRelationshipDomain[]>([]);
  const [m23RelationshipTypes, setM23RelationshipTypes] = useState<DomainRelationshipType[]>([]);
  const [metadataDomainSelections, setMetadataDomainSelections] = useState<DomainRelationshipSelection[]>([]);
  const [appraisalDomainSelections, setAppraisalDomainSelections] = useState<DomainRelationshipSelection[]>([]);
` +
      page.slice(stateAbsolute);
  }

  console.log("PASS page M23 state.");

  /*
   * ------------------------------------------------------------
   * M23 LOADING + SYNCHRONISATION HELPERS
   * ------------------------------------------------------------
   */

  const loadDataIndex = page.indexOf("const loadData = async");

  assert(
    loadDataIndex >= 0,
    "Could not locate loadData."
  );

  const m23Helpers = `
  const loadM23RelationshipData = async () => {
    try {
      const [domainsResponse, typesResponse] = await Promise.all([
        getDomainRegistry(),
        getRelationshipTypes(),
      ]);

      const domainsData = await domainsResponse.json();
      const typesData = await typesResponse.json();

      if (domainsResponse.ok && domainsData.success) {
        setM23Domains(
          Array.isArray(domainsData.domains)
            ? domainsData.domains
            : []
        );
      }

      if (typesResponse.ok && typesData.success) {
        setM23RelationshipTypes(
          Array.isArray(typesData.relationshipTypes)
            ? typesData.relationshipTypes.map((value: unknown) =>
                typeof value === "string"
                  ? {
                      value,
                      label: value.replaceAll("_", " "),
                    }
                  : value
              )
            : []
        );
      }
    } catch {
      setM23Domains([]);
      setM23RelationshipTypes([]);
    }
  };

  const loadM23MetadataRelationships = async (
    metadataRecordId: number
  ): Promise<DomainRelationshipSelection[]> => {
    try {
      const response =
        await getMetadataDomainRelationships(metadataRecordId);

      const data = await response.json();

      if (!response.ok || !data.success) {
        return [];
      }

      return Array.isArray(data.relationships)
        ? data.relationships.map((item: any) => ({
            domainId: Number(
              item.domain_id ?? item.domainId
            ),
            relationshipType: String(
              item.relationship_type ??
                item.relationshipType ??
                "SUBJECT"
            ),
          }))
        : [];
    } catch {
      return [];
    }
  };

  const syncM23MetadataRelationships = async (
    metadataRecordId: number,
    selections: DomainRelationshipSelection[]
  ) => {
    const response =
      await getMetadataDomainRelationships(metadataRecordId);

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.error ||
          "Unable to load existing domain relationships."
      );
    }

    const existing = Array.isArray(data.relationships)
      ? data.relationships
      : [];

    const desiredKeys = new Set(
      selections.map(
        (item) =>
          String(item.domainId) +
          ":" +
          item.relationshipType
      )
    );

    const existingKeys = new Set(
      existing.map(
        (item: any) =>
          String(
            item.domain_id ?? item.domainId
          ) +
          ":" +
          String(
            item.relationship_type ??
              item.relationshipType
          )
      )
    );

    for (const item of existing) {
      const key =
        String(item.domain_id ?? item.domainId) +
        ":" +
        String(
          item.relationship_type ??
            item.relationshipType
        );

      if (!desiredKeys.has(key) && item.id) {
        await deleteDomainRelationship(
          Number(item.id)
        );
      }
    }

    for (const item of selections) {
      const key =
        String(item.domainId) +
        ":" +
        item.relationshipType;

      if (!existingKeys.has(key)) {
        await createDomainRelationship({
          metadata_record_id: metadataRecordId,
          domain_id: Number(item.domainId),
          relationship_type: item.relationshipType,
        });
      }
    }
  };

`;

  if (!page.includes("const loadM23RelationshipData")) {
    page =
      page.slice(0, loadDataIndex) +
      m23Helpers +
      page.slice(loadDataIndex);
  }

  console.log("PASS M23 relationship helpers.");

  /*
   * ------------------------------------------------------------
   * INITIAL DOMAIN DATA LOAD
   * ------------------------------------------------------------
   */

  if (!page.includes("void loadM23RelationshipData();")) {
    const effectIndex = page.indexOf(
      "useEffect(() => {"
    );

    assert(
      effectIndex >= 0,
      "Could not locate existing useEffect."
    );

    page =
      page.slice(0, effectIndex) +
      `
  useEffect(() => {
    void loadM23RelationshipData();
  }, []);

` +
      page.slice(effectIndex);
  }

  console.log("PASS M23 relationship data loading.");

  /*
   * ------------------------------------------------------------
   * NORMAL METADATA SUBMIT
   * ------------------------------------------------------------
   */

  const metadataSubmit =
    findFunctionBody(
      page,
      "const handleMetadataSubmit = async"
    );

  const responseLine =
    "const data = await response.json();";

  const responseIndex =
    metadataSubmit.body.indexOf(responseLine);

  assert(
    responseIndex >= 0,
    "Could not locate the metadata response parsing line inside handleMetadataSubmit."
  );

  const responseAbsolute =
    metadataSubmit.open +
    1 +
    responseIndex;

  const syncNormalMetadata = `
    if (data.metadata?.id) {
      await syncM23MetadataRelationships(
        Number(data.metadata.id),
        metadataDomainSelections
      );
    }

`;

  if (
    !metadataSubmit.body.includes(
      "await syncM23MetadataRelationships("
    )
  ) {
    const lineEnd =
      page.indexOf(
        "\n",
        responseAbsolute
      );

    assert(
      lineEnd >= 0,
      "Could not locate end of metadata response line."
    );

    page =
      page.slice(0, lineEnd + 1) +
      syncNormalMetadata +
      page.slice(lineEnd + 1);
  }

  console.log(
    "PASS normal metadata relationship persistence."
  );

  /*
   * ------------------------------------------------------------
   * MODALS IMPORT
   * ------------------------------------------------------------
   */

  modals = addImport(
    modals,
    `import {
  DomainRelationshipSelector,
  type DomainRelationshipDomain,
  type DomainRelationshipSelection,
  type DomainRelationshipType,
} from "@/components/metadata/DomainRelationshipSelector";`
  );

  console.log("PASS Modals selector import.");

  /*
   * ------------------------------------------------------------
   * MODALS PROPS
   * ------------------------------------------------------------
   */

  const modalsPropsIndex =
    modals.indexOf("interface ModalsProps");

  assert(
    modalsPropsIndex >= 0,
    "Could not locate ModalsProps."
  );

  const modalsPropsOpen =
    modals.indexOf(
      "{",
      modalsPropsIndex
    );

  const modalsPropsClose =
    findMatchingBrace(
      modals,
      modalsPropsOpen
    );

  assert(
    modalsPropsClose >= 0,
    "Could not locate ModalsProps closing brace."
  );

  if (
    !modals
      .slice(
        modalsPropsOpen,
        modalsPropsClose
      )
      .includes("m23Domains:")
  ) {
    modals =
      modals.slice(0, modalsPropsClose) +
      `
  m23Domains: DomainRelationshipDomain[];
  m23RelationshipTypes: DomainRelationshipType[];
  metadataDomainSelections: DomainRelationshipSelection[];
  setMetadataDomainSelections: React.Dispatch<
    React.SetStateAction<DomainRelationshipSelection[]>
  >;
  appraisalDomainSelections: DomainRelationshipSelection[];
  setAppraisalDomainSelections: React.Dispatch<
    React.SetStateAction<DomainRelationshipSelection[]>
  >;
` +
      modals.slice(modalsPropsClose);
  }

  /*
   * ------------------------------------------------------------
   * MODALS DESTRUCTURING
   * ------------------------------------------------------------
   */

  const destructuringStart =
    modals.indexOf(
      "export function Modals"
    );

  assert(
    destructuringStart >= 0,
    "Could not locate Modals component."
  );

  const destructuringOpen =
    modals.indexOf(
      "{",
      destructuringStart
    );

  const destructuringClose =
    findMatchingBrace(
      modals,
      destructuringOpen
    );

  assert(
    destructuringClose >= 0,
    "Could not locate Modals destructuring boundary."
  );

  const destructuringBlock =
    modals.slice(
      destructuringOpen,
      destructuringClose
    );

  if (
    !destructuringBlock.includes(
      "m23Domains"
    )
  ) {
    const handleMarker =
      "handleMetadataSubmit";

    const markerIndex =
      destructuringBlock.indexOf(
        handleMarker
      );

    assert(
      markerIndex >= 0,
      "Could not locate handleMetadataSubmit inside Modals props destructuring."
    );

    const absolute =
      destructuringOpen +
      markerIndex;

    const lineStart =
      modals.lastIndexOf(
        "\n",
        absolute
      ) + 1;

    modals =
      modals.slice(0, lineStart) +
      `  m23Domains,
  m23RelationshipTypes,
  metadataDomainSelections,
  setMetadataDomainSelections,
  appraisalDomainSelections,
  setAppraisalDomainSelections,
` +
      modals.slice(lineStart);
  }

  console.log("PASS Modals M23 props.");

  /*
   * ------------------------------------------------------------
   * NORMAL METADATA SELECTOR
   * ------------------------------------------------------------
   */

  if (
    !modals.includes(
      "<DomainRelationshipSelector"
    )
  ) {
    const additionalIndex =
      modals.indexOf(
        'id="manual-additional-metadata"'
      );

    assert(
      additionalIndex >= 0,
      "Could not locate manual additional metadata section."
    );

    const insertionPoint =
      modals.lastIndexOf(
        "<div",
        additionalIndex
      );

    assert(
      insertionPoint >= 0,
      "Could not locate metadata section insertion point."
    );

    modals =
      modals.slice(0, insertionPoint) +
      `
        <div className="mb-6">
          <DomainRelationshipSelector
            domains={m23Domains}
            relationshipTypes={m23RelationshipTypes}
            selected={metadataDomainSelections}
            onChange={setMetadataDomainSelections}
          />
        </div>
` +
      modals.slice(insertionPoint);
  }

  /*
   * ------------------------------------------------------------
   * APPRAISAL USAGE
   * ------------------------------------------------------------
   */

  const appraisalUsage =
    modals.indexOf("<Appraisal");

  assert(
    appraisalUsage >= 0,
    "Could not locate Appraisal usage."
  );

  const appraisalUsageEnd =
    modals.indexOf(
      "/>",
      appraisalUsage
    );

  assert(
    appraisalUsageEnd >= 0,
    "Could not locate Appraisal closing tag."
  );

  if (
    !modals
      .slice(
        appraisalUsage,
        appraisalUsageEnd
      )
      .includes("m23Domains={m23Domains}")
  ) {
    modals =
      modals.slice(0, appraisalUsageEnd) +
      `
  m23Domains={m23Domains}
  m23RelationshipTypes={m23RelationshipTypes}
  appraisalDomainSelections={appraisalDomainSelections}
  setAppraisalDomainSelections={setAppraisalDomainSelections}
` +
      modals.slice(appraisalUsageEnd);
  }

  console.log("PASS Appraisal M23 props.");

  /*
   * ------------------------------------------------------------
   * APPRAISAL IMPORT
   * ------------------------------------------------------------
   */

  appraisal = addImport(
    appraisal,
    `import {
  DomainRelationshipSelector,
  type DomainRelationshipDomain,
  type DomainRelationshipSelection,
  type DomainRelationshipType,
} from "@/components/metadata/DomainRelationshipSelector";`
  );

  /*
   * ------------------------------------------------------------
   * APPRAISAL PROPS
   * ------------------------------------------------------------
   */

  const appraisalPropsIndex =
    appraisal.indexOf(
      "interface AppraisalProps"
    );

  assert(
    appraisalPropsIndex >= 0,
    "Could not locate AppraisalProps."
  );

  const appraisalPropsOpen =
    appraisal.indexOf(
      "{",
      appraisalPropsIndex
    );

  const appraisalPropsClose =
    findMatchingBrace(
      appraisal,
      appraisalPropsOpen
    );

  assert(
    appraisalPropsClose >= 0,
    "Could not locate AppraisalProps closing brace."
  );

  if (
    !appraisal
      .slice(
        appraisalPropsOpen,
        appraisalPropsClose
      )
      .includes("m23Domains:")
  ) {
    appraisal =
      appraisal.slice(
        0,
        appraisalPropsClose
      ) +
      `
  m23Domains: DomainRelationshipDomain[];
  m23RelationshipTypes: DomainRelationshipType[];
  appraisalDomainSelections: DomainRelationshipSelection[];
  setAppraisalDomainSelections: React.Dispatch<
    React.SetStateAction<DomainRelationshipSelection[]>
  >;
` +
      appraisal.slice(
        appraisalPropsClose
      );
  }

  /*
   * ------------------------------------------------------------
   * APPRAISAL DESTRUCTURING
   * ------------------------------------------------------------
   */

  const appraisalComponent =
    appraisal.indexOf(
      "export function Appraisal"
    );

  assert(
    appraisalComponent >= 0,
    "Could not locate Appraisal component."
  );

  const appraisalComponentOpen =
    appraisal.indexOf(
      "{",
      appraisalComponent
    );

  const appraisalComponentClose =
    findMatchingBrace(
      appraisal,
      appraisalComponentOpen
    );

  assert(
    appraisalComponentClose >= 0,
    "Could not locate Appraisal component boundary."
  );

  const appraisalBlock =
    appraisal.slice(
      appraisalComponentOpen,
      appraisalComponentClose
    );

  if (
    !appraisalBlock.includes(
      "m23Domains"
    )
  ) {
    const marker =
      "handleCreateMetadataFromAppraisal";

    const markerIndex =
      appraisalBlock.indexOf(marker);

    assert(
      markerIndex >= 0,
      "Could not locate appraisal handler in Appraisal props."
    );

    const absolute =
      appraisalComponentOpen +
      markerIndex;

    const lineStart =
      appraisal.lastIndexOf(
        "\n",
        absolute
      ) + 1;

    appraisal =
      appraisal.slice(0, lineStart) +
      `  m23Domains,
  m23RelationshipTypes,
  appraisalDomainSelections,
  setAppraisalDomainSelections,
` +
      appraisal.slice(lineStart);
  }

  /*
   * ------------------------------------------------------------
   * APPRAISAL SELECTOR
   * ------------------------------------------------------------
   */

  if (
    !appraisal.includes(
      "<DomainRelationshipSelector"
    )
  ) {
    const additionalIndex =
      appraisal.indexOf(
        "Additional Metadata"
      );

    assert(
      additionalIndex >= 0,
      "Could not locate appraisal Additional Metadata section."
    );

    const insertionPoint =
      appraisal.lastIndexOf(
        "<div",
        additionalIndex
      );

    assert(
      insertionPoint >= 0,
      "Could not locate appraisal selector insertion point."
    );

    appraisal =
      appraisal.slice(0, insertionPoint) +
      `
      <div className="mb-6">
        <DomainRelationshipSelector
          domains={m23Domains}
          relationshipTypes={m23RelationshipTypes}
          selected={appraisalDomainSelections}
          onChange={setAppraisalDomainSelections}
          disabled={reviewingDecision}
        />
      </div>
` +
      appraisal.slice(insertionPoint);
  }

  console.log("PASS Appraisal selector.");

  write(files.page, page);
  write(files.modals, modals);
  write(files.appraisal, appraisal);

  console.log("\n=== M23 FRONTEND FILES WRITTEN ===");
  console.log("page.tsx");
  console.log("Modals.tsx");
  console.log("Appraisal.tsx");
  console.log("\nNo Git commit or push performed.");
} catch (error) {
  console.error("\nM23 corrected integration failed:");
  console.error(
    error instanceof Error
      ? error.stack
      : error
  );

  console.log("\n=== AUTOMATIC ROLLBACK ===");

  for (const [key, backup] of backups) {
    fs.copyFileSync(
      backup,
      files[key]
    );

    console.log(
      `RESTORED: ${key}`
    );
  }

  process.exitCode = 1;
}
