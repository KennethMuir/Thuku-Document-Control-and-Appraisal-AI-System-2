import { apiFetch } from "@/lib/api/client";

export const searchDocuments = async (
  query: string
): Promise<Response> => {
  return apiFetch(
    `/api/search?q=${encodeURIComponent(query)}`,
    {
      method: "GET",
    }
  );
};
export const searchDocumentContent = async (
  query: string
): Promise<Response> => {
  return apiFetch(
    `/api/search/content?q=${encodeURIComponent(query)}`,
    {
      method: "GET",
    }
  );
};
