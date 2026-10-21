import { apiFetch } from "@/lib/api/client";

export const getDocumentDetails = async (
  documentId: number
): Promise<Response> => {
  return apiFetch(
    `/api/document-details/${documentId}`,
    {
      method: "GET",
    }
  );
};

export const getAiDocumentDescription = async (
  documentId: number
): Promise<Response> => {
  return apiFetch(
    `/api/document-ai-description/${documentId}`,
    {
      method: "POST",
    }
  );
};
