import { Router, type Request, type Response } from "express";
import type { Pool } from "pg";

import { requireAuthentication } from "../middleware/auth.js";

export function createMetadataRouter(pool: Pool) {
  const router = Router();
  router.get(
  "/",
  requireAuthentication(pool),
  async (
    _req: Request,
    res: Response
  ) => {
    try {
      const result =
        await pool.query(`
          SELECT
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
            mr.created_at,
            mr.updated_at,

            d.id AS department_id,
            d.name AS department_name,
            d.code AS department_code,

            dt.id AS document_type_id,
            dt.name AS document_type_name,

            COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'id', doc.id,
                  'document_code',
                    doc.document_code,
                  'filename',
                    doc.filename,
                  'status',
                    doc.status,
                  'upload_number',
                    doc.upload_number,
                  'upload_date',
                    doc.upload_date
                )
                ORDER BY
                  doc.upload_date DESC
              )
              FILTER (
                WHERE doc.id IS NOT NULL
              ),
              '[]'::jsonb
            ) AS linked_documents,

            MIN(doc.id)
              AS linked_document_id,

            MIN(doc.document_code)
              AS linked_document_code,

            MIN(doc.filename)
              AS linked_filename,

            MIN(doc.status)
              AS linked_document_status

          FROM metadata_records mr

          LEFT JOIN departments d
            ON d.id = mr.department_id

          LEFT JOIN document_types dt
            ON dt.id = mr.document_type_id

          LEFT JOIN documents doc
            ON doc.metadata_record_id =
               mr.id

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
            mr.created_at,
            mr.updated_at,
            mr.additional_metadata,
            d.id,
            d.name,
            d.code,
            dt.id,
            dt.name

          ORDER BY
            mr.created_at DESC
        `);

      res.json({
        success: true,
        metadata:
          result.rows,
      });
    } catch (error) {
      console.error(
        "Metadata query failed:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          "Unable to retrieve metadata records",
      });
    }
  }
);
  return router;
}

