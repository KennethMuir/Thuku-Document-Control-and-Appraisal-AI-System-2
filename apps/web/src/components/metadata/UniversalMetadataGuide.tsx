"use client";

import React, { useEffect, useMemo, useState } from "react";

import { useFieldRegistry } from "@/hooks/useFieldRegistry";
import { UNIVERSAL_METADATA_CATALOGUE } from "@/lib/metadata/universalMetadataCatalogue";

type UniversalMetadataGuideProps = {
  onClose: () => void;
};

const catalogueGroups = UNIVERSAL_METADATA_CATALOGUE;

export function UniversalMetadataGuide({
  onClose,
}: UniversalMetadataGuideProps) {
  const { fieldDefinitions } = useFieldRegistry();

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set()
  );

  const [searchTerm, setSearchTerm] = useState("");

  const resolvedGroups = useMemo(() => {
    return catalogueGroups.map((group) => {
      const fields = group.fieldKeys
        .map((fieldKey) =>
          fieldDefinitions.find(
            (field) => field.field_key === fieldKey
          )
        )
        .filter(
          (field): field is NonNullable<typeof field> =>
            Boolean(field)
        );

      return {
        ...group,
        fields,
      };
    });
  }, [fieldDefinitions]);

  const filteredGroups = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    if (!query) {
      return resolvedGroups;
    }

    return resolvedGroups
      .map((group) => {
        const groupMatches =
          group.label.toLowerCase().includes(query) ||
          group.description.toLowerCase().includes(query);

        const catalogueFieldMatches = group.fieldKeys.filter((fieldKey) =>
          fieldKey.toLowerCase().includes(query)
        );

        const registeredFieldMatches = group.fields.filter((field) => {
          const searchableText = [
            field.field_key,
            field.display_name,
            field.description,
            field.category,
            field.data_type,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return searchableText.includes(query);
        });

        const matchingFieldKeys = new Set([
          ...catalogueFieldMatches,
          ...registeredFieldMatches.map(
            (field) => field.field_key
          ),
        ]);

        const fields = group.fields.filter((field) =>
          matchingFieldKeys.has(field.field_key)
        );

        return {
          ...group,
          fields: groupMatches ? group.fields : fields,
          searchMatched:
            groupMatches ||
            catalogueFieldMatches.length > 0 ||
            registeredFieldMatches.length > 0,
        };
      })
      .filter((group) => group.searchMatched);
  }, [resolvedGroups, searchTerm]);

  useEffect(() => {
    const query = searchTerm.trim();

    if (!query) {
      return;
    }

    setExpandedGroups(
      new Set(
        filteredGroups.map((group) => group.key)
      )
    );
  }, [filteredGroups, searchTerm]);

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((current) => {
      const next = new Set(current);

      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }

      return next;
    });
  };

  const expandAll = () => {
    setExpandedGroups(
      new Set(
        filteredGroups.map((group) => group.key)
      )
    );
  };

  const collapseAll = () => {
    setExpandedGroups(new Set());
  };

  const catalogueFieldCount = useMemo(() => {
    return new Set(
      catalogueGroups.flatMap(
        (group) => group.fieldKeys
      )
    ).size;
  }, []);

  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Universal metadata
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-950">
              Catalogue contents
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Browse the universal metadata field catalogue. Fields are
              grouped by business and records-management context and remain
              backed by the global field registry.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Close Guide
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-2xl font-bold text-slate-950">
              {catalogueGroups.length}
            </p>

            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Groups
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-2xl font-bold text-slate-950">
              {catalogueFieldCount}
            </p>

            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Unique fields
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-2xl font-bold text-slate-950">
              Universal
            </p>

            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Catalogue
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={expandAll}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Expand All
            </button>

            <button
              type="button"
              onClick={collapseAll}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Collapse All
            </button>
          </div>

          <div className="w-full lg:max-w-md">
            <label
              htmlFor="universal-metadata-catalogue-search"
              className="sr-only"
            >
              Search catalogue
            </label>

            <input
              id="universal-metadata-catalogue-search"
              type="search"
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(event.target.value)
              }
              placeholder="Search catalogue"
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>
      </div>

      <div className="divide-y divide-slate-200">
        {filteredGroups.map((group) => {
          const expanded = expandedGroups.has(group.key);

          return (
            <div key={group.key}>
              <button
                type="button"
                onClick={() => toggleGroup(group.key)}
                aria-expanded={expanded}
                className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-900">
                      {group.label}
                    </h3>

                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      {group.fieldKeys.length} fields
                    </span>
                  </div>

                  {group.description && (
                    <p className="mt-1 text-sm text-slate-500">
                      {group.description}
                    </p>
                  )}
                </div>

                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 text-lg font-semibold text-slate-500"
                >
                  {expanded ? "−" : "+"}
                </span>
              </button>

              {expanded && (
                <div className="border-t border-slate-100 bg-slate-50 px-6 py-4">
                  {group.fields.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No registered field details are currently available
                      for the matching catalogue fields.
                    </p>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {group.fields.map((field) => (
                        <div
                          key={`${group.key}-${field.field_key}`}
                          className="rounded-xl border border-slate-200 bg-white p-4"
                        >
                          <p className="font-semibold text-blue-700">
                            {field.field_key}
                          </p>

                          <p className="mt-1 text-sm font-medium text-slate-900">
                            {field.display_name}
                          </p>

                          {field.description && (
                            <p className="mt-2 text-xs leading-5 text-slate-500">
                              {field.description}
                            </p>
                          )}

                          <div className="mt-3 flex flex-wrap gap-2">
                            {field.category && (
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                                {field.category}
                              </span>
                            )}

                            {field.data_type && (
                              <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700">
                                {field.data_type}
                              </span>
                            )}

                            {field.repeatable && (
                              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
                                Repeatable
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredGroups.length === 0 && (
        <div className="px-6 py-10 text-center">
          <p className="text-sm font-semibold text-slate-700">
            No catalogue groups found.
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Try a different search term.
          </p>
        </div>
      )}

      <div className="border-t border-slate-200 bg-slate-50 px-6 py-5">
        <p className="text-sm leading-6 text-slate-500">
          The catalogue is a navigation and governance layer over the
          universal field registry. It does not create separate metadata
          tables. Actual metadata values remain stored through the
          universal metadata value architecture.
        </p>
      </div>
    </section>
  );
}
