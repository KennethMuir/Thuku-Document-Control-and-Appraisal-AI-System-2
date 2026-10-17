"use client";

import React from "react";

import {
  createDomainDefinition,
  disableDomainDefinition,
  enableDomainDefinition,
  getDomainRegistry,
  updateDomainDefinition,
} from "@/lib/api/domainRegistry";

import {
  createDomainRelationship,
  getRelationshipTypes,
} from "@/lib/api/domainRelationships";

import {
  getDocuments,
} from "@/lib/api/documents";

type DomainDefinition = {
  id: string | number;
  domain_key: string;
  display_name: string;
  description: string | null;
  domain_family: string;
  aliases: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  organization_id: number | null;
};

type DocumentDefinition = {
  id: string | number;
  metadata_record_id: number | null;
  title: string;
  file_name: string;
  document_reference: string;
};

type DomainRegistryProps = {
  canManageDomains: boolean;
};

type DomainRegistryState = {
  domains: DomainDefinition[];
  loading: boolean;
  error: string | null;
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

const EMPTY_FORM: DomainForm = {
  domain_key: "",
  display_name: "",
  description: "",
  domain_family: "",
  aliases: "",
};

function parseError(
  data: unknown,
  fallback: string
): string {
  if (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof (
      data as {
        error?: unknown;
      }
    ).error === "string"
  ) {
    return (
      data as {
        error: string;
      }
    ).error;
  }

  return fallback;
}

async function readResponse(
  response: Response,
  fallback: string
): Promise<unknown> {
  let data: unknown = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      parseError(data, fallback)
    );
  }

  return data;
}

function normalizeDomainKey(
  value: string
): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function asString(
  value: unknown
): string {
  return typeof value === "string"
    ? value
    : "";
}

function asNullableNumber(
  value: unknown
): number | null {
  if (
    typeof value === "number" &&
    Number.isInteger(value)
  ) {
    return value;
  }

  if (
    typeof value === "string" &&
    value.trim() !== ""
  ) {
    const parsed = Number(value);

    if (
      Number.isInteger(parsed) &&
      parsed > 0
    ) {
      return parsed;
    }
  }

  return null;
}

function extractArray(
  data: unknown,
  key: string
): unknown[] {
  if (
    typeof data === "object" &&
    data !== null &&
    key in data
  ) {
    const value = (
      data as Record<string, unknown>
    )[key];

    return Array.isArray(value)
      ? value
      : [];
  }

  return [];
}

function normalizeDocument(
  value: unknown,
  index: number
): DocumentDefinition | null {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return null;
  }

  const record =
    value as Record<string, unknown>;

  const rawId =
    record.id ??
    record.document_id ??
    record.documentId;

  const id =
    typeof rawId === "string" || typeof rawId === "number"
      ? rawId
      : null;

  if (
    id === undefined ||
    id === null ||
    String(id).trim() === ""
  ) {
    return null;
  }

  const metadataRecordId =
    asNullableNumber(
      record.metadata_record_id ??
        record.metadataRecordId ??
        record.metadata_id ??
        record.metadataId
    );

  const title =
    asString(
      record.title ??
        record.document_title ??
        record.name ??
        record.display_name
    ).trim();

  const fileName =
    asString(
      record.file_name ??
        record.filename ??
        record.original_filename ??
        record.originalFileName
    ).trim();

  const reference =
    asString(
      record.document_reference ??
        record.reference ??
        record.document_number ??
        record.documentNumber
    ).trim();

  return {
    id,
    metadata_record_id:
      metadataRecordId,
    title:
      title ||
      fileName ||
      reference ||
      `Document ${index + 1}`,
    file_name:
      fileName,
    document_reference:
      reference,
  };
}

function getDocumentLabel(
  document: DocumentDefinition
): string {
  const parts: string[] = [];

  if (document.title) {
    parts.push(document.title);
  }

  if (
    document.file_name &&
    document.file_name !== document.title
  ) {
    parts.push(document.file_name);
  }

  if (
    document.document_reference &&
    !parts.includes(
      document.document_reference
    )
  ) {
    parts.push(
      document.document_reference
    );
  }

  return parts.join(" · ");
}

export function DomainRegistry({
  canManageDomains,
}: DomainRegistryProps) {
  const [
    state,
    setState,
  ] = React.useState<DomainRegistryState>({
    domains: [],
    loading: true,
    error: null,
  });

  const [
    showCreateForm,
    setShowCreateForm,
  ] = React.useState(false);

  const [
    editingDomainKey,
    setEditingDomainKey,
  ] = React.useState<string | null>(null);

  const [
    saving,
    setSaving,
  ] = React.useState(false);

  const [
    actionDomainKey,
    setActionDomainKey,
  ] = React.useState<string | null>(null);

  const [
    formError,
    setFormError,
  ] = React.useState<string | null>(null);

  const [
    form,
    setForm,
  ] = React.useState<DomainForm>(
    EMPTY_FORM
  );

  const [
    documents,
    setDocuments,
  ] = React.useState<
    DocumentDefinition[]
  >([]);

  const [
    loadingDocuments,
    setLoadingDocuments,
  ] = React.useState(false);

  const [
    documentLoadError,
    setDocumentLoadError,
  ] = React.useState<string | null>(null);

  const [
    selectedDocumentId,
    setSelectedDocumentId,
  ] = React.useState("");

  const [
    relationshipTypes,
    setRelationshipTypes,
  ] = React.useState<string[]>([]);

  const [
    loadingRelationshipTypes,
    setLoadingRelationshipTypes,
  ] = React.useState(false);

  const [
    relationshipTypeLoadError,
    setRelationshipTypeLoadError,
  ] = React.useState<string | null>(null);

  const [
    selectedRelationshipType,
    setSelectedRelationshipType,
  ] = React.useState("");

  const loadDomains =
    React.useCallback(
      async (): Promise<DomainDefinition[]> => {
        setState((current) => ({
          ...current,
          loading: true,
          error: null,
        }));

        try {
          const response =
            await getDomainRegistry();

          const data =
            await readResponse(
              response,
              "Unable to retrieve domain definitions."
            );

          const rawDomains =
            extractArray(
              data,
              "domain_registry"
            );

          const normalizedDomains =
            rawDomains.filter(
              (
                domain
              ): domain is DomainDefinition =>
                typeof domain === "object" &&
                domain !== null
            ) as DomainDefinition[];

          setState({
            domains:
              normalizedDomains,
            loading: false,
            error: null,
          });

          return normalizedDomains;
        } catch (error: unknown) {
          const message =
            error instanceof Error
              ? error.message
              : "Unable to retrieve domain definitions.";

          setState({
            domains: [],
            loading: false,
            error: message,
          });

          throw new Error(message);
        }
      },
      []
    );

  const loadDocuments =
    React.useCallback(
      async (): Promise<void> => {
        setLoadingDocuments(true);
        setDocumentLoadError(null);

        try {
          const response =
            await getDocuments();

          const data =
            await readResponse(
              response,
              "Unable to retrieve documents."
            );

          const rawDocuments =
            extractArray(
              data,
              "documents"
            );

          const normalizedDocuments =
            rawDocuments
              .map(
                (
                  document,
                  index
                ) =>
                  normalizeDocument(
                    document,
                    index
                  )
              )
              .filter(
                (
                  document
                ): document is DocumentDefinition =>
                  document !== null
              );

          setDocuments(
            normalizedDocuments
          );
        } catch (error: unknown) {
          setDocuments([]);

          setDocumentLoadError(
            error instanceof Error
              ? error.message
              : "Unable to retrieve documents."
          );
        } finally {
          setLoadingDocuments(false);
        }
      },
      []
    );

  const loadRelationshipTypes =
    React.useCallback(
      async (): Promise<void> => {
        setLoadingRelationshipTypes(
          true
        );
        setRelationshipTypeLoadError(
          null
        );

        try {
          const response =
            await getRelationshipTypes();

          const data =
            await readResponse(
              response,
              "Unable to load relationship types."
            );

          const rawRelationshipTypes =
            extractArray(
              data,
              "relationship_types"
            );

          const normalizedRelationshipTypes =
            rawRelationshipTypes.filter(
              (
                value
              ): value is string =>
                typeof value ===
                  "string" &&
                value.trim().length > 0
            );

          setRelationshipTypes(
            normalizedRelationshipTypes
          );
        } catch (error: unknown) {
          setRelationshipTypes([]);

          setRelationshipTypeLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load relationship types."
          );
        } finally {
          setLoadingRelationshipTypes(
            false
          );
        }
      },
      []
    );

  React.useEffect(() => {
    void loadDomains();
  }, [loadDomains]);

  const resetCreateForm = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setSelectedDocumentId("");
    setSelectedRelationshipType("");
    setDocumentLoadError(null);
    setRelationshipTypeLoadError(null);
    setShowCreateForm(false);
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setEditingDomainKey(null);
    setSelectedDocumentId("");
    setSelectedRelationshipType("");
    setDocumentLoadError(null);
    setRelationshipTypeLoadError(null);
    setShowCreateForm(false);
  };

  const beginCreate = () => {
    if (!canManageDomains) {
      return;
    }

    setForm(EMPTY_FORM);
    setFormError(null);
    setEditingDomainKey(null);
    setSelectedDocumentId("");
    setSelectedRelationshipType("");
    setDocumentLoadError(null);
    setRelationshipTypeLoadError(null);
    setShowCreateForm(true);

    void loadDocuments();
    void loadRelationshipTypes();
  };

  const beginEdit = (
    domain: DomainDefinition
  ) => {
    if (
      !canManageDomains ||
      domain.organization_id === null
    ) {
      return;
    }

    setForm({
      domain_key:
        domain.domain_key,
      display_name:
        domain.display_name,
      description:
        domain.description ?? "",
      domain_family:
        domain.domain_family,
      aliases:
        Array.isArray(domain.aliases)
          ? domain.aliases.join(", ")
          : "",
    });

    setFormError(null);
    setEditingDomainKey(
      domain.domain_key
    );
    setShowCreateForm(false);
  };

  const selectedDocument =
    documents.find(
      (document) =>
        String(document.id) ===
        selectedDocumentId
    ) ?? null;

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();

    if (!canManageDomains) {
      return;
    }

    if (saving) {
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const aliases = form.aliases
        .split(",")
        .map((alias) =>
          alias.trim()
        )
        .filter(Boolean);

      if (editingDomainKey) {
        const response =
          await updateDomainDefinition(
            editingDomainKey,
            {
              display_name:
                form.display_name.trim(),
              description:
                form.description.trim(),
              domain_family:
                form.domain_family,
              aliases,
            }
          );

        await readResponse(
          response,
          "Unable to update the domain definition."
        );

        resetForm();
        await loadDomains();
        return;
      }

      if (!selectedDocumentId) {
        setFormError(
          "Select the document this organization domain is for."
        );
        return;
      }

      if (!selectedDocument) {
        setFormError(
          "The selected document could not be found. Select a document again."
        );
        return;
      }

      if (
        selectedDocument.metadata_record_id ===
        null
      ) {
        setFormError(
          "The selected document does not have a metadata record and cannot receive a domain relationship."
        );
        return;
      }

      if (!selectedRelationshipType) {
        setFormError(
          "Select a relationship type for the new domain."
        );
        return;
      }

      const domainKey =
        normalizeDomainKey(
          form.domain_key
        );

      if (!domainKey) {
        setFormError(
          "Domain key is required."
        );
        return;
      }

      if (
        !form.display_name.trim()
      ) {
        setFormError(
          "Display name is required."
        );
        return;
      }

      if (!form.domain_family) {
        setFormError(
          "Domain family is required."
        );
        return;
      }

      const createResponse =
        await createDomainDefinition({
          domain_key:
            domainKey,
          display_name:
            form.display_name.trim(),
          description:
            form.description.trim(),
          domain_family:
            form.domain_family,
          aliases,
        });

      const createData =
        await readResponse(
          createResponse,
          "Unable to create the organization domain."
        );

      let createdDomainId:
        | number
        | null = null;

      if (
        typeof createData ===
          "object" &&
        createData !== null
      ) {
        const responseRecord =
          createData as Record<
            string,
            unknown
          >;

        createdDomainId =
          asNullableNumber(
            responseRecord.id ??
              responseRecord.domain_id ??
              responseRecord.domainId
          );

        if (
          createdDomainId === null
        ) {
          const nestedDomain =
            responseRecord.domain;

          if (
            typeof nestedDomain ===
              "object" &&
            nestedDomain !== null
          ) {
            createdDomainId =
              asNullableNumber(
                (
                  nestedDomain as Record<
                    string,
                    unknown
                  >
                ).id ??
                  (
                    nestedDomain as Record<
                      string,
                      unknown
                    >
                  ).domain_id ??
                  (
                    nestedDomain as Record<
                      string,
                      unknown
                    >
                  ).domainId
              );
          }
        }

        if (
          createdDomainId === null
        ) {
          const nestedDefinition =
            responseRecord.domain_definition;

          if (
            typeof nestedDefinition ===
              "object" &&
            nestedDefinition !== null
          ) {
            createdDomainId =
              asNullableNumber(
                (
                  nestedDefinition as Record<
                    string,
                    unknown
                  >
                ).id ??
                  (
                    nestedDefinition as Record<
                      string,
                      unknown
                    >
                  ).domain_id ??
                  (
                    nestedDefinition as Record<
                      string,
                      unknown
                    >
                  ).domainId
              );
          }
        }
      }

      let latestDomains:
        | DomainDefinition[]
        | null = null;

      if (createdDomainId === null) {
        latestDomains =
          await loadDomains();

        const createdDomain =
          latestDomains.find(
            (domain) =>
              domain.organization_id !==
                null &&
              normalizeDomainKey(
                domain.domain_key
              ) === domainKey
          );

        createdDomainId =
          createdDomain
            ? asNullableNumber(
                createdDomain.id
              )
            : null;
      }

      if (
        createdDomainId === null
      ) {
        throw new Error(
          "The organization domain was created, but its domain ID could not be determined. The document relationship was not created."
        );
      }

      const relationshipResponse =
        await createDomainRelationship({
          metadata_record_id:
            selectedDocument.metadata_record_id,
          domain_id:
            createdDomainId,
          relationship_type:
            selectedRelationshipType,
        });

      await readResponse(
        relationshipResponse,
        "The organization domain was created, but it could not be attached to the selected document."
      );

      resetCreateForm();
      await loadDomains();
    } catch (error: unknown) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Unable to save the domain definition."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (
    domain: DomainDefinition
  ): Promise<void> => {
    if (
      !canManageDomains ||
      domain.organization_id === null
    ) {
      return;
    }

    setActionDomainKey(
      domain.domain_key
    );

    setState((current) => ({
      ...current,
      error: null,
    }));

    try {
      const response =
        domain.is_active
          ? await disableDomainDefinition(
              domain.domain_key
            )
          : await enableDomainDefinition(
              domain.domain_key
            );

      await readResponse(
        response,
        domain.is_active
          ? "Unable to disable the domain."
          : "Unable to enable the domain."
      );

      await loadDomains();
    } catch (error: unknown) {
      setState((current) => ({
        ...current,
        error:
          error instanceof Error
            ? error.message
            : "Unable to update the domain status.",
      }));
    } finally {
      setActionDomainKey(null);
    }
  };

  const systemDomains =
    state.domains.filter(
      (domain) =>
        domain.organization_id === null
    );

  const organizationDomains =
    state.domains.filter(
      (domain) =>
        domain.organization_id !== null
    );

  const isCreateMode =
    showCreateForm &&
    editingDomainKey === null;

  return (
    <section className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 px-6 py-5 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Universal classification
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-950">
              Domain Registry
            </h2>

            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Manage the domains available for
              document classification and
              multi-domain relationships.
            </p>
          </div>
        </div>

        {state.loading && (
          <div className="p-8 text-center">
            <p
              role="status"
              aria-live="polite"
              className="text-sm text-slate-500"
            >
              Loading domain definitions...
            </p>
          </div>
        )}

        {!state.loading &&
          state.error && (
            <div className="m-6 rounded-xl border border-red-200 bg-red-50 p-5">
              <p className="text-sm font-semibold text-red-700">
                Unable to load the domain
                registry.
              </p>

              <p className="mt-1 text-sm text-red-600">
                {state.error}
              </p>
            </div>
          )}

        {!state.loading &&
          !state.error && (
            <div className="p-6">
              <div className="mb-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Total domains
                  </p>

                  <p className="mt-2 text-2xl font-bold text-slate-950">
                    {state.domains.length}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    System domains
                  </p>

                  <p className="mt-2 text-2xl font-bold text-slate-950">
                    {systemDomains.length}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Organization domains
                  </p>

                  <p className="mt-2 text-2xl font-bold text-slate-950">
                    {organizationDomains.length}
                  </p>
                </div>
              </div>

              <div className="mb-5 flex flex-col gap-3 rounded-xl border border-violet-200 bg-violet-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    Organization domains
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    Create and manage private
                    domain classifications for
                    this organization. New
                    organization domains are
                    created for a selected
                    document and immediately
                    attached using a relationship
                    type. System domains are
                    protected.
                  </p>
                </div>

                {canManageDomains && (
                  <button
                    type="button"
                    onClick={beginCreate}
                    className="shrink-0 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Add Organization Domain
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="px-5 py-4 font-semibold">
                        Domain Key
                      </th>

                      <th className="px-5 py-4 font-semibold">
                        Display Name
                      </th>

                      <th className="px-5 py-4 font-semibold">
                        Domain Family
                      </th>

                      <th className="px-5 py-4 font-semibold">
                        Scope
                      </th>

                      <th className="px-5 py-4 font-semibold">
                        Status
                      </th>

                      {canManageDomains && (
                        <th className="px-5 py-4 font-semibold">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {state.domains.map(
                      (domain) => {
                        const isSystem =
                          domain.organization_id ===
                          null;

                        const isActing =
                          actionDomainKey ===
                          domain.domain_key;

                        return (
                          <tr
                            key={String(
                              domain.id
                            )}
                            className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                          >
                            <td className="px-5 py-5 align-top">
                              <a
                                href={`/domains/${encodeURIComponent(
                                  domain.domain_key
                                )}/documents`}
                                className="block rounded-lg transition hover:bg-blue-50/70 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                              >
                                <div className="font-semibold text-blue-600">
                                  {
                                    domain.domain_key
                                  }
                                </div>

                                {Array.isArray(
                                  domain.aliases
                                ) &&
                                  domain.aliases
                                    .length >
                                    0 && (
                                    <div className="mt-1 text-xs text-slate-500">
                                      Aliases:{" "}
                                      {domain.aliases.join(
                                        ", "
                                      )}
                                    </div>
                                  )}
                              </a>
                            </td>

                            <td className="px-5 py-5 align-top">
                              <div className="font-medium text-slate-900">
                                {
                                  domain.display_name
                                }
                              </div>

                              <div className="mt-1 max-w-md text-xs text-slate-500">
                                {domain.description ||
                                  "—"}
                              </div>
                            </td>

                            <td className="px-5 py-5 align-top">
                              <span className="text-xs text-slate-600">
                                {
                                  domain.domain_family
                                }
                              </span>
                            </td>

                            <td className="px-5 py-5 align-top">
                              <span
                                className={
                                  isSystem
                                    ? "inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700"
                                    : "inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700"
                                }
                              >
                                {isSystem
                                  ? "System"
                                  : "Organization"}
                              </span>
                            </td>

                            <td className="px-5 py-5 align-top">
                              <span
                                className={
                                  domain.is_active
                                    ? "inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                                    : "inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500"
                                }
                              >
                                {domain.is_active
                                  ? "Active"
                                  : "Inactive"}
                              </span>
                            </td>

                            {canManageDomains && (
                              <td className="px-5 py-5 align-top">
                                {isSystem ? (
                                  <span className="text-xs text-slate-400">
                                    System protected
                                  </span>
                                ) : (
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        beginEdit(
                                          domain
                                        )
                                      }
                                      disabled={
                                        saving ||
                                        isActing
                                      }
                                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      Edit
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        void handleToggle(
                                          domain
                                        )
                                      }
                                      disabled={
                                        saving ||
                                        isActing
                                      }
                                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {isActing
                                        ? "Saving..."
                                        : domain.is_active
                                          ? "Disable"
                                          : "Enable"}
                                    </button>
                                  </div>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>

              {state.domains.length ===
                0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
                  <h3 className="text-base font-semibold text-slate-800">
                    No domain definitions
                    found
                  </h3>

                  <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-500">
                    No active domain
                    definitions were returned
                    for this organization.
                  </p>
                </div>
              )}
            </div>
          )}
      </div>

      {(showCreateForm ||
        editingDomainKey !== null) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="domain-form-title"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3
                  id="domain-form-title"
                  className="text-lg font-bold text-slate-950"
                >
                  {editingDomainKey
                    ? "Edit Domain"
                    : "Add Organization Domain"}
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  {editingDomainKey
                    ? "Update the organization-specific domain definition."
                    : "Create an organization domain for a specific document and define its relationship."}
                </p>
              </div>

              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-6 p-6"
            >
              {formError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-700">
                    {formError}
                  </p>
                </div>
              )}

              {isCreateMode && (
                <>
                  <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
                    <p className="text-sm font-bold text-slate-900">
                      1. Select the document
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      Choose the document that this
                      new organization domain will
                      classify. A document must have
                      a metadata record before a
                      domain relationship can be
                      created.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="domain-document"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Document
                    </label>

                    <select
                      id="domain-document"
                      value={
                        selectedDocumentId
                      }
                      onChange={(
                        event
                      ) =>
                        setSelectedDocumentId(
                          event.target.value
                        )
                      }
                      disabled={
                        saving ||
                        loadingDocuments
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                    >
                      <option value="">
                        {loadingDocuments
                          ? "Loading documents..."
                          : "Select a document"}
                      </option>

                      {documents.map(
                        (document) => (
                          <option
                            key={String(
                              document.id
                            )}
                            value={String(
                              document.id
                            )}
                          >
                            {getDocumentLabel(
                              document
                            )}
                            {document.metadata_record_id ===
                            null
                              ? " — no metadata record"
                              : ""}
                          </option>
                        )
                      )}
                    </select>

                    {documentLoadError && (
                      <p className="mt-2 text-xs font-medium text-red-600">
                        {
                          documentLoadError
                        }
                      </p>
                    )}

                    {!loadingDocuments &&
                      !documentLoadError &&
                      documents.length ===
                        0 && (
                        <p className="mt-2 text-xs text-slate-500">
                          No documents are
                          currently available.
                        </p>
                      )}

                    {selectedDocument &&
                      selectedDocument.metadata_record_id ===
                        null && (
                        <p className="mt-2 text-xs font-medium text-amber-700">
                          This document does
                          not have a metadata
                          record yet and
                          cannot receive a
                          domain relationship.
                        </p>
                      )}
                  </div>

                  <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
                    <p className="text-sm font-bold text-slate-900">
                      2. Define the relationship
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      Select how the new
                      organization domain relates
                      to the selected document.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="domain-relationship-type"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Relationship Type
                    </label>

                    <select
                      id="domain-relationship-type"
                      value={
                        selectedRelationshipType
                      }
                      onChange={(
                        event
                      ) =>
                        setSelectedRelationshipType(
                          event.target.value
                        )
                      }
                      disabled={
                        saving ||
                        loadingRelationshipTypes
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                    >
                      <option value="">
                        {loadingRelationshipTypes
                          ? "Loading relationship types..."
                          : "Select a relationship type"}
                      </option>

                      {relationshipTypes.map(
                        (
                          relationshipType
                        ) => (
                          <option
                            key={
                              relationshipType
                            }
                            value={
                              relationshipType
                            }
                          >
                            {
                              relationshipType
                            }
                          </option>
                        )
                      )}
                    </select>

                    {relationshipTypeLoadError && (
                      <p className="mt-2 text-xs font-medium text-red-600">
                        {
                          relationshipTypeLoadError
                        }
                      </p>
                    )}

                    <p className="mt-1 text-xs text-slate-500">
                      The relationship catalogue is
                      supplied by the canonical
                      domain-relationship API.
                    </p>
                  </div>
                </>
              )}

              <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4">
                <p className="text-sm font-bold text-slate-900">
                  {isCreateMode
                    ? "3. Define the organization domain"
                    : "Domain definition"}
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-600">
                  {isCreateMode
                    ? "The domain will be private to this organization."
                    : "Update the organization-specific domain definition."}
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="domain-key"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Domain Key
                  </label>

                  <input
                    id="domain-key"
                    value={
                      form.domain_key
                    }
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          domain_key:
                            event.target
                              .value,
                        })
                      )
                    }
                    disabled={
                      saving ||
                      editingDomainKey !==
                        null
                    }
                    placeholder="e.g. Aviation Safety"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                  />

                  {!editingDomainKey && (
                    <p className="mt-1 text-xs text-slate-500">
                      Spaces are accepted and
                      normalized when the domain
                      is created. For example,
                      "Aviation Safety" becomes
                      "aviation_safety".
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="domain-display-name"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Display Name
                  </label>

                  <input
                    id="domain-display-name"
                    value={
                      form.display_name
                    }
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          display_name:
                            event.target
                              .value,
                        })
                      )
                    }
                    disabled={saving}
                    placeholder="e.g. Aviation Safety"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="domain-family"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Domain Family
                  </label>

                  <select
                    id="domain-family"
                    value={
                      form.domain_family
                    }
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          domain_family:
                            event.target
                              .value,
                        })
                      )
                    }
                    disabled={saving}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
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
                    htmlFor="domain-aliases"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Aliases
                  </label>

                  <input
                    id="domain-aliases"
                    value={
                      form.aliases
                    }
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          aliases:
                            event.target
                              .value,
                        })
                      )
                    }
                    disabled={saving}
                    placeholder="e.g. aviation, flight safety"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                  />

                  <p className="mt-1 text-xs text-slate-500">
                    Separate multiple aliases
                    with commas.
                  </p>
                </div>
              </div>

              <div>
                <label
                  htmlFor="domain-description"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Description
                </label>

                <textarea
                  id="domain-description"
                  value={
                    form.description
                  }
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        description:
                          event.target
                            .value,
                      })
                    )
                  }
                  disabled={saving}
                  rows={4}
                  placeholder="Describe what this domain represents."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                />
              </div>

              {isCreateMode &&
                selectedDocument && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Creation summary
                    </p>

                    <div className="mt-3 space-y-2 text-sm">
                      <div>
                        <span className="font-semibold text-slate-700">
                          Document:
                        </span>{" "}
                        <span className="text-slate-600">
                          {getDocumentLabel(
                            selectedDocument
                          )}
                        </span>
                      </div>

                      <div>
                        <span className="font-semibold text-slate-700">
                          Relationship:
                        </span>{" "}
                        <span className="text-slate-600">
                          {selectedRelationshipType ||
                            "Not selected"}
                        </span>
                      </div>

                      <div>
                        <span className="font-semibold text-slate-700">
                          Domain:
                        </span>{" "}
                        <span className="text-slate-600">
                          {form.display_name.trim() ||
                            "Not yet named"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    saving ||
                    (
                      isCreateMode &&
                      (
                        selectedDocumentId ===
                          "" ||
                        selectedRelationshipType ===
                          ""
                      )
                    )
                  }
                  className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingDomainKey
                      ? "Save Changes"
                      : "Create & Add to Document"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
