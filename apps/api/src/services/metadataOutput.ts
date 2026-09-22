import type { Pool } from "pg";

export async function getPopulatedMetadataOutput(
  pool: Pool,
  organizationId: number,
  metadataRecordId: number
) {
  const recordResult = await pool.query(
    `
      SELECT
        mr.id,
        mr.reference_code,
        mr.title,
        mr.document_date,
        mr.year,
        mr.person_name,
        mr.description,
        mr.status,
        mr.department_id,
        mr.document_type_id,
        mr.additional_metadata,
        mr.organization_id,
        mr.created_at
      FROM metadata_records mr
      WHERE
        mr.id = $1
        AND mr.organization_id = $2
      LIMIT 1
    `,
    [metadataRecordId, organizationId]
  );

  if (recordResult.rows.length === 0) {
    return null;
  }

  const valuesResult = await pool.query(
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
        fr.description AS field_description,
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

        COALESCE(mfp.enabled, TRUE) AS profile_enabled,
        COALESCE(mfp.required, FALSE) AS profile_required,
        COALESCE(mfp.display_order, 0) AS profile_display_order

      FROM metadata_values mv

      INNER JOIN field_registry fr
        ON fr.id = mv.field_registry_id

      LEFT JOIN metadata_field_profiles mfp
        ON mfp.field_registry_id = fr.id
        AND mfp.organization_id = $2

      WHERE
        mv.metadata_record_id = $1
        AND mv.organization_id = $2
        AND fr.is_active = TRUE

        AND mv.value IS NOT NULL
        AND NOT (
          mv.value = 'null'::jsonb
          OR mv.value = '""'::jsonb
          OR mv.value = '{}'::jsonb
          OR mv.value = '[]'::jsonb
          OR (
            jsonb_typeof(mv.value) = 'string'
            AND btrim(mv.value #>> '{}') = ''
          )
        )

      ORDER BY
        COALESCE(mfp.display_order, 0),
        fr.category,
        fr.display_name,
        fr.id,
        mv.id
    `,
    [metadataRecordId, organizationId]
  );

  return {
    metadata_record: recordResult.rows[0],
    values: valuesResult.rows,
    value_count: valuesResult.rows.length,
  };
}
