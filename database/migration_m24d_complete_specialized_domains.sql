BEGIN;

-- M24D correction:
-- Complete the system-controlled SPECIALIZED domain catalogue.
--
-- Existing specialized domains are preserved:
--   aviation   -> specialization 26
--   healthcare -> specialization 13
--   education  -> specialization 11
--
-- This migration inserts only missing SPECIALIZED domains.
-- No metadata_domain_relationships rows are modified or deleted.

INSERT INTO domain_registry (
    domain_key,
    display_name,
    description,
    domain_family,
    organization_id,
    domain_scope,
    specialization_id,
    is_active
)
SELECT
    s.specialization_key,
    s.display_name,
    CASE s.specialization_key
        WHEN 'government_public_administration'
            THEN 'Government administration, public-sector operations, governance, and related records.'
        WHEN 'international_intergovernmental_organization'
            THEN 'International and intergovernmental administration, programs, cooperation, and related records.'
        WHEN 'nonprofit_civil_society'
            THEN 'Nonprofit governance, civil society operations, programs, and related records.'
        WHEN 'community_social_services'
            THEN 'Community services, social programs, community development, and related records.'
        WHEN 'banking_financial_services'
            THEN 'Banking operations, financial services, customer administration, and related records.'
        WHEN 'insurance'
            THEN 'Insurance operations, underwriting, claims, risk, and related records.'
        WHEN 'investment_capital_markets'
            THEN 'Investment management, capital markets, securities, portfolio operations, and related records.'
        WHEN 'legal_services'
            THEN 'Legal practice, case administration, legal services, and related records.'
        WHEN 'accounting_audit_services'
            THEN 'Accounting, financial reporting, assurance, audit services, and related records.'
        WHEN 'consulting_professional_services'
            THEN 'Consulting engagements, professional services, client delivery, and related records.'
        WHEN 'education'
            THEN 'Educational administration, teaching, learning, academic programs, and education records.'
        WHEN 'research_institution'
            THEN 'Research institution administration, research programs, academic research, and related records.'
        WHEN 'healthcare'
            THEN 'Healthcare administration, clinical operations, healthcare services, and related records.'
        WHEN 'pharmaceutical_life_sciences'
            THEN 'Pharmaceutical operations, life sciences, research, development, and related records.'
        WHEN 'information_technology'
            THEN 'Information technology operations, systems, software, infrastructure, and related records.'
        WHEN 'telecommunications'
            THEN 'Telecommunications operations, network services, infrastructure, and related records.'
        WHEN 'media_publishing'
            THEN 'Media production, publishing, editorial operations, content, and related records.'
        WHEN 'manufacturing'
            THEN 'Manufacturing operations, production, quality, facilities, and related records.'
        WHEN 'construction'
            THEN 'Construction projects, site operations, contracts, safety, and related records.'
        WHEN 'engineering_services'
            THEN 'Engineering services, technical design, project delivery, and related records.'
        WHEN 'mining_extractives'
            THEN 'Mining and extractive operations, production, safety, environmental management, and related records.'
        WHEN 'energy_utilities'
            THEN 'Energy generation, utilities operations, infrastructure, and related records.'
        WHEN 'retail_wholesale'
            THEN 'Retail and wholesale operations, merchandising, inventory, customers, and related records.'
        WHEN 'sales_distribution'
            THEN 'Sales operations, distribution, channels, customers, and related records.'
        WHEN 'hospitality_tourism'
            THEN 'Hospitality operations, accommodation, tourism services, and related records.'
        WHEN 'aviation'
            THEN 'Aviation operations, safety, airworthiness, flight operations, aviation compliance, and aviation records.'
        WHEN 'maritime_shipping'
            THEN 'Maritime operations, shipping, vessels, ports, logistics, safety, and related records.'
        WHEN 'rail_public_transport'
            THEN 'Rail and public transport operations, infrastructure, safety, and related records.'
        WHEN 'logistics_freight'
            THEN 'Logistics, freight, warehousing, transportation, and supply-chain operations.'
        WHEN 'agriculture'
            THEN 'Agricultural operations, production, land management, supply chains, and related records.'
        WHEN 'forestry'
            THEN 'Forestry operations, land management, conservation, production, and related records.'
        WHEN 'fisheries'
            THEN 'Fisheries operations, aquatic resource management, production, and related records.'
        WHEN 'real_estate_property'
            THEN 'Real estate, property management, development, leasing, and related records.'
        WHEN 'facilities_infrastructure_services'
            THEN 'Facilities management, infrastructure services, maintenance, and related records.'
        WHEN 'research_development'
            THEN 'Research and development programs, innovation, product development, and related records.'
        WHEN 'other_general_commercial'
            THEN 'General commercial operations and specialized activities not otherwise classified.'
        ELSE
            s.display_name || ' specialized operations and related records.'
    END AS description,
    s.display_name AS domain_family,
    NULL AS organization_id,
    'SPECIALIZED' AS domain_scope,
    s.id AS specialization_id,
    TRUE AS is_active
FROM specializations s
WHERE s.is_active = TRUE
  AND NOT EXISTS (
      SELECT 1
      FROM domain_registry dr
      WHERE dr.domain_scope = 'SPECIALIZED'
        AND dr.specialization_id = s.id
  );

COMMIT;
