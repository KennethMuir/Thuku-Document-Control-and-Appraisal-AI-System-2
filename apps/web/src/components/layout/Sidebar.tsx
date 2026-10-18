"use client";

import type {
  AuthUser,
} from "@/types/auth";

import { NavItem } from "@/components/layout/NavItem";

export function Sidebar({
  activePage,
  setActivePage,
  canManageDocuments,
  setShowUploadModal,
  authUser,
  logout,
  loggingOut,
}: {
  activePage: string;
  setActivePage: (
    page: string
  ) => void;
  canManageDocuments: boolean;
  setShowUploadModal: (
    show: boolean
  ) => void;
  authUser: AuthUser | null;
  logout: () => Promise<void>;
  loggingOut: boolean;
}) {
  return (
<aside className="hidden w-64 border-r border-slate-200 bg-white lg:flex lg:flex-col">
          <div className="border-b border-slate-200 px-6 py-6">
            <div className="flex items-center gap-3">
              <div
                aria-hidden="true"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-lg font-bold text-white"
              >
                DA
              </div>

              <div>
                <p className="text-sm font-bold tracking-tight">
                  Document Appraisal
                </p>

                <p className="text-xs text-slate-500">
                  AI System
                </p>
              </div>
            </div>
          </div>

          <nav
            aria-label="Main navigation"
            className="flex-1 space-y-1 px-3 py-5"
          >
            <NavItem
              active={
                activePage ===
                "Dashboard"
              }
              icon="⌂"
              label="Dashboard"
              onClick={() =>
                setActivePage(
                  "Dashboard"
                )
              }
            />

            <NavItem
              active={
                activePage ===
                "Documents"
              }
              icon="▣"
              label="Documents"
              onClick={() =>
                setActivePage(
                  "Documents"
                )
              }
            />

            <NavItem
              active={
                activePage ===
                "Metadata Registry"
              }
              icon="◫"
              label="Metadata"
              onClick={() =>
                setActivePage(
                  "Metadata Registry"
                )
              }
            />


            <NavItem
              active={
                activePage ===
                "Search"
              }
              icon="⌕"
              label="Search"
              onClick={() =>
                setActivePage(
                  "Search"
                )
              }
            />

            <NavItem
              active={
                activePage ===
                "Departments"
              }
              icon="▤"
              label="Departments"
              onClick={() =>
                setActivePage(
                  "Departments"
                )
              }
            />

            <NavItem
              active={
                activePage ===
                "Settings"
              }
              icon="⚙"
              label="Settings"
              onClick={() =>
                setActivePage(
                  "Settings"
                )
              }
            />
          </nav>

          <div className="border-t border-slate-200 p-4">
            {canManageDocuments && (
<button
              type="button"
              onClick={() =>
                setShowUploadModal(
                  true
                )
              }
              className="app-sidebar-upload mb-4 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
            >
              + Upload Document
            </button>
            )}

            <div className="app-sidebar-account-card mb-4 rounded-xl border p-4">
              <div className="min-w-0">
                <p className="app-sidebar-account-name truncate text-sm font-semibold">
                  {authUser?.fullName ||
                    authUser?.email}
                </p>

                <p className="app-sidebar-account-email mt-1 truncate text-xs">
                  {authUser?.email}
                </p>

                <p className="app-sidebar-account-role mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
                  {authUser?.role}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  void logout();
                }}
                disabled={loggingOut}
                className="app-sidebar-account-signout mt-3 w-full rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loggingOut
                  ? "Signing out..."
                  : "Sign out"}
              </button>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                System status
              </p>

              <div className="mt-3 flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-full bg-emerald-500"
                />

                <span className="text-sm font-medium text-slate-700">
                  API connected
                </span>
              </div>
            </div>
          </div>
        </aside>
  );
}




