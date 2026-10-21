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

import type {
  OrganizationDashboardSettings,
} from "@/types/organizationDashboardSettings";

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
  organizationName: string | null;
  dashboardSettings: OrganizationDashboardSettings;
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
  organizationName,
  dashboardSettings,
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
    <div
      className="min-w-0 rounded-2xl"
      style={{
        backgroundColor: dashboardSettings.theme === "DARK" ? "#0F172A" : dashboardSettings.backgroundColor,
        color: dashboardSettings.theme === "DARK" ? "#F8FAFC" : dashboardSettings.textColor,
        ...(dashboardSettings.brandingImages?.DASHBOARD
          ? {
              backgroundImage: "linear-gradient(rgba(0,0,0,0.75), rgba(0,0,0,0.75)), var(--app-dashboard-image)",
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }
          : {}),
      }}
    >

                {dashboardSettings.showWelcomePanel && (
<div
  className={`mb-8 rounded-2xl border p-7 shadow-xl ring-1 ring-black/5 ${dashboardSettings.dashboardLayout === "COMPACT" ? "md:p-5" : ""}`}
  style={{
    background: dashboardSettings.brandingImages?.INTRODUCTION
      ? undefined
      : dashboardSettings.headerStyle === "GRADIENT"
        ? `linear-gradient(135deg, ${dashboardSettings.primaryColor}, ${dashboardSettings.accentColor})`
        : dashboardSettings.primaryColor,
    ...(dashboardSettings.brandingImages?.INTRODUCTION
      ? {
          backgroundImage: "linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), var(--app-introduction-image)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }
      : {}),
    borderColor: dashboardSettings.primaryColor,
    color: "#FFFFFF",
  }}
>
                  <div className="max-w-3xl">
                    <p className="text-sm font-semibold text-slate-300">
                      DOCUMENT APPRAISAL AI
                    </p>

                    <h2 className="mt-2 text-3xl font-bold tracking-tight">
                      {organizationName ? `${organizationName} Records Intelligence` : "Records Intelligence"}
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

                )}
  <div className={`mb-8 grid sm:grid-cols-2 xl:grid-cols-3 ${dashboardSettings.dashboardLayout === "COMPACT" ? "gap-2" : "gap-4"}`}>
                  {statCards.filter((card) => dashboardSettings.visibleStatCards.includes(card.key)).map(
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
                        className={`rounded-2xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 ${
                          (
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
                          )
                            ? "border-slate-900 bg-white ring-1 ring-slate-900"
                            : card.key === "documents"
                              ? "border-slate-200 bg-blue-50/70 hover:border-slate-300"
                              : card.key === "metadata"
                                ? "border-slate-200 bg-violet-50/70 hover:border-slate-300"
                                : card.key === "awaiting"
                                  ? "border-amber-100 bg-amber-50/70 hover:border-amber-200"
                                  : card.key === "review"
                                    ? "border-yellow-100 bg-yellow-50/70 hover:border-yellow-200"
                                    : card.key === "linked"
                                      ? "border-emerald-100 bg-emerald-50/70 hover:border-emerald-200"
                                      : "border-rose-100 bg-rose-50/70 hover:border-rose-200"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-500">
                              {
                                card.label
                              }
                            </p>

                            <p
                              className={`mt-2 text-3xl font-bold tracking-tight ${
                                card.key === "documents"
                                  ? "text-blue-700"
                                  : card.key === "metadata"
                                    ? "text-violet-700"
                                    : card.key === "awaiting"
                                      ? "text-amber-700"
                                      : card.key === "review"
                                        ? "text-yellow-700"
                                        : card.key === "linked"
                                          ? "text-emerald-700"
                                          : "text-rose-700"
                              }`}
                            >
                              {getStatValue(
                                card.key
                              )}
                            </p>
                          </div>

                          <div
                            aria-hidden="true"
                            className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold ${
                              card.key === "documents"
                                ? "bg-blue-100 text-blue-700"
                                : card.key === "metadata"
                                  ? "bg-violet-100 text-violet-700"
                                  : card.key === "awaiting"
                                    ? "bg-amber-100 text-amber-700"
                                    : card.key === "review"
                                      ? "bg-yellow-100 text-yellow-700"
                                      : card.key === "linked"
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-rose-100 text-rose-700"
                            }`}
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
              
    </div>
  );
}










