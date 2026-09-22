"use client";

import { useMemo, useState } from "react";

import {
  getUniversalMetadataGroup,
  UNIVERSAL_METADATA_CATALOGUE,
} from "@/lib/metadata/universalMetadataCatalogue";

import {
  type FieldDefinition,
} from "@/hooks/useFieldRegistry";

type UniversalMetadataCatalogueProps = {
  fields: FieldDefinition[];
};

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function UniversalMetadataCatalogue({
  fields,
}: UniversalMetadataCatalogueProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(UNIVERSAL_METADATA_CATALOGUE.map((group) => group.key)),
  );

  const [searchTerm, setSearchTerm] = useState("");

  const groupedFields = useMemo(() => {
    const groups = new Map(
      UNIVERSAL_METADATA_CATALOGUE.map((group) => [
        group.key,
        {
          ...group,
          fields: [] as FieldDefinition[],
        },
      ]),
    );

    for (const field of fields) {
      const group = getUniversalMetadataGroup(
        field.field_key,
        field.category,
      );

      groups.get(group.key)?.fields.push(field);
    }

    return UNIVERSAL_METADATA_CATALOGUE
      .map((group) => groups.get(group.key))
      .filter(
        (
          group,
        ): group is UniversalMetadataCatalogueProps extends never
          ? never
          : {
              key: string;
              label: string;
              description: string;
              fieldKeys: string[];
              fields: FieldDefinition[];
            } => Boolean(group),
      );
  }, [fields]);

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const visibleGroups = groupedFields
    .map((group) => ({
      ...group,
      fields: normalizedSearch
        ? group.fields.filter((field) => {
            const haystack = [
              field.field_key,
              field.display_name,
              field.description ?? "",
              field.category,
            ]
              .join(" ")
              .toLowerCase();

            return haystack.includes(normalizedSearch);
          })
        : group.fields,
    }))
    .filter((group) => group.fields.length > 0);

  function toggleGroup(groupKey: string) {
    setExpandedGroups((current) => {
      const next = new Set(current);

      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }

      return next;
    });
  }

  function expandAll() {
    setExpandedGroups(
      new Set(UNIVERSAL_METADATA_CATALOGUE.map((group) => group.key)),
    );
  }

  function collapseAll() {
    setExpandedGroups(new Set());
  }

  const totalFields = fields.length;

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
              Universal Metadata
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-900">
              Universal Metadata Catalogue
            </h2>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              Browse the universal metadata field registry by business
              category. Fields remain globally defined and can be enabled,
              required, and ordered through the organization profile.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
              {totalFields} fields
            </span>

            <button
              type="button"
              onClick={expandAll}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Expand all
            </button>

            <button
              type="button"
              onClick={collapseAll}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Collapse all
            </button>
          </div>
        </div>

        <div className="mt-4">
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search universal metadata fields..."
            aria-label="Search universal metadata fields"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-blue-400"
          />
        </div>
      </div>

      <div className="divide-y divide-slate-200">
        {visibleGroups.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-medium text-slate-700">
              No metadata fields found.
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Try a different field name, category, or keyword.
            </p>
          </div>
        ) : (
          visibleGroups.map((group) => {
            const expanded = expandedGroups.has(group.key);

            return (
              <div key={group.key}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  aria-expanded={expanded}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-sm font-bold text-blue-700">
                        {expanded ? "−" : "+"}
                      </span>

                      <h3 className="text-base font-bold text-slate-900">
                        {group.label}
                      </h3>

                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        {group.fields.length}
                      </span>
                    </div>

                    <p className="ml-11 mt-1 text-sm text-slate-500">
                      {group.description}
                    </p>
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {group.fields.map((field) => (
                        <div
                          key={field.id}
                          className="rounded-xl border border-slate-200 bg-white p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900">
                                {field.display_name}
                              </p>

                              <p className="mt-1 break-all font-mono text-[11px] text-slate-400">
                                {field.field_key}
                              </p>
                            </div>

                            <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                              {field.data_type}
                            </span>
                          </div>

                          {field.description && (
                            <p className="mt-3 text-xs leading-5 text-slate-500">
                              {field.description}
                            </p>
                          )}

                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {field.ai_extractable && (
                              <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700">
                                AI extractable
                              </span>
                            )}

                            {field.searchable && (
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                                Searchable
                              </span>
                            )}

                            {field.filterable && (
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                                Filterable
                              </span>
                            )}

                            {field.repeatable && (
                              <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">
                                Repeatable
                              </span>
                            )}

                            {field.sensitive && (
                              <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-700">
                                Sensitive
                              </span>
                            )}
                          </div>

                          {formatFieldValue(field.default_value) && (
                            <p className="mt-3 text-xs text-slate-400">
                              Default: {formatFieldValue(field.default_value)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">
        <p className="text-xs leading-5 text-slate-500">
          The catalogue groups fields for navigation and governance. It does
          not create separate metadata tables. Actual metadata values remain
          stored through the universal metadata value architecture.
        </p>
      </div>
    </section>
  );
}

