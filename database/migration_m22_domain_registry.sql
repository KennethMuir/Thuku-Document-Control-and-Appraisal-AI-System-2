-- ============================================================
-- M22 — UNIVERSAL DOMAIN REGISTRY
-- ============================================================
--
-- This migration creates the domain_registry table, a DEFINITION
-- layer describing the domains supported by the system.
--
-- The registry does NOT assign domains to documents.
-- Document/domain relationships are introduced in M23.
--
-- Organization isolation:
--   - System domains (organization_id IS NULL) are global.
--   - Organization-defined domains are scoped to their owning
--     organization and never cross organization boundaries.
--
-- Historical migrations are not modified.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. CREATE domain_registry TABLE
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS domain_registry (
    id BIGSERIAL PRIMARY KEY,

    domain_key VARCHAR(100) NOT NULL,

    display_name VARCHAR(255) NOT NULL,

    description TEXT,

    domain_family VARCHAR(100) NOT NULL,

    aliases JSONB DEFAULT '[]'::jsonb NOT NULL,

    organization_id BIGINT
        REFERENCES organizations(id)
        ON DELETE SET NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 2. DOMAIN KEY UNIQUENESS
-- ------------------------------------------------------------
--
-- System/global domains are unique globally.
-- Organization domains are unique only within their organization.
--
-- This intentionally avoids relying on a nullable composite UNIQUE
-- constraint because PostgreSQL permits multiple NULL values.

CREATE UNIQUE INDEX IF NOT EXISTS
    domain_registry_system_domain_key_unique
    ON domain_registry (LOWER(domain_key))
    WHERE organization_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS
    domain_registry_organization_domain_key_unique
    ON domain_registry (
        organization_id,
        LOWER(domain_key)
    )
    WHERE organization_id IS NOT NULL;

-- ------------------------------------------------------------
-- 3. LOOKUP INDEXES
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS
    domain_registry_organization_idx
    ON domain_registry (organization_id);

CREATE INDEX IF NOT EXISTS
    domain_registry_active_idx
    ON domain_registry (is_active);

CREATE INDEX IF NOT EXISTS
    domain_registry_family_idx
    ON domain_registry (domain_family);

-- ------------------------------------------------------------
-- 4. SYSTEM DOMAIN DEFINITIONS
-- ------------------------------------------------------------
--
-- These are global definitions shared by all organizations.
-- They establish the initial universal domain vocabulary.
--
-- Organization-specific custom domains will be created later
-- through the M22 API.

INSERT INTO domain_registry (
    domain_key,
    display_name,
    description,
    domain_family,
    aliases,
    organization_id
)
VALUES
(
    'general_administration',
    'General Administration',
    'General administrative records, correspondence, notices, and organizational administration.',
    'General / Administrative',
    '["administration","general administration","admin"]'::jsonb,
    NULL
),
(
    'records_management',
    'Records Management',
    'Records management, archival control, appraisal, classification, retention, preservation, and disposition.',
    'Records Management',
    '["records","recordkeeping","archives","archival"]'::jsonb,
    NULL
),
(
    'governance',
    'Governance',
    'Corporate or institutional governance, oversight, decision-making, and governing structures.',
    'Governance',
    '["corporate governance","oversight"]'::jsonb,
    NULL
),
(
    'compliance',
    'Compliance',
    'Compliance obligations, controls, evidence, monitoring, and regulatory adherence.',
    'Compliance',
    '["regulatory compliance","compliance management"]'::jsonb,
    NULL
),
(
    'risk',
    'Risk',
    'Risk identification, assessment, treatment, monitoring, and reporting.',
    'Risk',
    '["risk management","risk assessment"]'::jsonb,
    NULL
),
(
    'audit',
    'Audit',
    'Internal or external audit activities, findings, evidence, recommendations, and follow-up.',
    'Audit',
    '["auditing","audit records"]'::jsonb,
    NULL
),
(
    'security',
    'Security',
    'Security controls, incidents, policies, assessments, and security-related records.',
    'Security',
    '["information security","security management"]'::jsonb,
    NULL
),
(
    'information_technology',
    'Information Technology',
    'Information technology systems, services, infrastructure, software, and technical operations.',
    'IT',
    '["IT","information technology","technology"]'::jsonb,
    NULL
),
(
    'finance',
    'Finance',
    'Financial management, budgeting, financial reporting, payments, and financial control.',
    'Finance',
    '["financial management","financial records"]'::jsonb,
    NULL
),
(
    'accounting',
    'Accounting',
    'Accounting records, transactions, ledgers, reconciliations, and financial accounting processes.',
    'Finance',
    '["accounts","bookkeeping"]'::jsonb,
    NULL
),
(
    'procurement',
    'Procurement',
    'Procurement planning, sourcing, purchasing, tendering, supplier management, and procurement records.',
    'Procurement',
    '["purchasing","sourcing","tendering"]'::jsonb,
    NULL
),
(
    'contracts',
    'Contracts',
    'Contracts, agreements, amendments, obligations, renewals, and contractual administration.',
    'Contracts',
    '["agreements","contract management"]'::jsonb,
    NULL
),
(
    'human_resources',
    'Human Resources',
    'Employee administration, recruitment, personnel records, workforce management, and HR processes.',
    'HR',
    '["HR","human resources","personnel"]'::jsonb,
    NULL
),
(
    'training',
    'Training',
    'Training programs, learning records, competency development, and training administration.',
    'Training',
    '["learning","staff training","competency"]'::jsonb,
    NULL
),
(
    'legal',
    'Legal',
    'Legal matters, legal advice, proceedings, opinions, claims, and legal documentation.',
    'Legal',
    '["law","legal affairs","legal matters"]'::jsonb,
    NULL
),
(
    'regulatory',
    'Regulatory',
    'Regulatory requirements, regulatory submissions, regulatory correspondence, and regulatory oversight.',
    'Regulatory',
    '["regulation","regulatory affairs"]'::jsonb,
    NULL
),
(
    'policy',
    'Policy',
    'Organizational policies, policy development, approval, review, and implementation.',
    'Policy',
    '["policies","policy management"]'::jsonb,
    NULL
),
(
    'quality_assurance',
    'Quality Assurance',
    'Quality systems, quality controls, inspections, corrective actions, and quality records.',
    'QA/QC',
    '["QA","quality control","quality management"]'::jsonb,
    NULL
),
(
    'engineering',
    'Engineering',
    'Engineering activities, designs, specifications, calculations, technical documentation, and engineering control.',
    'Engineering',
    '["technical engineering","engineering records"]'::jsonb,
    NULL
),
(
    'maintenance',
    'Maintenance',
    'Maintenance planning, inspections, work orders, maintenance records, and asset maintenance.',
    'Maintenance',
    '["maintenance management","maintenance records"]'::jsonb,
    NULL
),
(
    'aviation',
    'Aviation',
    'Aviation operations, safety, airworthiness, flight operations, aviation compliance, and aviation records.',
    'Aviation',
    '["air transport","aviation operations","aeronautical"]'::jsonb,
    NULL
),
(
    'healthcare',
    'Healthcare',
    'Healthcare administration, clinical operations, healthcare services, and related records.',
    'Healthcare',
    '["health","medical administration"]'::jsonb,
    NULL
),
(
    'research_scientific',
    'Research / Scientific',
    'Research activities, scientific work, experiments, studies, findings, and research documentation.',
    'Research / Scientific',
    '["research","scientific","research records"]'::jsonb,
    NULL
),
(
    'education',
    'Education',
    'Educational administration, teaching, learning, academic programs, and education records.',
    'Education',
    '["academic","learning","education administration"]'::jsonb,
    NULL
),
(
    'environmental',
    'Environmental',
    'Environmental management, environmental monitoring, assessments, compliance, and environmental records.',
    'Environmental',
    '["environment","environmental management"]'::jsonb,
    NULL
),
(
    'project_management',
    'Project Management',
    'Project planning, execution, monitoring, reporting, governance, and project documentation.',
    'Project Management',
    '["projects","project administration","PM"]'::jsonb,
    NULL
),
(
    'business_operations',
    'Business Operations',
    'Operational activities, processes, procedures, performance, and business operations management.',
    'Business Operations',
    '["operations","business operations"]'::jsonb,
    NULL
);

-- ------------------------------------------------------------
-- 5. VERIFICATION
-- ------------------------------------------------------------

DO $$
DECLARE
    system_domain_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO system_domain_count
    FROM domain_registry
    WHERE organization_id IS NULL;

    IF system_domain_count = 0 THEN
        RAISE EXCEPTION
            'M22 verification failed: no system domains registered.';
    END IF;

    RAISE NOTICE
        'M22 verification passed: system_domains=%',
        system_domain_count;
END
$$;

COMMIT;
