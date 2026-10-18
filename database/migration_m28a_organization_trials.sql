-- M28A: Organization trial persistence
-- Additive migration; review before execution.
-- Existing organizations receive no trial records or new access limits.

BEGIN;

CREATE TABLE IF NOT EXISTS organization_trials (
    id BIGSERIAL PRIMARY KEY,

    organization_id BIGINT NOT NULL
        REFERENCES organizations(id),

    trial_starts_at TIMESTAMPTZ NOT NULL,
    trial_ends_at TIMESTAMPTZ NOT NULL,

    document_limit INTEGER NOT NULL DEFAULT 10,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT organization_trials_one_per_organization
        UNIQUE (organization_id),

    CONSTRAINT organization_trials_valid_period
        CHECK (trial_ends_at > trial_starts_at),

    CONSTRAINT organization_trials_valid_document_limit
        CHECK (document_limit = 10)
);

CREATE INDEX IF NOT EXISTS organization_trials_ends_at_idx
    ON organization_trials (trial_ends_at);

COMMIT;
