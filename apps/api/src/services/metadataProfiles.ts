import type { Pool } from "pg";

export type MetadataFieldProfileInput = {
  fieldRegistryId: number;
  enabled?: boolean;
  required?: boolean;
  displayOrder?: number;
};

export async function listMetadataFieldProfiles(
  pool: Pool,
  organizationId: number
) {
  const result = await pool.query(
    `
      SELECT
        fr.id AS field_registry_id,
        fr.field_key,
        fr.display_name,
        fr.description,
        fr.category,
        fr.data_type,
        fr.aliases,
        fr.repeatable,
        fr.searchable,
        fr.filterable,
        fr.sortable,
        fr.ai_extractable,
        fr.user_editable,
        fr.sensitive,
        fr.validation_rule,
        fr.controlled_vocabulary,
        fr.unit,
        fr.default_value,
        fr.organization_id AS field_organization_id,
        fr.is_active AS field_is_active,

        mfp.id AS profile_id,
        COALESCE(mfp.enabled, TRUE) AS enabled,
        COALESCE(mfp.required, FALSE) AS required,
        COALESCE(mfp.display_order, 0) AS display_order,
        mfp.created_at AS profile_created_at,
        mfp.updated_at AS profile_updated_at

      FROM field_registry fr

      LEFT JOIN metadata_field_profiles mfp
        ON mfp.field_registry_id = fr.id
        AND mfp.organization_id = $1

      WHERE
        fr.is_active = TRUE
        AND (
          fr.organization_id IS NULL
          OR fr.organization_id = $1
        )

      ORDER BY
        COALESCE(mfp.display_order, 0),
        fr.category,
        fr.display_name,
        fr.id
    `,
    [organizationId]
  );

  return result.rows;
}

export async function getMetadataFieldProfile(
  pool: Pool,
  organizationId: number,
  fieldRegistryId: number
) {
  const result = await pool.query(
    `
      SELECT
        fr.id AS field_registry_id,
        fr.field_key,
        fr.display_name,
        fr.description,
        fr.category,
        fr.data_type,
        fr.aliases,
        fr.repeatable,
        fr.searchable,
        fr.filterable,
        fr.sortable,
        fr.ai_extractable,
        fr.user_editable,
        fr.sensitive,
        fr.validation_rule,
        fr.controlled_vocabulary,
        fr.unit,
        fr.default_value,
        fr.organization_id AS field_organization_id,
        fr.is_active AS field_is_active,

        mfp.id AS profile_id,
        COALESCE(mfp.enabled, TRUE) AS enabled,
        COALESCE(mfp.required, FALSE) AS required,
        COALESCE(mfp.display_order, 0) AS display_order,
        mfp.created_at AS profile_created_at,
        mfp.updated_at AS profile_updated_at

      FROM field_registry fr

      LEFT JOIN metadata_field_profiles mfp
        ON mfp.field_registry_id = fr.id
        AND mfp.organization_id = $1

      WHERE
        fr.id = $2
        AND fr.is_active = TRUE
        AND (
          fr.organization_id IS NULL
          OR fr.organization_id = $1
        )

      LIMIT 1
    `,
    [organizationId, fieldRegistryId]
  );

  return result.rows[0] ?? null;
}

export async function upsertMetadataFieldProfile(
  pool: Pool,
  organizationId: number,
  input: MetadataFieldProfileInput
) {
  const fieldResult = await pool.query(
    `
      SELECT
        id,
        organization_id,
        is_active
      FROM field_registry
      WHERE
        id = $1
        AND is_active = TRUE
        AND (
          organization_id IS NULL
          OR organization_id = $2
        )
      LIMIT 1
    `,
    [input.fieldRegistryId, organizationId]
  );

  if (fieldResult.rows.length === 0) {
    return {
      kind: "not_found" as const,
    };
  }

  const field = fieldResult.rows[0];

  if (
    field.organization_id !== null &&
    Number(field.organization_id) !== organizationId
  ) {
    return {
      kind: "forbidden" as const,
    };
  }

  const result = await pool.query(
    `
      INSERT INTO metadata_field_profiles (
        organization_id,
        field_registry_id,
        enabled,
        required,
        display_order
      )
      VALUES (
        $1,
        $2,
        COALESCE($3, TRUE),
        COALESCE($4, FALSE),
        COALESCE($5, 0)
      )
      ON CONFLICT (
        organization_id,
        field_registry_id
      )
      DO UPDATE SET
        enabled = COALESCE(
          EXCLUDED.enabled,
          metadata_field_profiles.enabled
        ),
        required = COALESCE(
          EXCLUDED.required,
          metadata_field_profiles.required
        ),
        display_order = COALESCE(
          EXCLUDED.display_order,
          metadata_field_profiles.display_order
        ),
        updated_at = NOW()

      RETURNING
        id,
        organization_id,
        field_registry_id,
        enabled,
        required,
        display_order,
        created_at,
        updated_at
    `,
    [
      organizationId,
      input.fieldRegistryId,
      input.enabled ?? true,
      input.required ?? false,
      input.displayOrder ?? 0,
    ]
  );

  return {
    kind: "ok" as const,
    profile: result.rows[0],
  };
}

export async function deleteMetadataFieldProfile(
  pool: Pool,
  organizationId: number,
  fieldRegistryId: number
) {
  const result = await pool.query(
    `
      DELETE FROM metadata_field_profiles
      WHERE
        organization_id = $1
        AND field_registry_id = $2

      RETURNING
        id,
        organization_id,
        field_registry_id
    `,
    [organizationId, fieldRegistryId]
  );

  return result.rows[0] ?? null;
}
