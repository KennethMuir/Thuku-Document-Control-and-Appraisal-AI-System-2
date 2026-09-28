"use client";

import type { DocumentDetailsData } from "@/hooks/useDocumentDetails";

type DocumentDetailsProps = {
  details: DocumentDetailsData | null;
  loading: boolean;
  error: string | null;
};

const readValue = (
  source: Record<string, unknown> | null | undefined,
  ...keys: string[]
): string => {
  if (!source) return "—";

  for (const key of keys) {
    const value = source[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return String(value);
    }
  }

  return "—";
};

const scopeLabel = (scope: unknown): string => {
  const value = String(scope ?? "").toUpperCase();

  if (value === "UNIVERSAL") return "Universal";
  if (value === "SPECIALIZED") return "Specialized";
  if (value === "ORGANIZATION") return "Organization";

  return value || "Unclassified";
};

const scopeClassName = (scope: unknown): string => {
  const value = String(scope ?? "").toUpperCase();

  if (value === "UNIVERSAL") {
    return "border-sky-500/30 bg-sky-500/10 text-sky-200";
  }

  if (value === "SPECIALIZED") {
    return "border-violet-500/30 bg-violet-500/10 text-violet-200";
  }

  if (value === "ORGANIZATION") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }

  return "border-white/10 bg-white/5 text-slate-300";
};

export default function DocumentDetails({
  details,
  loading,
  error,
}: DocumentDetailsProps) {
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

  const universal = details.domainClassifications.filter(
    (item) => String(item.domain_scope ?? "").toUpperCase() === "UNIVERSAL"
  );

  const specialized = details.domainClassifications.filter(
    (item) => String(item.domain_scope ?? "").toUpperCase() === "SPECIALIZED"
  );

  const organization = details.domainClassifications.filter(
    (item) => String(item.domain_scope ?? "").toUpperCase() === "ORGANIZATION"
  );

  const renderClassificationGroup = (
    title: string,
    items: Array<Record<string, unknown>>
  ) => (
    <div>
      <h5 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </h5>

      {items.length === 0 ? (
        <p className="text-sm text-slate-500">None</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((item, index) => (
            <span
              key={`${String(item.domain_id ?? "domain")}-${index}`}
              className={`rounded-full border px-3 py-1 text-xs ${scopeClassName(
                item.domain_scope
              )}`}
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

      <div className="grid gap-6 xl:grid-cols-2">
        <section>
          <h5 className="mb-3 text-sm font-semibold text-white">
            Document / File
          </h5>

          <div className="grid gap-3 sm:grid-cols-2">
            <DetailItem label="Document Code" value={readValue(details.document, "document_code")} />
            <DetailItem label="Upload Number" value={readValue(details.document, "upload_number")} />
            <DetailItem label="Filename" value={readValue(details.document, "filename")} />
            <DetailItem label="File Type" value={readValue(details.document, "file_type")} />
            <DetailItem label="File Size" value={readValue(details.document, "file_size")} />
            <DetailItem label="Upload Date" value={readValue(details.document, "upload_date")} />
          </div>
        </section>

        <section>
          <h5 className="mb-3 text-sm font-semibold text-white">
            Main Metadata
          </h5>

          <div className="grid gap-3 sm:grid-cols-2">
            <DetailItem label="Reference Code" value={readValue(details.mainMetadata, "reference_code")} />
            <DetailItem label="Title" value={readValue(details.mainMetadata, "title")} />
            <DetailItem label="Document Date" value={readValue(details.mainMetadata, "document_date")} />
            <DetailItem label="Year" value={readValue(details.mainMetadata, "year")} />
            <DetailItem label="Person" value={readValue(details.mainMetadata, "person_name")} />
            <DetailItem label="Department" value={readValue(details.mainMetadata, "department_name")} />
            <DetailItem label="Document Type" value={readValue(details.mainMetadata, "document_type_name")} />
            <DetailItem label="Status" value={readValue(details.mainMetadata, "status")} />
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section>
          <h5 className="mb-3 text-sm font-semibold text-white">
            Universal Metadata
          </h5>

          {details.universalMetadata.length === 0 ? (
            <p className="text-sm text-slate-500">No universal metadata values.</p>
          ) : (
            <div className="space-y-2">
              {details.universalMetadata.map((item, index) => (
                <div
                  key={`${String(item.field_id ?? "field")}-${index}`}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3"
                >
                  <p className="text-xs text-slate-500">
                    {readValue(item, "field_name", "display_name", "field_key")}
                  </p>
                  <p className="mt-1 text-sm text-slate-200">
                    {readValue(item, "value", "field_value")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h5 className="mb-3 text-sm font-semibold text-white">
            Additional Metadata
          </h5>

          {Object.keys(details.additionalMetadata).length === 0 ? (
            <p className="text-sm text-slate-500">No additional metadata.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(details.additionalMetadata).map(([key, value]) => (
                <div
                  key={key}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3"
                >
                  <p className="text-xs text-slate-500">{key}</p>
                  <p className="mt-1 break-words text-sm text-slate-200">
                    {typeof value === "object"
                      ? JSON.stringify(value)
                      : String(value ?? "—")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="mt-6">
        <h5 className="mb-4 text-sm font-semibold text-white">
          Domain Classifications
        </h5>

        <div className="space-y-4">
          {renderClassificationGroup("Universal", universal)}
          {renderClassificationGroup("Specialized", specialized)}
          {renderClassificationGroup("Organization", organization)}
        </div>
      </section>

      <section className="mt-6">
        <h5 className="mb-3 text-sm font-semibold text-white">
          Domain Relationships
        </h5>

        {details.domainRelationships.length === 0 ? (
          <p className="text-sm text-slate-500">
            No domain relationships recorded.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {details.domainRelationships.map((item, index) => (
              <span
                key={`${String(item.domain_id ?? "domain")}-${String(
                  item.relationship_type ?? "relationship"
                )}-${index}`}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300"
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
                {readValue(item, "relationship_type")}
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 break-words text-sm text-slate-200">{value}</p>
    </div>
  );
}

