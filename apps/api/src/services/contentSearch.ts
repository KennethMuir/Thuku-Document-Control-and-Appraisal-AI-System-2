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
  const normalizedQuery = query.trim().replace(/\s+/g, " ");
  const escapedQuery = normalizedQuery.replace(/[\\%_]/g, "\\$&");
  const searchPattern = `%${escapedQuery}%`;
  const queryTokens = Array.from(
    new Set(
      normalizedQuery
        .toLocaleLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((token) => token.length >= 2),
    ),
  );

  if (queryTokens.length === 0) {
    return [];
  }

  const result = await pool.query<ContentSearchRow>(
    `
      WITH search_input AS (
        SELECT
          $1::text AS phrase,
          $2::text AS pattern,
          $3::bigint AS organization_id,
          $4::text[] AS tokens
      ),
      candidates AS (
        SELECT
          d.id::text AS document_id,
          d.document_code,
          d.filename,
          d.title AS document_title,
          d.status AS document_status,
          mr.id::text AS metadata_record_id,
          mr.reference_code,
          COALESCE(mr.description, '') AS description,
          COALESCE(de.extracted_text, '') AS extracted_text,
          de.created_at AS extraction_created_at,
          si.phrase,
          si.tokens,
          COALESCE(d.title, '') AS title_text,
          COALESCE(d.filename, '') AS filename_text,
          COALESCE(mr.reference_code, '') AS reference_text
        FROM documents d
        CROSS JOIN search_input si
        LEFT JOIN metadata_records mr
          ON mr.id = d.metadata_record_id
          AND mr.organization_id = d.organization_id
        LEFT JOIN LATERAL (
          SELECT e.extracted_text, e.created_at
          FROM document_extractions e
          WHERE e.document_id = d.id
            AND e.extraction_status = 'COMPLETED'
          ORDER BY e.created_at DESC, e.id DESC
          LIMIT 1
        ) de ON TRUE
        WHERE d.organization_id = si.organization_id
          AND (
            COALESCE(mr.description, '') ILIKE si.pattern ESCAPE E'\\\\'
            OR COALESCE(de.extracted_text, '') ILIKE si.pattern ESCAPE E'\\\\'
            OR COALESCE(d.title, '') ILIKE si.pattern ESCAPE E'\\\\'
            OR COALESCE(d.filename, '') ILIKE si.pattern ESCAPE E'\\\\'
            OR COALESCE(mr.reference_code, '') ILIKE si.pattern ESCAPE E'\\\\'
            OR (
              SELECT COUNT(*)
              FROM unnest(si.tokens) AS token(value)
              WHERE
                COALESCE(mr.description, '') ~* ('(^|[^[:alnum:]_])' || token.value || '([^[:alnum:]_]|$)')
                OR COALESCE(de.extracted_text, '') ~* ('(^|[^[:alnum:]_])' || token.value || '([^[:alnum:]_]|$)')
                OR COALESCE(d.title, '') ~* ('(^|[^[:alnum:]_])' || token.value || '([^[:alnum:]_]|$)')
                OR COALESCE(d.filename, '') ~* ('(^|[^[:alnum:]_])' || token.value || '([^[:alnum:]_]|$)')
                OR COALESCE(mr.reference_code, '') ~* ('(^|[^[:alnum:]_])' || token.value || '([^[:alnum:]_]|$)')
            ) >= CASE WHEN cardinality(si.tokens) > 1 THEN 2 ELSE 1 END
          )
      ),
      scored AS (
        SELECT
          c.*,
          (
            CASE WHEN c.description ILIKE '%' || c.phrase || '%' THEN 120 ELSE 0 END
            + CASE WHEN c.extracted_text ILIKE '%' || c.phrase || '%' THEN 110 ELSE 0 END
            + CASE WHEN c.title_text ILIKE '%' || c.phrase || '%' THEN 100 ELSE 0 END
            + CASE WHEN c.reference_text ILIKE '%' || c.phrase || '%' THEN 95 ELSE 0 END
            + CASE WHEN c.filename_text ILIKE '%' || c.phrase || '%' THEN 85 ELSE 0 END
            + (
                SELECT COUNT(*)::integer * 10
                FROM unnest(c.tokens) AS token(value)
                WHERE
                  c.description ~* ('(^|[^[:alnum:]_])' || token.value || '([^[:alnum:]_]|$)')
                  OR c.extracted_text ~* ('(^|[^[:alnum:]_])' || token.value || '([^[:alnum:]_]|$)')
                  OR c.title_text ~* ('(^|[^[:alnum:]_])' || token.value || '([^[:alnum:]_]|$)')
                  OR c.reference_text ~* ('(^|[^[:alnum:]_])' || token.value || '([^[:alnum:]_]|$)')
                  OR c.filename_text ~* ('(^|[^[:alnum:]_])' || token.value || '([^[:alnum:]_]|$)')
              )
          ) AS relevance_score,
          COALESCE(
            NULLIF(
              CASE
                WHEN c.description ILIKE '%' || c.phrase || '%' THEN c.description
                WHEN c.extracted_text ILIKE '%' || c.phrase || '%' THEN c.extracted_text
                WHEN c.title_text ILIKE '%' || c.phrase || '%' THEN c.title_text
                WHEN c.reference_text ILIKE '%' || c.phrase || '%' THEN c.reference_text
                WHEN c.filename_text ILIKE '%' || c.phrase || '%' THEN c.filename_text
                ELSE NULL
              END,
              ''
            ),
            (
              SELECT field.text_value
              FROM (
                VALUES
                  (c.description, 1),
                  (c.extracted_text, 2),
                  (c.title_text, 3),
                  (c.reference_text, 4),
                  (c.filename_text, 5)
              ) AS field(text_value, priority)
              ORDER BY
                (
                  SELECT COUNT(*)
                  FROM unnest(c.tokens) AS token(value)
                  WHERE field.text_value ~* ('(^|[^[:alnum:]_])' || token.value || '([^[:alnum:]_]|$)')
                ) DESC,
                field.priority
              LIMIT 1
            ),
            ''
          ) AS matched_text
        FROM candidates c
      )
      SELECT
        document_id,
        document_code,
        filename,
        document_title,
        document_status,
        metadata_record_id,
        reference_code,
        substring(
          matched_text
          FROM GREATEST(
            1,
            COALESCE(
              NULLIF(POSITION(LOWER(phrase) IN LOWER(matched_text)), 0),
              NULLIF(POSITION(LOWER(tokens[1]) IN LOWER(matched_text)), 0),
              1
            ) - $5
          )
          FOR $6
        ) AS excerpt,
        COALESCE(
          NULLIF(POSITION(LOWER(phrase) IN LOWER(matched_text)), 0),
          NULLIF(POSITION(LOWER(tokens[1]) IN LOWER(matched_text)), 0),
          0
        ) AS match_position,
        extraction_created_at
      FROM scored
      ORDER BY relevance_score DESC, extraction_created_at DESC NULLS LAST, document_id DESC
      LIMIT $7
    `,
    [
      normalizedQuery,
      searchPattern,
      organizationId,
      queryTokens,
      EXCERPT_CONTEXT,
      EXCERPT_LENGTH,
      MAX_RESULTS,
    ],
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
