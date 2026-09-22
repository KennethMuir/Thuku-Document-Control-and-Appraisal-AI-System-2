CREATE TABLE IF NOT EXISTS metadata_field_profiles (
    id BIGSERIAL PRIMARY KEY,

    organization_id BIGINT NOT NULL
        REFERENCES organizations(id) ON DELETE CASCADE,

    field_registry_id BIGINT NOT NULL
        REFERENCES field_registry(id) ON DELETE CASCADE,

    enabled BOOLEAN NOT NULL DEFAULT TRUE,

    required BOOLEAN NOT NULL DEFAULT FALSE,

    display_order INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT metadata_field_profiles_organization_field_unique
        UNIQUE (organization_id, field_registry_id),

    CONSTRAINT metadata_field_profiles_display_order_check
        CHECK (display_order >= 0)
);

CREATE INDEX IF NOT EXISTS metadata_field_profiles_organization_idx
    ON metadata_field_profiles (organization_id);

CREATE INDEX IF NOT EXISTS metadata_field_profiles_field_registry_idx
    ON metadata_field_profiles (field_registry_id);

CREATE INDEX IF NOT EXISTS metadata_field_profiles_enabled_idx
    ON metadata_field_profiles (organization_id, enabled);

CREATE INDEX IF NOT EXISTS metadata_field_profiles_order_idx
    ON metadata_field_profiles (
        organization_id,
        display_order,
        field_registry_id
    );
