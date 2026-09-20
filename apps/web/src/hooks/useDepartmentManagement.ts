
import { useState } from "react";

import {
  createDepartment,
  deleteDepartmentRequest,
  getDepartments,
  updateDepartment,
} from "@/lib/api/departments";

import type { Department } from "@/types/departments";

type DepartmentForm = {
  name: string;
  code: string;
  description: string;
};

type UseDepartmentManagementOptions = {
  canManageDepartments: boolean;
  setSelectedDepartmentId: (
    value: number | null
  ) => void;
};

export function useDepartmentManagement({
  canManageDepartments,
  setSelectedDepartmentId,
}: UseDepartmentManagementOptions) {
  const [departments, setDepartments] =
    useState<Department[]>([]);

  const [
    departmentModalOpen,
    setDepartmentModalOpen,
  ] = useState(false);

  const [
    departmentEditingId,
    setDepartmentEditingId,
  ] = useState<number | null>(null);

  const [
    departmentForm,
    setDepartmentForm,
  ] = useState<DepartmentForm>({
    name: "",
    code: "",
    description: "",
  });

  const [
    departmentMutationError,
    setDepartmentMutationError,
  ] = useState("");

  const [
    departmentSaving,
    setDepartmentSaving,
  ] = useState(false);

  const refreshDepartments = async () => {
    const response = await getDepartments();

    const data =
      await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.error ||
          "Unable to retrieve departments."
      );
    }

    setDepartments(
      Array.isArray(data.departments)
        ? data.departments
        : []
    );
  };

  const openAddDepartmentModal = () => {
    if (!canManageDepartments) {
      return;
    }

    setDepartmentEditingId(null);

    setDepartmentForm({
      name: "",
      code: "",
      description: "",
    });

    setDepartmentMutationError("");
    setDepartmentModalOpen(true);
  };

  const openEditDepartmentModal = (
    department: Department
  ) => {
    if (!canManageDepartments) {
      return;
    }

    setDepartmentEditingId(
      department.id
    );

    setDepartmentForm({
      name: department.name,
      code: department.code,
      description:
        department.description || "",
    });

    setDepartmentMutationError("");
    setDepartmentModalOpen(true);
  };

  const closeDepartmentModal = () => {
    if (departmentSaving) {
      return;
    }

    setDepartmentModalOpen(false);
    setDepartmentMutationError("");
  };

  const saveDepartment = async () => {
    if (!canManageDepartments) {
      return;
    }

    const name =
      departmentForm.name.trim();

    const code =
      departmentForm.code
        .trim()
        .toUpperCase();

    const description =
      departmentForm.description.trim();

    if (!name || !code) {
      setDepartmentMutationError(
        "Department name and code are required."
      );

      return;
    }

    setDepartmentSaving(true);
    setDepartmentMutationError("");

    try {
      const response =
        departmentEditingId === null
          ? await createDepartment({
              name,
              code,
              description,
            })
          : await updateDepartment(
              departmentEditingId,
              {
                name,
                code,
                description,
              }
            );

      const data =
        await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Unable to save department."
        );
      }

      await refreshDepartments();

      setDepartmentModalOpen(false);
      setDepartmentMutationError("");
    } catch (error) {
      setDepartmentMutationError(
        error instanceof Error
          ? error.message
          : "Unable to save department."
      );
    } finally {
      setDepartmentSaving(false);
    }
  };

  const deleteDepartment = async (
    department: Department
  ): Promise<boolean> => {
    if (!canManageDepartments) {
      return false;
    }

    const confirmed =
      window.confirm(
        `Delete the "${department.name}" department? Existing metadata and documents will remain, but their department assignment will become unassigned.`
      );

    if (!confirmed) {
      return false;
    }

    setDepartmentMutationError("");

    try {
      const response =
        await deleteDepartmentRequest(
          department.id
        );

      const data =
        await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Unable to delete department."
        );
      }

      setSelectedDepartmentId(null);

      await refreshDepartments();

      return true;
    } catch (error) {
      setDepartmentMutationError(
        error instanceof Error
          ? error.message
          : "Unable to delete department."
      );

      return false;
    }
  };

  return {
    departments,
    setDepartments,

    departmentModalOpen,
    setDepartmentModalOpen,

    departmentEditingId,
    setDepartmentEditingId,

    departmentForm,
    setDepartmentForm,

    departmentMutationError,
    setDepartmentMutationError,

    departmentSaving,
    setDepartmentSaving,

    refreshDepartments,
    openAddDepartmentModal,
    openEditDepartmentModal,
    closeDepartmentModal,
    saveDepartment,
    deleteDepartment,
  };
}
