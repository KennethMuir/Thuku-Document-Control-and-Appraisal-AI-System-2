"use client";

import React from "react";

type UniversalMetadataGuideProps = {
  onClose: () => void;
};

const groups = [
  ["Core", 7],
  ["Persons", 8],
  ["Organizations", 4],
  ["Dates & Lifecycle", 12],
  ["Records Management", 8],
  ["Content & Subject", 7],
  ["Legal / Regulatory", 3],
  ["Security", 4],
  ["Financial", 5],
  ["Procurement / Contracts", 6],
  ["Human Resources", 4],
  ["Projects", 3],
  ["Engineering", 4],
  ["Aviation", 4],
  ["Healthcare", 2],
  ["Research / Scientific", 2],
  ["Education", 2],
  ["Geographic", 7],
  ["Technical", 7],
  ["Media / Audiovisual", 3],
  ["Archival", 2],
  ["Preservation", 2],
  ["Workflow / Approval", 2],
  ["Relationships", 3],
] as const;

export function UniversalMetadataGuide({
  onClose,
}: UniversalMetadataGuideProps) {
  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
      <div className="border-b border-blue-100 bg-blue-50 px-6 py-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
              Universal metadata
            </p>

            <h2 className="mt-1 text-2xl font-bold text-slate-950">
              Catalogue contents
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Browse the universal metadata field catalogue. Fields are
              grouped by business and records-management context and remain
              backed by the global field registry.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Close Guide
          </button>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-2xl font-bold text-slate-950">
              24
            </div>
            <div className="mt-1 text-sm text-slate-500">
              Groups
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-2xl font-bold text-slate-950">
              104
            </div>
            <div className="mt-1 text-sm text-slate-500">
              Unique fields
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-2xl font-bold text-slate-950">
              Universal
            </div>
            <div className="mt-1 text-sm text-slate-500">
              Catalogue
            </div>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Expand All
          </button>

          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Collapse All
          </button>

          <input
            type="search"
            placeholder="Search catalogue"
            className="min-w-[240px] flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {groups.map(([name, count]) => (
            <div
              key={name}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="font-semibold text-slate-800">
                  {name}
                </span>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {count} fields
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-6 py-5">
        <p className="text-sm leading-6 text-slate-600">
          The catalogue is a navigation and governance layer over the
          universal field registry. It does not create separate metadata
          tables. Actual metadata values remain stored through the
          universal metadata value architecture.
        </p>
      </div>
    </section>
  );
}
