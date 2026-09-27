"use client";

import React, { useMemo, useState } from "react";

import type { FieldDefinition } from "@/hooks/useFieldRegistry";
import {
  UNIVERSAL_METADATA_CATALOGUE,
  type UniversalMetadataCatalogueGroup,
} from "@/lib/metadata/universalMetadataCatalogue";

type UniversalMetadataCatalogueProps = {
  fields: FieldDefinition[];
};

type CatalogueField = FieldDefinition & {
  field_key: string;
  display_name: string;
};

function humanizeFieldKey(fieldKey: string): string {
  const knownLabels: Record<string, string> = {
    reference_code: "Reference Code",
    title: "Title",
    description: "Description",
    record_number: "Record Number",
    file_number: "File Number",
    section: "Section",
    person_id: "Person ID",
    person_name: "Person Name",
    person_role: "Person Role",
    author: "Author",
    recipient: "Recipient",
    approver: "Approver",
    researcher: "Researcher",
    creator: "Creator",
    organization_name: "Organization Name",
    organization_code: "Organization Code",
    department: "Department",
    department_code: "Department Code",
    document_date: "Document Date",
    year: "Year",
    created_date: "Created Date",
    received_date: "Received Date",
    effective_date: "Effective Date",
    expiry_date: "Expiry Date",
    review_date: "Review Date",
    version_number: "Version Number",
    meeting_date: "Meeting Date",
    contract_start_date: "Contract Start Date",
    contract_end_date: "Contract End Date",
    employment_start_date: "Employment Start Date",
    record_series: "Record Series",
    classification_code: "Classification Code",
    retention_period: "Retention Period",
    disposal_action: "Disposal Action",
    disposal_date: "Disposal Date",
    record_status: "Record Status",
    subject: "Subject",
    keywords: "Keywords",
    business_function: "Business Function",
    business_process: "Business Process",
    policy_reference: "Policy Reference",
    meeting_type: "Meeting Type",
    action_item: "Action Item",
    legal_reference: "Legal Reference",
    regulatory_reference: "Regulatory Reference",
    compliance_status: "Compliance Status",
    security_classification: "Security Classification",
    access_restriction: "Access Restriction",
    legal_hold: "Legal Hold",
    amount: "Amount",
    currency: "Currency",
    cost_center: "Cost Center",
    budget_code: "Budget Code",
    invoice_number: "Invoice Number",
    supplier_name: "Supplier Name",
    purchase_order_number: "Purchase Order Number",
    contract_number: "Contract Number",
    contract_type: "Contract Type",
    employee_number: "Employee Number",
    job_title: "Job Title",
    employment_status: "Employment Status",
    project_name: "Project Name",
    project_code: "Project Code",
    milestone: "Milestone",
    asset_id: "Asset ID",
    equipment_type: "Equipment Type",
    serial_number: "Serial Number",
    manufacturer: "Manufacturer",
    aircraft_registration: "Aircraft Registration",
    aircraft_type: "Aircraft Type",
    flight_number: "Flight Number",
    airport_code: "Airport Code",
    patient_identifier: "Patient Identifier",
    case_number: "Case Number",
    study_id: "Study ID",
    course_code: "Course Code",
    student_identifier: "Student Identifier",
    location: "Location",
    country: "Country",
    city: "City",
    facility: "Facility",
    file_name: "File Name",
    file_format: "File Format",
    file_size: "File Size",
    checksum: "Checksum",
    source_system: "Source System",
    language: "Language",
    page_count: "Page Count",
    media_type: "Media Type",
    duration: "Duration",
    archival_level: "Archival Level",
    archive_reference: "Archive Reference",
    preservation_status: "Preservation Status",
    preservation_action: "Preservation Action",
    workflow_status: "Workflow Status",
    approval_date: "Approval Date",
    parent_record: "Parent Record",
    related_record: "Related Record",
    supersedes_record: "Supersedes Record",
    environmental_location: "Environmental Location",
    measurement_type: "Measurement Type",
    measurement_value: "Measurement Value",
  };

  if (knownLabels[fieldKey]) {
    return knownLabels[fieldKey];
  }

  return fieldKey
    .split("_")
    .map((part) => {
      if (part.length <= 3) {
        return part.toUpperCase();
      }

      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function createFallbackField(
  fieldKey: string,
  group: UniversalMetadataCatalogueGroup,
): CatalogueField {
  const now = new Date().toISOString();

  return {
    id: `catalogue-${group.key}-${fieldKey}`,
    field_key: fieldKey,
    display_name: humanizeFieldKey(fieldKey),
    description: `Universal metadata field: ${humanizeFieldKey(fieldKey)}.`,
    category: group.label,
    data_type: "text",
    aliases: [],
    repeatable: false,
    searchable: true,
    filterable: true,
    sortable: true,
    ai_extractable: false,
    user_editable: true,
    sensitive: false,
    validation_rule: {},
    controlled_vocabulary: {},
    unit: null,
    default_value: {},
    organization_id: null,
    is_active: true,
    created_at: now,
    updated_at: now,
  };
}

function formatDefaultValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function UniversalMetadataCatalogue({
  fields,
}: UniversalMetadataCatalogueProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(UNIVERSAL_METADATA_CATALOGUE.map((group) => group.key)),
  );

  const [isOpen, setIsOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");

  const fieldByKey = useMemo(() => {
    const map = new Map<string, FieldDefinition>();

    for (const field of fields) {
      map.set(field.field_key, field);
    }

    return map;
  }, [fields]);

  const groupedFields = useMemo(() => {
    return UNIVERSAL_METADATA_CATALOGUE.map((group) => {
      const groupFields = group.fieldKeys.map((fieldKey) => {
        const existingField = fieldByKey.get(fieldKey);

        if (existingField) {
          return existingField;
        }

        return createFallbackField(fieldKey, group);
      });

      return {
        ...group,
        fields: groupFields,
      };
    });
  }, [fieldByKey]);

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const visibleGroups = groupedFields
    .map((group) => ({
      ...group,
      fields: normalizedSearch
        ? group.fields.filter((field) => {
            const haystack = [
              field.field_key,
              field.display_name,
              field.description ?? "",
              field.category,
              field.data_type,
            ]
              .join(" ")
              .toLowerCase();

            return haystack.includes(normalizedSearch);
          })
        : group.fields,
    }))
    .filter((group) => group.fields.length > 0);

  function toggleGroup(groupKey: string) {
    setExpandedGroups((current) => {
      const next = new Set(current);

      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }

      return next;
    });
  }

  function expandAll() {
    setExpandedGroups(
      new Set(UNIVERSAL_METADATA_CATALOGUE.map((group) => group.key)),
    );
  }

  function collapseAll() {
    setExpandedGroups(new Set());
  }

  const totalCatalogueFields = new Set(
    UNIVERSAL_METADATA_CATALOGUE.flatMap((group) => group.fieldKeys),
  ).size;

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-50"
      >
        <span className="min-w-0">
          <span className="block text-base font-semibold text-slate-900">
            Universal Metadata Catalogue
          </span>

          <span className="mt-1 block text-sm text-slate-500">
            {UNIVERSAL_METADATA_CATALOGUE.length} groups ·{" "}
            {totalCatalogueFields} unique fields
          </span>
        </span>

        <span
          aria-hidden="true"
          className={`shrink-0 text-slate-500 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        >
          ▼
        </span>
      </button>

      {isOpen ? (
        <>
          <div className="border-t border-slate-200 px-5 py-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Universal metadata
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-950">
              Catalogue contents
            </h2>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              Browse the universal metadata field catalogue. Fields are grouped
              by business and records-management context and remain backed by
              the global field registry.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {UNIVERSAL_METADATA_CATALOGUE.length} groups
              </span>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {totalCatalogueFields} unique fields
              </span>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                Universal catalogue
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={expandAll}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Expand All
            </button>

            <button
              type="button"
              onClick={collapseAll}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Collapse All
            </button>
          </div>
        </div>

        <div className="mt-5">
          <label
            htmlFor="universal-metadata-catalogue-search"
            className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500"
          >
            Search catalogue
          </label>

          <input
            id="universal-metadata-catalogue-search"
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by field name, key, description, category, or data type..."
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
        </div>
      </div>

      <div className="divide-y divide-slate-200">
        {visibleGroups.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-medium text-slate-700">
              No metadata fields found.
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Try a different catalogue search term.
            </p>
          </div>
        ) : (
          visibleGroups.map((group) => {
            const expanded = expandedGroups.has(group.key);

            return (
              <div key={group.key}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  className="w-full px-5 py-4 text-left transition hover:bg-slate-50"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
                      {expanded ? "−" : "+"}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900">
                          {group.label}
                        </h3>

                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                          {group.fields.length}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-slate-500">
                        {group.description}
                      </p>
                    </div>
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {group.fields.map((field) => (
                        <div
                          key={`${group.key}-${field.field_key}`}
                          className="rounded-xl border border-slate-200 bg-white p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h4 className="text-sm font-bold text-slate-900">
                                {field.display_name}
                              </h4>

                              <p className="mt-1 break-all font-mono text-[11px] text-slate-400">
                                {field.field_key}
                              </p>
                            </div>

                            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                              {field.data_type}
                            </span>
                          </div>

                          {field.description && (
                            <p className="mt-3 text-xs leading-5 text-slate-500">
                              {field.description}
                            </p>
                          )}

                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {field.ai_extractable && (
                              <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700">
                                AI extractable
                              </span>
                            )}

                            {field.searchable && (
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                                Searchable
                              </span>
                            )}

                            {field.filterable && (
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                                Filterable
                              </span>
                            )}

                            {field.repeatable && (
                              <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">
                                Repeatable
                              </span>
                            )}

                            {field.sensitive && (
                              <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-700">
                                Sensitive
                              </span>
                            )}
                          </div>

                          {field.default_value &&
                            Object.keys(field.default_value).length > 0 && (
                              <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                  Default
                                </p>

                                <p className="mt-1 break-all text-xs text-slate-600">
                                  {formatDefaultValue(field.default_value)}
                                </p>
                              </div>
                            )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">
        <p className="text-xs leading-5 text-slate-500">
          The catalogue is a navigation and governance layer over the universal
          field registry. It does not create separate metadata tables. Actual
          metadata values remain stored through the universal metadata value
          architecture.
        </p>
      </div>
        </>
      ) : null}
    </section>
  );
}

