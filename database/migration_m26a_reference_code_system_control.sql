BEGIN;

-- M26A: Reference Code is system-controlled.
-- It is generated from the Department selected for the metadata record.
-- Users must not manually edit, create, or remove it through the
-- Universal Metadata Values editor.

UPDATE field_registry
SET user_editable = FALSE
WHERE field_key = 'reference_code'
  AND organization_id IS NULL;

DO $$
DECLARE
    reference_field_count INTEGER;
    editable_reference_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO reference_field_count
    FROM field_registry
    WHERE field_key = 'reference_code'
      AND organization_id IS NULL;

    IF reference_field_count <> 1 THEN
        RAISE EXCEPTION
            'M26A verification failed: expected exactly one system reference_code field, found %',
            reference_field_count;
    END IF;

    SELECT COUNT(*)
    INTO editable_reference_count
    FROM field_registry
    WHERE field_key = 'reference_code'
      AND organization_id IS NULL
      AND user_editable = TRUE;

    IF editable_reference_count <> 0 THEN
        RAISE EXCEPTION
            'M26A verification failed: reference_code is still user-editable.';
    END IF;

    RAISE NOTICE
        'M26A verification passed: system reference_code is not user-editable.';
END
$$;

COMMIT;
