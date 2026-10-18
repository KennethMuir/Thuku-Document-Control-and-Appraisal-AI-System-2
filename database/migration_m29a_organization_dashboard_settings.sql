BEGIN;

CREATE TABLE IF NOT EXISTS organization_dashboard_settings (
    organization_id BIGINT PRIMARY KEY
        REFERENCES organizations(id) ON DELETE CASCADE,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by BIGINT
        REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT organization_dashboard_settings_object
        CHECK (jsonb_typeof(settings) = 'object')
);

COMMIT;