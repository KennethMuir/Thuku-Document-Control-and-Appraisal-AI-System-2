BEGIN;

CREATE TABLE IF NOT EXISTS metadata_values (
    id BIGSERIAL PRIMARY KEY,

    metadata_record_id BIGINT NOT NULL
        REFERENCES metadata_records(id)
        ON DELETE CASCADE,

    field_registry_id BIGINT NOT NULL
        REFERENCES field_registry(id)
        ON DELETE RESTRICT,

    value JSONB NOT NULL,

    source VARCHAR(50) NOT NULL DEFAULT 'USER',

    confidence NUMERIC(5,4),

    verification_status VARCHAR(30) NOT NULL DEFAULT 'UNVERIFIED',

    organization_id BIGINT NOT NULL
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT metadata_values_source_valid
        CHECK (
            source IN (
                'USER',
                'AI',
                'SYSTEM',
                'IMPORT',
                'MIGRATION'
            )
        ),

    CONSTRAINT metadata_values_confidence_valid
        CHECK (
            confidence IS NULL
            OR (
                confidence >= 0
                AND confidence <= 1
            )
        ),

    CONSTRAINT metadata_values_verification_valid
        CHECK (
            verification_status IN (
                'UNVERIFIED',
                'VERIFIED',
                'REJECTED'
            )
        )
);

CREATE INDEX IF NOT EXISTS metadata_values_metadata_record_idx
    ON metadata_values(metadata_record_id);

CREATE INDEX IF NOT EXISTS metadata_values_field_registry_idx
    ON metadata_values(field_registry_id);

CREATE INDEX IF NOT EXISTS metadata_values_organization_idx
    ON metadata_values(organization_id);

CREATE INDEX IF NOT EXISTS metadata_values_value_gin_idx
    ON metadata_values
    USING GIN(value);

CREATE INDEX IF NOT EXISTS metadata_values_record_field_idx
    ON metadata_values(metadata_record_id, field_registry_id);


CREATE OR REPLACE FUNCTION validate_metadata_value_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    metadata_org_id BIGINT;
    field_org_id BIGINT;
BEGIN
    SELECT organization_id
    INTO metadata_org_id
    FROM metadata_records
    WHERE id = NEW.metadata_record_id;

    IF metadata_org_id IS NULL THEN
        RAISE EXCEPTION
            'Metadata record % does not exist or has no organization',
            NEW.metadata_record_id;
    END IF;

    IF metadata_org_id <> NEW.organization_id THEN
        RAISE EXCEPTION
            'Metadata value organization does not match metadata record organization';
    END IF;

    SELECT organization_id
    INTO field_org_id
    FROM field_registry
    WHERE id = NEW.field_registry_id
      AND is_active = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Field registry definition % does not exist or is inactive',
            NEW.field_registry_id;
    END IF;

    IF field_org_id IS NOT NULL
       AND field_org_id <> NEW.organization_id THEN
        RAISE EXCEPTION
            'Metadata value organization cannot use a field definition belonging to another organization';
    END IF;

    RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS metadata_values_validate_organization
    ON metadata_values;

CREATE TRIGGER metadata_values_validate_organization
BEFORE INSERT OR UPDATE
ON metadata_values
FOR EACH ROW
EXECUTE FUNCTION validate_metadata_value_organization();


CREATE OR REPLACE FUNCTION validate_metadata_value_repeatability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    field_is_repeatable BOOLEAN;
    existing_value_id BIGINT;
BEGIN
    SELECT repeatable
    INTO field_is_repeatable
    FROM field_registry
    WHERE id = NEW.field_registry_id
      AND is_active = TRUE;

    IF field_is_repeatable IS NULL THEN
        RAISE EXCEPTION
            'Field registry definition % does not exist or is inactive',
            NEW.field_registry_id;
    END IF;

    IF field_is_repeatable = FALSE THEN
        SELECT id
        INTO existing_value_id
        FROM metadata_values
        WHERE metadata_record_id = NEW.metadata_record_id
          AND field_registry_id = NEW.field_registry_id
          AND id <> COALESCE(NEW.id, 0)
        LIMIT 1;

        IF existing_value_id IS NOT NULL THEN
            RAISE EXCEPTION
                'Field % is not repeatable and already has a value for metadata record %',
                NEW.field_registry_id,
                NEW.metadata_record_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS metadata_values_validate_repeatability
    ON metadata_values;

CREATE TRIGGER metadata_values_validate_repeatability
BEFORE INSERT OR UPDATE
ON metadata_values
FOR EACH ROW
EXECUTE FUNCTION validate_metadata_value_repeatability();


COMMIT;
