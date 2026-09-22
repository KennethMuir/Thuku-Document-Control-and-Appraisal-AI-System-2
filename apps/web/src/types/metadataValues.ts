export type MetadataValueSource =
  | "USER"
  | "AI"
  | "SYSTEM"
  | "IMPORT"
  | "MIGRATION";

export type MetadataValueVerificationStatus =
  | "UNVERIFIED"
  | "VERIFIED"
  | "REJECTED";

export type MetadataFieldDataType =
  | "text"
  | "integer"
  | "decimal"
  | "boolean"
  | "date"
  | "datetime"
  | "year"
  | "email"
  | "url"
  | "reference"
  | "controlled_vocabulary"
  | "json";

export type MetadataFieldDefinition = {
  id: number;
  field_key: string;
  display_name: string;
  description: string | null;
  category: string;
  data_type: MetadataFieldDataType | string;
  repeatable: boolean;
  searchable: boolean;
  filterable: boolean;
  sortable: boolean;
  ai_extractable: boolean;
  user_editable: boolean;
  sensitive: boolean;
  is_active: boolean;
  organization_id: number | null;
  aliases?: string[] | null;
  validation_rule?: Record<string, unknown> | null;
  controlled_vocabulary?: Record<string, unknown> | null;
  unit?: string | null;
  default_value?: Record<string, unknown> | null;
};

export type MetadataValue = {
  id: number;
  metadata_record_id: number;
  field_registry_id: number;
  value: unknown;
  source: MetadataValueSource;
  confidence: number | null;
  verification_status: MetadataValueVerificationStatus;
  organization_id: number;
  created_at: string;
  updated_at: string;
  field_key: string;
  display_name: string;
  data_type: MetadataFieldDataType | string;
  repeatable: boolean;
};

export type CreateMetadataValueInput = {
  metadata_record_id: number;
  field_registry_id: number;
  value: unknown;
  source?: MetadataValueSource;
  confidence?: number | null;
  verification_status?: MetadataValueVerificationStatus;
};

export type UpdateMetadataValueInput = {
  value?: unknown;
  source?: MetadataValueSource;
  confidence?: number | null;
  verification_status?: MetadataValueVerificationStatus;
};

