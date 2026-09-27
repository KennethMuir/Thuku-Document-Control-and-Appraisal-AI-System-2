BEGIN;

-- ============================================================
-- M24D — DOMAIN SCOPE & ORGANIZATION SPECIALIZATION
-- ============================================================

-- ------------------------------------------------------------
-- 1. System specialization catalogue
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS specializations (
    id BIGSERIAL PRIMARY KEY,
    specialization_key VARCHAR(100) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT specializations_key_unique
        UNIQUE (specialization_key)
);

CREATE INDEX IF NOT EXISTS specializations_active_idx
    ON specializations (is_active);


-- ------------------------------------------------------------
-- 2. Add organization specialization
-- ------------------------------------------------------------

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS specialization_id BIGINT;


-- ------------------------------------------------------------
-- 3. Add domain scope and specialization
-- ------------------------------------------------------------

ALTER TABLE domain_registry
    ADD COLUMN IF NOT EXISTS domain_scope VARCHAR(30);

ALTER TABLE domain_registry
    ADD COLUMN IF NOT EXISTS specialization_id BIGINT;


-- ------------------------------------------------------------
-- 4. Seed specialization catalogue
-- ------------------------------------------------------------

INSERT INTO specializations (
    specialization_key,
    display_name,
    description
)
VALUES
    (
        'government_public_administration',
        'Government & Public Administration',
        'Government ministries, departments, agencies, and public administration organizations.'
    ),
    (
        'international_intergovernmental_organization',
        'International & Intergovernmental Organization',
        'International organizations and intergovernmental institutions.'
    ),
    (
        'nonprofit_civil_society',
        'Nonprofit & Civil Society',
        'Nonprofit organizations, charities, foundations, and civil society organizations.'
    ),
    (
        'community_social_services',
        'Community & Social Services',
        'Organizations providing community, social, and public-facing social services.'
    ),
    (
        'banking_financial_services',
        'Banking & Financial Services',
        'Banks and organizations providing financial services.'
    ),
    (
        'insurance',
        'Insurance',
        'Insurance companies and insurance-related organizations.'
    ),
    (
        'investment_capital_markets',
        'Investment & Capital Markets',
        'Investment firms, capital-market organizations, and related institutions.'
    ),
    (
        'legal_services',
        'Legal Services',
        'Law firms and organizations providing legal services.'
    ),
    (
        'accounting_audit_services',
        'Accounting & Audit Services',
        'Accounting, audit, assurance, and related professional service organizations.'
    ),
    (
        'consulting_professional_services',
        'Consulting & Professional Services',
        'Consulting firms and other professional service organizations.'
    ),
    (
        'education',
        'Education',
        'Schools, colleges, universities, training institutions, and education providers.'
    ),
    (
        'research_institution',
        'Research Institution',
        'Institutions primarily engaged in research and scientific investigation.'
    ),
    (
        'healthcare',
        'Healthcare',
        'Hospitals, clinics, healthcare providers, and healthcare organizations.'
    ),
    (
        'pharmaceutical_life_sciences',
        'Pharmaceutical & Life Sciences',
        'Pharmaceutical, biotechnology, and life-sciences organizations.'
    ),
    (
        'information_technology',
        'Information Technology',
        'Organizations primarily providing information technology products or services.'
    ),
    (
        'telecommunications',
        'Telecommunications',
        'Telecommunications operators and related service organizations.'
    ),
    (
        'media_publishing',
        'Media & Publishing',
        'Media companies, publishers, broadcasters, and related organizations.'
    ),
    (
        'manufacturing',
        'Manufacturing',
        'Organizations engaged primarily in manufacturing and production.'
    ),
    (
        'construction',
        'Construction',
        'Construction companies and organizations.'
    ),
    (
        'engineering_services',
        'Engineering Services',
        'Organizations primarily providing engineering services.'
    ),
    (
        'mining_extractives',
        'Mining & Extractive Industries',
        'Mining, extraction, and related resource organizations.'
    ),
    (
        'energy_utilities',
        'Energy & Utilities',
        'Energy producers, utilities, and related infrastructure organizations.'
    ),
    (
        'retail_wholesale',
        'Retail & Wholesale',
        'Retailers, wholesalers, and related commercial organizations.'
    ),
    (
        'sales_distribution',
        'Sales & Distribution',
        'Organizations primarily engaged in sales, distribution, and related commercial activities.'
    ),
    (
        'hospitality_tourism',
        'Hospitality & Tourism',
        'Hotels, tourism operators, travel organizations, and hospitality businesses.'
    ),
    (
        'aviation',
        'Aviation',
        'Airlines, airports, aviation operators, and aviation-related organizations.'
    ),
    (
        'maritime_shipping',
        'Maritime & Shipping',
        'Maritime, shipping, port, and related organizations.'
    ),
    (
        'rail_public_transport',
        'Rail & Public Transport',
        'Railway operators and public transportation organizations.'
    ),
    (
        'logistics_freight',
        'Logistics & Freight',
        'Logistics, freight, warehousing, and supply-chain organizations.'
    ),
    (
        'agriculture',
        'Agriculture',
        'Agricultural organizations, producers, and related businesses.'
    ),
    (
        'forestry',
        'Forestry',
        'Forestry organizations and related businesses.'
    ),
    (
        'fisheries',
        'Fisheries',
        'Fisheries organizations and related businesses.'
    ),
    (
        'real_estate_property',
        'Real Estate & Property',
        'Real estate, property management, and related organizations.'
    ),
    (
        'facilities_infrastructure_services',
        'Facilities & Infrastructure Services',
        'Organizations providing facilities, infrastructure, and related operational services.'
    ),
    (
        'research_development',
        'Research & Development',
        'Organizations primarily engaged in research and development activities.'
    ),
    (
        'other_general_commercial',
        'Other / General Commercial',
        'General commercial organizations that do not fit another specialization.'
    )
ON CONFLICT (specialization_key) DO NOTHING;


-- ------------------------------------------------------------
-- 5. Classify existing domains
-- ------------------------------------------------------------

UPDATE domain_registry
SET
    domain_scope = 'SPECIALIZED'
WHERE domain_key IN (
    'aviation',
    'healthcare',
    'education'
);

UPDATE domain_registry
SET
    domain_scope = 'UNIVERSAL'
WHERE domain_scope IS NULL;


-- ------------------------------------------------------------
-- 6. Associate existing specialized domains
-- ------------------------------------------------------------

UPDATE domain_registry dr
SET specialization_id = s.id
FROM specializations s
WHERE dr.domain_key = s.specialization_key
  AND dr.domain_scope = 'SPECIALIZED';


-- ------------------------------------------------------------
-- 7. Organization-owned domains remain unassigned to a
--    specialization.
-- ------------------------------------------------------------

UPDATE domain_registry
SET specialization_id = NULL
WHERE domain_scope = 'ORGANIZATION';


-- ------------------------------------------------------------
-- 8. Make domain scope mandatory
-- ------------------------------------------------------------

ALTER TABLE domain_registry
    ALTER COLUMN domain_scope SET NOT NULL;


-- ------------------------------------------------------------
-- 9. Add foreign keys
-- ------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'organizations_specialization_id_fkey'
    ) THEN
        ALTER TABLE organizations
            ADD CONSTRAINT organizations_specialization_id_fkey
            FOREIGN KEY (specialization_id)
            REFERENCES specializations(id)
            ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'domain_registry_specialization_id_fkey'
    ) THEN
        ALTER TABLE domain_registry
            ADD CONSTRAINT domain_registry_specialization_id_fkey
            FOREIGN KEY (specialization_id)
            REFERENCES specializations(id)
            ON DELETE RESTRICT;
    END IF;
END
$$;


-- ------------------------------------------------------------
-- 10. Domain scope invariants
-- ------------------------------------------------------------

ALTER TABLE domain_registry
    ADD CONSTRAINT domain_registry_scope_valid
    CHECK (
        (
            domain_scope = 'UNIVERSAL'
            AND organization_id IS NULL
            AND specialization_id IS NULL
        )
        OR
        (
            domain_scope = 'SPECIALIZED'
            AND organization_id IS NULL
            AND specialization_id IS NOT NULL
        )
        OR
        (
            domain_scope = 'ORGANIZATION'
            AND organization_id IS NOT NULL
            AND specialization_id IS NULL
        )
    );


-- ------------------------------------------------------------
-- 11. Replace old domain uniqueness indexes
-- ------------------------------------------------------------

DROP INDEX IF EXISTS domain_registry_system_domain_key_unique;

DROP INDEX IF EXISTS domain_registry_organization_domain_key_unique;

CREATE UNIQUE INDEX domain_registry_universal_domain_key_unique
    ON domain_registry (lower(domain_key))
    WHERE domain_scope = 'UNIVERSAL';

CREATE UNIQUE INDEX domain_registry_specialized_domain_key_unique
    ON domain_registry (
        specialization_id,
        lower(domain_key)
    )
    WHERE domain_scope = 'SPECIALIZED';

CREATE UNIQUE INDEX domain_registry_organization_domain_key_unique
    ON domain_registry (
        organization_id,
        lower(domain_key)
    )
    WHERE domain_scope = 'ORGANIZATION';


-- ------------------------------------------------------------
-- 12. Supporting indexes
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS domain_registry_specialization_idx
    ON domain_registry (specialization_id);

CREATE INDEX IF NOT EXISTS domain_registry_scope_idx
    ON domain_registry (domain_scope);

CREATE INDEX IF NOT EXISTS domain_registry_scope_active_idx
    ON domain_registry (domain_scope, is_active);


-- ------------------------------------------------------------
-- 13. Verification
-- ------------------------------------------------------------

DO $$
DECLARE
    invalid_domain_count BIGINT;
    universal_count BIGINT;
    specialized_count BIGINT;
    organization_count BIGINT;
BEGIN
    SELECT COUNT(*)
    INTO invalid_domain_count
    FROM domain_registry
    WHERE NOT (
        (
            domain_scope = 'UNIVERSAL'
            AND organization_id IS NULL
            AND specialization_id IS NULL
        )
        OR
        (
            domain_scope = 'SPECIALIZED'
            AND organization_id IS NULL
            AND specialization_id IS NOT NULL
        )
        OR
        (
            domain_scope = 'ORGANIZATION'
            AND organization_id IS NOT NULL
            AND specialization_id IS NULL
        )
    );

    IF invalid_domain_count <> 0 THEN
        RAISE EXCEPTION
            'M24D verification failed: % domain rows violate scope invariants.',
            invalid_domain_count;
    END IF;

    SELECT COUNT(*)
    INTO universal_count
    FROM domain_registry
    WHERE domain_scope = 'UNIVERSAL';

    SELECT COUNT(*)
    INTO specialized_count
    FROM domain_registry
    WHERE domain_scope = 'SPECIALIZED';

    SELECT COUNT(*)
    INTO organization_count
    FROM domain_registry
    WHERE domain_scope = 'ORGANIZATION';

    IF universal_count <> 24 THEN
        RAISE EXCEPTION
            'M24D verification failed: expected 24 universal domains, found %.',
            universal_count;
    END IF;

    IF specialized_count <> 3 THEN
        RAISE EXCEPTION
            'M24D verification failed: expected 3 specialized domains, found %.',
            specialized_count;
    END IF;

    IF organization_count <> 0 THEN
        RAISE EXCEPTION
            'M24D verification failed: expected 0 organization domains, found %.',
            organization_count;
    END IF;

    RAISE NOTICE
        'M24D verification passed: universal=%, specialized=%, organization=%',
        universal_count,
        specialized_count,
        organization_count;
END
$$;

COMMIT;
