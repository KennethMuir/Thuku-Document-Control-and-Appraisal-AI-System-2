"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createDomainDefinition,
  getDomainRegistry,
} from "@/lib/api/domainRegistry";

import {
  createDomainRelationship,
  getRelationshipTypes,
} from "@/lib/api/domainRelationships";

type DomainDefinition = {
  id: number;
  domain_key: string;
  display_name: string;
  description: string | null;
  domain_family: string;
  aliases: string[];
  organization_id: number | null;
  specialization_id?: number | null;
  domain_scope?: string | null;
  is_active: boolean;
};

type DocumentDomainAssignmentProps = {
  metadataRecordId: number | null;
  canManageDomains: boolean;
  open: boolean;
  onClose: () => void;
  onAssigned: () => Promise<void> | void;
};

type DomainForm = {
  domain_key: string;
  display_name: string;
  description: string;
  domain_family: string;
  aliases: string;
};

const DOMAIN_FAMILIES = [
  "General / Administrative",
  "Records Management",
  "Governance",
  "Compliance",
  "Risk",
  "Audit",
  "Security",
  "IT",
  "Finance",
  "Procurement",
  "Contracts",
  "HR",
  "Training",
  "Legal",
  "Regulatory",
  "Policy",
  "QA/QC",
  "Engineering",
  "Maintenance",
  "Aviation",
  "Healthcare",
  "Research / Scientific",
  "Education",
  "Environmental",
  "Project Management",
  "Business Operations",
];

const emptyForm: DomainForm = {
  domain_key: "",
  display_name: "",
  description: "",
  domain_family: "",
  aliases: "",
};

const readPayload = async (
  response: Response
): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const readError = (
  payload: unknown,
  fallback: string
): string => {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof (
      payload as { error?: unknown }
    ).error === "string"
  ) {
    return (
      payload as { error: string }
    ).error;
  }

  return fallback;
};

export default function DocumentDomainAssignment({
  metadataRecordId,
  canManageDomains,
  open,
  onClose,
  onAssigned,
}: DocumentDomainAssignmentProps) {
  const [domains, setDomains] = useState<
    DomainDefinition[]
  >([]);

  const [selectedDomainId, setSelectedDomainId] =
    useState("");

  const [relationshipTypes, setRelationshipTypes] =
    useState<string[]>([]);

  const [selectedRelationshipType, setSelectedRelationshipType] =
    useState("");

  const [loadingRelationshipTypes, setLoadingRelationshipTypes] =
    useState(false);

  const [loadingDomains, setLoadingDomains] =
    useState(false);

  const [assigning, setAssigning] =
    useState(false);

  const [showCreateForm, setShowCreateForm] =
    useState(false);

  const [creating, setCreating] =
    useState(false);

  const [form, setForm] =
    useState<DomainForm>(emptyForm);

  const [error, setError] =
    useState<string | null>(null);

  const organizationDomains =
    useMemo(
      () =>
        domains
          .filter(
            (domain) =>
              domain.organization_id !==
                null &&
              domain.is_active
          )
          .sort((a, b) =>
            a.display_name.localeCompare(
              b.display_name
            )
          ),
      [domains]
    );

  useEffect(() => {
    if (!open) {
      return;
    }

    setError(null);
    setSelectedDomainId("");
    setSelectedRelationshipType("");
    setShowCreateForm(false);
    setForm(emptyForm);

    if (
      metadataRecordId === null ||
      !Number.isInteger(
        metadataRecordId
      ) ||
      metadataRecordId <= 0
    ) {
      setError(
        "This document does not have a valid metadata record."
      );
      return;
    }

    let cancelled = false;

    const loadDomains = async () => {
      setLoadingDomains(true);

      try {
        const response =
          await getDomainRegistry();

        const payload =
          await readPayload(response);

        if (!response.ok) {
          throw new Error(
            readError(
              payload,
              "Unable to load available domains."
            )
          );
        }

        const rawDomains =
          typeof payload === "object" &&
          payload !== null &&
          "domain_registry" in payload &&
          Array.isArray(
            (
              payload as {
                domain_registry?: unknown;
              }
            ).domain_registry
          )
            ? (
                payload as {
                  domain_registry: unknown[];
                }
              ).domain_registry
            : [];

        if (cancelled) {
          return;
        }

        setDomains(
          rawDomains as DomainDefinition[]
        );
      } catch (loadError: unknown) {
        if (cancelled) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load available domains."
        );
      } finally {
        if (!cancelled) {
          setLoadingDomains(false);
        }
      }
    };

    void loadDomains();

    const loadRelationshipTypes = async () => {
      setLoadingRelationshipTypes(true);

      try {
        const response =
          await getRelationshipTypes();

        const payload =
          await readPayload(response);

        if (!response.ok) {
          throw new Error(
            readError(
              payload,
              "Unable to load relationship types."
            )
          );
        }

        const rawRelationshipTypes =
          typeof payload === "object" &&
          payload !== null &&
          "relationship_types" in payload &&
          Array.isArray(
            (
              payload as {
                relationship_types?: unknown;
              }
            ).relationship_types
          )
            ? (
                payload as {
                  relationship_types: unknown[];
                }
              ).relationship_types
            : [];

        const normalizedRelationshipTypes =
          rawRelationshipTypes.filter(
            (
              value
            ): value is string =>
              typeof value === "string" &&
              value.trim().length > 0
          );

        if (cancelled) {
          return;
        }

        setRelationshipTypes(
          normalizedRelationshipTypes
        );
      } catch (relationshipTypeError: unknown) {
        if (cancelled) {
          return;
        }

        setError(
          relationshipTypeError instanceof Error
            ? relationshipTypeError.message
            : "Unable to load relationship types."
        );
      } finally {
        if (!cancelled) {
          setLoadingRelationshipTypes(false);
        }
      }
    };
    void loadRelationshipTypes();

    return () => {
      cancelled = true;
    };
  }, [open, metadataRecordId]);

  if (!open) {
    return null;
  }

  const handleAssign = async (): Promise<void> => {
    if (assigning) {
      return;
    }

    const domainId =
      Number(selectedDomainId);

    if (
      metadataRecordId === null ||
      !Number.isInteger(
        metadataRecordId
      ) ||
      metadataRecordId <= 0
    ) {
      setError(
        "This document does not have a valid metadata record."
      );
      return;
    }

    if (
      !Number.isInteger(domainId) ||
      domainId <= 0
    ) {
      setError(
        "Select an Organization domain first."
      );
      return;
    }


    if (!selectedRelationshipType) {
      setError(
        "Select a relationship type first."
      );
      return;
    }
    setAssigning(true);
    setError(null);

    try {
      const response =
        await createDomainRelationship({
          metadata_record_id:
            metadataRecordId,
          domain_id: domainId,
          relationship_type:
            selectedRelationshipType,
        });

      const payload =
        await readPayload(response);

      if (!response.ok) {
        throw new Error(
          readError(
            payload,
            "Unable to assign the domain to this document."
          )
        );
      }

      await onAssigned();
      onClose();
    } catch (assignmentError: unknown) {
      setError(
        assignmentError instanceof Error
          ? assignmentError.message
          : "Unable to assign the domain to this document."
      );
    } finally {
      setAssigning(false);
    }
  };

  const handleCreate = async (): Promise<void> => {
    if (
      !canManageDomains ||
      creating
    ) {
      return;
    }

    const domainKey =
      form.domain_key.trim();

    const displayName =
      form.display_name.trim();

    const domainFamily =
      form.domain_family;

    if (!selectedRelationshipType) {
      setError(
        "Select a relationship type first."
      );
      return;
    }

    if (
      !domainKey ||
      !displayName ||
      !domainFamily
    ) {
      setError(
        "Domain key, display name, and domain family are required."
      );
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const aliases =
        form.aliases
          .split(",")
          .map((alias) =>
            alias.trim()
          )
          .filter(Boolean);

      const response =
        await createDomainDefinition({
          domain_key: domainKey,
          display_name: displayName,
          description:
            form.description.trim(),
          domain_family:
            domainFamily,
          aliases,
        });

      const payload =
        await readPayload(response);

      if (!response.ok) {
        throw new Error(
          readError(
            payload,
            "Unable to create the Organization domain."
          )
        );
      }

      const createdDomain =
        typeof payload === "object" &&
        payload !== null &&
        "domain_definition" in payload
          ? (
              payload as {
                domain_definition?: unknown;
              }
            ).domain_definition
          : null;

      const createdDomainId =
        typeof createdDomain === "object" &&
        createdDomain !== null &&
        "id" in createdDomain
          ? Number(
              (
                createdDomain as {
                  id?: unknown;
                }
              ).id
            )
          : NaN;

      if (
        Number.isInteger(
          createdDomainId
        ) &&
        createdDomainId > 0
      ) {
        const assignmentResponse =
          await createDomainRelationship({
            metadata_record_id:
              metadataRecordId as number,
            domain_id:
              createdDomainId,
            relationship_type:
            selectedRelationshipType,
          });

        const assignmentPayload =
          await readPayload(
            assignmentResponse
          );

        if (
          !assignmentResponse.ok
        ) {
          throw new Error(
            readError(
              assignmentPayload,
              "The Organization domain was created, but it could not be assigned to the document."
            )
          );
        }

        await onAssigned();
        onClose();
        return;
      }

      const refreshResponse =
        await getDomainRegistry();

      const refreshPayload =
        await readPayload(
          refreshResponse
        );

      if (!refreshResponse.ok) {
        throw new Error(
          "The Organization domain was created, but its ID could not be retrieved."
        );
      }

      const refreshedDomains =
        typeof refreshPayload ===
          "object" &&
        refreshPayload !== null &&
        "domain_registry" in
          refreshPayload &&
        Array.isArray(
          (
            refreshPayload as {
              domain_registry?: unknown;
            }
          ).domain_registry
        )
          ? (
              refreshPayload as {
                domain_registry: DomainDefinition[];
              }
            ).domain_registry
          : [];

      const matchingDomain =
        refreshedDomains.find(
          (domain) =>
            domain.domain_key ===
            domainKey
        );

      if (
        !matchingDomain ||
        !Number.isInteger(
          matchingDomain.id
        )
      ) {
        throw new Error(
          "The Organization domain was created, but it could not be located for assignment."
        );
      }

      const assignmentResponse =
        await createDomainRelationship({
          metadata_record_id:
            metadataRecordId as number,
          domain_id:
            matchingDomain.id,
          relationship_type:
            selectedRelationshipType,
        });

      const assignmentPayload =
        await readPayload(
          assignmentResponse
        );

      if (
        !assignmentResponse.ok
      ) {
        throw new Error(
          readError(
            assignmentPayload,
            "The Organization domain was created, but it could not be assigned to the document."
          )
        );
      }

      await onAssigned();
      onClose();
    } catch (creationError: unknown) {
      setError(
        creationError instanceof Error
          ? creationError.message
          : "Unable to create and assign the Organization domain."
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4">
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-domain-assignment-title"
      >
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Document classification
              </p>

              <h2
                id="document-domain-assignment-title"
                className="mt-1 text-xl font-bold text-slate-950"
              >
                Add Domain
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                Attach an Organization domain to this
                document. Universal and Specialized
                domains are system-controlled.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={
                assigning ||
                creating
              }
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Close
            </button>
          </div>
        </div>

        <div className="space-y-5 p-6">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
              {error}
            </div>
          )}

          {loadingDomains ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
              <p className="text-sm text-slate-500">
                Loading Organization domains...
              </p>
            </div>
          ) : (
            <>
              <div>
                <label
                  htmlFor="document-domain-select"
                  className="block text-sm font-semibold text-slate-800"
                >
                  Organization domain
                </label>

                <select
                  id="document-domain-select"
                  value={selectedDomainId}
                  onChange={(event) =>
                    setSelectedDomainId(
                      event.target.value
                    )
                  }
                  disabled={
                    assigning ||
                    creating ||
                    showCreateForm
                  }
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
                >
                  <option value="">
                    Select an Organization domain
                  </option>

                  {organizationDomains.map(
                    (domain) => (
                      <option
                        key={domain.id}
                        value={domain.id}
                      >
                        {domain.display_name} (
                        {domain.domain_key})
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label
                  htmlFor="document-relationship-type-select"
                  className="block text-sm font-semibold text-slate-800"
                >
                  Relationship type
                </label>

                <select
                  id="document-relationship-type-select"
                  value={selectedRelationshipType}
                  onChange={(event) =>
                    setSelectedRelationshipType(
                      event.target.value
                    )
                  }
                  disabled={
                    assigning ||
                    creating ||
                    loadingRelationshipTypes
                  }
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
                >
                  <option value="">
                    {loadingRelationshipTypes
                      ? "Loading relationship types..."
                      : "Select a relationship type"}
                  </option>

                  {relationshipTypes.map(
                    (relationshipType) => (
                      <option
                        key={relationshipType}
                        value={relationshipType}
                      >
                        {relationshipType}
                      </option>
                    )
                  )}
                </select>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Choose how this domain relates to the document.
                </p>
              </div>

              {!showCreateForm && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">
                    {organizationDomains.length ===
                    0
                      ? "No active Organization domains are available yet."
                      : `${organizationDomains.length} active Organization domain${organizationDomains.length === 1 ? "" : "s"} available.`}
                  </p>

                  <div className="flex gap-2">
                    {canManageDomains && (
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setShowCreateForm(
                            true
                          );
                          setSelectedDomainId(
                            ""
                          );
                        }}
                        disabled={assigning}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Create Organization Domain
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        void handleAssign();
                      }}
                      disabled={
                        assigning ||
                        selectedDomainId === "" ||
                        selectedRelationshipType === ""
                      }
                      className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {assigning
                        ? "Assigning..."
                        : "Add Domain"}
                    </button>
                  </div>
                </div>
              )}

              {showCreateForm && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Create Organization Domain
                      </h3>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        This domain belongs only to your
                        organization.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateForm(
                          false
                        );
                        setError(null);
                      }}
                        disabled={creating}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-900 disabled:opacity-50"
                    >
                      Use Existing
                    </button>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <label
                        htmlFor="document-domain-key"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Domain Key
                      </label>

                      <input
                        id="document-domain-key"
                        value={form.domain_key}
                        onChange={(event) =>
                          setForm(
                            (current) => ({
                              ...current,
                              domain_key:
                                event.target.value,
                            })
                          )
                        }
                        disabled={creating}
                        placeholder="e.g. aviation_operations"
                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="document-domain-display-name"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Display Name
                      </label>

                      <input
                        id="document-domain-display-name"
                        value={
                          form.display_name
                        }
                        onChange={(event) =>
                          setForm(
                            (current) => ({
                              ...current,
                              display_name:
                                event.target.value,
                            })
                          )
                        }
                        disabled={creating}
                        placeholder="e.g. Aviation Operations"
                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="document-domain-family"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Domain Family
                      </label>

                      <select
                        id="document-domain-family"
                        value={
                          form.domain_family
                        }
                        onChange={(event) =>
                          setForm(
                            (current) => ({
                              ...current,
                              domain_family:
                                event.target.value,
                            })
                          )
                        }
                        disabled={creating}
                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                      >
                        <option value="">
                          Select a domain family
                        </option>

                        {DOMAIN_FAMILIES.map(
                          (family) => (
                            <option
                              key={family}
                              value={family}
                            >
                              {family}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="document-domain-aliases"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Aliases
                      </label>

                      <input
                        id="document-domain-aliases"
                        value={form.aliases}
                        onChange={(event) =>
                          setForm(
                            (current) => ({
                              ...current,
                              aliases:
                                event.target.value,
                            })
                          )
                        }
                        disabled={creating}
                        placeholder="Comma-separated aliases"
                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label
                        htmlFor="document-domain-description"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Description
                      </label>

                      <textarea
                        id="document-domain-description"
                        value={
                          form.description
                        }
                        onChange={(event) =>
                          setForm(
                            (current) => ({
                              ...current,
                              description:
                                event.target.value,
                            })
                          )
                        }
                        disabled={creating}
                        rows={3}
                        placeholder="Describe what this domain represents."
                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateForm(
                          false
                        );
                        setError(null);
                      }}
                      disabled={creating}
                      className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white disabled:opacity-50"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        void handleCreate();
                      }}
                      disabled={
                        creating ||
                        selectedRelationshipType === ""
                      }
                      className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {creating
                        ? "Creating..."
                        : "Create & Add Domain"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
