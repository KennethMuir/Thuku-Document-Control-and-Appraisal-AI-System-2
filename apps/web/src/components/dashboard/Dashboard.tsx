"use client";

import Link from "next/link";

import type {
  Dispatch,
  SetStateAction,
} from "react";

import type {
  Statistics,
} from "@/types/dashboard";

import type {
  Department,
} from "@/types/departments";

import type {
  UploadedDocument,
} from "@/types/documents";

import type {
  MetadataRecord,
} from "@/types/metadata";

type DashboardStatKey =
  | "documents"
  | "metadata"
  | "awaiting"
  | "review"
  | "linked"
  | "unlinked";

type DashboardStatCard = {
  key: DashboardStatKey;
  label: string;
  description: string;
  icon: string;
};

type DashboardProps = {
  statistics: Statistics | null;

  departments: Department[];

  documents: UploadedDocument[];

  metadata: MetadataRecord[];

  statCards: readonly DashboardStatCard[];

  dashboardDocumentFilter:
    | "ALL"
    | "LINKED"
    | "UNLINKED"
    | "REVIEW";

  dashboardMetadataFilter:
    | "ALL"
    | "AWAITING_DOCUMENT";

  canManageMetadata: boolean;

  setDashboardDocumentFilter:
    Dispatch<
      SetStateAction<
        | "ALL"
        | "LINKED"
        | "UNLINKED"
        | "REVIEW"
      >
    >;

  setDashboardMetadataFilter:
    Dispatch<
      SetStateAction<
        | "ALL"
        | "AWAITING_DOCUMENT"
      >
    >;

  setShowMetadataModal: (
    show: boolean
  ) => void;

  setActivePage: (
    page: string
  ) => void;

  handleDashboardStatCardClick: (
    key: DashboardStatKey
  ) => void;

  openDepartmentRecords: (
    department: Department
  ) => void;

  getStatValue: (
    key: DashboardStatKey
  ) => string | number;
};

function WorkflowStep({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-4">
      <div
        aria-hidden="true"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-bold text-slate-600"
      >
        {number}
      </div>

      <div>
        <p className="text-sm font-bold">
          {title}
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          {text}
        </p>
      </div>
    </div>
  );
}

export function Dashboard({
  statistics,
  departments,
  documents,
  metadata,
  statCards,
  dashboardDocumentFilter,
  dashboardMetadataFilter,
  canManageMetadata,
  setDashboardDocumentFilter,
  setDashboardMetadataFilter,
  setShowMetadataModal,
  setActivePage,
  handleDashboardStatCardClick,
  openDepartmentRecords,
  getStatValue,
}: DashboardProps) {
  return (
    <>

                <div className="mb-8 rounded-2xl bg-slate-900 p-7 text-white shadow-sm">
                  <div className="max-w-3xl">
                    <p className="text-sm font-semibold text-slate-300">
                      DOCUMENT APPRAISAL AI
                    </p>

                    <h2 className="mt-2 text-3xl font-bold tracking-tight">
                      Intelligent control of your institutional records.
                    </h2>

                    <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                      Register metadata before documents arrive, analyze
                      incoming files, identify possible matches, and maintain
                      a searchable relationship between metadata and physical
                      records.
                    </p>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    {canManageMetadata && (
<button
                      type="button"
                      onClick={() =>
                        setShowMetadataModal(
                          true
                        )
                      }
                      className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-900"
                    >
                      + Add Metadata
                    </button>
                    )}                    <Link
                      href="/metadata/values"
                      className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-900"
                    >
                      Universal Metadata Values
                    </Link>



                    <button
                      type="button"
                      onClick={() =>
                        setActivePage(
                          "Documents"
                        )
                      }
                      className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-900"
                    >
                      Browse Documents
                    </button>
                  </div>
                </div>

                <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {statCards.map(
                    (card) => (
                      <div
                        key={
                          card.key
                        }
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          handleDashboardStatCardClick(
                            card.key
                          )
                        }
                        onKeyDown={(event) => {
                          if (
                            event.key === "Enter" ||
                            event.key === " "
                          ) {
                            event.preventDefault();
                            handleDashboardStatCardClick(
                              card.key
                            );
                          }
                        }}
                        className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 ${
                          (
                            card.key === "documents" &&
                            dashboardDocumentFilter === "ALL"
                          ) ||
                          (
                            card.key === "metadata" &&
                            dashboardMetadataFilter === "ALL"
                          ) ||
                          (
                            card.key === "awaiting" &&
                            dashboardMetadataFilter === "AWAITING_DOCUMENT"
                          ) ||
                          (
                            card.key === "review" &&
                            dashboardDocumentFilter === "REVIEW"
                          ) ||
                          (
                            card.key === "linked" &&
                            dashboardDocumentFilter === "LINKED"
                          ) ||
                          (
                            card.key === "unlinked" &&
                            dashboardDocumentFilter === "UNLINKED"
                          )
                            ? "border-slate-900 ring-1 ring-slate-900"
                            : "border-slate-200"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-500">
                              {
                                card.label
                              }
                            </p>

                            <p className="mt-2 text-3xl font-bold tracking-tight">
                              {getStatValue(
                                card.key
                              )}
                            </p>
                          </div>

                          <div
                            aria-hidden="true"
                            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-700"
                          >
                            {
                              card.icon
                            }
                          </div>
                        </div>

                        <p className="mt-3 text-xs leading-5 text-slate-400">
                          {
                            card.description
                          }
                        </p>
                      </div>
                    )
                  )}
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
                  <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                      <div>
                        <h3 className="font-bold">
                          Department Records
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                          Browse records by organizational department.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setActivePage(
                            "Departments"
                          )
                        }
                        className="rounded-lg text-sm font-semibold text-slate-700 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                      >
                        View all
                      </button>
                    </div>

                    <div className="grid gap-3 p-5 sm:grid-cols-2">
                      {departments
                        .slice(0, 8)
                        .map(
                          (
                            department
                          ) => (
                            <button
                              type="button"
                              key={
                                department.id
                              }
                              onClick={() =>
                                openDepartmentRecords(
                                  department
                                )
                              }
                              className="group rounded-xl border border-slate-200 p-4 text-left transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div
                                    aria-hidden="true"
                                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-700"
                                  >
                                    {department.code.slice(
                                      0,
                                      2
                                    )}
                                  </div>

                                  <div>
                                    <p className="text-sm font-semibold">
                                      {
                                        department.name
                                      }
                                    </p>

                                    <p className="mt-0.5 text-xs text-slate-400">
                                      {
                                        department.code
                                      }
                                    </p>
                                  </div>
                                </div>

                                <span
                                  aria-hidden="true"
                                  className="text-slate-300 transition group-hover:text-slate-600"
                                >
                                  →
                                </span>
                              </div>
                            </button>
                          )
                        )}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 px-6 py-5">
                      <h3 className="font-bold">
                        Appraisal Workflow
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        How the system handles incoming records.
                      </p>
                    </div>

                    <div className="space-y-5 p-6">
                      <WorkflowStep
                        number="01"
                        title="Metadata first"
                        text="Create an expected record before the physical document arrives."
                      />

                      <WorkflowStep
                        number="02"
                        title="Document arrives"
                        text="Upload a PDF or DOCX and preserve its physical file securely."
                      />

                      <WorkflowStep
                        number="03"
                        title="Appraisal"
                        text="Extract available information and compare it against existing metadata."
                      />

                      <WorkflowStep
                        number="04"
                        title="Decision"
                        text="Strong matches link automatically; uncertain matches require user review."
                      />
                    </div>
                  </section>
                </div>

                <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-6">
                  <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                    <div>
                      <p className="text-sm font-bold">
                        Ready to register a record?
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Add metadata now, even if the physical document has
                        not arrived yet.
                      </p>
                    </div>

                    {canManageMetadata && (
<button
                      type="button"
                      onClick={() =>
                        setShowMetadataModal(
                          true
                        )
                      }
                      className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                    >
                      Create Metadata Record
                    </button>
                    )}
                  </div>
                </div>
              
    </>
  );
}


