import type { Pool } from "pg";

export async function getDocumentDetails(
  pool: Pool,
  organizationId: number,
  documentId: number
) {
  const documentResult = await pool.query(
    `
      SELECT
        d.id,
        d.document_code,
        d.upload_number,
        d.filename,
        d.title,
        d.document_date,
        d.upload_date,
        d.year,
        d.person_name,
        d.file_type,
        d.file_size,
        d.status,
        d.metadata_record_id,

        mr.id AS metadata_id,
        mr.reference_code,
        mr.title AS metadata_title,
        mr.document_date AS metadata_document_date,
        mr.year AS metadata_year,
        mr.person_name AS metadata_person_name,
        mr.description AS metadata_description,
        mr.section AS metadata_section,
        mr.additional_metadata,
        mr.status AS metadata_status,
        mr.created_at AS metadata_created_at,
        mr.updated_at AS metadata_updated_at,

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

  const document = documentResult.rows[0];

  const metadataRecordId = document.metadata_id;

  if (metadataRecordId === null || metadataRecordId === undefined) {
    return {
      document: {
        id: document.id,
        document_code: document.document_code,
        upload_number: document.upload_number,
        filename: document.filename,
        title: document.title,
        document_date: document.document_date,
        upload_date: document.upload_date,
        year: document.year,
        person_name: document.person_name,
        file_type: document.file_type,
        file_size: document.file_size,
        status: document.status,
        metadata_record_id: document.metadata_record_id,
      },
      mainMetadata: null,
      additionalMetadata: {},
      universalMetadata: [],
      domainClassifications: [],
      domainRelationships: [],
    };
  }

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

  const domainClassifications = domainRelationships.map((relationship) => ({
    domain_id: relationship.domain_id,
    domain_key: relationship.domain_key,
    display_name: relationship.display_name,
    description: relationship.description,
    domain_family: relationship.domain_family,
    domain_organization_id: relationship.domain_organization_id,
    domain_is_active: relationship.domain_is_active,
  }));

  const uniqueDomainClassifications = Array.from(
    new Map(
      domainClassifications.map((domain) => [
        domain.domain_id,
        domain,
      ])
    ).values()
  );

  return {
    document: {
      id: document.id,
      document_code: document.document_code,
      upload_number: document.upload_number,
      filename: document.filename,
      title: document.title,
      document_date: document.document_date,
      upload_date: document.upload_date,
      year: document.year,
      person_name: document.person_name,
      file_type: document.file_type,
      file_size: document.file_size,
      status: document.status,
      metadata_record_id: document.metadata_record_id,
    },

    mainMetadata: {
      id: document.metadata_id,
      reference_code: document.reference_code,
      title: document.metadata_title,
      document_date: document.metadata_document_date,
      year: document.metadata_year,
      person_name: document.metadata_person_name,
      description: document.metadata_description,
      section: document.metadata_section,
      status: document.metadata_status,
      created_at: document.metadata_created_at,
      updated_at: document.metadata_updated_at,

      department: {
        id: document.department_id,
        name: document.department_name,
        code: document.department_code,
      },

      document_type: {
        id: document.document_type_id,
        name: document.document_type_name,
      },
    },

    additionalMetadata: document.additional_metadata ?? {},

    universalMetadata: universalResult.rows,

    domainClassifications: uniqueDomainClassifications,

    domainRelationships,
  };
}
