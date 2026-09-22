export type UniversalMetadataCatalogueGroup = {
  key: string;
  label: string;
  description: string;
  fieldKeys: string[];
};

export const UNIVERSAL_METADATA_CATALOGUE: UniversalMetadataCatalogueGroup[] = [
  {
    key: "core",
    label: "Core",
    description: "Fundamental identity and descriptive information for every record.",
    fieldKeys: [
      "reference_code",
      "title",
      "description",
      "record_number",
      "file_number",
      "section",
    ],
  },
  {
    key: "persons",
    label: "Persons",
    description: "People associated with the creation, receipt, approval, ownership, or processing of a record.",
    fieldKeys: [
      "person_id",
      "person_name",
      "person_role",
      "author",
      "recipient",
      "approver",
      "researcher",
      "creator",
    ],
  },
  {
    key: "organizations",
    label: "Organizations",
    description: "Organizations, departments, business units, and organizational identifiers.",
    fieldKeys: [
      "organization_name",
      "organization_code",
      "department",
      "department_code",
    ],
  },
  {
    key: "dates_lifecycle",
    label: "Dates & Lifecycle",
    description: "Dates and values describing the lifecycle and version history of a record.",
    fieldKeys: [
      "document_date",
      "year",
      "created_date",
      "received_date",
      "effective_date",
      "expiry_date",
      "review_date",
      "version_number",
      "meeting_date",
      "contract_start_date",
      "contract_end_date",
      "employment_start_date",
    ],
  },
  {
    key: "records_management",
    label: "Records Management",
    description: "Records-management classification, retention, disposal, and lifecycle controls.",
    fieldKeys: [
      "record_number",
      "record_series",
      "file_number",
      "classification_code",
      "retention_period",
      "disposal_action",
      "disposal_date",
      "record_status",
    ],
  },
  {
    key: "content_subject",
    label: "Content & Subject",
    description: "Subject matter, keywords, business functions, processes, and content context.",
    fieldKeys: [
      "subject",
      "keywords",
      "business_function",
      "business_process",
      "policy_reference",
      "meeting_type",
      "action_item",
    ],
  },
  {
    key: "legal_regulatory",
    label: "Legal / Regulatory",
    description: "Legal references, regulatory context, and compliance information.",
    fieldKeys: [
      "legal_reference",
      "regulatory_reference",
      "compliance_status",
    ],
  },
  {
    key: "security",
    label: "Security",
    description: "Security classification, access controls, restrictions, and legal holds.",
    fieldKeys: [
      "security_classification",
      "access_restriction",
      "legal_hold",
    ],
  },
  {
    key: "financial",
    label: "Financial",
    description: "Financial amounts, currencies, cost centres, budgets, and accounting references.",
    fieldKeys: [
      "amount",
      "currency",
      "cost_center",
      "budget_code",
      "invoice_number",
    ],
  },
  {
    key: "procurement_contracts",
    label: "Procurement / Contracts",
    description: "Suppliers, purchasing records, purchase orders, and contracts.",
    fieldKeys: [
      "supplier_name",
      "purchase_order_number",
      "contract_number",
      "contract_type",
      "contract_start_date",
      "contract_end_date",
    ],
  },
  {
    key: "human_resources",
    label: "Human Resources",
    description: "Employee and employment-related metadata.",
    fieldKeys: [
      "employee_number",
      "job_title",
      "employment_status",
      "employment_start_date",
    ],
  },
  {
    key: "projects",
    label: "Projects",
    description: "Project identifiers, names, milestones, and project-management information.",
    fieldKeys: [
      "project_name",
      "project_code",
      "milestone",
    ],
  },
  {
    key: "engineering",
    label: "Engineering",
    description: "Engineering assets, equipment, serialisation, and manufacturer information.",
    fieldKeys: [
      "asset_id",
      "equipment_type",
      "serial_number",
      "manufacturer",
    ],
  },
  {
    key: "aviation",
    label: "Aviation",
    description: "Aviation-specific aircraft, flight, and airport information.",
    fieldKeys: [
      "aircraft_registration",
      "aircraft_type",
      "flight_number",
      "airport_code",
    ],
  },
  {
    key: "healthcare",
    label: "Healthcare",
    description: "Healthcare and patient-related identifiers and case information.",
    fieldKeys: [
      "patient_identifier",
      "case_number",
    ],
  },
  {
    key: "research_scientific",
    label: "Research / Scientific",
    description: "Scientific studies, research identifiers, and researchers.",
    fieldKeys: [
      "study_id",
      "researcher",
    ],
  },
  {
    key: "education",
    label: "Education",
    description: "Educational course and student identifiers.",
    fieldKeys: [
      "course_code",
      "student_identifier",
    ],
  },
  {
    key: "geographic",
    label: "Geographic",
    description: "Locations, countries, cities, and facilities associated with records.",
    fieldKeys: [
      "location",
      "country",
      "city",
      "facility",
    ],
  },
  {
    key: "technical",
    label: "Technical",
    description: "Digital-file, technical, system, language, and integrity information.",
    fieldKeys: [
      "file_name",
      "file_format",
      "file_size",
      "checksum",
      "source_system",
      "language",
      "page_count",
    ],
  },
  {
    key: "media_audiovisual",
    label: "Media / Audiovisual",
    description: "Metadata describing audio, video, photographic, and other audiovisual content.",
    fieldKeys: [
      "media_type",
      "duration",
      "creator",
    ],
  },
  {
    key: "archival",
    label: "Archival",
    description: "Archival arrangement, reference, and descriptive information.",
    fieldKeys: [
      "archival_level",
      "archive_reference",
    ],
  },
  {
    key: "preservation",
    label: "Preservation",
    description: "Digital and physical preservation status and preservation actions.",
    fieldKeys: [
      "preservation_status",
      "preservation_action",
    ],
  },
  {
    key: "workflow_approval",
    label: "Workflow / Approval",
    description: "Workflow state, approval information, and processing status.",
    fieldKeys: [
      "workflow_status",
      "approval_date",
    ],
  },
  {
    key: "relationships",
    label: "Relationships",
    description: "Relationships between records and record versions.",
    fieldKeys: [
      "parent_record",
      "related_record",
      "supersedes_record",
    ],
  },
];

const GROUP_BY_KEY = new Map<string, UniversalMetadataCatalogueGroup>();

for (const group of UNIVERSAL_METADATA_CATALOGUE) {
  for (const fieldKey of group.fieldKeys) {
    GROUP_BY_KEY.set(fieldKey, group);
  }
}

const CATEGORY_GROUP_MAP: Record<string, string> = {
  Identity: "core",
  Dates: "dates_lifecycle",
  People: "persons",
  Organizations: "organizations",
  "Records Management": "records_management",
  Administrative: "core",
  Governance: "content_subject",
  "Subject / Classification": "content_subject",
  "Legal / Regulatory": "legal_regulatory",
  Security: "security",
  Compliance: "legal_regulatory",
  Risk: "security",
  Audit: "records_management",
  Financial: "financial",
  Procurement: "procurement_contracts",
  Contracts: "procurement_contracts",
  "Human Resources": "human_resources",
  Projects: "projects",
  Operations: "core",
  Engineering: "engineering",
  Aviation: "aviation",
  "Medical / Healthcare": "healthcare",
  "Research / Scientific": "research_scientific",
  Education: "education",
  Geographic: "geographic",
  Technical: "technical",
  "Media / Audiovisual": "media_audiovisual",
  Archival: "archival",
  Preservation: "preservation",
  "Workflow / Approval": "workflow_approval",
  Relationships: "relationships",
  Environmental: "geographic",
};

export function getUniversalMetadataGroup(
  fieldKey: string,
  category?: string,
): UniversalMetadataCatalogueGroup {
  const explicit = GROUP_BY_KEY.get(fieldKey);

  if (explicit) {
    return explicit;
  }

  const mappedKey = category
    ? CATEGORY_GROUP_MAP[category]
    : undefined;

  if (mappedKey) {
    return (
      UNIVERSAL_METADATA_CATALOGUE.find(
        (group) => group.key === mappedKey,
      ) ?? UNIVERSAL_METADATA_CATALOGUE[0]
    );
  }

  return UNIVERSAL_METADATA_CATALOGUE[0];
}
