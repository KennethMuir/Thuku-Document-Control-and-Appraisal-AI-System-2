BEGIN;

-- ============================================================
-- M17A — ORGANIZATION & MEMBERSHIP FOUNDATION
-- ============================================================

-- ------------------------------------------------------------
-- 1. Organizations
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS organizations (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(150) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT organizations_slug_unique
        UNIQUE (slug),

    CONSTRAINT organizations_status_valid
        CHECK (status IN ('ACTIVE', 'SUSPENDED', 'ARCHIVED'))
);

CREATE INDEX IF NOT EXISTS organizations_status_idx
    ON organizations (status);


-- ------------------------------------------------------------
-- 2. Organization memberships
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS organization_memberships (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL
        REFERENCES organizations(id)
        ON DELETE CASCADE,
    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,
    role VARCHAR(30) NOT NULL DEFAULT 'VIEWER',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT organization_memberships_unique
        UNIQUE (organization_id, user_id),

    CONSTRAINT organization_memberships_role_valid
        CHECK (
            role IN (
                'OWNER',
                'ADMIN',
                'APPRAISER',
                'VIEWER'
            )
        )
);

CREATE INDEX IF NOT EXISTS organization_memberships_user_idx
    ON organization_memberships (user_id);

CREATE INDEX IF NOT EXISTS organization_memberships_organization_idx
    ON organization_memberships (organization_id);

CREATE INDEX IF NOT EXISTS organization_memberships_active_idx
    ON organization_memberships (organization_id, is_active);


-- ------------------------------------------------------------
-- 3. Workspaces
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS workspaces (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL
        REFERENCES organizations(id)
        ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(150) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT workspaces_organization_slug_unique
        UNIQUE (organization_id, slug),

    CONSTRAINT workspaces_status_valid
        CHECK (status IN ('ACTIVE', 'ARCHIVED'))
);

CREATE INDEX IF NOT EXISTS workspaces_organization_idx
    ON workspaces (organization_id);

CREATE INDEX IF NOT EXISTS workspaces_status_idx
    ON workspaces (organization_id, status);


-- ------------------------------------------------------------
-- 4. Add organization ownership to existing tenant-owned data
-- ------------------------------------------------------------

ALTER TABLE departments
    ADD COLUMN IF NOT EXISTS organization_id BIGINT;

ALTER TABLE document_types
    ADD COLUMN IF NOT EXISTS organization_id BIGINT;

ALTER TABLE metadata_records
    ADD COLUMN IF NOT EXISTS organization_id BIGINT;

ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS organization_id BIGINT;


-- ------------------------------------------------------------
-- 5. Bootstrap the initial organization
-- ------------------------------------------------------------

INSERT INTO organizations (
    name,
    slug,
    status
)
VALUES (
    'Thuku Document Control',
    'thuku-document-control',
    'ACTIVE'
)
ON CONFLICT (slug) DO NOTHING;


-- ------------------------------------------------------------
-- 6. Retrieve the bootstrap organization
-- ------------------------------------------------------------

DO $$
DECLARE
    bootstrap_organization_id BIGINT;
BEGIN
    SELECT id
    INTO bootstrap_organization_id
    FROM organizations
    WHERE slug = 'thuku-document-control';

    IF bootstrap_organization_id IS NULL THEN
        RAISE EXCEPTION
            'M17A bootstrap organization was not created or found.';
    END IF;

    -- --------------------------------------------------------
    -- 7. Backfill existing tenant-owned records
    -- --------------------------------------------------------

    UPDATE departments
    SET organization_id = bootstrap_organization_id
    WHERE organization_id IS NULL;

    UPDATE document_types
    SET organization_id = bootstrap_organization_id
    WHERE organization_id IS NULL;

    UPDATE metadata_records
    SET organization_id = bootstrap_organization_id
    WHERE organization_id IS NULL;

    UPDATE documents
    SET organization_id = bootstrap_organization_id
    WHERE organization_id IS NULL;


    -- --------------------------------------------------------
    -- 8. Add existing users to the organization
    -- --------------------------------------------------------

    INSERT INTO organization_memberships (
        organization_id,
        user_id,
        role,
        is_active
    )
    SELECT
        bootstrap_organization_id,
        u.id,
        CASE
            WHEN u.role = 'ADMIN' THEN 'OWNER'
            WHEN u.role = 'APPRAISER' THEN 'APPRAISER'
            WHEN u.role = 'VIEWER' THEN 'VIEWER'
            ELSE 'VIEWER'
        END,
        u.is_active
    FROM users u
    WHERE NOT EXISTS (
        SELECT 1
        FROM organization_memberships om
        WHERE om.organization_id = bootstrap_organization_id
          AND om.user_id = u.id
    );


    -- --------------------------------------------------------
    -- 9. Create the initial workspace
    -- --------------------------------------------------------

    INSERT INTO workspaces (
        organization_id,
        name,
        slug,
        status
    )
    VALUES (
        bootstrap_organization_id,
        'Default Workspace',
        'default',
        'ACTIVE'
    )
    ON CONFLICT (organization_id, slug) DO NOTHING;
END
$$;


-- ------------------------------------------------------------
-- 10. Add foreign keys after backfill
-- ------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'departments_organization_id_fkey'
    ) THEN
        ALTER TABLE departments
            ADD CONSTRAINT departments_organization_id_fkey
            FOREIGN KEY (organization_id)
            REFERENCES organizations(id)
            ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'document_types_organization_id_fkey'
    ) THEN
        ALTER TABLE document_types
            ADD CONSTRAINT document_types_organization_id_fkey
            FOREIGN KEY (organization_id)
            REFERENCES organizations(id)
            ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'metadata_records_organization_id_fkey'
    ) THEN
        ALTER TABLE metadata_records
            ADD CONSTRAINT metadata_records_organization_id_fkey
            FOREIGN KEY (organization_id)
            REFERENCES organizations(id)
            ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'documents_organization_id_fkey'
    ) THEN
        ALTER TABLE documents
            ADD CONSTRAINT documents_organization_id_fkey
            FOREIGN KEY (organization_id)
            REFERENCES organizations(id)
            ON DELETE CASCADE;
    END IF;
END
$$;


-- ------------------------------------------------------------
-- 11. Supporting indexes
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS departments_organization_idx
    ON departments (organization_id);

CREATE INDEX IF NOT EXISTS document_types_organization_idx
    ON document_types (organization_id);

CREATE INDEX IF NOT EXISTS metadata_records_organization_idx
    ON metadata_records (organization_id);

CREATE INDEX IF NOT EXISTS documents_organization_idx
    ON documents (organization_id);


-- ------------------------------------------------------------
-- 12. Verification assertions
-- ------------------------------------------------------------

DO $$
DECLARE
    organization_count BIGINT;
    membership_count BIGINT;
    workspace_count BIGINT;
    document_count BIGINT;
    unassigned_document_count BIGINT;
    metadata_count BIGINT;
    unassigned_metadata_count BIGINT;
BEGIN
    SELECT COUNT(*)
    INTO organization_count
    FROM organizations;

    SELECT COUNT(*)
    INTO membership_count
    FROM organization_memberships;

    SELECT COUNT(*)
    INTO workspace_count
    FROM workspaces;

    SELECT COUNT(*)
    INTO document_count
    FROM documents;

    SELECT COUNT(*)
    INTO unassigned_document_count
    FROM documents
    WHERE organization_id IS NULL;

    SELECT COUNT(*)
    INTO metadata_count
    FROM metadata_records;

    SELECT COUNT(*)
    INTO unassigned_metadata_count
    FROM metadata_records
    WHERE organization_id IS NULL;

    IF organization_count < 1 THEN
        RAISE EXCEPTION
            'M17A verification failed: no organizations exist.';
    END IF;

    IF membership_count < 1 THEN
        RAISE EXCEPTION
            'M17A verification failed: no organization memberships exist.';
    END IF;

    IF workspace_count < 1 THEN
        RAISE EXCEPTION
            'M17A verification failed: no workspace exists.';
    END IF;

    IF unassigned_document_count <> 0 THEN
        RAISE EXCEPTION
            'M17A verification failed: % documents have no organization.',
            unassigned_document_count;
    END IF;

    IF unassigned_metadata_count <> 0 THEN
        RAISE EXCEPTION
            'M17A verification failed: % metadata records have no organization.',
            unassigned_metadata_count;
    END IF;

    RAISE NOTICE
        'M17A verification passed: organizations=%, memberships=%, workspaces=%, documents=%, metadata_records=%',
        organization_count,
        membership_count,
        workspace_count,
        document_count,
        metadata_count;
END
$$;

COMMIT;
