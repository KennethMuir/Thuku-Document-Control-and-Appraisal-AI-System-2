import type {
  DomainRelationshipDomain,
  DomainRelationshipType,
} from "@/components/metadata/DomainRelationshipSelector";

const CORE_RELATIONSHIPS = [
  "SUBJECT",
  "RECORD",
  "PROCESS",
  "ACTIVITY",
  "TASK",
  "SERVICE",
  "EVENT",
] as const;

const GOVERNANCE_RELATIONSHIPS = [
  "REQUIREMENT",
  "OBLIGATION",
  "AUTHORITY",
  "POLICY",
  "DECISION",
  "APPROVAL",
  "AUTHORIZATION",
] as const;

const COMMERCIAL_RELATIONSHIPS = [
  "AGREEMENT",
  "PARTY",
  "TRANSACTION",
  "PAYMENT",
  "REQUEST",
  "SUBMISSION",
  "NOTICE",
  "AMENDMENT",
  "RENEWAL",
  "TERMINATION",
  "DISPUTE",
] as const;

const OVERSIGHT_RELATIONSHIPS = [
  "ASSESSMENT",
  "REVIEW",
  "INSPECTION",
  "AUDIT",
  "EVIDENCE",
  "FINDING",
  "RECOMMENDATION",
] as const;

const RISK_OPERATIONAL_RELATIONSHIPS = [
  "RISK",
  "CONTROL",
  "INCIDENT",
  "ISSUE",
  "INVESTIGATION",
  "CHANGE",
  "EXCEPTION",
  "DEPENDENCY",
  "FOLLOW_UP",
] as const;

const INFORMATION_RELATIONSHIPS = [
  "REPORT",
  "DATA",
  "ANALYSIS",
  "RESULT",
] as const;

const FINANCIAL_RELATIONSHIPS = [
  "ASSET",
  "RESOURCE",
  "COST",
  "FUNDING",
  "BUDGET",
  "ACCOUNT",
] as const;

const REGULATORY_RELATIONSHIPS = [
  "LICENSE",
  "PERMIT",
  "CERTIFICATION",
  "COMPLIANCE",
] as const;

const RECORDS_LIFECYCLE_RELATIONSHIPS = [
  "CLASSIFICATION",
  "RETENTION",
  "ACCESS",
  "TRANSFER",
  "CUSTODY",
  "PRESERVATION",
  "DISPOSITION",
] as const;

const RELATIONSHIP_GROUPS = {
  core: CORE_RELATIONSHIPS,
  governance: GOVERNANCE_RELATIONSHIPS,
  commercial: COMMERCIAL_RELATIONSHIPS,
  oversight: OVERSIGHT_RELATIONSHIPS,
  riskOperational: RISK_OPERATIONAL_RELATIONSHIPS,
  information: INFORMATION_RELATIONSHIPS,
  financial: FINANCIAL_RELATIONSHIPS,
  regulatory: REGULATORY_RELATIONSHIPS,
  recordsLifecycle: RECORDS_LIFECYCLE_RELATIONSHIPS,
} as const;

type RelationshipName =
  | (typeof CORE_RELATIONSHIPS)[number]
  | (typeof GOVERNANCE_RELATIONSHIPS)[number]
  | (typeof COMMERCIAL_RELATIONSHIPS)[number]
  | (typeof OVERSIGHT_RELATIONSHIPS)[number]
  | (typeof RISK_OPERATIONAL_RELATIONSHIPS)[number]
  | (typeof INFORMATION_RELATIONSHIPS)[number]
  | (typeof FINANCIAL_RELATIONSHIPS)[number]
  | (typeof REGULATORY_RELATIONSHIPS)[number]
  | (typeof RECORDS_LIFECYCLE_RELATIONSHIPS)[number];

const UNIVERSAL = [
  ...CORE_RELATIONSHIPS,
  ...INFORMATION_RELATIONSHIPS,
] as RelationshipName[];

const GOVERNANCE = [
  ...CORE_RELATIONSHIPS,
  ...GOVERNANCE_RELATIONSHIPS,
  ...OVERSIGHT_RELATIONSHIPS,
  ...INFORMATION_RELATIONSHIPS,
  ...RISK_OPERATIONAL_RELATIONSHIPS,
] as RelationshipName[];

const COMMERCIAL = [
  ...CORE_RELATIONSHIPS,
  ...GOVERNANCE_RELATIONSHIPS,
  ...COMMERCIAL_RELATIONSHIPS,
  ...OVERSIGHT_RELATIONSHIPS,
  ...RISK_OPERATIONAL_RELATIONSHIPS,
  ...INFORMATION_RELATIONSHIPS,
] as RelationshipName[];

const FINANCE = [
  ...CORE_RELATIONSHIPS,
  ...GOVERNANCE_RELATIONSHIPS,
  ...COMMERCIAL_RELATIONSHIPS,
  ...OVERSIGHT_RELATIONSHIPS,
  ...RISK_OPERATIONAL_RELATIONSHIPS,
  ...INFORMATION_RELATIONSHIPS,
  ...FINANCIAL_RELATIONSHIPS,
  ...REGULATORY_RELATIONSHIPS,
] as RelationshipName[];

const RECORDS = [
  ...CORE_RELATIONSHIPS,
  "REQUIREMENT",
  "OBLIGATION",
  "AUTHORITY",
  "POLICY",
  "APPROVAL",
  "AUTHORIZATION",
  ...OVERSIGHT_RELATIONSHIPS,
  ...INFORMATION_RELATIONSHIPS,
  ...RECORDS_LIFECYCLE_RELATIONSHIPS,
] as RelationshipName[];

const LEGAL = [
  ...CORE_RELATIONSHIPS,
  ...GOVERNANCE_RELATIONSHIPS,
  ...COMMERCIAL_RELATIONSHIPS,
  ...OVERSIGHT_RELATIONSHIPS,
  ...RISK_OPERATIONAL_RELATIONSHIPS,
  ...INFORMATION_RELATIONSHIPS,
  ...REGULATORY_RELATIONSHIPS,
] as RelationshipName[];

const PROCUREMENT = [
  ...CORE_RELATIONSHIPS,
  ...GOVERNANCE_RELATIONSHIPS,
  ...COMMERCIAL_RELATIONSHIPS,
  "ASSESSMENT",
  "REVIEW",
  "AUDIT",
  "EVIDENCE",
  "FINDING",
  "RECOMMENDATION",
  "RISK",
  "CONTROL",
  "ISSUE",
  "CHANGE",
  "EXCEPTION",
  ...INFORMATION_RELATIONSHIPS,
  "COST",
  "FUNDING",
  "BUDGET",
  "COMPLIANCE",
] as RelationshipName[];

const RISK = [
  ...CORE_RELATIONSHIPS,
  ...GOVERNANCE_RELATIONSHIPS,
  ...OVERSIGHT_RELATIONSHIPS,
  ...RISK_OPERATIONAL_RELATIONSHIPS,
  ...INFORMATION_RELATIONSHIPS,
  ...REGULATORY_RELATIONSHIPS,
] as RelationshipName[];

const AUDIT = [
  ...CORE_RELATIONSHIPS,
  "REQUIREMENT",
  "OBLIGATION",
  "AUTHORITY",
  "POLICY",
  "DECISION",
  "APPROVAL",
  "AUTHORIZATION",
  ...OVERSIGHT_RELATIONSHIPS,
  ...RISK_OPERATIONAL_RELATIONSHIPS,
  ...INFORMATION_RELATIONSHIPS,
  "COMPLIANCE",
  ...RECORDS_LIFECYCLE_RELATIONSHIPS,
] as RelationshipName[];

const SECURITY = [
  ...CORE_RELATIONSHIPS,
  ...GOVERNANCE_RELATIONSHIPS,
  ...OVERSIGHT_RELATIONSHIPS,
  ...RISK_OPERATIONAL_RELATIONSHIPS,
  ...INFORMATION_RELATIONSHIPS,
  "ASSET",
  "RESOURCE",
  "ACCESS",
  "COMPLIANCE",
] as RelationshipName[];

const IT = [
  ...CORE_RELATIONSHIPS,
  "REQUIREMENT",
  "OBLIGATION",
  "AUTHORITY",
  "POLICY",
  "DECISION",
  "APPROVAL",
  "AUTHORIZATION",
  "AGREEMENT",
  "PARTY",
  "REQUEST",
  "SUBMISSION",
  "NOTICE",
  ...OVERSIGHT_RELATIONSHIPS,
  ...RISK_OPERATIONAL_RELATIONSHIPS,
  ...INFORMATION_RELATIONSHIPS,
  "ASSET",
  "RESOURCE",
  "COST",
  "BUDGET",
  "ACCOUNT",
  "LICENSE",
  "CERTIFICATION",
  "COMPLIANCE",
] as RelationshipName[];

const HR = [
  ...CORE_RELATIONSHIPS,
  ...GOVERNANCE_RELATIONSHIPS,
  "AGREEMENT",
  "PARTY",
  "REQUEST",
  "SUBMISSION",
  "NOTICE",
  "AMENDMENT",
  "RENEWAL",
  "TERMINATION",
  "DISPUTE",
  ...OVERSIGHT_RELATIONSHIPS,
  ...RISK_OPERATIONAL_RELATIONSHIPS,
  ...INFORMATION_RELATIONSHIPS,
  "COST",
  "FUNDING",
  "BUDGET",
  "ACCOUNT",
  "CERTIFICATION",
  "COMPLIANCE",
  ...RECORDS_LIFECYCLE_RELATIONSHIPS,
] as RelationshipName[];

const TRAINING = [
  ...CORE_RELATIONSHIPS,
  "REQUIREMENT",
  "OBLIGATION",
  "AUTHORITY",
  "POLICY",
  "APPROVAL",
  "AUTHORIZATION",
  "AGREEMENT",
  "PARTY",
  "REQUEST",
  "SUBMISSION",
  "NOTICE",
  ...OVERSIGHT_RELATIONSHIPS,
  "RISK",
  "CONTROL",
  "ISSUE",
  "CHANGE",
  "EXCEPTION",
  "FOLLOW_UP",
  ...INFORMATION_RELATIONSHIPS,
  "RESOURCE",
  "COST",
  "FUNDING",
  "BUDGET",
  "CERTIFICATION",
  "COMPLIANCE",
] as RelationshipName[];

const PROJECT_MANAGEMENT = [
  ...CORE_RELATIONSHIPS,
  ...GOVERNANCE_RELATIONSHIPS,
  ...COMMERCIAL_RELATIONSHIPS,
  ...OVERSIGHT_RELATIONSHIPS,
  ...RISK_OPERATIONAL_RELATIONSHIPS,
  ...INFORMATION_RELATIONSHIPS,
  ...FINANCIAL_RELATIONSHIPS,
] as RelationshipName[];

const QUALITY = [
  ...CORE_RELATIONSHIPS,
  ...GOVERNANCE_RELATIONSHIPS,
  ...OVERSIGHT_RELATIONSHIPS,
  ...RISK_OPERATIONAL_RELATIONSHIPS,
  ...INFORMATION_RELATIONSHIPS,
  "COMPLIANCE",
  ...RECORDS_LIFECYCLE_RELATIONSHIPS,
] as RelationshipName[];

const REGULATORY = [
  ...CORE_RELATIONSHIPS,
  ...GOVERNANCE_RELATIONSHIPS,
  ...OVERSIGHT_RELATIONSHIPS,
  ...INFORMATION_RELATIONSHIPS,
  ...REGULATORY_RELATIONSHIPS,
  "RISK",
  "CONTROL",
  "INCIDENT",
  "ISSUE",
  "INVESTIGATION",
  "CHANGE",
  "EXCEPTION",
] as RelationshipName[];

const DOMAIN_RELATIONSHIP_GROUPS: Record<
  string,
  readonly RelationshipName[]
> = {
  "GENERAL_ADMINISTRATIVE": UNIVERSAL,
  "RECORDS_MANAGEMENT": RECORDS,
  "GOVERNANCE": GOVERNANCE,
  "COMPLIANCE": [
    ...GOVERNANCE,
    ...OVERSIGHT_RELATIONSHIPS,
    ...RISK_OPERATIONAL_RELATIONSHIPS,
    ...INFORMATION_RELATIONSHIPS,
    ...REGULATORY_RELATIONSHIPS,
    ...RECORDS_LIFECYCLE_RELATIONSHIPS,
  ],
  "RISK": RISK,
  "RISK_MANAGEMENT": RISK,
  "AUDIT": AUDIT,
  "SECURITY": SECURITY,
  "IT": IT,
  "FINANCE": FINANCE,
  "FINANCE_COMMERCIAL": FINANCE,
  "TREASURY_CASH_MANAGEMENT": FINANCE,
  "PROCUREMENT": PROCUREMENT,
  "CONTRACTS": COMMERCIAL,
  "CONTRACTS_AGREEMENTS": COMMERCIAL,
  "HR": HR,
  "TRAINING": TRAINING,
  "TRAINING_DEVELOPMENT": TRAINING,
  "LEGAL": LEGAL,
  "REGULATORY": REGULATORY,
  "POLICY": GOVERNANCE,
  "QA_QC": QUALITY,
  "QUALITY_MANAGEMENT": QUALITY,
  "ENGINEERING": PROJECT_MANAGEMENT,
  "MAINTENANCE": [
    ...CORE_RELATIONSHIPS,
    "REQUIREMENT",
    "OBLIGATION",
    "AUTHORITY",
    "POLICY",
    "APPROVAL",
    "AUTHORIZATION",
    ...OVERSIGHT_RELATIONSHIPS,
    ...RISK_OPERATIONAL_RELATIONSHIPS,
    ...INFORMATION_RELATIONSHIPS,
    "ASSET",
    "RESOURCE",
    "COST",
    "BUDGET",
    "ACCOUNT",
    "LICENSE",
    "CERTIFICATION",
    "COMPLIANCE",
  ],
  "AVIATION": [
    ...CORE_RELATIONSHIPS,
    ...GOVERNANCE_RELATIONSHIPS,
    ...OVERSIGHT_RELATIONSHIPS,
    ...RISK_OPERATIONAL_RELATIONSHIPS,
    ...INFORMATION_RELATIONSHIPS,
    ...REGULATORY_RELATIONSHIPS,
    "ASSET",
    "RESOURCE",
    "COST",
    "FUNDING",
    "BUDGET",
    "COMPLIANCE",
    ...RECORDS_LIFECYCLE_RELATIONSHIPS,
  ],
  "HEALTHCARE": [
    ...CORE_RELATIONSHIPS,
    ...GOVERNANCE_RELATIONSHIPS,
    ...OVERSIGHT_RELATIONSHIPS,
    ...RISK_OPERATIONAL_RELATIONSHIPS,
    ...INFORMATION_RELATIONSHIPS,
    ...REGULATORY_RELATIONSHIPS,
    ...RECORDS_LIFECYCLE_RELATIONSHIPS,
  ],
  "RESEARCH_SCIENTIFIC": [
    ...CORE_RELATIONSHIPS,
    ...GOVERNANCE_RELATIONSHIPS,
    ...OVERSIGHT_RELATIONSHIPS,
    ...RISK_OPERATIONAL_RELATIONSHIPS,
    ...INFORMATION_RELATIONSHIPS,
    "ASSET",
    "RESOURCE",
    "COST",
    "FUNDING",
    "BUDGET",
    "LICENSE",
    "PERMIT",
    "CERTIFICATION",
    "COMPLIANCE",
    ...RECORDS_LIFECYCLE_RELATIONSHIPS,
  ],
  "EDUCATION": [
    ...CORE_RELATIONSHIPS,
    ...GOVERNANCE_RELATIONSHIPS,
    ...OVERSIGHT_RELATIONSHIPS,
    ...RISK_OPERATIONAL_RELATIONSHIPS,
    ...INFORMATION_RELATIONSHIPS,
    "ASSET",
    "RESOURCE",
    "COST",
    "FUNDING",
    "BUDGET",
    "LICENSE",
    "CERTIFICATION",
    "COMPLIANCE",
    ...RECORDS_LIFECYCLE_RELATIONSHIPS,
  ],
  "ENVIRONMENTAL": [
    ...CORE_RELATIONSHIPS,
    ...GOVERNANCE_RELATIONSHIPS,
    ...OVERSIGHT_RELATIONSHIPS,
    ...RISK_OPERATIONAL_RELATIONSHIPS,
    ...INFORMATION_RELATIONSHIPS,
    "ASSET",
    "RESOURCE",
    "COST",
    "FUNDING",
    "BUDGET",
    "LICENSE",
    "PERMIT",
    "CERTIFICATION",
    "COMPLIANCE",
    ...RECORDS_LIFECYCLE_RELATIONSHIPS,
  ],
  "PROJECT_MANAGEMENT": PROJECT_MANAGEMENT,
  "BUSINESS_OPERATIONS": [
    ...CORE_RELATIONSHIPS,
    ...GOVERNANCE_RELATIONSHIPS,
    ...COMMERCIAL_RELATIONSHIPS,
    ...OVERSIGHT_RELATIONSHIPS,
    ...RISK_OPERATIONAL_RELATIONSHIPS,
    ...INFORMATION_RELATIONSHIPS,
    ...FINANCIAL_RELATIONSHIPS,
  ],
};

function normalizeKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/&/g, "_AND_")
    .replace(/[\/-]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "")
    .replace(/_+/g, "_");
}

function resolveRelationshipGroup(
  domain: DomainRelationshipDomain
): readonly RelationshipName[] {
  const candidates = [
    normalizeKey(domain.domain_key),
    normalizeKey(domain.display_name),
    normalizeKey(domain.domain_family),
  ];

  for (const candidate of candidates) {
    if (DOMAIN_RELATIONSHIP_GROUPS[candidate]) {
      return DOMAIN_RELATIONSHIP_GROUPS[candidate];
    }
  }

  if (
    candidates.some(
      (candidate) =>
        candidate.includes("RECORD") ||
        candidate.includes("ARCHIVE")
    )
  ) {
    return RECORDS;
  }

  if (
    candidates.some(
      (candidate) =>
        candidate.includes("CONTRACT") ||
        candidate.includes("AGREEMENT")
    )
  ) {
    return COMMERCIAL;
  }

  if (
    candidates.some(
      (candidate) =>
        candidate.includes("TREASURY") ||
        candidate.includes("FINANCE") ||
        candidate.includes("CASH")
    )
  ) {
    return FINANCE;
  }

  if (
    candidates.some(
      (candidate) =>
        candidate.includes("LEGAL")
    )
  ) {
    return LEGAL;
  }

  if (
    candidates.some(
      (candidate) =>
        candidate.includes("PROCUREMENT")
    )
  ) {
    return PROCUREMENT;
  }

  if (
    candidates.some(
      (candidate) =>
        candidate.includes("AUDIT")
    )
  ) {
    return AUDIT;
  }

  if (
    candidates.some(
      (candidate) =>
        candidate.includes("RISK")
    )
  ) {
    return RISK;
  }

  if (
    candidates.some(
      (candidate) =>
        candidate.includes("REGULAT") ||
        candidate.includes("COMPLIANCE")
    )
  ) {
    return REGULATORY;
  }

  return UNIVERSAL;
}

export function getApplicableRelationshipTypes(
  domain: DomainRelationshipDomain,
  relationshipTypes: DomainRelationshipType[]
): DomainRelationshipType[] {
  const applicable = new Set(
    resolveRelationshipGroup(domain)
  );

  return relationshipTypes.filter((relationshipType) =>
    applicable.has(
      relationshipType.value as RelationshipName
    )
  );
}

export function isRelationshipApplicableToDomain(
  domain: DomainRelationshipDomain,
  relationshipType: string
): boolean {
  return new Set(
    resolveRelationshipGroup(domain)
  ).has(
    relationshipType as RelationshipName
  );
}

export { RELATIONSHIP_GROUPS };
