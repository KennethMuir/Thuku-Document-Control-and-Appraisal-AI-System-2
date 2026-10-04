"use client";

import { useEffect, useState } from "react";

import { getMetadataOutput } from "@/lib/api/metadata";

type MetadataOutputValue = {
  id: number;
  metadata_record_id: number;
  field_registry_id: number;
  value: unknown;
  source: string;
  confidence: number | null;
  verification_status: string;
  created_at: string;
  updated_at: string;
  field_key: string;
  display_name: string;
  field_description: string | null;
  category: string;
  data_type: string;
  aliases?: string[] | null;
  repeatable: boolean;
  searchable: boolean;
  filterable: boolean;
  sortable: boolean;
  ai_extractable: boolean;
  user_editable: boolean;
  sensitive: boolean;
  validation_rule?: Record<string, unknown> | null;
  controlled_vocabulary?: Record<string, unknown> | null;
  unit?: string | null;
  default_value?: Record<string, unknown> | null;
  profile_enabled: boolean;
  profile_required: boolean;
  profile_display_order: number;
};

type MetadataOutputResponse = {
  success?: boolean;
  metadata_record?: {
    id: number;
    reference_code: string;
    title: string | null;
  };
  values?: MetadataOutputValue[];
  value_count?: number;
  error?: string;
};

type MetadataOutputPanelProps = {
  metadataRecordId: number;
  metadataTitle?: string | null;
  metadataReferenceCode?: string | null;
  onClose: () => void;
};

function formatValue(value: unknown): string {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatConfidence(
  confidence: number | null
): string {
  if (
    confidence === null ||
    !Number.isFinite(confidence)
  ) {
    return "—";
  }

  return `${Math.round(confidence * 100)}%`;
}

function formatDateTime(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

export default function MetadataOutputPanel({
  metadataRecordId,
  metadataTitle,
  metadataReferenceCode,
  onClose,
}: MetadataOutputPanelProps) {
  const [values, setValues] = useState<
    MetadataOutputValue[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [recordTitle, setRecordTitle] =
    useState<string | null>(
      metadataTitle ?? null
    );

  const [recordReferenceCode, setRecordReferenceCode] =
    useState<string | null>(
      metadataReferenceCode ?? null
    );

  useEffect(() => {
    let cancelled = false;

    const loadOutput = async () => {
      setLoading(true);
      setError(null);
      setValues([]);

      try {
        const response =
          await getMetadataOutput(
            metadataRecordId
          );

        const payload =
          (await response.json()) as MetadataOutputResponse;

        if (!response.ok) {
          throw new Error(
            payload.error ||
              "Unable to retrieve universal metadata."
          );
        }

        if (cancelled) {
          return;
        }

        setValues(
          Array.isArray(payload.values)
            ? payload.values
            : []
        );

        setRecordTitle(
          payload.metadata_record?.title ??
            metadataTitle ??
            null
        );

        setRecordReferenceCode(
          payload.metadata_record
            ?.reference_code ??
            metadataReferenceCode ??
            null
        );
      } catch (requestError) {
        if (cancelled) {
          return;
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to retrieve universal metadata."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadOutput();

    return () => {
      cancelled = true;
    };
  }, [
    metadataRecordId,
    metadataTitle,
    metadataReferenceCode,
  ]);

  return (
    <section className="overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-violet-50">
      <div className="flex flex-col justify-between gap-4 border-b border-indigo-200 bg-gradient-to-r from-indigo-100 via-indigo-50 to-violet-100 px-6 py-5 md:flex-row md:items-start">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">
            M24A Universal Metadata Output
          </p>

          <h2 className="mt-1 text-xl font-bold text-indigo-950">
            {recordTitle || "Untitled"}
          </h2>

          <p className="mt-1 text-sm text-indigo-800">
            Reference code:{" "}
            <span className="font-bold text-indigo-950">
              {recordReferenceCode || "—"}
            </span>
          </p>

          <p className="mt-2 text-sm text-indigo-700">
            Only metadata fields with actual populated
            values are displayed.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-xl border border-indigo-300 bg-white/90 px-4 py-2 text-sm font-bold text-indigo-700 shadow-sm transition hover:border-indigo-400 hover:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Close
        </button>
      </div>

      {loading && (
        <div className="bg-indigo-50/70 px-6 py-10 text-center">
          <p className="font-bold text-indigo-900">
            Loading universal metadata...
          </p>

          <p className="mt-1 text-sm text-indigo-700">
            Retrieving populated metadata values for
            this record.
          </p>
        </div>
      )}

      {!loading && error && (
        <div className="px-6 py-8">
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <p className="font-semibold text-red-800">
              Unable to load universal metadata
            </p>

            <p className="mt-1 text-sm text-red-700">
              {error}
            </p>
          </div>
        </div>
      )}

      {!loading &&
        !error &&
        values.length === 0 && (
          <div className="bg-indigo-50/70 px-6 py-10 text-center">
            <p className="font-bold text-indigo-900">
              No populated universal metadata values.
            </p>

            <p className="mt-1 text-sm text-indigo-700">
              Metadata values will appear here when
              fields contain actual data.
            </p>
          </div>
        )}

      {!loading &&
        !error &&
        values.length > 0 && (
          <div className="bg-gradient-to-b from-violet-50/80 to-white p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-indigo-950">
                  Populated Metadata Fields
                </h3>

                <p className="mt-1 text-sm text-indigo-700">
                  {values.length} populated{" "}
                  {values.length === 1
                    ? "field"
                    : "fields"}{" "}
                  returned by the universal metadata
                  layer.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-indigo-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-indigo-100">
                <thead className="bg-indigo-100/80">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                      Field
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                      Value
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                      Category
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                      Type
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                      Source
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                      Confidence
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                      Verification
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-indigo-100 bg-white">
                  {values.map((item) => (
                    <tr
                      key={item.id}
                      className="align-top transition-colors hover:bg-indigo-50/50"
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">
                          {item.display_name}
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          {item.field_key}
                        </div>
                      </td>

                      <td className="max-w-md whitespace-pre-wrap break-words px-5 py-4 text-sm font-medium text-slate-800">
                        {formatValue(item.value)}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {item.category || "—"}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {item.data_type || "—"}
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                          {item.source || "—"}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {formatConfidence(
                          item.confidence
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-800">
                          {item.verification_status ||
                            "—"}
                        </span>

                        <div className="mt-1 text-xs text-slate-400">
                          Updated{" "}
                          {formatDateTime(
                            item.updated_at
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
    </section>
  );
}
