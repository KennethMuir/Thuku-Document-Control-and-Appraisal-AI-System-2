"use client";

import { useEffect, useState } from "react";

import { getCurrentUserWithOrganizationRecovery } from "@/lib/api/organization-session";
import {
  setSelectedOrganizationId,
  type OrganizationOption,
} from "@/lib/organization/selection";

type CurrentUserResponse = {
  success?: boolean;
  authenticated?: boolean;
  user?: unknown;
  organizationSelectionRequired?: boolean;
  organization?: { id?: number; name?: string; role?: OrganizationOption["role"] } | null;
  organizations?: unknown;
  error?: string;
};

function isOrganizationOption(value: unknown): value is OrganizationOption {
  if (typeof value !== "object" || value === null) return false;

  const item = value as Partial<OrganizationOption>;

  return (
    typeof item.id === "number" &&
    Number.isSafeInteger(item.id) &&
    item.id > 0 &&
    typeof item.name === "string" &&
    ["OWNER", "ADMIN", "APPRAISER", "VIEWER"].includes(item.role ?? "")
  );
}

export default function SelectOrganizationPage() {
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadOrganizations() {
      try {
        const response = await getCurrentUserWithOrganizationRecovery();
        const data = await response.json() as CurrentUserResponse;

        if (cancelled) return;

        if (
          !response.ok ||
          !data.success ||
          !data.authenticated ||
          !data.user
        ) {
          setError(
            data.error || "Your session could not be verified. Please sign in again."
          );
          return;
        }

        const options = Array.isArray(data.organizations)
          ? data.organizations.filter(isOrganizationOption)
          : [];

        setOrganizations(options);

        if (data.organization && !data.organizationSelectionRequired) {
          window.location.replace("/");
          return;
        }
      } catch {
        if (!cancelled) {
          setError("Unable to load your organizations. Please try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadOrganizations();

    return () => {
      cancelled = true;
    };
  }, []);

  function chooseOrganization(organization: OrganizationOption) {
    try {
      setSelecting(true);
      setSelectedOrganizationId(organization.id);
      window.location.assign("/");
    } catch {
      setSelecting(false);
      setError("Unable to save the selection in this browser.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900">
      <section className="mx-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-widest text-indigo-700">
          Workspace access
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Select an organization</h1>
        <p className="mt-3 text-slate-600">
          Choose the organization you want to work in. Access is determined by
          your active membership in that organization.
        </p>

        {loading && (
          <p className="mt-8 text-slate-600" role="status">
            Loading your organizations…
          </p>
        )}

        {!loading && error && (
          <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800" role="alert">
            {error}
            <button
              type="button"
              className="mt-4 block rounded-lg bg-slate-900 px-4 py-2 text-white"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && organizations.length === 0 && (
          <p className="mt-8 rounded-lg bg-slate-100 p-4 text-slate-700">
            No active organizations are available for your account. Contact your
            platform administrator if you believe this is incorrect.
          </p>
        )}

        {!loading && !error && organizations.length > 0 && (
          <ul className="mt-8 space-y-3">
            {organizations.map((organization) => (
              <li key={organization.id}>
                <button
                  type="button"
                  disabled={selecting}
                  onClick={() => chooseOrganization(organization)}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 p-4 text-left transition hover:border-indigo-400 hover:bg-indigo-50 disabled:cursor-wait disabled:opacity-60"
                >
                  <span>
                    <span className="block font-semibold">{organization.name}</span>
                    <span className="mt-1 block text-sm text-slate-600">
                      Membership role: {organization.role}
                    </span>
                  </span>
                  <span aria-hidden="true" className="ml-4 text-xl text-indigo-700">
                    →
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}