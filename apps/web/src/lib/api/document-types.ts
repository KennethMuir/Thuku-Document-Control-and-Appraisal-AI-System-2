import { apiFetch } from "@/lib/api/client";

export const getDocumentTypes = async (): Promise<Response> => {
  return apiFetch(
    "/api/document-types",
    {
      method: "GET",
    }
  );
};
