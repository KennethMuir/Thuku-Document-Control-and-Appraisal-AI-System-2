import { apiFetch } from "@/lib/api/client";

export const getDepartments = async (): Promise<Response> => {
  return apiFetch(
    "/api/departments",
    {
      method: "GET",
    }
  );
};

export const createDepartment = async (
  data: {
    name: string;
    code: string;
    description: string;
  }
): Promise<Response> => {
  return apiFetch(
    "/api/departments",
    {
      method: "POST",
      json: data,
    }
  );
};

export const updateDepartment = async (
  id: number,
  data: {
    name: string;
    code: string;
    description: string;
  }
): Promise<Response> => {
  return apiFetch(
    `/api/departments/${id}`,
    {
      method: "POST",
      json: data,
    }
  );
};

export const deleteDepartmentRequest = async (
  id: number
): Promise<Response> => {
  return apiFetch(
    `/api/departments/${id}/delete`,
    {
      method: "POST",
    }
  );
};

