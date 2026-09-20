export type AdditionalMetadataField = {
  key: string;
  value: string;
};

export type MetadataLinkedDocument = {
  id: string | number;
  document_code: string | null;
  filename: string | null;
  title: string | null;
  document_date: string | null;
  upload_date: string | null;
  year: number | null;
  person_name: string | null;
  file_type: string | null;
  file_size: number | null;
  status: string | null;
  upload_number: number | null;
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
  linked_documents: MetadataLinkedDocument[];
};
