"use client";

import { useMemo, useState } from "react";

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
  disabled?: boolean;
  title?: string;
  description?: string;
};

export function DomainRelationshipSelector({
  domains,
  relationshipTypes,
  selected,
  onChange,
  disabled = false,
  title = "Domain Relationships",
  description = "Select the domains this metadata record belongs to and assign the appropriate relationship type.",
}: Props) {
  const [search, setSearch] = useState("");

  const filteredDomains = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return domains;
    }

    return domains.filter((domain) => {
      return (
        domain.display_name.toLowerCase().includes(query) ||
        domain.domain_key.toLowerCase().includes(query) ||
        String(domain.description ?? "")
          .toLowerCase()
          .includes(query) ||
        String(domain.domain_family ?? "")
          .toLowerCase()
          .includes(query)
      );
    });
  }, [domains, search]);

  const selectedByDomain = useMemo(() => {
    const map = new Map<number, DomainRelationshipSelection>();

    for (const item of selected) {
      map.set(item.domainId, item);
    }

    return map;
  }, [selected]);

  const toggleDomain = (domainId: number) => {
    if (disabled) {
      return;
    }

    const existing = selectedByDomain.get(domainId);

    if (existing) {
      onChange(selected.filter((item) => item.domainId !== domainId));
      return;
    }

    const defaultRelationshipType =
      relationshipTypes[0]?.value ?? "SUBJECT";

    onChange([
      ...selected,
      {
        domainId,
        relationshipType: defaultRelationshipType,
      },
    ]);
  };

  const changeRelationshipType = (
    domainId: number,
    relationshipType: string
  ) => {
    if (disabled) {
      return;
    }

    onChange(
      selected.map((item) =>
        item.domainId === domainId
          ? {
              ...item,
              relationshipType,
            }
          : item
      )
    );
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          {description}
        </p>
      </div>

      <div className="mb-4">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          disabled={disabled}
          placeholder="Search domains..."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
        />
      </div>

      {selected.length > 0 && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Selected domains
          </div>

          <div className="space-y-2">
            {selected.map((item) => {
              const domain = domains.find(
                (candidate) => candidate.id === item.domainId
              );

              if (!domain) {
                return null;
              }

              return (
                <div
                  key={item.domainId}
                  className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="text-sm font-medium text-slate-800">
                    {domain.display_name}
                  </span>

                  <select
                    value={item.relationshipType}
                    onChange={(event) =>
                      changeRelationshipType(
                        item.domainId,
                        event.target.value
                      )
                    }
                    disabled={disabled}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                  >
                    {relationshipTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label ?? type.value}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
        {filteredDomains.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
            No matching domains found.
          </p>
        ) : (
          filteredDomains.map((domain) => {
            const isSelected = selectedByDomain.has(domain.id);

            return (
              <label
                key={domain.id}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                  isSelected
                    ? "border-slate-400 bg-slate-50"
                    : "border-transparent hover:border-slate-200 hover:bg-slate-50"
                } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleDomain(domain.id)}
                  disabled={disabled}
                  className="mt-1 h-4 w-4"
                />

                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-800">
                    {domain.display_name}
                  </span>

                  <span className="block text-xs text-slate-500">
                    {domain.domain_key}
                    {domain.domain_family
                      ? ` · ${domain.domain_family}`
                      : ""}
                  </span>

                  {domain.description && (
                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      {domain.description}
                    </span>
                  )}
                </span>
              </label>
            );
          })
        )}
      </div>
    </section>
  );
}
