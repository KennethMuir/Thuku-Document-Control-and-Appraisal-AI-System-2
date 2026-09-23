SELECT
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name IN ('metadata_records', 'field_registry')
ORDER BY table_name, ordinal_position;

SELECT
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_name IN ('metadata_records', 'field_registry')
ORDER BY tc.table_name, tc.constraint_name;
