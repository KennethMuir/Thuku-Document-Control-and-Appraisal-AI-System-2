const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = process.cwd();

const files = {
  page: path.join(root, "apps", "web", "src", "app", "page.tsx"),
  modals: path.join(root, "apps", "web", "src", "components", "modals", "Modals.tsx"),
  appraisal: path.join(root, "apps", "web", "src", "components", "appraisal", "Appraisal.tsx"),
};

const expected = {
  page: "E99A95F50401BA93A21B42D82611AF652FC78E2A928B237E1B42B9B8D5DDE79D",
  modals: "FD0A3D789FCCED0928AABF082859D2D02E93897D8B2BCF0B1926AF0FFE99FD98",
  appraisal: "B9C04590E48C7CAB8D490DFBC174DBF619AC000BF4AF3868475CCEB4DB292572",
};

function hash(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();
}

function fail(message) {
  throw new Error(message);
}

function replaceOnce(text, pattern, replacement, description) {
  const regex =
    pattern instanceof RegExp
      ? pattern
      : new RegExp(pattern);

  const countRegex = new RegExp(
    regex.source,
    regex.flags.includes("g")
      ? regex.flags
      : regex.flags + "g"
  );

  const matches = Array.from(
    text.matchAll(countRegex)
  );

  if (matches.length === 0) {
    fail("Could not locate " + description + ".");
  }

  if (matches.length !== 1) {
    fail(
      "Expected exactly one occurrence of " +
        description +
        ", found " +
        matches.length +
        "."
    );
  }

  return text.replace(regex, replacement);
}

function insertAfterRegex(text, pattern, insertion, description) {
  const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
  const match = text.match(regex);

  if (!match) {
    fail("Could not locate " + description + ".");
  }

  const index = match.index + match[0].length;
  return text.slice(0, index) + insertion + text.slice(index);
}

function backup(file, label) {
  const stamp = new Date().toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "")
    .replace("T", "");

  const destination = file.replace(
    path.basename(file),
    path.basename(file).replace(
      /\.(tsx|ts)$/,
      `.before-m23-domain-relationships-${label}-${stamp}.$1`
    )
  );

  fs.copyFileSync(file, destination);
  return destination;
}

console.log("\n===== VERIFYING CLEAN M23 BASELINE =====");

for (const [name, file] of Object.entries(files)) {
  const actual = hash(file);

  if (actual !== expected[name]) {
    fail(
      `${name} is not the clean M23 baseline.\nExpected: ${expected[name]}\nActual:   ${actual}`
    );
  }

  console.log(`${name}.tsx baseline OK`);
}

const original = {
  page: fs.readFileSync(files.page, "utf8"),
  modals: fs.readFileSync(files.modals, "utf8"),
  appraisal: fs.readFileSync(files.appraisal, "utf8"),
};

console.log("\n===== CREATING BACKUPS =====");

console.log(backup(files.page, "page"));
console.log(backup(files.modals, "modals"));
console.log(backup(files.appraisal, "appraisal"));

let page = original.page;
let modals = original.modals;
let appraisal = original.appraisal;

/*
 * ===============================================================
 * PAGE IMPORTS
 * ===============================================================
 */

page = replaceOnce(
  page,
  /import \{ searchDocuments \} from "@\/lib\/api\/search";/,
  `import { searchDocuments } from "@/lib/api/search";
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
} from "@/components/metadata/DomainRelationshipSelector";`,
  "page search import"
);

/*
 * ===============================================================
 * PAGE FORM STATE
 *
 * IMPORTANT:
 * The actual source is:
 *
 * const [form, setForm] =
 *     useState(EMPTY_FORM);
 *
 * Therefore this deliberately uses \s* and does NOT require
 * everything to be on one line.
 * ===============================================================
 */

const formStatePattern =
  /const\s*\[form,\s*setForm\]\s*=\s*useState\(EMPTY_FORM\);/;

if (!formStatePattern.test(page)) {
  fail("Could not locate page form state using whitespace-tolerant matching.");
}

page = replaceOnce(
  page,
  formStatePattern,
  `const [form, setForm] =
    useState(EMPTY_FORM);

  const [domainRelationshipDomains, setDomainRelationshipDomains] =
    useState<DomainRelationshipDomain[]>([]);
  const [domainRelationshipTypes, setDomainRelationshipTypes] =
    useState<DomainRelationshipType[]>([]);
  const [metadataDomainRelationships, setMetadataDomainRelationships] =
    useState<DomainRelationshipSelection[]>([]);
  const [appraisalDomainRelationships, setAppraisalDomainRelationships] =
    useState<DomainRelationshipSelection[]>([]);
  const [domainRelationshipsLoading, setDomainRelationshipsLoading] =
    useState(false);
  const [domainRelationshipsError, setDomainRelationshipsError] =
    useState("");`,
  "page relationship state"
);

/*
 * ===============================================================
 * PAGE DOMAIN RELATIONSHIP HELPERS
 * ===============================================================
 */

const helperAnchor =
  /const\s+handleMetadataSubmit\s*=\s*async\s*\(/;

const relationshipHelpers = `const loadDomainRelationshipDefinitions = async () => {
    setDomainRelationshipsLoading(true);
    setDomainRelationshipsError("");

    try {
      const [domainsResponse, typesResponse] = await Promise.all([
        getDomainRegistry(),
        getRelationshipTypes(),
      ]);

      const domainsData = await domainsResponse.json();
      const typesData = await typesResponse.json();

      if (!domainsResponse.ok || !domainsData.success) {
        throw new Error(
          domainsData.error || "Unable to load domain registry."
        );
      }

      if (!typesResponse.ok || !typesData.success) {
        throw new Error(
          typesData.error || "Unable to load relationship types."
        );
      }

      const domains = Array.isArray(domainsData.domains)
        ? domainsData.domains
        : [];

      const rawTypes = Array.isArray(typesData.relationshipTypes)
        ? typesData.relationshipTypes
        : Array.isArray(typesData.types)
          ? typesData.types
          : [];

      setDomainRelationshipDomains(
        domains.map((domain: DomainRelationshipDomain) => ({
          id: Number(domain.id),
          domain_key: String(domain.domain_key),
          display_name: String(domain.display_name),
          description: domain.description ?? null,
          domain_family: domain.domain_family ?? null,
        }))
      );

      setDomainRelationshipTypes(
        rawTypes.map((type: string | DomainRelationshipType) => {
          if (typeof type === "string") {
            return {
              value: type,
              label: type.replaceAll("_", " "),
            };
          }

          return {
            value: String(type.value),
            label:
              type.label ??
              String(type.value).replaceAll("_", " "),
          };
        })
      );
    } catch (error) {
      setDomainRelationshipsError(
        error instanceof Error
          ? error.message
          : "Unable to load domain relationships."
      );
    } finally {
      setDomainRelationshipsLoading(false);
    }
  };

  const loadMetadataDomainRelationships = async (
    metadataRecordId: string | number | null | undefined
  ) => {
    if (!metadataRecordId) {
      return [];
    }

    const response =
      await getMetadataDomainRelationships(metadataRecordId);

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.error ||
          "Unable to load metadata domain relationships."
      );
    }

    const relationships = Array.isArray(data.relationships)
      ? data.relationships
      : [];

    const selections = relationships.map(
      (relationship: {
        domain_id: number | string;
        relationship_type: string;
      }) => ({
        domainId: Number(relationship.domain_id),
        relationshipType: String(
          relationship.relationship_type
        ),
      })
    );

    return selections;
  };

  const saveDomainRelationships = async (
    metadataRecordId: number,
    selections: DomainRelationshipSelection[]
  ) => {
    const currentResponse =
      await getMetadataDomainRelationships(
        metadataRecordId
      );

    const currentData =
      await currentResponse.json();

    if (
      !currentResponse.ok ||
      !currentData.success
    ) {
      throw new Error(
        currentData.error ||
          "Unable to load current domain relationships."
      );
    }

    const currentRelationships =
      Array.isArray(currentData.relationships)
        ? currentData.relationships
        : [];

    const desiredKeys = new Set(
      selections.map(
        (item) =>
          \`\${Number(item.domainId)}:\${item.relationshipType}\`
      )
    );

    const currentKeys = new Set(
      currentRelationships.map(
        (item: {
          domain_id: number | string;
          relationship_type: string;
        }) =>
          \`\${Number(item.domain_id)}:\${String(
            item.relationship_type
          )}\`
      )
    );

    for (const relationship of currentRelationships) {
      const key =
        \`\${Number(relationship.domain_id)}:\${String(
          relationship.relationship_type
        )}\`;

      if (!desiredKeys.has(key)) {
        const response =
          await deleteDomainRelationship(
            relationship.id
          );

        const data =
          await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.error ||
              "Unable to remove a domain relationship."
          );
        }
      }
    }

    for (const selection of selections) {
      const key =
        \`\${Number(selection.domainId)}:\${selection.relationshipType}\`;

      if (currentKeys.has(key)) {
        continue;
      }

      const response =
        await createDomainRelationship({
          metadata_record_id: metadataRecordId,
          domain_id: Number(selection.domainId),
          relationship_type:
            selection.relationshipType,
        });

      const data =
        await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Unable to create a domain relationship."
        );
      }
    }

    const refreshed =
      await loadMetadataDomainRelationships(
        metadataRecordId
      );

    return refreshed;
  };

  `;

page = insertAfterRegex(
  page,
  /const\s+handleMetadataSubmit\s*=\s*async\s*\(/,
  "",
  "metadata submit handler"
);

/*
 * The previous operation only verifies the handler anchor.
 * Insert helpers immediately before it.
 */
const handlerIndex = page.search(
  /const\s+handleMetadataSubmit\s*=\s*async\s*\(/
);

page =
  page.slice(0, handlerIndex) +
  relationshipHelpers +
  page.slice(handlerIndex);

/*
 * ===============================================================
 * LOAD DOMAIN DEFINITIONS AFTER AUTH
 * ===============================================================
 */

const loadDataEffectPattern =
  /const\s+loadData\s*=\s*async\s*\(\)\s*=>\s*\{/;

if (!loadDataEffectPattern.test(page)) {
  fail("Could not locate loadData function.");
}

/*
 * Add a separate effect immediately before the existing search effect.
 */
page = insertAfterRegex(
  page,
  /const\s+loadData\s*=\s*async\s*\(\)\s*=>\s*\{[\s\S]*?\n\s*\};/,
  `

  useEffect(() => {
    if (!authUser) {
      return;
    }

    void loadDomainRelationshipDefinitions();
  }, [authUser]);

  `,
  "loadData function"
);

/*
 * ===============================================================
 * CLOSE METADATA MODAL
 * ===============================================================
 */

page = replaceOnce(
  page,
  /const\s+closeMetadataModal\s*=\s*\(\)\s*=>\s*\{[\s\S]*?\n\s*\};/,
  (match) => {
    if (match.includes("setMetadataDomainRelationships")) {
      return match;
    }

    return match.replace(
      /\n\s*\};$/,
      `
    setMetadataDomainRelationships([]);
    setDomainRelationshipsError("");
  };`
    );
  },
  "closeMetadataModal"
);

/*
 * ===============================================================
 * METADATA SUBMIT
 * ===============================================================
 */

page = replaceOnce(
  page,
  /const\s+data\s*=\s*await\s+response\.json\(\);\s*\n\s*if\s*\(\s*!response\.ok\s*\|\|\s*!data\.success\s*\)/,
  `const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      )`,
  "metadata submit response parsing"
);

page = replaceOnce(
  page,
  /if\s*\(\s*!response\.ok\s*\|\|\s*!data\.success\s*\)\s*\{\s*throw new Error\([\s\S]*?\n\s*\}\s*\n\s*\n\s*closeMetadataModal\(\);/,
  (match) => {
    const insertion =
      `
      const metadataRecordId = Number(
        data.metadata?.id ??
        data.record?.id ??
        0
      );

      if (
        metadataRecordId &&
        metadataDomainRelationships.length > 0
      ) {
        await saveDomainRelationships(
          metadataRecordId,
          metadataDomainRelationships
        );
      }

`;
    return match.replace(
      /\n\s*closeMetadataModal\(\);/,
      insertion + "      closeMetadataModal();"
    );
  },
  "metadata relationship persistence"
);

/*
 * ===============================================================
 * CLEAR APPRAISAL RELATIONSHIPS WHEN UPLOAD HAS NO APPRAISAL
 * ===============================================================
 */

page = replaceOnce(
  page,
  /setUploadedAppraisal\(null\);/,
  `setUploadedAppraisal(null);
        setAppraisalDomainRelationships([]);`,
  "uploaded appraisal reset"
);

/*
 * ===============================================================
 * LOAD EXISTING RELATIONSHIPS AFTER APPRAISAL MATCH
 * ===============================================================
 */

page = replaceOnce(
  page,
  /setUploadedAppraisal\(appraisal\);/,
  `setUploadedAppraisal(appraisal);

          if (data.appraisal?.metadataRecordId) {
            try {
              const relationships =
                await loadMetadataDomainRelationships(
                  data.appraisal.metadataRecordId
                );

              setAppraisalDomainRelationships(
                relationships
              );
            } catch (relationshipError) {
              setDomainRelationshipsError(
                relationshipError instanceof Error
                  ? relationshipError.message
                  : "Unable to load domain relationships."
              );
              setAppraisalDomainRelationships([]);
            }
          } else {
            setAppraisalDomainRelationships([]);
          }`,
  "appraisal assignment"
);

/*
 * ===============================================================
 * MODALS PROPS
 * ===============================================================
 */

page = replaceOnce(
  page,
  /appraisalCommittedAdditionalMetadata=\{appraisalCommittedAdditionalMetadata\}/,
  `appraisalCommittedAdditionalMetadata={appraisalCommittedAdditionalMetadata}
        domainRelationshipDomains={domainRelationshipDomains}
        domainRelationshipTypes={domainRelationshipTypes}
        metadataDomainRelationships={metadataDomainRelationships}
        appraisalDomainRelationships={appraisalDomainRelationships}
        domainRelationshipsLoading={domainRelationshipsLoading}
        domainRelationshipsError={domainRelationshipsError}
        setMetadataDomainRelationships={setMetadataDomainRelationships}
        setAppraisalDomainRelationships={setAppraisalDomainRelationships}`,
  "Modals domain relationship props"
);

/*
 * ===============================================================
 * MODALS TYPE / IMPORTS
 * ===============================================================
 */

modals = replaceOnce(
  modals,
  /import type \{\s*AdditionalMetadataField,\s*MetadataRecord,\s*\} from "@\/types\/metadata";/,
  `import type {
  AdditionalMetadataField,
  MetadataRecord,
} from "@/types/metadata";

import type {
  DomainRelationshipSelection,
  DomainRelationshipDomain,
  DomainRelationshipType,
} from "@/components/metadata/DomainRelationshipSelector";`,
  "Modals metadata types import"
);

modals = replaceOnce(
  modals,
  /appraisalCommittedAdditionalMetadata:\s*AdditionalMetadataField\[\];/,
  `appraisalCommittedAdditionalMetadata: AdditionalMetadataField[];

  domainRelationshipDomains: DomainRelationshipDomain[];
  domainRelationshipTypes: DomainRelationshipType[];
  metadataDomainRelationships: DomainRelationshipSelection[];
  appraisalDomainRelationships: DomainRelationshipSelection[];
  domainRelationshipsLoading: boolean;
  domainRelationshipsError: string;

  setMetadataDomainRelationships: Dispatch<
    SetStateAction<DomainRelationshipSelection[]>
  >;
  setAppraisalDomainRelationships: Dispatch<
    SetStateAction<DomainRelationshipSelection[]>
  >;`,
  "Modals relationship props declaration"
);

modals = replaceOnce(
  modals,
  /appraisalCommittedAdditionalMetadata,\s*appraisalRequiredFieldsComplete,/,
  `appraisalCommittedAdditionalMetadata,
  domainRelationshipDomains,
  domainRelationshipTypes,
  metadataDomainRelationships,
  appraisalDomainRelationships,
  domainRelationshipsLoading,
  domainRelationshipsError,
  setMetadataDomainRelationships,
  setAppraisalDomainRelationships,
  appraisalRequiredFieldsComplete,`,
  "Modals relationship destructuring"
);

/*
 * ===============================================================
 * NORMAL METADATA MODAL SELECTOR
 * ===============================================================
 */

const metadataSelector =
`
                    <DomainRelationshipSelector
                      domains={domainRelationshipDomains}
                      relationshipTypes={domainRelationshipTypes}
                      selected={metadataDomainRelationships}
                      onChange={setMetadataDomainRelationships}
                      disabled={domainRelationshipsLoading}
                      title="Domain Relationships"
                      description="Associate this metadata record with one or more institutional domains."
                    />

                    {domainRelationshipsError && (
                      <p
                        role="alert"
                        className="text-sm font-medium text-red-600"
                      >
                        {domainRelationshipsError}
                      </p>
                    )}

`;

modals = replaceOnce(
  modals,
  /(<div\s+id="manual-additional-metadata")/,
  metadataSelector + "$1",
  "normal metadata domain selector location"
);

/*
 * ===============================================================
 * APPRAISAL COMPONENT INVOCATION
 * ===============================================================
 */

modals = replaceOnce(
  modals,
  /appraisalCommittedAdditionalMetadata=\{appraisalCommittedAdditionalMetadata\}/,
  `appraisalCommittedAdditionalMetadata={appraisalCommittedAdditionalMetadata}
                            appraisalDomainRelationshipDomains={domainRelationshipDomains}
                            appraisalDomainRelationshipTypes={domainRelationshipTypes}
                            appraisalDomainRelationships={appraisalDomainRelationships}
                            domainRelationshipsLoading={domainRelationshipsLoading}
                            domainRelationshipsError={domainRelationshipsError}
                            setAppraisalDomainRelationships={setAppraisalDomainRelationships}`,
  "Appraisal relationship props"
);

/*
 * ===============================================================
 * APPRAISAL IMPORT
 * ===============================================================
 */

appraisal = replaceOnce(
  appraisal,
  /import type \{\s*Dispatch,\s*ReactElement,\s*SetStateAction,\s*\} from "react";/,
  `import type {
  Dispatch,
  ReactElement,
  SetStateAction,
} from "react";

import {
  DomainRelationshipSelector,
} from "@/components/metadata/DomainRelationshipSelector";

import type {
  DomainRelationshipSelection,
  DomainRelationshipDomain,
  DomainRelationshipType,
} from "@/components/metadata/DomainRelationshipSelector";`,
  "Appraisal React import"
);

/*
 * ===============================================================
 * APPRAISAL PROPS
 * ===============================================================
 */

appraisal = replaceOnce(
  appraisal,
  /appraisalCommittedAdditionalMetadata:\s*AdditionalMetadataField\[\];/,
  `appraisalCommittedAdditionalMetadata: AdditionalMetadataField[];

  appraisalDomainRelationshipDomains: DomainRelationshipDomain[];
  appraisalDomainRelationshipTypes: DomainRelationshipType[];
  appraisalDomainRelationships: DomainRelationshipSelection[];
  domainRelationshipsLoading: boolean;
  domainRelationshipsError: string;
  setAppraisalDomainRelationships: Dispatch<
    SetStateAction<DomainRelationshipSelection[]>
  >;`,
  "Appraisal relationship props declaration"
);

appraisal = replaceOnce(
  appraisal,
  /appraisalCommittedAdditionalMetadata,\s*appraisalRequiredFieldsComplete,/,
  `appraisalCommittedAdditionalMetadata,
  appraisalDomainRelationshipDomains,
  appraisalDomainRelationshipTypes,
  appraisalDomainRelationships,
  domainRelationshipsLoading,
  domainRelationshipsError,
  setAppraisalDomainRelationships,
  appraisalRequiredFieldsComplete,`,
  "Appraisal relationship destructuring"
);

/*
 * ===============================================================
 * APPRAISAL SELECTOR UI
 * ===============================================================
 */

const appraisalSelector =
`
      <DomainRelationshipSelector
        domains={appraisalDomainRelationshipDomains}
        relationshipTypes={appraisalDomainRelationshipTypes}
        selected={appraisalDomainRelationships}
        onChange={setAppraisalDomainRelationships}
        disabled={
          reviewingDecision ||
          !canManageDocuments ||
          domainRelationshipsLoading
        }
        title="Domain Relationships"
        description="Associate the reviewed metadata with one or more institutional domains."
      />

      {domainRelationshipsError && (
        <p
          role="alert"
          className="mt-3 text-sm font-medium text-red-600"
        >
          {domainRelationshipsError}
        </p>
      )}

`;

appraisal = replaceOnce(
  appraisal,
  /(\s*\{matchedMetadata\s*&&\s*\()/,
  appraisalSelector + "$1",
  "Appraisal domain selector location"
);

/*
 * ===============================================================
 * APPRAISAL INVOCATION SANITY CHECK
 * ===============================================================
 */

if (!modals.includes("<Appraisal")) {
  fail("Appraisal component invocation disappeared unexpectedly.");
}

if (!appraisal.includes("<DomainRelationshipSelector")) {
  fail("Appraisal domain selector was not inserted.");
}

if (!modals.includes("<DomainRelationshipSelector")) {
  fail("Normal metadata domain selector was not inserted.");
}

/*
 * ===============================================================
 * WRITE FILES ONLY AFTER ALL TRANSFORMS SUCCEED
 * ===============================================================
 */

fs.writeFileSync(files.page, page, "utf8");
fs.writeFileSync(files.modals, modals, "utf8");
fs.writeFileSync(files.appraisal, appraisal, "utf8");

console.log("\n===== M23 FRONTEND PATCH COMPLETED =====");
console.log("page.tsx      updated");
console.log("Modals.tsx    updated");
console.log("Appraisal.tsx updated");

console.log("\n===== NEW HASHES =====");
console.log("page.tsx      " + hash(files.page));
console.log("Modals.tsx    " + hash(files.modals));
console.log("Appraisal.tsx " + hash(files.appraisal));

console.log("\nNo explicit process exit-code handling was used.");




