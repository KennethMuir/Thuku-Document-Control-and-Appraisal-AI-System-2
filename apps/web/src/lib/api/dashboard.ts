import { apiFetch } from "@/lib/api/client";

export const getDashboard = async (): Promise<Response> => {
  return apiFetch(
    "/api/dashboard",
    {
      method: "GET",
    }
  );
};
