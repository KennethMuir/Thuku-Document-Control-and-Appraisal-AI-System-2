import { apiFetch } from "@/lib/api/client";

export const getDocuments = async (): Promise<Response> => {
  return apiFetch(
    "/api/documents",
    {
      method: "GET",
    }
  );
};
export const uploadDocument = async (
  file: File
): Promise<Response> => {
  const formData = new FormData();

  formData.append(
    "file",
    file
  );

  return apiFetch(
    "/api/documents/upload",
    {
      method: "POST",
      body: formData,
    }
  );
};
export const getDocumentFile = async (
  documentId: number
): Promise<Response> => {
  return apiFetch(
    `/api/documents/${documentId}/file`,
    {
      method: "GET",
    }
  );
};
export const reviewDocument = async (
  documentId: number,
  payload: unknown
): Promise<Response> => {
  return apiFetch(
    `/api/documents/${documentId}/review`,
    {
      method: "POST",
      json: payload,
    }
  );
};

