import { Router, type Request, type Response } from "express";
import type { Pool } from "pg";

import {
  requireAuthentication,
  requireRole,
} from "../middleware/auth.js";
import {
  nullableString,
  nullableInteger,
  nullablePositiveInteger,
} from "../utils/values.js";
import {
  sanitizeAdditionalMetadata,
} from "../services/metadataUtils.js";

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
router.post(
  "/",
  requireAuthentication(pool),
  requireRole("ADMIN", "APPRAISER"),
  async (
    req: Request,
    res: Response
  ) => {
    const {
      referenceCode,
      title,
      personName,
      departmentId,
      documentTypeId,
      section,
      year,
      documentDate,
      description,
      additionalMetadata,
    } = req.body;

    if (
      !referenceCode ||
      !String(
        referenceCode
      ).trim()
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Reference code is required",
      });
    }

    try {
      const duplicate =
        await pool.query(
          `
            SELECT id
            FROM metadata_records
            WHERE LOWER(reference_code) =
                  LOWER($1)
            LIMIT 1
          `,
          [
            String(
              referenceCode
            ).trim(),
          ]
        );

      if (
        duplicate.rowCount &&
        duplicate.rowCount > 0
      ) {
        return res.status(409).json({
          success: false,
          error:
            "A metadata record with this reference code already exists",
        });
      }

      const result =
        await pool.query(
          `
            INSERT INTO metadata_records (
              reference_code,
              title,
              person_name,
              department_id,
              document_type_id,
              section,
              year,
              document_date,
              description,
              additional_metadata,
              status
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              $8,
              $9,
              $10,
              'AWAITING_DOCUMENT'
            )
            RETURNING
              id,
              reference_code,
              title,
              person_name,
              department_id,
              document_type_id,
              section,
              year,
              document_date,
              description,
              additional_metadata,
              status,
              created_at,
              updated_at
          `,
          [
            String(
              referenceCode
            ).trim(),

            nullableString(title),

            nullableString(
              personName
            ),

            nullablePositiveInteger(
              departmentId
            ),

            nullablePositiveInteger(
              documentTypeId
            ),

            nullableString(
              section
            ),

            nullableInteger(year),

            nullableString(
              documentDate
            ),

            nullableString(
              description
            ),

            JSON.stringify(
              sanitizeAdditionalMetadata(
                additionalMetadata
              )
            ),
          ]
        );

      res.status(201).json({
        success: true,
        metadata:
          result.rows[0],
      });
    } catch (error: any) {
      console.error(
        "Metadata creation failed:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          "Unable to create metadata record",
        details:
          process.env.NODE_ENV ===
          "development"
            ? error.message
            : undefined,
      });
    }
  }
);


  return router;
}
