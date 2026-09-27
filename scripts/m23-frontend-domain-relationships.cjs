const fs = require("fs");
const crypto = require("crypto");

const files = {
  page: "apps/web/src/app/page.tsx",
  modals: "apps/web/src/components/modals/Modals.tsx",
  appraisal: "apps/web/src/components/appraisal/Appraisal.tsx",
};

const expected = {
  page: "E99A95F50401BA93A21B42D82611AF652FC78E2A928B237E1B42B9B8D5DDE79D",
  modals: "FD0A3D789FCCED0928AABF082859D2D02E93897D8B2BCF0B1926AF0FFE99FD98",
  appraisal: "B9C04590E48C7CAB8D490DFBC174DBF619AC000BF4AF3868475CCEB4DB292572",
};

function hash(text) {
  return crypto
    .createHash("sha256")
    .update(text)
    .digest("hex")
    .toUpperCase();
}

function fail(message) {
  throw new Error(message);
}

function replaceOnce(text, search, replacement, label) {
  const index = text.indexOf(search);

  if (index < 0) {
    fail(`Could not locate ${label}.`);
  }

  return (
    text.slice(0, index) +
    replacement +
    text.slice(index + search.length)
  );
}

function insertOnce(text, search, insertion, label) {
  return replaceOnce(
    text,
    search,
    search + insertion,
    label
  );
}

function functionRange(text, functionName) {
  const startPattern = `const ${functionName}`;
  const start = text.indexOf(startPattern);

  if (start < 0) {
    fail(`Could not locate function ${functionName}.`);
  }

  const open = text.indexOf("{", start);

  if (open < 0) {
    fail(
      `Could not locate opening brace for ${functionName}.`
    );
  }

  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = open; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];

    if (lineComment) {
      if (c === "\n") {
        lineComment = false;
      }
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

    if (
      c === '"' ||
      c === "'" ||
      c === "`"
    ) {
      quote = c;
      continue;
    }

    if (c === "{") {
      depth++;
    }

    if (c === "}") {
      depth--;

      if (depth === 0) {
        return {
          start,
          open,
          end: i + 1,
        };
      }
    }
  }

  fail(
    `Could not determine complete range for ${functionName}.`
  );
}

function insertIntoFunction(
  text,
  functionName,
  marker,
  insertion,
  label
) {
  const range = functionRange(
    text,
    functionName
  );

  const body = text.slice(
    range.start,
    range.end
  );

  const index = body.indexOf(marker);

  if (index < 0) {
    fail(
      `Could not locate ${label} inside ${functionName}.`
    );
  }

  const absolute =
    range.start +
    index +
    marker.length;

  return (
    text.slice(0, absolute) +
    insertion +
    text.slice(absolute)
  );
}

let page = fs.readFileSync(
  files.page,
  "utf8"
);

let modals = fs.readFileSync(
  files.modals,
  "utf8"
);

let appraisal = fs.readFileSync(
  files.appraisal,
  "utf8"
);

console.log("");
console.log("--- VERIFYING CLEAN M23 BASELINE ---");

if (hash(page) !== expected.page) {
  fail(
    "page.tsx does not match the expected clean M23 baseline."
  );
}

if (hash(modals) !== expected.modals) {
  fail(
    "Modals.tsx does not match the expected clean M23 baseline."
  );
}

if (hash(appraisal) !== expected.appraisal) {
  fail(
    "Appraisal.tsx does not match the expected clean M23 baseline."
  );
}

console.log("page.tsx      baseline OK");
console.log("Modals.tsx    baseline OK");
console.log("Appraisal.tsx baseline OK");

/*
 * =============================================================
 * BACKUPS
 * =============================================================
 */

const timestamp =
  new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);

const backups = {
  page:
    `${files.page}.before-m23-domain-relationships-${timestamp}.tsx`,
  modals:
    `${files.modals}.before-m23-domain-relationships-${timestamp}.tsx`,
  appraisal:
    `${files.appraisal}.before-m23-domain-relationships-${timestamp}.tsx`,
};

fs.writeFileSync(backups.page, page);
fs.writeFileSync(backups.modals, modals);
fs.writeFileSync(backups.appraisal, appraisal);

console.log("");
console.log("--- BACKUPS CREATED ---");
console.log(backups.page);
console.log(backups.modals);
console.log(backups.appraisal);

/*
 * =============================================================
 * PAGE IMPORTS
 * =============================================================
 */

page = insertOnce(
  page,
  'import { DomainRegistry } from "@/components/metadata/DomainRegistry";',
  `
import { getDomainRegistry } from "@/lib/api/domainRegistry";
import {
  createDomainRelationship,
  deleteDomainRelationship,
  getMetadataDomainRelationships,
  getRelationshipTypes,
} from "@/lib/api/domainRelationships";
import type {
  DomainRelationshipDomain,
  DomainRelationshipSelection,
  DomainRelationshipType,
} from "@/components/metadata/DomainRelationshipSelector";`,
  "page domain relationship imports"
);

/*
 * =============================================================
 * PAGE STATE
 * =============================================================
 */

page = insertOnce(
  page,
  `const [form, setForm] =
    useState(EMPTY_FORM);`,
  `

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
    useState("");
`,
  "page relationship state"
);

/*
 * =============================================================
 * RELATIONSHIP HELPERS
 * =============================================================
 */

const relationshipHelpers = `

  const loadDomainRelationshipRegistry = async () => {
    setDomainRelationshipsLoading(true);
    setDomainRelationshipsError("");

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

      if (
        !domainsResponse.ok ||
        !domainsData.success
      ) {
        throw new Error(
          domainsData.error ||
            "Unable to load the Domain Registry."
        );
      }

      if (
        !typesResponse.ok ||
        !typesData.success
      ) {
        throw new Error(
          typesData.error ||
            "Unable to load domain relationship types."
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
        rawDomains
          .map(
            (
              domain: Record<string, unknown>
            ) => ({
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
                typeof domain.description ===
                "string"
                  ? domain.description
                  : null,
              domain_family:
                typeof domain.domain_family ===
                "string"
                  ? domain.domain_family
                  : null,
            })
          )
          .filter(
            (
              domain: DomainRelationshipDomain
            ) =>
              Number.isFinite(domain.id) &&
              domain.id > 0 &&
              Boolean(domain.domain_key)
          )
      );

      setDomainRelationshipTypes(
        rawTypes
          .map((type: unknown) => {
            if (typeof type === "string") {
              return {
                value: type,
                label: type.replace(/_/g, " "),
              };
            }

            if (
              type &&
              typeof type === "object"
            ) {
              const item =
                type as Record<
                  string,
                  unknown
                >;

              const value = String(
                item.value ??
                  item.relationship_type ??
                  item.type ??
                  ""
              );

              return {
                value,
                label:
                  typeof item.label ===
                  "string"
                    ? item.label
                    : value.replace(
                        /_/g,
                        " "
                      ),
              };
            }

            return {
              value: "",
              label: "",
            };
          })
          .filter(
            (
              type: DomainRelationshipType
            ) => Boolean(type.value)
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

  const loadMetadataDomainRelationships = async (
    metadataRecordId: string | number
  ): Promise<
    DomainRelationshipSelection[]
  > => {
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
      Array.isArray(data.relationships)
        ? data.relationships
        : [];

    return relationships
      .map(
        (
          relationship: Record<
            string,
            unknown
          >
        ) => ({
          domainId: Number(
            relationship.domain_id
          ),
          relationshipType: String(
            relationship.relationship_type ??
              ""
          ),
        })
      )
      .filter(
        (
          relationship: DomainRelationshipSelection
        ) =>
          Number.isFinite(
            relationship.domainId
          ) &&
          relationship.domainId > 0 &&
          Boolean(
            relationship.relationshipType
          )
      );
  };

  const saveMetadataDomainRelationships = async (
    metadataRecordId: string | number,
    selections: DomainRelationshipSelection[]
  ) => {
    const current =
      await loadMetadataDomainRelationships(
        metadataRecordId
      );

    const currentKeys = new Set(
      current.map(
        (item) =>
          String(item.domainId) +
          ":" +
          item.relationshipType
      )
    );

    const desiredKeys = new Set(
      selections.map(
        (item) =>
          String(item.domainId) +
          ":" +
          item.relationshipType
      )
    );

    if (
      current.length > 0
    ) {
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
            "Unable to refresh domain relationships."
        );
      }

      const relationshipRows =
        Array.isArray(
          data.relationships
        )
          ? data.relationships
          : [];

      for (
        const existing of current
      ) {
        const key =
          String(existing.domainId) +
          ":" +
          existing.relationshipType;

        if (
          desiredKeys.has(key)
        ) {
          continue;
        }

        const relationship =
          relationshipRows.find(
            (
              item: Record<
                string,
                unknown
              >
            ) =>
              Number(
                item.domain_id
              ) ===
                Number(
                  existing.domainId
                ) &&
              String(
                item.relationship_type ??
                  ""
              ) ===
                existing.relationshipType
          );

        if (
          !relationship?.id
        ) {
          continue;
        }

        const deleteResponse =
          await deleteDomainRelationship(
            String(
              relationship.id
            )
          );

        const deleteData =
          await deleteResponse.json();

        if (
          !deleteResponse.ok ||
          !deleteData.success
        ) {
          throw new Error(
            deleteData.error ||
              "Unable to remove a domain relationship."
          );
        }
      }
    }

    for (
      const selection of selections
    ) {
      const key =
        String(selection.domainId) +
        ":" +
        selection.relationshipType;

      if (
        currentKeys.has(key)
      ) {
        continue;
      }

      const response =
        await createDomainRelationship({
          metadata_record_id:
            Number(metadataRecordId),
          domain_id:
            Number(selection.domainId),
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
            "Unable to save a domain relationship."
        );
      }
    }

    return loadMetadataDomainRelationships(
      metadataRecordId
    );
  };
`;

page = insertOnce(
  page,
  "  const handleMetadataSubmit = async (",
  relationshipHelpers +
    "\n  const handleMetadataSubmit = async (",
  "page relationship helpers"
);

/*
 * =============================================================
 * DOMAIN REGISTRY LOADING
 * =============================================================
 */

page = insertOnce(
  page,
  "  const closeMetadataModal = () => {",
  `

  useEffect(() => {
    void loadDomainRelationshipRegistry();
  }, []);
`,
  "domain relationship registry effect"
);

/*
 * =============================================================
 * METADATA MODAL CLOSE
 * =============================================================
 */

page = insertOnce(
  page,
  `    const closeMetadataModal = () => {`,
  `    const closeMetadataModal = () => {
      setMetadataDomainRelationships([]);
      setDomainRelationshipsError("");`,
  "metadata modal relationship reset"
);

/*
 * =============================================================
 * METADATA CREATION
 * =============================================================
 */

page = insertIntoFunction(
  page,
  "handleMetadataSubmit",
  `      const data =
        await response.json();`,
  `      const data =
        await response.json();

      const metadataRecordId =
        Number(
          data.metadata?.id ??
            data.record?.id ??
            0
        );

      if (
        metadataDomainRelationships.length >
          0 &&
        metadataRecordId > 0
      ) {
        const savedRelationships =
          await saveMetadataDomainRelationships(
            metadataRecordId,
            metadataDomainRelationships
          );

        setMetadataDomainRelationships(
          savedRelationships
        );
      }`,
  "metadata relationship persistence"
);

/*
 * =============================================================
 * UPLOAD APPRAISAL RELATIONSHIPS
 * =============================================================
 */

page = insertIntoFunction(
  page,
  "handleUpload",
  `      if (data.appraisal) {`,
  `
        if (
          data.appraisal?.metadataRecordId
        ) {
          try {
            const existingRelationships =
              await loadMetadataDomainRelationships(
                data.appraisal.metadataRecordId
              );

            setAppraisalDomainRelationships(
              existingRelationships
            );
          } catch (error) {
            setAppraisalDomainRelationships(
              []
            );

            setDomainRelationshipsError(
              error instanceof Error
                ? error.message
                : "Unable to load existing domain relationships."
            );
          }
        } else {
          setAppraisalDomainRelationships([]);
        }
`,
  "upload appraisal relationship loading"
);

/*
 * =============================================================
 * APPRAISAL RELATIONSHIP PERSISTENCE
 * =============================================================
 */

for (
  const functionName of [
    "handleDoneAppraisal",
    "handleCreateMetadataFromAppraisal",
    "handleAppraisalReview",
  ]
) {
  const range =
    functionRange(
      page,
      functionName
    );

  const body =
    page.slice(
      range.start,
      range.end
    );

  const responseMarker =
    `      const data =
        await response.json();`;

  if (
    body.includes(
      responseMarker
    )
  ) {
    page = insertIntoFunction(
      page,
      functionName,
      responseMarker,
      `

      const relationshipMetadataRecordId =
        Number(
          data.metadata?.id ??
            data.record?.id ??
            metadataRecordId ??
            uploadedAppraisal?.metadataRecordId ??
            0
        );

      if (
        relationshipMetadataRecordId > 0 &&
        appraisalDomainRelationships.length > 0
      ) {
        const savedRelationships =
          await saveMetadataDomainRelationships(
            relationshipMetadataRecordId,
            appraisalDomainRelationships
          );

        setAppraisalDomainRelationships(
          savedRelationships
        );
      }`,
      `${functionName} domain relationship persistence`
    );
  }
}

/*
 * =============================================================
 * UPLOAD MODAL RESET
 * =============================================================
 */

page = insertIntoFunction(
  page,
  "closeUploadModal",
  "const closeUploadModal = () => {",
  `
    setAppraisalDomainRelationships([]);
    setDomainRelationshipsError("");`,
  "upload modal relationship reset"
);

/*
 * =============================================================
 * MODALS IMPORTS
 * =============================================================
 */

modals = insertOnce(
  modals,
  'import { Appraisal } from "@/components/appraisal/Appraisal";',
  `
import { DomainRelationshipSelector } from "@/components/metadata/DomainRelationshipSelector";
import type {
  DomainRelationshipDomain,
  DomainRelationshipSelection,
  DomainRelationshipType,
} from "@/components/metadata/DomainRelationshipSelector";`,
  "Modals domain relationship imports"
);

/*
 * =============================================================
 * MODALS PROPS
 * =============================================================
 */

modals = insertOnce(
  modals,
  `  showMetadataModal: boolean;
  form: FormState;
  documentTypes: DocumentType[];`,
  `  showMetadataModal: boolean;
  form: FormState;
  documentTypes: DocumentType[];

  metadataDomainRelationshipDomains: DomainRelationshipDomain[];
  metadataDomainRelationshipTypes: DomainRelationshipType[];
  metadataDomainRelationships: DomainRelationshipSelection[];

  appraisalDomainRelationshipDomains: DomainRelationshipDomain[];
  appraisalDomainRelationshipTypes: DomainRelationshipType[];
  appraisalDomainRelationships: DomainRelationshipSelection[];

  domainRelationshipsLoading: boolean;
  domainRelationshipsError: string;`,
  "Modals relationship props"
);

modals = insertOnce(
  modals,
  `  setForm: Dispatch<
    SetStateAction<FormState>
  >;`,
  `  setForm: Dispatch<
    SetStateAction<FormState>
  >;

  setMetadataDomainRelationships: Dispatch<
    SetStateAction<DomainRelationshipSelection[]>
  >;

  setAppraisalDomainRelationships: Dispatch<
    SetStateAction<DomainRelationshipSelection[]>
  >;`,
  "Modals relationship setters"
);

/*
 * =============================================================
 * MODALS DESTRUCTURING
 * =============================================================
 */

modals = insertOnce(
  modals,
  `  form,
  documentTypes,

  setForm,`,
  `  form,
  documentTypes,

  metadataDomainRelationshipDomains,
  metadataDomainRelationshipTypes,
  metadataDomainRelationships,

  appraisalDomainRelationshipDomains,
  appraisalDomainRelationshipTypes,
  appraisalDomainRelationships,

  domainRelationshipsLoading,
  domainRelationshipsError,

  setForm,
  setMetadataDomainRelationships,
  setAppraisalDomainRelationships,`,
  "Modals relationship destructuring"
);

/*
 * =============================================================
 * NORMAL METADATA SELECTOR
 * =============================================================
 */

const normalSelector = `
                    <DomainRelationshipSelector
                      domains={
                        metadataDomainRelationshipDomains
                      }
                      relationshipTypes={
                        metadataDomainRelationshipTypes
                      }
                      selected={
                        metadataDomainRelationships
                      }
                      onChange={
                        setMetadataDomainRelationships
                      }
                      disabled={
                        domainRelationshipsLoading
                      }
                      title="Domain Relationships"
                      description="Associate this metadata record with one or more registered domains."
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

modals = insertOnce(
  modals,
  `                    <div
                      id="manual-additional-metadata"`,
  normalSelector +
    `                    <div
                      id="manual-additional-metadata"`,
  "normal metadata domain relationship selector"
);

/*
 * =============================================================
 * APPRAISAL PROPS
 * =============================================================
 */

modals = insertOnce(
  modals,
  `                            appraisalCommittedAdditionalMetadata={appraisalCommittedAdditionalMetadata}
                            appraisalRequiredFieldsComplete={appraisalRequiredFieldsComplete}`,
  `                            appraisalCommittedAdditionalMetadata={appraisalCommittedAdditionalMetadata}
                            appraisalDomainRelationshipDomains={appraisalDomainRelationshipDomains}
                            appraisalDomainRelationshipTypes={appraisalDomainRelationshipTypes}
                            appraisalDomainRelationships={appraisalDomainRelationships}
                            domainRelationshipsLoading={domainRelationshipsLoading}
                            domainRelationshipsError={domainRelationshipsError}
                            appraisalRequiredFieldsComplete={appraisalRequiredFieldsComplete}`,
  "Appraisal domain relationship props"
);

modals = insertOnce(
  modals,
  `                            setAppraisalCommittedAdditionalMetadata={setAppraisalCommittedAdditionalMetadata}
                            handleAppraisalReview={handleAppraisalReview}`,
  `                            setAppraisalCommittedAdditionalMetadata={setAppraisalCommittedAdditionalMetadata}
                            setAppraisalDomainRelationships={setAppraisalDomainRelationships}
                            handleAppraisalReview={handleAppraisalReview}`,
  "Appraisal relationship setter"
);

/*
 * =============================================================
 * APPRAISAL IMPORTS
 * =============================================================
 */

appraisal = insertOnce(
  appraisal,
  'import type {',
  `import { DomainRelationshipSelector } from "@/components/metadata/DomainRelationshipSelector";

import type {
  DomainRelationshipDomain,
  DomainRelationshipSelection,
  DomainRelationshipType,
} from "@/components/metadata/DomainRelationshipSelector";

import type {`,
  "Appraisal relationship imports"
);

/*
 * =============================================================
 * APPRAISAL PROPS
 * =============================================================
 */

appraisal = insertOnce(
  appraisal,
  `  appraisalCommittedAdditionalMetadata: AdditionalMetadataField[];`,
  `  appraisalCommittedAdditionalMetadata: AdditionalMetadataField[];

  appraisalDomainRelationshipDomains: DomainRelationshipDomain[];
  appraisalDomainRelationshipTypes: DomainRelationshipType[];
  appraisalDomainRelationships: DomainRelationshipSelection[];
  domainRelationshipsLoading: boolean;
  domainRelationshipsError: string;`,
  "Appraisal relationship props"
);

appraisal = insertOnce(
  appraisal,
  `  setAppraisalCommittedAdditionalMetadata: Dispatch<
    SetStateAction<AdditionalMetadataField[]>
  >;`,
  `  setAppraisalCommittedAdditionalMetadata: Dispatch<
    SetStateAction<AdditionalMetadataField[]>
  >;

  setAppraisalDomainRelationships: Dispatch<
    SetStateAction<DomainRelationshipSelection[]>
  >;`,
  "Appraisal relationship setter"
);

appraisal = insertOnce(
  appraisal,
  `  appraisalCommittedAdditionalMetadata,
  appraisalRequiredFieldsComplete,`,
  `  appraisalCommittedAdditionalMetadata,
  appraisalDomainRelationshipDomains,
  appraisalDomainRelationshipTypes,
  appraisalDomainRelationships,
  domainRelationshipsLoading,
  domainRelationshipsError,
  appraisalRequiredFieldsComplete,`,
  "Appraisal relationship destructuring"
);

appraisal = insertOnce(
  appraisal,
  `  setAppraisalCommittedAdditionalMetadata,
  handleAppraisalReview,`,
  `  setAppraisalCommittedAdditionalMetadata,
  setAppraisalDomainRelationships,
  handleAppraisalReview,`,
  "Appraisal relationship setter destructuring"
);

/*
 * =============================================================
 * APPRAISAL SELECTOR
 * =============================================================
 */

const appraisalSelector = `
      <DomainRelationshipSelector
        domains={
          appraisalDomainRelationshipDomains
        }
        relationshipTypes={
          appraisalDomainRelationshipTypes
        }
        selected={
          appraisalDomainRelationships
        }
        onChange={
          setAppraisalDomainRelationships
        }
        disabled={
          reviewingDecision ||
          !canManageDocuments ||
          domainRelationshipsLoading
        }
        title="Domain Relationships"
        description="Associate the appraisal metadata with one or more registered domains."
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

appraisal = insertOnce(
  appraisal,
  `      {matchedMetadata && (`,
  appraisalSelector +
    `      {matchedMetadata && (`,
  "Appraisal domain relationship selector"
);

/*
 * =============================================================
 * PAGE -> MODALS PROPS
 * =============================================================
 */

page = insertOnce(
  page,
  `        form={form}
        documentTypes={documentTypes}

        setForm={setForm}`,
  `        form={form}
        documentTypes={documentTypes}

        metadataDomainRelationshipDomains={
          domainRelationshipDomains
        }
        metadataDomainRelationshipTypes={
          domainRelationshipTypes
        }
        metadataDomainRelationships={
          metadataDomainRelationships
        }

        appraisalDomainRelationshipDomains={
          domainRelationshipDomains
        }
        appraisalDomainRelationshipTypes={
          domainRelationshipTypes
        }
        appraisalDomainRelationships={
          appraisalDomainRelationships
        }

        domainRelationshipsLoading={
          domainRelationshipsLoading
        }
        domainRelationshipsError={
          domainRelationshipsError
        }

        setForm={setForm}
        setMetadataDomainRelationships={
          setMetadataDomainRelationships
        }
        setAppraisalDomainRelationships={
          setAppraisalDomainRelationships
        }`,
  "page Modals relationship props"
);

/*
 * =============================================================
 * FINAL STRUCTURAL VALIDATION
 * =============================================================
 */

console.log("");
console.log("--- VALIDATING PATCH STRUCTURE ---");

const checks = [
  [
    page,
    "createDomainRelationship",
    "page create relationship API",
  ],
  [
    page,
    "saveMetadataDomainRelationships",
    "page relationship save helper",
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
    "DomainRelationshipSelector",
    "Modals selector",
  ],
  [
    modals,
    "metadataDomainRelationshipDomains",
    "Modals metadata relationship props",
  ],
  [
    appraisal,
    "DomainRelationshipSelector",
    "Appraisal selector",
  ],
  [
    appraisal,
    "appraisalDomainRelationships",
    "Appraisal relationship props",
  ],
];

for (const [
  text,
  marker,
  label,
] of checks) {
  if (!text.includes(marker)) {
    fail(
      `Validation failed: ${label}.`
    );
  }
}

console.log(
  "Structural validation passed."
);

/*
 * =============================================================
 * WRITE ONLY AFTER ALL VALIDATION PASSES
 * =============================================================
 */

fs.writeFileSync(
  files.page,
  page
);

fs.writeFileSync(
  files.modals,
  modals
);

fs.writeFileSync(
  files.appraisal,
  appraisal
);

console.log("");
console.log(
  "--- M23 FRONTEND FILES WRITTEN ---"
);

console.log(files.page);
console.log(files.modals);
console.log(files.appraisal);

console.log("");
console.log("--- NEW HASHES ---");

console.log(
  "page.tsx      " + hash(page)
);

console.log(
  "Modals.tsx    " + hash(modals)
);

console.log(
  "Appraisal.tsx " + hash(appraisal)
);

console.log("");
console.log("--- BACKUPS ---");

console.log(backups.page);
console.log(backups.modals);
console.log(backups.appraisal);

console.log("");
console.log(
  "M23 frontend relationship patch completed."
);
