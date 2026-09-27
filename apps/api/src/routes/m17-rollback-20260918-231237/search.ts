import { Router, type Request, type Response } from "express";
import type { Pool } from "pg";

import { requireAuthentication } from "../middleware/auth.js";

export function createSearchRouter(pool: Pool) {
  const router = Router();

  router.get(
  "/",
  requireAuthentication(pool),
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const query =
        typeof req.query.q === "string"
          ? req.query.q.trim()
          : "";

      if (!query) {
        return res.json({
          success: true,
          query: "",
          results: [],
          total: 0,
        });
      }

      const searchPattern = `%${query}%`;

      const result = await pool.query(
        `
          /*
           * Search metadata records and their linked documents.
           */
          SELECT
            mr.id::text AS id,
            mr.reference_code,
            mr.title,
            mr.document_date,
            mr.year,
            mr.person_name,
            mr.description,
            mr.section,
            mr.additional_metadata,
            mr.status,

            d.id AS department_id,
            d.name AS department_name,
            d.code AS department_code,

            dt.id AS document_type_id,
            dt.name AS document_type_name,

            COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'id', doc.id,
                  'document_code', doc.document_code,
                  'filename', doc.filename,
                  'title', doc.title,
                  'document_date', doc.document_date,
                  'upload_date', doc.upload_date,
                  'year', doc.year,
                  'person_name', doc.person_name,
                  'file_type', doc.file_type,
                  'file_size', doc.file_size,
                  'status', doc.status,
                  'upload_number', doc.upload_number
                )
                ORDER BY doc.upload_date DESC
              )
              FILTER (
                WHERE doc.id IS NOT NULL
              ),
              '[]'::jsonb
            ) AS linked_documents,

            mr.created_at AS sort_date

          FROM metadata_records mr

          LEFT JOIN departments d
            ON d.id = mr.department_id

          LEFT JOIN document_types dt
            ON dt.id = mr.document_type_id

          LEFT JOIN documents doc
            ON doc.metadata_record_id = mr.id

          WHERE
            mr.reference_code ILIKE $1
            OR mr.title ILIKE $1
            OR mr.person_name ILIKE $1
            OR mr.description ILIKE $1
            OR mr.section ILIKE $1
            OR mr.status ILIKE $1
            OR d.name ILIKE $1
            OR d.code ILIKE $1
            OR dt.name ILIKE $1
            OR CAST(mr.year AS TEXT) ILIKE $1
            OR CAST(mr.document_date AS TEXT) ILIKE $1

            OR doc.document_code ILIKE $1
            OR doc.filename ILIKE $1
            OR doc.title ILIKE $1
            OR doc.person_name ILIKE $1
            OR doc.status ILIKE $1
            OR CAST(doc.year AS TEXT) ILIKE $1
            OR CAST(doc.document_date AS TEXT) ILIKE $1

          GROUP BY
            mr.id,
            mr.reference_code,
            mr.title,
            mr.document_date,
            mr.year,
            mr.person_name,
            mr.description,
            mr.section,
            mr.additional_metadata,
            mr.status,
            d.id,
            d.name,
            d.code,
            dt.id,
            dt.name,
            mr.created_at

          UNION ALL

          /*
           * Search standalone documents that have not yet been
           * linked to a metadata record.
           */
          SELECT
            ('document-' || doc.id)::text AS id,
            doc.document_code AS reference_code,
            doc.title,
            doc.document_date,
            doc.year,
            doc.person_name,
            NULL::text AS description,
            NULL::text AS section,
            NULL::jsonb AS additional_metadata,
            doc.status,

            d.id AS department_id,
            d.name AS department_name,
            d.code AS department_code,

            dt.id AS document_type_id,
            dt.name AS document_type_name,

            jsonb_build_array(
              jsonb_build_object(
                'id', doc.id,
                'document_code', doc.document_code,
                'filename', doc.filename,
                'title', doc.title,
                'document_date', doc.document_date,
                'upload_date', doc.upload_date,
                'year', doc.year,
                'person_name', doc.person_name,
                'file_type', doc.file_type,
                'file_size', doc.file_size,
                'status', doc.status,
                'upload_number', doc.upload_number
              )
            ) AS linked_documents,

            doc.upload_date AS sort_date

          FROM documents doc

          LEFT JOIN departments d
            ON d.id = doc.department_id

          LEFT JOIN document_types dt
            ON dt.id = doc.document_type_id

          WHERE
            doc.metadata_record_id IS NULL
            AND (
              doc.document_code ILIKE $1
              OR doc.filename ILIKE $1
              OR doc.title ILIKE $1
              OR doc.person_name ILIKE $1
              OR doc.status ILIKE $1
              OR d.name ILIKE $1
              OR d.code ILIKE $1
              OR dt.name ILIKE $1
              OR CAST(doc.year AS TEXT) ILIKE $1
              OR CAST(doc.document_date AS TEXT) ILIKE $1
            )

          ORDER BY sort_date DESC
        `,
        [searchPattern]
      );

      res.json({
        success: true,
        query,
        results: result.rows,
        total: result.rows.length,
      });
    } catch (error) {
      console.error(
        "Search query failed:",
        error
      );

      res.status(500).json({
        success: false,
        error: "Unable to search records",
      });
    }
  }
);

  return router;
}
