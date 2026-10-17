"use client";

import { useEffect, useState } from "react";

import {
  getUsers,
  updateUser,
} from "@/lib/api/users";

import type {
  AuthUser,
  UserManagementUser,
} from "@/types/auth";

type ManagedUserChanges = {
  role?:
    | "ADMIN"
    | "APPRAISER"
    | "VIEWER";

  isActive?: boolean;
};

type UseUserManagementOptions = {
  authUser: AuthUser | null;
  activePage: string;
};

export function useUserManagement({
  authUser,
  activePage,
}: UseUserManagementOptions) {
  const [
    userManagementUsers,
    setUserManagementUsers,
  ] = useState<UserManagementUser[]>(
    []
  );

  const [
    userManagementLoading,
    setUserManagementLoading,
  ] = useState(false);

  const [
    userManagementError,
    setUserManagementError,
  ] = useState("");

  const [
    updatingUserId,
    setUpdatingUserId,
  ] = useState<number | null>(
    null
  );

  const canManageUsers =
    authUser?.organizationRole === "OWNER" ||
    authUser?.organizationRole === "ADMIN" ||
    (!authUser?.organizationRole && authUser?.role === "ADMIN");

  const loadUserManagementUsers =
    async () => {
      if (!canManageUsers) {
        return;
      }

      try {
        setUserManagementLoading(
          true
        );

        setUserManagementError("");

        const response =
          await getUsers();

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.error ||
              "Unable to retrieve users."
          );
        }

        setUserManagementUsers(
          Array.isArray(
            data.users
          )
            ? data.users
            : []
        );
      } catch (error) {
        console.error(
          "User management load failed:",
          error
        );

        setUserManagementUsers(
          []
        );

        setUserManagementError(
          error instanceof Error
            ? error.message
            : "Unable to retrieve users."
        );
      } finally {
        setUserManagementLoading(
          false
        );
      }
    };

  const updateManagedUser =
    async (
      userId: number,
      changes: ManagedUserChanges
    ) => {
      if (!canManageUsers) {
        return;
      }

      try {
        setUpdatingUserId(
          userId
        );

        setUserManagementError("");

        const response =
          await updateUser(
            userId,
            changes
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.error ||
              "Unable to update user."
          );
        }

        setUserManagementUsers(
          (
            currentUsers
          ) =>
            currentUsers.map(
              (
                user
              ) =>
                user.id ===
                userId
                  ? data.user
                  : user
            )
        );
      } catch (error) {
        console.error(
          "User update failed:",
          error
        );

        setUserManagementError(
          error instanceof Error
            ? error.message
            : "Unable to update user."
        );
      } finally {
        setUpdatingUserId(
          null
        );
      }
    };

  useEffect(() => {
    if (
      activePage === "Settings" && canManageUsers
    ) {
      void loadUserManagementUsers();
    }
  }, [
    activePage,
    canManageUsers,
  ]);

  return {
    userManagementUsers,
    setUserManagementUsers,

    userManagementLoading,
    setUserManagementLoading,

    userManagementError,
    setUserManagementError,

    updatingUserId,
    setUpdatingUserId,

    loadUserManagementUsers,
    updateManagedUser,
  };
}