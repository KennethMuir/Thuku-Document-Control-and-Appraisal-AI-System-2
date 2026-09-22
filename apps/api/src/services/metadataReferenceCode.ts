import type { PoolClient } from "pg";

export async function generateMetadataReferenceCode(
  client: PoolClient,
  organizationId: number,
  departmentId: number
): Promise<string> {
  const departmentResult = await client.query<{
    id: number;
    code: string;
  }>(
    `
      SELECT
        id,
        code
      FROM departments
      WHERE id = $1
        AND organization_id = $2
      FOR UPDATE
    `,
    [departmentId, organizationId]
  );

  if (departmentResult.rowCount === 0) {
    throw new Error(
      "Department does not belong to your organization."
    );
  }

  const departmentCode =
    String(departmentResult.rows[0]?.code || "")
      .trim()
      .toUpperCase();

  if (!departmentCode) {
    throw new Error(
      "Department does not have a valid code."
    );
  }

  const numberResult = await client.query<{
    max_number: string | null;
  }>(
    `
      SELECT
        MAX(
          CAST(
            SUBSTRING(
              m.reference_code
              FROM LENGTH(d.code) + 2
            ) AS BIGINT
          )
        ) AS max_number
      FROM metadata_records m
      INNER JOIN departments d
        ON d.id = m.department_id
       AND d.organization_id = m.organization_id
      WHERE m.organization_id = $1
        AND d.id = $2
        AND LOWER(
          LEFT(
            m.reference_code,
            LENGTH(d.code) + 1
          )
        ) = LOWER(d.code) || '-'
        AND SUBSTRING(
          m.reference_code
          FROM LENGTH(d.code) + 2
        ) ~ '^(0|[1-9][0-9]*)$'
        AND (
          SUBSTRING(
            m.reference_code
            FROM LENGTH(d.code) + 2
          ) = '0'
          OR SUBSTRING(
            m.reference_code
            FROM LENGTH(d.code) + 2
          ) !~ '^0[0-9]+$'
        )
    `,
    [organizationId, departmentId]
  );

  const currentMaximum = Number(
    numberResult.rows[0]?.max_number ?? "0"
  );

  if (
    !Number.isSafeInteger(currentMaximum) ||
    currentMaximum < 0
  ) {
    throw new Error(
      "The existing metadata reference numbering is invalid."
    );
  }

  return `${departmentCode}-${currentMaximum + 1}`;
}
