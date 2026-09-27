const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const cp = require("child_process");

const root = process.cwd();

const files = {
  page: path.join(root, "apps", "web", "src", "app", "page.tsx"),
  modals: path.join(root, "apps", "web", "src", "components", "modals", "Modals.tsx"),
  appraisal: path.join(root, "apps", "web", "src", "components", "appraisal", "Appraisal.tsx"),
  selector: path.join(root, "apps", "web", "src", "components", "metadata", "DomainRelationshipSelector.tsx"),
  domainApi: path.join(root, "apps", "web", "src", "lib", "api", "domainRelationships.ts"),
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

function ensure(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function replaceSingle(text, regex, replacement, description) {
  const matches = text.match(regex);

  ensure(
    matches && matches.length === 1,
    `${description}: expected exactly one match, found ${matches ? matches.length : 0}.`
  );

  return text.replace(regex, replacement);
}

function insertAfterSingle(text, regex, insertion, description) {
  return replaceSingle(
    text,
    regex,
    (match) => match + insertion,
    description
  );
}

function backup(file, suffix) {
  const target = `${file}.${suffix}.tsx`;
  fs.copyFileSync(file, target);
  return target;
}

console.log("\n===== M23 ROBUST FRONTEND PATCH =====");

console.log("\n===== VERIFYING CLEAN M23 BASELINE =====");

for (const [name, file] of Object.entries({
  page: files.page,
  modals: files.modals,
  appraisal: files.appraisal,
})) {
  const actual = hash(file);

  ensure(
    actual === expected[name],
    `${name}.tsx is not the clean M23 baseline.\nExpected: ${expected[name]}\nActual:   ${actual}`
  );

  console.log(`${name}.tsx baseline OK`);
}

ensure(
  fs.existsSync(files.selector),
  "DomainRelationshipSelector.tsx is missing."
);

ensure(
  fs.existsSync(files.domainApi),
  "domainRelationships.ts API client is missing."
);

console.log("\n===== CREATING SAFE BACKUPS =====");

const stamp =
  new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);

const backups = {
  page: backup(
    files.page,
    `before-m23-robust-page-${stamp}`
  ),
  modals: backup(
    files.modals,
    `before-m23-robust-modals-${stamp}`
  ),
  appraisal: backup(
    files.appraisal,
    `before-m23-robust-appraisal-${stamp}`
  ),
};

console.log(backups.page);
console.log(backups.modals);
console.log(backups.appraisal);

let page = read(files.page);
let modals = read(files.modals);
let appraisal = read(files.appraisal);

/*
 * ============================================================
 * MODALS
 * ============================================================
 */

console.log("\n===== PATCHING MODALS =====");

/*
 * Import the selector and its types immediately after the
 * existing metadata type import.
 *
 * This matches the ACTUAL Modals.tsx structure:
 *
 * import type {
 *   AdditionalMetadataField,
 *   MetadataRecord,
 * } from "@/types/metadata";
 */
const modalsMetadataImport =
  /import type\s*\{\s*AdditionalMetadataField,\s*MetadataRecord,\s*\}\s*from\s*"@\/types\/metadata";/m;

ensure(
  modalsMetadataImport.test(modals),
  "Actual Modals.tsx metadata type import was not found."
);

modals = insertAfterSingle(
  modals,
  modalsMetadataImport,
  `
import {
  DomainRelationshipSelector,
} from "@/components/metadata/DomainRelationshipSelector";

import type {
  DomainRelationshipSelection,
  DomainRelationshipDomain,
  DomainRelationshipType,
} from "@/components/metadata/DomainRelationshipSelector";
`,
  "Modals metadata type import"
);

/*
 * Add domain relationship props immediately before the first
 * existing canManageDepartments prop.
 */
const modalPropsAnchor =
  /type\s+ModalsProps\s*=\s*\{/m;

ensure(
  modalPropsAnchor.test(modals),
  "ModalsProps declaration was not found."
);

const modalPropsStart =
  modals.search(/type\s+ModalsProps\s*=\s*\{/m);

ensure(
  modalPropsStart >= 0,
  "Could not determine ModalsProps start."
);

const modalDepartmentsOffset =
  modals
    .slice(modalPropsStart)
    .search(/\s+canManageDepartments:\s*boolean;/m);

ensure(
  modalDepartmentsOffset >= 0,
  "Could not locate canManageDepartments inside ModalsProps."
);

const modalDepartmentsIndex =
  modalPropsStart +
  modalDepartmentsOffset;

const modalDepartmentsMatch =
  modals
    .slice(modalDepartmentsIndex)
    .match(/\s+canManageDepartments:\s*boolean;/m);

ensure(
  modalDepartmentsMatch,
  "Could not determine canManageDepartments property length."
);

const modalDepartmentsEnd =
  modalDepartmentsIndex +
  modalDepartmentsMatch[0].length;

modals =
  modals.slice(0, modalDepartmentsEnd) +
  `
  domainRelationshipDomains: DomainRelationshipDomain[];
  domainRelationshipTypes: DomainRelationshipType[];
  metadataDomainRelationships: DomainRelationshipSelection[];
  setMetadataDomainRelationships: Dispatch<
    SetStateAction<DomainRelationshipSelection[]>
  >;
  appraisalDomainRelationships: DomainRelationshipSelection[];
  setAppraisalDomainRelationships: Dispatch<
    SetStateAction<DomainRelationshipSelection[]>
  >;
  domainRelationshipsLoading: boolean;
  domainRelationshipsError: string;
` +
  modals.slice(modalDepartmentsEnd);
/*
 * Destructure the new props. Insert after the existing
 * canManageDepartments destructuring line.
 */
const modalDestructure =
  /(\s+canManageDepartments,\s*\n)/m;

ensure(
  modalDestructure.test(modals),
  "Modals canManageDepartments destructuring was not found."
);

modals = insertAfterSingle(
  modals,
  modalDestructure,
  `  domainRelationshipDomains,
  domainRelationshipTypes,
  metadataDomainRelationships,
  setMetadataDomainRelationships,
  appraisalDomainRelationships,
  setAppraisalDomainRelationships,
  domainRelationshipsLoading,
  domainRelationshipsError,
`,
  "Modals domain relationship destructuring"
);

/*
 * Insert the normal metadata selector immediately before the
 * UNIQUE manual-additional-metadata wrapper.
 */
const manualAdditional =
  /(\s*<div\s+id="manual-additional-metadata"[\s\S]*?<\/div>)/m;

ensure(
  manualAdditional.test(modals),
  "The manual-additional-metadata wrapper was not found."
);

const normalSelector = `
        <DomainRelationshipSelector
          domains={domainRelationshipDomains}
          relationshipTypes={domainRelationshipTypes}
          selected={metadataDomainRelationships}
          onChange={setMetadataDomainRelationships}
          disabled={
            !canManageMetadata ||
            domainRelationshipsLoading
          }
          title="Domain Relationships"
          description="Associate this metadata record with one or more domains and define the relationship context."
        />

        {domainRelationshipsError && (
          <p
            role="alert"
            className="mt-3 text-sm text-red-600"
          >
            {domainRelationshipsError}
          </p>
        )}

`;

modals = modals.replace(
  manualAdditional,
  (match) => normalSelector + match
);

/*
 * Add the new props to the existing <Appraisal /> invocation.
 */
const appraisalInvocation =
  /(<Appraisal\s+[\s\S]*?canManageDocuments=\{canManageDocuments\})/m;

ensure(
  appraisalInvocation.test(modals),
  "The Appraisal component invocation was not found."
);

modals = modals.replace(
  appraisalInvocation,
  `$1
  domainRelationshipDomains={domainRelationshipDomains}
  domainRelationshipTypes={domainRelationshipTypes}
  appraisalDomainRelationships={appraisalDomainRelationships}
  setAppraisalDomainRelationships={
    setAppraisalDomainRelationships
  }
  domainRelationshipsLoading={domainRelationshipsLoading}
  domainRelationshipsError={domainRelationshipsError}`
);

console.log("Modals patched.");

/*
 * ============================================================
 * APPRAISAL
 * ============================================================
 */

console.log("\n===== PATCHING APPRAISAL =====");

/*
 * Add selector import after existing imports.
 */
const appraisalUploadedImport =
  /import type\s*\{\s*UploadedAppraisal\s*\}\s*from\s*"@\/types\/appraisal";/m;

ensure(
  appraisalUploadedImport.test(appraisal),
  "Appraisal UploadedAppraisal import was not found."
);

appraisal = insertAfterSingle(
  appraisal,
  appraisalUploadedImport,
  `
import {
  DomainRelationshipSelector,
} from "@/components/metadata/DomainRelationshipSelector";

import type {
  DomainRelationshipSelection,
  DomainRelationshipDomain,
  DomainRelationshipType,
} from "@/components/metadata/DomainRelationshipSelector";
`,
  "Appraisal selector import"
);

/*
 * Add props after canManageDocuments.
 */
const appraisalProps =
  /(\s+canManageDocuments:\s*boolean;)/m;

ensure(
  appraisalProps.test(appraisal),
  "AppraisalProps canManageDocuments property was not found."
);

appraisal = insertAfterSingle(
  appraisal,
  appraisalProps,
  `
  domainRelationshipDomains: DomainRelationshipDomain[];
  domainRelationshipTypes: DomainRelationshipType[];
  appraisalDomainRelationships: DomainRelationshipSelection[];
  setAppraisalDomainRelationships: Dispatch<
    SetStateAction<DomainRelationshipSelection[]>
  >;
  domainRelationshipsLoading: boolean;
  domainRelationshipsError: string;
`,
  "Appraisal domain relationship props"
);

/*
 * Destructure after canManageDocuments.
 */
const appraisalDestructure =
  /(\s+canManageDocuments,\s*\n)/m;

ensure(
  appraisalDestructure.test(appraisal),
  "Appraisal canManageDocuments destructuring was not found."
);

appraisal = insertAfterSingle(
  appraisal,
  appraisalDestructure,
  `  domainRelationshipDomains,
  domainRelationshipTypes,
  appraisalDomainRelationships,
  setAppraisalDomainRelationships,
  domainRelationshipsLoading,
  domainRelationshipsError,
`,
  "Appraisal domain relationship destructuring"
);

/*
 * Insert selector immediately before the matched metadata section.
 * The current component contains the matchedMetadata prop and
 * renders its matched metadata card afterwards.
 */
const matchedMetadataSection =
  /(\s*\/\*[\s\S]{0,500}?MATCHED[\s\S]{0,500}?\*\/\s*)/i;

if (matchedMetadataSection.test(appraisal)) {
  appraisal = appraisal.replace(
    matchedMetadataSection,
    `
        <DomainRelationshipSelector
          domains={domainRelationshipDomains}
          relationshipTypes={domainRelationshipTypes}
          selected={appraisalDomainRelationships}
          onChange={setAppraisalDomainRelationships}
          disabled={
            reviewingDecision ||
            !canManageDocuments ||
            domainRelationshipsLoading
          }
          title="Domain Relationships"
          description="Associate this metadata record with one or more domains and define the relationship context."
        />

        {domainRelationshipsError && (
          <p
            role="alert"
            className="mt-3 text-sm text-red-600"
          >
            {domainRelationshipsError}
          </p>
        )}
$1`
  );
} else {
  /*
   * The current Appraisal component has the Additional Metadata
   * section before matched metadata. Use the first occurrence of
   * the matchedMetadata conditional instead of relying on comments.
   */
  const fallback =
    /(\s*matchedMetadata\s*&&)/m;

  ensure(
    fallback.test(appraisal),
    "Could not locate the matched metadata section in Appraisal.tsx."
  );

  appraisal = appraisal.replace(
    fallback,
    `
        <DomainRelationshipSelector
          domains={domainRelationshipDomains}
          relationshipTypes={domainRelationshipTypes}
          selected={appraisalDomainRelationships}
          onChange={setAppraisalDomainRelationships}
          disabled={
            reviewingDecision ||
            !canManageDocuments ||
            domainRelationshipsLoading
          }
          title="Domain Relationships"
          description="Associate this metadata record with one or more domains and define the relationship context."
        />

        {domainRelationshipsError && (
          <p
            role="alert"
            className="mt-3 text-sm text-red-600"
          >
            {domainRelationshipsError}
          </p>
        )}

$1`
  );
}

console.log("Appraisal patched.");

/*
 * ============================================================
 * PAGE
 * ============================================================
 */

console.log("\n===== PATCHING PAGE =====");

/*
 * Imports.
 */
const pageDomainRegistryImport =
  /import\s*\{\s*DomainRegistry\s*\}\s*from\s*"@\/components\/metadata\/DomainRegistry";/m;

ensure(
  pageDomainRegistryImport.test(page),
  "Page DomainRegistry import was not found."
);

page = insertAfterSingle(
  page,
  pageDomainRegistryImport,
  `
import {
  createDomainRelationship,
  deleteDomainRelationship,
  getMetadataDomainRelationships,
  getRelationshipTypes,
} from "@/lib/api/domainRelationships";

import { getDomainRegistry } from "@/lib/api/domainRegistry";

import type {
  DomainRelationshipSelection,
  DomainRelationshipDomain,
  DomainRelationshipType,
} from "@/components/metadata/DomainRelationshipSelector";
`,
  "Page domain relationship imports"
);

/*
 * State goes immediately after the existing metadata form state.
 * Match the ACTUAL formatting rather than one exact layout.
 */
const pageFormState =
  /const\s+\[form,\s*setForm\]\s*=\s*\n?\s*useState\(EMPTY_FORM\);/m;

ensure(
  pageFormState.test(page),
  "Page metadata form state was not found."
);

page = insertAfterSingle(
  page,
  pageFormState,
  `
  const [
    domainRelationshipDomains,
    setDomainRelationshipDomains,
  ] = useState<DomainRelationshipDomain[]>([]);

  const [
    domainRelationshipTypes,
    setDomainRelationshipTypes,
  ] = useState<DomainRelationshipType[]>([]);

  const [
    metadataDomainRelationships,
    setMetadataDomainRelationships,
  ] = useState<DomainRelationshipSelection[]>([]);

  const [
    appraisalDomainRelationships,
    setAppraisalDomainRelationships,
  ] = useState<DomainRelationshipSelection[]>([]);

  const [
    domainRelationshipsLoading,
    setDomainRelationshipsLoading,
  ] = useState(false);

  const [
    domainRelationshipsError,
    setDomainRelationshipsError,
  ] = useState("");
`,
  "Page domain relationship state"
);

/*
 * Helpers are inserted immediately before handleMetadataSubmit.
 */
const metadataSubmit =
  /const\s+handleMetadataSubmit\s*=\s*async\s*\(/m;

ensure(
  metadataSubmit.test(page),
  "handleMetadataSubmit was not found."
);

const helpers = `
  const loadDomainRelationshipDefinitions = async () => {
    try {
      const [
        domainsResponse,
        typesResponse,
      ] = await Promise.all([
        getDomainRegistry(),
        getRelationshipTypes(),
      ]);

      const domainsData =
        await domainsResponse.json();

      const typesData =
        await typesResponse.json();

      if (!domainsResponse.ok) {
        throw new Error(
          domainsData.error ||
            "Unable to load domain registry."
        );
      }

      if (!typesResponse.ok) {
        throw new Error(
          typesData.error ||
            "Unable to load relationship types."
        );
      }

      const rawDomains =
        Array.isArray(domainsData.domains)
          ? domainsData.domains
          : Array.isArray(domainsData.data)
            ? domainsData.data
            : [];

      setDomainRelationshipDomains(
        rawDomains
          .map((domain: any) => ({
            id: Number(domain.id),
            domain_key: String(
              domain.domain_key ?? ""
            ),
            display_name: String(
              domain.display_name ??
                domain.domain_key ??
                ""
            ),
            description:
              domain.description ?? null,
            domain_family:
              domain.domain_family ?? null,
          }))
          .filter(
            (domain: DomainRelationshipDomain) =>
              Number.isInteger(domain.id) &&
              domain.id > 0 &&
              domain.domain_key
          )
      );

      const rawTypes =
        Array.isArray(typesData.relationshipTypes)
          ? typesData.relationshipTypes
          : Array.isArray(typesData.types)
            ? typesData.types
            : Array.isArray(typesData.data)
              ? typesData.data
              : [];

      setDomainRelationshipTypes(
        rawTypes
          .map((type: any) => {
            if (typeof type === "string") {
              return {
                value: type,
                label: type,
              };
            }

            const value =
              type?.value ??
              type?.relationship_type ??
              type?.key ??
              "";

            return {
              value: String(value),
              label: String(
                type?.label ??
                  type?.display_name ??
                  value
              ),
            };
          })
          .filter(
            (type: DomainRelationshipType) =>
              type.value
          )
      );
    } catch (error) {
      setDomainRelationshipsError(
        error instanceof Error
          ? error.message
          : "Unable to load domain relationships."
      );
    }
  };

  const loadMetadataDomainRelationships = async (
    metadataRecordId: string | number | null
  ) => {
    if (!metadataRecordId) {
      setMetadataDomainRelationships([]);
      return;
    }

    try {
      setDomainRelationshipsLoading(true);

      const response =
        await getMetadataDomainRelationships(
          metadataRecordId
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to load metadata domain relationships."
        );
      }

      const relationships =
        Array.isArray(data.relationships)
          ? data.relationships
          : [];

      setMetadataDomainRelationships(
        relationships
          .map((item: any) => ({
            domainId: Number(
              item.domain_id ??
                item.domain?.id
            ),
            relationshipType: String(
              item.relationship_type ?? ""
            ),
          }))
          .filter(
            (item: DomainRelationshipSelection) =>
              Number.isInteger(item.domainId) &&
              item.domainId > 0 &&
              item.relationshipType
          )
      );
    } catch (error) {
      setDomainRelationshipsError(
        error instanceof Error
          ? error.message
          : "Unable to load metadata domain relationships."
      );
      setMetadataDomainRelationships([]);
    } finally {
      setDomainRelationshipsLoading(false);
    }
  };

  const saveDomainRelationships = async (
    metadataRecordId: string | number,
    desired: DomainRelationshipSelection[]
  ) => {
    const currentResponse =
      await getMetadataDomainRelationships(
        metadataRecordId
      );

    const currentData =
      await currentResponse.json();

    if (!currentResponse.ok) {
      throw new Error(
        currentData.error ||
          "Unable to load existing domain relationships."
      );
    }

    const current =
      Array.isArray(currentData.relationships)
        ? currentData.relationships
        : [];

    const key = (
      domainId: number,
      relationshipType: string
    ) =>
      domainId +
      ":" +
      relationshipType;

    const desiredKeys =
      new Set(
        desired.map((item) =>
          key(
            item.domainId,
            item.relationshipType
          )
        )
      );

    for (const item of current) {
      const currentDomainId =
        Number(
          item.domain_id ??
            item.domain?.id
        );

      const currentType =
        String(
          item.relationship_type ?? ""
        );

      if (
        !desiredKeys.has(
          key(
            currentDomainId,
            currentType
          )
        )
      ) {
        const response =
          await deleteDomainRelationship(
            item.id
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Unable to remove a domain relationship."
          );
        }
      }
    }

    const currentKeys =
      new Set(
        current.map((item: any) =>
          key(
            Number(
              item.domain_id ??
                item.domain?.id
            ),
            String(
              item.relationship_type ?? ""
            )
          )
        )
      );

    for (const item of desired) {
      const itemKey =
        key(
          item.domainId,
          item.relationshipType
        );

      if (currentKeys.has(itemKey)) {
        continue;
      }

      const response =
        await createDomainRelationship({
          metadata_record_id:
            Number(metadataRecordId),
          domain_id:
            item.domainId,
          relationship_type:
            item.relationshipType,
        });

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to create a domain relationship."
        );
      }
    }

    await loadMetadataDomainRelationships(
      metadataRecordId
    );
  };

`;

page = insertAfterSingle(
  page,
  metadataSubmit,
  helpers,
  "M23 page helper insertion point"
);

/*
 * Load domain definitions whenever authenticated user state
 * becomes available. Insert immediately before the existing
 * first data-loading effect.
 */
const firstLoadEffect =
  /useEffect\(\(\)\s*=>\s*\{\s*loadData\(\);/m;

if (firstLoadEffect.test(page)) {
  page = page.replace(
    firstLoadEffect,
    `useEffect(() => {
    if (authUser) {
      void loadDomainRelationshipDefinitions();
    }
  }, [authUser]);

  useEffect(() => {
    loadData();
  `
  );
}

/*
 * Metadata creation:
 * after successful createMetadata response parsing, save the
 * selected domain relationships.
 *
 * We identify the actual handleMetadataSubmit block by locating
 * it and its closing "};", then patch only that block.
 */
function patchFunctionBlock(
  source,
  functionName,
  transform
) {
  const marker =
    `const ${functionName} = async`;

  const start =
    source.indexOf(marker);

  ensure(
    start >= 0,
    `Could not locate ${functionName}.`
  );

  const braceStart =
    source.indexOf("{", start);

  ensure(
    braceStart >= 0,
    `Could not locate ${functionName} body.`
  );

  let depth = 0;
  let quote = null;
  let escaped = false;
  let end = -1;

  for (
    let i = braceStart;
    i < source.length;
    i++
  ) {
    const ch = source[i];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (ch === "\\") {
        escaped = true;
        continue;
      }

      if (ch === quote) {
        quote = null;
      }

      continue;
    }

    if (
      ch === "'" ||
      ch === '"' ||
      ch === "`"
    ) {
      quote = ch;
      continue;
    }

    if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;

      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }

  ensure(
    end >= 0,
    `Could not determine end of ${functionName}.`
  );

  const block =
    source.slice(start, end);

  const transformed =
    transform(block);

  return (
    source.slice(0, start) +
    transformed +
    source.slice(end)
  );
}

page = patchFunctionBlock(
  page,
  "handleMetadataSubmit",
  (block) => {
    const guard =
      /(\s*closeMetadataModal\(\);\s*\n\s*setForm\(\{\s*\.\.\.EMPTY_FORM,\s*\}\);\s*)/m;

    ensure(
      guard.test(block),
      "Could not locate metadata success reset."
    );

    return block.replace(
      guard,
      `
      const metadataRecordId =
        Number(
          data.metadata?.id ??
            data.record?.id ??
            0
        );

      if (
        metadataRecordId > 0 &&
        metadataDomainRelationships.length > 0
      ) {
        await saveDomainRelationships(
          metadataRecordId,
          metadataDomainRelationships
        );
      }

      setMetadataDomainRelationships([]);

      $1`
    );
  }
);

/*
 * Upload handler:
 * use the ACTUAL assignment supplied by the user.
 *
 * After:
 *
 * setUploadedAppraisal(appraisal);
 *
 * load existing relationships if a metadata record is present.
 */
page = patchFunctionBlock(
  page,
  "handleUpload",
  (block) => {
    const assignment =
      /(\s*setUploadedAppraisal\(appraisal\);\s*)/m;

    ensure(
      assignment.test(block),
      "Could not locate setUploadedAppraisal(appraisal) in handleUpload."
    );

    return block.replace(
      assignment,
      `
        const uploadedMetadataRecordId =
          appraisal.metadataRecordId ??
          appraisal.metadata?.id ??
          data.metadata?.id ??
          null;

        await loadMetadataDomainRelationships(
          uploadedMetadataRecordId
        );

        $1`
    );
  }
);

/*
 * Ensure appraisal relationships are cleared when there is no
 * appraisal.
 */
page = patchFunctionBlock(
  page,
  "handleUpload",
  (block) => {
    const noAppraisal =
      /(\s*setUploadedAppraisal\(null\);\s*)/m;

    if (!noAppraisal.test(block)) {
      return block;
    }

    return block.replace(
      noAppraisal,
      `
        setAppraisalDomainRelationships([]);
        $1`
    );
  }
);

/*
 * Add domain relationship props to Modals.
 */
const modalsRender =
  /<Modals\s+[\s\S]*?canManageDepartments=\{canManageDepartments\}/m;

ensure(
  modalsRender.test(page),
  "The page Modals invocation was not found."
);

page = page.replace(
  modalsRender,
  (match) =>
    match +
    `
  domainRelationshipDomains={domainRelationshipDomains}
  domainRelationshipTypes={domainRelationshipTypes}
  metadataDomainRelationships={metadataDomainRelationships}
  setMetadataDomainRelationships={
    setMetadataDomainRelationships
  }
  appraisalDomainRelationships={appraisalDomainRelationships}
  setAppraisalDomainRelationships={
    setAppraisalDomainRelationships
  }
  domainRelationshipsLoading={
    domainRelationshipsLoading
  }
  domainRelationshipsError={
    domainRelationshipsError
  }`
);

/*
 * Clear normal metadata relationships when the metadata modal
 * closes. This is intentionally attached to the existing close
 * handler rather than creating a second close mechanism.
 */
page = patchFunctionBlock(
  page,
  "closeMetadataModal",
  (block) => {
    const opening =
      /(\s*const closeMetadataModal = \(\) => \{\s*)/m;

    ensure(
      opening.test(block),
      "Could not locate closeMetadataModal body."
    );

    return block.replace(
      opening,
      `$1
    setMetadataDomainRelationships([]);
    setDomainRelationshipsError("");
`
    );
  }
);

console.log("Page patched.");

/*
 * ============================================================
 * WRITE TEMPORARY FILES
 * ============================================================
 */

console.log("\n===== WRITING TEMPORARY PATCH FILES =====");

const tmp = {
  page: `${files.page}.m23.tmp`,
  modals: `${files.modals}.m23.tmp`,
  appraisal: `${files.appraisal}.m23.tmp`,
};

write(tmp.page, page);
write(tmp.modals, modals);
write(tmp.appraisal, appraisal);

console.log("Temporary files written.");

/*
 * ============================================================
 * VALIDATION
 * ============================================================
 */

console.log("\n===== VALIDATING PATCHED TYPESCRIPT =====");

try {
  cp.execFileSync(
    "npx.cmd",
    ["tsc", "--noEmit"],
    {
      cwd: path.join(root, "apps", "web"),
      stdio: "inherit",
    }
  );
} catch (error) {
  console.error(
    "\nTypeScript validation failed."
  );

  for (const file of Object.values(tmp)) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }

  throw new Error(
    "M23 frontend patch was NOT installed because TypeScript validation failed. Original files remain untouched."
  );
}

/*
 * ============================================================
 * COMMIT PATCH TO REAL FILES
 * ============================================================
 */

console.log("\n===== TYPESCRIPT VALIDATION PASSED =====");

fs.copyFileSync(
  tmp.page,
  files.page
);

fs.copyFileSync(
  tmp.modals,
  files.modals
);

fs.copyFileSync(
  tmp.appraisal,
  files.appraisal
);

for (const file of Object.values(tmp)) {
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }
}

console.log("\n===== M23 FRONTEND PATCH COMPLETE =====");
console.log("page.tsx updated.");
console.log("Modals.tsx updated.");
console.log("Appraisal.tsx updated.");
console.log("TypeScript validation passed.");
console.log("Backups preserved.");


