export type AdditionalMetadataField = {
  key: string;
  value: string;
};

export type MetadataRecord = {
  id: string;
  reference_code: string;
  title: string | null;
  document_date: string | null;
  year: number | null;
  person_name: string | null;
  description: string | null;
  section: string | null;
  status: string;
  additional_metadata: Record<string, unknown> | null;
  department_name: string | null;
  document_type_name: string | null;
  linked_document_id: string | null;
  linked_document_code: string | null;
  linked_filename: string | null;
};
