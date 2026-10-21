"use client";

import { useState } from "react";
import type { DocumentDetailsData } from "@/hooks/useDocumentDetails";
import { getAiDocumentDescription } from "@/lib/api/documentDetails";

type DocumentDetailsProps = {
  documentId: number;
  details: DocumentDetailsData | null;
  loading: boolean;
  error: string | null;
};

type SectionPalette = {
  section: string;
  heading: string;
  card: string;
  label: string;
  value: string;
  muted: string;
};

const readValue = (
  source: Record<string, unknown> | null | undefined,
  ...keys: string[]
): string => {
  if (!source) {
    return "—";
  }

  for (const key of keys) {
    const value = source[key];

    if (
      value !== null &&
      value !== undefined &&
      String(value).trim() !== ""
    ) {
      return String(value);
    }
  }

  return "—";
};

const readNestedValue = (
  source: Record<string, unknown> | null | undefined,
  parentKey: string,
  childKey: string
): string => {
  if (!source) {
    return "—";
  }

  const parent = source[parentKey];

  if (
    typeof parent !== "object" ||
    parent === null ||
    Array.isArray(parent)
  ) {
    return "—";
  }

  const value = (parent as Record<string, unknown>)[childKey];

  if (
    value !== null &&
    value !== undefined &&
    String(value).trim() !== ""
  ) {
    return String(value);
  }

  return "—";
};

const formatMetadataValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "—";
  }

  if (typeof value === "string") {
    return value.trim() === "" ? "—" : value;
  }

  if (
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
};

const getSectionPalette = (
  section: string
): SectionPalette => {
  switch (section) {
    case "Document / File":
      return {
        section:
          "rounded-xl border border-orange-400/20 bg-orange-500/[0.025] p-3",
        heading: "text-orange-300",
        card:
          "border-orange-400/20 bg-orange-500/[0.035]",
        label: "text-orange-300/70",
        value: "text-orange-100",
        muted: "text-orange-300/50",
      };

    case "Main Metadata":
      return {
        section:
          "rounded-xl border border-violet-400/20 bg-violet-500/[0.025] p-3",
        heading: "text-violet-300",
        card:
          "border-violet-400/20 bg-violet-500/[0.035]",
        label: "text-violet-300/70",
        value: "text-violet-100",
        muted: "text-violet-300/50",
      };

    case "Universal Metadata":
      return {
        section:
          "rounded-xl border border-cyan-400/20 bg-cyan-500/[0.025] p-3",
        heading: "text-cyan-300",
        card:
          "border-cyan-400/20 bg-cyan-500/[0.035]",
        label: "text-cyan-300/70",
        value: "text-cyan-100",
        muted: "text-cyan-300/50",
      };

    case "Additional Metadata":
      return {
        section:
          "rounded-xl border border-rose-400/20 bg-rose-500/[0.025] p-3",
        heading: "text-rose-300",
        card:
          "border-rose-400/20 bg-rose-500/[0.035]",
        label: "text-rose-300/70",
        value: "text-rose-100",
        muted: "text-rose-300/50",
      };

    case "Domain Relationships":
      return {
        section:
          "rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/[0.02] p-3",
        heading: "text-fuchsia-300",
        card:
          "border-fuchsia-400/20 bg-fuchsia-500/[0.03]",
        label: "text-fuchsia-300/70",
        value: "text-fuchsia-100",
        muted: "text-fuchsia-300/50",
      };

    default:
      return {
        section:
          "rounded-xl border border-white/10 bg-white/[0.015] p-3",
        heading: "text-slate-300",
        card:
          "border-white/10 bg-white/[0.03]",
        label: "text-slate-500",
        value: "text-slate-200",
        muted: "text-slate-500",
      };
  }
};

const getClassificationPalette = (
  scope: string
): SectionPalette => {
  switch (scope) {
    case "UNIVERSAL":
      return {
        section:
          "rounded-xl border border-blue-400/20 bg-blue-500/[0.025] p-3",
        heading: "text-blue-300",
        card:
          "border-blue-400/20 bg-blue-500/[0.04]",
        label: "text-blue-300/70",
        value: "text-blue-100",
        muted: "text-blue-300/50",
      };

    case "SPECIALIZED":
      return {
        section:
          "rounded-xl border border-amber-400/20 bg-amber-500/[0.025] p-3",
        heading: "text-amber-300",
        card:
          "border-amber-400/20 bg-amber-500/[0.04]",
        label: "text-amber-300/70",
        value: "text-amber-100",
        muted: "text-amber-300/50",
      };

    case "ORGANIZATION":
      return {
        section:
          "rounded-xl border border-emerald-400/20 bg-emerald-500/[0.025] p-3",
        heading: "text-emerald-300",
        card:
          "border-emerald-400/20 bg-emerald-500/[0.04]",
        label: "text-emerald-300/70",
        value: "text-emerald-100",
        muted: "text-emerald-300/50",
      };

    default:
      return {
        section:
          "rounded-xl border border-white/10 bg-white/[0.015] p-3",
        heading: "text-slate-300",
        card:
          "border-white/10 bg-white/[0.03]",
        label: "text-slate-500",
        value: "text-slate-200",
        muted: "text-slate-500",
      };
  }
};

export default function DocumentDetails({
  documentId,
  details,
  loading,
  error,
}: DocumentDetailsProps) {
  const [aiDescription, setAiDescription] = useState<string | null>(null);
  const [aiDescriptionLoading, setAiDescriptionLoading] = useState(false);
  const [aiDescriptionError, setAiDescriptionError] = useState<string | null>(null);

  const handleGetAiDescription = async () => {
    if (
      aiDescriptionLoading ||
      !Number.isInteger(documentId) ||
      documentId <= 0
    ) {
      return;
    }

    setAiDescriptionLoading(true);
    setAiDescriptionError(null);
    setAiDescription(null);

    try {
      const response = await getAiDocumentDescription(documentId);
      const payload = await response.json().catch(() => null);

      if (
        !response.ok ||
        payload?.success !== true ||
        typeof payload?.data?.aiDescription !== "string" ||
        !payload.data.aiDescription.trim()
      ) {
        throw new Error(
          payload?.error || "Could not generate an AI description."
        );
      }

      setAiDescription(payload.data.aiDescription);
    } catch (requestError) {
      setAiDescriptionError(
        requestError instanceof Error
          ? requestError.message
          : "Could not generate an AI description."
      );
    } finally {
      setAiDescriptionLoading(false);
    }
  };
  if (loading) {
    return (
      <div className="border-t border-white/10 bg-slate-950/70 px-6 py-6">
        <div className="animate-pulse text-sm text-slate-400">
          Loading document details…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-t border-red-500/20 bg-red-950/20 px-6 py-5">
        <p className="text-sm text-red-300">{error}</p>
      </div>
    );
  }

  if (!details) {
    return null;
  }

  const mainMetadata = details.mainMetadata;

  const universal = details.domainClassifications.filter(
    (item) =>
      String(item.domain_scope ?? "").toUpperCase() === "UNIVERSAL"
  );

  const specialized = details.domainClassifications.filter(
    (item) =>
      String(item.domain_scope ?? "").toUpperCase() === "SPECIALIZED"
  );

  const organization = details.domainClassifications.filter(
    (item) =>
      String(item.domain_scope ?? "").toUpperCase() === "ORGANIZATION"
  );

  const renderClassificationGroup = (
    title: string,
    items: Array<Record<string, unknown>>
  ) => {
    const scope = title.toUpperCase();
    const palette = getClassificationPalette(scope);

    return (
      <div className={palette.section}>
        <h5
          className={`mb-3 text-xs font-semibold uppercase tracking-[0.16em] ${palette.heading}`}
        >
          {title}
        </h5>

        {items.length === 0 ? (
          <p className={`text-sm ${palette.muted}`}>
            None
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {items.map((item, index) => (
              <span
                key={`${String(item.domain_id ?? "domain")}-${index}`}
                className={`rounded-full border px-3 py-1 text-xs ${palette.card} ${palette.value}`}
              >
                {readValue(
                  item,
                  "domain_display_name",
                  "display_name",
                  "domain_name",
                  "name",
                  "domain_key"
                )}

                {item.specialization_name
                  ? ` · ${String(item.specialization_name)}`
                  : ""}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  const documentFilePalette =
    getSectionPalette("Document / File");

  const mainMetadataPalette =
    getSectionPalette("Main Metadata");

  const universalMetadataPalette =
    getSectionPalette("Universal Metadata");

  const additionalMetadataPalette =
    getSectionPalette("Additional Metadata");

  const relationshipPalette =
    getSectionPalette("Domain Relationships");

  return (
    <div className="border-t border-white/10 bg-slate-950/70 px-6 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
            Document Details
          </p>

          <h4 className="mt-1 text-lg font-semibold text-white">
            {readValue(details.document, "filename", "title")}
          </h4>
        </div>

        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
          {readValue(details.document, "status")}
        </span>
      </div>
      <section className="mb-4 rounded-xl border border-sky-400/20 bg-sky-500/[0.025] p-4">
        <h5 className="mb-2 text-sm font-semibold text-sky-300">
          Description
        </h5>
        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-200">
          {readValue(mainMetadata, "description")}
        </p>
      </section>
      <section className="mb-6 rounded-xl border border-violet-400/20 bg-violet-500/[0.025] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h5 className="text-sm font-semibold text-violet-300">
              AI-enhanced description
            </h5>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Generate a separate, AI-enhanced explanation from the saved description.
              This will not replace or modify your saved metadata.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGetAiDescription}
            disabled={
              aiDescriptionLoading ||
              readValue(mainMetadata, "description") === "—"
            }
            className="rounded-lg border border-violet-400/30 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-200 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {aiDescriptionLoading ? "Generating…" : "Get AI Description"}
          </button>
        </div>

        {aiDescriptionError && (
          <p role="alert" className="mt-3 text-sm text-red-300">
            {aiDescriptionError}
          </p>
        )}

        {aiDescription && (
          <div className="mt-4 rounded-lg border border-white/10 bg-slate-950/50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-violet-300">
              AI-generated result
            </p>
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-200">
              {aiDescription}
            </p>
          </div>
        )}
      </section>
      <div className="space-y-6">
        <section className={documentFilePalette.section}>
          <h5
            className={`mb-3 text-sm font-semibold ${documentFilePalette.heading}`}
          >
            Document / File
          </h5>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            <DetailItem
              label="Document Code"
              value={readValue(
                details.document,
                "document_code"
              )}
              palette={documentFilePalette}
            />

            <DetailItem
              label="Upload Number"
              value={readValue(
                details.document,
                "upload_number"
              )}
              palette={documentFilePalette}
            />

            <DetailItem
              label="Filename"
              value={readValue(
                details.document,
                "filename"
              )}
              palette={documentFilePalette}
            />

            <DetailItem
              label="File Type"
              value={readValue(
                details.document,
                "file_type"
              )}
              palette={documentFilePalette}
            />

            <DetailItem
              label="File Size"
              value={readValue(
                details.document,
                "file_size"
              )}
              palette={documentFilePalette}
            />

            <DetailItem
              label="Upload Date"
              value={readValue(
                details.document,
                "upload_date"
              )}
              palette={documentFilePalette}
            />
          </div>
        </section>

        <section className={mainMetadataPalette.section}>
          <h5
            className={`mb-3 text-sm font-semibold ${mainMetadataPalette.heading}`}
          >
            Main Metadata
          </h5>

          {!mainMetadata ? (
            <p className={`text-sm ${mainMetadataPalette.muted}`}>
              No metadata record is attached to this document.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
              <DetailItem
                label="Metadata ID"
                value={readValue(mainMetadata, "id")}
                palette={mainMetadataPalette}
              />

              <DetailItem
                label="Reference Code"
                value={readValue(
                  mainMetadata,
                  "reference_code"
                )}
                palette={mainMetadataPalette}
              />

              <DetailItem
                label="Title"
                value={readValue(mainMetadata, "title")}
                palette={mainMetadataPalette}
              />

              <DetailItem
                label="Document Date"
                value={readValue(
                  mainMetadata,
                  "document_date"
                )}
                palette={mainMetadataPalette}
              />

              <DetailItem
                label="Year"
                value={readValue(mainMetadata, "year")}
                palette={mainMetadataPalette}
              />

              <DetailItem
                label="Person"
                value={readValue(
                  mainMetadata,
                  "person_name"
                )}
                palette={mainMetadataPalette}
              />

              <DetailItem
                label="Department"
                value={readNestedValue(
                  mainMetadata,
                  "department",
                  "name"
                )}
                palette={mainMetadataPalette}
              />

              <DetailItem
                label="Department Code"
                value={readNestedValue(
                  mainMetadata,
                  "department",
                  "code"
                )}
                palette={mainMetadataPalette}
              />

              <DetailItem
                label="Department ID"
                value={readNestedValue(
                  mainMetadata,
                  "department",
                  "id"
                )}
                palette={mainMetadataPalette}
              />

              <DetailItem
                label="Document Type"
                value={readNestedValue(
                  mainMetadata,
                  "document_type",
                  "name"
                )}
                palette={mainMetadataPalette}
              />

              <DetailItem
                label="Document Type ID"
                value={readNestedValue(
                  mainMetadata,
                  "document_type",
                  "id"
                )}
                palette={mainMetadataPalette}
              />

              <DetailItem
                label="Section"
                value={readValue(
                  mainMetadata,
                  "section"
                )}
                palette={mainMetadataPalette}
              />

              <DetailItem
                label="Status"
                value={readValue(
                  mainMetadata,
                  "status"
                )}
                palette={mainMetadataPalette}
              />

              <DetailItem
                label="Created"
                value={readValue(
                  mainMetadata,
                  "created_at"
                )}
                palette={mainMetadataPalette}
              />

              <DetailItem
                label="Updated"
                value={readValue(
                  mainMetadata,
                  "updated_at"
                )}
                palette={mainMetadataPalette}
              />
            </div>
          )}
        </section>
      </div>

      <div className="mt-6 space-y-6">
        <section className={universalMetadataPalette.section}>
          <h5
            className={`mb-3 text-sm font-semibold ${universalMetadataPalette.heading}`}
          >
            Universal Metadata
          </h5>

          {details.universalMetadata.length === 0 ? (
            <p
              className={`text-sm ${universalMetadataPalette.muted}`}
            >
              No universal metadata values.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
              {details.universalMetadata.map((item, index) => (
                <div
                  key={`${String(
                    item.field_registry_id ?? "field"
                  )}-${String(item.id ?? index)}`}
                  className={`rounded-lg border px-4 py-3 ${universalMetadataPalette.card}`}
                >
                  <p
                    className={`text-xs ${universalMetadataPalette.label}`}
                  >
                    {readValue(
                      item,
                      "display_name",
                      "field_key"
                    )}
                  </p>

                  <p
                    className={`mt-1 break-words text-sm ${universalMetadataPalette.value}`}
                  >
                    {formatMetadataValue(item.value)}
                  </p>

                  {item.field_key ? (
                    <p
                      className={`mt-1 text-[11px] ${universalMetadataPalette.muted}`}
                    >
                      {String(item.field_key)}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={additionalMetadataPalette.section}>
          <h5
            className={`mb-3 text-sm font-semibold ${additionalMetadataPalette.heading}`}
          >
            Additional Metadata
          </h5>

          {Object.keys(details.additionalMetadata).length === 0 ? (
            <p
              className={`text-sm ${additionalMetadataPalette.muted}`}
            >
              No additional metadata.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
              {Object.entries(details.additionalMetadata).map(
                ([key, value]) => (
                  <div
                    key={key}
                    className={`rounded-lg border px-4 py-3 ${additionalMetadataPalette.card}`}
                  >
                    <p
                      className={`text-xs ${additionalMetadataPalette.label}`}
                    >
                      {key}
                    </p>

                    <p
                      className={`mt-1 break-words text-sm ${additionalMetadataPalette.value}`}
                    >
                      {formatMetadataValue(value)}
                    </p>
                  </div>
                )
              )}
            </div>
          )}
        </section>
      </div>

      <section className="mt-6">
        <h5 className="mb-4 text-sm font-semibold text-white">
          Domain Classifications
        </h5>

        <div className="grid gap-4 lg:grid-cols-3">
          {renderClassificationGroup(
            "Universal",
            universal
          )}

          {renderClassificationGroup(
            "Specialized",
            specialized
          )}

          {renderClassificationGroup(
            "Organization",
            organization
          )}
        </div>
      </section>

      <section
        className={`mt-6 ${relationshipPalette.section}`}
      >
        <h5
          className={`mb-3 text-sm font-semibold ${relationshipPalette.heading}`}
        >
          Domain Relationships
        </h5>

        {details.domainRelationships.length === 0 ? (
          <p className={`text-sm ${relationshipPalette.muted}`}>
            No domain relationships recorded.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            {details.domainRelationships.map(
              (item, index) => (
                <span
                  key={`${String(
                    item.domain_id ?? "domain"
                  )}-${String(
                    item.relationship_type ??
                      "relationship"
                  )}-${index}`}
                  className={`min-w-0 rounded-lg border px-3 py-2.5 text-sm ${relationshipPalette.card} ${relationshipPalette.value}`}
                >
                  {readValue(
                    item,
                    "domain_display_name",
                    "display_name",
                    "domain_name",
                    "name",
                    "domain_key"
                  )}

                  {" · "}

                  {readValue(
                    item,
                    "relationship_type"
                  )}
                </span>
              )
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function DetailItem({
  label,
  value,
  palette,
}: {
  label: string;
  value: string;
  palette: SectionPalette;
}) {
  return (
    <div
      className={`min-w-0 rounded-lg border px-3 py-2.5 ${palette.card}`}
    >
      <p
        className={`truncate text-[10px] font-semibold uppercase tracking-[0.12em] ${palette.label}`}
      >
        {label}
      </p>

      <p
        className={`mt-1 break-words text-sm leading-5 ${palette.value}`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}
