"use client";

import React, { useMemo, useState } from "react";

import { useFieldRegistry } from "@/hooks/useFieldRegistry";

type FieldRegistryGuideProps = {
  onClose: () => void;
};

export function FieldRegistryGuide({
  onClose,
}: FieldRegistryGuideProps) {
  const {
    fieldDefinitions,
    loading,
    error,
  } = useFieldRegistry();

  const [searchTerm, setSearchTerm] =
    useState("");

  const filteredFields = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    if (!query) {
      return fieldDefinitions;
    }

    return fieldDefinitions.filter((field) =>
      [
        field.field_key,
        field.display_name,
        field.description,
        field.category,
        field.data_type,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value)
            .toLowerCase()
            .includes(query)
        )
    );
  }, [fieldDefinitions, searchTerm]);

  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
      <div className="border-b border-emerald-100 bg-emerald-50 px-6 py-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
              Organization metadata
            </p>

            <h2 className="mt-1 text-2xl font-bold text-slate-950">
              Field Registry
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              View the active metadata field definitions available to this
              organization. The registry shown here is loaded directly from
              the organization field registry.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Close Guide
          </button>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-2xl font-bold text-slate-950">
              {fieldDefinitions.length}
            </div>

            <div className="mt-1 text-sm text-slate-500">
              Active fields
            </div>
          </div>

          <input
            type="search"
            value={searchTerm}
            onChange={(event) =>
              setSearchTerm(event.target.value)
            }
            placeholder="Search field registry"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        {loading && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-sm font-medium text-slate-600">
              Loading field registry...
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6">
            <p className="text-sm font-semibold text-red-700">
              Unable to load the field registry.
            </p>

            <p className="mt-1 text-sm text-red-600">
              {error}
            </p>
          </div>
        )}

        {!loading &&
          !error &&
          filteredFields.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
              <p className="text-sm font-medium text-slate-600">
                {fieldDefinitions.length === 0
                  ? "No field definitions were returned for this organization."
                  : "No fields match the current search."}
              </p>
            </div>
          )}

        {!loading &&
          !error &&
          filteredFields.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[1250px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-5 py-4 font-semibold">
                      Field Key
                    </th>

                    <th className="px-5 py-4 font-semibold">
                      Display Name
                    </th>

                    <th className="px-5 py-4 font-semibold">
                      Category
                    </th>

                    <th className="px-5 py-4 font-semibold">
                      Data Type
                    </th>

                    <th className="px-5 py-4 font-semibold">
                      Repeatable
                    </th>

                    <th className="px-5 py-4 font-semibold">
                      Searchable
                    </th>

                    <th className="px-5 py-4 font-semibold">
                      Filterable
                    </th>

                    <th className="px-5 py-4 font-semibold">
                      Sortable
                    </th>

                    <th className="px-5 py-4 font-semibold">
                      AI Extractable
                    </th>

                    <th className="px-5 py-4 font-semibold">
                      User Editable
                    </th>

                    <th className="px-5 py-4 font-semibold">
                      Sensitive
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredFields.map(
                    (field) => (
                      <tr
                        key={field.id}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                      >
                        <td className="px-5 py-5 align-top">
                          <div className="font-semibold text-blue-600">
                            {field.field_key}
                          </div>
                        </td>

                        <td className="px-5 py-5 align-top">
                          <div className="font-medium text-slate-800">
                            {field.display_name}
                          </div>

                          <div className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
                            {field.description ||
                              "—"}
                          </div>
                        </td>

                        <td className="px-5 py-5 align-top">
                          <div className="text-xs text-slate-500">
                            {field.category}
                          </div>
                        </td>

                        <td className="px-5 py-5 align-top">
                          <div className="text-xs text-slate-500">
                            {field.data_type}
                          </div>
                        </td>

                        <td className="px-5 py-5 align-top">
                          <div
                            className={
                              field.repeatable
                                ? "text-xs font-medium text-emerald-700"
                                : "text-slate-400"
                            }
                          >
                            {field.repeatable
                              ? "Yes"
                              : "No"}
                          </div>
                        </td>

                        <td className="px-5 py-5 align-top">
                          <div
                            className={
                              field.searchable
                                ? "text-xs font-medium text-emerald-700"
                                : "text-slate-400"
                            }
                          >
                            {field.searchable
                              ? "Yes"
                              : "No"}
                          </div>
                        </td>

                        <td className="px-5 py-5 align-top">
                          <div
                            className={
                              field.filterable
                                ? "text-xs font-medium text-emerald-700"
                                : "text-slate-400"
                            }
                          >
                            {field.filterable
                              ? "Yes"
                              : "No"}
                          </div>
                        </td>

                        <td className="px-5 py-5 align-top">
                          <div
                            className={
                              field.sortable
                                ? "text-xs font-medium text-emerald-700"
                                : "text-slate-400"
                            }
                          >
                            {field.sortable
                              ? "Yes"
                              : "No"}
                          </div>
                        </td>

                        <td className="px-5 py-5 align-top">
                          <div
                            className={
                              field.ai_extractable
                                ? "text-xs font-medium text-emerald-700"
                                : "text-slate-400"
                            }
                          >
                            {field.ai_extractable
                              ? "Yes"
                              : "No"}
                          </div>
                        </td>

                        <td className="px-5 py-5 align-top">
                          <div
                            className={
                              field.user_editable
                                ? "text-xs font-medium text-emerald-700"
                                : "text-slate-400"
                            }
                          >
                            {field.user_editable
                              ? "Yes"
                              : "No"}
                          </div>
                        </td>

                        <td className="px-5 py-5 align-top">
                          <div
                            className={
                              field.sensitive
                                ? "text-xs font-medium text-red-700"
                                : "text-slate-400"
                            }
                          >
                            {field.sensitive
                              ? "Yes"
                              : "No"}
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-6 py-5">
        <p className="text-sm leading-6 text-slate-600">
          The Field Registry is the organization&apos;s active source of
          metadata field definitions. Universal Metadata fields are backed
          by this registry and can be selected when entering metadata
          values.
        </p>
      </div>
    </section>
  );
}
