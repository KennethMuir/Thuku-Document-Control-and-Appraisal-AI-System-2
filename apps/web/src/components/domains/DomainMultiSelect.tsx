"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import type {
  DomainRelationshipDomain,
} from "@/components/metadata/DomainRelationshipSelector";

type DomainMultiSelectProps = {
  domains: DomainRelationshipDomain[];
  selectedDomainIds: number[];
  onChange: (domainIds: number[]) => void;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
  title?: string;
  description?: string;
};

export function DomainMultiSelect({
  domains,
  selectedDomainIds,
  onChange,
  disabled = false,
  loading = false,
  error = "",
  title = "Domain Registry",
  description = "Select one or more domains for universal document classification.",
}: DomainMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;

      if (
        target instanceof Node &&
        containerRef.current?.contains(target)
      ) {
        return;
      }

      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const normalizedSelectedIds = useMemo(
    () =>
      Array.from(
        new Set(
          selectedDomainIds
            .map((id) => Number(id))
            .filter(
              (id) =>
                Number.isInteger(id) &&
                id > 0
            )
        )
      ),
    [selectedDomainIds]
  );

  const selectedSet = useMemo(
    () => new Set(normalizedSelectedIds),
    [normalizedSelectedIds]
  );

  const filteredDomains = useMemo(() => {
    const query = search.trim().toLowerCase();

    const activeDomains = domains.filter(
      (domain) =>
        Number.isInteger(Number(domain.id)) &&
        Number(domain.id) > 0
    );

    if (!query) {
      return activeDomains;
    }

    return activeDomains.filter((domain) =>
      [
        domain.display_name,
        domain.domain_key,
        domain.description ?? "",
        domain.domain_family ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [domains, search]);

  const selectedDomains = useMemo(
    () =>
      normalizedSelectedIds
        .map((id) =>
          domains.find(
            (domain) =>
              Number(domain.id) === id
          )
        )
        .filter(
          (
            domain
          ): domain is DomainRelationshipDomain =>
            Boolean(domain)
        ),
    [domains, normalizedSelectedIds]
  );

  const toggleDomain = (domainId: number) => {
    if (disabled) {
      return;
    }

    if (selectedSet.has(domainId)) {
      onChange(
        normalizedSelectedIds.filter(
          (id) => id !== domainId
        )
      );

      return;
    }

    onChange([
      ...normalizedSelectedIds,
      domainId,
    ]);
  };

  const removeDomain = (domainId: number) => {
    if (disabled) {
      return;
    }

    onChange(
      normalizedSelectedIds.filter(
        (id) => id !== domainId
      )
    );
  };

  return (
    <section
      ref={containerRef}
      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
    >
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900">
          {title}
        </h3>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          {description}
        </p>
      </div>

      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-12 w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-sm outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {selectedDomains.length === 0 ? (
              <span className="py-1 text-slate-400">
                Select domains...
              </span>
            ) : (
              selectedDomains.map((domain) => (
                <span
                  key={domain.id}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  {domain.display_name}

                  <span
                    role="button"
                    tabIndex={disabled ? -1 : 0}
                    aria-label={`Remove ${domain.display_name}`}
                    className="cursor-pointer rounded-full px-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeDomain(Number(domain.id));
                    }}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" ||
                        event.key === " "
                      ) {
                        event.preventDefault();
                        event.stopPropagation();
                        removeDomain(Number(domain.id));
                      }
                    }}
                  >
                    ×
                  </span>
                </span>
              ))
            )}
          </span>

          <span className="ml-3 shrink-0 text-slate-500">
            {open ? "▲" : "▼"}
          </span>
        </button>

        {open && !disabled && (
          <div
            className="absolute left-0 right-0 z-40 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
            role="listbox"
            aria-multiselectable="true"
          >
            <div className="border-b border-slate-200 p-3">
              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search domains..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                autoFocus
              />
            </div>

            <div className="max-h-64 overflow-y-auto p-2">
              {loading ? (
                <p className="px-3 py-4 text-sm text-slate-500">
                  Loading domains...
                </p>
              ) : error ? (
                <p className="px-3 py-4 text-sm text-red-600">
                  {error}
                </p>
              ) : filteredDomains.length === 0 ? (
                <p className="px-3 py-4 text-sm text-slate-500">
                  No matching domains found.
                </p>
              ) : (
                filteredDomains.map((domain) => {
                  const domainId = Number(domain.id);
                  const selected = selectedSet.has(domainId);

                  return (
                    <button
                      key={domainId}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => toggleDomain(domainId)}
                      className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-slate-50"
                    >
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
                          selected
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-300 bg-white text-transparent"
                        }`}
                      >
                        ✓
                      </span>

                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-800">
                          {domain.display_name}
                        </span>

                        <span className="mt-0.5 block text-xs text-slate-500">
                          {domain.domain_family || domain.domain_key}
                        </span>

                        {domain.description ? (
                          <span className="mt-1 block text-xs leading-5 text-slate-400">
                            {domain.description}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2 text-xs text-slate-500">
              <span>
                {normalizedSelectedIds.length} selected
              </span>

              {normalizedSelectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="font-medium text-slate-700 hover:text-slate-950"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
