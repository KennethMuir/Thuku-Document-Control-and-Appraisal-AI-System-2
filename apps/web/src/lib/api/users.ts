import { apiFetch } from "@/lib/api/client";

export const getUsers = async (): Promise<Response> => {
  return apiFetch(
    "/api/users",
    {
      method: "GET",
    }
  );
};

export const updateUser = async (
  userId: number,
  changes: unknown
): Promise<Response> => {
  return apiFetch(
    `/api/users/${userId}`,
    {
      method: "PATCH",
      json: changes,
    }
  );
};
