/*
 * M19: Automatic metadata reference-code numbering
 *
 * New metadata records created through document appraisal
 * receive references in the form:
 *
 *   MET-1
 *   MET-2
 *   MET-3
 *
 * PostgreSQL owns the numbering so concurrent requests
 * cannot generate duplicate numbers.
 */

CREATE SEQUENCE IF NOT EXISTS metadata_reference_number_seq
  AS BIGINT
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  NO CYCLE;
