import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { Router, type Request, type Response } from "express";
import type { Pool } from "pg";
import multer from "multer";

import {
  requireAuthentication,
  requireOrganizationContext,
  requireRole,
  type AuthenticatedRequest,
} from "../middleware/auth.js";

import {
  sanitizeAdditionalMetadata,
} from "../services/metadataUtils.js";

export function createMetadataBulkRouter(
  pool: Pool,
  upload: multer.Multer
) {
  const router = Router();
router.post(
  "/",
  requireAuthentication(pool),
  requireOrganizationContext(pool),
  requireRole("ADMIN", "APPRAISER"),
  upload.single("file"),
  async (
    req: Request,
    res: Response
  ) => {
    const organizationId =
      (req as AuthenticatedRequest)
        .authOrganization?.organizationId;

    if (typeof organizationId !== "number" || !Number.isInteger(organizationId) || organizationId <= 0) {
      return res.status(403).json({
        success: false,
        error: "Organization context is required.",
      });
    }

    const uploadedFile = req.file;

    if (!uploadedFile) {
      return res.status(400).json({
        success: false,
        error: "CSV or XLSX file is required.",
      });
    }

    const originalName =
      uploadedFile.originalname || "";

    const extension =
      path.extname(originalName).toLowerCase();

    if (
      extension !== ".csv" &&
      extension !== ".xlsx"
    ) {
      try {
        await fs.promises.unlink(
          uploadedFile.path
        );
      } catch {
        // Ignore temporary-file cleanup errors.
      }

      return res.status(400).json({
        success: false,
        error:
          "Only CSV and XLSX files are supported.",
      });
    }

    const normalizeHeader = (
      value: unknown
    ): string => {
      return String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_");
    };

    const normalizeLookup = (
      value: unknown
    ): string => {
      return String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
    };

    const headerAliases: Record<
      string,
      string
    > = {
      reference_code: "reference_code",
      reference: "reference_code",
      ref_code: "reference_code",
      ref: "reference_code",

      person_name: "person_name",
      person: "person_name",
      employee_name: "person_name",

      title: "title",
      document_title: "title",

      department: "department",
      department_name: "department",
      department_code: "department_code",

      document_type: "document_type",
      document_type_name: "document_type",

      year: "year",
      document_year: "year",

      document_date: "document_date",
      date: "document_date",

      section: "section",
      description: "description",
    };

    const reservedBulkHeaders =
      new Set(
        Object.keys(headerAliases)
      );

    const normalizeDate = (
      value: unknown
    ): string | null => {
      if (
        value === null ||
        value === undefined ||
        value === ""
      ) {
        return null;
      }

      if (value instanceof Date) {
        if (
          Number.isNaN(
            value.getTime()
          )
        ) {
          return null;
        }

        return value
          .toISOString()
          .slice(0, 10);
      }

      if (
        typeof value === "number" &&
        Number.isFinite(value)
      ) {
        const parsed =
          XLSX.SSF.parse_date_code(
            value
          );

        if (!parsed) {
          return null;
        }

        return [
          String(parsed.y).padStart(4, "0"),
          String(parsed.m).padStart(2, "0"),
          String(parsed.d).padStart(2, "0"),
        ].join("-");
      }

      const text =
        String(value).trim();

      if (!text) {
        return null;
      }

      if (
        /^\d{4}-\d{2}-\d{2}$/.test(
          text
        )
      ) {
        const testDate =
          new Date(`${text}T00:00:00Z`);

        if (
          !Number.isNaN(
            testDate.getTime()
          )
        ) {
          return text;
        }
      }

      const parsed =
        new Date(text);

      if (
        Number.isNaN(
          parsed.getTime()
        )
      ) {
        return null;
      }

      return parsed
        .toISOString()
        .slice(0, 10);
    };

    const normalizeCellValue = (
      value: unknown
    ): string | number | boolean | null => {
      if (
        value === null ||
        value === undefined
      ) {
        return null;
      }

      if (
        typeof value === "string"
      ) {
        return value.trim();
      }

      if (
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        return value;
      }

      if (value instanceof Date) {
        return normalizeDate(value);
      }

      return String(value).trim();
    };

    try {
      const workbook =
        XLSX.readFile(
          uploadedFile.path,
          {
            cellDates: true,
          }
        );

      const firstSheetName =
        workbook.SheetNames[0];

      if (!firstSheetName) {
        return res.status(400).json({
          success: false,
          error:
            "The uploaded file does not contain a worksheet.",
        });
      }

      const worksheet =
        workbook.Sheets[
          firstSheetName
        ];

      const rows =
        XLSX.utils.sheet_to_json<
          Record<string, unknown>
        >(
          worksheet!,
          {
            defval: null,
            raw: true,
          }
        );

      if (rows.length === 0) {
        return res.status(400).json({
          success: false,
          error:
            "The uploaded file contains no metadata rows.",
        });
      }

      const firstRow = rows[0]!;

      const originalHeaders =
        Object.keys(firstRow);

      if (
        !originalHeaders.some(
          (header) =>
            headerAliases[
              normalizeHeader(header)
            ] === "reference_code"
        )
      ) {
        return res.status(400).json({
          success: false,
          error:
            "The upload must contain a reference_code column.",
        });
      }

      const departmentResult =
        await pool.query(`
          SELECT
            id,
            name,
            code
          FROM departments
          WHERE organization_id = $1
        `,
        [organizationId]
      );

      const documentTypeResult =
        await pool.query(`
          SELECT
            id,
            name
          FROM document_types
          WHERE organization_id = $1
        `,
        [organizationId]
      );

      const departmentByName =
        new Map<string, number>();

      const departmentByCode =
        new Map<string, number>();

      for (
        const department
        of departmentResult.rows
      ) {
        departmentByName.set(
          normalizeLookup(
            department.name
          ),
          Number(department.id)
        );

        departmentByCode.set(
          normalizeLookup(
            department.code
          ),
          Number(department.id)
        );
      }

      const documentTypeByName =
        new Map<string, number>();

      for (
        const documentType
        of documentTypeResult.rows
      ) {
        documentTypeByName.set(
          normalizeLookup(
            documentType.name
          ),
          Number(documentType.id)
        );
      }

      const validationErrors: string[] =
        [];

      const preparedRows: Array<{
        rowNumber: number;
        referenceCode: string;
        title: string | null;
        personName: string | null;
        departmentId: number | null;
        documentTypeId: number | null;
        section: string | null;
        year: number | null;
        documentDate: string | null;
        description: string | null;
        additionalMetadata: Record<
          string,
          string | number | boolean | null
        >;
      }> = [];

      const uploadedReferences =
        new Set<string>();

      for (
        let index = 0;
        index < rows.length;
        index += 1
      ) {
        const row =
          rows[index];

        const rowNumber =
          index + 2;

        const normalizedRow:
          Record<string, unknown> =
          {};

        for (
          const [
            rawHeader,
            value,
          ] of Object.entries(row ?? {})
        ) {
          const normalizedHeader =
            normalizeHeader(
              rawHeader
            );

          const canonicalHeader =
            headerAliases[normalizedHeader] ??
            normalizedHeader;

          normalizedRow[
            canonicalHeader
          ] = value;
        }
        const referenceValue =
          normalizedRow.reference_code;

        const referenceCode =
          String(
            referenceValue ?? ""
          ).trim();

        if (!referenceCode) {
          validationErrors.push(
            `Row ${rowNumber}: reference_code is required.`
          );
          continue;
        }

        const normalizedReference =
          normalizeLookup(
            referenceCode
          );

        if (
          uploadedReferences.has(
            normalizedReference
          )
        ) {
          validationErrors.push(
            `Row ${rowNumber}: duplicate reference_code "${referenceCode}" appears more than once in the upload.`
          );
          continue;
        }

        uploadedReferences.add(
          normalizedReference
        );

        const departmentValue =
          normalizedRow.department;

        const departmentCodeValue =
          normalizedRow.department_code;

        let departmentId:
          number | null = null;

        if (
          departmentValue !==
            null &&
          departmentValue !==
            undefined &&
          String(
            departmentValue
          ).trim()
        ) {
          const lookup =
            normalizeLookup(
              departmentValue
            );

          departmentId =
            departmentByName.get(
              lookup
            ) ??
            departmentByCode.get(
              lookup
            ) ??
            null;

          if (
            departmentId === null
          ) {
            validationErrors.push(
              `Row ${rowNumber}: department "${String(departmentValue).trim()}" was not found.`
            );
          }
        }

        if (
          departmentId === null &&
          departmentCodeValue !==
            null &&
          departmentCodeValue !==
            undefined &&
          String(
            departmentCodeValue
          ).trim()
        ) {
          const lookup =
            normalizeLookup(
              departmentCodeValue
            );

          departmentId =
            departmentByCode.get(
              lookup
            ) ?? null;

          if (
            departmentId === null
          ) {
            validationErrors.push(
              `Row ${rowNumber}: department code "${String(departmentCodeValue).trim()}" was not found.`
            );
          }
        }

        const documentTypeValue =
          normalizedRow.document_type;

        let documentTypeId:
          number | null = null;

        if (
          documentTypeValue !==
            null &&
          documentTypeValue !==
            undefined &&
          String(
            documentTypeValue
          ).trim()
        ) {
          const lookup =
            normalizeLookup(
              documentTypeValue
            );

          documentTypeId =
            documentTypeByName.get(
              lookup
            ) ?? null;

          if (
            documentTypeId === null
          ) {
            validationErrors.push(
              `Row ${rowNumber}: document type "${String(documentTypeValue).trim()}" was not found.`
            );
          }
        }

        let year:
          number | null = null;

        const yearValue =
          normalizedRow.year;

        if (
          yearValue !==
            null &&
          yearValue !==
            undefined &&
          String(
            yearValue
          ).trim()
        ) {
          const parsedYear =
            Number(
              String(
                yearValue
              ).trim()
            );

          if (
            !Number.isInteger(
              parsedYear
            )
          ) {
            validationErrors.push(
              `Row ${rowNumber}: year must be a whole number.`
            );
          } else {
            year =
              parsedYear;
          }
        }

        let documentDate:
          string | null = null;

        if (
          normalizedRow.document_date !==
            null &&
          normalizedRow.document_date !==
            undefined &&
          String(
            normalizedRow.document_date
          ).trim()
        ) {
          documentDate =
            normalizeDate(
              normalizedRow.document_date
            );

          if (!documentDate) {
            validationErrors.push(
              `Row ${rowNumber}: document_date is not a valid date.`
            );
          }
        }

        const additionalMetadata:
          Record<
            string,
            string | number | boolean | null
          > = {};

        for (
          const [
            rawHeader,
            rawValue,
          ] of Object.entries(row ?? {})
        ) {
          const normalizedHeader =
            normalizeHeader(
              rawHeader
            );

          if (
            reservedBulkHeaders.has(
              normalizedHeader
            )
          ) {
            continue;
          }

          const key =
            String(
              rawHeader
            ).trim();

          if (!key) {
            continue;
          }

          const value =
            normalizeCellValue(
              rawValue
            );

          if (
            value === null ||
            value === ""
          ) {
            continue;
          }

          additionalMetadata[
            key
          ] = value;
        }

        const sanitizedAdditionalMetadata =
          sanitizeAdditionalMetadata(
            additionalMetadata
          );

        preparedRows.push({
          rowNumber,
          referenceCode,
          title:
            normalizedRow.title !==
              null &&
            normalizedRow.title !==
              undefined
              ? String(
                  normalizedRow.title
                ).trim() || null
              : null,
          personName:
            normalizedRow.person_name !==
              null &&
            normalizedRow.person_name !==
              undefined
              ? String(
                  normalizedRow.person_name
                ).trim() || null
              : null,
          departmentId,
          documentTypeId,
          section:
            normalizedRow.section !==
              null &&
            normalizedRow.section !==
              undefined
              ? String(
                  normalizedRow.section
                ).trim() || null
              : null,
          year,
          documentDate,
          description:
            normalizedRow.description !==
              null &&
            normalizedRow.description !==
              undefined
              ? String(
                  normalizedRow.description
                ).trim() || null
              : null,
          additionalMetadata:
            sanitizedAdditionalMetadata,
        });
      }

      if (
        validationErrors.length > 0
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Bulk metadata validation failed.",
          errors:
            validationErrors.slice(
              0,
              100
            ),
          totalErrors:
            validationErrors.length,
        });
      }

      if (
        preparedRows.length === 0
      ) {
        return res.status(400).json({
          success: false,
          error:
            "No valid metadata rows were found.",
        });
      }

      const existingReferenceResult = await pool.query(
        `
          SELECT reference_code
          FROM metadata_records
          WHERE LOWER(reference_code) = ANY($1::text[])
            AND organization_id = $2
        `,
        [Array.from(uploadedReferences), organizationId]
      );

      const existingReferenceCodes =
        existingReferenceResult.rows.map((row) =>
          String(row.reference_code)
        );

      const previewRequested =
        String(req.query.preview ?? "")
          .trim()
          .toLowerCase() === "true";

      if (previewRequested) {
        return res.status(200).json({
          success: true,
          preview: true,
          totalRows: preparedRows.length,
          rows: preparedRows.slice(0, 100).map((row) => ({
            rowNumber: row.rowNumber,
            referenceCode: row.referenceCode,
            title: row.title,
            personName: row.personName,
            departmentId: row.departmentId,
            documentTypeId: row.documentTypeId,
            section: row.section,
            year: row.year,
            documentDate: row.documentDate,
            description: row.description,
            additionalMetadata: row.additionalMetadata,
          })),
          existingReferenceCodes,
          canImport: existingReferenceCodes.length === 0,
          truncated: preparedRows.length > 100,
        });
      }

      const client =
        await pool.connect();

      try {
        await client.query(
          "BEGIN"
        );

        const existingReferences =
          await client.query(
            `
              SELECT reference_code
              FROM metadata_records
              WHERE LOWER(reference_code) = ANY($1::text[])
                AND organization_id = $2
            `,
            [
              Array.from(
                uploadedReferences
              ),
              organizationId,
            ]
          );

        if (
          existingReferences.rowCount &&
          existingReferences.rowCount >
            0
        ) {
          const existing =
            existingReferences.rows.map(
              (row) =>
                String(
                  row.reference_code
                )
            );

          await client.query(
            "ROLLBACK"
          );

          return res.status(409).json({
            success: false,
            error:
              "One or more reference codes already exist.",
            existingReferenceCodes:
              existing,
          });
        }

        for (
          const row of preparedRows
        ) {
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
                $10::jsonb,
                'AWAITING_DOCUMENT',
                $11
              )
            `,
            [
              row.referenceCode,
              row.title,
              row.personName,
              row.departmentId,
              row.documentTypeId,
              row.section,
              row.year,
              row.documentDate,
              row.description,
              JSON.stringify(
                row.additionalMetadata
              ),
              organizationId,
            ]
          );
        }

        await client.query(
          "COMMIT"
        );

        return res.status(201).json({
          success: true,
          imported:
            preparedRows.length,
          message:
            `${preparedRows.length} metadata record(s) imported successfully.`,
        });
      } catch (error) {
        await client.query(
          "ROLLBACK"
        );
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error(
        "Bulk metadata import failed:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Unable to import metadata records.",
      });
    } finally {
      try {
        await fs.promises.unlink(
          uploadedFile.path
        );
      } catch {
        // Ignore temporary-file cleanup errors.
      }
    }
  }
);
  return router;
}
