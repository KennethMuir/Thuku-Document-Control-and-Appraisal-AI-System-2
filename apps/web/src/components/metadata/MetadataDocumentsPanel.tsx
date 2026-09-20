"use client";

import { useEffect, useState } from "react";

import { getMetadataDocuments } from "@/lib/api/documents";
import type {
  MetadataLinkedDocument,
  MetadataRecord,
} from "@/types/metadata";

type MetadataDocumentsPanelProps = {
  metadata: MetadataRecord;
  onClose: () => void;
};

export default function MetadataDocumentsPanel({
  metadata,
  onClose,
}: MetadataDocumentsPanelProps) {
  const [documents, setDocuments] = useState<
    MetadataLinkedDocument[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadDocuments = async () => {
      setLoading(true);
      setError(null);
      setDocuments([]);

      try {
        const response =
          await getMetadataDocuments(
            metadata.id
          );

        const payload =
          await response.json();

        if (!response.ok) {
          throw new Error(
            payload?.error ||
              "Unable to retrieve documents."
          );
        }

        if (cancelled) {
          return;
        }

        setDocuments(
          Array.isArray(payload?.documents)
            ? payload.documents
            : []
        );
      } catch (requestError) {
        if (cancelled) {
          return;
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to retrieve documents."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadDocuments();

    return () => {
      cancelled = true;
    };
  }, [metadata.id]);

  return (
    <section className="mb-8 rounded-2xl border border-blue-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-blue-200 bg-blue-50 px-6 py-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600">
            Aligned Documents
          </p>

          <h3 className="mt-1 text-lg font-bold text-slate-900">
            {metadata.title || "Untitled"}
          </h3>

          <p className="mt-1 text-sm text-slate-600">
            Reference code:{" "}
            <span className="font-semibold text-slate-900">
              {metadata.reference_code}
            </span>
          </p>

          {!loading && !error && (
            <p className="mt-2 text-sm font-semibold text-blue-700">
              {documents.length}{" "}
              {documents.length === 1
                ? "document"
                : "documents"}{" "}
              found
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Close
        </button>
      </div>

      {loading && (
        <div className="px-6 py-10 text-center">
          <p className="font-semibold text-slate-800">
            Fetching documents...
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Retrieving documents linked to this
            metadata record.
          </p>
        </div>
      )}

      {!loading && error && (
        <div className="px-6 py-10">
          <div className="rounded-xl border border-red-200 bg-red-50 p-5">
            <p className="font-semibold text-red-800">
              Unable to load documents
            </p>

            <p className="mt-1 text-sm text-red-700">
              {error}
            </p>
          </div>
        </div>
      )}

      {!loading &&
        !error &&
        documents.length === 0 && (
          <div className="px-6 py-10 text-center">
            <p className="font-semibold text-slate-800">
              No documents are aligned to this
              metadata record.
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Documents linked during appraisal will
              appear here.
            </p>
          </div>
        )}

      {!loading &&
        !error &&
        documents.length > 0 && (
          <div className="p-6">
            <div className="mb-4">
              <h4 className="text-base font-bold text-slate-900">
                Documents linked to this metadata
              </h4>

              <p className="mt-1 text-sm text-slate-500">
                These documents were retrieved from
                the document registry for this metadata
                record.
              </p>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                      Document Code
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                      Filename
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                      Document Date
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                      File Type
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                      File Size
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 bg-white">
                  {documents.map((document) => (
                    <tr
                      key={String(document.id)}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-5 py-4 align-top">
                        <span className="font-bold text-blue-700">
                          {document.document_code ||
                            "—"}
                        </span>
                      </td>

                      <td className="px-5 py-4 align-top">
                        <div className="max-w-md break-words font-medium text-slate-800">
                          {document.filename ||
                            "Unnamed document"}
                        </div>

                        {document.title && (
                          <div className="mt-1 text-xs text-slate-500">
                            {document.title}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4 align-top whitespace-nowrap text-sm text-slate-600">
                        {document.document_date
                          ? new Date(
                              document.document_date
                            ).toLocaleDateString()
                          : "—"}
                      </td>

                      <td className="px-5 py-4 align-top text-sm text-slate-600">
                        {document.file_type ||
                          "—"}
                      </td>

                      <td className="px-5 py-4 align-top whitespace-nowrap text-sm text-slate-600">
                        {typeof document.file_size ===
                        "number"
                          ? `${(
                              document.file_size /
                              1024
                            ).toFixed(1)} KB`
                          : "—"}
                      </td>

                      <td className="px-5 py-4 align-top">
                        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                          {document.status ||
                            "—"}
                        </span>
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
