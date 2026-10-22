"use client";

import type { Dispatch, ReactElement, SetStateAction } from "react";

import type { Department } from "@/types/departments";
import type { UploadedDocument } from "@/types/documents";
import type { MetadataRecord } from "@/types/metadata";
import type { SearchResult } from "@/types/search";
import type { ContentSearchResult } from "@/types/search";

type SearchProps = {
  searchLoading: boolean;
  searchError: string;
  contentSearchResults: ContentSearchResult[];
  contentSearchLoading: boolean;
  contentSearchError: string;
  searchResults: SearchResult[];
  searchTerm: string;
  setSearchTerm: Dispatch<SetStateAction<string>>;
  departments: Department[];
  documents: UploadedDocument[];
  metadata: MetadataRecord[];
  StatusBadge: (props: {
    status: string;
  }) => ReactElement;
  handleOpenDocument: (
    documentId: string | number
  ) => Promise<void> | void;
};

export function Search({
  searchLoading,
  searchError,
  contentSearchResults,
  contentSearchLoading,
  contentSearchError,
  searchResults,
  searchTerm,
  setSearchTerm,
  departments,
  documents,
  metadata,
  StatusBadge,
  handleOpenDocument,
}: SearchProps) {
  return (
    <>

                <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Records intelligence
                  </p>

                  <h2 className="mt-2 text-3xl font-bold">
                    Search the records
                  </h2>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                    Search across metadata and documents using document codes,
                    reference codes, people, titles, departments, sections,
                    document types, dates and statuses.
                  </p>

                  <div className="relative mt-6">
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                      ⌕
                    </span>

                    <input
                      aria-label="Search records"
                      value={
                        searchTerm
                      }
                      onChange={(
                        event
                      ) =>
                        setSearchTerm(
                          event.target
                            .value
                        )
                      }
                      placeholder="Search records..."
                      className="w-full rounded-xl border border-slate-200 px-11 py-4 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    />
                  </div>
                </div>

                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-6 py-5">
                    <h3 className="font-bold">
                      Search Results
                    </h3>

                    <p
                      role="status"
                      aria-live="polite"
                      className="mt-1 text-sm text-slate-500"
                    >
                      {searchLoading
                        ? "Searching records..."
                        : searchError
                          ? searchError
                          : searchTerm.trim()
                            ? `${searchResults.length} matching record${
                                searchResults.length ===
                                1
                                  ? ""
                                  : "s"
                              }`
                            : "Enter a search term to explore the registry."}
                    </p>
                  </div>

                  {searchError && (
                    <div
                      role="alert"
                      className="border-b border-red-100 bg-red-50 px-6 py-5"
                    >
                      <p className="font-semibold text-red-700">
                        Search unavailable
                      </p>

                      <p className="mt-1 text-sm text-red-600">
                        {searchError}
                      </p>
                    </div>
                  )}

                  <div className="divide-y divide-slate-100">
                    {searchLoading && (
                      <div className="p-12 text-center">
                        <div
                          aria-hidden="true"
                          className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700"
                        />

                        <p className="mt-4 font-semibold">
                          Searching your records
                        </p>

                        <p className="mt-2 text-sm text-slate-500">
                          Checking metadata and linked documents...
                        </p>
                      </div>
                    )}

                    {!searchLoading &&
                      !searchError &&
                      searchTerm.trim() &&
                      searchResults.map(
                        (record) => (
                          <div
                            key={
                              record.id
                            }
                            className="p-6 transition hover:bg-slate-50"
                          >
                            <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-3">
                                  <span className="font-bold text-blue-600">
                                    {
                                      record.reference_code
                                    }
                                  </span>

                                  <StatusBadge
                                    status={
                                      record.status
                                    }
                                  />

                                  {record.section && (
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                                      {
                                        record.section
                                      }
                                    </span>
                                  )}
                                </div>

                                <h4 className="mt-3 text-lg font-bold">
                                  {
                                    record.title ||
                                    "Untitled metadata record"
                                  }
                                </h4>

                                <div className="mt-3 grid gap-2 text-sm text-slate-500 md:grid-cols-2">
                                  <p>
                                    <span className="font-semibold text-slate-700">
                                      Person:
                                    </span>{" "}
                                    {
                                      record.person_name ||
                                      "Not recorded"
                                    }
                                  </p>

                                  <p>
                                    <span className="font-semibold text-slate-700">
                                      Department:
                                    </span>{" "}
                                    {
                                      record.department_name ||
                                      "Not assigned"
                                    }
                                  </p>

                                  <p>
                                    <span className="font-semibold text-slate-700">
                                      Type:
                                    </span>{" "}
                                    {
                                      record.document_type_name ||
                                      "Not assigned"
                                    }
                                  </p>

                                  <p>
                                    <span className="font-semibold text-slate-700">
                                      Year:
                                    </span>{" "}
                                    {
                                      record.year ||
                                      "Not recorded"
                                    }
                                  </p>

                                  <p>
                                    <span className="font-semibold text-slate-700">
                                      Document date:
                                    </span>{" "}
                                    {
                                      record.document_date ||
                                      "Not recorded"
                                    }
                                  </p>
                                </div>

                                {record.description && (
                                  <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-500">
                                    {
                                      record.description
                                    }
                                  </p>
                                )}
                              </div>

                              <div className="w-full lg:max-w-md">
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                    Linked documents
                                  </p>

                                  {record.linked_documents.length >
                                  0 ? (
                                    <div className="mt-3 space-y-3">
                                      {record.linked_documents.map(
                                        (document) => (
                                          <button
                                            type="button"
                                            key={
                                              document.id
                                            }
                                            onClick={(event) => {
                                              event.stopPropagation();

                                              void handleOpenDocument(
                                                document.id
                                              );
                                            }}
                                            className="block w-full rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                                          >
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                              <span className="font-bold text-blue-700">
                                                {
                                                  document.document_code
                                                }
                                              </span>

                                              <StatusBadge
                                                status={
                                                  document.status
                                                }
                                              />
                                            </div>

                                            <p className="mt-1 break-words text-sm font-medium text-slate-700">
                                              {
                                                document.filename
                                              }
                                            </p>

                                            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                                              {document.year && (
                                                <span>
                                                  Year:{" "}
                                                  {
                                                    document.year
                                                  }
                                                </span>
                                              )}

                                              {document.document_date && (
                                                <span>
                                                  Date:{" "}
                                                  {
                                                    document.document_date
                                                  }
                                                </span>
                                              )}

                                              {document.file_type && (
                                                <span>
                                                  {
                                                    document.file_type
                                                  }
                                                </span>
                                              )}
                                            </div>
                                          </button>
                                        )
                                      )}
                                    </div>
                                  ) : (
                                    <p className="mt-2 text-sm text-slate-500">
                                      No document is currently linked to
                                      this metadata record.
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      )}

                    {!searchLoading &&
                      !searchError &&
                      searchTerm.trim() &&
                      searchResults.length ===
                        0 && (
                        <div className="p-12 text-center">
                          <div
                            aria-hidden="true"
                            className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-lg"
                          >
                            ⌕
                          </div>

                          <p className="mt-4 font-semibold">
                            No matching records
                          </p>

                          <p className="mt-2 text-sm text-slate-500">
                            Try a document code, reference code,
                            person, title, department, section or
                            document type.
                          </p>
                        </div>
                      )}

                    {!searchLoading &&
                      !searchError &&
                      !searchTerm.trim() && (
                        <div className="p-12 text-center">
                          <div
                            aria-hidden="true"
                            className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-lg"
                          >
                            ⌕
                          </div>

                          <p className="mt-4 font-semibold">
                            Search your records
                          </p>

                          <p className="mt-2 text-sm text-slate-500">
                            Search by document code, reference code,
                            person, title, department, section,
                            document type, year or status.
                          </p>
                        </div>
                      )}
                  </div>

                <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-6 py-5">
                    <h3 className="font-bold">Document Content Matches</h3>
                    <p role="status" aria-live="polite" className="mt-1 text-sm text-slate-500">
                      {contentSearchLoading
                        ? "Searching document content..."
                        : contentSearchError
                          ? "Document content search is unavailable."
                          : searchTerm.trim()
                            ? `${contentSearchResults.length} matching document${contentSearchResults.length === 1 ? "" : "s"}`
                            : "Enter a search term to search inside document text."}
                    </p>
                    {contentSearchError && (
                      <p role="alert" className="mt-2 text-sm text-red-600">
                        {contentSearchError}
                      </p>
                    )}
                  </div>

                  {contentSearchLoading && searchTerm.trim() && (
                    <p className="px-6 py-5 text-sm text-slate-500">
                      Searching extracted text in your organization’s documents...
                    </p>
                  )}

                  {!contentSearchLoading &&
                    !contentSearchError &&
                    searchTerm.trim() &&
                    contentSearchResults.length === 0 && (
                      <p className="px-6 py-8 text-sm text-slate-500">
                        No document content matches this search.
                      </p>
                    )}

                  {!contentSearchLoading &&
                    !contentSearchError &&
                    contentSearchResults.map((result) => (
                      <div
                        key={`${result.document_id}-${result.match_position}`}
                        className="border-b border-slate-100 p-6 last:border-b-0"
                      >
                        <button
                          type="button"
                          onClick={() => void handleOpenDocument(result.document_id)}
                          className="w-full rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                        >
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="font-bold text-blue-700">
                              {result.document_code || "Document"}
                            </span>
                            <StatusBadge status={result.document_status} />
                            {result.reference_code && (
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                                Ref: {result.reference_code}
                              </span>
                            )}
                          </div>
                          <h4 className="mt-2 break-words font-semibold text-slate-800">
                            {result.document_title || result.filename || "Untitled document"}
                          </h4>
                          {result.filename && result.document_title && (
                            <p className="mt-1 break-words text-xs text-slate-500">
                              {result.filename}
                            </p>
                          )}
                        </button>
                        <p className="mt-3 rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                          {result.excerpt}
                        </p>
                      </div>
                    ))}
                </section>                </section>
    </>
  );
}
