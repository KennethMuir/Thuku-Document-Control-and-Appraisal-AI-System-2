import { apiFetch } from "@/lib/api/client";

export const getDomainRegistry = async (): Promise<Response> => {
  return apiFetch(
    "/api/domain-registry",
    {
      method: "GET",
    }
  );
};

export const getDomainDefinition = async (
  domainKey: string
): Promise<Response> => {
  return apiFetch(
    `/api/domain-registry/${domainKey}`,
    {
      method: "GET",
    }
  );
};

export const createDomainDefinition = async (
  data: {
    domain_key: string;
    display_name: string;
    description?: string;
    domain_family: string;
    aliases?: string[];
  }
): Promise<Response> => {
  return apiFetch(
    "/api/domain-registry",
    {
      method: "POST",
      json: data,
    }
  );
};

export const updateDomainDefinition = async (
  domainKey: string,
  data: Partial<{
    display_name: string;
    description: string;
    domain_family: string;
    aliases: string[];
  }>
): Promise<Response> => {
  return apiFetch(
    `/api/domain-registry/${domainKey}`,
    {
      method: "PATCH",
      json: data,
    }
  );
};

export const enableDomainDefinition = async (
  domainKey: string
): Promise<Response> => {
  return apiFetch(
    `/api/domain-registry/${domainKey}/enable`,
    {
      method: "POST",
    }
  );
};

export const disableDomainDefinition = async (
  domainKey: string
): Promise<Response> => {
  return apiFetch(
    `/api/domain-registry/${domainKey}/disable`,
    {
      method: "POST",
    }
  );
};
