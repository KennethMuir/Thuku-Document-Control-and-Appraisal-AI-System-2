"use client";

import {
  useParams,
  useRouter,
} from "next/navigation";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getDomainAffiliations,
} from "@/lib/api/domainRelationships";

type DomainSummary = {
  id: number;
  domain_key: string;
  display_name: string;
  description: string | null;
  domain_family: string;
  aliases: string[];
  organization_id: number | null;
  is_active: boolean;
};

type LinkedDocument = {
  id: string | number;
  document_code: string | null;
  filename: string | null;
  title: string | null;
  document_date: string | null;
  upload_date: string | null;
  year: number | null;
  person_name: string | null;
  status: string | null;
};

type DomainMetadataRecord = {
  relationship_id: string | number;
  metadata_record_id: string | number;
  relationship_type: string;
  reference_code: string | null;
  title: string | null;
  document_date: string | null;
  year: number | null;
  person_name: string | null;
  metadata_status: string | null;
  linked_documents: LinkedDocument[];
};

type DomainAffiliationsResponse = {
  success: boolean;
  domain: DomainSummary;
  metadata: DomainMetadataRecord[];
};

type DocumentRow = LinkedDocument & {
  reference_code: string | null;
  metadata_title: string | null;
  relationship_types: string[];
};

function formatDate(
  value: string | null
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(
    "en-GB",
    {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }
  );
}

function formatFileStatus(
  value: string | null
): string {
  if (!value) {
    return "—";
  }

  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

export default function DomainDocumentsPage() {
  const router = useRouter();

  const params = useParams();

  const domainKey =
    typeof params.domainKey === "string"
      ? params.domainKey
      : Array.isArray(params.domainKey)
        ? params.domainKey[0]
        : "";

  const [
    domain,
    setDomain,
  ] = useState<DomainSummary | null>(null);

  const [
    metadata,
    setMetadata,
  ] = useState<DomainMetadataRecord[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<string | null>(null);

  useEffect(() => {
    if (!domainKey) {
      setLoading(false);
      setError(
        "A valid domain was not provided."
      );
      return;
    }

    let cancelled = false;

    const loadDomainDocuments =
      async (): Promise<void> => {
        setLoading(true);
        setError(null);

        try {
          const response =
            await getDomainAffiliations(
              domainKey
            );

          let data: unknown = null;

          try {
            data = await response.json();
          } catch {
            data = null;
          }

          if (!response.ok) {
            const message =
              typeof data === "object" &&
              data !== null &&
              "error" in data &&
              typeof (
                data as {
                  error?: unknown;
                }
              ).error === "string"
                ? (
                    data as {
                      error: string;
                    }
                  ).error
                : "Unable to retrieve documents for this domain.";

            throw new Error(message);
          }

          const payload =
            data as DomainAffiliationsResponse;

          if (!payload.success) {
            throw new Error(
              "Unable to retrieve documents for this domain."
            );
          }

          if (cancelled) {
            return;
          }

          setDomain(payload.domain);
          setMetadata(
            Array.isArray(payload.metadata)
              ? payload.metadata
              : []
          );
        } catch (loadError: unknown) {
          if (cancelled) {
            return;
          }

          setDomain(null);
          setMetadata([]);

          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to retrieve documents for this domain."
          );
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      };

    void loadDomainDocuments();

    return () => {
      cancelled = true;
    };
  }, [domainKey]);

  const documents = useMemo<
    DocumentRow[]
  >(() => {
    const documentMap =
      new Map<
        string,
        DocumentRow
      >();

    for (const metadataRecord of metadata) {
      const linkedDocuments =
        Array.isArray(
          metadataRecord.linked_documents
        )
          ? metadataRecord.linked_documents
          : [];

      for (const document of linkedDocuments) {
        const documentId =
          String(document.id);

        const existing =
          documentMap.get(documentId);

        if (!existing) {
          documentMap.set(
            documentId,
            {
              ...document,
              reference_code:
                metadataRecord.reference_code,
              metadata_title:
                metadataRecord.title,
              relationship_types:
                metadataRecord.relationship_type
                  ? [
                      metadataRecord.relationship_type,
                    ]
                  : [],
            }
          );

          continue;
        }

        if (
          metadataRecord.relationship_type &&
          !existing.relationship_types.includes(
            metadataRecord.relationship_type
          )
        ) {
          existing.relationship_types.push(
            metadataRecord.relationship_type
          );
        }

        if (
          !existing.reference_code &&
          metadataRecord.reference_code
        ) {
          existing.reference_code =
            metadataRecord.reference_code;
        }

        if (
          !existing.metadata_title &&
          metadataRecord.title
        ) {
          existing.metadata_title =
            metadataRecord.title;
        }
      }
    }

    return Array.from(
      documentMap.values()
    );
  }, [metadata]);

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            ← Back to Domain Registry
          </button>
        </div>

        {loading && (
          <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <p
              role="status"
              aria-live="polite"
              className="text-sm text-slate-500"
            >
              Loading documents for this domain...
            </p>
          </section>
        )}

        {!loading && error && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <h1 className="text-lg font-bold text-red-800">
              Unable to load domain documents
            </h1>

            <p className="mt-2 text-sm text-red-700">
              {error}
            </p>
          </section>
        )}

        {!loading &&
          !error &&
          domain && (
            <>
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Domain
                    </p>

                    <h1 className="mt-1 text-2xl font-bold text-slate-950">
                      {domain.display_name}
                    </h1>

                    <p className="mt-1 text-sm font-semibold text-blue-600">
                      {domain.domain_key}
                    </p>

                    {domain.description && (
                      <p className="mt-3 max-w-3xl text-sm text-slate-600">
                        {domain.description}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Domain Family
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {domain.domain_family}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Tagged Documents
                      </p>

                      <p className="mt-1 text-xl font-bold text-slate-950">
                        {documents.length}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-6 py-5">
                  <h2 className="text-lg font-bold text-slate-950">
                    Documents Tagged with This Domain
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Documents associated with metadata records
                    that have this domain relationship.
                  </p>
                </div>

                {documents.length === 0 ? (
                  <div className="p-8 text-center">
                    <h3 className="text-base font-semibold text-slate-800">
                      No documents found
                    </h3>

                    <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-500">
                      No documents are currently linked to
                      metadata records tagged with this domain.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-slate-200 bg-slate-50">
                        <tr>
                          <th className="px-5 py-4 font-semibold">
                            Document Code
                          </th>

                          <th className="px-5 py-4 font-semibold">
                            Filename
                          </th>

                          <th className="px-5 py-4 font-semibold">
                            Metadata
                          </th>

                          <th className="px-5 py-4 font-semibold">
                            Relationship
                          </th>

                          <th className="px-5 py-4 font-semibold">
                            Document Date
                          </th>

                          <th className="px-5 py-4 font-semibold">
                            Upload Date
                          </th>

                          <th className="px-5 py-4 font-semibold">
                            Status
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {documents.map(
                          (document) => (
                            <tr
                              key={String(
                                document.id
                              )}
                              className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                            >
                              <td className="px-5 py-5 align-top">
                                <div className="font-semibold text-blue-600">
                                  {document.document_code ||
                                    "—"}
                                </div>
                              </td>

                              <td className="px-5 py-5 align-top">
                                <div className="font-medium text-slate-900">
                                  {document.filename ||
                                    "Untitled document"}
                                </div>

                                {document.title &&
                                  document.title !==
                                    document.filename && (
                                    <div className="mt-1 text-xs text-slate-500">
                                      {document.title}
                                    </div>
                                  )}
                              </td>

                              <td className="px-5 py-5 align-top">
                                <div className="font-semibold text-slate-800">
                                  {document.reference_code ||
                                    "—"}
                                </div>

                                {document.metadata_title && (
                                  <div className="mt-1 max-w-xs text-xs text-slate-500">
                                    {document.metadata_title}
                                  </div>
                                )}
                              </td>

                              <td className="px-5 py-5 align-top">
                                <div className="flex flex-wrap gap-1.5">
                                  {document.relationship_types.map(
                                    (
                                      relationshipType
                                    ) => (
                                      <span
                                        key={
                                          relationshipType
                                        }
                                        className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700"
                                      >
                                        {relationshipType}
                                      </span>
                                    )
                                  )}
                                </div>
                              </td>

                              <td className="px-5 py-5 align-top text-slate-600">
                                {formatDate(
                                  document.document_date
                                )}
                              </td>

                              <td className="px-5 py-5 align-top text-slate-600">
                                {formatDate(
                                  document.upload_date
                                )}
                              </td>

                              <td className="px-5 py-5 align-top">
                                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                  {formatFileStatus(
                                    document.status
                                  )}
                                </span>
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
      </div>
    </main>
  );
}