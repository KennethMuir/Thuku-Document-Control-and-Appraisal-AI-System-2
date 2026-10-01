import { Router, type Request, type Response } from "express";
import type { Pool } from "pg";

import {
  getAvailableDomainByKey,
  getAvailableDomains,
} from "../services/domainAvailability.js";

import {
  requireAuthentication,
  requireOrganizationContext,
  requireRole,
  type AuthenticatedRequest,
} from "../middleware/auth.js";

export function createDomainRegistryRouter(pool: Pool) {
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

  const validDomainFamilies = [
    "General / Administrative",
    "Records Management",
    "Governance",
    "Compliance",
    "Risk",
    "Audit",
    "Security",
    "IT",
    "Finance",
    "Procurement",
    "Contracts",
    "HR",
    "Training",
    "Legal",
    "Regulatory",
    "Policy",
    "QA/QC",
    "Engineering",
    "Maintenance",
    "Aviation",
    "Healthcare",
    "Research / Scientific",
    "Education",
    "Environmental",
    "Project Management",
    "Business Operations",
  ];

  /**
   * Converts user-entered domain keys into the canonical stored form.
   *
   * Examples:
   *   "Aviation_Safety" -> "aviation_safety"
   *   "AVIATION SAFETY" -> "aviation_safety"
   *   "Aviation Safety" -> "aviation_safety"
   *   "Risk Management" -> "risk_management"
   *
   * Unsupported punctuation is not silently removed. It remains in the
   * normalized value and is rejected by the canonical key validation.
   */
  const normalizeDomainKey = (
    value: unknown
  ): string => {
    if (typeof value !== "string") {
      return "";
    }

    return value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
  };

  const isValidDomainKey = (
    domainKey: string
  ): boolean => {
    return (
      domainKey.length > 0 &&
      domainKey.length <= 100 &&
      /^[a-z][a-z0-9_]*$/.test(domainKey)
    );
  };

  // ------------------------------------------------------------
  // 2. LIST DOMAIN DEFINITIONS
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
        const domains = await getAvailableDomains(
          pool,
          organizationId
        );

        res.json({
          success: true,
          domain_registry: domains,
        });
      } catch (error) {
        console.error(
          "Domain registry query failed:",
          error
        );

        res.status(500).json({
          success: false,
          error:
            "Unable to retrieve domain definitions",
        });
      }
    }
  );

  // ------------------------------------------------------------
  // 3. GET A DOMAIN DEFINITION
  // ------------------------------------------------------------

  router.get(
    "/:domain_key",
    requireAuthentication(pool),
    requireOrganizationContext(pool),
    async (req: Request, res: Response) => {
      const organizationId = getOrganizationId(req, res);

      if (organizationId === null) {
        return;
      }

      const domainKey =
        normalizeDomainKey(req.params.domain_key);

      if (!domainKey) {
        res.status(400).json({
          success: false,
          error: "A domain_key is required.",
        });

        return;
      }

      if (!isValidDomainKey(domainKey)) {
        res.status(400).json({
          success: false,
          error:
            "Invalid domain_key. Domain keys may contain letters, numbers, spaces, and underscores, and must begin with a letter.",
        });

        return;
      }

      try {
        const domain = await getAvailableDomainByKey(
          pool,
          organizationId,
          domainKey
        );

        if (domain === null) {
          res.status(404).json({
            success: false,
            error: "Domain definition not found.",
          });

          return;
        }

        res.json({
          success: true,
          domain_definition: domain,
        });
      } catch (error) {
        console.error(
          "Domain definition query failed:",
          error
        );

        res.status(500).json({
          success: false,
          error:
            "Unable to retrieve domain definition",
        });
      }
    }
  );

  // ------------------------------------------------------------
  // 4. CREATE AN ORGANIZATION DOMAIN
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
        domain_key,
        display_name,
        description,
        domain_family,
        aliases,
      } = req.body;

      if (
        typeof display_name !== "string" ||
        display_name.trim() === "" ||
        typeof domain_family !== "string" ||
        domain_family.trim() === ""
      ) {
        res.status(400).json({
          success: false,
          error:
            "domain_key, display_name, and domain_family are required.",
        });

        return;
      }

      const normalizedDomainKey =
        normalizeDomainKey(domain_key);

      if (!normalizedDomainKey) {
        res.status(400).json({
          success: false,
          error: "Domain Key is required.",
        });

        return;
      }

      if (normalizedDomainKey.length > 100) {
        res.status(400).json({
          success: false,
          error:
            "Domain Key must not exceed 100 characters after normalization.",
        });

        return;
      }

      if (!isValidDomainKey(normalizedDomainKey)) {
        res.status(400).json({
          success: false,
          error:
            "Domain Key may contain letters, numbers, spaces, and underscores, and must begin with a letter.",
        });

        return;
      }

      const trimmedDisplayName =
        display_name.trim();

      if (
        !validDomainFamilies.includes(
          domain_family
        )
      ) {
        res.status(400).json({
          success: false,
          error: "Invalid domain_family.",
        });

        return;
      }

      try {
        const existing = await pool.query(
          `
            SELECT id
            FROM domain_registry
            WHERE
              domain_key = $1
              AND organization_id = $2
            LIMIT 1
          `,
          [
            normalizedDomainKey,
            organizationId,
          ]
        );

        if (existing.rows.length > 0) {
          res.status(409).json({
            success: false,
            error:
              "A domain definition with this key already exists in your organization.",
          });

          return;
        }

        const systemExisting =
          await pool.query(
            `
              SELECT id
              FROM domain_registry
              WHERE
                domain_key = $1
                AND organization_id IS NULL
              LIMIT 1
            `,
            [normalizedDomainKey]
          );

        if (systemExisting.rows.length > 0) {
          res.status(409).json({
            success: false,
            error:
              "A system domain with this key already exists. Organization-defined domains cannot override system domains.",
          });

          return;
        }

        const result = await pool.query(
          `
            INSERT INTO domain_registry (
              domain_key,
              display_name,
              description,
              domain_family,
              aliases,
              domain_scope,
              organization_id,
              specialization_id,
              is_active,
              created_at,
              updated_at
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5::jsonb,
              'ORGANIZATION',
              $6,
              NULL,
              TRUE,
              NOW(),
              NOW()
            )
            RETURNING
              id,
              domain_key,
              display_name,
              description,
              domain_family,
              aliases,
              domain_scope,
              organization_id,
              specialization_id,
              is_active,
              created_at,
              updated_at
          `,
          [
            normalizedDomainKey,
            trimmedDisplayName,
            description ?? null,
            domain_family,
            aliases ?? [],
            organizationId,
          ]
        );

        res.status(201).json({
          success: true,
          domain_definition:
            result.rows[0],
        });
      } catch (error: unknown) {
        console.error(
          "Domain creation failed:",
          error
        );

        const databaseError =
          error as {
            code?: string;
            message?: string;
          };

        if (
          databaseError.code === "23505"
        ) {
          res.status(409).json({
            success: false,
            error:
              "A domain definition with this key already exists.",
          });

          return;
        }

        if (
          databaseError.code === "23514"
        ) {
          res.status(400).json({
            success: false,
            error:
              "The domain definition violates the domain registry rules.",
          });

          return;
        }

        res.status(500).json({
          success: false,
          error:
            "Unable to create domain definition",
          details:
            process.env.NODE_ENV ===
            "development"
              ? databaseError.message
              : undefined,
        });
      }
    }
  );

  // ------------------------------------------------------------
  // 5. UPDATE AN ORGANIZATION DOMAIN
  // ------------------------------------------------------------

  router.patch(
    "/:domain_key",
    requireAuthentication(pool),
    requireOrganizationContext(pool),
    requireRole("ADMIN", "OWNER"),
    async (req: Request, res: Response) => {
      const organizationId =
        getOrganizationId(req, res);

      if (organizationId === null) {
        return;
      }

      const domainKey =
        normalizeDomainKey(
          req.params.domain_key
        );

      if (!domainKey) {
        res.status(400).json({
          success: false,
          error:
            "A domain_key is required.",
        });

        return;
      }

      if (!isValidDomainKey(domainKey)) {
        res.status(400).json({
          success: false,
          error:
            "Invalid domain_key.",
        });

        return;
      }

      const {
        display_name,
        description,
        domain_family,
        aliases,
      } = req.body;

      if (
        domain_family !== undefined &&
        !validDomainFamilies.includes(
          domain_family
        )
      ) {
        res.status(400).json({
          success: false,
          error: "Invalid domain_family.",
        });

        return;
      }

      try {
        const domainCheck =
          await pool.query(
            `
              SELECT
                id,
                organization_id,
                domain_scope,
                specialization_id,
                is_active
              FROM domain_registry
              WHERE
                domain_key = $1
              LIMIT 1
            `,
            [domainKey]
          );

        if (
          domainCheck.rows.length === 0
        ) {
          res.status(404).json({
            success: false,
            error:
              "Domain definition not found.",
          });

          return;
        }

        const dbDomain =
          domainCheck.rows[0];

        if (
          dbDomain.domain_scope !==
          "ORGANIZATION"
        ) {
          res.status(403).json({
            success: false,
            error:
              "System-controlled domains cannot be modified by an organization.",
          });

          return;
        }

        if (
          dbDomain.organization_id !==
          organizationId
        ) {
          res.status(403).json({
            success: false,
            error:
              "Domain definition does not belong to your organization.",
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
                cast
                  ? `::${cast}`
                  : ""
              }`
            );

            values.push(value);
            parameterIndex++;
          }
        };

        addValue(
          "display_name",
          display_name
        );

        addValue(
          "description",
          description
        );

        addValue(
          "domain_family",
          domain_family
        );

        addValue(
          "aliases",
          aliases,
          "jsonb"
        );

        if (setClauses.length === 0) {
          res.status(400).json({
            success: false,
            error:
              "No fields to update.",
          });

          return;
        }

        setClauses.push(
          "updated_at = NOW()"
        );

        values.push(domainKey);

        const domainKeyParameter =
          parameterIndex;

        parameterIndex++;

        values.push(organizationId);

        const organizationParameter =
          parameterIndex;

        const query = `
          UPDATE domain_registry
          SET
            ${setClauses.join(", ")}
          WHERE
            domain_key = $${domainKeyParameter}
            AND organization_id = $${organizationParameter}
          RETURNING
            id,
            domain_key,
            display_name,
            description,
            domain_family,
            aliases,
            domain_scope,
            organization_id,
            specialization_id,
            is_active,
            created_at,
            updated_at
        `;

        const result =
          await pool.query(
            query,
            values
          );

        if (
          result.rows.length === 0
        ) {
          res.status(404).json({
            success: false,
            error:
              "Domain definition not found or does not belong to your organization.",
          });

          return;
        }

        res.json({
          success: true,
          domain_definition:
            result.rows[0],
        });
      } catch (error: unknown) {
        console.error(
          "Domain update failed:",
          error
        );

        const databaseError =
          error as {
            code?: string;
            message?: string;
          };

        if (
          databaseError.code ===
          "23514"
        ) {
          res.status(400).json({
            success: false,
            error:
              "The domain definition violates the domain registry rules.",
          });

          return;
        }

        res.status(500).json({
          success: false,
          error:
            "Unable to update domain definition",
          details:
            process.env.NODE_ENV ===
            "development"
              ? databaseError.message
              : undefined,
        });
      }
    }
  );

  // ------------------------------------------------------------
  // 6. ENABLE A DOMAIN
  // ------------------------------------------------------------

  router.post(
    "/:domain_key/enable",
    requireAuthentication(pool),
    requireOrganizationContext(pool),
    requireRole("ADMIN", "OWNER"),
    async (req: Request, res: Response) => {
      const organizationId =
        getOrganizationId(req, res);

      if (organizationId === null) {
        return;
      }

      const domainKey =
        normalizeDomainKey(
          req.params.domain_key
        );

      if (!domainKey) {
        res.status(400).json({
          success: false,
          error:
            "A domain_key is required.",
        });

        return;
      }

      if (!isValidDomainKey(domainKey)) {
        res.status(400).json({
          success: false,
          error:
            "Invalid domain_key.",
        });

        return;
      }

      try {
        const domainCheck =
          await pool.query(
            `
              SELECT
                id,
                organization_id,
                domain_scope,
                is_active
              FROM domain_registry
              WHERE
                domain_key = $1
              ORDER BY
                CASE
                  WHEN organization_id IS NULL
                    THEN 0
                  ELSE 1
                END
              LIMIT 1
            `,
            [domainKey]
          );

        if (
          domainCheck.rows.length ===
          0
        ) {
          res.status(404).json({
            success: false,
            error:
              "Domain definition not found.",
          });

          return;
        }

        const dbDomain =
          domainCheck.rows[0];

        if (
          dbDomain.domain_scope !==
          "ORGANIZATION"
        ) {
          res.status(403).json({
            success: false,
            error:
              "System-controlled domains cannot be enabled by an organization.",
          });

          return;
        }

        if (
          dbDomain.organization_id !==
          organizationId
        ) {
          res.status(403).json({
            success: false,
            error:
              "Domain definition does not belong to your organization.",
          });

          return;
        }

        const result =
          await pool.query(
            `
              UPDATE domain_registry
              SET
                is_active = TRUE,
                updated_at = NOW()
              WHERE
                domain_key = $1
                AND organization_id = $2
                AND domain_scope = 'ORGANIZATION'
                AND is_active = FALSE
              RETURNING
                id,
                domain_key,
                display_name,
                domain_scope,
                organization_id,
                specialization_id,
                is_active,
                updated_at
            `,
            [
              domainKey,
              organizationId,
            ]
          );

        if (
          result.rows.length === 0
        ) {
          res.json({
            success: true,
            domain_definition: {
              ...dbDomain,
              message:
                dbDomain.is_active
                  ? "already active"
                  : "could not be enabled",
            },
          });

          return;
        }

        res.json({
          success: true,
          domain_definition:
            result.rows[0],
        });
      } catch (error) {
        console.error(
          "Domain enable failed:",
          error
        );

        res.status(500).json({
          success: false,
          error:
            "Unable to enable domain definition",
        });
      }
    }
  );

  // ------------------------------------------------------------
  // 7. DISABLE A DOMAIN
  // ------------------------------------------------------------

  router.post(
    "/:domain_key/disable",
    requireAuthentication(pool),
    requireOrganizationContext(pool),
    requireRole("ADMIN", "OWNER"),
    async (req: Request, res: Response) => {
      const organizationId =
        getOrganizationId(req, res);

      if (organizationId === null) {
        return;
      }

      const domainKey =
        normalizeDomainKey(
          req.params.domain_key
        );

      if (!domainKey) {
        res.status(400).json({
          success: false,
          error:
            "A domain_key is required.",
        });

        return;
      }

      if (!isValidDomainKey(domainKey)) {
        res.status(400).json({
          success: false,
          error:
            "Invalid domain_key.",
        });

        return;
      }

      try {
        const domainCheck =
          await pool.query(
            `
              SELECT
                id,
                organization_id,
                domain_scope,
                is_active
              FROM domain_registry
              WHERE
                domain_key = $1
              ORDER BY
                CASE
                  WHEN organization_id IS NULL
                    THEN 0
                  ELSE 1
                END
              LIMIT 1
            `,
            [domainKey]
          );

        if (
          domainCheck.rows.length ===
          0
        ) {
          res.status(404).json({
            success: false,
            error:
              "Domain definition not found.",
          });

          return;
        }

        const dbDomain =
          domainCheck.rows[0];

        if (
          dbDomain.organization_id ===
          null
        ) {
          res.status(403).json({
            success: false,
            error:
              "System domains cannot be disabled.",
          });

          return;
        }

        if (
          dbDomain.organization_id !==
          organizationId
        ) {
          res.status(403).json({
            success: false,
            error:
              "Domain definition does not belong to your organization.",
          });

          return;
        }

        if (
          dbDomain.domain_scope !==
          "ORGANIZATION"
        ) {
          res.status(403).json({
            success: false,
            error:
              "System-controlled domains cannot be disabled by an organization.",
          });

          return;
        }

        const result =
          await pool.query(
            `
              UPDATE domain_registry
              SET
                is_active = FALSE,
                updated_at = NOW()
              WHERE
                domain_key = $1
                AND organization_id = $2
                AND domain_scope = 'ORGANIZATION'
                AND is_active = TRUE
              RETURNING
                id,
                domain_key,
                display_name,
                domain_scope,
                organization_id,
                specialization_id,
                is_active,
                updated_at
            `,
            [
              domainKey,
              organizationId,
            ]
          );

        if (
          result.rows.length === 0
        ) {
          res.status(404).json({
            success: false,
            error:
              "Domain definition not found or already inactive.",
          });

          return;
        }

        res.json({
          success: true,
          domain_definition:
            result.rows[0],
        });
      } catch (error) {
        console.error(
          "Domain disable failed:",
          error
        );

        res.status(500).json({
          success: false,
          error:
            "Unable to disable domain definition",
        });
      }
    }
  );

  return router;
}