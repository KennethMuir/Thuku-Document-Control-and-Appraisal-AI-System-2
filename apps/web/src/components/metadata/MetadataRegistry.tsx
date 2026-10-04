"use client";

import React from "react";
import Link from "next/link";
import type {
  Dispatch,
  ReactElement,
  SetStateAction,
} from "react";


import type { Department } from "@/types/departments";

import type { UploadedDocument } from "@/types/documents";

import type { MetadataRecord } from "@/types/metadata";

import {
  formatDate,
  formatFileSize,
} from "@/lib/utils/formatting";

import { useFieldRegistry } from "@/hooks/useFieldRegistry";

import MetadataOutputPanel from "@/components/metadata/MetadataOutputPanel";

import { UniversalMetadataGuide } from "@/components/metadata/UniversalMetadataGuide";

import { FieldRegistryGuide } from "@/components/metadata/FieldRegistryGuide";


type MetadataRegistryProps = {
  metadata: MetadataRecord[];

  departments: Department[];

  documents: UploadedDocument[];

  selectedDepartment:
    Department | null;

  selectedDepartmentDocuments:
    UploadedDocument[];

  filteredMetadata:
    MetadataRecord[];

  searchTerm:
    string;

  canManageMetadata:
    boolean;

  loading:
    boolean;

  expandedAdditionalMetadata:
    Set<string>;

  setExpandedAdditionalMetadata:
    Dispatch<
      SetStateAction<
        Set<string>
      >
    >;

  setSearchTerm:
    Dispatch<
      SetStateAction<string>
    >;

  setSelectedDepartmentId:
    Dispatch<
      SetStateAction<number | null>
    >;

  setShowMetadataModal:
    Dispatch<
      SetStateAction<boolean>
    >;

  setShowBulkMetadataModal:
    Dispatch<
      SetStateAction<boolean>
    >;

  SummaryCard: (
    props: {
      label: string;
      value: number;
    }
  ) => ReactElement;

  StatusBadge: (
    props: {
      status: string;
    }
  ) => ReactElement;
};


export function MetadataRegistry({
  metadata,
  departments,
  documents,
  selectedDepartment,
  selectedDepartmentDocuments,
  filteredMetadata,
  searchTerm,
  canManageMetadata,
  loading,
  expandedAdditionalMetadata,
  setExpandedAdditionalMetadata,
  setSearchTerm,
  setSelectedDepartmentId,
  setShowMetadataModal,
  setShowBulkMetadataModal,
  SummaryCard,
  StatusBadge,
}: MetadataRegistryProps) {
  const {
    fieldDefinitions,
    loading: fieldLoading,
    error: fieldError,
  } = useFieldRegistry();

  type MetadataExpansionSection =
    | "universal"
    | "additional";

  const [
    selectedMetadataRecord,
    setSelectedMetadataRecord,
  ] = React.useState<MetadataRecord | null>(null);

  const [
    metadataExpansionOrder,
    setMetadataExpansionOrder,
  ] = React.useState<
    Record<string, MetadataExpansionSection[]>
  >(() => {
    const initialOrder: Record<
      string,
      MetadataExpansionSection[]
    > = {};

    expandedAdditionalMetadata.forEach(
      (recordId) => {
        initialOrder[recordId] = ["additional"];
      }
    );

    return initialOrder;
  });

  const toggleMetadataExpansion = (
    record: MetadataRecord,
    section: MetadataExpansionSection
  ) => {
    setMetadataExpansionOrder((current) => {
      const existing = current[record.id] ?? [];
      const isExpanded = existing.includes(section);

      if (isExpanded) {
        const nextOrder = existing.filter(
          (item) => item !== section
        );

        if (nextOrder.length === 0) {
          const next = { ...current };
          delete next[record.id];
          return next;
        }

        return {
          ...current,
          [record.id]: nextOrder,
        };
      }

      return {
        ...current,
        [record.id]: [
          ...existing,
          section,
        ],
      };
    });
  };

  const [
    showUniversalMetadataGuide,
    setShowUniversalMetadataGuide,
  ] = React.useState(false);

  const [
    showFieldRegistryGuide,
    setShowFieldRegistryGuide,
  ] = React.useState(false);

  return (
    <>

      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Universal Metadata
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Browse the universal metadata catalogue and its field groups.
          </p>
        </div>        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href="/metadata/values"
            className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
          >
            Manage Values
          </Link>



        <button
          type="button"
          onClick={() =>
            setShowUniversalMetadataGuide(
              (current) => !current
            )
          }
          className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
        >
          {showUniversalMetadataGuide
            ? "Hide Guide"
            : "Learn more"}
        </button>
        </div>
      </div>

      {showUniversalMetadataGuide && (
        <UniversalMetadataGuide
          onClose={() =>
            setShowUniversalMetadataGuide(false)
          }
        />
      )}


      {selectedDepartment && (
        <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200 px-6 py-5 md:flex-row md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Department records
              </p>

              <h2 className="mt-1 text-xl font-bold text-slate-950">
                {selectedDepartment.name}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                All documents currently assigned to{" "}
                {selectedDepartment.name}.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setSelectedDepartmentId(null)
              }
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
            >
              View All Metadata
            </button>
          </div>

          {selectedDepartmentDocuments.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-semibold text-slate-700">
                No documents assigned to this department.
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Uploaded documents assigned to{" "}
                {selectedDepartment.name} will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                    >
                      Document Code
                    </th>

                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                    >
                      Filename
                    </th>

                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                    >
                      Type
                    </th>

                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                    >
                      Size
                    </th>

                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                    >
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 bg-white">
                  {selectedDepartmentDocuments.map(
                    (document) => (
                      <tr
                        key={String(document.id)}
                      >
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-slate-900">
                          {document.document_code ??
                            "—"}
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-700">
                          {document.filename ??
                            "—"}
                        </td>

                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                          {document.file_type ??
                            "—"}
                        </td>

                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                          {formatFileSize(
                            document.file_size as
                              | number
                              | undefined
                          )}
                        </td>

                        <td className="whitespace-nowrap px-6 py-4">
                          <StatusBadge
                            status={
                              document.status ??
                              "UNKNOWN"
                            }
                          />
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Metadata Records"
          value={metadata.length}
        />

        <SummaryCard
          label="Awaiting Documents"
          value={
            metadata.filter(
              (item) =>
                item.status ===
                "AWAITING_DOCUMENT"
            ).length
          }
        />

        <SummaryCard
          label="Linked"
          value={
            metadata.filter(
              (item) =>
                Boolean(
                  item.linked_document_id
                )
            ).length
          }
        />

        <SummaryCard
          label="Departments"
          value={departments.length}
        />
      </div>

      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Metadata management
          </p>

          <h2 className="mt-1 text-xl font-bold">
            Pre-fed Metadata
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Register expected documents before the physical file
            arrives.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() =>
              setShowMetadataModal(true)
            }
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
          >
            + Register Metadata
          </button>

          {canManageMetadata && (
            <button
              type="button"
              onClick={() =>
                setShowBulkMetadataModal(true)
              }
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
            >
              Bulk Upload Metadata
            </button>
          )}
        </div>
      </div>

      <div className="mb-5 flex items-center gap-3">
        <div className="relative flex-1">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          >
            ⌕
          </span>

          <input
            aria-label="Search metadata records"
            value={searchTerm}
            onChange={(event) =>
              setSearchTerm(
                event.target.value
              )
            }
            placeholder="Search reference, person, title, department..."
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div
            role="status"
            aria-live="polite"
            className="p-10 text-center text-sm text-slate-500"
          >
            Loading metadata registry...
          </div>
        ) : filteredMetadata.length === 0 ? (
          <div className="p-12 text-center">
            <div
              aria-hidden="true"
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-lg"
            >
              ◫
            </div>

            <h3 className="mt-4 font-bold">
              No metadata records found
            </h3>

            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              Register expected document information before
              uploading physical documents.
            </p>

            <button
              type="button"
              onClick={() =>
                setShowMetadataModal(true)
              }
              className="mt-5 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
            >
              + Register Metadata
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-5 py-4 font-semibold">
                    Reference
                  </th>

                  <th className="px-5 py-4 font-semibold">
                    Document
                  </th>

                  <th className="px-5 py-4 font-semibold">
                    Person
                  </th>

                  <th className="px-5 py-4 font-semibold">
                    Department
                  </th>

                  <th className="px-5 py-4 font-semibold">
                    Type
                  </th>

                  <th className="px-5 py-4 font-semibold">
                    Section
                  </th>

                  <th className="px-5 py-4 font-semibold">
                    Date
                  </th>

                  <th className="px-5 py-4 font-semibold">
                    Status
                  </th>

                  <th className="px-5 py-4 font-semibold">
                    Additional Metadata
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredMetadata.map(
                  (record) => (
                    <React.Fragment
                      key={record.id}
                    >
                      <tr
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                      >
                        <td className="px-5 py-5">
                          <div className="font-semibold">
                            {record.reference_code}
                          </div>
                        </td>

                        <td className="px-5 py-5">
                          <a
                            href={`/metadata/${record.id}/documents`}
                            className="block w-full rounded-lg text-left transition hover:bg-blue-50/70 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                          >
                            <div className="font-medium text-slate-800">
                              {record.title ||
                                "Untitled"}
                            </div>

                            {record.linked_document_code && (
                              <div className="mt-1 text-xs font-semibold text-blue-600">
                                {
                                  record.linked_document_code
                                }
                              </div>
                            )}

                            <div className="mt-2 text-xs font-semibold text-blue-600">
                              {record.linked_documents?.length ?? 0}{" "}
                              {(record.linked_documents?.length ?? 0) === 1
                                ? "document"
                                : "documents"}
                              {" · View aligned documents"}
                            </div>
                          </a>
                        </td>

                        <td className="px-5 py-5">
                          {record.person_name ||
                            "—"}
                        </td>

                        <td className="px-5 py-5">
                          {record.department_name ||
                            "—"}
                        </td>

                        <td className="px-5 py-5">
                          {record.document_type_name ||
                            "—"}
                        </td>

                        <td className="px-5 py-5 text-sm text-slate-600">
                          {record.section ||
                            "—"}
                        </td>

                        <td className="px-5 py-5">
                          {formatDate(
                            record.document_date
                          )}
                        </td>

                        <td className="px-5 py-5">
                          <StatusBadge
                            status={
                              record.status
                            }
                          />
                        </td>

                        <td className="px-5 py-5 align-top">
                          <div className="mb-3">
                            <button
                              type="button"
                              onClick={() => {
                                const isExpanded =
                                  metadataExpansionOrder[
                                    record.id
                                  ]?.includes(
                                    "universal"
                                  ) ?? false;

                                toggleMetadataExpansion(
                                  record,
                                  "universal"
                                );

                                setSelectedMetadataRecord(
                                  isExpanded
                                    ? null
                                    : record
                                );
                              }}
                              className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:border-indigo-400 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                            >
                              {selectedMetadataRecord?.id ===
                              record.id
                                ? "Hide Universal Metadata"
                                : "Universal Metadata"}
                            </button>
                          </div>

                          {record.additional_metadata &&
                          Object.keys(
                            record.additional_metadata
                          ).length > 0 ? (
                            <button
                              type="button"
                              onClick={() => {
                                const isExpanded =
                                  metadataExpansionOrder[
                                    record.id
                                  ]?.includes(
                                    "additional"
                                  ) ?? false;

                                toggleMetadataExpansion(
                                  record,
                                  "additional"
                                );

                                setExpandedAdditionalMetadata(
                                  (current) => {
                                    const next =
                                      new Set(current);

                                    if (isExpanded) {
                                      next.delete(
                                        record.id
                                      );
                                    } else {
                                      next.add(
                                        record.id
                                      );
                                    }

                                    return next;
                                  }
                                );
                              }}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                            >
                              {metadataExpansionOrder[
                                record.id
                              ]?.includes(
                                "additional"
                              )
                                ? "Hide Additional Metadata"
                                : "Additional Metadata"}
                            </button>
                          ) : (
                            <span className="text-sm text-slate-400">
                              —
                            </span>
                          )}
                        </td>
                      </tr>

                      {(metadataExpansionOrder[record.id] ?? []).map(
                        (section) => {
                          if (section === "universal") {
                            return (
                              <tr
                                key={`${record.id}-universal`}
                              >
                                <td
                                  colSpan={9}
                                  className="p-0"
                                >
                                  <MetadataOutputPanel
                                    metadataRecordId={Number(
                                      record.id
                                    )}
                                    metadataTitle={
                                      record.title
                                    }
                                    metadataReferenceCode={
                                      record.reference_code
                                    }
                                    onClose={() => {
                                      toggleMetadataExpansion(
                                        record,
                                        "universal"
                                      );
                                      setSelectedMetadataRecord(
                                        null
                                      );
                                    }}
                                  />
                                </td>
                              </tr>
                            );
                          }

                          if (
                            section === "additional" &&
                            record.additional_metadata &&
                            Object.keys(
                              record.additional_metadata
                            ).length > 0
                          ) {
                            return (
                              <tr
                                key={`${record.id}-additional`}
                              >
                                <td
                                  colSpan={9}
                                  className="p-0"
                                >
                                  <div className="space-y-2 border-b border-slate-200 bg-slate-50 p-5">
                                    {Object.entries(
                                      record.additional_metadata
                                    ).map(
                                      ([
                                        key,
                                        value,
                                      ]) => (
                                        <div
                                          key={key}
                                          className="text-xs text-slate-600"
                                        >
                                          <span className="font-semibold text-slate-700">
                                            {key}:
                                          </span>{" "}
                                          {value ===
                                            null ||
                                          value ===
                                            undefined ||
                                          value ===
                                            ""
                                            ? "—"
                                            : String(
                                                value
                                              )}
                                        </div>
                                      )
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          }

                          return null;
                        }
                      )}
                    </React.Fragment>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {canManageMetadata &&
        fieldLoading && (
          <div className="mb-8 mt-8 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p
              role="status"
              aria-live="polite"
              className="text-sm text-slate-500"
            >
              Loading field definitions...
            </p>
          </div>
        )}

      {canManageMetadata &&
        !fieldLoading &&
        fieldDefinitions.length > 0 && (
          <>
            <div className="mb-8 mt-8 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Field Registry
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Browse the organization field registry and its metadata capabilities.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowFieldRegistryGuide(
                    (current) => !current
                  )
                }
                className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
              >
                {showFieldRegistryGuide
                  ? "Hide Guide"
                  : "Learn more"}
              </button>
            </div>

            {showFieldRegistryGuide && (
              <FieldRegistryGuide
                onClose={() =>
                  setShowFieldRegistryGuide(false)
                }
              />
            )}
          </>
        )}

      {canManageMetadata &&
        !fieldLoading &&
        !fieldError &&
        fieldDefinitions.length === 0 && (
          <div className="mb-8 mt-8 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h3 className="text-base font-semibold text-slate-800">
              No custom field definitions found
            </h3>

            <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-500">
              No field definitions were returned for this
              organization. The universal system metadata fields
              remain available by default, including reference
              code, title, document date, year, person name,
              department, document type, section, and description.
            </p>
          </div>
        )}

      {fieldError && (
        <div className="mb-8 mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-semibold text-red-700">
            Unable to load the field registry.
          </p>

          <p className="mt-1 text-sm text-red-600">
            {fieldError}
          </p>
        </div>
      )}
    </>
  );
}
