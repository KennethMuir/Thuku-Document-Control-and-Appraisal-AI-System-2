import {
  Router,
  type Request,
  type Response,
} from "express";

import type { Pool } from "pg";

import {
  requireAuthentication,
} from "../middleware/auth.js";

export function createDocumentsRouter(
  pool: Pool
) {
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
            doc.id,
            doc.document_code,
            doc.upload_number,
            doc.filename,
            doc.title,
            doc.document_date,
            doc.upload_date,
            doc.year,
            doc.person_name,
            doc.file_type,
            doc.file_size,
            doc.status,

            doc.metadata_record_id,

            mr.reference_code,
            mr.title AS metadata_title,
            mr.person_name
              AS metadata_person_name,
            mr.section
              AS metadata_section,
            mr.status
              AS metadata_status,

            d.id AS department_id,
            d.name AS department_name,
            d.code AS department_code,

            dt.id AS document_type_id,
            dt.name AS document_type_name

          FROM documents doc

          LEFT JOIN metadata_records mr
            ON mr.id =
               doc.metadata_record_id

          LEFT JOIN departments d
            ON d.id =
               doc.department_id

          LEFT JOIN document_types dt
            ON dt.id =
               doc.document_type_id

          ORDER BY
            doc.upload_date DESC
        `);

      res.json({
        success: true,
        documents:
          result.rows,
      });
    } catch (error) {
      console.error(
        "Documents query failed:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          "Unable to retrieve documents",
      });
    }
  }
);

  router.get(
    "/:documentId/appraisal",
    requireAuthentication(pool),
    async (
      req: Request,
      res: Response
    ) => {
      const documentId =
        Number(
          req.params.documentId
        );

      if (
        !Number.isInteger(
          documentId
        ) ||
        documentId <= 0
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid document ID",
        });
      }

      try {
        const documentResult =
          await pool.query(
            `
              SELECT
                doc.*,

                mr.reference_code,
                mr.title
                  AS metadata_title,
                mr.person_name
                  AS metadata_person_name,
                mr.year
                  AS metadata_year,
                mr.document_date
                  AS metadata_document_date,
                mr.description
                  AS metadata_description,
                mr.section
                  AS metadata_section,
                mr.status
                  AS metadata_status,

                d.name
                  AS department_name,
                dt.name
                  AS document_type_name

              FROM documents doc

              LEFT JOIN metadata_records mr
                ON mr.id =
                   doc.metadata_record_id

              LEFT JOIN departments d
                ON d.id =
                   doc.department_id

              LEFT JOIN document_types dt
                ON dt.id =
                   doc.document_type_id

              WHERE doc.id = $1
            `,
            [documentId]
          );

        if (
          documentResult.rowCount === 0
        ) {
          return res.status(404).json({
            success: false,
            error:
              "Document not found",
          });
        }

        const extractionResult =
          await pool.query(
            `
              SELECT *
              FROM document_extractions
              WHERE document_id = $1
              ORDER BY created_at DESC
              LIMIT 1
            `,
            [documentId]
          );

        const matchResult =
          await pool.query(
            `
              SELECT
                dm.*,

                mr.reference_code,
                mr.title
                  AS metadata_title,
                mr.person_name
                  AS metadata_person_name,
                mr.year
                  AS metadata_year,
                mr.document_date
                  AS metadata_document_date,
                mr.description
                  AS metadata_description,
                mr.section
                  AS metadata_section,
                mr.status
                  AS metadata_status,

                d.name
                  AS department_name,
                dt.name
                  AS document_type_name

              FROM document_matches dm

              LEFT JOIN metadata_records mr
                ON mr.id =
                   dm.metadata_record_id

              LEFT JOIN departments d
                ON d.id =
                   mr.department_id

              LEFT JOIN document_types dt
                ON dt.id =
                   mr.document_type_id

              WHERE dm.document_id = $1

              ORDER BY
                dm.created_at DESC
            `,
            [documentId]
          );

        res.json({
          success: true,
          document:
            documentResult.rows[0],
          extraction:
            extractionResult.rows[0] ||
            null,
          matches:
            matchResult.rows,
        });
      } catch (error) {
        console.error(
          "Appraisal retrieval failed:",
          error
        );

        res.status(500).json({
          success: false,
          error:
            "Unable to retrieve appraisal result",
        });
      }
    }
  );
  return router;
}
