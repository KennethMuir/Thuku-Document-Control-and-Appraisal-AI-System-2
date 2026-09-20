/*
 * M19: Preserve partial extracted document dates
 *
 * Complete calendar dates continue to use extracted_date DATE.
 * When extraction identifies date information that does not contain
 * a calendar day, the interpreted source date is preserved here.
 *
 * Example:
 *   Sun Jan 18 -> Sun Jan 2018
 *
 * This prevents meaningful extracted date information from being lost
 * simply because PostgreSQL DATE requires a complete calendar date.
 */

ALTER TABLE document_extractions
ADD COLUMN IF NOT EXISTS extracted_date_text VARCHAR(150);
