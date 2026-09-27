"use client";

import { useEffect, useMemo, useState } from "react";

import { getApplicableRelationshipTypes } from "@/lib/domainRelationshipApplicability";

export type DomainRelationshipSelection = {
  domainId: number;
  relationshipType: string;
};

export type DomainRelationshipDomain = {
  id: number;
  domain_key: string;
  display_name: string;
  description?: string | null;
  domain_family?: string | null;
  domain_scope?: string | null;
  specialization_id?: number | null;
  specialization_name?: string | null;
};

export type DomainRelationshipType = {
  value: string;
  label?: string;
};

type Props = {
  domains: DomainRelationshipDomain[];
  relationshipTypes: DomainRelationshipType[];
  selected: DomainRelationshipSelection[];
  onChange: (value: DomainRelationshipSelection[]) => void;
  onDomainSelectionChange?: (domainIds: number[]) => void;
  disabled?: boolean;
  title?: string;
  description?: string;
};

export function DomainRelationshipSelector({
  domains,
  relationshipTypes,
  selected,
  onChange,
  onDomainSelectionChange,
  disabled = false,
  title = "Domain & Relationships",
  description = "Select the domains that apply to this metadata record, then select the relationships that apply to each selected domain.",
}: Props) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const [selectedDomainIds, setSelectedDomainIds] =
    useState<Set<number>>(
      () =>
        new Set(
          selected.map(
            (relationship) => relationship.domainId
          )
        )
    );

  /*
   * The persisted relationship array does not represent a selected
   * domain with zero relationships. Therefore selectedDomainIds is
   * intentionally maintained as independent UI state.
   *
   * When the parent supplies relationship selections, make sure their
   * domains are represented as selected. Do not remove domains merely
   * because they currently have zero relationships.
   */
  useEffect(() => {
    setSelectedDomainIds((current) => {
      const next = new Set(current);

      for (const relationship of selected) {
        next.add(relationship.domainId);
      }

      return next;
    });
  }, [selected]);

  const filteredDomains = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return domains;
    }

    return domains.filter((domain) => {
      return (
        domain.display_name
          .toLowerCase()
          .includes(query) ||
        domain.domain_key
          .toLowerCase()
          .includes(query) ||
        (domain.domain_family ?? "")
          .toLowerCase()
          .includes(query) ||
        (domain.specialization_name ?? "")
          .toLowerCase()
          .includes(query)
      );
    });
  }, [domains, search]);

  const selectedRelationshipsByDomain = useMemo(() => {
    const map = new Map<number, Set<string>>();

    for (const relationship of selected) {
      const existing = map.get(relationship.domainId);

      if (existing) {
        existing.add(relationship.relationshipType);
      } else {
        map.set(
          relationship.domainId,
          new Set([relationship.relationshipType])
        );
      }
    }

    return map;
  }, [selected]);

  const toggleDomain = (domainId: number) => {
    if (disabled) {
      return;
    }

    const next = new Set(selectedDomainIds);

    if (next.has(domainId)) {
      next.delete(domainId);

      onChange(
        selected.filter(
          (relationship) =>
            relationship.domainId !== domainId
        )
      );
    } else {
      next.add(domainId);
    }

    setSelectedDomainIds(next);
    onDomainSelectionChange?.(Array.from(next));
  };

  const toggleRelationship = (
    domainId: number,
    relationshipType: string
  ) => {
    if (disabled || !selectedDomainIds.has(domainId)) {
      return;
    }

    const currentRelationships =
      selectedRelationshipsByDomain.get(domainId) ??
      new Set<string>();

    if (currentRelationships.has(relationshipType)) {
      onChange(
        selected.filter(
          (relationship) =>
            !(
              relationship.domainId === domainId &&
              relationship.relationshipType ===
                relationshipType
            )
        )
      );

      return;
    }

    onChange([
      ...selected,
      {
        domainId,
        relationshipType,
      },
    ]);
  };

  const getScopeLabel = (
    domain: DomainRelationshipDomain
  ) => {
    if (domain.domain_scope === "SPECIALIZED") {
      return domain.specialization_name
        ? `Specialized · ${domain.specialization_name}`
        : "Specialized";
    }

    if (domain.domain_scope === "ORGANIZATION") {
      return "Organization";
    }

    return "Universal";
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        disabled={disabled}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 p-4 text-left disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="min-w-0">
          <span className="block text-base font-semibold text-slate-900">
            {title}
          </span>

          <span className="mt-1 block text-sm text-slate-500">
            {selectedDomainIds.size === 0
              ? "Select domains..."
              : `${selectedDomainIds.size} domain${
                  selectedDomainIds.size === 1 ? "" : "s"
                } selected · ${selected.length} relationship${
                  selected.length === 1 ? "" : "s"
                } selected`}
          </span>
        </span>

        <span
          aria-hidden="true"
          className={`shrink-0 text-slate-500 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        >
          ▼
        </span>
      </button>

      {isOpen ? (
        <div className="border-t border-slate-200 p-4">
          <p className="mb-4 text-sm text-slate-500">
            {description}
          </p>

          <div className="mb-4">
            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              disabled={disabled}
              placeholder="Search domains..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
            />
          </div>

          {domains.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
              No domains are currently available.
            </div>
          ) : filteredDomains.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
              No matching domains found.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDomains.map((domain) => {
                const domainSelected =
                  selectedDomainIds.has(domain.id);

                const domainRelationships =
                  selectedRelationshipsByDomain.get(
                    domain.id
                  ) ?? new Set<string>();

                const applicableRelationshipTypes =
                  getApplicableRelationshipTypes(
                    domain,
                    relationshipTypes
                  );

                return (
                  <div
                    key={domain.id}
                    className={`rounded-xl border transition ${
                      domainSelected
                        ? "border-slate-400 bg-slate-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <label
                      className={`flex items-start gap-3 p-4 ${
                        disabled
                          ? "cursor-not-allowed opacity-60"
                          : "cursor-pointer"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={domainSelected}
                        onChange={() =>
                          toggleDomain(domain.id)
                        }
                        disabled={disabled}
                        className="mt-1 h-4 w-4 rounded border-slate-300"
                      />

                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-slate-900">
                            {domain.display_name}
                          </span>

                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                            {getScopeLabel(domain)}
                          </span>
                        </span>

                        {domain.domain_family ? (
                          <span className="mt-1 block text-xs text-slate-500">
                            {domain.domain_family}
                          </span>
                        ) : null}

                        {domain.description ? (
                          <span className="mt-1 block text-sm text-slate-600">
                            {domain.description}
                          </span>
                        ) : null}
                      </span>

                      {domainSelected ? (
                        <span className="text-xs text-slate-500">
                          {domainRelationships.size} selected
                        </span>
                      ) : null}
                    </label>

                    {domainSelected ? (
                      <div className="border-t border-slate-200 px-4 pb-4 pt-3">
                        <p className="mb-3 text-sm font-medium text-slate-700">
                          Relationships for {domain.display_name}
                        </p>

                        {applicableRelationshipTypes.length === 0 ? (
                          <p className="text-sm text-slate-500">
                            No relationship types are currently configured for this domain.
                          </p>
                        ) : (
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {applicableRelationshipTypes.map(
                              (relationshipType) => {
                                const checked =
                                  domainRelationships.has(
                                    relationshipType.value
                                  );

                                return (
                                  <label
                                    key={relationshipType.value}
                                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                                      disabled
                                        ? "cursor-not-allowed opacity-60"
                                        : "cursor-pointer"
                                    } ${
                                      checked
                                        ? "border-slate-400 bg-white"
                                        : "border-slate-200 bg-slate-50"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() =>
                                        toggleRelationship(
                                          domain.id,
                                          relationshipType.value
                                        )
                                      }
                                      disabled={disabled}
                                      className="h-4 w-4 rounded border-slate-300"
                                    />

                                    <span className="text-slate-700">
                                      {relationshipType.label ??
                                        relationshipType.value}
                                    </span>
                                  </label>
                                );
                              }
                            )}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {selectedDomainIds.size} domain
            {selectedDomainIds.size === 1 ? "" : "s"} selected ·{" "}
            {selected.length} relationship
            {selected.length === 1 ? "" : "s"} selected
          </div>
        </div>
      ) : null}
    </section>
  );
}



