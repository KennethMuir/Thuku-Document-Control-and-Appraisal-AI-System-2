"use client";

import { Appraisal } from "@/components/appraisal/Appraisal";
import { DomainRelationshipSelector } from "@/components/metadata/DomainRelationshipSelector";

import type {
  DomainRelationshipDomain,
  DomainRelationshipSelection,
  DomainRelationshipType,
} from "@/components/metadata/DomainRelationshipSelector";

import type {
  ChangeEvent,
  Dispatch,
  FormEvent,
  ReactElement,
  RefObject,
  SetStateAction,
} from "react";

import type { UploadedAppraisal } from "@/types/appraisal";
import type {
  Department,
  DocumentType,
} from "@/types/departments";
import type { UploadedDocument } from "@/types/documents";
import type {
  AdditionalMetadataField,
  MetadataRecord,
} from "@/types/metadata";

type FormState = {
  referenceCode: string;
  personName: string;
  title: string;
  departmentId: string;
  documentTypeId: string;
  year: string;
  documentDate: string;
  section: string;
  description: string;
  additionalMetadata: AdditionalMetadataField[];
};

type DepartmentForm = {
  name: string;
  code: string;
  description: string;
};

type AppraisalMetadataForm = {
  referenceCode: string;
  title: string;
  documentDate: string;
  year: string;
  personName: string;
  departmentId: string;
  documentTypeId: string;
  section: string;
  description: string;
};

type BulkMetadataPreview = {
  totalRows: number;
  rows: Array<Record<string, unknown>>;
  existingReferenceCodes: string[];
  canImport: boolean;
  truncated: boolean;
};

type ModalsProps = {
  canManageDepartments: boolean;
  canManageMetadata: boolean;
  canManageDocuments: boolean;

  domainRelationshipDomains: DomainRelationshipDomain[];
  domainRelationshipTypes: DomainRelationshipType[];
  metadataDomainRelationships: DomainRelationshipSelection[];
  appraisalDomainRelationships: DomainRelationshipSelection[];
  domainRelationshipsLoading: boolean;
  domainRelationshipsError: string;
  setMetadataDomainRelationships: Dispatch<
    SetStateAction<DomainRelationshipSelection[]>
  >;
  setAppraisalDomainRelationships: Dispatch<
    SetStateAction<DomainRelationshipSelection[]>
  >;

  departmentModalOpen: boolean;
  departmentEditingId: number | null;
  departmentForm: DepartmentForm;
  departmentMutationError: string;
  departmentSaving: boolean;
  departments: Department[];

  setDepartmentForm: Dispatch<
    SetStateAction<DepartmentForm>
  >;
  setDepartmentModalOpen: Dispatch<
    SetStateAction<boolean>
  >;
  setDepartmentMutationError: Dispatch<
    SetStateAction<string>
  >;
  setDepartmentSaving: Dispatch<
    SetStateAction<boolean>
  >;

  closeDepartmentModal: () => void;
  saveDepartment: () => Promise<void>;
  deleteDepartment: (
    department: Department
  ) => Promise<boolean>;

  showBulkMetadataModal: boolean;
  bulkMetadataFile: File | null;
  bulkMetadataPreview: BulkMetadataPreview | null;
  bulkMetadataError: string;
  bulkMetadataLoading: boolean;
  bulkMetadataImporting: boolean;

  setBulkMetadataFile: Dispatch<
    SetStateAction<File | null>
  >;
  setBulkMetadataPreview: Dispatch<
    SetStateAction<BulkMetadataPreview | null>
  >;
  setBulkMetadataError: Dispatch<
    SetStateAction<string>
  >;

  closeBulkMetadataModal: () => void;
  handleBulkMetadataPreview: () => Promise<void>;
  handleBulkMetadataImport: () => Promise<void>;
  downloadBulkMetadataTemplate: () => void;

  showMetadataModal: boolean;
  form: FormState;
  documentTypes: DocumentType[];

  setForm: Dispatch<
    SetStateAction<FormState>
  >;
  closeMetadataModal: () => void;
  handleMetadataSubmit: (
    event: FormEvent<HTMLFormElement>
  ) => Promise<void>;

  showUploadModal: boolean;
  selectedFile: File | null;
  uploading: boolean;
  uploadError: string;
  uploadedDocument: UploadedDocument | null;
  uploadedAppraisal: UploadedAppraisal | null;
  isCreatingNewMetadata: boolean;

  uploadFieldEntries: [string, unknown][];

  appraisalMetadataForm: AppraisalMetadataForm;
  appraisalAdditionalMetadata: AdditionalMetadataField[];
  appraisalCommittedAdditionalMetadata: AdditionalMetadataField[];
  appraisalRequiredFieldsComplete: boolean;
  appraisalDecisionLabel: string;
  appraisalIsLinked: boolean;
  matchedMetadata: MetadataRecord | null;
  reviewingDecision: boolean;
  reviewError: string;

  setAppraisalMetadataForm: Dispatch<
    SetStateAction<AppraisalMetadataForm>
  >;
  setAppraisalAdditionalMetadata: Dispatch<
    SetStateAction<AdditionalMetadataField[]>
  >;
  setAppraisalCommittedAdditionalMetadata: Dispatch<
    SetStateAction<AdditionalMetadataField[]>
  >;

  handleFileChange: (
    event: ChangeEvent<HTMLInputElement>
  ) => void;

  handleUpload: (
    event: FormEvent<HTMLFormElement>
  ) => Promise<void>;

  handleAppraisalReview: (
    decision: "APPROVE" | "REJECT"
  ) => Promise<void>;
  handleCreateMetadataFromAppraisal: () => Promise<void>;
  handleDoneAppraisal: () => Promise<void>;

  closeUploadModal: () => void;

  modalRef: RefObject<HTMLDivElement | null>;
  modalCloseButtonRef: RefObject<HTMLButtonElement | null>;

  StatusBadge: (props: {
    status: string;
  }) => ReactElement;

  FormField: (props: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    type?: string;
    required?: boolean;
  }) => ReactElement;

  formatFileSize: (
    bytes: number | null | undefined
  ) => string;

  formatUploadFieldLabel: (
    key: string
  ) => string;

  formatUploadFieldValue: (
    key: string,
    value: unknown
  ) => string;
};

export function Modals({
  canManageDepartments,
  canManageMetadata,
  canManageDocuments,

  domainRelationshipDomains,
  domainRelationshipTypes,
  metadataDomainRelationships,
  domainRelationshipsLoading,
  domainRelationshipsError,
  setMetadataDomainRelationships,

  departmentModalOpen,
  departmentEditingId,
  departmentForm,
  departmentMutationError,
  departmentSaving,
  departments,

  setDepartmentForm,
  setDepartmentModalOpen,
  setDepartmentMutationError,
  setDepartmentSaving,

  closeDepartmentModal,
  saveDepartment,
  deleteDepartment,

  showBulkMetadataModal,
  bulkMetadataFile,
  bulkMetadataPreview,
  bulkMetadataError,
  bulkMetadataLoading,
  bulkMetadataImporting,

  setBulkMetadataFile,
  setBulkMetadataPreview,
  setBulkMetadataError,

  closeBulkMetadataModal,
  handleBulkMetadataPreview,
  handleBulkMetadataImport,
  downloadBulkMetadataTemplate,

  showMetadataModal,
  form,
  documentTypes,

  setForm,
  closeMetadataModal,
  handleMetadataSubmit,

  showUploadModal,
  selectedFile,
  uploading,
  uploadError,
  uploadedDocument,
  uploadedAppraisal,
  isCreatingNewMetadata,

  uploadFieldEntries,

  appraisalMetadataForm,
  appraisalAdditionalMetadata,
  appraisalCommittedAdditionalMetadata,
  appraisalRequiredFieldsComplete,
  appraisalDecisionLabel,
  appraisalIsLinked,
  matchedMetadata,
  reviewingDecision,
  reviewError,

  setAppraisalMetadataForm,
  setAppraisalAdditionalMetadata,
  setAppraisalCommittedAdditionalMetadata,

  handleFileChange,
  handleUpload,
  handleAppraisalReview,
  handleCreateMetadataFromAppraisal,
  handleDoneAppraisal,
  closeUploadModal,

  modalRef,
  modalCloseButtonRef,

  StatusBadge,
  FormField,
  formatFileSize,
  formatUploadFieldLabel,
  formatUploadFieldValue,
}: ModalsProps) {
  return (
    <>
      {departmentModalOpen && canManageDepartments && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="department-modal-title"
            aria-describedby="department-modal-description"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl outline-none"
          >
            <div className="border-b border-slate-200 px-6 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Organizational structure
                  </p>

                  <h2
                    id="department-modal-title"
                    className="mt-1 text-xl font-bold"
                  >
                    {departmentEditingId === null
                      ? "Add Department"
                      : "Edit Department"}
                  </h2>

                  <p
                    id="department-modal-description"
                    className="mt-1 text-sm text-slate-500"
                  >
                    {departmentEditingId === null
                      ? "Create a department for organizing institutional records."
                      : "Update the department information used to classify institutional records."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeDepartmentModal}
                  disabled={departmentSaving}
                  aria-label="Close department dialog"
                  className="ml-4 rounded-lg p-2 text-2xl leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
            </div>

            <div className="space-y-5 p-6">
              <FormField
                id="department-name"
                label="Department Name *"
                value={departmentForm.name}
                onChange={(value) =>
                  setDepartmentForm({
                    ...departmentForm,
                    name: value,
                  })
                }
                placeholder="Administration"
                required
              />

              <FormField
                id="department-code"
                label="Department Code *"
                value={departmentForm.code}
                onChange={(value) =>
                  setDepartmentForm({
                    ...departmentForm,
                    code: value,
                  })
                }
                placeholder="AD"
                required
              />

              <div>
                <label
                  htmlFor="department-description"
                  className="mb-2 block text-sm font-semibold"
                >
                  Description
                </label>

                <textarea
                  id="department-description"
                  value={departmentForm.description}
                  onChange={(event) =>
                    setDepartmentForm({
                      ...departmentForm,
                      description: event.target.value,
                    })
                  }
                  placeholder="Administrative records"
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              {departmentMutationError && (
                <p
                  role="alert"
                  className="text-sm font-medium text-red-600"
                >
                  {departmentMutationError}
                </p>
              )}

              <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-5">
                {departmentEditingId !== null ? (
                  <button
                    type="button"
                    onClick={async () => {
                      const department =
                        departments.find(
                          (item) =>
                            item.id ===
                            departmentEditingId
                        );

                      if (!department || departmentSaving) {
                        return;
                      }

                      setDepartmentSaving(true);

                      try {
                        const deleted =
                          await deleteDepartment(
                            department
                          );

                        if (deleted) {
                          setDepartmentModalOpen(false);
                          setDepartmentMutationError("");
                        }
                      } finally {
                        setDepartmentSaving(false);
                      }
                    }}
                    disabled={departmentSaving}
                    className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Delete Department
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={closeDepartmentModal}
                    disabled={departmentSaving}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={() => void saveDepartment()}
                    disabled={departmentSaving}
                    className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {departmentSaving
                      ? "Saving..."
                      : departmentEditingId === null
                        ? "Add Department"
                        : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBulkMetadataModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
        >
          <div
            className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-metadata-title"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Metadata Registry
                </p>

                <h2
                  id="bulk-metadata-title"
                  className="mt-1 text-xl font-bold text-slate-900"
                >
                  Bulk Upload Metadata
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Upload CSV or XLSX metadata, review validation, then confirm the import.
                </p>
              </div>

              <button
                type="button"
                onClick={closeBulkMetadataModal}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={downloadBulkMetadataTemplate}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Download Template
                </button>

                <label className="cursor-pointer rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
                  Choose CSV / XLSX

                  <input
                    type="file"
                    accept=".csv,.xlsx"
                    className="hidden"
                    onChange={(event) => {
                      const file =
                        event.target.files?.[0] ??
                        null;

                      setBulkMetadataFile(file);
                      setBulkMetadataPreview(null);
                      setBulkMetadataError("");
                    }}
                  />
                </label>

                {bulkMetadataFile && (
                  <span className="text-sm text-slate-600">
                    {bulkMetadataFile.name}
                  </span>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-800">
                  Required column
                </p>

                <p className="mt-1">
                  reference_code
                </p>

                <p className="mt-2 font-semibold text-slate-800">
                  Optional columns
                </p>

                <p className="mt-1">
                  person_name, title, department, document_type, year, document_date, section, description
                </p>

                <p className="mt-2">
                  Any other columns are preserved as additional metadata.
                </p>
              </div>

              {bulkMetadataError && (
                <div className="whitespace-pre-wrap rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {bulkMetadataError}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeBulkMetadataModal}
                  disabled={
                    bulkMetadataLoading ||
                    bulkMetadataImporting
                  }
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleBulkMetadataPreview}
                  disabled={
                    !bulkMetadataFile ||
                    bulkMetadataLoading ||
                    bulkMetadataImporting
                  }
                  className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {bulkMetadataLoading
                    ? "Validating..."
                    : "Preview Upload"}
                </button>
              </div>

              {bulkMetadataPreview && (
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                    <p className="font-semibold text-slate-900">
                      Preview: {bulkMetadataPreview.totalRows} row(s)
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {bulkMetadataPreview.truncated
                        ? "Showing the first 100 rows."
                        : "All rows are shown."}
                    </p>

                    {bulkMetadataPreview.existingReferenceCodes.length >
                      0 && (
                      <p className="mt-2 text-sm font-semibold text-red-600">
                        Existing references:{" "}
                        {bulkMetadataPreview.existingReferenceCodes.join(
                          ", "
                        )}
                      </p>
                    )}
                  </div>

                  <div className="max-h-80 overflow-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="sticky top-0 bg-white shadow-sm">
                        <tr className="border-b border-slate-200">
                          <th className="px-4 py-3 font-semibold text-slate-700">
                            Row
                          </th>
                          <th className="px-4 py-3 font-semibold text-slate-700">
                            Reference
                          </th>
                          <th className="px-4 py-3 font-semibold text-slate-700">
                            Title
                          </th>
                          <th className="px-4 py-3 font-semibold text-slate-700">
                            Person
                          </th>
                          <th className="px-4 py-3 font-semibold text-slate-700">
                            Year
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {bulkMetadataPreview.rows.map(
                          (row, index) => (
                            <tr
                              key={`${String(
                                row.referenceCode ??
                                  "row"
                              )}-${index}`}
                              className="border-b border-slate-100"
                            >
                              <td className="px-4 py-3 text-slate-500">
                                {String(
                                  row.rowNumber ??
                                    index + 1
                                )}
                              </td>

                              <td className="px-4 py-3 font-medium text-slate-900">
                                {String(
                                  row.referenceCode ??
                                    ""
                                )}
                              </td>

                              <td className="px-4 py-3 text-slate-700">
                                {String(
                                  row.title ?? ""
                                )}
                              </td>

                              <td className="px-4 py-3 text-slate-700">
                                {String(
                                  row.personName ??
                                    ""
                                )}
                              </td>

                              <td className="px-4 py-3 text-slate-700">
                                {String(
                                  row.year ?? ""
                                )}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-4">
                    <button
                      type="button"
                      onClick={handleBulkMetadataImport}
                      disabled={
                        !bulkMetadataPreview.canImport ||
                        bulkMetadataImporting
                      }
                      className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {bulkMetadataImporting
                        ? "Importing..."
                        : "Confirm Import"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showMetadataModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="metadata-modal-title"
            aria-describedby="metadata-modal-description"
            tabIndex={-1}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl outline-none"
          >
            <div className="border-b border-slate-200 px-6 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Metadata registry
                  </p>

                  <h2
                    id="metadata-modal-title"
                    className="mt-1 text-xl font-bold"
                  >
                    Register Metadata
                  </h2>

                  <p
                    id="metadata-modal-description"
                    className="mt-1 text-sm text-slate-500"
                  >
                    Create an expected record before the physical document
                    arrives.
                  </p>
                </div>

                <button
                  ref={modalCloseButtonRef}
                  type="button"
                  onClick={closeMetadataModal}
                  aria-label="Close metadata registration dialog"
                  className="ml-4 rounded-lg p-2 text-2xl leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                >
                  <span aria-hidden="true">
                    ×
                  </span>
                </button>
              </div>
            </div>

            <form
              onSubmit={handleMetadataSubmit}
              className="space-y-5 p-6"
            >
              <div className="grid gap-5 md:grid-cols-2">
                <FormField
                  id="metadata-reference-code"
                  label="Reference Code *"
                  value={form.referenceCode}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      referenceCode: value,
                    })
                  }
                  placeholder="HR-002"
                  required
                />

                <FormField
                  id="metadata-person-name"
                  label="Person Name"
                  value={form.personName}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      personName: value,
                    })
                  }
                  placeholder="Ian Mwangi"
                />
              </div>

              <FormField
                id="metadata-title"
                label="Document Title"
                value={form.title}
                onChange={(value) =>
                  setForm({
                    ...form,
                    title: value,
                  })
                }
                placeholder="Director Profile"
              />

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="metadata-department"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Department
                  </label>

                  <select
                    id="metadata-department"
                    value={form.departmentId}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        departmentId:
                          event.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  >
                    <option value="">
                      Select department
                    </option>

                    {departments.map(
                      (department) => (
                        <option
                          key={department.id}
                          value={department.id}
                        >
                          {department.name}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="metadata-document-type"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Document Type
                  </label>

                  <select
                    id="metadata-document-type"
                    value={form.documentTypeId}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        documentTypeId:
                          event.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  >
                    <option value="">
                      Select type
                    </option>

                    {documentTypes.map(
                      (type) => (
                        <option
                          key={type.id}
                          value={type.id}
                        >
                          {type.name}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <FormField
                  id="metadata-year"
                  label="Document Year"
                  type="number"
                  value={form.year}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      year: value,
                    })
                  }
                  placeholder="2025"
                />

                <div>
                  <label
                    htmlFor="metadata-document-date"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Document Date
                  </label>

                  <input
                    id="metadata-document-date"
                    type="date"
                    value={form.documentDate}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        documentDate:
                          event.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                </div>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">
                    Section
                  </span>

                  <input
                    type="text"
                    value={form.section}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        section:
                          event.target.value,
                      }))
                    }
                    placeholder="e.g. Operations, Finance, Procurement"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                </label>
              </div>

              <div>
                <label
                  htmlFor="metadata-description"
                  className="mb-2 block text-sm font-semibold"
                >
                  Description
                </label>

                <textarea
                  id="metadata-description"
                  rows={4}
                  value={form.description}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      description:
                        event.target.value,
                    })
                  }
                  placeholder="Additional record information..."
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <DomainRelationshipSelector
                domains={domainRelationshipDomains}
                relationshipTypes={domainRelationshipTypes}
                selected={metadataDomainRelationships}
                onChange={
                  setMetadataDomainRelationships
                }
                disabled={
                  !canManageMetadata ||
                  domainRelationshipsLoading
                }
                title="Domain Relationships"
                description="Associate this metadata record with one or more domains and define the relationship context."
              />

              {domainRelationshipsError ? (
                <p
                  role="alert"
                  className="text-sm font-medium text-red-600"
                >
                  {domainRelationshipsError}
                </p>
              ) : null}

              <div
                id="manual-additional-metadata"
                className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Additional Metadata
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      Add document-specific fields that are not part of the standard metadata.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        additionalMetadata: [
                          ...current.additionalMetadata,
                          {
                            key: "",
                            value: "",
                          },
                        ],
                      }))
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                  >
                    + Add Field
                  </button>
                </div>

                {form.additionalMetadata.length >
                  0 && (
                  <div className="mt-4 space-y-3">
                    {form.additionalMetadata.map(
                      (
                        field: AdditionalMetadataField,
                        index: number
                      ) => (
                        <div
                          key={`${index}-${field.key}`}
                          className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"
                        >
                          <input
                            type="text"
                            value={field.key}
                            onChange={(event) =>
                              setForm(
                                (current) => ({
                                  ...current,
                                  additionalMetadata:
                                    current.additionalMetadata.map(
                                      (
                                        item: AdditionalMetadataField,
                                        itemIndex: number
                                      ) =>
                                        itemIndex ===
                                        index
                                          ? {
                                              ...item,
                                              key: event
                                                .target
                                                .value,
                                            }
                                          : item
                                    ),
                                })
                              )
                            }
                            placeholder="Field name e.g. Contract Number"
                            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                          />

                          <input
                            type="text"
                            value={field.value}
                            onChange={(event) =>
                              setForm(
                                (current) => ({
                                  ...current,
                                  additionalMetadata:
                                    current.additionalMetadata.map(
                                      (
                                        item: AdditionalMetadataField,
                                        itemIndex: number
                                      ) =>
                                        itemIndex ===
                                        index
                                          ? {
                                              ...item,
                                              value:
                                                event
                                                  .target
                                                  .value,
                                            }
                                          : item
                                    ),
                                })
                              )
                            }
                            placeholder="Value"
                            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                          />

                          <button
                            type="button"
                            onClick={() =>
                              setForm(
                                (current) => ({
                                  ...current,
                                  additionalMetadata:
                                    current.additionalMetadata.filter(
                                      (
                                        _item: AdditionalMetadataField,
                                        itemIndex: number
                                      ) =>
                                        itemIndex !==
                                        index
                                    ),
                                })
                              )
                            }
                            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                          >
                            Remove
                          </button>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
                <button
                  type="button"
                  onClick={closeMetadataModal}
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                >
                  Register Metadata
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUploadModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-modal-title"
            aria-describedby="upload-modal-description"
            tabIndex={-1}
            className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl outline-none"
          >
            <div className="border-b border-slate-200 px-6 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Document intake
                  </p>

                  <h2
                    id="upload-modal-title"
                    className="mt-1 text-xl font-bold"
                  >
                    Upload Document
                  </h2>

                  <p
                    id="upload-modal-description"
                    className="mt-1 text-sm text-slate-500"
                  >
                    Upload a PDF or DOCX document into the records system.
                  </p>
                </div>

                <button
                  ref={modalCloseButtonRef}
                  type="button"
                  onClick={closeUploadModal}
                  disabled={uploading}
                  aria-label="Close document upload dialog"
                  className="ml-4 rounded-lg p-2 text-2xl leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span aria-hidden="true">
                    ×
                  </span>
                </button>
              </div>
            </div>

            <form
              onSubmit={handleUpload}
              className="min-h-0 flex-1 overflow-y-auto p-6"
            >
              {!uploadedDocument ? (
                <>
                  <label
                    htmlFor="document-upload"
                    className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center transition hover:border-slate-400 hover:bg-slate-100 focus-within:border-slate-500 focus-within:ring-2 focus-within:ring-slate-900 focus-within:ring-offset-2"
                  >
                    <div
                      aria-hidden="true"
                      className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-2xl text-white"
                    >
                      ↑
                    </div>

                    <div className="text-base font-semibold">
                      Choose a document
                    </div>

                    <div className="mt-2 text-sm text-slate-500">
                      PDF or DOCX
                    </div>

                    <div className="mt-1 text-xs text-slate-400">
                      Click to browse your computer
                    </div>

                    <input
                      id="document-upload"
                      type="file"
                      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                  </label>

                  {selectedFile && (
                    <div
                      className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4"
                      role="status"
                      aria-live="polite"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          aria-hidden="true"
                          className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-sm font-bold text-slate-700"
                        >
                          ▣
                        </div>

                        <div>
                          <div className="font-semibold text-slate-900">
                            {selectedFile.name}
                          </div>

                          <div className="mt-1 text-sm text-slate-500">
                            {formatFileSize(
                              selectedFile.size
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {uploadError && (
                    <div
                      role="alert"
                      aria-live="assertive"
                      className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                    >
                      {uploadError}
                    </div>
                  )}

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={closeUploadModal}
                      disabled={uploading}
                      className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={
                        !selectedFile ||
                        uploading ||
                        !canManageDocuments
                      }
                      aria-busy={uploading}
                      className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {uploading
                        ? "Uploading..."
                        : "Upload Document"}
                    </button>
                  </div>

                  {uploading && (
                    <div
                      role="status"
                      aria-live="polite"
                      className="mt-4 text-center text-sm text-slate-500"
                    >
                      Uploading and processing the document...
                    </div>
                  )}
                </>
              ) : (
                <div
                  className="flex max-h-[75vh] min-h-0 flex-col py-6"
                  role="status"
                  aria-live="polite"
                >
                  <div className="shrink-0 text-center">
                    <div
                      aria-hidden="true"
                      className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-700"
                    >
                      ✓
                    </div>

                    <h3 className="mt-4 text-xl font-bold">
                      Document Uploaded
                    </h3>

                    <p className="mt-2 text-sm text-slate-500">
                      The document has been securely added to the system.
                    </p>
                  </div>

                  <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-2">
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-5 py-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Uploaded Document
                        </p>

                        <div className="mt-1 flex items-center justify-between gap-3">
                          <h4 className="text-lg font-bold text-slate-900">
                            Document Details
                          </h4>

                          {uploadedDocument.status && (
                            <StatusBadge
                              status={String(
                                uploadedDocument.status
                              )}
                            />
                          )}
                        </div>
                      </div>

                      <div className="divide-y divide-slate-100">
                        {uploadFieldEntries.map(
                          ([key, value]) => {
                            const isDocumentCode =
                              key === "document_code";

                            const isFilename =
                              key === "filename";

                            const isStatus =
                              key === "status";

                            return (
                              <div
                                key={key}
                                className="px-5 py-3.5"
                              >
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                      {formatUploadFieldLabel(
                                        key
                                      )}
                                    </p>
                                  </div>

                                  <div
                                    className={`min-w-0 text-sm sm:max-w-[65%] sm:text-right ${
                                      isDocumentCode
                                        ? "text-lg font-bold text-blue-600"
                                        : isFilename
                                          ? "font-semibold text-slate-900"
                                          : isStatus
                                            ? "font-semibold text-slate-700"
                                            : "text-slate-700"
                                    }`}
                                  >
                                    {isStatus ? (
                                      <StatusBadge
                                        status={String(
                                          value
                                        )}
                                      />
                                    ) : (
                                      <span
                                        className={
                                          typeof value ===
                                          "object"
                                            ? "whitespace-pre-wrap break-words font-mono text-xs"
                                            : "break-words"
                                        }
                                      >
                                        {formatUploadFieldValue(
                                          key,
                                          value
                                        )}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    </div>
                  </div>

                  {uploadedAppraisal && (
                    <Appraisal
                      canManageDocuments={
                        canManageDocuments
                      }
                      departments={departments}
                      documentTypes={documentTypes}
                      uploadedAppraisal={
                        uploadedAppraisal
                      }
                      isCreatingNewMetadata={
                        isCreatingNewMetadata
                      }
                      appraisalMetadataForm={
                        appraisalMetadataForm
                      }
                      appraisalAdditionalMetadata={
                        appraisalAdditionalMetadata
                      }
                      appraisalCommittedAdditionalMetadata={
                        appraisalCommittedAdditionalMetadata
                      }
                      appraisalRequiredFieldsComplete={
                        appraisalRequiredFieldsComplete
                      }
                      appraisalDecisionLabel={
                        appraisalDecisionLabel
                      }
                      appraisalIsLinked={
                        appraisalIsLinked
                      }
                      matchedMetadata={
                        matchedMetadata
                      }
                      reviewingDecision={
                        reviewingDecision
                      }
                      reviewError={reviewError}
                      setAppraisalMetadataForm={
                        setAppraisalMetadataForm
                      }
                      setAppraisalAdditionalMetadata={
                        setAppraisalAdditionalMetadata
                      }
                      setAppraisalCommittedAdditionalMetadata={
                        setAppraisalCommittedAdditionalMetadata
                      }
                      handleAppraisalReview={
                        handleAppraisalReview
                      }
                      handleDoneAppraisal={
                        handleDoneAppraisal
                      }
                      handleCreateMetadataFromAppraisal={
                        handleCreateMetadataFromAppraisal
                      }
                      FormField={FormField}
                      StatusBadge={StatusBadge}
                      formatFileSize={
                        formatFileSize
                      }
                      formatUploadFieldLabel={
                        formatUploadFieldLabel
                      }
                      formatUploadFieldValue={
                        formatUploadFieldValue
                      }
                    />
                  )}

                  <div className="mt-4 shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left text-xs leading-5 text-slate-600">
                    <p>
                      <strong>
                        Records principle:
                      </strong>{" "}
                      the appraisal engine recommends a relationship; the
                      human reviewer controls whether the document is linked
                      to the metadata record.
                    </p>
                  </div>

                  <div className="mt-4 flex shrink-0 justify-center">
                    <button
                      type="button"
                      disabled={reviewingDecision}
                      onClick={() => {
                        void handleDoneAppraisal();
                      }}
                      className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {reviewingDecision
                        ? "Saving..."
                        : "Done"}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
