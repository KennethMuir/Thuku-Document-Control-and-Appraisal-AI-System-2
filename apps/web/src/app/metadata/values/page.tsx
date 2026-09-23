"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  useAuthSession,
} from "@/hooks/useAuthSession";

import {
  useMetadataValues,
} from "@/hooks/useMetadataValues";

type MetadataRecordSummary = {
  id: number;
  reference_code: string | null;
  title: string | null;
  document_date: string | null;
  year: string | number | null;
  person_name: string | null;
  description: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  department_id: number | null;
  department_name: string | null;
  department_code: string | null;
  document_type_id: number | null;
  document_type_name: string | null;
  linked_document_id: number | null;
  linked_document_code: string | null;
  linked_filename: string | null;
  linked_document_status: string | null;
  section?: string | null;
  additional_metadata?: Record<
    string,
    unknown
  > | null;
};

type MetadataResponse = {
  success?: boolean;
  metadata?: MetadataRecordSummary[];
  error?: string;
  message?: string;
};

type MetadataField = {
  id: number;
  field_key: string;
  display_name: string;
  description?: string | null;
  category?: string | null;
  data_type?: string | null;
  aliases?: unknown;
  repeatable?: boolean | null;
  searchable?: boolean | null;
  filterable?: boolean | null;
  sortable?: boolean | null;
  ai_extractable?: boolean | null;
  user_editable?: boolean | null;
  sensitive?: boolean | null;
  validation_rule?: unknown;
  controlled_vocabulary?: unknown;
  unit?: string | null;
  default_value?: unknown;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:4000";

function formatValue(
  value: unknown
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  if (
    typeof value === "object"
  ) {
    try {
      return JSON.stringify(
        value,
        null,
        2
      );
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function formatDate(
  value: string | null | undefined
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  ).format(date);
}

function formatDataType(
  value: string | null | undefined
): string {
  if (!value) {
    return "Text";
  }

  return value
    .replace(/_/g, " ")
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}

function getBoolean(
  value: unknown
): boolean | null {
  if (
    typeof value === "boolean"
  ) {
    return value;
  }

  if (
    typeof value === "string"
  ) {
    if (
      value.toLowerCase() ===
      "true"
    ) {
      return true;
    }

    if (
      value.toLowerCase() ===
      "false"
    ) {
      return false;
    }
  }

  return null;
}

function renderDefinitionValue(
  value: unknown
): string {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  if (
    Array.isArray(value)
  ) {
    return value
      .map((item) =>
        formatValue(item)
      )
      .join(", ");
  }

  return formatValue(value);
}

export default function MetadataValuesPage() {
  const {
    authUser,
    authLoading,
    authError,
    canManageMetadata,
  } = useAuthSession();

  const {
    metadataRecordId,
    setMetadataRecordId,
    values,
    fields,
    selectedField,
    selectedFieldId,
    setSelectedFieldId,
    valueInput,
    setValueInput,
    source,
    setSource,
    confidenceInput,
    setConfidenceInput,
    verificationStatus,
    setVerificationStatus,
    loading,
    fieldsLoading,
    saving,
    deletingId,
    error,
    fieldRegistryError,
    saveValue,
    removeValue,
  } = useMetadataValues({
    authLoading,
    authUser,
  });

  const [
    metadataRecords,
    setMetadataRecords,
  ] = useState<
    MetadataRecordSummary[]
  >([]);

  const [
    metadataLoading,
    setMetadataLoading,
  ] = useState(false);

  const [
    metadataError,
    setMetadataError,
  ] = useState("");

  const [
    metadataSearch,
    setMetadataSearch,
  ] = useState("");

  const [
    showRecordSelector,
    setShowRecordSelector,
  ] = useState(false);

  const [
    showFieldDetails,
    setShowFieldDetails,
  ] = useState(false);

  useEffect(() => {
    if (
      authLoading ||
      authUser
    ) {
      return;
    }

    window.location.href =
      "/login";
  }, [
    authLoading,
    authUser,
  ]);

  useEffect(() => {
    if (
      authLoading ||
      !authUser ||
      !canManageMetadata
    ) {
      return;
    }

    let cancelled = false;

    async function loadMetadataRecords() {
      try {
        setMetadataLoading(true);
        setMetadataError("");

        const response =
          await fetch(
            `${API_URL}/api/metadata`,
            {
              credentials: "include",
              cache: "no-store",
            }
          );

        const data =
          (await response.json()) as MetadataResponse;

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.error ||
              data.message ||
              "Unable to load metadata records."
          );
        }

        if (!cancelled) {
          setMetadataRecords(
            Array.isArray(
              data.metadata
            )
              ? data.metadata
              : []
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          setMetadataError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load metadata records."
          );
        }
      } finally {
        if (!cancelled) {
          setMetadataLoading(false);
        }
      }
    }

    void loadMetadataRecords();

    return () => {
      cancelled = true;
    };
  }, [
    authLoading,
    authUser,
    canManageMetadata,
  ]);

  const selectedMetadataRecord =
    useMemo(() => {
      if (!metadataRecordId) {
        return null;
      }

      const numericId =
        Number(metadataRecordId);

      if (
        !Number.isFinite(
          numericId
        )
      ) {
        return null;
      }

      return (
        metadataRecords.find(
          (record) =>
            Number(record.id) ===
            numericId
        ) ?? null
      );
    }, [
      metadataRecordId,
      metadataRecords,
    ]);

  const filteredMetadataRecords =
    useMemo(() => {
      const query =
        metadataSearch
          .trim()
          .toLowerCase();

      if (!query) {
        return metadataRecords;
      }

      return metadataRecords.filter(
        (record) => {
          const searchable = [
            record.reference_code,
            record.title,
            record.person_name,
            record.department_name,
            record.department_code,
            record.document_type_name,
            record.year,
            record.status,
            record.linked_document_code,
            record.linked_filename,
          ]
            .filter(
              (
                value
              ) =>
                value !==
                  null &&
                value !==
                  undefined
            )
            .join(" ")
            .toLowerCase();

          return searchable.includes(
            query
          );
        }
      );
    }, [
      metadataRecords,
      metadataSearch,
    ]);

  const fieldDataType =
    selectedField?.data_type ||
    "text";

  const isBoolean =
    fieldDataType ===
      "boolean";

  const isJson =
    fieldDataType ===
      "json";

  const isControlledVocabulary =
    fieldDataType ===
    "controlled_vocabulary";

  const isNumeric =
    fieldDataType ===
      "number" ||
    fieldDataType ===
      "integer" ||
    fieldDataType ===
      "decimal";

  const isDate =
    fieldDataType ===
      "date";

  const isDateTime =
    fieldDataType ===
      "datetime" ||
    fieldDataType ===
      "timestamp";

  const selectedFieldIsRepeatable =
    Boolean(
      selectedField?.repeatable
    );

  const confidenceNumber =
    confidenceInput.trim() ===
    ""
      ? null
      : Number(
          confidenceInput
        );

  const confidenceValid =
    confidenceNumber ===
      null ||
    (Number.isFinite(
      confidenceNumber
    ) &&
      confidenceNumber >=
        0 &&
      confidenceNumber <=
        1);

  const valueRequired =
    valueInput.trim().length >
    0;

  const canSave =
    Boolean(
      metadataRecordId
    ) &&
    Boolean(
      selectedFieldId
    ) &&
    valueRequired &&
    confidenceValid &&
    !saving;

  const selectMetadataRecord = (
    record: MetadataRecordSummary
  ) => {
    setMetadataRecordId(
      String(record.id)
    );

    setShowRecordSelector(
      false
    );

    setMetadataSearch("");
  };

  const handleSave = async () => {
    if (!metadataRecordId) {
      return;
    }

    if (!selectedFieldId) {
      return;
    }

    if (!valueRequired) {
      return;
    }

    if (!confidenceValid) {
      return;
    }

    await saveValue();
  };

  if (authLoading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border bg-white p-8 shadow-sm">
            <p className="text-sm text-slate-600">
              Checking authentication...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!authUser) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border bg-white p-8 shadow-sm">
            <p className="text-sm text-slate-600">
              Redirecting to login...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!canManageMetadata) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 hover:underline"
          >
            ← Dashboard
          </Link>

          <div className="mt-6 rounded-2xl border bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-900">
              Universal Metadata Values
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              Your current role does not
              have permission to manage
              universal metadata values.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link
              href="/"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 hover:underline"
            >
              ← Dashboard
            </Link>

            <div className="mt-3">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Universal Metadata Values
                </h1>

                <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                  M24
                </span>
              </div>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Add flexible, field-based
                information to an existing
                metadata record without
                changing the core metadata
                database structure.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              How this works
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-medium text-slate-700">
              <span>
                Metadata Record
              </span>
              <span className="text-slate-400">
                →
              </span>
              <span>
                Field
              </span>
              <span className="text-slate-400">
                →
              </span>
              <span>
                Value
              </span>
            </div>
          </div>
        </div>

        {authError && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {authError}
          </div>
        )}

        {(
          error ||
          fieldRegistryError ||
          metadataError
        ) && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error ||
              fieldRegistryError ||
              metadataError}
          </div>
        )}

        <section className="rounded-2xl border bg-white shadow-sm">
          <div className="border-b bg-slate-50 px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Step 1
                </p>

                <h2 className="mt-1 text-lg font-semibold text-slate-900">
                  Select Metadata Record
                </h2>

                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                  Choose the existing metadata
                  record that you want to
                  enrich. You do not need to
                  know its internal database
                  ID.
                </p>
              </div>

              {metadataLoading && (
                <span className="text-xs font-medium text-slate-500">
                  Loading metadata records...
                </span>
              )}
            </div>
          </div>

          <div className="p-5 sm:p-6">
            {selectedMetadataRecord ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50">
                <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Selected record
                    </p>

                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-bold text-slate-900">
                        {selectedMetadataRecord.reference_code ||
                          `Record #${selectedMetadataRecord.id}`}
                      </h3>

                      {selectedMetadataRecord.status && (
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                          {
                            selectedMetadataRecord.status
                          }
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-sm text-slate-700">
                      {selectedMetadataRecord.title ||
                        "Untitled metadata record"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setShowRecordSelector(
                        true
                      )
                    }
                    className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Change Record
                  </button>
                </div>

                <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Department
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-800">
                      {selectedMetadataRecord.department_name ||
                        "—"}
                    </p>
                    {selectedMetadataRecord.department_code && (
                      <p className="text-xs text-slate-500">
                        {
                          selectedMetadataRecord.department_code
                        }
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Document Type
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-800">
                      {selectedMetadataRecord.document_type_name ||
                        "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Person / Subject
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-800">
                      {selectedMetadataRecord.person_name ||
                        "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Year
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-800">
                      {selectedMetadataRecord.year ||
                        "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Document Date
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-800">
                      {formatDate(
                        selectedMetadataRecord.document_date
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Linked Document
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-800">
                      {selectedMetadataRecord.linked_document_code ||
                        "Not linked"}
                    </p>
                    {selectedMetadataRecord.linked_filename && (
                      <p className="truncate text-xs text-slate-500">
                        {
                          selectedMetadataRecord.linked_filename
                        }
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Created
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-800">
                      {formatDate(
                        selectedMetadataRecord.created_at
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Internal Record ID
                    </p>
                    <p className="mt-1 font-mono text-sm font-medium text-slate-800">
                      {
                        selectedMetadataRecord.id
                      }
                    </p>
                    <p className="text-xs text-slate-500">
                      Used internally by the
                      system.
                    </p>
                  </div>
                </div>

                {selectedMetadataRecord.description && (
                  <div className="border-t border-slate-200 p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Description
                    </p>

                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {
                        selectedMetadataRecord.description
                      }
                    </p>
                  </div>
                )}

                {selectedMetadataRecord.additional_metadata &&
                  Object.keys(
                    selectedMetadataRecord.additional_metadata
                  ).length > 0 && (
                    <div className="border-t border-slate-200 p-5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Existing Additional Metadata
                      </p>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {Object.entries(
                          selectedMetadataRecord.additional_metadata
                        ).map(
                          ([
                            key,
                            value,
                          ]) => (
                            <div
                              key={key}
                              className="rounded-lg border bg-white p-3"
                            >
                              <p className="text-xs font-semibold text-slate-500">
                                {key}
                              </p>
                              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800">
                                {formatValue(
                                  value
                                )}
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
              </div>
            ) : (
              <div>
                <button
                  type="button"
                  onClick={() =>
                    setShowRecordSelector(
                      true
                    )
                  }
                  className="w-full rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center transition hover:border-slate-400 hover:bg-white"
                >
                  <span className="block text-base font-semibold text-slate-900">
                    Choose a metadata record
                  </span>

                  <span className="mt-1 block text-sm text-slate-500">
                    Search by reference code,
                    title, person, department,
                    document type, year, or
                    document code.
                  </span>
                </button>
              </div>
            )}

            {showRecordSelector && (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      Find Metadata Record
                    </h3>

                    <p className="text-xs text-slate-500">
                      Select the record whose
                      additional values you want
                      to manage.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setShowRecordSelector(
                        false
                      )
                    }
                    className="self-start rounded-lg border px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>

                <input
                  type="search"
                  value={metadataSearch}
                  onChange={(event) =>
                    setMetadataSearch(
                      event.target.value
                    )
                  }
                  placeholder="Search reference code, title, person, department, type, year..."
                  className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                  autoFocus
                />

                <div className="mt-4 max-h-[420px] overflow-y-auto rounded-xl border">
                  {metadataLoading ? (
                    <div className="p-6 text-center text-sm text-slate-500">
                      Loading metadata records...
                    </div>
                  ) : filteredMetadataRecords.length ===
                    0 ? (
                    <div className="p-6 text-center">
                      <p className="text-sm font-medium text-slate-700">
                        No metadata records found.
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Try a different search
                        term.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredMetadataRecords.map(
                        (record) => (
                          <button
                            key={record.id}
                            type="button"
                            onClick={() =>
                              selectMetadataRecord(
                                record
                              )
                            }
                            className="block w-full px-4 py-4 text-left transition hover:bg-slate-50"
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-semibold text-slate-900">
                                    {record.reference_code ||
                                      `Record #${record.id}`}
                                  </span>

                                  {record.status && (
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                      {
                                        record.status
                                      }
                                    </span>
                                  )}
                                </div>

                                <p className="mt-1 truncate text-sm text-slate-700">
                                  {record.title ||
                                    "Untitled metadata record"}
                                </p>

                                <p className="mt-1 text-xs text-slate-500">
                                  {[
                                    record.department_name,
                                    record.document_type_name,
                                    record.person_name,
                                    record.year,
                                  ]
                                    .filter(
                                      Boolean
                                    )
                                    .join(
                                      " · "
                                    ) ||
                                    "No additional record details"}
                                </p>
                              </div>

                              <span className="shrink-0 text-xs font-medium text-slate-400">
                                Select →
                              </span>
                            </div>
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border bg-white shadow-sm">
          <div className="border-b bg-slate-50 px-5 py-5 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Step 2
            </p>

            <h2 className="mt-1 text-lg font-semibold text-slate-900">
              Add Metadata Value
            </h2>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Select a registered field and
              enter the actual value for the
              selected metadata record.
            </p>
          </div>

          <div className="p-5 sm:p-6">
            {!selectedMetadataRecord ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                <p className="text-sm font-semibold text-amber-900">
                  Select a metadata record first.
                </p>

                <p className="mt-1 text-sm text-amber-800">
                  The field value must belong to
                  a specific metadata record.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Adding information to
                  </p>

                  <p className="mt-1 font-semibold text-slate-900">
                    {selectedMetadataRecord.reference_code ||
                      `Record #${selectedMetadataRecord.id}`}
                    {" — "}
                    {selectedMetadataRecord.title ||
                      "Untitled metadata record"}
                  </p>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">
                      Field
                    </span>

                    <select
                      value={
                        selectedFieldId
                      }
                      onChange={(
                        event
                      ) =>
                        setSelectedFieldId(
                          event.target
                            .value
                        )
                      }
                      disabled={
                        fieldsLoading
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-100"
                    >
                      <option value="">
                        {fieldsLoading
                          ? "Loading Field Registry..."
                          : "Select a field"}
                      </option>

                      {fields.map(
                        (
                          field: MetadataField
                        ) => (
                          <option
                            key={
                              field.id
                            }
                            value={
                              field.id
                            }
                          >
                            {
                              field.display_name
                            }
                            {" — "}
                            {
                              field.field_key
                            }
                          </option>
                        )
                      )}
                    </select>

                    {selectedField && (
                      <div className="mt-3 rounded-xl border bg-slate-50 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                            {formatDataType(
                              selectedField.data_type
                            )}
                          </span>

                          {selectedField.repeatable && (
                            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                              Repeatable
                            </span>
                          )}

                          {selectedField.sensitive && (
                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                              Sensitive
                            </span>
                          )}
                        </div>

                        {selectedField.description && (
                          <p className="mt-3 text-sm leading-6 text-slate-600">
                            {
                              selectedField.description
                            }
                          </p>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            setShowFieldDetails(
                              (
                                current
                              ) =>
                                !current
                            )
                          }
                          className="mt-3 text-xs font-semibold text-slate-700 underline underline-offset-2"
                        >
                          {showFieldDetails
                            ? "Hide field definition"
                            : "Show field definition"}
                        </button>

                        {showFieldDetails && (
                          <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                Field Key
                              </p>
                              <p className="mt-1 font-mono text-xs text-slate-700">
                                {
                                  selectedField.field_key
                                }
                              </p>
                            </div>

                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                Category
                              </p>
                              <p className="mt-1 text-xs text-slate-700">
                                {renderDefinitionValue(
                                  selectedField.category
                                )}
                              </p>
                            </div>

                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                Unit
                              </p>
                              <p className="mt-1 text-xs text-slate-700">
                                {renderDefinitionValue(
                                  selectedField.unit
                                )}
                              </p>
                            </div>

                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                Repeatable
                              </p>
                              <p className="mt-1 text-xs text-slate-700">
                                {selectedField.repeatable
                                  ? "Yes"
                                  : "No"}
                              </p>
                            </div>

                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                Searchable
                              </p>
                              <p className="mt-1 text-xs text-slate-700">
                                {selectedField.searchable
                                  ? "Yes"
                                  : "No"}
                              </p>
                            </div>

                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                Filterable
                              </p>
                              <p className="mt-1 text-xs text-slate-700">
                                {selectedField.filterable
                                  ? "Yes"
                                  : "No"}
                              </p>
                            </div>

                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                Sortable
                              </p>
                              <p className="mt-1 text-xs text-slate-700">
                                {selectedField.sortable
                                  ? "Yes"
                                  : "No"}
                              </p>
                            </div>

                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                AI Extractable
                              </p>
                              <p className="mt-1 text-xs text-slate-700">
                                {selectedField.ai_extractable
                                  ? "Yes"
                                  : "No"}
                              </p>
                            </div>

                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                User Editable
                              </p>
                              <p className="mt-1 text-xs text-slate-700">
                                {selectedField.user_editable ===
                                false
                                  ? "No"
                                  : "Yes"}
                              </p>
                            </div>

                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                Default Value
                              </p>
                              <p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-700">
                                {renderDefinitionValue(
                                  selectedField.default_value
                                )}
                              </p>
                            </div>

                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                Validation Rule
                              </p>
                              <p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-700">
                                {renderDefinitionValue(
                                  selectedField.validation_rule
                                )}
                              </p>
                            </div>

                            <div className="sm:col-span-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                Controlled Vocabulary
                              </p>
                              <p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-700">
                                {renderDefinitionValue(
                                  selectedField.controlled_vocabulary
                                )}
                              </p>
                            </div>

                            <div className="sm:col-span-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                Aliases
                              </p>
                              <p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-700">
                                {renderDefinitionValue(
                                  selectedField.aliases
                                )}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">
                      Source
                    </span>

                    <select
                      value={source}
                      onChange={(
                        event
                      ) =>
                        setSource(
                          event.target
                            .value as
                            | "USER"
                            | "AI"
                            | "SYSTEM"
                            | "IMPORT"
                            | "MIGRATION"
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                    >
                      <option value="USER">
                        USER — entered or
                        corrected by a user
                      </option>
                      <option value="AI">
                        AI — extracted or
                        suggested by AI
                      </option>
                      <option value="SYSTEM">
                        SYSTEM — generated by
                        the application
                      </option>
                      <option value="IMPORT">
                        IMPORT — imported from
                        another source
                      </option>
                      <option value="MIGRATION">
                        MIGRATION — migrated from
                        an older system
                      </option>
                    </select>

                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Source records where this
                      value came from. It does not
                      determine whether the value is
                      trusted or verified.
                    </p>
                  </label>

                  <label className="block lg:col-span-2">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">
                      Value
                    </span>

                    {isBoolean ? (
                      <select
                        value={
                          valueInput
                        }
                        onChange={(
                          event
                        ) =>
                          setValueInput(
                            event.target
                              .value
                          )
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                      >
                        <option value="">
                          Select a value
                        </option>
                        <option value="true">
                          True
                        </option>
                        <option value="false">
                          False
                        </option>
                      </select>
                    ) : isDate ? (
                      <input
                        type="date"
                        value={
                          valueInput
                        }
                        onChange={(
                          event
                        ) =>
                          setValueInput(
                            event.target
                              .value
                          )
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                      />
                    ) : isDateTime ? (
                      <input
                        type="datetime-local"
                        value={
                          valueInput
                        }
                        onChange={(
                          event
                        ) =>
                          setValueInput(
                            event.target
                              .value
                          )
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                      />
                    ) : isNumeric ? (
                      <input
                        type="number"
                        step="any"
                        value={
                          valueInput
                        }
                        onChange={(
                          event
                        ) =>
                          setValueInput(
                            event.target
                              .value
                          )
                        }
                        placeholder="Enter a numeric value"
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                      />
                    ) : isJson ||
                      isControlledVocabulary ? (
                      <textarea
                        value={
                          valueInput
                        }
                        onChange={(
                          event
                        ) =>
                          setValueInput(
                            event.target
                              .value
                          )
                        }
                        rows={7}
                        placeholder={
                          isControlledVocabulary
                            ? "Enter the value using the field's controlled vocabulary."
                            : '{"key":"value"}'
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                      />
                    ) : (
                      <textarea
                        value={
                          valueInput
                        }
                        onChange={(
                          event
                        ) =>
                          setValueInput(
                            event.target
                              .value
                          )
                        }
                        rows={5}
                        placeholder={
                          selectedField
                            ? `Enter ${selectedField.display_name.toLowerCase()}`
                            : "Select a field first"
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                      />
                    )}

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-slate-500">
                        {selectedField
                          ? `${formatDataType(
                              selectedField.data_type
                            )} value${
                              selectedFieldIsRepeatable
                                ? " · Multiple values are allowed"
                                : ""
                            }`
                          : "Select a field to see the expected value type."}
                      </p>

                      {selectedField?.unit && (
                        <span className="text-xs font-medium text-slate-500">
                          Unit:{" "}
                          {
                            selectedField.unit
                          }
                        </span>
                      )}
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">
                      Confidence
                    </span>

                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.0001"
                      value={
                        confidenceInput
                      }
                      onChange={(
                        event
                      ) =>
                        setConfidenceInput(
                          event.target
                            .value
                        )
                      }
                      placeholder="0 to 1, e.g. 0.95"
                      className={`w-full rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-100 ${
                        confidenceValid
                          ? "border-slate-300 focus:border-slate-500"
                          : "border-red-300 focus:border-red-500"
                      }`}
                    />

                    <p className="mt-2 text-xs text-slate-500">
                      1.0000 means complete
                      confidence. 0.0000 means no
                      confidence.
                    </p>

                    {!confidenceValid && (
                      <p className="mt-1 text-xs font-medium text-red-600">
                        Confidence must be between
                        0 and 1.
                      </p>
                    )}
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">
                      Verification Status
                    </span>

                    <select
                      value={
                        verificationStatus
                      }
                      onChange={(
                        event
                      ) =>
                        setVerificationStatus(
                          event.target
                            .value as
                            | "UNVERIFIED"
                            | "VERIFIED"
                            | "REJECTED"
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                    >
                      <option value="UNVERIFIED">
                        UNVERIFIED
                      </option>
                      <option value="VERIFIED">
                        VERIFIED
                      </option>
                      <option value="REJECTED">
                        REJECTED
                      </option>
                    </select>

                    <p className="mt-2 text-xs text-slate-500">
                      Verification is separate from
                      the source and confidence.
                    </p>
                  </label>
                </div>

                <div className="mt-6 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    {!selectedFieldId && (
                      <p className="text-xs text-amber-700">
                        Select a field before
                        saving.
                      </p>
                    )}

                    {selectedFieldId &&
                      !valueRequired && (
                        <p className="text-xs text-amber-700">
                          Enter a value before
                          saving.
                        </p>
                      )}

                    {selectedFieldIsRepeatable && (
                      <p className="text-xs text-slate-500">
                        This field is repeatable, so
                        additional values can be
                        registered separately.
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void handleSave()
                    }
                    disabled={!canSave}
                    className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {saving
                      ? "Saving..."
                      : "Add Metadata Value"}
                  </button>
                </div>
              </>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border bg-white shadow-sm">
          <div className="border-b bg-slate-50 px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Step 3
                </p>

                <h2 className="mt-1 text-lg font-semibold text-slate-900">
                  Registered Values
                </h2>

                <p className="mt-1 text-sm leading-6 text-slate-600">
                  These are the universal metadata
                  values currently stored against
                  the selected metadata record.
                </p>
              </div>

              <span className="self-start rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                {values.length} value
                {values.length ===
                1
                  ? ""
                  : "s"}
              </span>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            {!selectedMetadataRecord ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <p className="text-sm font-semibold text-slate-700">
                  No metadata record selected
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Select a record above to view
                  and manage its universal values.
                </p>
              </div>
            ) : loading ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
                <p className="text-sm text-slate-600">
                  Loading universal metadata
                  values...
                </p>
              </div>
            ) : values.length ===
              0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <div className="mx-auto max-w-lg">
                  <p className="text-base font-semibold text-slate-800">
                    No universal values have
                    been registered yet.
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    This does not mean the metadata
                    record is empty. Its core
                    information remains in the
                    Metadata Registry. This section
                    is for additional field-based
                    information defined by the Field
                    Registry.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr className="border-b">
                      <th className="px-4 py-3 font-semibold text-slate-700">
                        Field
                      </th>
                      <th className="px-4 py-3 font-semibold text-slate-700">
                        Value
                      </th>
                      <th className="px-4 py-3 font-semibold text-slate-700">
                        Type
                      </th>
                      <th className="px-4 py-3 font-semibold text-slate-700">
                        Source
                      </th>
                      <th className="px-4 py-3 font-semibold text-slate-700">
                        Confidence
                      </th>
                      <th className="px-4 py-3 font-semibold text-slate-700">
                        Verification
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y">
                    {values.map(
                      (item) => {
                        const itemField =
                          fields.find(
                            (
                              field: MetadataField
                            ) =>
                              Number(
                                field.id
                              ) ===
                              Number(
                                item.field_registry_id
                              )
                          );

                        return (
                          <tr
                            key={
                              item.id
                            }
                            className="align-top hover:bg-slate-50"
                          >
                            <td className="px-4 py-4">
                              <div className="font-semibold text-slate-900">
                                {
                                  item.display_name
                                }
                              </div>

                              <div className="mt-1 font-mono text-xs text-slate-500">
                                {
                                  item.field_key
                                }
                              </div>
                            </td>

                            <td className="max-w-md px-4 py-4">
                              <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-5 text-slate-700">
                                {formatValue(
                                  item.value
                                )}
                              </pre>
                            </td>

                            <td className="px-4 py-4 text-slate-600">
                              {formatDataType(
                                itemField?.data_type
                              )}
                            </td>

                            <td className="px-4 py-4">
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                {
                                  item.source
                                }
                              </span>
                            </td>

                            <td className="px-4 py-4 text-slate-700">
                              {item.confidence ===
                              null
                                ? "—"
                                : Number(
                                    item.confidence
                                  ).toFixed(
                                    4
                                  )}
                            </td>

                            <td className="px-4 py-4">
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                  item.verification_status ===
                                  "VERIFIED"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : item.verification_status ===
                                      "REJECTED"
                                      ? "bg-red-100 text-red-800"
                                      : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {
                                  item.verification_status
                                }
                              </span>
                            </td>

                            <td className="px-4 py-4 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  void removeValue(
                                    item.id
                                  )
                                }
                                disabled={
                                  deletingId ===
                                  item.id
                                }
                                className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {deletingId ===
                                item.id
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-slate-900">
            What this page manages
          </h2>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Metadata Record
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                The actual record from the
                Metadata Registry, such as an
                expected document or an existing
                document record.
              </p>
            </div>

            <div className="rounded-xl border bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Field Registry
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Defines what a field means, its
                type, validation, search behavior,
                repeatability, and other rules.
              </p>
            </div>

            <div className="rounded-xl border bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Universal Value
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Stores the actual information for
                that field on the selected metadata
                record.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
