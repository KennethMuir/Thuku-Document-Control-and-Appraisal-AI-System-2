"use client";

import { useEffect, useState } from "react";

import {
  logoutUser,
} from "@/lib/api/auth";

import {
  getCurrentUserWithOrganizationRecovery,
} from "@/lib/api/organization-session";

import type { AuthUser } from "@/types/auth";

export function useAuthSession() {
  const [authUser, setAuthUser] =
    useState<AuthUser | null>(null);

  const [organizationName, setOrganizationName] =
    useState<string | null>(null);

  const [authLoading, setAuthLoading] =
    useState(true);

  const [authError, setAuthError] =
    useState("");

  const [loggingOut, setLoggingOut] =
    useState(false);

  const effectiveRole =
    authUser?.organizationRole;

  const canManageDocuments =
    effectiveRole === "OWNER" ||
    effectiveRole === "ADMIN" ||
    effectiveRole === "APPRAISER";

  const canManageMetadata =
    effectiveRole === "OWNER" ||
    effectiveRole === "ADMIN" ||
    effectiveRole === "APPRAISER";

  const canManageDepartments =
    effectiveRole === "OWNER" ||
    effectiveRole === "ADMIN";

  const canManageDomains =
    effectiveRole === "OWNER" ||
    effectiveRole === "ADMIN";

  useEffect(() => {
    let cancelled = false;

    const verifySession =
      async () => {
        try {
          setAuthError("");

          const response =
            await getCurrentUserWithOrganizationRecovery();

          const data =
            await response.json();

          if (cancelled) {
            return;
          }

          if (data.organizationSelectionRequired === true) {
            setAuthUser(null);
            setOrganizationName(null);
            window.location.replace("/select-organization");
            return;
          }

          if (
            !response.ok ||
            !data.success ||
            !data.authenticated ||
            !data.user
          ) {
            setAuthUser(null);
            setOrganizationName(null);

            setAuthError(
              data.error ||
                "Your session has expired. Please sign in again."
            );

            return;
          }

          setAuthUser({
            ...data.user,
            organizationRole: data.organization?.role,
          });

          setOrganizationName(
            typeof data.organization?.name ===
              "string"
              ? data.organization.name
              : null
          );
        } catch (error) {
          if (cancelled) {
            return;
          }

          console.error(
            "Session verification failed:",
            error
          );

          setAuthUser(null);
          setOrganizationName(null);

          setAuthError(
            "Unable to verify your session. Please sign in again."
          );
        } finally {
          if (!cancelled) {
            setAuthLoading(false);
          }
        }
      };

    void verifySession();

    return () => {
      cancelled = true;
    };
  }, []);

  const logout = async () => {
    if (loggingOut) {
      return;
    }

    try {
      setLoggingOut(true);

      await logoutUser();
    } catch (error) {
      console.error(
        "Logout request failed:",
        error
      );
    } finally {
      window.location.href =
        "/login";
    }
  };

  return {
    authUser,
    organizationName,
    authLoading,
    authError,
    loggingOut,

    canManageDocuments,
    canManageMetadata,
    canManageDepartments,
    canManageDomains,

    logout,
  };
}
