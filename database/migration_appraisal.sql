ALTER TABLE metadata_records
    ADD COLUMN IF NOT EXISTS department_id BIGINT
        REFERENCES departments(id) ON DELETE SET NULL;

ALTER TABLE metadata_records
    ADD COLUMN IF NOT EXISTS document_type_id BIGINT
        REFERENCES document_types(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS documents_metadata_record_unique
    ON documents(metadata_record_id)
    WHERE metadata_record_id IS NOT NULL;
