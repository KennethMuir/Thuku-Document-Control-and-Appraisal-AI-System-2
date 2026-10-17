export type UploadedAppraisal = {
  matchType:
    | "STRONG_MATCH"
    | "PARTIAL_MATCH"
    | "NO_MATCH";
  confidence: number;
  metadataRecordId: number | null;
  matchingFields: string[];
  conflictingFields: string[];
  extractedDateText?: string | null;
  decision: string;

  duplicate?: {
    isDuplicate: boolean;
    existingDocumentId?: string | number | null;
    existingDocumentCode?: string | null;
    existingFilename?: string | null;
  } | null;

  metadata?: {
    id?: string | number;
    reference_code?: string | null;
    title?: string | null;
    document_date?: string | null;
    year?: number | null;
    person_name?: string | null;
    description?: string | null;
    section?: string | null;
    department_id?: string | number | null;
    department_name?: string | null;
    department_code?: string | null;
    document_type_id?: string | number | null;
    document_type_name?: string | null;
    additional_metadata?: Record<string, unknown> | null;
  } | null;
  metadataConflicts?: Array<{
    field: string;
    existingValue: string | number | null;
    documentValue: string | number | null;
  }>;
  match?: {
    id?: string | number;
    document_id?: string | number;
    metadata_record_id?: string | number | null;
    match_type?: string;
    confidence?: number | null;
    matching_fields?: string | null;
    conflicting_fields?: string | null;
    decision?: string;
    created_at?: string;
  };
};
