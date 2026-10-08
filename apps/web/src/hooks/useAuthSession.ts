"use client";

import { useEffect, useState } from "react";

import {
  getCurrentUser,
  logoutUser,
} from "@/lib/api/auth";

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

  const canManageDocuments =
    authUser?.role === "ADMIN" ||
    authUser?.role === "APPRAISER";

  const canManageMetadata =
    authUser?.role === "ADMIN" ||
    authUser?.role === "APPRAISER";

  const canManageDepartments =
    authUser?.role === "ADMIN";

  const canManageDomains =
    authUser?.role === "ADMIN" ||
    authUser?.role === "OWNER";

  useEffect(() => {
    let cancelled = false;

    const verifySession =
      async () => {
        try {
          setAuthError("");

          const response =
            await getCurrentUser();

          const data =
            await response.json();

          if (cancelled) {
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

          setAuthUser(data.user);

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
