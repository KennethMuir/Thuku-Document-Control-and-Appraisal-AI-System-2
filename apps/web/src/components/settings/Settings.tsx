"use client";

import type { ReactNode } from "react";

import type {
  AuthUser,
  UserManagementUser,
} from "@/types/auth";

type SettingsProps = {
  authUser: AuthUser;
  userManagementUsers: UserManagementUser[];
  userManagementLoading: boolean;
  userManagementError: string;
  updatingUserId: number | null;
  updateManagedUser: (
    userId: number,
    changes: {
      role?: "ADMIN" | "APPRAISER" | "VIEWER";
      isActive?: boolean;
    }
  ) => Promise<void> | void;
};

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5">
        <h3 className="font-bold">
          {title}
        </h3>

        <p className="mt-1 text-sm text-slate-500">
          {description}
        </p>
      </div>

      <div className="divide-y divide-slate-100">
        {children}
      </div>
    </section>
  );
}

function SettingRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <span className="text-sm text-slate-600">
        {label}
      </span>

      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
        {value}
      </span>
    </div>
  );
}

export function Settings({
  authUser,
  userManagementUsers,
  userManagementLoading,
  userManagementError,
  updatingUserId,
  updateManagedUser,
}: SettingsProps) {
  return (
    <>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          System configuration
        </p>

        <h2 className="mt-1 text-2xl font-bold">
          Settings
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Basic system information and current configuration.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SettingsCard
          title="Document Processing"
          description="Current document formats accepted by the system."
        >
          <SettingRow
            label="PDF documents"
            value="Supported"
          />

          <SettingRow
            label="DOCX documents"
            value="Supported"
          />

          <SettingRow
            label="OCR"
            value="Planned"
          />
        </SettingsCard>

        <SettingsCard
          title="System Connection"
          description="Application connectivity information."
        >
          <SettingRow
            label="API"
            value="Connected"
          />

          <SettingRow
            label="Database"
            value="PostgreSQL"
          />

          <SettingRow
            label="Environment"
            value="Local"
          />
        </SettingsCard>

        {(authUser?.organizationRole === "OWNER" || authUser?.organizationRole === "ADMIN" || (!authUser?.organizationRole && authUser?.role === "ADMIN")) && (
          <SettingsCard
            title="User Management"
            description="Manage application access, roles, and account status."
          >
            <div className="px-6 py-5">
              {userManagementError && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {userManagementError}
                </div>
              )}

              {userManagementLoading ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                  Loading users...
                </div>
              ) : userManagementUsers.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                  No users found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-400">
                        <th className="px-3 py-3">
                          User
                        </th>
                        <th className="px-3 py-3">
                          Role
                        </th>
                        <th className="px-3 py-3">
                          Status
                        </th>
                        <th className="px-3 py-3 text-right">
                          Access
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {userManagementUsers.map(
                        (user) => {
                          const isCurrentUser =
                            user.id ===
                            authUser.id;

                          const actorRole = authUser.organizationRole ?? authUser.role;
                          const membershipRole = user.membershipRole ?? user.role;
                          const roleRank = { OWNER: 0, ADMIN: 1, APPRAISER: 2, VIEWER: 3 } as const;
                          const cannotManageTarget = membershipRole === "OWNER" || roleRank[membershipRole] <= roleRank[actorRole];

                          const isUpdating =
                            updatingUserId ===
                            user.id;

                          return (
                            <tr
                              key={user.id}
                              className="align-middle"
                            >
                              <td className="px-3 py-4">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-800">
                                    {user.fullName ||
                                      "Unnamed user"}
                                  </p>

                                  <p className="mt-1 truncate text-xs text-slate-500">
                                    {user.email}
                                  </p>
                                </div>
                              </td>

                              <td className="px-3 py-4">
                                <select
                                  value={membershipRole === "OWNER" ? "ADMIN" : user.role}
                                  disabled={isUpdating || isCurrentUser || cannotManageTarget}
                                  onChange={(
                                    event
                                  ) => {
                                    const role =
                                      event
                                        .target
                                        .value as
                                        | "ADMIN"
                                        | "APPRAISER"
                                        | "VIEWER";

                                    void updateManagedUser(
                                      user.id,
                                      { role }
                                    );
                                  }}
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60"
                                >
                                  <option value="VIEWER">
                                    VIEWER
                                  </option>
                                  <option value="APPRAISER">
                                    APPRAISER
                                  </option>
                                  <option value="ADMIN">
                                    {membershipRole === "OWNER" ? "OWNER" : "ADMIN"}
                                  </option>
                                </select>
                              </td>

                              <td className="px-3 py-4">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                                    user.isActive
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-slate-100 text-slate-500"
                                  }`}
                                >
                                  {user.isActive
                                    ? "Active"
                                    : "Inactive"}
                                </span>
                              </td>

                              <td className="px-3 py-4 text-right">
                                <button
                                  type="button"
                                  disabled={isUpdating || isCurrentUser || cannotManageTarget}
                                  onClick={() => {
                                    void updateManagedUser(
                                      user.id,
                                      {
                                        isActive:
                                          !user.isActive,
                                      }
                                    );
                                  }}
                                  className={`rounded-lg border px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                    user.isActive
                                      ? "border-red-200 text-red-700 hover:bg-red-50"
                                      : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                  }`}
                                >
                                  {isUpdating
                                    ? "Updating..."
                                    : user.isActive
                                      ? "Deactivate"
                                      : "Activate"}
                                </button>
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="mt-4 text-xs leading-5 text-slate-400">
                You cannot change your own account or manage users with an equal or higher organization role. The organization must retain an active administrator.
              </p>
            </div>
          </SettingsCard>
        )}
      </div>
    </>
  );
}
