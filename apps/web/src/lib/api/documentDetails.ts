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
