"use client";

import React from "react";

import {
  createDomainDefinition,
  disableDomainDefinition,
  enableDomainDefinition,
  getDomainRegistry,
  updateDomainDefinition,
} from "@/lib/api/domainRegistry";

type DomainDefinition = {
  id: string;
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

type DomainRegistryProps = {
  canManageDomains: boolean;
};

type DomainRegistryState = {
  domains: DomainDefinition[];
  loading: boolean;
  error: string | null;
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
  ] = React.useState({
    domain_key: "",
    display_name: "",
    description: "",
    domain_family: "",
    aliases: "",
  });

  const loadDomains =
    React.useCallback(
      async (): Promise<void> => {
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

          const domains =
            typeof data === "object" &&
            data !== null &&
            "domain_registry" in data &&
            Array.isArray(
              (
                data as {
                  domain_registry?: unknown;
                }
              ).domain_registry
            )
              ? (
                  data as {
                    domain_registry: unknown[];
                  }
                ).domain_registry
              : [];

          setState({
            domains:
              domains as DomainDefinition[],
            loading: false,
            error: null,
          });
        } catch (error: unknown) {
          setState({
            domains: [],
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : "Unable to retrieve domain definitions.",
          });
        }
      },
      []
    );

  React.useEffect(() => {
    void loadDomains();
  }, [loadDomains]);

  const resetForm = () => {
    setForm({
      domain_key: "",
      display_name: "",
      description: "",
      domain_family: "",
      aliases: "",
    });

    setFormError(null);
    setEditingDomainKey(null);
    setShowCreateForm(false);
  };

  const beginCreate = () => {
    if (!canManageDomains) {
      return;
    }

    setForm({
      domain_key: "",
      display_name: "",
      description: "",
      domain_family: "",
      aliases: "",
    });

    setFormError(null);
    setEditingDomainKey(null);
    setShowCreateForm(true);
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
      domain_key: domain.domain_key,
      display_name: domain.display_name,
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

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();

    if (!canManageDomains) {
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const aliases = form.aliases
        .split(",")
        .map((alias) => alias.trim())
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
      } else {
        if (
          !form.domain_key.trim() ||
          !form.display_name.trim() ||
          !form.domain_family
        ) {
          setFormError(
            "Domain key, display name, and domain family are required."
          );
          setSaving(false);
          return;
        }

        const response =
          await createDomainDefinition({
            domain_key:
              form.domain_key.trim(),
            display_name:
              form.display_name.trim(),
            description:
              form.description.trim(),
            domain_family:
              form.domain_family,
            aliases,
          });

        await readResponse(
          response,
          "Unable to create the domain definition."
        );
      }

      resetForm();
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
              Manage the domains available for document
              classification and multi-domain relationships.
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
                Unable to load the domain registry.
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
                    Create and manage private domain classifications for this organization. System domains are protected.
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
                          domain.organization_id === null;

                        const isActing =
                          actionDomainKey ===
                          domain.domain_key;

                        return (
                          <tr
                            key={domain.id}
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
                                  {domain.domain_key}
                                </div>

                                {domain.aliases.length >
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
                                {domain.display_name}
                              </div>

                              <div className="mt-1 max-w-md text-xs text-slate-500">
                                {domain.description ||
                                  "—"}
                              </div>
                            </td>

                            <td className="px-5 py-5 align-top">
                              <span className="text-xs text-slate-600">
                                {domain.domain_family}
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

              {state.domains.length === 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
                  <h3 className="text-base font-semibold text-slate-800">
                    No domain definitions found
                    </h3>

                  <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-500">
                    No active domain definitions were returned
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
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
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
                  : "Create a domain definition available to this organization."}
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
              className="space-y-5 p-6"
          >
            {formError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-700">
                  {formError}
                </p>
              </div>
            )}

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
                  value={form.domain_key}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      domain_key:
                        event.target.value,
                    }))
                  }
                  disabled={
                    saving ||
                    editingDomainKey !== null
                  }
                  placeholder="e.g. aviation_safety"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                />

                {!editingDomainKey && (
                  <p className="mt-1 text-xs text-slate-500">
                    Use lowercase letters, numbers, and underscores.
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
                  value={form.display_name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      display_name:
                        event.target.value,
                    }))
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
                  value={form.domain_family}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      domain_family:
                        event.target.value,
                    }))
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
                  value={form.aliases}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      aliases:
                        event.target.value,
                    }))
                  }
                  disabled={saving}
                  placeholder="e.g. aviation, flight safety"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                />

                <p className="mt-1 text-xs text-slate-500">
                  Separate multiple aliases with commas.
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
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description:
                      event.target.value,
                  }))
                }
                disabled={saving}
                rows={4}
                placeholder="Describe what this domain represents."
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
              />
            </div>

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
                disabled={saving}
                className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingDomainKey
                    ? "Save Changes"
                    : "Create Domain"}
              </button>
            </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

