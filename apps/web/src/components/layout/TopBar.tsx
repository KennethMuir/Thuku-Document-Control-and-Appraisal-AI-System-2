"use client";

export function TopBar({
  activePage,
  setActivePage,
  canManageDocuments,
  setShowUploadModal,
}: {
  activePage: string;
  setActivePage: (
    page: string
  ) => void;
  canManageDocuments: boolean;
  setShowUploadModal: (
    show: boolean
  ) => void;
}) {
  return (
<header className="border-b border-slate-200 bg-white">
            <div className="flex flex-col justify-between gap-4 px-6 py-5 md:flex-row md:items-center lg:px-10">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Records intelligence
                </p>

                <h1 className="mt-1 text-2xl font-bold tracking-tight">
                  {activePage}
                </h1>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setActivePage(
                      "Search"
                    )
                  }
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                >
                  Search
                </button>

                {canManageDocuments && (
<button
                  type="button"
                  onClick={() =>
                    setShowUploadModal(
                      true
                    )
                  }
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                >
                  + Upload Document
                </button>
                )}
              </div>
            </div>
          </header>
  );
}
