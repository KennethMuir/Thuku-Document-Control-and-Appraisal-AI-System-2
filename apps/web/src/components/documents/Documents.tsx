"use client";

import Link from "next/link";
import {
  useMemo,
  useState,
  type Dispatch,
  type ReactElement,
  type SetStateAction,
} from "react";

import type {
  UploadedDocument,
} from "@/types/documents";

import type {
  MetadataRecord,
} from "@/types/metadata";

import { useDocumentDetails } from "@/hooks/useDocumentDetails";

import DocumentDetails from "./DocumentDetails";
import DocumentActionsMenu from "./DocumentActionsMenu";
import { UniversalMetadataGuide } from "@/components/metadata/UniversalMetadataGuide";

type DocumentDomainScope =
  | "UNIVERSAL"
  | "SPECIALIZED"
  | "ORGANIZATION";

type DocumentDomainClassification = {
  domain_id?: string | number;
  domain_key?: string;
  domain_name?: string;
  domain_scope?: string;
};

type DocumentTab =
  | "ALL"
  | "UNIVERSAL_SPECIALIZED"
  | "ORGANIZATION";

type DocumentsProps = {
  setActivePage: Dispatch<SetStateAction<string>>;
  documents:
    UploadedDocument[];

  dashboardFilteredDocuments:
    UploadedDocument[];

  metadata:
    MetadataRecord[];

  dashboardDocumentFilter:
    | "ALL"
    | "LINKED"
    | "UNLINKED"
    | "REVIEW";

  onDocumentsChanged: () => Promise<void>;
  canManageDocuments:
    boolean;

  canManageDomains:
    boolean;

  loading:
    boolean;

  setShowUploadModal:
    Dispatch<
      SetStateAction<boolean>
    >;

  setReviewError:
    Dispatch<
      SetStateAction<string>
    >;

  handleOpenDocument:
    (documentId: string | number) => void;

  formatFileSize:
    (
      bytes:
        number |
        null |
        undefined
    ) => string;

  StatusBadge:
    (props: {
      status: string;
    }) => ReactElement;
};

function getDocumentDomainClassifications(
  document: UploadedDocument
): DocumentDomainClassification[] {
  const value =
    document.domain_classifications;

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (
      item
    ): item is DocumentDomainClassification =>
      typeof item === "object" &&
      item !== null
  );
}

function normalizeDomainScope(
  value: unknown
): DocumentDomainScope | null {
  if (
    value === "UNIVERSAL" ||
    value === "SPECIALIZED" ||
    value === "ORGANIZATION"
  ) {
    return value;
  }

  return null;
}

function documentHasDomainScope(
  document: UploadedDocument,
  scopes: DocumentDomainScope[]
): boolean {
  const classifications =
    getDocumentDomainClassifications(
      document
    );

  return classifications.some(
    (classification) => {
      const scope =
        normalizeDomainScope(
          classification.domain_scope
        );

      return (
        scope !== null &&
        scopes.includes(scope)
      );
    }
  );
}

export function Documents({
  documents,
  dashboardFilteredDocuments,
  metadata,
  dashboardDocumentFilter,
  onDocumentsChanged,
  canManageDocuments,
  canManageDomains,
  loading,
  setActivePage,
  setShowUploadModal,
  setReviewError,
  handleOpenDocument,
  formatFileSize,
  StatusBadge,
}: DocumentsProps) {
  const [
    activeDocumentTab,
    setActiveDocumentTab,
  ] = useState<DocumentTab>(
    "ALL"
  );

  const {
    expandedDocumentId,
    documentDetails,
    loadingDocumentDetails,
    documentDetailsError,
    openDocumentDetails,
    closeDocumentDetails,
  } = useDocumentDetails();
  const [
    showUniversalMetadataGuide,
    setShowUniversalMetadataGuide,
  ] = useState(false);

  const documentsForDomainTabs =
    useMemo(() => {
      const source = documents;

      if (
        activeDocumentTab ===
        "ALL"
      ) {
        return source;
      }

      if (
        activeDocumentTab ===
        "ORGANIZATION"
      ) {
        return source.filter(
          (document) =>
            documentHasDomainScope(
              document,
              ["ORGANIZATION"]
            )
        );
      }

      return source.filter(
        (document) =>
          documentHasDomainScope(
            document,
            [
              "UNIVERSAL",
              "SPECIALIZED",
            ]
          )
      );
    }, [
      activeDocumentTab,
      documents,
    ]);

  const handleDocumentDetails = (
    documentId:
      string |
      number
  ) => {
    const numericDocumentId =
      Number(documentId);

    if (
      !Number.isInteger(
        numericDocumentId
      ) ||
      numericDocumentId <= 0
    ) {
      setReviewError(
        "Unable to open document details because the document ID is invalid."
      );
      return;
    }

    void openDocumentDetails(
      numericDocumentId
    );
  };


  const handleDocumentAction = (
    document: UploadedDocument
  ) => {
    if (document.id == null) {
      setReviewError(
        "This document does not have a valid document ID."
      );
      return;
    }

    if (
      expandedDocumentId ===
      document.id
    ) {
      closeDocumentDetails();
      return;
    }

    handleDocumentDetails(
      document.id
    );
  };

  const renderDocumentRow = (
    document: UploadedDocument
  ) => {
    const documentId =
      document.id;

    const isExpanded =
      documentId != null &&
      String(expandedDocumentId) ===
        String(documentId);

    const classifications =
      getDocumentDomainClassifications(
        document
      );

    const universalCount =
      classifications.filter(
        (classification) =>
          normalizeDomainScope(
            classification.domain_scope
          ) === "UNIVERSAL"
      ).length;

    const specializedCount =
      classifications.filter(
        (classification) =>
          normalizeDomainScope(
            classification.domain_scope
          ) === "SPECIALIZED"
      ).length;

    const organizationCount =
      classifications.filter(
        (classification) =>
          normalizeDomainScope(
            classification.domain_scope
          ) === "ORGANIZATION"
      ).length;

    return (
      <tbody
        key={
          documentId ??
          document.document_code ??
          document.filename
        }
      >
        <tr
          className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
          onClick={(event) => {
            const target = event.target;

            if (
              target instanceof Element &&
              target.closest("button, a, input, select, textarea")
            ) {
              return;
            }

            handleDocumentAction(document);
          }}
        >
          <td className="px-5 py-5">
            <span className="font-bold text-blue-600">
              {
                document.document_code ??
                "—"
              }
            </span>
          </td>

          <td className="px-5 py-5 font-medium">
            {
              document.filename ??
              "—"
            }
          </td>

          <td className="px-5 py-5">
            {
              document.file_type ??
              "—"
            }
          </td>

          <td className="px-5 py-5">
            {formatFileSize(
              document.file_size
            )}
          </td>

          <td className="px-5 py-5">
            <StatusBadge
              status={
                document.status ??
                "UNKNOWN"
              }
            />
          </td>

          <td className="px-5 py-5">
<div className="flex items-center justify-end gap-3">
              <div className="hidden items-center gap-1 text-xs text-slate-500 md:flex">
                {universalCount >
                  0 && (
                  <span className="rounded-full bg-slate-100 px-2 py-1">
                    U {universalCount}
                  </span>
                )}

                {specializedCount >
                  0 && (
                  <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">
                    S {specializedCount}
                  </span>
                )}

                {organizationCount >
                  0 && (
                  <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">
                    O {organizationCount}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() =>
                  handleDocumentAction(
                    document
                  )
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
              >
                {isExpanded
                  ? "Close"
                  : "Open"}
              </button>

              {documentId != null && (
                <DocumentActionsMenu
                  documentId={documentId}
                  metadataRecordId={
                    document["metadata_record_id"] == null
                      ? null
                      : document["metadata_record_id"] as string | number
                  }
                  canManageDocuments={
                    canManageDocuments
                  }
                  canManageDomains={
                    canManageDomains
                  }
                  onDeleted={
                    onDocumentsChanged
                  }
                  onDomainChanged={
                    onDocumentsChanged
                  }
                />
              )}
            </div>
          </td>
        </tr>

        {isExpanded && (
          <tr className="border-b border-slate-200 bg-slate-50">
            <td
              colSpan={6}
              className="p-0"
            >
              <DocumentDetails
                key={expandedDocumentId ?? "no-document"}
                documentId={expandedDocumentId ?? 0}
                details={
                  documentDetails
                }
                loading={
                  loadingDocumentDetails
                }
                error={
                  documentDetailsError
                }
              />
            </td>
          </tr>
        )}
      </tbody>
    );
  };

  return (
    <>
      <div className="mb-8 rounded-2xl bg-slate-900 p-7 text-white">
        <p className="text-sm font-semibold text-slate-300">
          DOCUMENT LIBRARY
        </p>

        <h2 className="mt-2 text-3xl font-bold">
          Institutional Document Library
        </h2>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
          Securely store, identify and organize incoming PDF and
          DOCX records. Each uploaded document receives a unique
          system document code.
        </p>


        <div className="mt-5">
          <button
            type="button"
            onClick={() =>
              setActivePage("Domain Registry")
            }
            className="group w-full rounded-2xl border border-slate-700 bg-slate-900/70 px-5 py-4 text-left shadow-sm transition hover:border-slate-500 hover:bg-slate-900"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Domain Registry
                </p>

                <h3 className="mt-1 text-base font-bold text-white">
                  Learn More about Domains
                </h3>

                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
                  Explore the domains available for document classification,
                  including Universal, Specialized, and Organization domains,
                  with their existing classification and relationship
                  capabilities.
                </p>
              </div>

              <span className="shrink-0 text-sm font-semibold text-slate-300 transition group-hover:text-white">
                Open Domain Registry →
              </span>
            </div>
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
  <div className="flex flex-col gap-3 rounded-2xl border border-slate-700 bg-slate-900/70 p-5 md:flex-row md:items-center md:justify-between md:flex-1">
    <div>
      <p className="text-sm font-semibold text-white">
        Universal Metadata
      </p>
      <p className="mt-1 text-sm text-slate-300">
        Browse the universal metadata catalogue and its field groups.
      </p>
    </div>

    <div className="flex shrink-0 flex-wrap gap-2">
      <Link
        href="/metadata/values"
        className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
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
        className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
      >
        {showUniversalMetadataGuide
          ? "Hide Guide"
          : "Learn more"}
      </button>
    </div>
  </div>

  {canManageDocuments && (
    <button
      type="button"
      onClick={() =>
        setShowUploadModal(
          true
        )
      }
      className="shrink-0 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-900"
    >
      + Upload Document
    </button>
  )}
</div>

{showUniversalMetadataGuide && (
  <div className="mt-4">
    <UniversalMetadataGuide
      onClose={() =>
        setShowUniversalMetadataGuide(false)
      }
    />
  </div>
)}
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200">
          <div className="px-6 pt-5">
            <h3 className="font-bold">
              Uploaded Documents
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              {dashboardDocumentFilter ===
              "ALL"
                ? "Documents currently stored in the records system."
                : dashboardDocumentFilter ===
                    "LINKED"
                  ? "Showing documents linked to metadata."
                  : dashboardDocumentFilter ===
                      "UNLINKED"
                    ? "Showing documents requiring appraisal."
                    : "Showing documents requiring review."}
            </p>
          </div>

          <div
            className="mt-5 flex border-b border-slate-200 px-6"
            role="tablist"
            aria-label="Document domain classification"
          >
            <button
              type="button"
              role="tab"
              aria-selected={
                activeDocumentTab === "ALL"
              }
              onClick={() =>
                setActiveDocumentTab("ALL")
              }
              className={`border-b-2 px-5 py-3 text-sm font-semibold transition ${
                activeDocumentTab === "ALL"
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              All
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={
                activeDocumentTab ===
                "UNIVERSAL_SPECIALIZED"
              }
              onClick={() =>
                setActiveDocumentTab(
                  "UNIVERSAL_SPECIALIZED"
                )
              }
              className={`border-b-2 px-5 py-3 text-sm font-semibold transition ${
                activeDocumentTab ===
                "UNIVERSAL_SPECIALIZED"
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              Universal &amp; Specialized
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={
                activeDocumentTab ===
                "ORGANIZATION"
              }
              onClick={() =>
                setActiveDocumentTab(
                  "ORGANIZATION"
                )
              }
              className={`border-b-2 px-5 py-3 text-sm font-semibold transition ${
                activeDocumentTab ===
                "ORGANIZATION"
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              Organization
            </button>
          </div>
        </div>

        {loading ? (
          <div
            role="status"
            aria-live="polite"
            className="p-10 text-center text-sm text-slate-500"
          >
            Loading documents...
          </div>
        ) : documentsForDomainTabs.length ===
          0 ? (
          <div className="p-12 text-center">
            <div
              aria-hidden="true"
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100"
            >
              ▣
            </div>

            <h3 className="mt-4 font-bold">
              {activeDocumentTab ===
              "ALL"
                ? "No documents are currently stored."
                : "No documents in this domain category"}
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              {activeDocumentTab ===
              "ALL"
                ? "There are no documents currently available in the records system."
                : activeDocumentTab ===
                    "ORGANIZATION"
                  ? "No documents currently have an Organization domain classification."
                  : "No documents currently have a Universal or Specialized domain classification."}
            </p>

            {canManageDocuments && (
              <button
                type="button"
                onClick={() =>
                  setShowUploadModal(
                    true
                  )
                }
                className="mt-5 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
              >
                Upload Document
              </button>
            )}
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
                    Type
                  </th>

                  <th className="px-5 py-4 font-semibold">
                    Size
                  </th>

                  <th className="px-5 py-4 font-semibold">
                    Status
                  </th>

                  <th className="px-5 py-4 text-right font-semibold">
                    Action
                  </th>
                </tr>
              </thead>

              {documentsForDomainTabs.map(
                renderDocumentRow
              )}
            </table>
          </div>
        )}
      </section>
    </>
  );
}












