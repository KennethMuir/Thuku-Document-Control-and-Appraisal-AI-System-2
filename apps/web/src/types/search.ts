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
