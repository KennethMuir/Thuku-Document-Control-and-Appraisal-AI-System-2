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
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex")
    .toUpperCase();
}

function backup(file, suffix) {
  const target = `${file}.before-m23-real-${suffix}.tsx`;
  fs.copyFileSync(file, target);
  return target;
}

function requireText(source, text, description) {
  if (!source.includes(text)) {
    throw new Error(`Could not locate ${description}.`);
  }
}

function insertAfter(source, anchor, addition, description) {
  requireText(source, anchor, description);
  return source.replace(anchor, anchor + addition);
}

function insertBefore(source, anchor, addition, description) {
  requireText(source, anchor, description);
  return source.replace(anchor, addition + anchor);
}

function replaceOnce(source, anchor, replacement, description) {
  requireText(source, anchor, description);
  return source.replace(anchor, replacement);
}

console.log("");
console.log("--- VERIFYING CLEAN M23 BASELINE ---");

const currentPageHash = hash(files.page);
const currentModalsHash = hash(files.modals);
const currentAppraisalHash = hash(files.appraisal);

if (currentPageHash !== expected.page) {
  throw new Error(`page.tsx is not the expected clean baseline. Found ${currentPageHash}`);
}

if (currentModalsHash !== expected.modals) {
  throw new Error(`Modals.tsx is not the expected clean baseline. Found ${currentModalsHash}`);
}

if (currentAppraisalHash !== expected.appraisal) {
  throw new Error(`Appraisal.tsx is not the expected clean baseline. Found ${currentAppraisalHash}`);
}

console.log("page.tsx      baseline OK");
console.log("Modals.tsx    baseline OK");
console.log("Appraisal.tsx baseline OK");

const stamp = new Date()
  .toISOString()
  .replace(/[-:TZ.]/g, "")
  .slice(0, 14);

const pageBackup = backup(files.page, `page-${stamp}`);
const modalsBackup = backup(files.modals, `modals-${stamp}`);
const appraisalBackup = backup(files.appraisal, `appraisal-${stamp}`);

console.log("");
console.log("--- BACKUPS CREATED ---");
console.log(pageBackup);
console.log(modalsBackup);
console.log(appraisalBackup);

let page = fs.readFileSync(files.page, "utf8");
let modals = fs.readFileSync(files.modals, "utf8");
let appraisal = fs.readFileSync(files.appraisal, "utf8");

/* ================================================================
   PAGE: IMPORTS
   ================================================================ */

page = insertAfter(
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
} from "@/components/metadata/DomainRelationshipSelector";
import { DomainRelationshipSelector } from "@/components/metadata/DomainRelationshipSelector";
`,
  "page domain relationship imports"
);

/* ================================================================
   PAGE: FORM STATE
   ================================================================ */

page = insertAfter(
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
  "page form state"
);

/* ================================================================
   PAGE: DOMAIN RELATIONSHIP HELPERS
   ================================================================ */

const helperAnchor = `const handleMetadataSubmit = async (`;

requireText(
  page,
  helperAnchor,
  "metadata submit handler"
);

const relationshipHelpers = `
  const loadDomainRelationshipRegistry = async () => {
    setDomainRelationshipsLoading(true);
    setDomainRelationshipsError("");

    try {
      const [domainResponse, typeResponse] = await Promise.all([
        getDomainRegistry(),
        getRelationshipTypes(),
      ]);

      const domainData = await domainResponse.json();
      const typeData = await typeResponse.json();

      if (!domainResponse.ok || !domainData.success) {
        throw new Error(
          domainData.error || "Unable to load domain registry."
        );
      }

      if (!typeResponse.ok || !typeData.success) {
        throw new Error(
          typeData.error || "Unable to load relationship types."
        );
      }

      const rawDomains = Array.isArray(domainData.domains)
        ? domainData.domains
        : [];

      const rawTypes = Array.isArray(typeData.relationshipTypes)
        ? typeData.relationshipTypes
        : Array.isArray(typeData.types)
          ? typeData.types
          : [];

      setDomainRelationshipDomains(
        rawDomains.map((domain: Record<string, unknown>) => ({
          id: Number(domain.id),
          domain_key: String(domain.domain_key ?? ""),
          display_name: String(domain.display_name ?? ""),
          description:
            domain.description == null
              ? null
              : String(domain.description),
          domain_family:
            domain.domain_family == null
              ? null
              : String(domain.domain_family),
        }))
      );

      setDomainRelationshipTypes(
        rawTypes.map((item: unknown) => {
          if (typeof item === "string") {
            return {
              value: item,
              label: item.replaceAll("_", " "),
            };
          }

          const value = String(
            (item as Record<string, unknown>)?.value ??
              (item as Record<string, unknown>)?.relationship_type ??
              ""
          );

          return {
            value,
            label:
              String(
                (item as Record<string, unknown>)?.label ?? value
              ).replaceAll("_", " "),
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
    metadataRecordId: number | string
  ) => {
    try {
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

      setAppraisalDomainRelationships(
        relationships.map(
          (relationship: Record<string, unknown>) => ({
            domainId: Number(relationship.domain_id),
            relationshipType: String(
              relationship.relationship_type
            ),
          })
        )
      );
    } catch (error) {
      setAppraisalDomainRelationships([]);
      setDomainRelationshipsError(
        error instanceof Error
          ? error.message
          : "Unable to load metadata domain relationships."
      );
    }
  };

  const saveDomainRelationships = async (
    metadataRecordId: number,
    selections: DomainRelationshipSelection[]
  ) => {
    const currentResponse =
      await getMetadataDomainRelationships(metadataRecordId);

    const currentData = await currentResponse.json();

    if (!currentResponse.ok || !currentData.success) {
      throw new Error(
        currentData.error ||
          "Unable to read existing domain relationships."
      );
    }

    const currentRelationships = Array.isArray(
      currentData.relationships
    )
      ? currentData.relationships
      : [];

    const desiredKeys = new Set(
      selections.map(
        (selection) =>
          \`\${selection.domainId}:\${selection.relationshipType}\`
      )
    );

    const currentKeys = new Set(
      currentRelationships.map(
        (relationship: Record<string, unknown>) =>
          \`\${Number(relationship.domain_id)}:\${String(
            relationship.relationship_type
          )}\`
      )
    );

    for (const relationship of currentRelationships) {
      const key =
        \`\${Number(relationship.domain_id)}:\${String(
          relationship.relationship_type
        )}\`;

      if (!desiredKeys.has(key)) {
        const response = await deleteDomainRelationship(
          Number(relationship.id)
        );

        const data = await response.json();

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
        \`\${selection.domainId}:\${selection.relationshipType}\`;

      if (currentKeys.has(key)) {
        continue;
      }

      const response = await createDomainRelationship({
        metadata_record_id: metadataRecordId,
        domain_id: selection.domainId,
        relationship_type: selection.relationshipType,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Unable to save a domain relationship."
        );
      }
    }

    setDomainRelationshipsError("");
  };

`;

page = insertBefore(
  page,
  helperAnchor,
  relationshipHelpers,
  "relationship helper insertion point"
);

/* ================================================================
   PAGE: LOAD DOMAIN REGISTRY AFTER AUTH
   ================================================================ */

const authEffectAnchor =
  `const verifySession = async () => {`;

requireText(
  page,
  authEffectAnchor,
  "authentication effect"
);

page = insertBefore(
  page,
  authEffectAnchor,
  `
  useEffect(() => {
    void loadDomainRelationshipRegistry();
  }, []);

`,
  "domain registry loading effect"
);

/* ================================================================
   PAGE: NORMAL METADATA SUBMIT
   ================================================================ */

const metadataSuccessAnchor =
  `      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Unable to create metadata record."
        );
      }

      closeMetadataModal();`;

requireText(
  page,
  metadataSuccessAnchor,
  "metadata success block"
);

page = replaceOnce(
  page,
  metadataSuccessAnchor,
  `      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Unable to create metadata record."
        );
      }

      const metadataRecordId = Number(
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

      closeMetadataModal();`,
  "metadata success block replacement"
);

/* ================================================================
   PAGE: CLOSE METADATA MODAL
   ================================================================ */

page = replaceOnce(
  page,
  `  const closeMetadataModal = () => {
    setShowMetadataModal(false);
  };`,
  `  const closeMetadataModal = () => {
    setShowMetadataModal(false);
    setMetadataDomainRelationships([]);
    setDomainRelationshipsError("");
  };`,
  "metadata modal close handler"
);

/* ================================================================
   PAGE: APPRAISAL SUCCESS RELATIONSHIP SYNCHRONIZATION
   ================================================================ */

const reviewHandlerMarker =
  `const handleAppraisalReview = async (`;

requireText(
  page,
  reviewHandlerMarker,
  "appraisal review handler"
);

/*
 * Insert a small synchronization step before the existing successful
 * state update. The marker is stable in the supplied clean page.
 */
page = insertBefore(
  page,
  `    setUploadedDocument(data.document ?? uploadedDocument);`,
  `
    const linkedMetadataRecordId = Number(
      data.metadata?.id ??
        uploadedAppraisal?.metadataRecordId ??
        0
    );

    if (
      linkedMetadataRecordId > 0 &&
      appraisalDomainRelationships.length > 0
    ) {
      await saveDomainRelationships(
        linkedMetadataRecordId,
        appraisalDomainRelationships
      );
    }

`,
  "appraisal relationship synchronization"
);

/* ================================================================
   PAGE: MODALS PROPS
   ================================================================ */

page = insertAfter(
  page,
  `        canManageDocuments={canManageDocuments}
        isCreatingNewMetadata={isCreatingNewMetadata}`,
  `

        domainRelationshipDomains={domainRelationshipDomains}
        domainRelationshipTypes={domainRelationshipTypes}
        metadataDomainRelationships={metadataDomainRelationships}
        appraisalDomainRelationships={appraisalDomainRelationships}
        domainRelationshipsLoading={domainRelationshipsLoading}
        domainRelationshipsError={domainRelationshipsError}
        setMetadataDomainRelationships={setMetadataDomainRelationships}
        setAppraisalDomainRelationships={setAppraisalDomainRelationships}
`,
  "Modals domain relationship props"
);

/* ================================================================
   MODALS: IMPORTS
   ================================================================ */

modals = insertAfter(
  modals,
  `import { Appraisal } from "@/components/appraisal/Appraisal";`,
  `

import {
  DomainRelationshipSelector,
  type DomainRelationshipDomain,
  type DomainRelationshipSelection,
  type DomainRelationshipType,
} from "@/components/metadata/DomainRelationshipSelector";
`,
  "Modals relationship selector import"
);

/* ================================================================
   MODALS: PROPS
   ================================================================ */

modals = insertAfter(
  modals,
  `  canManageDocuments: boolean;

  departmentModalOpen: boolean;`,
  `  domainRelationshipDomains: DomainRelationshipDomain[];
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
  >;

`,
  "Modals relationship prop declarations"
);

/* ================================================================
   MODALS: DESTRUCTURING
   ================================================================ */

modals = insertAfter(
  modals,
  `  canManageDocuments,

  departmentModalOpen,`,
  `  domainRelationshipDomains,
  domainRelationshipTypes,
  metadataDomainRelationships,
  appraisalDomainRelationships,
  domainRelationshipsLoading,
  domainRelationshipsError,

  setMetadataDomainRelationships,
  setAppraisalDomainRelationships,

`,
  "Modals relationship destructuring"
);

/* ================================================================
   MODALS: NORMAL METADATA SELECTOR
   ================================================================ */

modals = insertBefore(
  modals,
  `                    <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">`,
  `                    <DomainRelationshipSelector
                      domains={domainRelationshipDomains}
                      relationshipTypes={domainRelationshipTypes}
                      selected={metadataDomainRelationships}
                      onChange={setMetadataDomainRelationships}
                      disabled={
                        !canManageMetadata ||
                        domainRelationshipsLoading
                      }
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

`,
  "normal metadata domain selector"
);

/* ================================================================
   MODALS: APPRAISAL PROPS
   ================================================================ */

modals = insertAfter(
  modals,
  `                            appraisalCommittedAdditionalMetadata={appraisalCommittedAdditionalMetadata}`,
  `                            appraisalDomainRelationshipDomains={domainRelationshipDomains}
                            appraisalDomainRelationshipTypes={domainRelationshipTypes}
                            appraisalDomainRelationships={appraisalDomainRelationships}
                            domainRelationshipsLoading={domainRelationshipsLoading}
                            domainRelationshipsError={domainRelationshipsError}
`,
  "Appraisal relationship props"
);

modals = insertAfter(
  modals,
  `                            setAppraisalCommittedAdditionalMetadata={setAppraisalCommittedAdditionalMetadata}`,
  `                            setAppraisalDomainRelationships={setAppraisalDomainRelationships}
`,
  "Appraisal relationship setter prop"
);

/* ================================================================
   APPRAISAL: IMPORT
   ================================================================ */

appraisal = insertAfter(
  appraisal,
  `import type {
  Dispatch,
  ReactElement,
  SetStateAction,
} from "react";`,
  `

import {
  DomainRelationshipSelector,
  type DomainRelationshipDomain,
  type DomainRelationshipSelection,
  type DomainRelationshipType,
} from "@/components/metadata/DomainRelationshipSelector";
`,
  "Appraisal relationship selector import"
);

/* ================================================================
   APPRAISAL: PROPS
   ================================================================ */

appraisal = insertAfter(
  appraisal,
  `  appraisalCommittedAdditionalMetadata: AdditionalMetadataField[];`,
  `  appraisalDomainRelationshipDomains: DomainRelationshipDomain[];
  appraisalDomainRelationshipTypes: DomainRelationshipType[];
  appraisalDomainRelationships: DomainRelationshipSelection[];
  domainRelationshipsLoading: boolean;
  domainRelationshipsError: string;
`,
  "Appraisal relationship props"
);

appraisal = insertAfter(
  appraisal,
  `  setAppraisalCommittedAdditionalMetadata: Dispatch<
    SetStateAction<AdditionalMetadataField[]>
  >;`,
  `  setAppraisalDomainRelationships: Dispatch<
    SetStateAction<DomainRelationshipSelection[]>
  >;
`,
  "Appraisal relationship setter declaration"
);

/* ================================================================
   APPRAISAL: DESTRUCTURING
   ================================================================ */

appraisal = insertAfter(
  appraisal,
  `  appraisalCommittedAdditionalMetadata,
`,
  `  appraisalDomainRelationshipDomains,
  appraisalDomainRelationshipTypes,
  appraisalDomainRelationships,
  domainRelationshipsLoading,
  domainRelationshipsError,
`,
  "Appraisal relationship destructuring"
);

appraisal = insertAfter(
  appraisal,
  `  setAppraisalCommittedAdditionalMetadata,
`,
  `  setAppraisalDomainRelationships,
`,
  "Appraisal relationship setter destructuring"
);

/* ================================================================
   APPRAISAL: SELECTOR UI
   ================================================================ */

appraisal = insertBefore(
  appraisal,
  `      {matchedMetadata && (`,
  `      <DomainRelationshipSelector
        domains={appraisalDomainRelationshipDomains}
        relationshipTypes={appraisalDomainRelationshipTypes}
        selected={appraisalDomainRelationships}
        onChange={setAppraisalDomainRelationships}
        disabled={
          !canManageDocuments ||
          reviewingDecision ||
          domainRelationshipsLoading
        }
        title="Domain Relationships"
        description="Associate this appraisal with one or more institutional domains."
      />

      {domainRelationshipsError && (
        <p
          role="alert"
          className="text-sm font-medium text-red-600"
        >
          {domainRelationshipsError}
        </p>
      )}

`,
  "Appraisal domain selector"
);

/* ================================================================
   WRITE FILES
   ================================================================ */

fs.writeFileSync(files.page, page, "utf8");
fs.writeFileSync(files.modals, modals, "utf8");
fs.writeFileSync(files.appraisal, appraisal, "utf8");

console.log("");
console.log("--- M23 FRONTEND FILES WRITTEN ---");
console.log("page.tsx");
console.log("Modals.tsx");
console.log("Appraisal.tsx");

console.log("");
console.log("--- FINAL HASHES ---");
console.log("page.tsx      " + hash(files.page));
console.log("Modals.tsx    " + hash(files.modals));
console.log("Appraisal.tsx " + hash(files.appraisal));

console.log("");
console.log("M23 FRONTEND PATCH COMPLETED.");
console.log("No process.exit or process.exitCode was used.");
