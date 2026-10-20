import { Router, type Request, type Response } from "express";
import type { Pool } from "pg";

import { createAuditLog } from "../services/audit.js";

import {
  requireAuthentication,
  requireOrganizationContext,
  requireRole,
  type AuthenticatedRequest,
} from "../middleware/auth.js";

const SOURCES = [
  "USER",
  "AI",
  "SYSTEM",
  "IMPORT",
  "MIGRATION",
] as const;

const VERIFICATION_STATUSES = [
  "UNVERIFIED",
  "VERIFIED",
  "REJECTED",
] as const;

type MetadataValueSource =
  (typeof SOURCES)[number];

type VerificationStatus =
  (typeof VERIFICATION_STATUSES)[number];

const parsePositiveInteger = (
  value: unknown
): number | null => {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" &&
          value.trim() !== ""
        ? Number(value)
        : NaN;

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
};

const isPlainObject = (
  value: unknown
): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value);

const isSource = (
  value: unknown
): value is MetadataValueSource =>
  typeof value === "string" &&
  SOURCES.includes(
    value as MetadataValueSource
  );

const isVerificationStatus = (
  value: unknown
): value is VerificationStatus =>
  typeof value === "string" &&
  VERIFICATION_STATUSES.includes(
    value as VerificationStatus
  );

const validateFieldValue = (
  dataType: string,
  value: unknown
): string | null => {
  switch (dataType) {
    case "text":
      if (typeof value !== "string") {
        return "Value must be text.";
      }
      return null;

    case "integer":
      if (
        !Number.isInteger(value) ||
        typeof value !== "number"
      ) {
        return "Value must be an integer.";
      }
      return null;

    case "decimal":
      if (
        typeof value !== "number" ||
        !Number.isFinite(value)
      ) {
        return "Value must be a finite number.";
      }
      return null;

    case "boolean":
      if (typeof value !== "boolean") {
        return "Value must be boolean.";
      }
      return null;

    case "date":
      if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
      ) {
        return "Value must be a date in YYYY-MM-DD format.";
      }

      {
        const parsed = new Date(
          `${value}T00:00:00Z`
        );

        if (
          Number.isNaN(parsed.getTime()) ||
          parsed.toISOString().slice(0, 10) !== value
        ) {
          return "Value must be a valid calendar date.";
        }
      }

      return null;

    case "datetime":
      if (
        typeof value !== "string" ||
        Number.isNaN(
          Date.parse(value)
        )
      ) {
        return "Value must be a valid datetime.";
      }
      return null;

    case "year":
      if (
        typeof value !== "number" ||
        !Number.isInteger(value) ||
        value < 1 ||
        value > 9999
      ) {
        return "Value must be a valid year.";
      }
      return null;

    case "email":
      if (
        typeof value !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      ) {
        return "Value must be a valid email address.";
      }
      return null;

    case "url":
      if (typeof value !== "string") {
        return "Value must be a URL.";
      }

      try {
        new URL(value);
      } catch {
        return "Value must be a valid URL.";
      }

      return null;

    case "reference":
      if (
        typeof value !== "string" &&
        typeof value !== "number"
      ) {
        return "Reference value must be text or a number.";
      }
      return null;

    case "controlled_vocabulary":
      if (
        typeof value !== "string" &&
        typeof value !== "number" &&
        typeof value !== "boolean"
      ) {
        return "Controlled vocabulary value must be a scalar value.";
      }
      return null;

    case "json":
      try {
        JSON.stringify(value);
        return null;
      } catch {
        return "Value must be valid JSON.";
      }

    default:
      return `Unsupported field data type: ${dataType}.`;
  }
};

export function createMetadataValuesRouter(
  pool: Pool
) {
  const router = Router();

  const getOrganizationId = (
    req: Request,
    res: Response
  ): number | null => {
    const organizationId =
      (req as AuthenticatedRequest)
        .authOrganization?.organizationId;

    if (
      typeof organizationId !== "number" ||
      !Number.isInteger(organizationId) ||
      organizationId <= 0
    ) {
      res.status(403).json({
        success: false,
        error: "Organization context is required.",
      });
      return null;
    }

    return organizationId;
  };

  const getMetadataAndField = async (
    metadataRecordId: number,
    fieldRegistryId: number,
    organizationId: number
  ) => {
    const result = await pool.query(
      `
        SELECT
          mr.id AS metadata_record_id,
          mr.organization_id AS metadata_organization_id,

          fr.id AS field_registry_id,
          fr.field_key,
          fr.display_name,
          fr.data_type,
          fr.repeatable,
          fr.organization_id AS field_organization_id,
          fr.is_active

        FROM metadata_records mr

        CROSS JOIN field_registry fr

        WHERE
          mr.id = $1
          AND mr.organization_id = $2
          AND fr.id = $3
          AND fr.is_active = TRUE
          AND (
            fr.organization_id = $2
            OR fr.organization_id IS NULL
          )

        LIMIT 1
      `,
      [
        metadataRecordId,
        organizationId,
        fieldRegistryId,
      ]
    );

    return result.rows[0] ?? null;
  };

  // ------------------------------------------------------------
  // LIST VALUES FOR A METADATA RECORD
  // ------------------------------------------------------------

  router.get(
    "/metadata/:metadata_record_id",
    requireAuthentication(pool),
    requireOrganizationContext(pool),
    async (
      req: Request,
      res: Response
    ) => {
      const organizationId =
        getOrganizationId(req, res);

      if (organizationId === null) {
        return;
      }

      const metadataRecordId =
        parsePositiveInteger(
          req.params.metadata_record_id
        );

      if (metadataRecordId === null) {
        res.status(400).json({
          success: false,
          error:
            "A valid metadata_record_id is required.",
        });
        return;
      }

      try {
        const metadataCheck =
          await pool.query(
            `
              SELECT
                id,
                reference_code,
                title,
                organization_id
              FROM metadata_records
              WHERE
                id = $1
                AND organization_id = $2
              LIMIT 1
            `,
            [
              metadataRecordId,
              organizationId,
            ]
          );

        if (
          metadataCheck.rows.length === 0
        ) {
          res.status(404).json({
            success: false,
            error:
              "Metadata record not found.",
          });
          return;
        }

        const result =
          await pool.query(
            `
              SELECT
                mv.id,
                mv.metadata_record_id,
                mv.field_registry_id,
                mv.value,
                mv.source,
                mv.confidence,
                mv.verification_status,
                mv.organization_id,
                mv.created_at,
                mv.updated_at,

                fr.field_key,
                fr.display_name,
                fr.description,
                fr.category,
                fr.data_type,
                fr.repeatable,
                fr.searchable,
                fr.filterable,
                fr.sortable,
                fr.ai_extractable,
                fr.user_editable,
                fr.sensitive,
                fr.aliases,
                fr.controlled_vocabulary,
                fr.unit

              FROM metadata_values mv

              INNER JOIN field_registry fr
                ON fr.id = mv.field_registry_id

              WHERE
                mv.metadata_record_id = $1
                AND mv.organization_id = $2

              ORDER BY
                fr.category,
                fr.display_name,
                mv.id
            `,
            [
              metadataRecordId,
              organizationId,
            ]
          );

        res.json({
          success: true,
          metadata_record:
            metadataCheck.rows[0],
          values: result.rows,
        });
      } catch (error) {
        console.error(
          "Metadata values query failed:",
          error
        );

        res.status(500).json({
          success: false,
          error:
            "Unable to retrieve metadata values.",
        });
      }
    }
  );

  // ------------------------------------------------------------
  // GET ONE VALUE
  // ------------------------------------------------------------

  router.get(
    "/:value_id",
    requireAuthentication(pool),
    requireOrganizationContext(pool),
    async (
      req: Request,
      res: Response
    ) => {
      const organizationId =
        getOrganizationId(req, res);

      if (organizationId === null) {
        return;
      }

      const valueId =
        parsePositiveInteger(
          req.params.value_id
        );

      if (valueId === null) {
        res.status(400).json({
          success: false,
          error:
            "A valid value_id is required.",
        });
        return;
      }

      try {
        const result =
          await pool.query(
            `
              SELECT
                mv.id,
                mv.metadata_record_id,
                mv.field_registry_id,
                mv.value,
                mv.source,
                mv.confidence,
                mv.verification_status,
                mv.organization_id,
                mv.created_at,
                mv.updated_at,

                fr.field_key,
                fr.display_name,
                fr.description,
                fr.category,
                fr.data_type,
                fr.repeatable,
                fr.searchable,
                fr.filterable,
                fr.sortable,
                fr.ai_extractable,
                fr.user_editable,
                fr.sensitive,
                fr.aliases,
                fr.controlled_vocabulary,
                fr.unit

              FROM metadata_values mv

              INNER JOIN field_registry fr
                ON fr.id = mv.field_registry_id

              WHERE
                mv.id = $1
                AND mv.organization_id = $2

              LIMIT 1
            `,
            [
              valueId,
              organizationId,
            ]
          );

        if (result.rows.length === 0) {
          res.status(404).json({
            success: false,
            error:
              "Metadata value not found.",
          });
          return;
        }

        res.json({
          success: true,
          metadata_value:
            result.rows[0],
        });
      } catch (error) {
        console.error(
          "Metadata value query failed:",
          error
        );

        res.status(500).json({
          success: false,
          error:
            "Unable to retrieve metadata value.",
        });
      }
    }
  );

  // ------------------------------------------------------------
  // CREATE VALUE
  // ------------------------------------------------------------

  router.post(
    "/",
    requireAuthentication(pool),
    requireOrganizationContext(pool),
    requireRole(
      "APPRAISER",
      "ADMIN",
      "OWNER"
    ),
    async (
      req: Request,
      res: Response
    ) => {
      const organizationId =
        getOrganizationId(req, res);

      if (organizationId === null) {
        return;
      }

      const metadataRecordId =
        parsePositiveInteger(
          req.body?.metadata_record_id
        );

      const fieldRegistryId =
        parsePositiveInteger(
          req.body?.field_registry_id
        );

      const value =
        req.body?.value;

      const source =
        req.body?.source ?? "USER";

      const confidence =
        req.body?.confidence ?? null;

      const verificationStatus =
        req.body?.verification_status ??
        "UNVERIFIED";

      if (
        metadataRecordId === null ||
        fieldRegistryId === null
      ) {
        res.status(400).json({
          success: false,
          error:
            "metadata_record_id and field_registry_id are required positive integers.",
        });
        return;
      }

      if (value === undefined) {
        res.status(400).json({
          success: false,
          error: "value is required.",
        });
        return;
      }

      if (!isSource(source)) {
        res.status(400).json({
          success: false,
          error:
            "Invalid source.",
          allowed_sources: SOURCES,
        });
        return;
      }

      if (
        !isVerificationStatus(
          verificationStatus
        )
      ) {
        res.status(400).json({
          success: false,
          error:
            "Invalid verification_status.",
          allowed_statuses:
            VERIFICATION_STATUSES,
        });
        return;
      }

      if (
        confidence !== null &&
        (
          typeof confidence !== "number" ||
          !Number.isFinite(confidence) ||
          confidence < 0 ||
          confidence > 1
        )
      ) {
        res.status(400).json({
          success: false,
          error:
            "confidence must be a number between 0 and 1.",
        });
        return;
      }

      try {
        const metadataAndField =
          await getMetadataAndField(
            metadataRecordId,
            fieldRegistryId,
            organizationId
          );

        if (!metadataAndField) {
          res.status(404).json({
            success: false,
            error:
              "Metadata record or field definition not found.",
          });
          return;
        }

        if (
          metadataAndField.field_key ===
          "reference_code"
        ) {
          res.status(400).json({
            success: false,
            error:
              "Reference Code is system-generated from the selected Department and cannot be manually created.",
          });
          return;
        }

        const validationError =
          validateFieldValue(
            metadataAndField.data_type,
            value
          );

        if (validationError) {
          res.status(400).json({
            success: false,
            error: validationError,
          });
          return;
        }

        const client = await pool.connect();
        let transactionStarted = false;

        try {
          await client.query("BEGIN");
          transactionStarted = true;

          const currentField = await client.query(
            `
              SELECT fr.repeatable
              FROM field_registry fr
              JOIN metadata_records mr
                ON mr.id = $1
               AND mr.organization_id = $3
              WHERE fr.id = $2
                AND fr.is_active = TRUE
                AND (
                  fr.organization_id = $3
                  OR fr.organization_id IS NULL
                )
              FOR SHARE OF fr
            `,
            [
              metadataRecordId,
              fieldRegistryId,
              organizationId,
            ]
          );

          if (currentField.rows.length === 0) {
            await client.query("ROLLBACK");
            transactionStarted = false;
            res.status(404).json({
              success: false,
              error: "Metadata record or field definition not found.",
            });
            return;
          }

          const repeatable =
            currentField.rows[0].repeatable === true;

          if (!repeatable) {
            await client.query(
              `
                SELECT pg_advisory_xact_lock(
                  hashtextextended(
                    $1::text || ':' || $2::text,
                    0
                  )
                )
              `,
              [metadataRecordId, fieldRegistryId]
            );

            const existing = await client.query(
              `
                SELECT id
                FROM metadata_values
                WHERE metadata_record_id = $1
                  AND field_registry_id = $2
                  AND organization_id = $3
                LIMIT 1
              `,
              [
                metadataRecordId,
                fieldRegistryId,
                organizationId,
              ]
            );

            if (existing.rows.length > 0) {
              await client.query("ROLLBACK");
              transactionStarted = false;
              res.status(409).json({
                success: false,
                error:
                  "This field is not repeatable and already has a value for this metadata record.",
              });
              return;
            }
          }

          const result = await client.query(
            `
              INSERT INTO metadata_values (
                metadata_record_id,
                field_registry_id,
                value,
                source,
                confidence,
                verification_status,
                organization_id
              )
              VALUES (
                $1,
                $2,
                $3::jsonb,
                $4,
                $5,
                $6,
                $7
              )
              RETURNING
                id,
                metadata_record_id,
                field_registry_id,
                value,
                source,
                confidence,
                verification_status,
                organization_id,
                created_at,
                updated_at
            `,
            [
              metadataRecordId,
              fieldRegistryId,
              JSON.stringify(value),
              source,
              confidence,
              verificationStatus,
              organizationId,
            ]
          );

          await createAuditLog(
            client,
            organizationId,
            (req as AuthenticatedRequest).authUser?.id ?? null,
            null,
            metadataRecordId,
            "METADATA_VALUE_CREATED",
            JSON.stringify({
              metadataValueId: result.rows[0].id,
              fieldRegistryId,
              fieldKey: metadataAndField.field_key,
              source,
              verificationStatus,
              changedProperties: [
                "value",
                "source",
                "confidence",
                "verification_status",
              ],
            })
          );
          await client.query("COMMIT");
          transactionStarted = false;

          res.status(201).json({
            success: true,
            metadata_value: result.rows[0],
          });
        } catch (error) {
          if (transactionStarted) {
            try {
              await client.query("ROLLBACK");
            } catch (rollbackError) {
              console.error(
                "Metadata value transaction rollback failed:",
                rollbackError
              );
            }
          }
          throw error;
        } finally {
          client.release();
        }
      } catch (error: any) {
        if (
          error?.code === "23505" &&
          error?.constraint === "metadata_values_nonrepeatable_guard"
        ) {
          res.status(409).json({
            success: false,
            error:
              "This field is not repeatable and already has a value for this metadata record.",
          });
          return;
        }

        console.error(
          "Metadata value creation failed:",
          error
        );

        res.status(500).json({
          success: false,
          error:
            "Unable to create metadata value.",
        });
      }
    }
  );

  // ------------------------------------------------------------
  // UPDATE VALUE
  // ------------------------------------------------------------

  router.patch(
    "/:value_id",
    requireAuthentication(pool),
    requireOrganizationContext(pool),
    requireRole(
      "APPRAISER",
      "ADMIN",
      "OWNER"
    ),
    async (
      req: Request,
      res: Response
    ) => {
      const organizationId =
        getOrganizationId(req, res);

      if (organizationId === null) {
        return;
      }

      const valueId =
        parsePositiveInteger(
          req.params.value_id
        );

      if (valueId === null) {
        res.status(400).json({
          success: false,
          error:
            "A valid value_id is required.",
        });
        return;
      }

      const {
        value,
        source,
        confidence,
        verification_status:
          verificationStatus,
      } = req.body ?? {};

      if (
        source !== undefined &&
        !isSource(source)
      ) {
        res.status(400).json({
          success: false,
          error: "Invalid source.",
          allowed_sources: SOURCES,
        });
        return;
      }

      if (
        verificationStatus !== undefined &&
        !isVerificationStatus(
          verificationStatus
        )
      ) {
        res.status(400).json({
          success: false,
          error:
            "Invalid verification_status.",
          allowed_statuses:
            VERIFICATION_STATUSES,
        });
        return;
      }

      if (
        confidence !== undefined &&
        confidence !== null &&
        (
          typeof confidence !== "number" ||
          !Number.isFinite(confidence) ||
          confidence < 0 ||
          confidence > 1
        )
      ) {
        res.status(400).json({
          success: false,
          error:
            "confidence must be a number between 0 and 1.",
        });
        return;
      }

      if (
        value === undefined &&
        source === undefined &&
        confidence === undefined &&
        verificationStatus === undefined
      ) {
        res.status(400).json({
          success: false,
          error:
            "At least one value field must be provided for update.",
        });
        return;
      }

      try {
        const existing =
          await pool.query(
            `
              SELECT
                mv.id,
                mv.metadata_record_id,
                mv.field_registry_id,
                mv.value,
                mv.source,
                mv.confidence,
                mv.verification_status,
                fr.field_key,
                fr.data_type,
                fr.repeatable,
                fr.is_active

              FROM metadata_values mv

              INNER JOIN field_registry fr
                ON fr.id = mv.field_registry_id

              WHERE
                mv.id = $1
                AND mv.organization_id = $2
                AND fr.is_active = TRUE

              LIMIT 1
            `,
            [
              valueId,
              organizationId,
            ]
          );

        if (existing.rows.length === 0) {
          res.status(404).json({
            success: false,
            error:
              "Metadata value not found.",
          });
          return;
        }

        const current =
          existing.rows[0];

        if (
          current.field_key ===
          "reference_code"
        ) {
          res.status(400).json({
            success: false,
            error:
              "Reference Code is system-generated from the selected Department and cannot be manually changed.",
          });
          return;
        }

        if (value !== undefined) {
          const validationError =
            validateFieldValue(
              current.data_type,
              value
            );

          if (validationError) {
            res.status(400).json({
              success: false,
              error: validationError,
            });
            return;
          }
        }

        const client = await pool.connect();
        let transactionStarted = false;

        try {
          await client.query("BEGIN");
          transactionStarted = true;

          const result = await client.query(
            `
              UPDATE metadata_values
              SET
                value = COALESCE(
                  $1::jsonb,
                  value
                ),
                source = COALESCE(
                  $2,
                  source
                ),
                confidence = CASE
                  WHEN $3::boolean = TRUE
                    THEN $4::numeric
                  ELSE confidence
                END,
                verification_status =
                  COALESCE(
                    $5,
                    verification_status
                  ),
                updated_at = NOW()
              WHERE
                id = $6
                AND organization_id = $7

              RETURNING
                id,
                metadata_record_id,
                field_registry_id,
                value,
                source,
                confidence,
                verification_status,
                organization_id,
                created_at,
                updated_at
            `,
            [
              value === undefined
                ? null
                : JSON.stringify(value),
              source ?? null,
              confidence !== undefined,
              confidence ?? null,
              verificationStatus ?? null,
              valueId,
              organizationId,
            ]
          );

          if (result.rows.length === 0) {
            await client.query("ROLLBACK");
            transactionStarted = false;
            res.status(404).json({
              success: false,
              error: "Metadata value not found.",
            });
            return;
          }

          await createAuditLog(
            client,
            organizationId,
            (req as AuthenticatedRequest).authUser?.id ?? null,
            null,
            current.metadata_record_id,
            "METADATA_VALUE_UPDATED",
            JSON.stringify({
              metadataValueId: result.rows[0].id,
              fieldRegistryId: current.field_registry_id,
              fieldKey: current.field_key,
              changedProperties: [
                ...(value !== undefined ? ["value"] : []),
                ...(source !== undefined ? ["source"] : []),
                ...(confidence !== undefined ? ["confidence"] : []),
                ...(verificationStatus !== undefined
                  ? ["verification_status"]
                  : []),
              ],
            })
          );

          await client.query("COMMIT");
          transactionStarted = false;

          res.json({
            success: true,
            metadata_value: result.rows[0],
          });
        } catch (error) {
          if (transactionStarted) {
            try {
              await client.query("ROLLBACK");
            } catch (rollbackError) {
              console.error(
                "Metadata value update rollback failed:",
                rollbackError
              );
            }
          }

          throw error;
        } finally {
          client.release();
        }
      } catch (error: any) {
        if (
          error?.code === "23505" &&
          error?.constraint === "metadata_values_nonrepeatable_guard"
        ) {
          res.status(409).json({
            success: false,
            error:
              "This field is not repeatable and already has a value for this metadata record.",
          });
          return;
        }

        console.error(
          "Metadata value update failed:",
          error
        );

        res.status(500).json({
          success: false,
          error:
            "Unable to update metadata value.",
        });
      }
    }
  );

  // ------------------------------------------------------------
  // DELETE VALUE
  // ------------------------------------------------------------

  router.delete(
    "/:value_id",
    requireAuthentication(pool),
    requireOrganizationContext(pool),
    requireRole(
      "APPRAISER",
      "ADMIN",
      "OWNER"
    ),
    async (
      req: Request,
      res: Response
    ) => {
      const organizationId =
        getOrganizationId(req, res);

      if (organizationId === null) {
        return;
      }

      const valueId =
        parsePositiveInteger(
          req.params.value_id
        );

      if (valueId === null) {
        res.status(400).json({
          success: false,
          error:
            "A valid value_id is required.",
        });
        return;
      }

      try {
        const client = await pool.connect();
        let transactionStarted = false;

        try {
          await client.query("BEGIN");
          transactionStarted = true;

          const existing = await client.query(
            `
              SELECT
                mv.id,
                mv.metadata_record_id,
                mv.field_registry_id,
                fr.field_key
              FROM metadata_values mv
              INNER JOIN field_registry fr
                ON fr.id = mv.field_registry_id
              WHERE
                mv.id = $1
                AND mv.organization_id = $2
                AND fr.is_active = TRUE
              LIMIT 1
              FOR UPDATE OF mv
            `,
            [
              valueId,
              organizationId,
            ]
          );

          if (existing.rows.length === 0) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            res.status(404).json({
              success: false,
              error:
                "Metadata value not found.",
            });
            return;
          }

          const current = existing.rows[0];

          if (current.field_key === "reference_code") {
            await client.query("ROLLBACK");
            transactionStarted = false;

            res.status(400).json({
              success: false,
              error:
                "Reference Code is system-generated from the selected Department and cannot be deleted.",
            });
            return;
          }

          const result = await client.query(
            `
              DELETE FROM metadata_values
              WHERE
                id = $1
                AND organization_id = $2
              RETURNING
                id,
                metadata_record_id,
                field_registry_id
            `,
            [
              valueId,
              organizationId,
            ]
          );

          if (result.rows.length === 0) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            res.status(404).json({
              success: false,
              error:
                "Metadata value not found.",
            });
            return;
          }

          await createAuditLog(
            client,
            organizationId,
            (req as AuthenticatedRequest).authUser?.id ?? null,
            null,
            current.metadata_record_id,
            "METADATA_VALUE_DELETED",
            JSON.stringify({
              metadataValueId: current.id,
              fieldRegistryId: current.field_registry_id,
              fieldKey: current.field_key,
              changedProperties: [
                "value",
                "source",
                "confidence",
                "verification_status",
              ],
            })
          );

          await client.query("COMMIT");
          transactionStarted = false;

          res.json({
            success: true,
            deleted: result.rows[0],
          });
        } catch (error) {
          if (transactionStarted) {
            try {
              await client.query("ROLLBACK");
            } catch (rollbackError) {
              console.error(
                "Metadata value deletion rollback failed:",
                rollbackError
              );
            }
          }

          console.error(
            "Metadata value deletion failed:",
            error
          );

          res.status(500).json({
            success: false,
            error:
              "Unable to delete metadata value.",
          });
        } finally {
          client.release();
        }
      } catch (error) {
        console.error(
          "Metadata value deletion failed:",
          error
        );

        res.status(500).json({
          success: false,
          error:
            "Unable to delete metadata value.",
        });
      }
    }
  );
  return router;
}

