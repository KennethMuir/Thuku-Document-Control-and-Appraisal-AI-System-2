import { Router, type Request, type Response } from "express";
import type { Pool } from "pg";

import {
  getAvailableDomainByKey,
  getAvailableDomainById,
} from "../services/domainAvailability";

import {
  requireAuthentication,
  requireOrganizationContext,
  requireRole,
  type AuthenticatedRequest,
} from "../middleware/auth.js";

const RELATIONSHIP_TYPES = [
  "SUBJECT",
  "RECORD",
  "PROCESS",
  "ACTIVITY",
  "TASK",
  "SERVICE",
  "EVENT",
  "REQUIREMENT",
  "OBLIGATION",
  "AUTHORITY",
  "POLICY",
  "DECISION",
  "APPROVAL",
  "AUTHORIZATION",
  "AGREEMENT",
  "PARTY",
  "TRANSACTION",
  "PAYMENT",
  "REQUEST",
  "SUBMISSION",
  "NOTICE",
  "AMENDMENT",
  "RENEWAL",
  "TERMINATION",
  "DISPUTE",
  "ASSESSMENT",
  "REVIEW",
  "INSPECTION",
  "AUDIT",
  "EVIDENCE",
  "FINDING",
  "RECOMMENDATION",
  "RISK",
  "CONTROL",
  "INCIDENT",
  "ISSUE",
  "INVESTIGATION",
  "CHANGE",
  "EXCEPTION",
  "DEPENDENCY",
  "FOLLOW_UP",
  "REPORT",
  "DATA",
  "ANALYSIS",
  "RESULT",
  "ASSET",
  "RESOURCE",
  "COST",
  "FUNDING",
  "BUDGET",
  "ACCOUNT",
  "LICENSE",
  "PERMIT",
  "CERTIFICATION",
  "COMPLIANCE",
  "CLASSIFICATION",
  "RETENTION",
  "ACCESS",
  "TRANSFER",
  "CUSTODY",
  "PRESERVATION",
  "DISPOSITION",
];

export function createDomainRelationshipsRouter(
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

  const isRelationshipType = (
    value: unknown
  ): value is RelationshipType =>
    typeof value === "string" &&
    RELATIONSHIP_TYPES.includes(
      value as RelationshipType
    );

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

  // ------------------------------------------------------------
  // LIST RELATIONSHIPS FOR A METADATA RECORD
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
                mdr.id,
                mdr.metadata_record_id,
                mdr.domain_id,
                mdr.organization_id,
                mdr.relationship_type,
                mdr.created_at,
                mdr.updated_at,

                dr.domain_key,
                dr.display_name AS domain_display_name,
                dr.description AS domain_description,
                dr.domain_family,
                dr.aliases,
                dr.is_active,
                dr.organization_id AS domain_organization_id

              FROM metadata_domain_relationships mdr

              INNER JOIN domain_registry dr
                ON dr.id = mdr.domain_id

              WHERE
                mdr.metadata_record_id = $1
                AND mdr.organization_id = $2

              ORDER BY
                dr.display_name,
                mdr.relationship_type,
                mdr.id
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
          relationships:
            result.rows,
          relationship_types:
            RELATIONSHIP_TYPES,
        });
      } catch (error) {
        console.error(
          "Metadata domain relationship query failed:",
          error
        );

        res.status(500).json({
          success: false,
          error:
            "Unable to retrieve metadata domain relationships.",
        });
      }
    }
  );

  // ------------------------------------------------------------
  // LIST METADATA AND DOCUMENTS FOR A DOMAIN
  // ------------------------------------------------------------

  router.get(
    "/domain/:domain_key",
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

      const domainKey =
        typeof req.params.domain_key ===
        "string"
          ? req.params.domain_key.trim()
          : "";

      if (!domainKey) {
        res.status(400).json({
          success: false,
          error:
            "A domain_key is required.",
        });
        return;
      }

      try {
        const domain =
          await getAvailableDomainByKey(
            pool,
            organizationId,
            domainKey
          );

        if (domain === null) {
          res.status(404).json({
            success: false,
            error:
              "Domain not found or is not available to your organization.",
          });
          return;
        }

        const result =
          await pool.query(
            `
              SELECT
                mdr.id AS relationship_id,
                mdr.metadata_record_id,
                mdr.relationship_type,
                mdr.created_at AS relationship_created_at,
                mdr.updated_at AS relationship_updated_at,

                mr.reference_code,
                mr.title,
                mr.document_date,
                mr.year,
                mr.person_name,
                mr.description,
                mr.section,
                mr.status AS metadata_status,

                COALESCE(
                  (
                    SELECT jsonb_agg(
                      jsonb_build_object(
                        'id', doc.id,
                        'document_code',
                          doc.document_code,
                        'filename',
                          doc.filename,
                        'title',
                          doc.title,
                        'document_date',
                          doc.document_date,
                        'upload_date',
                          doc.upload_date,
                        'year',
                          doc.year,
                        'person_name',
                          doc.person_name,
                        'status',
                          doc.status
                      )
                      ORDER BY
                        doc.upload_date DESC,
                        doc.id DESC
                    )
                    FROM documents doc
                    WHERE
                      doc.metadata_record_id =
                        mr.id
                      AND doc.organization_id =
                        mr.organization_id
                  ),
                  '[]'::jsonb
                ) AS linked_documents

              FROM metadata_domain_relationships mdr

              INNER JOIN metadata_records mr
                ON mr.id =
                  mdr.metadata_record_id
                AND mr.organization_id =
                  mdr.organization_id

              WHERE
                mdr.domain_id = $1
                AND mdr.organization_id = $2

              ORDER BY
                mr.created_at DESC,
                mr.id DESC,
                mdr.relationship_type
            `,
            [
              domain.id,
              organizationId,
            ]
          );

        res.json({
          success: true,
          domain,
          metadata: result.rows,
          relationship_types:
            RELATIONSHIP_TYPES,
        });
      } catch (error) {
        console.error(
          "Domain affiliated metadata query failed:",
          error
        );

        res.status(500).json({
          success: false,
          error:
            "Unable to retrieve metadata affiliated with this domain.",
        });
      }
    }
  );

  // ------------------------------------------------------------
  // CREATE A DOMAIN RELATIONSHIP
  // ------------------------------------------------------------

  router.post(
    "/",
    requireAuthentication(pool),
    requireOrganizationContext(pool),
    requireRole(
      "ADMIN",
      "APPRAISER"
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

      const domainId =
        parsePositiveInteger(
          req.body?.domain_id
        );

      const relationshipType =
        req.body?.relationship_type;

      if (
        metadataRecordId === null ||
        domainId === null
      ) {
        res.status(400).json({
          success: false,
          error:
            "metadata_record_id and domain_id must be positive integers.",
        });
        return;
      }

      if (
        !isRelationshipType(
          relationshipType
        )
      ) {
        res.status(400).json({
          success: false,
          error:
            "Invalid relationship_type.",
          allowed_relationship_types:
            RELATIONSHIP_TYPES,
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
                title
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

        const domain =
          await getAvailableDomainById(
            pool,
            organizationId,
            domainId
          );

        if (domain === null) {
          res.status(404).json({
            success: false,
            error:
              "Domain not found or is not available to your organization.",
          });
          return;
        }

        if (!domain.is_active) {
          res.status(400).json({
            success: false,
            error:
              "Inactive domains cannot be assigned to metadata.",
          });
          return;
        }

        const duplicate =
          await pool.query(
            `
              SELECT id
              FROM metadata_domain_relationships
              WHERE
                metadata_record_id = $1
                AND domain_id = $2
                AND relationship_type = $3
                AND organization_id = $4
              LIMIT 1
            `,
            [
              metadataRecordId,
              domainId,
              relationshipType,
              organizationId,
            ]
          );

        if (
          duplicate.rows.length > 0
        ) {
          res.status(409).json({
            success: false,
            error:
              "This domain relationship already exists.",
            relationship_id:
              duplicate.rows[0].id,
          });
          return;
        }

        const result =
          await pool.query(
            `
              INSERT INTO metadata_domain_relationships (
                metadata_record_id,
                domain_id,
                organization_id,
                relationship_type,
                created_at,
                updated_at
              )
              VALUES (
                $1,
                $2,
                $3,
                $4,
                NOW(),
                NOW()
              )
              RETURNING
                id,
                metadata_record_id,
                domain_id,
                organization_id,
                relationship_type,
                created_at,
                updated_at
            `,
            [
              metadataRecordId,
              domainId,
              organizationId,
              relationshipType,
            ]
          );

        res.status(201).json({
          success: true,
          relationship:
            result.rows[0],
          metadata_record:
            metadataCheck.rows[0],
          domain,
        });
      } catch (error: any) {
        console.error(
          "Domain relationship creation failed:",
          error
        );

        if (
          error?.code === "23505"
        ) {
          res.status(409).json({
            success: false,
            error:
              "This domain relationship already exists.",
          });
          return;
        }

        if (
          error?.code === "23514"
        ) {
          res.status(400).json({
            success: false,
            error:
              "The relationship type is not permitted.",
            allowed_relationship_types:
              RELATIONSHIP_TYPES,
          });
          return;
        }

        if (
          error?.code === "P0001"
        ) {
          res.status(403).json({
            success: false,
            error:
              error.message ||
              "The domain relationship does not belong to the current organization.",
          });
          return;
        }

        res.status(500).json({
          success: false,
          error:
            "Unable to create domain relationship.",
          details:
            process.env.NODE_ENV ===
            "development"
              ? error.message
              : undefined,
        });
      }
    }
  );

  // ------------------------------------------------------------
  // UPDATE A DOMAIN RELATIONSHIP TYPE
  // ------------------------------------------------------------

  router.patch(
    "/:relationship_id",
    requireAuthentication(pool),
    requireOrganizationContext(pool),
    requireRole(
      "ADMIN",
      "APPRAISER"
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

      const relationshipId =
        parsePositiveInteger(
          req.params.relationship_id
        );

      if (relationshipId === null) {
        res.status(400).json({
          success: false,
          error:
            "A valid relationship_id is required.",
        });
        return;
      }

      const relationshipType =
        req.body?.relationship_type;

      if (
        !isRelationshipType(
          relationshipType
        )
      ) {
        res.status(400).json({
          success: false,
          error:
            "Invalid relationship_type.",
          allowed_relationship_types:
            RELATIONSHIP_TYPES,
        });
        return;
      }

      try {
        const existing =
          await pool.query(
            `
              SELECT
                id,
                metadata_record_id,
                domain_id,
                organization_id,
                relationship_type
              FROM metadata_domain_relationships
              WHERE
                id = $1
                AND organization_id = $2
              LIMIT 1
            `,
            [
              relationshipId,
              organizationId,
            ]
          );

        if (
          existing.rows.length === 0
        ) {
          res.status(404).json({
            success: false,
            error:
              "Domain relationship not found.",
          });
          return;
        }

        const current =
          existing.rows[0];

        const duplicate =
          await pool.query(
            `
              SELECT id
              FROM metadata_domain_relationships
              WHERE
                metadata_record_id =
                  $1
                AND domain_id = $2
                AND relationship_type = $3
                AND organization_id = $4
                AND id <> $5
              LIMIT 1
            `,
            [
              current.metadata_record_id,
              current.domain_id,
              relationshipType,
              organizationId,
              relationshipId,
            ]
          );

        if (
          duplicate.rows.length > 0
        ) {
          res.status(409).json({
            success: false,
            error:
              "Another relationship with this metadata, domain, and relationship type already exists.",
            relationship_id:
              duplicate.rows[0].id,
          });
          return;
        }

        const result =
          await pool.query(
            `
              UPDATE metadata_domain_relationships
              SET
                relationship_type = $1,
                updated_at = NOW()
              WHERE
                id = $2
                AND organization_id = $3
              RETURNING
                id,
                metadata_record_id,
                domain_id,
                organization_id,
                relationship_type,
                created_at,
                updated_at
            `,
            [
              relationshipType,
              relationshipId,
              organizationId,
            ]
          );

        if (
          result.rows.length === 0
        ) {
          res.status(404).json({
            success: false,
            error:
              "Domain relationship not found.",
          });
          return;
        }

        res.json({
          success: true,
          relationship:
            result.rows[0],
        });
      } catch (error: any) {
        console.error(
          "Domain relationship update failed:",
          error
        );

        if (
          error?.code === "23505"
        ) {
          res.status(409).json({
            success: false,
            error:
              "This domain relationship already exists.",
          });
          return;
        }

        res.status(500).json({
          success: false,
          error:
            "Unable to update domain relationship.",
          details:
            process.env.NODE_ENV ===
            "development"
              ? error.message
              : undefined,
        });
      }
    }
  );

  // ------------------------------------------------------------
  // DELETE A DOMAIN RELATIONSHIP
  // ------------------------------------------------------------

  router.delete(
    "/:relationship_id",
    requireAuthentication(pool),
    requireOrganizationContext(pool),
    requireRole(
      "ADMIN",
      "APPRAISER"
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

      const relationshipId =
        parsePositiveInteger(
          req.params.relationship_id
        );

      if (relationshipId === null) {
        res.status(400).json({
          success: false,
          error:
            "A valid relationship_id is required.",
        });
        return;
      }

      try {
        const result =
          await pool.query(
            `
              DELETE FROM metadata_domain_relationships
              WHERE
                id = $1
                AND organization_id = $2
              RETURNING
                id,
                metadata_record_id,
                domain_id,
                organization_id,
                relationship_type,
                created_at,
                updated_at
            `,
            [
              relationshipId,
              organizationId,
            ]
          );

        if (
          result.rows.length === 0
        ) {
          res.status(404).json({
            success: false,
            error:
              "Domain relationship not found.",
          });
          return;
        }

        res.json({
          success: true,
          relationship:
            result.rows[0],
          message:
            "Domain relationship removed.",
        });
      } catch (error) {
        console.error(
          "Domain relationship deletion failed:",
          error
        );

        res.status(500).json({
          success: false,
          error:
            "Unable to remove domain relationship.",
        });
      }
    }
  );

  // ------------------------------------------------------------
  // RELATIONSHIP TYPES
  // ------------------------------------------------------------

  router.get(
    "/relationship-types/list",
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

      res.json({
        success: true,
        relationship_types:
          RELATIONSHIP_TYPES,
      });
    }
  );

  return router;
}

