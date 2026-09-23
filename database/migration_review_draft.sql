ALTER TABLE documents
ADD COLUMN IF NOT EXISTS review_draft_metadata JSONB;
