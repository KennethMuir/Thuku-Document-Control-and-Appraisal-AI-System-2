BEGIN;

ALTER TABLE metadata_domain_relationships
    DROP CONSTRAINT IF EXISTS metadata_domain_relationships_type_check;

ALTER TABLE metadata_domain_relationships
    ADD CONSTRAINT metadata_domain_relationships_type_check
    CHECK (
        relationship_type IN (
            -- Canonical relationship catalogue
            'SUBJECT',
            'RECORD',
            'PROCESS',
            'ACTIVITY',
            'TASK',
            'SERVICE',
            'EVENT',

            'REQUIREMENT',
            'OBLIGATION',
            'AUTHORITY',
            'POLICY',
            'DECISION',
            'APPROVAL',
            'AUTHORIZATION',

            'AGREEMENT',
            'PARTY',
            'TRANSACTION',
            'PAYMENT',
            'REQUEST',
            'SUBMISSION',
            'NOTICE',
            'AMENDMENT',
            'RENEWAL',
            'TERMINATION',
            'DISPUTE',

            'ASSESSMENT',
            'REVIEW',
            'INSPECTION',
            'AUDIT',
            'EVIDENCE',
            'FINDING',
            'RECOMMENDATION',

            'RISK',
            'CONTROL',
            'INCIDENT',
            'ISSUE',
            'INVESTIGATION',
            'CHANGE',
            'EXCEPTION',
            'DEPENDENCY',
            'FOLLOW_UP',

            'REPORT',
            'DATA',
            'ANALYSIS',
            'RESULT',

            'ASSET',
            'RESOURCE',
            'COST',
            'FUNDING',
            'BUDGET',
            'ACCOUNT',

            'LICENSE',
            'PERMIT',
            'CERTIFICATION',
            'COMPLIANCE',

            'CLASSIFICATION',
            'RETENTION',
            'ACCESS',
            'TRANSFER',
            'CUSTODY',
            'PRESERVATION',
            'DISPOSITION',

            -- Legacy values retained for historical data compatibility.
            'LEGAL_CONTEXT',
            'BUSINESS_FUNCTION',
            'TECHNICAL_CONTEXT',
            'PURPOSE',
            'REGULATORY_CONTEXT',
            'OPERATIONAL_CONTEXT',
            'FINANCIAL_CONTEXT',
            'HISTORICAL_CONTEXT',
            'OWNERSHIP_CONTEXT',
            'REPORTING_CONTEXT',
            'RECORDS_CONTEXT'
        )
    );

COMMIT;
