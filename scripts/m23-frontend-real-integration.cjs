const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = process.cwd();

const files = {
  page: path.join(ROOT, "apps", "web", "src", "app", "page.tsx"),
  modals: path.join(ROOT, "apps", "web", "src", "components", "modals", "Modals.tsx"),
  appraisal: path.join(ROOT, "apps", "web", "src", "components", "appraisal", "Appraisal.tsx"),
  selector: path.join(ROOT, "apps", "web", "src", "components", "metadata", "DomainRelationshipSelector.tsx"),
};

const expected = {
  page: "E99A95F50401BA93A21B42D82611AF652FC78E2A928B237E1B42B9B8D5DDE79D",
  modals: "FD0A3D789FCCED0928AABF082859D2D02E93897D8B2BCF0B1926AF0FFE99FD98",
  appraisal: "B9C04590E48C7CAB8D490DFBC174DBF619AC000BF4AF3868475CCEB4DB292572",
};

function hash(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function write(file, text) {
  fs.writeFileSync(file, text, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
      if (c === quote) quote = null;
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

    if (c === "{") depth++;
    if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }

  return -1;
}

function findBlockAfter(source, marker) {
  const markerIndex = source.indexOf(marker);
  assert(markerIndex >= 0, `Could not find marker: ${marker}`);

  const open = source.indexOf("{", markerIndex);
  assert(open >= 0, `Could not find opening brace after: ${marker}`);

  const close = findMatchingBrace(source, open);
  assert(close >= 0, `Could not find closing brace after: ${marker}`);

  return { markerIndex, open, close };
}

function addImport(source, importText) {
  if (source.includes(importText.trim())) return source;

  const matches = [...source.matchAll(/^import[\s\S]*?;\s*$/gm)];

  let lastEnd = 0;

  for (const match of matches) {
    lastEnd = Math.max(lastEnd, match.index + match[0].length);
  }

  assert(lastEnd > 0, "Could not determine import section.");

  return source.slice(0, lastEnd) + "\n" + importText + source.slice(lastEnd);
}

function addOnce(source, marker, insertion, label) {
  assert(source.includes(marker), `Missing ${label} marker.`);
  if (source.includes(insertion.trim())) return source;
  return source.replace(marker, marker + insertion);
}

const backups = new Map();

for (const key of ["page", "modals", "appraisal"]) {
  assert(fs.existsSync(files[key]), `Missing ${key}: ${files[key]}`);
  const actual = hash(files[key]);
  assert(
    actual === expected[key],
    `${key} is not at the verified baseline.\nExpected ${expected[key]}\nActual ${actual}`
  );

  const backup = `${files[key]}.before-m23-real-integration-${Date.now()}`;
  fs.copyFileSync(files[key], backup);
  backups.set(key, backup);

  console.log(`PASS baseline: ${key}`);
}

assert(fs.existsSync(files.selector), "DomainRelationshipSelector.tsx is missing.");

try {
  let page = read(files.page);
  let modals = read(files.modals);
  let appraisal = read(files.appraisal);

  console.log("\n=== INTEGRATING M23 RELATIONSHIP API ===");

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

  const homeStart = page.indexOf("export default function Home");
  assert(homeStart >= 0, "Could not locate Home component.");

  const homeOpen = page.indexOf("{", homeStart);
  const homeClose = findMatchingBrace(page, homeOpen);
  assert(homeClose >= 0, "Could not locate Home component boundary.");

  const homeBody = page.slice(homeOpen + 1, homeClose);

  const stateAnchor = "const [appraisalMetadataForm";
  const stateIndex = homeBody.indexOf(stateAnchor);
  assert(stateIndex >= 0, "Could not locate appraisal metadata state.");

  const stateAbsolute = homeOpen + 1 + stateIndex;

  const stateInsertion = `
  const [m23Domains, setM23Domains] = useState<DomainRelationshipDomain[]>([]);
  const [m23RelationshipTypes, setM23RelationshipTypes] = useState<DomainRelationshipType[]>([]);
  const [metadataDomainSelections, setMetadataDomainSelections] = useState<DomainRelationshipSelection[]>([]);
  const [appraisalDomainSelections, setAppraisalDomainSelections] = useState<DomainRelationshipSelection[]>([]);
`;

  if (!page.includes("const [m23Domains")) {
    page =
      page.slice(0, stateAbsolute) +
      stateInsertion +
      page.slice(stateAbsolute);
  }

  console.log("PASS page M23 state.");

  const loadDataIndex = page.indexOf("const loadData = async");
  assert(loadDataIndex >= 0, "Could not locate loadData.");

  const loadDataOpen = page.indexOf("{", loadDataIndex);
  const loadDataClose = findMatchingBrace(page, loadDataOpen);
  assert(loadDataClose >= 0, "Could not locate loadData boundary.");

  const loader = `
  const loadM23RelationshipData = async () => {
    try {
      const [domainsResponse, typesResponse] = await Promise.all([
        getDomainRegistry(),
        getRelationshipTypes(),
      ]);

      const domainsData = await domainsResponse.json();
      const typesData = await typesResponse.json();

      if (domainsResponse.ok && domainsData.success) {
        setM23Domains(Array.isArray(domainsData.domains) ? domainsData.domains : []);
      }

      if (typesResponse.ok && typesData.success) {
        setM23RelationshipTypes(
          Array.isArray(typesData.relationshipTypes)
            ? typesData.relationshipTypes.map((value: unknown) =>
                typeof value === "string"
                  ? { value, label: value.replaceAll("_", " ") }
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

  const loadM23MetadataRelationships = async (metadataRecordId: number) => {
    try {
      const response = await getMetadataDomainRelationships(metadataRecordId);
      const data = await response.json();

      if (!response.ok || !data.success) {
        return [];
      }

      const relationships = Array.isArray(data.relationships)
        ? data.relationships
        : [];

      return relationships.map((item: any) => ({
        domainId: Number(item.domain_id ?? item.domainId),
        relationshipType: String(
          item.relationship_type ?? item.relationshipType ?? "SUBJECT"
        ),
      }));
    } catch {
      return [];
    }
  };

  const syncM23MetadataRelationships = async (
    metadataRecordId: number,
    selections: DomainRelationshipSelection[]
  ) => {
    const existing = await loadM23MetadataRelationships(metadataRecordId);

    const desired = new Map(
      selections.map((item) => [
        item.domainId + ":" + item.relationshipType,
        item,
      ])
    );

    const current = new Map(
      existing.map((item: DomainRelationshipSelection) => [
        item.domainId + ":" + item.relationshipType,
        item,
      ])
    );

    for (const item of existing) {
      const key = item.domainId + ":" + item.relationshipType;

      if (!desired.has(key)) {
        const response = await getMetadataDomainRelationships(metadataRecordId);
        const data = await response.json();

        const relationship = Array.isArray(data.relationships)
          ? data.relationships.find(
              (candidate: any) =>
                Number(candidate.domain_id ?? candidate.domainId) === item.domainId &&
                String(
                  candidate.relationship_type ?? candidate.relationshipType
                ) === item.relationshipType
            )
          : null;

        if (relationship?.id) {
          await deleteDomainRelationship(Number(relationship.id));
        }
      }
    }

    for (const item of selections) {
      const key = item.domainId + ":" + item.relationshipType;

      if (!current.has(key)) {
        await createDomainRelationship({
          metadata_record_id: metadataRecordId,
          domain_id: item.domainId,
          relationship_type: item.relationshipType,
        });
      }
    }
  };

`;

  page =
    page.slice(0, loadDataIndex) +
    loader +
    page.slice(loadDataIndex);

  const useEffectAnchor = "useEffect(() => {";
  const effectIndex = page.indexOf(useEffectAnchor, homeOpen);
  assert(effectIndex >= 0, "Could not locate existing useEffect.");

  const effectInsertion = `
  useEffect(() => {
    void loadM23RelationshipData();
  }, []);

`;

  if (!page.includes("void loadM23RelationshipData();")) {
    page =
      page.slice(0, effectIndex) +
      effectInsertion +
      page.slice(effectIndex);
  }

  console.log("PASS M23 domain/relationship loader.");

  const metadataSubmitIndex = page.indexOf("const handleMetadataSubmit = async");
  assert(metadataSubmitIndex >= 0, "Could not locate handleMetadataSubmit.");

  const metadataSubmitOpen = page.indexOf("{", metadataSubmitIndex);
  const metadataSubmitClose = findMatchingBrace(page, metadataSubmitOpen);
  assert(metadataSubmitClose >= 0, "Could not locate handleMetadataSubmit boundary.");

  let metadataSubmit = page.slice(metadataSubmitIndex, metadataSubmitClose + 1);

  if (!metadataSubmit.includes("syncM23MetadataRelationships")) {
    const successMarker = "if (!response.ok || !data.success)";
    const successIndex = metadataSubmit.indexOf(successMarker);
    assert(successIndex >= 0, "Could not locate metadata submit success guard.");

    const responseJsonIndex = metadataSubmit.indexOf("const data = await response.json();");
    assert(responseJsonIndex >= 0, "Could not locate metadata response parsing.");

    const responseLineEnd = metadataSubmit.indexOf("\n", responseJsonIndex);
    assert(responseLineEnd >= 0, "Could not locate metadata response line end.");

    const syncCode = `
    if (data.metadata?.id) {
      await syncM23MetadataRelationships(
        Number(data.metadata.id),
        metadataDomainSelections
      );
    }
`;

    metadataSubmit =
      metadataSubmit.slice(0, responseLineEnd + 1) +
      syncCode +
      metadataSubmit.slice(responseLineEnd + 1);

    page =
      page.slice(0, metadataSubmitIndex) +
      metadataSubmit +
      page.slice(metadataSubmitClose + 1);
  }

  console.log("PASS normal metadata relationship persistence.");

  const modalCallIndex = page.indexOf("<Modals");
  assert(modalCallIndex >= 0, "Could not locate Modals usage.");

  const modalTagEnd = page.indexOf("/>", modalCallIndex);
  assert(modalTagEnd >= 0, "Could not locate Modals closing tag.");

  const modalProps = `
          m23Domains={m23Domains}
          m23RelationshipTypes={m23RelationshipTypes}
          metadataDomainSelections={metadataDomainSelections}
          setMetadataDomainSelections={setMetadataDomainSelections}
          appraisalDomainSelections={appraisalDomainSelections}
          setAppraisalDomainSelections={setAppraisalDomainSelections}
`;

  if (!page.slice(modalCallIndex, modalTagEnd).includes("m23Domains={m23Domains}")) {
    page =
      page.slice(0, modalTagEnd) +
      modalProps +
      page.slice(modalTagEnd);
  }

  console.log("PASS Modals M23 props.");

  modals = addImport(
    modals,
    `import {
  DomainRelationshipSelector,
  type DomainRelationshipDomain,
  type DomainRelationshipSelection,
  type DomainRelationshipType,
} from "@/components/metadata/DomainRelationshipSelector";`
  );

  const propsMarker = "interface ModalsProps";
  const propsStart = modals.indexOf(propsMarker);
  assert(propsStart >= 0, "Could not locate ModalsProps.");

  const propsOpen = modals.indexOf("{", propsStart);
  const propsClose = findMatchingBrace(modals, propsOpen);
  assert(propsClose >= 0, "Could not locate ModalsProps boundary.");

  if (!modals.slice(propsOpen, propsClose).includes("m23Domains:")) {
    const additions = `
  m23Domains: DomainRelationshipDomain[];
  m23RelationshipTypes: DomainRelationshipType[];
  metadataDomainSelections: DomainRelationshipSelection[];
  setMetadataDomainSelections: React.Dispatch<React.SetStateAction<DomainRelationshipSelection[]>>;
  appraisalDomainSelections: DomainRelationshipSelection[];
  setAppraisalDomainSelections: React.Dispatch<React.SetStateAction<DomainRelationshipSelection[]>>;
`;
    modals =
      modals.slice(0, propsClose) +
      additions +
      modals.slice(propsClose);
  }

  const destructureMarker = "handleMetadataSubmit";
  const destructureIndex = modals.indexOf(destructureMarker, propsClose);
  assert(destructureIndex >= 0, "Could not locate Modals destructuring.");

  const destructureLineEnd = modals.indexOf("\n", destructureIndex);

  const destructureAdd = `
  m23Domains,
  m23RelationshipTypes,
  metadataDomainSelections,
  setMetadataDomainSelections,
  appraisalDomainSelections,
  setAppraisalDomainSelections,`;

  if (!modals.includes("m23Domains,\n", destructureIndex - 2000)) {
    modals =
      modals.slice(0, destructureLineEnd + 1) +
      destructureAdd +
      modals.slice(destructureLineEnd + 1);
  }

  const additionalMarker = 'id="manual-additional-metadata"';
  const additionalIndex = modals.indexOf(additionalMarker);
  assert(additionalIndex >= 0, "Could not locate normal metadata Additional Metadata section.");

  const sectionStart = modals.lastIndexOf("<div", additionalIndex);
  assert(sectionStart >= 0, "Could not locate normal metadata section wrapper.");

  const selectorMarkup = `
        <div className="mb-6">
          <DomainRelationshipSelector
            domains={m23Domains}
            relationshipTypes={m23RelationshipTypes}
            selected={metadataDomainSelections}
            onChange={setMetadataDomainSelections}
          />
        </div>
`;

  if (!modals.includes("<DomainRelationshipSelector")) {
    modals =
      modals.slice(0, sectionStart) +
      selectorMarkup +
      modals.slice(sectionStart);
  }

  const appraisalUsage = modals.indexOf("<Appraisal");
  assert(appraisalUsage >= 0, "Could not locate Appraisal component usage.");

  const appraisalEnd = modals.indexOf("/>", appraisalUsage);
  assert(appraisalEnd >= 0, "Could not locate Appraisal closing tag.");

  const appraisalProps = `
  m23Domains={m23Domains}
  m23RelationshipTypes={m23RelationshipTypes}
  appraisalDomainSelections={appraisalDomainSelections}
  setAppraisalDomainSelections={setAppraisalDomainSelections}
`;

  if (!modals.slice(appraisalUsage, appraisalEnd).includes("m23Domains={m23Domains}")) {
    modals =
      modals.slice(0, appraisalEnd) +
      appraisalProps +
      modals.slice(appraisalEnd);
  }

  console.log("PASS Modals selector integration.");

  appraisal = addImport(
    appraisal,
    `import {
  DomainRelationshipSelector,
  type DomainRelationshipDomain,
  type DomainRelationshipSelection,
  type DomainRelationshipType,
} from "@/components/metadata/DomainRelationshipSelector";`
  );

  const appraisalPropsMarker = "interface AppraisalProps";
  const appraisalPropsStart = appraisal.indexOf(appraisalPropsMarker);
  assert(appraisalPropsStart >= 0, "Could not locate AppraisalProps.");

  const appraisalPropsOpen = appraisal.indexOf("{", appraisalPropsStart);
  const appraisalPropsClose = findMatchingBrace(appraisal, appraisalPropsOpen);
  assert(appraisalPropsClose >= 0, "Could not locate AppraisalProps boundary.");

  if (!appraisal.slice(appraisalPropsOpen, appraisalPropsClose).includes("m23Domains:")) {
    const additions = `
  m23Domains: DomainRelationshipDomain[];
  m23RelationshipTypes: DomainRelationshipType[];
  appraisalDomainSelections: DomainRelationshipSelection[];
  setAppraisalDomainSelections: React.Dispatch<React.SetStateAction<DomainRelationshipSelection[]>>;
`;
    appraisal =
      appraisal.slice(0, appraisalPropsClose) +
      additions +
      appraisal.slice(appraisalPropsClose);
  }

  const appraisalDestructureMarker = "handleCreateMetadataFromAppraisal";
  const appraisalDestructureIndex = appraisal.indexOf(
    appraisalDestructureMarker,
    appraisalPropsClose
  );
  assert(
    appraisalDestructureIndex >= 0,
    "Could not locate Appraisal destructuring."
  );

  const appraisalDestructureLineEnd = appraisal.indexOf(
    "\n",
    appraisalDestructureIndex
  );

  if (!appraisal.slice(appraisalDestructureIndex - 1500, appraisalDestructureLineEnd + 1).includes("m23Domains")) {
    appraisal =
      appraisal.slice(0, appraisalDestructureLineEnd + 1) +
      `
  m23Domains,
  m23RelationshipTypes,
  appraisalDomainSelections,
  setAppraisalDomainSelections,` +
      appraisal.slice(appraisalDestructureLineEnd + 1);
  }

  const appraisalAdditionalMarker = "Additional Metadata";
  const appraisalAdditionalIndex = appraisal.indexOf(appraisalAdditionalMarker);
  assert(
    appraisalAdditionalIndex >= 0,
    "Could not locate appraisal Additional Metadata section."
  );

  const appraisalAdditionalStart = appraisal.lastIndexOf(
    "<div",
    appraisalAdditionalIndex
  );

  const appraisalSelectorMarkup = `
      <div className="mb-6">
        <DomainRelationshipSelector
          domains={m23Domains}
          relationshipTypes={m23RelationshipTypes}
          selected={appraisalDomainSelections}
          onChange={setAppraisalDomainSelections}
          disabled={reviewingDecision}
        />
      </div>
`;

  if (!appraisal.includes("<DomainRelationshipSelector")) {
    appraisal =
      appraisal.slice(0, appraisalAdditionalStart) +
      appraisalSelectorMarkup +
      appraisal.slice(appraisalAdditionalStart);
  }

  console.log("PASS Appraisal selector integration.");

  write(files.page, page);
  write(files.modals, modals);
  write(files.appraisal, appraisal);

  console.log("\n=== FRONTEND FILES WRITTEN ===");

  process.exitCode = 0;
} catch (error) {
  console.error("\nM23 integration failed before validation:");
  console.error(error instanceof Error ? error.stack : error);

  for (const [key, backup] of backups) {
    fs.copyFileSync(backup, files[key]);
    console.log(`RESTORED: ${key}`);
  }

  process.exitCode = 1;
}
