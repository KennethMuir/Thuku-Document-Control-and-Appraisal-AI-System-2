BEGIN;

INSERT INTO metadata_values (
    metadata_record_id,
    field_registry_id,
    value,
    source,
    confidence,
    verification_status,
    organization_id
)
SELECT
    mr.id,
    fr.id,
    source_data.value,
    'MIGRATION',
    NULL,
    'UNVERIFIED',
    mr.organization_id
FROM metadata_records mr
LEFT JOIN departments d
    ON d.id = mr.department_id
LEFT JOIN document_types dt
    ON dt.id = mr.document_type_id
CROSS JOIN LATERAL (
    VALUES
        (
            'reference_code',
            CASE
                WHEN NULLIF(BTRIM(mr.reference_code), '') IS NOT NULL
                THEN to_jsonb(BTRIM(mr.reference_code))
                ELSE NULL
            END
        ),
        (
            'title',
            CASE
                WHEN NULLIF(BTRIM(mr.title), '') IS NOT NULL
                THEN to_jsonb(BTRIM(mr.title))
                ELSE NULL
            END
        ),
        (
            'document_date',
            CASE
                WHEN mr.document_date IS NOT NULL
                THEN to_jsonb(mr.document_date::text)
                ELSE NULL
            END
        ),
        (
            'year',
            CASE
                WHEN mr.year IS NOT NULL
                THEN to_jsonb(mr.year)
                ELSE NULL
            END
        ),
        (
            'department',
            CASE
                WHEN NULLIF(BTRIM(d.name), '') IS NOT NULL
                THEN to_jsonb(BTRIM(d.name))
                ELSE NULL
            END
        ),
        (
            'document_type',
            CASE
                WHEN NULLIF(BTRIM(dt.name), '') IS NOT NULL
                THEN to_jsonb(BTRIM(dt.name))
                ELSE NULL
            END
        ),
        (
            'section',
            CASE
                WHEN NULLIF(BTRIM(mr.section), '') IS NOT NULL
                THEN to_jsonb(BTRIM(mr.section))
                ELSE NULL
            END
        ),
        (
            'description',
            CASE
                WHEN NULLIF(BTRIM(mr.description), '') IS NOT NULL
                THEN to_jsonb(BTRIM(mr.description))
                ELSE NULL
            END
        )
) AS source_data(field_key, value)
INNER JOIN field_registry fr
    ON fr.field_key = source_data.field_key
    AND fr.organization_id IS NULL
    AND fr.is_active = TRUE
WHERE
    source_data.value IS NOT NULL
    AND mr.organization_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1
        FROM metadata_values existing
        WHERE
            existing.metadata_record_id = mr.id
            AND existing.field_registry_id = fr.id
    );

COMMIT;
