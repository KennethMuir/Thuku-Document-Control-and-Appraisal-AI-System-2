import type { SearchResultDocument } from "./documents";

export type SearchResult = {
  id: string;
  reference_code: string;
  title: string | null;
  document_date: string | null;
  year: number | null;
  person_name: string | null;
  description: string | null;
  section: string | null;
  status: string;
  department_id: number | null;
  department_name: string | null;
  department_code: string | null;
  document_type_id: number | null;
  document_type_name: string | null;
  linked_documents: SearchResultDocument[];
};
export type ContentSearchResult = {
  document_id: string;
  document_code: string | null;
  filename: string | null;
  document_title: string | null;
  document_status: string;
  metadata_record_id: string | null;
  reference_code: string | null;
  excerpt: string;
  match_position: number;
};

export type ContentSearchResponse = {
  success: boolean;
  query: string;
  results: ContentSearchResult[];
  total: number;
  limit: number;
};
