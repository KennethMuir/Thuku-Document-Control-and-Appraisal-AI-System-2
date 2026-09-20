import { apiFetch } from "@/lib/api/client";

export const getMetadataDomainRelationships = async (
  metadataRecordId: string | number
): Promise<Response> => {
  return apiFetch(
    `/api/domain-relationships/metadata/${encodeURIComponent(
      String(metadataRecordId)
    )}`,
    {
      method: "GET",
    }
  );
};

export const getDomainAffiliations = async (
  domainKey: string
): Promise<Response> => {
  return apiFetch(
    `/api/domain-relationships/domain/${encodeURIComponent(domainKey)}`,
    {
      method: "GET",
    }
  );
};

export const getRelationshipTypes = async (): Promise<Response> => {
  return apiFetch(
    "/api/domain-relationships/relationship-types/list",
    {
      method: "GET",
    }
  );
};

export const createDomainRelationship = async (
  data: {
    metadata_record_id: number;
    domain_id: number;
    relationship_type: string;
  }
): Promise<Response> => {
  return apiFetch(
    "/api/domain-relationships",
    {
      method: "POST",
      json: data,
    }
  );
};

export const updateDomainRelationship = async (
  relationshipId: string | number,
  data: {
    relationship_type: string;
  }
): Promise<Response> => {
  return apiFetch(
    `/api/domain-relationships/${encodeURIComponent(
      String(relationshipId)
    )}`,
    {
      method: "PATCH",
      json: data,
    }
  );
};

export const deleteDomainRelationship = async (
  relationshipId: string | number
): Promise<Response> => {
  return apiFetch(
    `/api/domain-relationships/${encodeURIComponent(
      String(relationshipId)
    )}`,
    {
      method: "DELETE",
    }
  );
};
