export type UploadedDocument = {
  [key: string]: unknown;
  id?: string | number;
  document_code?: string;
  filename?: string;
  file_type?: string;
  file_size?: number;
  status?: string;
};

export type SearchResultDocument = {
  id: string | number;
  document_code: string;
  filename: string;
  title: string | null;
  document_date: string | null;
  upload_date: string;
  year: number | null;
  person_name: string | null;
  file_type: string | null;
  file_size: number | null;
  status: string;
  upload_number: number | null;
};
