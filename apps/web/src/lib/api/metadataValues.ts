import { apiFetch } from "@/lib/api/client";

export const getMetadataValues = async (
  metadataRecordId: number
): Promise<Response> => {
  return apiFetch(
    `/api/metadata-values/metadata/${metadataRecordId}`,
    {
      method: "GET",
    }
  );
};

export const getMetadataValue = async (
  valueId: number
): Promise<Response> => {
  return apiFetch(
    `/api/metadata-values/${valueId}`,
    {
      method: "GET",
    }
  );
};

export const createMetadataValue = async (
  data: {
    metadata_record_id: number;
    field_registry_id: number;
    value: unknown;
    source?: string;
    confidence?: number | null;
    verification_status?: string;
  }
): Promise<Response> => {
  return apiFetch(
    "/api/metadata-values",
    {
      method: "POST",
      json: data,
    }
  );
};

export const updateMetadataValue = async (
  valueId: number,
  data: {
    value?: unknown;
    source?: string;
    confidence?: number | null;
    verification_status?: string;
  }
): Promise<Response> => {
  return apiFetch(
    `/api/metadata-values/${valueId}`,
    {
      method: "PATCH",
      json: data,
    }
  );
};

export const deleteMetadataValue = async (
  valueId: number
): Promise<Response> => {
  return apiFetch(
    `/api/metadata-values/${valueId}`,
    {
      method: "DELETE",
    }
  );
};
