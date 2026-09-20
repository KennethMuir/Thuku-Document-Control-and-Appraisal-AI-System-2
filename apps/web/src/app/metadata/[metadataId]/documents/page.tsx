"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getMetadataDocuments } from "@/lib/api/documents";
import type { MetadataLinkedDocument } from "@/types/metadata";

type MetadataSummary = {
  id: string;
  reference_code: string;
  title: string | null;
};

export default function MetadataDocumentsPage() {
  const router = useRouter();

  const params = useParams();

  const metadataId =
    typeof params.metadataId === "string"
      ? params.metadataId
      : Array.isArray(params.metadataId)
        ? params.metadataId[0]
        : "";

  const [metadata, setMetadata] =
    useState<MetadataSummary | null>(null);

  const [documents, setDocuments] =
    useState<MetadataLinkedDocument[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    if (!metadataId) {
      setError("Invalid metadata record ID.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadDocuments = async () => {
      setLoading(true);
      setError(null);

      try {
        const response =
          await getMetadataDocuments(metadataId);

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

        setMetadata(
          payload?.metadata ?? null
        );

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
  }, [metadataId]);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            ← Back to Metadata Registry
          </button>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-6">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-600">
              Metadata Record
            </p>

            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              {metadata?.title ||
                "Metadata Documents"}
            </h1>

            {metadata && (
              <p className="mt-2 text-sm text-slate-600">
                Reference code:{" "}
                <span className="font-semibold text-slate-900">
                  {metadata.reference_code}
                </span>
              </p>
            )}

            <p className="mt-3 text-sm text-slate-500">
              Documents currently aligned to this
              metadata record.
            </p>
          </div>

          {loading && (
            <div className="px-6 py-12 text-center">
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
              <div className="px-6 py-12 text-center">
                <p className="font-semibold text-slate-800">
                  No documents are aligned to this
                  metadata record.
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Documents linked during appraisal
                  will appear here.
                </p>
              </div>
            )}

          {!loading &&
            !error &&
            documents.length > 0 && (
              <div className="p-6">
                <div className="mb-4">
                  <h2 className="text-lg font-bold text-slate-900">
                    Linked Documents
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {documents.length}{" "}
                    {documents.length === 1
                      ? "document"
                      : "documents"}{" "}
                    linked to this metadata record.
                  </p>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="overflow-x-auto">
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
                              <div className="max-w-lg break-words font-medium text-slate-800">
                                {document.filename ||
                                  "Unnamed document"}
                              </div>

                              {document.title && (
                                <div className="mt-1 text-xs text-slate-500">
                                  {document.title}
                                </div>
                              )}
                            </td>

                            <td className="whitespace-nowrap px-5 py-4 align-top text-sm text-slate-600">
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

                            <td className="whitespace-nowrap px-5 py-4 align-top text-sm text-slate-600">
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
              </div>
            )}
        </section>
      </div>
    </main>
  );
}
