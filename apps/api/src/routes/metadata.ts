import { Router, type Request, type Response } from "express";
import type { PoolClient } from "pg";
import type { Pool } from "pg";

import {
  requireAuthentication,
  requireOrganizationContext,
  requireRole,
  type AuthenticatedRequest,
} from "../middleware/auth.js";
import {
  nullableString,
  nullableInteger,
  nullablePositiveInteger,
} from "../utils/values.js";
import {
  sanitizeAdditionalMetadata,
} from "../services/metadataUtils.js";
import { generateMetadataReferenceCode } from "../services/metadataReferenceCode.js";

export function createMetadataRouter(pool: Pool) {
  const router = Router();

  const getOrganizationId = (
    req: Request,
    res: Response
  ): number | null => {
    const organizationId =
      (req as AuthenticatedRequest)
        .authOrganization?.organizationId;

    if (typeof organizationId !== "number" || !Number.isInteger(organizationId) || organizationId <= 0) {
      res.status(403).json({
        success: false,
        error: "Organization context is required.",
      });
      return null;
    }

    return organizationId;
  };

  router.get(
  "/",
  requireAuthentication(pool),
  requireOrganizationContext(pool),
  async (
    req: Request,
    res: Response
    ) => {
    const organizationId = getOrganizationId(req, res);
    if (organizationId === null) {
      return;
    }

    try {
      const result = await pool.query(`
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

             AND d.organization_id = mr.organization_id

          LEFT JOIN document_types dt
            ON dt.id = mr.document_type_id

             AND dt.organization_id = mr.organization_id

          LEFT JOIN documents doc
            ON doc.metadata_record_id =
               mr.id
            AND doc.organization_id = mr.organization_id

          WHERE mr.organization_id = $1

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
        `, [organizationId]);

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
router.get(
  "/:metadataId/documents",
  requireAuthentication(pool),
  requireOrganizationContext(pool),
  async (
    req: Request,
    res: Response
  ) => {
    const organizationId = getOrganizationId(req, res);

    if (organizationId === null) {
      return;
    }

    const metadataId =
      Number(
        req.params.metadataId
      );

    if (
      !Number.isInteger(metadataId) ||
      metadataId <= 0
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Invalid metadata record ID",
      });
    }

    try {
      const metadataResult =
        await pool.query(
          `
            SELECT
              id,
              reference_code,
              title
            FROM metadata_records
            WHERE id = $1
              AND organization_id = $2
            LIMIT 1
          `,
          [
            metadataId,
            organizationId,
          ]
        );

      if (
        metadataResult.rowCount === 0
      ) {
        return res.status(404).json({
          success: false,
          error:
            "Metadata record not found",
        });
      }

      const documentsResult =
        await pool.query(
          `
            SELECT
              doc.id,
              doc.document_code,
              doc.filename,
              doc.title,
              doc.document_date,
              doc.upload_date,
              doc.year,
              doc.person_name,
              doc.file_type,
              doc.file_size,
              doc.status,
              doc.upload_number
            FROM documents doc
            WHERE doc.metadata_record_id = $1
              AND doc.organization_id = $2
            ORDER BY
              doc.upload_date DESC,
              doc.id DESC
          `,
          [
            metadataId,
            organizationId,
          ]
        );

      return res.json({
        success: true,
        metadata:
          metadataResult.rows[0],
        documents:
          documentsResult.rows,
      });
    } catch (error) {
      console.error(
        "Metadata documents query failed:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Unable to retrieve documents for metadata record",
      });
    }
  }
);

router.get(
  "/next-reference/:departmentId",
  requireAuthentication(pool),
  requireOrganizationContext(pool),
  requireRole("ADMIN", "APPRAISER"),
  async (req, res) => {
    const organizationId = getOrganizationId(req, res);

    if (organizationId === null) {
      return;
    }

    const departmentId = Number(
      req.params.departmentId
    );

    if (
      !Number.isInteger(departmentId) ||
      departmentId <= 0
    ) {
      return res.status(400).json({
        success: false,
        error: "A valid department is required.",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const referenceCode =
        await generateMetadataReferenceCode(
          client,
          organizationId,
          departmentId
        );

      await client.query("ROLLBACK");

      return res.json({
        success: true,
        referenceCode,
      });
    } catch (error: any) {
      await client
        .query("ROLLBACK")
        .catch(() => undefined);

      console.error(
        "Metadata reference preview failed:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Unable to determine the next metadata reference code.",
        details:
          process.env.NODE_ENV === "development"
            ? error.message
            : undefined,
      });
    } finally {
      client.release();
    }
  }
);

router.post(
  "/",
  requireAuthentication(pool),
  requireOrganizationContext(pool),
  requireRole("ADMIN", "APPRAISER"),
  async (
    req: Request,
    res: Response
  ) => {
    const organizationId = getOrganizationId(req, res);

    if (organizationId === null) {
      return;
    }

    const {
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

    const parsedDepartmentId =
      nullablePositiveInteger(departmentId);

    const parsedDocumentTypeId =
      nullablePositiveInteger(documentTypeId);

    if (parsedDepartmentId === null) {
      return res.status(400).json({
        success: false,
        error: "Department is required to create metadata.",
      });
    }

    const client: PoolClient =
      await pool.connect();

    try {
      await client.query("BEGIN");

      const referenceCode =
        await generateMetadataReferenceCode(
          client,
          organizationId,
          parsedDepartmentId
        );

      if (parsedDocumentTypeId !== null) {
        const documentType =
          await client.query(
            `
              SELECT id
              FROM document_types
              WHERE id = $1
                AND organization_id = $2
            `,
            [
              parsedDocumentTypeId,
              organizationId,
            ]
          );

        if (documentType.rowCount === 0) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            success: false,
            error:
              "Document type does not belong to your organization.",
          });
        }
      }

      const result =
        await client.query(
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
              status,
              organization_id
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
              'AWAITING_DOCUMENT',
              $11
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
            referenceCode,

            nullableString(title),

            nullableString(personName),

            parsedDepartmentId,

            parsedDocumentTypeId,

            nullableString(section),

            nullableInteger(year),

            nullableString(documentDate),

            nullableString(description),

            JSON.stringify(
              sanitizeAdditionalMetadata(
                additionalMetadata
              )
            ),

            organizationId,
          ]
        );

      await client.query("COMMIT");
      client.release();

      return res.status(201).json({
        success: true,
        metadata:
          result.rows[0],
      });
    } catch (error: any) {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
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
