import type { Pool } from "pg";

type DocumentDetailsRow = {
  document_record: Record<string, unknown>;
  metadata_record: Record<string, unknown> | null;

  department_id: number | null;
  department_name: string | null;
  department_code: string | null;

  document_type_id: number | null;
  document_type_name: string | null;
};

export async function getDocumentDetails(
  pool: Pool,
  organizationId: number,
  documentId: number
) {
  /*
   * Retrieve the document and the complete metadata_records row.
   *
   * The metadata record is deliberately retrieved with to_jsonb(mr)
   * rather than maintaining a manually selected list of metadata
   * columns. This keeps the complete stored metadata record available
   * without requiring this service to be changed whenever a metadata
   * column is added.
   */
  const documentResult = await pool.query<DocumentDetailsRow>(
    `
      SELECT
        to_jsonb(d) AS document_record,
        CASE
          WHEN mr.id IS NULL THEN NULL
          ELSE to_jsonb(mr)
        END AS metadata_record,

        dept.id AS department_id,
        dept.name AS department_name,
        dept.code AS department_code,

        dt.id AS document_type_id,
        dt.name AS document_type_name

      FROM documents d

      LEFT JOIN metadata_records mr
        ON mr.id = d.metadata_record_id

      LEFT JOIN departments dept
        ON dept.id = mr.department_id

      LEFT JOIN document_types dt
        ON dt.id = mr.document_type_id

      WHERE d.id = $1
        AND d.organization_id = $2

      LIMIT 1
    `,
    [documentId, organizationId]
  );

  if (documentResult.rows.length === 0) {
    return null;
  }

  const row = documentResult.rows[0];

  if (!row) {
    return null;
  }

  const documentRecord = row.document_record;
  const metadataRecord = row.metadata_record;

  /*
   * No metadata record is attached to this document.
   */
  if (!metadataRecord) {
    return {
      document: documentRecord,
      mainMetadata: null,
      additionalMetadata: {},
      universalMetadata: [],
      domainClassifications: [],
      domainRelationships: [],
    };
  }

  const metadataRecordId = metadataRecord.id;

  if (
    typeof metadataRecordId !== "number" ||
    !Number.isInteger(metadataRecordId) ||
    metadataRecordId <= 0
  ) {
    throw new Error(
      "The document references an invalid metadata record."
    );
  }

  /*
   * Retrieve universal metadata values and domain relationships
   * independently because they are separate persisted structures.
   */
  const [universalResult, domainResult] = await Promise.all([
    pool.query(
      `
        SELECT
          mv.id,
          mv.metadata_record_id,
          mv.field_registry_id,

          fr.field_key,
          fr.display_name,
          fr.description,
          fr.category,
          fr.data_type,
          fr.repeatable,
          fr.searchable,
          fr.filterable,
          fr.sortable,
          fr.ai_extractable,
          fr.user_editable,
          fr.sensitive,
          fr.aliases,
          fr.controlled_vocabulary,
          fr.unit,

          mv.value,
          mv.source,
          mv.confidence,
          mv.verification_status,
          mv.created_at,
          mv.updated_at

        FROM metadata_values mv

        INNER JOIN field_registry fr
          ON fr.id = mv.field_registry_id

        WHERE mv.metadata_record_id = $1

        ORDER BY
          fr.category,
          fr.display_name,
          mv.id
      `,
      [metadataRecordId]
    ),

    pool.query(
      `
        SELECT
          mdr.id,
          mdr.metadata_record_id,
          mdr.domain_id,

          dr.domain_key,
          dr.display_name,
          dr.description,
          dr.domain_family,
          dr.organization_id AS domain_organization_id,
          dr.is_active AS domain_is_active,

          CASE
            WHEN dr.organization_id IS NOT NULL
              THEN 'ORGANIZATION'
            WHEN COALESCE(
              (to_jsonb(dr) ->> 'specialization_id'),
              ''
            ) <> ''
              THEN 'SPECIALIZED'
            ELSE 'UNIVERSAL'
          END AS domain_scope,

          mdr.relationship_type,
          mdr.organization_id AS relationship_organization_id,
          mdr.created_at,
          mdr.updated_at

        FROM metadata_domain_relationships mdr

        INNER JOIN domain_registry dr
          ON dr.id = mdr.domain_id

        WHERE mdr.metadata_record_id = $1
          AND mdr.organization_id = $2

        ORDER BY
          dr.display_name,
          mdr.relationship_type,
          mdr.id
      `,
      [metadataRecordId, organizationId]
    ),
  ]);

  const domainRelationships = domainResult.rows;

  /*
   * Domain classifications are derived from the persisted
   * relationship rows.
   *
   * A domain may have more than one relationship type, but it
   * should appear only once in the classification section.
   *
   * domain_scope is preserved so the frontend can place each
   * domain into:
   *
   *   Universal
   *   Specialized
   *   Organization
   */
  const domainClassifications = domainRelationships.map(
    (relationship) => ({
      domain_id: relationship.domain_id,
      domain_key: relationship.domain_key,
      display_name: relationship.display_name,
      description: relationship.description,
      domain_family: relationship.domain_family,
      domain_scope: relationship.domain_scope,
      domain_organization_id:
        relationship.domain_organization_id,
      domain_is_active:
        relationship.domain_is_active,
    })
  );

  const uniqueDomainClassifications = Array.from(
    new Map(
      domainClassifications.map((domain) => [
        domain.domain_id,
        domain,
      ])
    ).values()
  );

  /*
   * Keep the complete metadata_records row intact.
   *
   * Department and document type are also resolved into structured
   * objects for the Document Details UI.
   */
  const mainMetadata = {
    ...metadataRecord,

    department: {
      id: row.department_id,
      name: row.department_name,
      code: row.department_code,
    },

    document_type: {
      id: row.document_type_id,
      name: row.document_type_name,
    },
  };

  /*
   * additionalMetadata remains a separate response section for
   * the existing Document Details UI.
   */
  const additionalMetadata =
    metadataRecord.additional_metadata &&
    typeof metadataRecord.additional_metadata === "object"
      ? metadataRecord.additional_metadata
      : {};

  /*
   * This GET service deliberately does not repair invalid data.
   *
   * A DOCUMENT_LINKED record should have both:
   *
   *   - department_id
   *   - reference_code
   *
   * because reference-code generation depends on Department.
   *
   * Enforcement belongs in the metadata creation/linking/update
   * transaction and, where appropriate, database constraints.
   */
  return {
    document: documentRecord,
    mainMetadata,
    additionalMetadata,
    universalMetadata: universalResult.rows,
    domainClassifications: uniqueDomainClassifications,
    domainRelationships,
  };
}