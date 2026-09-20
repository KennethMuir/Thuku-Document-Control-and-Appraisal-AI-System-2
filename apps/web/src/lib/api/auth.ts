import { apiFetch } from "@/lib/api/client";

export const getCurrentUser = async (): Promise<Response> => {
  return apiFetch(
    "/api/auth/me",
    {
      method: "GET",
    }
  );
};

export const logoutUser = async (): Promise<Response> => {
  return apiFetch(
    "/api/auth/logout",
    {
      method: "POST",
    }
  );
};
