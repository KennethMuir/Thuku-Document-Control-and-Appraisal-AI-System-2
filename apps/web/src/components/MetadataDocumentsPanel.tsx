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
      console.log(
        "[MetadataDocumentsPanel] FETCH START",
        {
          metadataId: metadata.id,
          referenceCode:
            metadata.reference_code,
          title: metadata.title,
        }
      );

      setLoading(true);
      setError(null);
      setDocuments([]);

      try {
        const response =
          await getMetadataDocuments(
            metadata.id
          );

        console.log(
          "[MetadataDocumentsPanel] FETCH RESPONSE",
          {
            metadataId: metadata.id,
            status: response.status,
            ok: response.ok,
          }
        );

        const payload =
          await response.json();

        console.log(
          "[MetadataDocumentsPanel] FETCH PAYLOAD",
          payload
        );

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
          Array.isArray(
            payload?.documents
          )
            ? payload.documents
            : []
        );
      } catch (requestError) {
        console.error(
          "[MetadataDocumentsPanel] FETCH ERROR",
          requestError
        );

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

          console.log(
            "[MetadataDocumentsPanel] FETCH FINISHED",
            {
              metadataId: metadata.id,
            }
          );
        }
      }
    };

    void loadDocuments();

    return () => {
      cancelled = true;
    };
  }, [metadata.id]);

  return (
    <div className="mb-8 overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-blue-100 bg-blue-50 px-6 py-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
            Documents aligned to metadata
          </p>

          <h3 className="mt-1 text-lg font-semibold text-slate-900">
            {metadata.title || "Untitled"}
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Reference code:{" "}
            <span className="font-semibold text-slate-700">
              {metadata.reference_code}
            </span>
          </p>

          {!loading && !error && (
            <p className="mt-1 text-sm text-slate-500">
              {documents.length}{" "}
              {documents.length === 1
                ? "document"
                : "documents"}{" "}
              aligned to this metadata
              record.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          Close
        </button>
      </div>

      {loading ? (
        <div className="px-6 py-10 text-center">
          <p className="text-sm font-semibold text-slate-700">
            Fetching aligned documents...
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Loading the documents currently
            linked to this metadata record.
          </p>
        </div>
      ) : error ? (
        <div className="px-6 py-10 text-center">
          <p className="text-sm font-semibold text-red-700">
            Unable to load documents
          </p>

          <p className="mt-1 text-sm text-red-600">
            {error}
          </p>
        </div>
      ) : documents.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <p className="text-sm font-semibold text-slate-700">
            No documents are currently
            aligned to this metadata record.
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Uploaded documents can appear here
            after they are linked to this metadata
            record during appraisal.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-5 py-4 font-semibold text-slate-700">
                  Document
                </th>
                <th className="px-5 py-4 font-semibold text-slate-700">
                  Date
                </th>
                <th className="px-5 py-4 font-semibold text-slate-700">
                  File Type
                </th>
                <th className="px-5 py-4 font-semibold text-slate-700">
                  Size
                </th>
                <th className="px-5 py-4 font-semibold text-slate-700">
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
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-800">
                        {document.document_code ||
                          "—"}
                      </div>

                      <div className="mt-1 max-w-xl break-words text-xs text-slate-500">
                        {document.filename ||
                          "Unnamed document"}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {document.document_date
                        ? new Date(
                            document.document_date
                          ).toLocaleDateString()
                        : "—"}
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {document.file_type ||
                        "—"}
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {typeof document.file_size ===
                      "number"
                        ? `${(
                            document.file_size /
                            1024
                          ).toFixed(1)} KB`
                        : "—"}
                    </td>

                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {document.status ||
                          "—"}
                      </span>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
