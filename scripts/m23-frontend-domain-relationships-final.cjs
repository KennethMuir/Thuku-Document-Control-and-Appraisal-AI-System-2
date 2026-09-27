const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const ROOT = process.cwd();

const FILES = {
  page: path.join(ROOT, "apps", "web", "src", "app", "page.tsx"),
  modals: path.join(ROOT, "apps", "web", "src", "components", "modals", "Modals.tsx"),
  appraisal: path.join(ROOT, "apps", "web", "src", "components", "appraisal", "Appraisal.tsx"),
};

const BASELINE = {
  page: "E99A95F50401BA93A21B42D82611AF652FC78E2A928B237E1B42B9B8D5DDE79D",
  modals: "FD0A3D789FCCED0928AABF082859D2D02E93897D8B2BCF0B1926AF0FFE99FD98",
  appraisal: "B9C04590E48C7CAB8D490DFBC174DBF619AC000BF4AF3868475CCEB4DB292572",
};

function sha256(file) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex")
    .toUpperCase();
}

function fail(message) {
  throw new Error(message);
}

function assertBaseline() {
  console.log("\n===== VERIFYING CLEAN M23 BASELINE =====");

  for (const [name, file] of Object.entries(FILES)) {
    const actual = sha256(file);

    if (actual !== BASELINE[name]) {
      fail(
        `${name}.tsx is not the clean M23 baseline.\n` +
        `Expected: ${BASELINE[name]}\n` +
        `Actual:   ${actual}`
      );
    }

    console.log(`${name}.tsx baseline OK`);
  }
}

function backupFile(file, label) {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "")
    .replace("T", "");

  const ext = path.extname(file);

  const destination = file.replace(
    ext,
    `.before-m23-domain-relationships-${label}-${stamp}${ext}`
  );

  fs.copyFileSync(file, destination);
  return destination;
}

function findFunction(text, functionName) {
  const pattern = new RegExp(
    `(const\\s+${functionName}\\s*=\\s*(?:async\\s*)?\\([^)]*\\)\\s*=>\\s*\\{)`,
    "m"
  );

  const match = pattern.exec(text);

  if (!match) {
    fail(`Could not locate function ${functionName}.`);
  }

  const start = match.index;
  const bodyStart = start + match[0].length;

  let depth = 1;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = bodyStart; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (lineComment) {
      if (ch === "\n") {
        lineComment = false;
      }
      continue;
    }

    if (blockComment) {
      if (ch === "*" && next === "/") {
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

      if (ch === "\\") {
        escaped = true;
        continue;
      }

      if (ch === quote) {
        quote = null;
      }

      continue;
    }

    if (ch === "/" && next === "/") {
      lineComment = true;
      i++;
      continue;
    }

    if (ch === "/" && next === "*") {
      blockComment = true;
      i++;
      continue;
    }

    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      continue;
    }

    if (ch === "{") {
      depth++;
      continue;
    }

    if (ch === "}") {
      depth--;

      if (depth === 0) {
        return {
          start,
          end: i + 1,
          text: text.slice(start, i + 1),
        };
      }
    }
  }

  fail(`Could not determine the complete body of function ${functionName}.`);
}

function replaceFunction(text, functionName, transform) {
  const found = findFunction(text, functionName);
  const updated = transform(found.text);

  if (typeof updated !== "string" || !updated.trim()) {
    fail(`Transformation for ${functionName} returned invalid source.`);
  }

  return (
    text.slice(0, found.start) +
    updated +
    text.slice(found.end)
  );
}


function insertAfterExact(
  text,
  anchor,
  insertion,
  description
) {
  /*
   * First attempt the exact anchor.
   */
  const exactIndex =
    text.indexOf(anchor);

  if (exactIndex >= 0) {
    const secondExact =
      text.indexOf(
        anchor,
        exactIndex + anchor.length
      );

    if (secondExact >= 0) {
      throw new Error(
        "Expected exactly one occurrence of " +
          description +
          ", but found more than one."
      );
    }

    return (
      text.slice(
        0,
        exactIndex + anchor.length
      ) +
      insertion +
      text.slice(
        exactIndex + anchor.length
      )
    );
  }

  /*
   * Exact formatting did not match.
   *
   * Build a whitespace-tolerant regular expression
   * from the supplied anchor. This allows differences such
   * as:
   *
   * import type {
   *   ...
   * }
   *
   * versus:
   *
   * import type {
   * ...
   * }
   *
   * without weakening the actual textual content.
   */
  const escaped =
    anchor.replace(
      /[.*+?^$()|[\]\\]/g,
      "\\$&"
    );

  const whitespaceTolerant =
    escaped.replace(
      /\\\s+/g,
      "\\s+"
    );

  const regex =
    new RegExp(
      whitespaceTolerant
    );

  const matches =
    Array.from(
      text.matchAll(
        new RegExp(
          regex.source,
          "g"
        )
      )
    );

  if (matches.length === 0) {
    throw new Error(
      "Could not locate " +
        description +
        "."
    );
  }

  if (matches.length !== 1) {
    throw new Error(
      "Expected exactly one occurrence of " +
        description +
        ", found " +
        matches.length +
        "."
    );
  }

  const match =
    matches[0];

  const index =
    match.index;

  return (
    text.slice(
      0,
      index + match[0].length
    ) +
    insertion +
    text.slice(
      index + match[0].length
    )
  );
}

function ensureNotAlreadyPatched(text, marker, description) {
  if (text.includes(marker)) {
    fail(`${description} already appears to be patched.`);
  }
}

assertBaseline();

console.log("\n===== CREATING M23 BACKUPS =====");

const backups = {
  page: backupFile(FILES.page, "page"),
  modals: backupFile(FILES.modals, "modals"),
  appraisal: backupFile(FILES.appraisal, "appraisal"),
};

console.log(backups.page);
console.log(backups.modals);
console.log(backups.appraisal);

const originalPage = fs.readFileSync(FILES.page, "utf8");
const originalModals = fs.readFileSync(FILES.modals, "utf8");
const originalAppraisal = fs.readFileSync(FILES.appraisal, "utf8");

let page = originalPage;
let modals = originalModals;
let appraisal = originalAppraisal;

/*
 * ===============================================================
 * PAGE IMPORTS
 * ===============================================================
 */

ensureNotAlreadyPatched(
  page,
  'from "@/lib/api/domainRelationships"',
  "page domain relationship import"
);

page = insertAfterExact(
  page,
  'import { searchDocuments } from "@/lib/api/search";',
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
} from "@/components/metadata/DomainRelationshipSelector";`,
  "page search import"
);

/*
 * ===============================================================
 * PAGE STATE
 * ===============================================================
 */

const formState = findFunction;
const formPattern =
  /const\s*\[form,\s*setForm\]\s*=\s*useState\(EMPTY_FORM\);/;

if (!formPattern.test(page)) {
  fail("Could not locate the actual page form state.");
}

page = page.replace(
  formPattern,
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
    useState("");`
);

/*
 * ===============================================================
 * DOMAIN HELPERS
 * ===============================================================
 */

const metadataRelationshipHelpers = `
  const loadDomainRelationshipDefinitions = async () => {
    setDomainRelationshipsLoading(true);
    setDomainRelationshipsError("");

    try {
      const [domainsResponse, typesResponse] =
        await Promise.all([
          getDomainRegistry(),
          getRelationshipTypes(),
        ]);

      const domainsData =
        await domainsResponse.json();

      const typesData =
        await typesResponse.json();

      if (
        !domainsResponse.ok ||
        !domainsData.success
      ) {
        throw new Error(
          domainsData.error ||
            "Unable to load domain registry."
        );
      }

      if (
        !typesResponse.ok ||
        !typesData.success
      ) {
        throw new Error(
          typesData.error ||
            "Unable to load relationship types."
        );
      }

      const rawDomains =
        Array.isArray(domainsData.domains)
          ? domainsData.domains
          : [];

      const rawTypes =
        Array.isArray(
          typesData.relationshipTypes
        )
          ? typesData.relationshipTypes
          : Array.isArray(typesData.types)
            ? typesData.types
            : [];

      setDomainRelationshipDomains(
        rawDomains.map(
          (domain: DomainRelationshipDomain) => ({
            id: Number(domain.id),
            domain_key:
              String(domain.domain_key),
            display_name:
              String(domain.display_name),
            description:
              domain.description ?? null,
            domain_family:
              domain.domain_family ?? null,
          })
        )
      );

      setDomainRelationshipTypes(
        rawTypes
          .map(
            (
              item:
                | string
                | DomainRelationshipType
            ) => {
              if (typeof item === "string") {
                return {
                  value: item,
                  label: item.replaceAll(
                    "_",
                    " "
                  ),
                };
              }

              return {
                value: String(item.value),
                label:
                  item.label ??
                  String(
                    item.value
                  ).replaceAll(
                    "_",
                    " "
                  ),
              };
            }
          )
          .filter(
            (
              item: DomainRelationshipType
            ) => Boolean(item.value)
          )
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

  const loadMetadataDomainRelationships =
    async (
      metadataRecordId:
        | string
        | number
        | null
        | undefined
    ) => {
      if (!metadataRecordId) {
        return [];
      }

      const response =
        await getMetadataDomainRelationships(
          metadataRecordId
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Unable to load metadata domain relationships."
        );
      }

      const relationships =
        Array.isArray(
          data.relationships
        )
          ? data.relationships
          : [];

      return relationships
        .map(
          (relationship: {
            domain_id:
              | string
              | number;
            relationship_type:
              string;
          }) => ({
            domainId:
              Number(
                relationship.domain_id
              ),
            relationshipType:
              String(
                relationship.relationship_type
              ),
          })
        )
        .filter(
          (
            item: DomainRelationshipSelection
          ) =>
            Number.isInteger(
              item.domainId
            ) &&
            item.domainId > 0 &&
            Boolean(
              item.relationshipType
            )
        );
    };

  const saveDomainRelationships =
    async (
      metadataRecordId: number,
      selections:
        DomainRelationshipSelection[]
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
        Array.isArray(
          currentData.relationships
        )
          ? currentData.relationships
          : [];

      const desiredKeys =
        new Set(
          selections.map(
            (selection) =>
              \`\${Number(
                selection.domainId
              )}:\${selection.relationshipType}\`
          )
        );

      const currentKeys =
        new Set(
          currentRelationships.map(
            (relationship: {
              domain_id:
                | string
                | number;
              relationship_type:
                string;
            }) =>
              \`\${Number(
                relationship.domain_id
              )}:\${String(
                relationship.relationship_type
              )}\`
          )
        );

      for (
        const relationship of
        currentRelationships
      ) {
        const key =
          \`\${Number(
            relationship.domain_id
          )}:\${String(
            relationship.relationship_type
          )}\`;

        if (
          desiredKeys.has(key)
        ) {
          continue;
        }

        const response =
          await deleteDomainRelationship(
            relationship.id
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.error ||
              "Unable to remove a domain relationship."
          );
        }
      }

      for (
        const selection of
        selections
      ) {
        const key =
          \`\${Number(
            selection.domainId
          )}:\${selection.relationshipType}\`;

        if (
          currentKeys.has(key)
        ) {
          continue;
        }

        const response =
          await createDomainRelationship({
            metadata_record_id:
              metadataRecordId,
            domain_id:
              Number(
                selection.domainId
              ),
            relationship_type:
              selection.relationshipType,
          });

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.error ||
              "Unable to create a domain relationship."
          );
        }
      }

      return loadMetadataDomainRelationships(
        metadataRecordId
      );
    };

`;

page = replaceFunction(
  page,
  "handleMetadataSubmit",
  (source) => {
    if (
      source.includes(
        "saveDomainRelationships"
      )
    ) {
      fail(
        "handleMetadataSubmit already contains domain relationship persistence."
      );
    }

    const marker =
      "      closeMetadataModal();";

    if (!source.includes(marker)) {
      fail(
        "Could not locate the successful metadata close operation inside handleMetadataSubmit."
      );
    }

    const insertion = `
      const metadataRecordId =
        Number(
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

    return source.replace(
      marker,
      insertion + marker
    );
  }
);

/*
 * Insert helpers immediately before handleMetadataSubmit.
 */
const metadataSubmitPosition =
  page.indexOf(
    "const handleMetadataSubmit"
  );

if (metadataSubmitPosition < 0) {
  fail(
    "Could not locate handleMetadataSubmit after transformation."
  );
}

page =
  page.slice(0, metadataSubmitPosition) +
  metadataRelationshipHelpers +
  page.slice(metadataSubmitPosition);

/*
 * ===============================================================
 * LOAD DOMAIN DEFINITIONS
 * ===============================================================
 */

const loadDataEffectPattern =
  /useEffect\(\(\)\s*=>\s*\{[\s\S]*?\},\s*\[[^\]]*\]\);/g;

const effectMatches = Array.from(
  page.matchAll(loadDataEffectPattern)
);

if (effectMatches.length === 0) {
  fail(
    "Could not locate an existing useEffect block for domain-definition loading."
  );
}

/*
 * Use the authentication state directly. This insertion is
 * deliberately placed before the first existing useEffect.
 */
const firstEffect =
  effectMatches[0];

const domainEffect = `
  useEffect(() => {
    if (!authUser) {
      return;
    }

    void loadDomainRelationshipDefinitions();
  }, [authUser]);

`;

page =
  page.slice(0, firstEffect.index) +
  domainEffect +
  page.slice(firstEffect.index);

/*
 * ===============================================================
 * CLOSE METADATA MODAL
 * ===============================================================
 */

page = replaceFunction(
  page,
  "closeMetadataModal",
  (source) => {
    if (
      source.includes(
        "setMetadataDomainRelationships"
      )
    ) {
      return source;
    }

    const closeMarker =
      "    setShowMetadataModal(false);";

    if (!source.includes(closeMarker)) {
      fail(
        "Could not locate the metadata-modal close state inside closeMetadataModal."
      );
    }

    return source.replace(
      closeMarker,
      closeMarker +
        `
    setMetadataDomainRelationships([]);
    setDomainRelationshipsError("");`
    );
  }
);

/*
 * ===============================================================
 * UPLOAD HANDLER
 * ===============================================================
 */

page = replaceFunction(
  page,
  "handleUpload",
  (source) => {
    if (
      source.includes(
        "setAppraisalDomainRelationships"
      )
    ) {
      return source;
    }

    const appraisalAssignment =
      `setUploadedAppraisal(appraisal);`;

    if (
      !source.includes(
        appraisalAssignment
      )
    ) {
      fail(
        "Could not locate setUploadedAppraisal(appraisal) inside handleUpload."
      );
    }

    const existingRelationships =
      `
        if (appraisal.metadataRecordId) {
          try {
            const relationships =
              await loadMetadataDomainRelationships(
                appraisal.metadataRecordId
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
        }
`;

    let updated =
      source.replace(
        appraisalAssignment,
        appraisalAssignment +
          existingRelationships
      );

    const resetMarker =
      "      setUploadedAppraisal(null);";

    if (
      !updated.includes(
        resetMarker
      )
    ) {
      fail(
        "Could not locate the no-appraisal reset inside handleUpload."
      );
    }

    updated =
      updated.replace(
        resetMarker,
        resetMarker +
          `
        setAppraisalDomainRelationships([]);`
      );

    return updated;
  }
);

/*
 * ===============================================================
 * REVIEW / CREATE METADATA PERSISTENCE
 * ===============================================================
 */

function addRelationshipSaveToReviewFunction(
  source,
  functionName
) {
  return replaceFunction(
    source,
    functionName,
    (functionSource) => {
      if (
        functionSource.includes(
          "saveDomainRelationships"
        )
      ) {
        return functionSource;
      }

      const marker =
        "      await loadData();";

      if (
        !functionSource.includes(
          marker
        )
      ) {
        fail(
          `Could not locate loadData() inside ${functionName}.`
        );
      }

      const insertion = `
      const savedMetadataRecordId =
        Number(
          data.metadata?.id ??
          uploadedAppraisal?.metadataRecordId ??
          0
        );

      if (
        savedMetadataRecordId
      ) {
        const relationships =
          await saveDomainRelationships(
            savedMetadataRecordId,
            appraisalDomainRelationships
          );

        setAppraisalDomainRelationships(
          relationships
        );
      }

`;

      return functionSource.replace(
        marker,
        insertion + marker
      );
    }
  );
}

page =
  addRelationshipSaveToReviewFunction(
    page,
    "handleDoneAppraisal"
  );

page =
  addRelationshipSaveToReviewFunction(
    page,
    "handleCreateMetadataFromAppraisal"
  );

page =
  addRelationshipSaveToReviewFunction(
    page,
    "handleAppraisalReview"
  );

/*
 * ===============================================================
 * PAGE -> MODALS PROPS
 * ===============================================================
 */

const pageModalAnchor =
  "appraisalCommittedAdditionalMetadata={appraisalCommittedAdditionalMetadata}";

if (
  !page.includes(pageModalAnchor)
) {
  fail(
    "Could not locate the Modals appraisal committed metadata prop."
  );
}

page = page.replace(
  pageModalAnchor,
  `${pageModalAnchor}
  domainRelationshipDomains={domainRelationshipDomains}
  domainRelationshipTypes={domainRelationshipTypes}
  metadataDomainRelationships={metadataDomainRelationships}
  appraisalDomainRelationships={appraisalDomainRelationships}
  domainRelationshipsLoading={domainRelationshipsLoading}
  domainRelationshipsError={domainRelationshipsError}
  setMetadataDomainRelationships={setMetadataDomainRelationships}
  setAppraisalDomainRelationships={setAppraisalDomainRelationships}`
);

/*
 * ===============================================================
 * MODALS IMPORT
 * ===============================================================
 */

modals = insertAfterExact(
  modals,
  `import type {
  AdditionalMetadataField,
  MetadataRecord,
} from "@/types/metadata";`,
  `
import type {
  DomainRelationshipSelection,
  DomainRelationshipDomain,
  DomainRelationshipType,
} from "@/components/metadata/DomainRelationshipSelector";`,
  "Modals metadata type import"
);

/*
 * ===============================================================
 * MODALS PROPS
 * ===============================================================
 */

const modalsPropsAnchor =
  "  appraisalCommittedAdditionalMetadata: AdditionalMetadataField[];";

if (
  !modals.includes(
    modalsPropsAnchor
  )
) {
  fail(
    "Could not locate Modals appraisal committed metadata prop declaration."
  );
}

modals = modals.replace(
  modalsPropsAnchor,
  `${modalsPropsAnchor}

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
  >;`
);

/*
 * ===============================================================
 * MODALS DESTRUCTURING
 * ===============================================================
 */

const modalsDestructureAnchor =
  "  appraisalCommittedAdditionalMetadata,";

if (
  !modals.includes(
    modalsDestructureAnchor
  )
) {
  fail(
    "Could not locate Modals appraisal committed metadata destructuring."
  );
}

modals = modals.replace(
  modalsDestructureAnchor,
  `${modalsDestructureAnchor}
  domainRelationshipDomains,
  domainRelationshipTypes,
  metadataDomainRelationships,
  appraisalDomainRelationships,
  domainRelationshipsLoading,
  domainRelationshipsError,
  setMetadataDomainRelationships,
  setAppraisalDomainRelationships,`
);

/*
 * ===============================================================
 * NORMAL METADATA SELECTOR
 * ===============================================================
 */

const manualMetadataAnchor =
  '<div id="manual-additional-metadata">';

if (
  !modals.includes(
    manualMetadataAnchor
  )
) {
  fail(
    "Could not locate manual-additional-metadata wrapper."
  );
}

const metadataSelector = `
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

modals =
  modals.replace(
    manualMetadataAnchor,
    metadataSelector +
      manualMetadataAnchor
  );

/*
 * ===============================================================
 * MODALS -> APPRAISAL PROPS
 * ===============================================================
 */

const appraisalModalAnchor =
  "appraisalCommittedAdditionalMetadata={appraisalCommittedAdditionalMetadata}";

if (
  !modals.includes(
    appraisalModalAnchor
  )
) {
  fail(
    "Could not locate Appraisal committed metadata prop."
  );
}

modals = modals.replace(
  appraisalModalAnchor,
  `${appraisalModalAnchor}
                            appraisalDomainRelationshipDomains={domainRelationshipDomains}
                            appraisalDomainRelationshipTypes={domainRelationshipTypes}
                            appraisalDomainRelationships={appraisalDomainRelationships}
                            domainRelationshipsLoading={domainRelationshipsLoading}
                            domainRelationshipsError={domainRelationshipsError}
                            setAppraisalDomainRelationships={setAppraisalDomainRelationships}`
);

/*
 * ===============================================================
 * APPRAISAL IMPORT
 * ===============================================================
 */

appraisal = insertAfterExact(
  appraisal,
  `import type {
  Dispatch,
  ReactElement,
  SetStateAction,
} from "react";`,
  `
import {
  DomainRelationshipSelector,
} from "@/components/metadata/DomainRelationshipSelector";

import type {
  DomainRelationshipSelection,
  DomainRelationshipDomain,
  DomainRelationshipType,
} from "@/components/metadata/DomainRelationshipSelector";`,
  "Appraisal React type import"
);

/*
 * ===============================================================
 * APPRAISAL PROPS
 * ===============================================================
 */

const appraisalPropsAnchor =
  "  appraisalCommittedAdditionalMetadata: AdditionalMetadataField[];";

if (
  !appraisal.includes(
    appraisalPropsAnchor
  )
) {
  fail(
    "Could not locate Appraisal committed metadata prop declaration."
  );
}

appraisal =
  appraisal.replace(
    appraisalPropsAnchor,
    `${appraisalPropsAnchor}

  appraisalDomainRelationshipDomains: DomainRelationshipDomain[];
  appraisalDomainRelationshipTypes: DomainRelationshipType[];
  appraisalDomainRelationships: DomainRelationshipSelection[];
  domainRelationshipsLoading: boolean;
  domainRelationshipsError: string;
  setAppraisalDomainRelationships: Dispatch<
    SetStateAction<DomainRelationshipSelection[]>
  >;`
  );

/*
 * ===============================================================
 * APPRAISAL DESTRUCTURING
 * ===============================================================
 */

const appraisalDestructureAnchor =
  "  appraisalCommittedAdditionalMetadata,";

if (
  !appraisal.includes(
    appraisalDestructureAnchor
  )
) {
  fail(
    "Could not locate Appraisal committed metadata destructuring."
  );
}

appraisal =
  appraisal.replace(
    appraisalDestructureAnchor,
    `${appraisalDestructureAnchor}
  appraisalDomainRelationshipDomains,
  appraisalDomainRelationshipTypes,
  appraisalDomainRelationships,
  domainRelationshipsLoading,
  domainRelationshipsError,
  setAppraisalDomainRelationships,`
  );

/*
 * ===============================================================
 * APPRAISAL SELECTOR
 * ===============================================================
 */

const matchedMetadataAnchor =
  "{matchedMetadata && (";

if (
  !appraisal.includes(
    matchedMetadataAnchor
  )
) {
  fail(
    "Could not locate matched metadata section in Appraisal."
  );
}

const appraisalSelector = `
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

appraisal =
  appraisal.replace(
    matchedMetadataAnchor,
    appraisalSelector +
      matchedMetadataAnchor
  );

/*
 * ===============================================================
 * FINAL STRUCTURAL CHECKS
 * ===============================================================
 */

const checks = [
  [
    page,
    "createDomainRelationship",
    "page domain relationship import",
  ],
  [
    page,
    "loadDomainRelationshipDefinitions",
    "page domain relationship loader",
  ],
  [
    page,
    "saveDomainRelationships",
    "page relationship persistence",
  ],
  [
    page,
    "metadataDomainRelationships",
    "page metadata relationship state",
  ],
  [
    page,
    "appraisalDomainRelationships",
    "page appraisal relationship state",
  ],
  [
    modals,
    "<DomainRelationshipSelector",
    "Modals relationship selector",
  ],
  [
    appraisal,
    "<DomainRelationshipSelector",
    "Appraisal relationship selector",
  ],
];

for (
  const [text, marker, description]
  of checks
) {
  if (!text.includes(marker)) {
    fail(
      `Final structural check failed: ${description}.`
    );
  }
}

/*
 * ===============================================================
 * TEMPORARY WRITE + TYPESCRIPT VALIDATION
 * ===============================================================
 */

const tempFiles = {
  page: FILES.page + ".m23tmp",
  modals: FILES.modals + ".m23tmp",
  appraisal: FILES.appraisal + ".m23tmp",
};

try {
  fs.writeFileSync(
    tempFiles.page,
    page,
    "utf8"
  );

  fs.writeFileSync(
    tempFiles.modals,
    modals,
    "utf8"
  );

  fs.writeFileSync(
    tempFiles.appraisal,
    appraisal,
    "utf8"
  );

  /*
   * The real source files remain untouched until the generated
   * versions pass TypeScript validation.
   *
   * Copy temporary versions into place only for the compiler,
   * then restore the originals if validation fails.
   */
  fs.copyFileSync(
    tempFiles.page,
    FILES.page
  );

  fs.copyFileSync(
    tempFiles.modals,
    FILES.modals
  );

  fs.copyFileSync(
    tempFiles.appraisal,
    FILES.appraisal
  );

  console.log(
    "\n===== RUNNING TYPESCRIPT VALIDATION ====="
  );

  try {
    execFileSync(
      "npx.cmd",
      ["tsc", "--noEmit"],
      {
        cwd: path.join(
          ROOT,
          "apps",
          "web"
        ),
        stdio: "inherit",
      }
    );
  } catch (error) {
    console.error(
      "\nTypeScript validation failed. Restoring clean baseline..."
    );

    fs.copyFileSync(
      backups.page,
      FILES.page
    );

    fs.copyFileSync(
      backups.modals,
      FILES.modals
    );

    fs.copyFileSync(
      backups.appraisal,
      FILES.appraisal
    );

    fail(
      "M23 frontend patch was rolled back because TypeScript validation failed."
    );
  }

  console.log(
    "\n===== M23 FRONTEND PATCH COMPLETED ====="
  );

  console.log(
    "page.tsx      updated"
  );

  console.log(
    "Modals.tsx    updated"
  );

  console.log(
    "Appraisal.tsx updated"
  );

  console.log(
    "\n===== FINAL HASHES ====="
  );

  console.log(
    "page.tsx      " +
      sha256(FILES.page)
  );

  console.log(
    "Modals.tsx    " +
      sha256(FILES.modals)
  );

  console.log(
    "Appraisal.tsx " +
      sha256(FILES.appraisal)
  );

  console.log(
    "\n===== TYPESCRIPT VALIDATION PASSED ====="
  );

  console.log(
    "\nM23 frontend domain relationship integration is now applied."
  );

  console.log(
    "No explicit process exit-code handling was used."
  );
} finally {
  for (
    const temporary of
    Object.values(tempFiles)
  ) {
    if (fs.existsSync(temporary)) {
      fs.unlinkSync(temporary);
    }
  }
}
