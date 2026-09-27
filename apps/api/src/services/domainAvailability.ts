import type { Pool } from "pg";

const AVAILABLE_DOMAIN_SELECT = `
  SELECT
    dr.id,
    dr.domain_key,
    dr.display_name,
    dr.description,
    dr.domain_family,
    COALESCE(dr.aliases, '[]'::jsonb) AS aliases,
    dr.domain_scope,
    dr.organization_id,
    dr.specialization_id,
    s.specialization_key,
    s.display_name AS specialization_name,
    dr.is_active,
    dr.created_at,
    dr.updated_at
  FROM domain_registry dr
  LEFT JOIN specializations s
    ON s.id = dr.specialization_id
  INNER JOIN organizations o
    ON o.id = $1
  WHERE dr.is_active = TRUE
    AND (
      dr.domain_scope = 'UNIVERSAL'
      OR (
        dr.domain_scope = 'SPECIALIZED'
        AND o.specialization_id = dr.specialization_id
      )
      OR (
        dr.domain_scope = 'ORGANIZATION'
        AND dr.organization_id = $1
      )
    )
`;

export async function getAvailableDomains(
  pool: Pool,
  organizationId: number
) {
  const result = await pool.query(
    `${AVAILABLE_DOMAIN_SELECT}
     ORDER BY
       CASE dr.domain_scope
         WHEN 'UNIVERSAL' THEN 1
         WHEN 'SPECIALIZED' THEN 2
         WHEN 'ORGANIZATION' THEN 3
         ELSE 4
       END,
       dr.display_name`,
    [organizationId]
  );

  return result.rows;
}

export async function getAvailableDomainById(
  pool: Pool,
  organizationId: number,
  domainId: number
) {
  const result = await pool.query(
    `${AVAILABLE_DOMAIN_SELECT}
     AND dr.id = $2
     LIMIT 1`,
    [organizationId, domainId]
  );

  return result.rows[0] ?? null;
}

export async function getAvailableDomainByKey(
  pool: Pool,
  organizationId: number,
  domainKey: string
) {
  const result = await pool.query(
    `${AVAILABLE_DOMAIN_SELECT}
     AND dr.domain_key = $2
     LIMIT 1`,
    [organizationId, domainKey]
  );

  return result.rows[0] ?? null;
}
