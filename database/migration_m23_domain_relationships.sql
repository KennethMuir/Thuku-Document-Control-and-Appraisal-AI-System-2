-- M23: Domain Relationships
-- Creates the many-to-many relationship between metadata records and domains.
-- Supports global domains and organization-specific domains.
-- Organization isolation is enforced by a trigger.

BEGIN;

CREATE TABLE IF NOT EXISTS metadata_domain_relationships (
    id BIGSERIAL PRIMARY KEY,

    metadata_record_id BIGINT NOT NULL
        REFERENCES metadata_records(id)
        ON DELETE CASCADE,

    domain_id BIGINT NOT NULL
        REFERENCES domain_registry(id)
        ON DELETE CASCADE,

    organization_id BIGINT NOT NULL
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    relationship_type VARCHAR(50) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT metadata_domain_relationships_type_check
        CHECK (
            relationship_type IN (
                'SUBJECT',
                'LEGAL_CONTEXT',
                'BUSINESS_FUNCTION',
                'TECHNICAL_CONTEXT',
                'PURPOSE',
                'REGULATORY_CONTEXT',
                'OPERATIONAL_CONTEXT',
                'FINANCIAL_CONTEXT',
                'HISTORICAL_CONTEXT',
                'OWNERSHIP_CONTEXT',
                'PROCESS_CONTEXT',
                'REPORTING_CONTEXT',
                'RECORDS_CONTEXT'
            )
        ),

    CONSTRAINT metadata_domain_relationships_unique
        UNIQUE (
            metadata_record_id,
            domain_id,
            relationship_type
        )
);

CREATE INDEX IF NOT EXISTS metadata_domain_relationships_metadata_idx
    ON metadata_domain_relationships(metadata_record_id);

CREATE INDEX IF NOT EXISTS metadata_domain_relationships_domain_idx
    ON metadata_domain_relationships(domain_id);

CREATE INDEX IF NOT EXISTS metadata_domain_relationships_organization_idx
    ON metadata_domain_relationships(organization_id);

CREATE INDEX IF NOT EXISTS metadata_domain_relationships_type_idx
    ON metadata_domain_relationships(relationship_type);

CREATE INDEX IF NOT EXISTS metadata_domain_relationships_org_domain_idx
    ON metadata_domain_relationships(organization_id, domain_id);

CREATE OR REPLACE FUNCTION validate_metadata_domain_relationship_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    metadata_organization_id BIGINT;
    domain_organization_id BIGINT;
BEGIN
    SELECT mr.organization_id
    INTO metadata_organization_id
    FROM metadata_records mr
    WHERE mr.id = NEW.metadata_record_id;

    IF metadata_organization_id IS NULL THEN
        RAISE EXCEPTION
            'Metadata record % does not exist or has no organization',
            NEW.metadata_record_id;
    END IF;

    IF metadata_organization_id <> NEW.organization_id THEN
        RAISE EXCEPTION
            'Metadata record % does not belong to organization %',
            NEW.metadata_record_id,
            NEW.organization_id;
    END IF;

    SELECT dr.organization_id
    INTO domain_organization_id
    FROM domain_registry dr
    WHERE dr.id = NEW.domain_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Domain % does not exist',
            NEW.domain_id;
    END IF;

    /*
     * Global/system domains have organization_id NULL and are available
     * to all organizations.
     *
     * Organization-specific domains must belong to the same organization
     * as the metadata relationship.
     */
    IF domain_organization_id IS NOT NULL
       AND domain_organization_id <> NEW.organization_id THEN
        RAISE EXCEPTION
            'Domain % does not belong to organization %',
            NEW.domain_id,
            NEW.organization_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS metadata_domain_relationship_scope_trigger
    ON metadata_domain_relationships;

CREATE TRIGGER metadata_domain_relationship_scope_trigger
    BEFORE INSERT OR UPDATE
    ON metadata_domain_relationships
    FOR EACH ROW
    EXECUTE FUNCTION validate_metadata_domain_relationship_scope();

COMMIT;
