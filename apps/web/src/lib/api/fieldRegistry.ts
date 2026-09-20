import { apiFetch } from "@/lib/api/client";

export const getFieldRegistry = async (): Promise<Response> => {
  return apiFetch(
    "/api/field-registry",
    {
      method: "GET",
    }
  );
};

export const getFieldDefinition = async (
  fieldKey: string
): Promise<Response> => {
  return apiFetch(
    `/api/field-registry/${fieldKey}`,
    {
      method: "GET",
    }
  );
};

export const createFieldDefinition = async (
  data: {
    field_key: string;
    display_name: string;
    description?: string;
    category?: string;
    data_type?: string;
    aliases?: string[];
    repeatable?: boolean;
    searchable?: boolean;
    filterable?: boolean;
    sortable?: boolean;
    ai_extractable?: boolean;
    user_editable?: boolean;
    sensitive?: boolean;
    validation_rule?: Record<string, unknown>;
    controlled_vocabulary?: Record<string, unknown>;
    unit?: string;
    default_value?: Record<string, unknown>;
  }
): Promise<Response> => {
  return apiFetch(
    "/api/field-registry",
    {
      method: "POST",
      json: data,
    }
  );
};

export const updateFieldDefinition = async (
  fieldKey: string,
  data: Partial<{
    display_name: string;
    description: string;
    category: string;
    data_type: string;
    aliases: string[];
    repeatable: boolean;
    searchable: boolean;
    filterable: boolean;
    sortable: boolean;
    ai_extractable: boolean;
    user_editable: boolean;
    sensitive: boolean;
    validation_rule: Record<string, unknown>;
    controlled_vocabulary: Record<string, unknown>;
    unit: string;
    default_value: Record<string, unknown>;
  }>
): Promise<Response> => {
  return apiFetch(
    `/api/field-registry/${fieldKey}`,
    {
      method: "PATCH",
      json: data,
    }
  );
};

export const enableFieldDefinition = async (
  fieldKey: string
): Promise<Response> => {
  return apiFetch(
    `/api/field-registry/${fieldKey}/enable`,
    {
      method: "POST",
    }
  );
};

export const disableFieldDefinition = async (
  fieldKey: string
): Promise<Response> => {
  return apiFetch(
    `/api/field-registry/${fieldKey}/disable`,
    {
      method: "POST",
    }
  );
};