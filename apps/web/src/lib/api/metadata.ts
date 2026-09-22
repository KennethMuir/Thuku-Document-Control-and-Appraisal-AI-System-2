import { apiFetch } from "@/lib/api/client";

export const getMetadata = async (): Promise<Response> => {
  return apiFetch(
    "/api/metadata",
    {
      method: "GET",
    }
  );
};
export const previewBulkMetadata = async (
  formData: FormData
): Promise<Response> => {
  return apiFetch(
    "/api/metadata/bulk?preview=true",
    {
      method: "POST",
      body: formData,
    }
  );
};

export const importBulkMetadata = async (
  formData: FormData
): Promise<Response> => {
  return apiFetch(
    "/api/metadata/bulk",
    {
      method: "POST",
      body: formData,
    }
  );
};

export const createMetadata = async (
  data: {
    personName: string | null;
    title: string | null;
    departmentId: string | null;
    documentTypeId: string | null;
    year: string | null;
    documentDate: string | null;
    section: string | null;
    description: string | null;
    additionalMetadata?: Record<string, unknown>;
  }
): Promise<Response> => {
  return apiFetch(
    "/api/metadata",
    {
      method: "POST",
      json: data,
    }
  );
};

export const getMetadataOutput = async (
  metadataRecordId: number
): Promise<Response> => {
  return apiFetch(
    `/api/metadata-output/${metadataRecordId}`,
    {
      method: "GET",
    }
  );
};
