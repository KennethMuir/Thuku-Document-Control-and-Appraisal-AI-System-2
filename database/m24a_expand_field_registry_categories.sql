BEGIN;

ALTER TABLE field_registry
DROP CONSTRAINT IF EXISTS field_registry_category_valid;

ALTER TABLE field_registry
ADD CONSTRAINT field_registry_category_valid
CHECK (
    category IN (
        'Identity',
        'Dates',
        'People',
        'Organizations',
        'Records Management',
        'Administrative',
        'Governance',
        'Subject / Classification',
        'Legal / Regulatory',
        'Security',
        'Compliance',
        'Risk',
        'Audit',
        'Financial',
        'Procurement',
        'Contracts',
        'Human Resources',
        'Projects',
        'Operations',
        'Engineering',
        'Aviation',
        'Medical / Healthcare',
        'Research / Scientific',
        'Education',
        'Geographic',
        'Technical',
        'Media / Audiovisual',
        'Archival',
        'Preservation',
        'Workflow / Approval',
        'Relationships',
        'Environmental'
    )
);

COMMIT;
