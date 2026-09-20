-- ============================================================
-- M21 — UNIVERSAL METADATA FIELD REGISTRY
-- ============================================================
--
-- This migration creates the field_registry table, a DEFINITION layer
-- describing what metadata fields are, their capabilities, and their
-- organization scoping.
--
-- The registry does NOT store actual metadata record values.
-- It only declares field definitions.
--
-- Organization isolation:
--   - System fields (organization_id IS NULL) are global and visible
--     to all organizations.
--   - Organization-defined fields (organization_id set) are scoped to
--     their owning organization and never cross-organization boundaries.
--
-- Historical migrations are not modified.

BEGIN;

-- ------------------------------------------------------------
-- 1. CREATE field_registry TABLE
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS field_registry (
    id BIGSERIAL PRIMARY KEY,
    field_key VARCHAR(100) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    data_type VARCHAR(50) NOT NULL,
    aliases JSONB DEFAULT '[]'::jsonb NOT NULL,
    repeatable BOOLEAN NOT NULL DEFAULT FALSE,
    searchable BOOLEAN NOT NULL DEFAULT TRUE,
    filterable BOOLEAN NOT NULL DEFAULT TRUE,
    sortable BOOLEAN NOT NULL DEFAULT TRUE,
    ai_extractable BOOLEAN NOT NULL DEFAULT FALSE,
    user_editable BOOLEAN NOT NULL DEFAULT TRUE,
    sensitive BOOLEAN NOT NULL DEFAULT FALSE,
    validation_rule JSONB DEFAULT '{}'::jsonb NOT NULL,
    controlled_vocabulary JSONB DEFAULT '{}'::jsonb NOT NULL,
    unit VARCHAR(50),
    default_value JSONB DEFAULT '{}'::jsonb NOT NULL,
    organization_id BIGINT REFERENCES organizations(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT field_registry_key_organization_unique
        UNIQUE (field_key, organization_id),

    CONSTRAINT field_registry_data_type_valid
        CHECK (data_type IN (
            'text', 'integer', 'decimal', 'boolean',
            'date', 'datetime', 'year', 'email', 'url',
            'reference', 'controlled_vocabulary'
        )),

    CONSTRAINT field_registry_category_valid
        CHECK (category IN (
            'Identity', 'Dates', 'People', 'Organizations',
            'Subject / Classification', 'Legal / Regulatory',
            'Financial', 'Procurement', 'Aviation', 'Medical',
            'Research / Scientific', 'Technical', 'Preservation'
        ))
);

-- ------------------------------------------------------------
-- 2. ADD SYSTEM FIELDS (organization_id IS NULL)
-- ------------------------------------------------------------
-- These are the universal metadata fields that exist system-wide.
-- They are registered once with organization_id = NULL so they are
-- visible to all organizations but not owned by any single one.

-- reference_code
INSERT INTO field_registry (
    field_key, display_name, description, category, data_type,
    aliases, repeatable, searchable, filterable, sortable,
    ai_extractable, user_editable, sensitive, validation_rule,
    controlled_vocabulary, unit, default_value, organization_id
)
VALUES (
    'reference_code', 'Reference Code', 'Unique identifier for the document',
    'Identity', 'text',
    '["person","employee_name","individual_name"]'::jsonb,
    FALSE, TRUE, TRUE, TRUE,
    FALSE, TRUE, FALSE,
    '{"pattern": "^[A-Z]{2,10}-\\d{1,6}$"}'::jsonb,
    '{}'::jsonb, NULL, NULL
);

-- title
INSERT INTO field_registry (
    field_key, display_name, description, category, data_type,
    aliases, repeatable, searchable, filterable, sortable,
    ai_extractable, user_editable, sensitive, validation_rule,
    controlled_vocabulary, unit, default_value, organization_id
)
VALUES (
    'title', 'Title', 'Document title or name',
    'Identity', 'text',
    '["document_title"]'::jsonb,
    FALSE, TRUE, TRUE, TRUE,
    FALSE, TRUE, FALSE,
    '{}'::jsonb,
    '{}'::jsonb, NULL, NULL
);

-- document_date
INSERT INTO field_registry (
    field_key, display_name, description, category, data_type,
    aliases, repeatable, searchable, filterable, sortable,
    ai_extractable, user_editable, sensitive, validation_rule,
    controlled_vocabulary, unit, default_value, organization_id
)
VALUES (
    'document_date', 'Document Date', 'Date of the document',
    'Dates', 'date',
    '["date","issue_date","effective_date"]'::jsonb,
    FALSE, TRUE, TRUE, TRUE,
    FALSE, TRUE, FALSE,
    '{}'::jsonb,
    '{}'::jsonb, NULL, NULL
);

-- year
INSERT INTO field_registry (
    field_key, display_name, description, category, data_type,
    aliases, repeatable, searchable, filterable, sortable,
    ai_extractable, user_editable, sensitive, validation_rule,
    controlled_vocabulary, unit, default_value, organization_id
)
VALUES (
    'year', 'Year', 'Publication or creation year',
    'Dates', 'year',
    '[]'::jsonb,
    FALSE, TRUE, TRUE, TRUE,
    FALSE, TRUE, FALSE,
    '{"min": 1, "max": 9999}'::jsonb,
    '{}'::jsonb, NULL, NULL
);

-- person_name
INSERT INTO field_registry (
    field_key, display_name, description, category, data_type,
    aliases, repeatable, searchable, filterable, sortable,
    ai_extractable, user_editable, sensitive, validation_rule,
    controlled_vocabulary, unit, default_value, organization_id
)
VALUES (
    'person_name', 'Person Name', 'Name of a person associated with the document',
    'People', 'text',
    '["person","employee_name","individual_name"]'::jsonb,
    TRUE, TRUE, TRUE, TRUE,
    FALSE, TRUE, FALSE,
    '{}'::jsonb,
    '{}'::jsonb, NULL, NULL
);

-- department
INSERT INTO field_registry (
    field_key, display_name, description, category, data_type,
    aliases, repeatable, searchable, filterable, sortable,
    ai_extractable, user_editable, sensitive, validation_rule,
    controlled_vocabulary, unit, default_value, organization_id
)
VALUES (
    'department', 'Department', 'Department or unit responsible',
    'Identity', 'text',
    '[]'::jsonb,
    FALSE, TRUE, TRUE, TRUE,
    FALSE, TRUE, FALSE,
    '{}'::jsonb,
    '{}'::jsonb, NULL, NULL
);

-- document_type
INSERT INTO field_registry (
    field_key, display_name, description, category, data_type,
    aliases, repeatable, searchable, filterable, sortable,
    ai_extractable, user_editable, sensitive, validation_rule,
    controlled_vocabulary, unit, default_value, organization_id
)
VALUES (
    'document_type', 'Document Type', 'Category or classification of document',
    'Identity', 'text',
    '[]'::jsonb,
    FALSE, TRUE, TRUE, TRUE,
    FALSE, TRUE, FALSE,
    '{}'::jsonb,
    '{}'::jsonb, NULL, NULL
);

-- section
INSERT INTO field_registry (
    field_key, display_name, description, category, data_type,
    aliases, repeatable, searchable, filterable, sortable,
    ai_extractable, user_editable, sensitive, validation_rule,
    controlled_vocabulary, unit, default_value, organization_id
)
VALUES (
    'section', 'Section', 'Document section or subsection',
    'Identity', 'text',
    '[]'::jsonb,
    FALSE, TRUE, TRUE, TRUE,
    FALSE, TRUE, FALSE,
    '{}'::jsonb,
    '{}'::jsonb, NULL, NULL
);

-- description
INSERT INTO field_registry (
    field_key, display_name, description, category, data_type,
    aliases, repeatable, searchable, filterable, sortable,
    ai_extractable, user_editable, sensitive, validation_rule,
    controlled_vocabulary, unit, default_value, organization_id
)
VALUES (
    'description', 'Description', 'Free-text description of the document',
    'Identity', 'text',
    '[]'::jsonb,
    FALSE, TRUE, TRUE, TRUE,
    FALSE, TRUE, FALSE,
    '{}'::jsonb,
    '{}'::jsonb, NULL, NULL
);

-- ------------------------------------------------------------
-- 3. ADD ORGANIZATION-INDEX FOR LOOKUPS
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS field_registry_organization_idx
    ON field_registry (organization_id);

CREATE INDEX IF NOT EXISTS field_registry_active_idx
    ON field_registry (is_active);

CREATE INDEX IF NOT EXISTS field_registry_category_idx
    ON field_registry (category);

-- ------------------------------------------------------------
-- 4. VERIFICATION
-- ------------------------------------------------------------

DO $$
DECLARE
    system_field_count INTEGER;
    org_field_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO system_field_count
    FROM field_registry
    WHERE organization_id IS NULL;

    SELECT COUNT(*)
    INTO org_field_count
    FROM field_registry
    WHERE organization_id IS NOT NULL;

    IF system_field_count = 0 THEN
        RAISE EXCEPTION
            'M21 verification failed: no system fields registered.';
    END IF;

    IF system_field_count <> 9 THEN
        RAISE NOTICE
            'M21 notice: expected 9 system fields, found %', system_field_count;
    END IF;

    RAISE NOTICE
        'M21 verification passed: system_fields=% org_fields=% total_fields=%',
        system_field_count, org_field_count, system_field_count + org_field_count;
END
$$;

COMMIT;