-- M17J-2S-44: Tenant ownership constraints.
-- REVIEW ONLY: Do not apply to the live database without explicit approval.
-- Target: PostgreSQL 15+; designed for the inspected PostgreSQL 18 schema.
-- This migration does not delete documents or physical files.

BEGIN;

-- Fail closed if any existing ownership relationships cross tenants.
DO $migration$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM documents d
        JOIN metadata_records mr ON mr.id = d.metadata_record_id
        WHERE d.organization_id <> mr.organization_id
    ) THEN
        RAISE EXCEPTION 'M17J-2S-44 aborted: cross-tenant document/metadata link';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM documents d
        JOIN departments dep ON dep.id = d.department_id
        WHERE d.organization_id <> dep.organization_id
    ) THEN
        RAISE EXCEPTION 'M17J-2S-44 aborted: cross-tenant document/department link';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM documents d
        JOIN document_types dt ON dt.id = d.document_type_id
        WHERE d.organization_id <> dt.organization_id
    ) THEN
        RAISE EXCEPTION 'M17J-2S-44 aborted: cross-tenant document/type link';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM metadata_records mr
        JOIN departments dep ON dep.id = mr.department_id
        WHERE mr.organization_id <> dep.organization_id
    ) THEN
        RAISE EXCEPTION 'M17J-2S-44 aborted: cross-tenant metadata/department link';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM metadata_records mr
        JOIN document_types dt ON dt.id = mr.document_type_id
        WHERE mr.organization_id <> dt.organization_id
    ) THEN
        RAISE EXCEPTION 'M17J-2S-44 aborted: cross-tenant metadata/type link';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM document_matches dm
        JOIN documents d ON d.id = dm.document_id
        JOIN metadata_records mr ON mr.id = dm.metadata_record_id
        WHERE d.organization_id <> mr.organization_id
    ) THEN
        RAISE EXCEPTION 'M17J-2S-44 aborted: cross-tenant match/metadata link';
    END IF;
END
$migration$;

-- Composite referenced keys. The existing primary keys remain unchanged.
ALTER TABLE departments
    ADD CONSTRAINT departments_id_organization_unique
    UNIQUE (id, organization_id);

ALTER TABLE document_types
    ADD CONSTRAINT document_types_id_organization_unique
    UNIQUE (id, organization_id);

ALTER TABLE metadata_records
    ADD CONSTRAINT metadata_records_id_organization_unique
    UNIQUE (id, organization_id);

ALTER TABLE documents
    ADD CONSTRAINT documents_id_organization_unique
    UNIQUE (id, organization_id);

-- Documents: replace single-column relationship FKs with tenant-aware FKs.
-- SET NULL affects only the relationship column, never organization_id.
ALTER TABLE documents
    DROP CONSTRAINT documents_metadata_record_id_fkey,
    DROP CONSTRAINT documents_department_id_fkey,
    DROP CONSTRAINT documents_document_type_id_fkey;

ALTER TABLE documents
    ADD CONSTRAINT documents_metadata_tenant_fkey
    FOREIGN KEY (metadata_record_id, organization_id)
    REFERENCES metadata_records (id, organization_id)
    ON DELETE SET NULL (metadata_record_id);

ALTER TABLE documents
    ADD CONSTRAINT documents_department_tenant_fkey
    FOREIGN KEY (department_id, organization_id)
    REFERENCES departments (id, organization_id)
    ON DELETE SET NULL (department_id);

ALTER TABLE documents
    ADD CONSTRAINT documents_type_tenant_fkey
    FOREIGN KEY (document_type_id, organization_id)
    REFERENCES document_types (id, organization_id)
    ON DELETE SET NULL (document_type_id);

-- Metadata records: enforce the same ownership rules.
ALTER TABLE metadata_records
    DROP CONSTRAINT metadata_records_department_id_fkey,
    DROP CONSTRAINT metadata_records_document_type_id_fkey;

ALTER TABLE metadata_records
    ADD CONSTRAINT metadata_records_department_tenant_fkey
    FOREIGN KEY (department_id, organization_id)
    REFERENCES departments (id, organization_id)
    ON DELETE SET NULL (department_id);

ALTER TABLE metadata_records
    ADD CONSTRAINT metadata_records_type_tenant_fkey
    FOREIGN KEY (document_type_id, organization_id)
    REFERENCES document_types (id, organization_id)
    ON DELETE SET NULL (document_type_id);

-- Match rows need an explicit tenant key so their two relationships can
-- be enforced together by composite foreign keys.
ALTER TABLE document_matches
    ADD COLUMN organization_id bigint;

UPDATE document_matches dm
SET organization_id = d.organization_id
FROM documents d
WHERE d.id = dm.document_id;

-- A BEFORE trigger derives the tenant from the parent document.
-- Existing INSERT statements can continue omitting organization_id.
CREATE FUNCTION derive_document_match_organization()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    parent_organization_id bigint;
BEGIN
    SELECT d.organization_id
    INTO parent_organization_id
    FROM documents d
    WHERE d.id = NEW.document_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Document match references a missing document';
    END IF;

    NEW.organization_id := parent_organization_id;
    RETURN NEW;
END;
$function$;

CREATE TRIGGER document_matches_derive_organization
BEFORE INSERT OR UPDATE ON document_matches
FOR EACH ROW
EXECUTE FUNCTION derive_document_match_organization();

ALTER TABLE document_matches
    ALTER COLUMN organization_id SET NOT NULL;

-- Replace the old document_id FK with a tenant-aware equivalent.
ALTER TABLE document_matches
    DROP CONSTRAINT document_matches_document_id_fkey,
    DROP CONSTRAINT document_matches_metadata_record_id_fkey;

ALTER TABLE document_matches
    ADD CONSTRAINT document_matches_document_tenant_fkey
    FOREIGN KEY (document_id, organization_id)
    REFERENCES documents (id, organization_id)
    ON DELETE CASCADE;

ALTER TABLE document_matches
    ADD CONSTRAINT document_matches_metadata_tenant_fkey
    FOREIGN KEY (metadata_record_id, organization_id)
    REFERENCES metadata_records (id, organization_id)
    ON DELETE SET NULL (metadata_record_id);

-- Final assertions before commit.
DO $verify$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM document_matches dm
        JOIN documents d ON d.id = dm.document_id
        WHERE dm.organization_id <> d.organization_id
    ) THEN
        RAISE EXCEPTION 'M17J-2S-44 verification failed: match/document tenant mismatch';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM document_matches dm
        JOIN metadata_records mr ON mr.id = dm.metadata_record_id
        WHERE dm.organization_id <> mr.organization_id
    ) THEN
        RAISE EXCEPTION 'M17J-2S-44 verification failed: match/metadata tenant mismatch';
    END IF;
END
$verify$;

COMMIT;
