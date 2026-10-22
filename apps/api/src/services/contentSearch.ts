import type { Pool } from "pg";

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

type ContentSearchRow = ContentSearchResult;

const MAX_RESULTS = 50;
const EXCERPT_LENGTH = 280;
const EXCERPT_CONTEXT = 100;

export async function searchDocumentContent(
  pool: Pool,
  organizationId: number,
  query: string
): Promise<ContentSearchResult[]> {
  const escapedQuery = query.replace(/[\\%_]/g, "\\$&");
  const searchPattern = `%${escapedQuery}%`;

  const result = await pool.query<ContentSearchRow>(
    `
      SELECT
        d.id::text AS document_id,
        d.document_code,
        d.filename,
        d.title AS document_title,
        d.status AS document_status,
        mr.id::text AS metadata_record_id,
        mr.reference_code,
        substring(
          de.extracted_text
          FROM GREATEST(
            1,
            POSITION(LOWER($1) IN LOWER(de.extracted_text)) - $4
          )
          FOR $5
        ) AS excerpt,
        POSITION(
          LOWER($1) IN LOWER(de.extracted_text)
        ) AS match_position,
        de.created_at AS extraction_created_at

      FROM documents d

      INNER JOIN LATERAL (
        SELECT
          e.id,
          e.extracted_text,
          e.created_at
        FROM document_extractions e
        WHERE
          e.document_id = d.id
          AND e.extraction_status = 'COMPLETED'
          AND e.extracted_text ILIKE $2 ESCAPE E'\\\\'
        ORDER BY e.created_at DESC, e.id DESC
        LIMIT 1
      ) de ON TRUE

      LEFT JOIN metadata_records mr
        ON mr.id = d.metadata_record_id
        AND mr.organization_id = d.organization_id

      WHERE d.organization_id = $3

      ORDER BY match_position ASC, extraction_created_at DESC, d.id DESC
      LIMIT $6
    `,
    [
      query,
      searchPattern,
      organizationId,
      EXCERPT_CONTEXT,
      EXCERPT_LENGTH,
      MAX_RESULTS,
    ]
  );

  return result.rows.map((row) => ({
    document_id: row.document_id,
    document_code: row.document_code,
    filename: row.filename,
    document_title: row.document_title,
    document_status: row.document_status,
    metadata_record_id: row.metadata_record_id,
    reference_code: row.reference_code,
    excerpt: row.excerpt ?? "",
    match_position: row.match_position,
  }));
}