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
    description: "Core identification and descriptive metadata.",
    fieldKeys: [
      "reference_code",
      "title",
      "description",
      "record_number",
      "file_number",
      "section",
      "document_type",
    ],
  },
  {
    key: "persons",
    label: "Persons",
    description: "People associated with the record.",
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
    description: "Organizations, departments and organizational identifiers.",
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
    description: "Dates, lifecycle events and version information.",
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
    description: "Records control, classification, retention and disposition.",
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
    description: "Subject, business context and content-related metadata.",
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
    description: "Legal references, regulatory references and compliance.",
    fieldKeys: [
      "legal_reference",
      "regulatory_reference",
      "compliance_status",
    ],
  },
  {
    key: "security",
    label: "Security",
    description: "Security classification, access and risk information.",
    fieldKeys: [
      "security_classification",
      "access_restriction",
      "legal_hold",
      "risk_level",
    ],
  },
  {
    key: "financial",
    label: "Financial",
    description: "Financial amounts, currencies and accounting references.",
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
    description: "Suppliers, purchasing and contract information.",
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
    description: "Employee and employment metadata.",
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
    description: "Project and milestone information.",
    fieldKeys: [
      "project_name",
      "project_code",
      "milestone",
    ],
  },
  {
    key: "engineering",
    label: "Engineering",
    description: "Engineering assets and equipment metadata.",
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
    description: "Aircraft, flight and airport metadata.",
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
    description: "Healthcare and case identifiers.",
    fieldKeys: [
      "patient_identifier",
      "case_number",
    ],
  },
  {
    key: "research_scientific",
    label: "Research / Scientific",
    description: "Scientific research and study metadata.",
    fieldKeys: [
      "study_id",
      "researcher",
    ],
  },
  {
    key: "education",
    label: "Education",
    description: "Education and student metadata.",
    fieldKeys: [
      "course_code",
      "student_identifier",
    ],
  },
  {
    key: "geographic",
    label: "Geographic",
    description: "Location and environmental measurement metadata.",
    fieldKeys: [
      "location",
      "country",
      "city",
      "facility",
      "environmental_location",
      "measurement_type",
      "measurement_value",
    ],
  },
  {
    key: "technical",
    label: "Technical",
    description: "Digital file and technical metadata.",
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
    description: "Audiovisual and media metadata.",
    fieldKeys: [
      "media_type",
      "duration",
      "creator",
    ],
  },
  {
    key: "archival",
    label: "Archival",
    description: "Archival description and reference metadata.",
    fieldKeys: [
      "archival_level",
      "archive_reference",
    ],
  },
  {
    key: "preservation",
    label: "Preservation",
    description: "Digital and physical preservation metadata.",
    fieldKeys: [
      "preservation_status",
      "preservation_action",
    ],
  },
  {
    key: "workflow_approval",
    label: "Workflow / Approval",
    description: "Workflow state and approval metadata.",
    fieldKeys: [
      "workflow_status",
      "approval_date",
    ],
  },
  {
    key: "relationships",
    label: "Relationships",
    description: "Relationships between records.",
    fieldKeys: [
      "parent_record",
      "related_record",
      "supersedes_record",
    ],
  },
];

const FIELD_TO_GROUP = new Map<string, string>();

for (const group of UNIVERSAL_METADATA_CATALOGUE) {
  for (const fieldKey of group.fieldKeys) {
    if (!FIELD_TO_GROUP.has(fieldKey)) {
      FIELD_TO_GROUP.set(fieldKey, group.key);
    }
  }
}

export function getUniversalMetadataGroup(
  fieldKey: string,
  category?: string | null
): string {
  const directGroup = FIELD_TO_GROUP.get(fieldKey);

  if (directGroup) {
    return directGroup;
  }

  const categoryMap: Record<string, string> = {
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

  return categoryMap[category ?? ""] ?? "core";
}

export function resolveUniversalMetadataGroup(
  fieldKey: string,
  category?: string | null
): string {
  return getUniversalMetadataGroup(fieldKey, category);
}

export function getUniversalMetadataCatalogueFieldCount(): number {
  return new Set(
    UNIVERSAL_METADATA_CATALOGUE.flatMap(
      (group) => group.fieldKeys
    )
  ).size;
}
