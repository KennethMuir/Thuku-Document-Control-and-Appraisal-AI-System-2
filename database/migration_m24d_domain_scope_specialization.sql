BEGIN;

-- ============================================================
-- M24D — DOMAIN SCOPE & ORGANIZATION SPECIALIZATION
-- Corrected canonical catalogue migration
--
-- IMPORTANT:
--   - Existing domain IDs are preserved.
--   - Existing metadata_domain_relationships are preserved.
--   - Existing specialized domains remain specialized.
--   - Existing equivalent Universal domains are renamed in place.
--   - Missing canonical Universal domains are inserted.
--   - Organization specialization remains NULL until explicitly set.
--
-- Final verification target:
--   UNIVERSAL      = 47
--   SPECIALIZED    = 3
--   ORGANIZATION   = 0
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
-- 5. Initial scope classification of existing domains
--
-- Existing domain IDs are preserved.
--
-- Existing specialized domains:
--   21 = aviation
--   22 = healthcare
--   24 = education
--
-- All other existing system domains become UNIVERSAL.
-- ------------------------------------------------------------

UPDATE domain_registry
SET
    domain_scope = CASE
        WHEN domain_key IN (
            'aviation',
            'healthcare',
            'education'
        )
            THEN 'SPECIALIZED'
        ELSE 'UNIVERSAL'
    END;


-- ------------------------------------------------------------
-- 6. Associate existing specialized domains
-- ------------------------------------------------------------

UPDATE domain_registry dr
SET specialization_id = s.id
FROM specializations s
WHERE dr.domain_key = s.specialization_key
  AND dr.domain_scope = 'SPECIALIZED';


-- ------------------------------------------------------------
-- 7. Normalize existing Universal terminology
--
-- Existing IDs are deliberately retained.
-- This preserves historical metadata relationships.
-- ------------------------------------------------------------

UPDATE domain_registry
SET
    domain_key = 'risk_management',
    display_name = 'Risk Management',
    domain_family = 'Legal, Regulatory & Oversight',
    updated_at = NOW()
WHERE id = 5
  AND domain_key = 'risk';

UPDATE domain_registry
SET
    domain_key = 'contracts_agreements',
    display_name = 'Contracts & Agreements',
    domain_family = 'Legal, Regulatory & Oversight',
    updated_at = NOW()
WHERE id = 12
  AND domain_key = 'contracts';

UPDATE domain_registry
SET
    domain_key = 'training_development',
    display_name = 'Training & Development',
    domain_family = 'People',
    updated_at = NOW()
WHERE id = 14
  AND domain_key = 'training';

UPDATE domain_registry
SET
    domain_key = 'quality_management',
    display_name = 'Quality Management',
    domain_family = 'Quality, Safety & Environment',
    updated_at = NOW()
WHERE id = 18
  AND domain_key = 'quality_assurance';


-- ------------------------------------------------------------
-- 8. Normalize existing canonical Universal display/family data
-- ------------------------------------------------------------

UPDATE domain_registry
SET
    domain_family = 'Organization & Governance',
    updated_at = NOW()
WHERE domain_key IN (
    'general_administration',
    'governance',
    'business_operations',
    'policy'
);

UPDATE domain_registry
SET
    domain_family = 'Information & Knowledge',
    updated_at = NOW()
WHERE domain_key IN (
    'records_management',
    'information_technology',
    'research_scientific'
);

UPDATE domain_registry
SET
    domain_family = 'Legal, Regulatory & Oversight',
    updated_at = NOW()
WHERE domain_key IN (
    'legal',
    'contracts_agreements',
    'regulatory',
    'compliance',
    'audit',
    'risk_management'
);

UPDATE domain_registry
SET
    domain_family = 'Security & Resilience',
    updated_at = NOW()
WHERE domain_key = 'security';

UPDATE domain_registry
SET
    domain_family = 'Finance & Commercial',
    updated_at = NOW()
WHERE domain_key IN (
    'finance',
    'accounting',
    'procurement'
);

UPDATE domain_registry
SET
    domain_family = 'People',
    updated_at = NOW()
WHERE domain_key IN (
    'human_resources',
    'training_development'
);

UPDATE domain_registry
SET
    domain_family = 'Assets & Infrastructure',
    updated_at = NOW()
WHERE domain_key IN (
    'engineering',
    'maintenance'
);

UPDATE domain_registry
SET
    domain_family = 'Quality, Safety & Environment',
    updated_at = NOW()
WHERE domain_key = 'quality_management';

UPDATE domain_registry
SET
    domain_family = 'Programs, Research & Development',
    updated_at = NOW()
WHERE domain_key IN (
    'project_management',
    'research_scientific'
);

UPDATE domain_registry
SET
    domain_family = 'Quality, Safety & Environment',
    updated_at = NOW()
WHERE domain_key = 'environmental';


-- ------------------------------------------------------------
-- 9. Insert missing canonical Universal domains
--
-- Existing equivalent domains are NOT recreated.
--
-- Missing count: 23
-- ------------------------------------------------------------

INSERT INTO domain_registry (
    domain_key,
    display_name,
    description,
    domain_family,
    aliases,
    organization_id,
    is_active
)
SELECT
    v.domain_key,
    v.display_name,
    v.description,
    v.domain_family,
    '[]'::jsonb,
    NULL,
    TRUE
FROM (
    VALUES
        (
            'strategy_planning',
            'Strategy & Planning',
            'Strategic planning, organizational planning, objectives, priorities, and long-term direction.',
            'Organization & Governance'
        ),
        (
            'ethics_professional_conduct',
            'Ethics & Professional Conduct',
            'Ethical standards, professional conduct, codes of conduct, and related matters.',
            'Legal, Regulatory & Oversight'
        ),
        (
            'privacy_data_protection',
            'Privacy & Data Protection',
            'Privacy governance, personal data protection, data subject matters, and privacy controls.',
            'Legal, Regulatory & Oversight'
        ),
        (
            'information_security',
            'Information Security',
            'Protection of information, information-security controls, confidentiality, integrity, and availability.',
            'Security & Resilience'
        ),
        (
            'emergency_incident_management',
            'Emergency & Incident Management',
            'Emergency response, incident management, response coordination, and incident handling.',
            'Security & Resilience'
        ),
        (
            'business_continuity_resilience',
            'Business Continuity & Resilience',
            'Business continuity planning, resilience, recovery, and organizational continuity.',
            'Security & Resilience'
        ),
        (
            'information_management',
            'Information Management',
            'Information governance, information lifecycle management, information architecture, and stewardship.',
            'Information & Knowledge'
        ),
        (
            'data_analytics',
            'Data & Analytics',
            'Data management, analytics, reporting, data analysis, and analytical activities.',
            'Information & Knowledge'
        ),
        (
            'treasury_cash_management',
            'Treasury & Cash Management',
            'Cash management, liquidity, treasury operations, banking arrangements, and related activities.',
            'Finance & Commercial'
        ),
        (
            'tax',
            'Tax',
            'Tax administration, tax compliance, tax reporting, and tax-related matters.',
            'Finance & Commercial'
        ),
        (
            'supply_chain',
            'Supply Chain',
            'Supply-chain planning, sourcing, logistics coordination, supplier networks, and supply-chain operations.',
            'Finance & Commercial'
        ),
        (
            'assets_facilities',
            'Assets & Facilities',
            'Organizational assets, facilities, buildings, equipment, and facilities administration.',
            'Assets & Infrastructure'
        ),
        (
            'construction',
            'Construction',
            'Construction projects, construction activities, construction works, and related records.',
            'Assets & Infrastructure'
        ),
        (
            'manufacturing_production',
            'Manufacturing & Production',
            'Manufacturing processes, production operations, production planning, and related activities.',
            'Assets & Infrastructure'
        ),
        (
            'transportation_logistics',
            'Transportation & Logistics',
            'Transportation operations, logistics activities, movement of goods or people, and related coordination.',
            'Assets & Infrastructure'
        ),
        (
            'energy_utilities',
            'Energy & Utilities',
            'Energy generation, energy management, utilities, and utility services.',
            'Assets & Infrastructure'
        ),
        (
            'health_safety',
            'Health & Safety',
            'Occupational health, workplace safety, safety management, and related controls.',
            'Quality, Safety & Environment'
        ),
        (
            'research_development',
            'Research & Development',
            'Research and development programs, activities, outputs, and related organizational work.',
            'Programs, Research & Development'
        ),
        (
            'grants_funding',
            'Grants & Funding',
            'Grants, funding programs, financial awards, funding applications, and related activities.',
            'Programs, Research & Development'
        ),
        (
            'community_social_programs',
            'Community & Social Programs',
            'Community programs, social initiatives, outreach programs, and related activities.',
            'Programs, Research & Development'
        ),
        (
            'sales_marketing',
            'Sales & Marketing',
            'Sales activities, marketing, promotion, market development, and related commercial activities.',
            'External & Commercial Relations'
        ),
        (
            'customer_client_services',
            'Customer & Client Services',
            'Customer service, client service, customer support, client relationships, and related activities.',
            'External & Commercial Relations'
        ),
        (
            'communications_external_relations',
            'Communications & External Relations',
            'Corporate communications, public communications, external relations, media relations, and stakeholder communications.',
            'External & Commercial Relations'
        )
) AS v(
    domain_key,
    display_name,
    description,
    domain_family
)
WHERE NOT EXISTS (
    SELECT 1
    FROM domain_registry existing
    WHERE lower(existing.domain_key) = lower(v.domain_key)
      AND existing.organization_id IS NULL
);


-- ------------------------------------------------------------
-- 10. Explicitly enforce scope values for all system rows
-- ------------------------------------------------------------

UPDATE domain_registry
SET
    domain_scope = 'UNIVERSAL',
    specialization_id = NULL
WHERE domain_key NOT IN (
    'aviation',
    'healthcare',
    'education'
)
AND organization_id IS NULL;


UPDATE domain_registry dr
SET
    domain_scope = 'SPECIALIZED'
WHERE dr.domain_key IN (
    'aviation',
    'healthcare',
    'education'
)
AND dr.organization_id IS NULL;


-- ------------------------------------------------------------
-- 11. Organization-owned domains, if any existed, remain
--     organization-scoped and specialization-independent.
-- ------------------------------------------------------------

UPDATE domain_registry
SET
    domain_scope = 'ORGANIZATION',
    specialization_id = NULL
WHERE organization_id IS NOT NULL;


-- ------------------------------------------------------------
-- 12. Make domain scope mandatory
-- ------------------------------------------------------------

ALTER TABLE domain_registry
    ALTER COLUMN domain_scope SET NOT NULL;


-- ------------------------------------------------------------
-- 13. Add foreign keys
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
-- 14. Domain scope invariants
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
-- 15. Replace old domain uniqueness indexes
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
-- 16. Supporting indexes
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS domain_registry_specialization_idx
    ON domain_registry (specialization_id);

CREATE INDEX IF NOT EXISTS domain_registry_scope_idx
    ON domain_registry (domain_scope);

CREATE INDEX IF NOT EXISTS domain_registry_scope_active_idx
    ON domain_registry (domain_scope, is_active);


-- ------------------------------------------------------------
-- 17. Verify organization specialization remains unset
-- ------------------------------------------------------------

DO $$
DECLARE
    unexpected_specialized_org_count BIGINT;
BEGIN
    SELECT COUNT(*)
    INTO unexpected_specialized_org_count
    FROM organizations
    WHERE specialization_id IS NOT NULL;

    IF unexpected_specialized_org_count <> 0 THEN
        RAISE EXCEPTION
            'M24D verification failed: % organizations unexpectedly have a specialization.',
            unexpected_specialized_org_count;
    END IF;
END
$$;


-- ------------------------------------------------------------
-- 18. Final M24D verification
-- ------------------------------------------------------------

DO $$
DECLARE
    invalid_domain_count BIGINT;
    universal_count BIGINT;
    specialized_count BIGINT;
    organization_count BIGINT;
    specialization_count BIGINT;
    relationship_count BIGINT;
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


    SELECT COUNT(*)
    INTO specialization_count
    FROM specializations
    WHERE is_active = TRUE;


    SELECT COUNT(*)
    INTO relationship_count
    FROM metadata_domain_relationships;


    IF universal_count <> 47 THEN
        RAISE EXCEPTION
            'M24D verification failed: expected 47 universal domains, found %.',
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


    IF specialization_count <> 36 THEN
        RAISE EXCEPTION
            'M24D verification failed: expected 36 active specializations, found %.',
            specialization_count;
    END IF;


    RAISE NOTICE
        'M24D verification passed: universal=%, specialized=%, organization=%, active_specializations=%, historical_relationships=%',
        universal_count,
        specialized_count,
        organization_count,
        specialization_count,
        relationship_count;
END
$$;


COMMIT;
