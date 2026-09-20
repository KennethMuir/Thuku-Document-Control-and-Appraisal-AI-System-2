-- ============================================================
-- M20 — FOUNDATION HARDENING
-- Organization-scoped uniqueness + audit trail ownership
-- ============================================================
--
-- This migration:
--   * Adds organization_id and actor_user_id to the audit trail.
--   * Backfills historical audit rows with the owning organization
--     where it can be derived from the associated document.
--   * Verifies existing data before changing constraints.
--   * Enforces organization ownership (NOT NULL) on tenant tables.
--   * Replaces global uniqueness with organization-scoped uniqueness:
--       departments.name/code            -> organization-scoped
--       document_types.name              -> organization-scoped
--       metadata_records.reference_code  -> organization-scoped
--   * Keeps documents.document_code and documents.upload_number
--     globally unique (established DOC-N semantics, unchanged).
--
-- Historical migrations are not modified.

BEGIN;

-- ------------------------------------------------------------
-- 1. AUDIT FOUNDATION
-- ------------------------------------------------------------

ALTER TABLE document_audit_logs
    ADD COLUMN IF NOT EXISTS organization_id BIGINT
        REFERENCES organizations(id) ON DELETE SET NULL;

ALTER TABLE document_audit_logs
    ADD COLUMN IF NOT EXISTS actor_user_id BIGINT
        REFERENCES users(id) ON DELETE SET NULL;

-- Backfill organization for historical audit events where the
-- owning document is still known and belongs to an organization.
-- Actor cannot be reconstructed from current history and remains NULL.
UPDATE document_audit_logs dal
SET organization_id = doc.organization_id
FROM documents doc
WHERE dal.organization_id IS NULL
  AND dal.document_id = doc.id
  AND doc.organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS document_audit_logs_organization_idx
    ON document_audit_logs (organization_id);

CREATE INDEX IF NOT EXISTS document_audit_logs_actor_user_idx
    ON document_audit_logs (actor_user_id);

-- ------------------------------------------------------------
-- 2. PRE-CONDITION VERIFICATION
-- ------------------------------------------------------------

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM (
            SELECT organization_id, LOWER(name) AS name
            FROM departments
            GROUP BY organization_id, LOWER(name)
            HAVING COUNT(*) > 1
        ) duplicates
    ) THEN
        RAISE EXCEPTION
            'M20 stopped: duplicate department names within an organization.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM (
            SELECT organization_id, LOWER(code) AS code
            FROM departments
            GROUP BY organization_id, LOWER(code)
            HAVING COUNT(*) > 1
        ) duplicates
    ) THEN
        RAISE EXCEPTION
            'M20 stopped: duplicate department codes within an organization.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM (
            SELECT organization_id, LOWER(name) AS name
            FROM document_types
            GROUP BY organization_id, LOWER(name)
            HAVING COUNT(*) > 1
        ) duplicates
    ) THEN
        RAISE EXCEPTION
            'M20 stopped: duplicate document type names within an organization.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM (
            SELECT organization_id, LOWER(reference_code) AS reference_code
            FROM metadata_records
            GROUP BY organization_id, LOWER(reference_code)
            HAVING COUNT(*) > 1
        ) duplicates
    ) THEN
        RAISE EXCEPTION
            'M20 stopped: duplicate metadata reference codes within an organization.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM departments
        WHERE organization_id IS NULL
    ) THEN
        RAISE EXCEPTION
            'M20 stopped: departments exist without organization ownership.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM document_types
        WHERE organization_id IS NULL
    ) THEN
        RAISE EXCEPTION
            'M20 stopped: document types exist without organization ownership.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM metadata_records
        WHERE organization_id IS NULL
    ) THEN
        RAISE EXCEPTION
            'M20 stopped: metadata records exist without organization ownership.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM documents
        WHERE organization_id IS NULL
    ) THEN
        RAISE EXCEPTION
            'M20 stopped: documents exist without organization ownership.';
    END IF;
END
$$;

-- ------------------------------------------------------------
-- 3. ENFORCE ORGANIZATION OWNERSHIP
-- ------------------------------------------------------------

ALTER TABLE departments
    ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE document_types
    ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE metadata_records
    ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE documents
    ALTER COLUMN organization_id SET NOT NULL;

-- ------------------------------------------------------------
-- 4. ORGANIZATION-SCOPED UNIQUENESS
-- ------------------------------------------------------------

ALTER TABLE departments
    DROP CONSTRAINT IF EXISTS departments_name_key;

ALTER TABLE departments
    DROP CONSTRAINT IF EXISTS departments_code_key;

ALTER TABLE document_types
    DROP CONSTRAINT IF EXISTS document_types_name_key;

ALTER TABLE metadata_records
    DROP CONSTRAINT IF EXISTS metadata_records_reference_code_key;

CREATE UNIQUE INDEX IF NOT EXISTS departments_organization_name_key
    ON departments (organization_id, LOWER(name));

CREATE UNIQUE INDEX IF NOT EXISTS departments_organization_code_key
    ON departments (organization_id, LOWER(code));

CREATE UNIQUE INDEX IF NOT EXISTS document_types_organization_name_key
    ON document_types (organization_id, LOWER(name));

CREATE UNIQUE INDEX IF NOT EXISTS metadata_records_organization_reference_key
    ON metadata_records (organization_id, LOWER(reference_code));

COMMIT;