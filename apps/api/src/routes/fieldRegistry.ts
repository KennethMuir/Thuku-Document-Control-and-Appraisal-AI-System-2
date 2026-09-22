import { Router, type Request, type Response } from "express";
import type { Pool } from "pg";

import {
  requireAuthentication,
  requireOrganizationContext,
  requireRole,
  type AuthenticatedRequest,
} from "../middleware/auth.js";

export function createFieldRegistryRouter(pool: Pool) {
  const router = Router();

  const getOrganizationId = (
    req: Request,
    res: Response
  ): number | null => {
    const organizationId =
      (req as AuthenticatedRequest).authOrganization?.organizationId;

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

  // ------------------------------------------------------------
  // 2. LIST FIELD DEFINITIONS
  // ------------------------------------------------------------

  router.get(
    "/",
    requireAuthentication(pool),
    requireOrganizationContext(pool),
    async (req: Request, res: Response) => {
      const organizationId = getOrganizationId(req, res);

      if (organizationId === null) {
        return;
      }

      try {
        const result = await pool.query(
          `
            SELECT
              id,
              field_key,
              display_name,
              description,
              category,
              data_type,
              aliases,
              repeatable,
              searchable,
              filterable,
              sortable,
              ai_extractable,
              user_editable,
              sensitive,
              validation_rule,
              controlled_vocabulary,
              unit,
              default_value,
              is_active,
              created_at,
              updated_at,
              organization_id
            FROM field_registry
            WHERE
              (
                organization_id = $1
                OR organization_id IS NULL
              )
              AND is_active = TRUE
            ORDER BY
              CASE
                WHEN organization_id IS NULL THEN 0
                ELSE 1
              END,
              category,
              field_key
          `,
          [organizationId]
        );

        res.json({
          success: true,
          field_registry: result.rows,
        });
      } catch (error) {
        console.error("Field registry query failed:", error);

        res.status(500).json({
          success: false,
          error: "Unable to retrieve field definitions",
        });
      }
    }
  );

  // ------------------------------------------------------------
  // 3. GET A FIELD DEFINITION
  // ------------------------------------------------------------

  router.get(
    "/:field_key",
    requireAuthentication(pool),
    requireOrganizationContext(pool),
    async (req: Request, res: Response) => {
      const organizationId = getOrganizationId(req, res);

      if (organizationId === null) {
        return;
      }

      const fieldKey = req.params.field_key;

      try {
        const result = await pool.query(
          `
            SELECT
              id,
              field_key,
              display_name,
              description,
              category,
              data_type,
              aliases,
              repeatable,
              searchable,
              filterable,
              sortable,
              ai_extractable,
              user_editable,
              sensitive,
              validation_rule,
              controlled_vocabulary,
              unit,
              default_value,
              is_active,
              created_at,
              updated_at,
              organization_id
            FROM field_registry
            WHERE
              field_key = $1
              AND (
                organization_id = $2
                OR organization_id IS NULL
              )
              AND is_active = TRUE
            LIMIT 1
          `,
          [fieldKey, organizationId]
        );

        if (result.rows.length === 0) {
          res.status(404).json({
            success: false,
            error: "Field definition not found.",
          });
          return;
        }

        res.json({
          success: true,
          field_definition: result.rows[0],
        });
      } catch (error) {
        console.error("Field definition query failed:", error);

        res.status(500).json({
          success: false,
          error: "Unable to retrieve field definition",
        });
      }
    }
  );

  // ------------------------------------------------------------
  // 4. CREATE AN ORGANIZATION FIELD
  // ------------------------------------------------------------

  router.post(
    "/",
    requireAuthentication(pool),
    requireOrganizationContext(pool),
    requireRole("ADMIN", "OWNER"),
    async (req: Request, res: Response) => {
      const organizationId = getOrganizationId(req, res);

      if (organizationId === null) {
        return;
      }

      const {
        field_key,
        display_name,
        description,
        category,
        data_type,
        aliases,
        repeatable,
        searchable,
        filterable,
        sortable,
        ai_extractable,
        user_editable,
        sensitive,
        validation_rule,
        controlled_vocabulary,
        unit,
        default_value,
      } = req.body;
      const validDataTypes = [
        "text",
        "integer",
        "decimal",
        "boolean",
        "date",
        "datetime",
        "year",
        "email",
        "url",
        "reference",
        "controlled_vocabulary",
      ];
      const validCategories = [
        "Identity",
        "Dates",
        "People",
        "Organizations",
        "Records Management",
        "Administrative",
        "Governance",
        "Subject / Classification",
        "Legal / Regulatory",
        "Security",
        "Compliance",
        "Risk",
        "Audit",
        "Financial",
        "Procurement",
        "Contracts",
        "Human Resources",
        "Projects",
        "Operations",
        "Engineering",
        "Aviation",
        "Medical / Healthcare",
        "Research / Scientific",
        "Education",
        "Geographic",
        "Technical",
        "Media / Audiovisual",
        "Archival",
        "Preservation",
        "Workflow / Approval",
        "Relationships",
        "Environmental",
      ];

      if (!field_key || !display_name) {
        res.status(400).json({
          success: false,
          error: "field_key and display_name are required.",
        });
        return;
      }


      if (!validDataTypes.includes(data_type)) {
        res.status(400).json({
          success: false,
          error: "Invalid data_type.",
        });
        return;
      }


      if (!validCategories.includes(category)) {
        res.status(400).json({
          success: false,
          error: "Invalid category.",
        });
        return;
      }

      try {
        const existing = await pool.query(
          `
            SELECT id
            FROM field_registry
            WHERE
              field_key = $1
              AND organization_id = $2
            LIMIT 1
          `,
          [field_key, organizationId]
        );

        if (existing.rows.length > 0) {
          res.status(409).json({
            success: false,
            error:
              "A field definition with this key already exists in your organization.",
          });
          return;
        }

        const systemExisting = await pool.query(
          `
            SELECT id
            FROM field_registry
            WHERE
              field_key = $1
              AND organization_id IS NULL
            LIMIT 1
          `,
          [field_key]
        );

        if (systemExisting.rows.length > 0) {
          res.status(409).json({
            success: false,
            error:
              "A system field with this key already exists. Organization-defined fields cannot override system fields.",
          });
          return;
        }

        const result = await pool.query(
          `
            INSERT INTO field_registry (
              field_key,
              display_name,
              description,
              category,
              data_type,
              aliases,
              repeatable,
              searchable,
              filterable,
              sortable,
              ai_extractable,
              user_editable,
              sensitive,
              validation_rule,
              controlled_vocabulary,
              unit,
              default_value,
              organization_id,
              is_active,
              created_at,
              updated_at
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6::jsonb,
              $7,
              $8,
              $9,
              $10,
              $11,
              $12,
              $13,
              $14::jsonb,
              $15::jsonb,
              $16,
              $17::jsonb,
              $18,
              TRUE,
              NOW(),
              NOW()
            )
            RETURNING
              id,
              field_key,
              display_name,
              description,
              category,
              data_type,
              aliases,
              repeatable,
              searchable,
              filterable,
              sortable,
              ai_extractable,
              user_editable,
              sensitive,
              validation_rule,
              controlled_vocabulary,
              unit,
              default_value,
              is_active,
              created_at,
              updated_at,
              organization_id
          `,
          [
            field_key,
            display_name,
            description ?? null,
            category,
            data_type,
            aliases ?? null,
            repeatable ?? false,
            searchable ?? false,
            filterable ?? false,
            sortable ?? false,
            ai_extractable ?? false,
            user_editable ?? true,
            sensitive ?? false,
            validation_rule ?? null,
            controlled_vocabulary ?? null,
            unit ?? null,
            default_value ?? null,
            organizationId,
          ]
        );

        res.status(201).json({
          success: true,
          field_definition: result.rows[0],
        });
      } catch (error: any) {
        console.error("Field creation failed:", error);

        res.status(500).json({
          success: false,
          error: "Unable to create field definition",
          details:
            process.env.NODE_ENV === "development"
              ? error.message
              : undefined,
        });
      }
    }
  );

  // ------------------------------------------------------------
  // 5. UPDATE AN ORGANIZATION FIELD
  // ------------------------------------------------------------

  router.patch(
    "/:field_key",
    requireAuthentication(pool),
    requireOrganizationContext(pool),
    requireRole("ADMIN", "OWNER"),
    async (req: Request, res: Response) => {
      const organizationId = getOrganizationId(req, res);

      if (organizationId === null) {
        return;
      }

      const fieldKey = req.params.field_key;

      const {
        display_name,
        description,
        category,
        data_type,
        aliases,
        repeatable,
        searchable,
        filterable,
        sortable,
        ai_extractable,
        user_editable,
        sensitive,
        validation_rule,
        controlled_vocabulary,
        unit,
        default_value,
      } = req.body;
      const validDataTypes = [
        "text",
        "integer",
        "decimal",
        "boolean",
        "date",
        "datetime",
        "year",
        "email",
        "url",
        "reference",
        "controlled_vocabulary",
      ];
      const validCategories = [
        "Identity",
        "Dates",
        "People",
        "Organizations",
        "Records Management",
        "Administrative",
        "Governance",
        "Subject / Classification",
        "Legal / Regulatory",
        "Security",
        "Compliance",
        "Risk",
        "Audit",
        "Financial",
        "Procurement",
        "Contracts",
        "Human Resources",
        "Projects",
        "Operations",
        "Engineering",
        "Aviation",
        "Medical / Healthcare",
        "Research / Scientific",
        "Education",
        "Geographic",
        "Technical",
        "Media / Audiovisual",
        "Archival",
        "Preservation",
        "Workflow / Approval",
        "Relationships",
        "Environmental",
      ];



      if (
        data_type !== undefined &&
        !validDataTypes.includes(data_type)
      ) {
        res.status(400).json({
          success: false,
          error: "Invalid data_type.",
        });
        return;
      }

      if (
        category !== undefined &&
        !validCategories.includes(category)
      ) {
        res.status(400).json({
          success: false,
          error: "Invalid category.",
        });
        return;
      }

      try {
        const fieldCheck = await pool.query(
          `
            SELECT
              id,
              organization_id,
              is_active
            FROM field_registry
            WHERE field_key = $1
            LIMIT 1
          `,
          [fieldKey]
        );

        if (fieldCheck.rows.length === 0) {
          res.status(404).json({
            success: false,
            error: "Field definition not found.",
          });
          return;
        }

        const dbField = fieldCheck.rows[0];

        if (dbField.organization_id === null) {
          res.status(403).json({
            success: false,
            error:
              "System fields cannot be modified via organization-defined operations.",
          });
          return;
        }

        if (dbField.organization_id !== organizationId) {
          res.status(403).json({
            success: false,
            error:
              "Field definition does not belong to your organization.",
          });
          return;
        }

        const setClauses: string[] = [];
        const values: unknown[] = [];
        let parameterIndex = 1;

        const addValue = (
          column: string,
          value: unknown,
          cast?: string
        ) => {
          if (value !== undefined) {
            setClauses.push(
              `${column} = $${parameterIndex}${
                cast ? `::${cast}` : ""
              }`
            );
            values.push(value);
            parameterIndex++;
          }
        };

        addValue("display_name", display_name);
        addValue("description", description);
        addValue("category", category);
        addValue("data_type", data_type);
        addValue("aliases", aliases, "jsonb");
        addValue("repeatable", repeatable);
        addValue("searchable", searchable);
        addValue("filterable", filterable);
        addValue("sortable", sortable);
        addValue("ai_extractable", ai_extractable);
        addValue("user_editable", user_editable);
        addValue("sensitive", sensitive);
        addValue("validation_rule", validation_rule, "jsonb");
        addValue(
          "controlled_vocabulary",
          controlled_vocabulary,
          "jsonb"
        );
        addValue("unit", unit);
        addValue("default_value", default_value, "jsonb");

        if (setClauses.length === 0) {
          res.status(400).json({
            success: false,
            error: "No fields to update.",
          });
          return;
        }

        setClauses.push("updated_at = NOW()");

        values.push(fieldKey);
        const fieldKeyParameter = parameterIndex;
        parameterIndex++;

        values.push(organizationId);
        const organizationParameter = parameterIndex;

        const query = `
          UPDATE field_registry
          SET
            ${setClauses.join(", ")}
          WHERE
            field_key = $${fieldKeyParameter}
            AND organization_id = $${organizationParameter}
          RETURNING
            id,
            field_key,
            display_name,
            description,
            category,
            data_type,
            aliases,
            repeatable,
            searchable,
            filterable,
            sortable,
            ai_extractable,
            user_editable,
            sensitive,
            validation_rule,
            controlled_vocabulary,
            unit,
            default_value,
            is_active,
            created_at,
            updated_at,
            organization_id
        `;

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
          res.status(404).json({
            success: false,
            error:
              "Field definition not found or does not belong to your organization.",
          });
          return;
        }

        res.json({
          success: true,
          field_definition: result.rows[0],
        });
      } catch (error: any) {
        console.error("Field update failed:", error);

        res.status(500).json({
          success: false,
          error: "Unable to update field definition",
          details:
            process.env.NODE_ENV === "development"
              ? error.message
              : undefined,
        });
      }
    }
  );

  // ------------------------------------------------------------
  // 6. ENABLE A FIELD
  // ------------------------------------------------------------

  router.post(
    "/:field_key/enable",
    requireAuthentication(pool),
    requireOrganizationContext(pool),
    requireRole("ADMIN", "OWNER"),
    async (req: Request, res: Response) => {
      const organizationId = getOrganizationId(req, res);

      if (organizationId === null) {
        return;
      }

      const fieldKey = req.params.field_key;

      try {
        const fieldCheck = await pool.query(
          `
            SELECT
              id,
              organization_id,
              is_active
            FROM field_registry
            WHERE field_key = $1
            LIMIT 1
          `,
          [fieldKey]
        );

        if (fieldCheck.rows.length === 0) {
          res.status(404).json({
            success: false,
            error: "Field definition not found.",
          });
          return;
        }

        const dbField = fieldCheck.rows[0];

        if (
          dbField.organization_id !== null &&
          dbField.organization_id !== organizationId
        ) {
          res.status(403).json({
            success: false,
            error:
              "Field definition does not belong to your organization.",
          });
          return;
        }

        const result = await pool.query(
          `
            UPDATE field_registry
            SET
              is_active = TRUE,
              updated_at = NOW()
            WHERE
              field_key = $1
              AND (
                organization_id = $2
                OR organization_id IS NULL
              )
              AND is_active = FALSE
            RETURNING
              id,
              field_key,
              display_name,
              is_active,
              updated_at,
              organization_id
          `,
          [fieldKey, organizationId]
        );

        if (result.rows.length === 0) {
          res.json({
            success: true,
            field_definition: {
              ...dbField,
              message: dbField.is_active
                ? "already active"
                : "could not be enabled",
            },
          });
          return;
        }

        res.json({
          success: true,
          field_definition: result.rows[0],
        });
      } catch (error) {
        console.error("Field enable failed:", error);

        res.status(500).json({
          success: false,
          error: "Unable to enable field definition",
        });
      }
    }
  );

  // ------------------------------------------------------------
  // 7. DISABLE A FIELD
  // ------------------------------------------------------------

  router.post(
    "/:field_key/disable",
    requireAuthentication(pool),
    requireOrganizationContext(pool),
    requireRole("ADMIN", "OWNER"),
    async (req: Request, res: Response) => {
      const organizationId = getOrganizationId(req, res);

      if (organizationId === null) {
        return;
      }

      const fieldKey = req.params.field_key;

      try {
        const fieldCheck = await pool.query(
          `
            SELECT
              id,
              organization_id,
              is_active
            FROM field_registry
            WHERE field_key = $1
            LIMIT 1
          `,
          [fieldKey]
        );

        if (fieldCheck.rows.length === 0) {
          res.status(404).json({
            success: false,
            error: "Field definition not found.",
          });
          return;
        }

        const dbField = fieldCheck.rows[0];

        if (dbField.organization_id === null) {
          res.status(403).json({
            success: false,
            error: "System fields cannot be disabled.",
          });
          return;
        }

        if (dbField.organization_id !== organizationId) {
          res.status(403).json({
            success: false,
            error:
              "Field definition does not belong to your organization.",
          });
          return;
        }

        const result = await pool.query(
          `
            UPDATE field_registry
            SET
              is_active = FALSE,
              updated_at = NOW()
            WHERE
              field_key = $1
              AND organization_id = $2
              AND is_active = TRUE
            RETURNING
              id,
              field_key,
              display_name,
              is_active,
              updated_at,
              organization_id
          `,
          [fieldKey, organizationId]
        );

        if (result.rows.length === 0) {
          res.status(404).json({
            success: false,
            error:
              "Field definition not found or already inactive.",
          });
          return;
        }

        res.json({
          success: true,
          field_definition: result.rows[0],
        });
      } catch (error) {
        console.error("Field disable failed:", error);

        res.status(500).json({
          success: false,
          error: "Unable to disable field definition",
        });
      }
    }
  );

  return router;
}
