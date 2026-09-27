"use client";

import {
  useEffect,
  useState,
  type Dispatch,
  type ReactElement,
  type SetStateAction,
} from "react";

import type { UploadedAppraisal } from "@/types/appraisal";
import type {
  Department,
  DocumentType,
} from "@/types/departments";
import type {
  AdditionalMetadataField,
  MetadataRecord,
} from "@/types/metadata";

import type {
  DomainRelationshipDomain,
  DomainRelationshipSelection,
  DomainRelationshipType,
} from "@/components/metadata/DomainRelationshipSelector";

import { DomainMultiSelect } from "@/components/domains/DomainMultiSelect";
import { DomainRelationshipSelector } from "@/components/metadata/DomainRelationshipSelector";
import { UniversalMetadataFieldEditor } from "@/components/metadata/UniversalMetadataFieldEditor";

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

type AppraisalProps = {
  canManageDocuments: boolean;

  departments: Department[];
  documentTypes: DocumentType[];

  uploadedAppraisal: UploadedAppraisal;
  isCreatingNewMetadata: boolean;

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

  handleAppraisalReview: (
    decision: "APPROVE" | "REJECT"
  ) => Promise<void>;

  handleCreateMetadataFromAppraisal: () => Promise<void>;

  handleDoneAppraisal: () => Promise<void>;

  FormField: (props: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    type?: string;
    required?: boolean;
  }) => ReactElement;

  StatusBadge: (props: {
    status: string;
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

  appraisalDomainRelationshipDomains?: DomainRelationshipDomain[];

  appraisalDomainRelationshipTypes?: DomainRelationshipType[];

  appraisalDomainRelationships?: DomainRelationshipSelection[];

  appraisalDomainRelationshipsLoading?: boolean;

  appraisalDomainRelationshipsError?: string;

  setAppraisalDomainRelationships?: Dispatch<
    SetStateAction<DomainRelationshipSelection[]>
  >;

  appraisalDomainClassifications?: number[];

  setAppraisalDomainClassifications?: Dispatch<
    SetStateAction<number[]>
  >;
};

export function Appraisal({
  canManageDocuments,
  departments,
  documentTypes,

  uploadedAppraisal,
  isCreatingNewMetadata,

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

  handleAppraisalReview,
  handleCreateMetadataFromAppraisal,
  handleDoneAppraisal: _handleDoneAppraisal,

  FormField: _FormField,
  StatusBadge: _StatusBadge,

  formatFileSize: _formatFileSize,
  formatUploadFieldLabel: _formatUploadFieldLabel,
  formatUploadFieldValue: _formatUploadFieldValue,

  appraisalDomainRelationshipDomains = [],
  appraisalDomainRelationshipTypes = [],
  appraisalDomainRelationships = [],
  appraisalDomainRelationshipsLoading = false,
  appraisalDomainRelationshipsError = "",
  setAppraisalDomainRelationships,
  appraisalDomainClassifications = [],
  setAppraisalDomainClassifications = () => {},
}: AppraisalProps) {
  const hasDomainRelationshipSupport =
    setAppraisalDomainRelationships !== undefined;

  const appraisalFormDisabled =
    reviewingDecision || !canManageDocuments;

  const hasSuggestedMetadata =
    uploadedAppraisal.metadataRecordId !== null &&
    uploadedAppraisal.metadataRecordId !== undefined;

  const appraisalAlreadyCompleted =
    uploadedAppraisal.decision === "LINKED" ||
    uploadedAppraisal.decision === "NEW_METADATA_CREATED";

  const newMetadataCreated =
    uploadedAppraisal.decision ===
    "NEW_METADATA_CREATED";

  /*
   * This is deliberately separate from uploadedAppraisal.decision.
   *
   * REJECT already changes the appraisal decision to
   * PENDING_CONFIRMATION, so PENDING_CONFIRMATION cannot by itself
   * mean that Create Metadata has been clicked.
   *
   * This state becomes true only after the Create Metadata action
   * has passed the same required-field checks used by the appraisal
   * handler.
   */
  const [
    metadataReadyForRegistration,
    setMetadataReadyForRegistration,
  ] = useState(false);

  /*
   * Reset the local preparation state when the user leaves the
   * Create New Metadata workflow or when registration is completed.
   *
   * This does NOT reset merely because the appraisal decision changes
   * to PENDING_CONFIRMATION after Reject Match.
   */
  useEffect(() => {
    if (
      !isCreatingNewMetadata ||
      appraisalAlreadyCompleted
    ) {
      setMetadataReadyForRegistration(false);
    }
  }, [
    isCreatingNewMetadata,
    appraisalAlreadyCompleted,
  ]);

  const canAcceptSuggestedMetadata =
    canManageDocuments &&
    hasSuggestedMetadata &&
    !isCreatingNewMetadata &&
    !appraisalAlreadyCompleted;

  const canRejectSuggestedMetadata =
    canManageDocuments &&
    hasSuggestedMetadata &&
    !isCreatingNewMetadata &&
    !appraisalAlreadyCompleted;

  /*
   * Create Metadata must be visible before the user clicks it.
   *
   * Once metadataReadyForRegistration becomes true, this button
   * disappears and the "Your metadata is ready" message appears.
   */
  const canCreateNewMetadata =
    canManageDocuments &&
    isCreatingNewMetadata &&
    !metadataReadyForRegistration &&
    !appraisalAlreadyCompleted;

  const handleAcceptMetadata = () => {
    if (
      !canAcceptSuggestedMetadata ||
      reviewingDecision
    ) {
      return;
    }

    void handleAppraisalReview("APPROVE");
  };

  const handleRejectMatch = () => {
    if (
      !canRejectSuggestedMetadata ||
      reviewingDecision
    ) {
      return;
    }

    /*
     * Rejecting the match only enters the Create New Metadata
     * workflow. It does NOT mean metadata is ready yet.
     */
    setMetadataReadyForRegistration(false);

    void handleAppraisalReview("REJECT");
  };

  const handleCreateMetadata = async () => {
    if (
      reviewingDecision ||
      !canManageDocuments ||
      !isCreatingNewMetadata ||
      appraisalAlreadyCompleted ||
      metadataReadyForRegistration
    ) {
      return;
    }

    /*
     * Keep the validation aligned with the authoritative hook
     * handler. If validation fails, the button remains visible
     * and the handler displays the error.
     */
    if (
      !appraisalMetadataForm.referenceCode.trim() ||
      !appraisalMetadataForm.title.trim() ||
      !appraisalMetadataForm.documentDate ||
      !appraisalMetadataForm.year.trim() ||
      !appraisalMetadataForm.personName.trim() ||
      !appraisalMetadataForm.departmentId ||
      !appraisalMetadataForm.documentTypeId ||
      !appraisalMetadataForm.section.trim() ||
      !appraisalMetadataForm.description.trim()
    ) {
      await handleCreateMetadataFromAppraisal();
      return;
    }

    /*
     * The hook performs the authoritative operation.
     * It is still provisional: no document or metadata record
     * is persisted here. Done remains the registration action.
     */
    await handleCreateMetadataFromAppraisal();

    /*
     * The current hook handler returns after successful preparation.
     * Only then do we transition this UI into the ready state.
     */
    setMetadataReadyForRegistration(true);
  };

  return (
    <div className="mt-4 shrink-0 rounded-2xl border border-slate-200 bg-white text-left shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              AI Appraisal
            </p>

            <h4 className="mt-1 text-lg font-bold text-slate-900">
              {newMetadataCreated
                ? "New Metadata Created"
                : uploadedAppraisal.matchType === "NO_MATCH"
                  ? "No metadata match found"
                  : "Likely metadata match detected"}
            </h4>
          </div>

          {!newMetadataCreated && (
            <div className="rounded-xl bg-white px-4 py-3 text-center shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Confidence
              </p>

              <p className="mt-1 text-2xl font-bold text-blue-600">
                {uploadedAppraisal.confidence}%
              </p>
            </div>
          )}

          {newMetadataCreated && (
            <div className="rounded-xl bg-emerald-100 px-4 py-3 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                Status
              </p>

              <p className="mt-1 text-lg font-bold text-emerald-700">
                Linked
              </p>
            </div>
          )}
        </div>
      </div>

      {newMetadataCreated && (
        <div className="border-b border-emerald-100 px-5 py-5">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-start gap-3">
              <div
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-700"
              >
                ✓
              </div>

              <div className="min-w-0">
                <h3 className="text-base font-bold text-emerald-900">
                  New Metadata Created
                </h3>

                <p className="mt-1 text-sm leading-6 text-emerald-800">
                  The new metadata record has been successfully
                  created and linked to this document.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Metadata Reference
                </p>

                <p className="mt-1 text-base font-bold text-slate-900">
                  {appraisalMetadataForm.referenceCode ||
                    "Reference pending"}
                </p>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Relationship
                </p>

                <p className="mt-1 text-base font-bold text-emerald-700">
                  Document Linked
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-emerald-200 bg-white px-4 py-4">
              <p className="text-sm font-semibold text-slate-900">
                Registration complete
              </p>

              <p className="mt-1 text-sm leading-6 text-slate-600">
                The document has been registered and associated
                with the newly created metadata record.
              </p>
            </div>
          </div>
        </div>
      )}

      {!newMetadataCreated && (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-slate-900">
                {isCreatingNewMetadata
                  ? "Create New Metadata"
                  : "Review & Edit Metadata"}
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                {isCreatingNewMetadata
                  ? "The AI match was rejected. Review and complete the metadata below. The Reference Code is automatically assigned and cannot be changed. Select Create Metadata to prepare the new record for registration; nothing is saved until you select Done."
                  : "Review the extracted metadata before linking this document. The Reference Code is automatically assigned and cannot be changed. You may change, clear, or leave the other fields blank."}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Reference Code
                </span>

                <input
                  type="text"
                  value={appraisalMetadataForm.referenceCode}
                  readOnly
                  aria-readonly="true"
                  className="w-full cursor-default rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Title
                </span>

                <input
                  type="text"
                  value={appraisalMetadataForm.title}
                  disabled={appraisalFormDisabled}
                  onChange={(event) =>
                    setAppraisalMetadataForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Document Date
                </span>

                <input
                  type="date"
                  value={appraisalMetadataForm.documentDate}
                  disabled={appraisalFormDisabled}
                  onChange={(event) =>
                    setAppraisalMetadataForm((current) => ({
                      ...current,
                      documentDate: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 disabled:cursor-not-allowed disabled:bg-slate-100"
                />

                {uploadedAppraisal.extractedDateText && (
                  <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <span className="font-medium text-slate-700">
                      Extracted date information:
                    </span>{" "}
                    {uploadedAppraisal.extractedDateText}
                  </p>
                )}
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Year
                </span>

                <input
                  type="number"
                  value={appraisalMetadataForm.year}
                  disabled={appraisalFormDisabled}
                  onChange={(event) =>
                    setAppraisalMetadataForm((current) => ({
                      ...current,
                      year: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Person Name
                </span>

                <input
                  type="text"
                  value={appraisalMetadataForm.personName}
                  disabled={appraisalFormDisabled}
                  onChange={(event) =>
                    setAppraisalMetadataForm((current) => ({
                      ...current,
                      personName: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Department
                </span>

                <select
                  value={appraisalMetadataForm.departmentId}
                  disabled={appraisalFormDisabled}
                  onChange={(event) =>
                    setAppraisalMetadataForm((current) => ({
                      ...current,
                      departmentId: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  <option value="">None</option>

                  {departments.map((department) => (
                    <option
                      key={department.id}
                      value={department.id}
                    >
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Document Type
                </span>

                <select
                  value={appraisalMetadataForm.documentTypeId}
                  disabled={appraisalFormDisabled}
                  onChange={(event) =>
                    setAppraisalMetadataForm((current) => ({
                      ...current,
                      documentTypeId: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  <option value="">None</option>

                  {documentTypes.map((documentType) => (
                    <option
                      key={documentType.id}
                      value={documentType.id}
                    >
                      {documentType.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Section
                </span>

                <input
                  type="text"
                  value={appraisalMetadataForm.section}
                  disabled={appraisalFormDisabled}
                  onChange={(event) =>
                    setAppraisalMetadataForm((current) => ({
                      ...current,
                      section: event.target.value,
                    }))
                  }
                  placeholder="e.g. Operations, Finance, Procurement"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </label>

              <label className="block md:col-span-2">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Description
                </span>

                <textarea
                  value={appraisalMetadataForm.description}
                  disabled={appraisalFormDisabled}
                  onChange={(event) =>
                    setAppraisalMetadataForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </label>
            </div>

            {hasDomainRelationshipSupport && (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
<DomainRelationshipSelector
                  domains={appraisalDomainRelationshipDomains}
                  relationshipTypes={appraisalDomainRelationshipTypes}
                  selected={appraisalDomainRelationships}
                  onChange={setAppraisalDomainRelationships}
                  disabled={
                    !canManageDocuments ||
                    reviewingDecision ||
                    appraisalDomainRelationshipsLoading
                  }
                  title="Domain & Relationships"
                  description="Associate this appraisal with one or more domains and define the relationship context before linking or creating metadata."
                />

                {appraisalDomainRelationshipsError ? (
                  <p
                    role="alert"
                    className="mt-3 text-sm font-medium text-red-600"
                  >
                    {appraisalDomainRelationshipsError}
                  </p>
                ) : null}
              </div>
            )}

            <div className="mt-5">
              <UniversalMetadataFieldEditor
                scope="appraisal"
                disabled={appraisalFormDisabled}
                title="Universal Metadata Values"
                description="Select additional universal metadata fields discovered during appraisal and review their values before linking or creating the metadata record."
              />
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Additional Metadata
                  </h4>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Add document-specific fields discovered during
                    appraisal. These are saved with the metadata record
                    when you approve or create it.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={appraisalFormDisabled}
                  onClick={() =>
                    setAppraisalAdditionalMetadata((current) => [
                      ...current,
                      {
                        key: "",
                        value: "",
                      },
                    ])
                  }
                  className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  + Add Field
                </button>
              </div>

              {appraisalCommittedAdditionalMetadata.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Added Metadata
                  </p>

                  {appraisalCommittedAdditionalMetadata.map(
                    (field, index) => (
                      <div
                        key={`committed-${index}`}
                        className="grid gap-3 sm:grid-cols-[1fr_1.5fr_auto]"
                      >
                        <input
                          type="text"
                          value={field.key}
                          disabled={appraisalFormDisabled}
                          onChange={(event) =>
                            setAppraisalCommittedAdditionalMetadata(
                              (current) =>
                                current.map(
                                  (item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          key: event.target.value,
                                        }
                                      : item
                                )
                            )
                          }
                          placeholder="Field name"
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 disabled:cursor-not-allowed disabled:bg-slate-100"
                        />

                        <input
                          type="text"
                          value={field.value}
                          disabled={appraisalFormDisabled}
                          onChange={(event) =>
                            setAppraisalCommittedAdditionalMetadata(
                              (current) =>
                                current.map(
                                  (item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          value: event.target.value,
                                        }
                                      : item
                                )
                            )
                          }
                          placeholder="Value"
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 disabled:cursor-not-allowed disabled:bg-slate-100"
                        />

                        <button
                          type="button"
                          disabled={appraisalFormDisabled}
                          onClick={() =>
                            setAppraisalCommittedAdditionalMetadata(
                              (current) =>
                                current.filter(
                                  (_, itemIndex) =>
                                    itemIndex !== index
                                )
                            )
                          }
                          className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-white hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}

              {appraisalAdditionalMetadata.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    New Metadata Field
                  </p>

                  <div className="space-y-3">
                    {appraisalAdditionalMetadata.map(
                      (field, index) => (
                        <div
                          key={`draft-${index}`}
                          className="grid gap-3 sm:grid-cols-[1fr_1.5fr_auto]"
                        >
                          <input
                            type="text"
                            value={field.key}
                            disabled={appraisalFormDisabled}
                            onChange={(event) =>
                              setAppraisalAdditionalMetadata(
                                (current) =>
                                  current.map(
                                    (item, itemIndex) =>
                                      itemIndex === index
                                        ? {
                                            ...item,
                                            key: event.target.value,
                                          }
                                        : item
                                  )
                              )
                            }
                            placeholder="Field name"
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 disabled:cursor-not-allowed disabled:bg-slate-100"
                          />

                          <input
                            type="text"
                            value={field.value}
                            disabled={appraisalFormDisabled}
                            onChange={(event) =>
                              setAppraisalAdditionalMetadata(
                                (current) =>
                                  current.map(
                                    (item, itemIndex) =>
                                      itemIndex === index
                                        ? {
                                            ...item,
                                            value: event.target.value,
                                          }
                                        : item
                                  )
                              )
                            }
                            placeholder="Value"
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 disabled:cursor-not-allowed disabled:bg-slate-100"
                          />

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={appraisalFormDisabled}
                              onClick={() => {
                                const fieldKey =
                                  field.key.trim();

                                const fieldValue =
                                  field.value.trim();

                                if (!fieldKey) {
                                  return;
                                }

                                setAppraisalCommittedAdditionalMetadata(
                                  (current) => [
                                    ...current,
                                    {
                                      key: fieldKey,
                                      value: fieldValue,
                                    },
                                  ]
                                );

                                setAppraisalAdditionalMetadata(
                                  (current) =>
                                    current.map(
                                      (item, itemIndex) =>
                                        itemIndex === index
                                          ? {
                                              key: "",
                                              value: "",
                                            }
                                          : item
                                    )
                                );
                              }}
                              className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              + Add
                            </button>

                            <button
                              type="button"
                              disabled={appraisalFormDisabled}
                              onClick={() =>
                                setAppraisalAdditionalMetadata(
                                  (current) =>
                                    current.filter(
                                      (_, itemIndex) =>
                                        itemIndex !== index
                                    )
                                )
                              }
                              className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-white hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {matchedMetadata && (
            <div className="border-b border-slate-100 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Likely Metadata Record
              </p>

              <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-lg font-bold text-blue-700">
                      {matchedMetadata.reference_code}
                    </p>

                    <p className="mt-1 font-semibold text-slate-900">
                      {matchedMetadata.title ||
                        "Untitled document"}
                    </p>

                    {matchedMetadata.person_name && (
                      <p className="mt-1 text-sm text-slate-600">
                        {matchedMetadata.person_name}
                      </p>
                    )}
                  </div>

                  <div className="text-left text-xs text-slate-500 sm:text-right">
                    <p>
                      {matchedMetadata.department_name ||
                        "No department"}
                    </p>

                    <p className="mt-1">
                      {matchedMetadata.document_type_name ||
                        "No document type"}
                    </p>

                    {matchedMetadata.year && (
                      <p className="mt-1">
                        {matchedMetadata.year}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {uploadedAppraisal.matchingFields.length > 0 && (
            <div className="border-b border-slate-100 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Matching Information
              </p>

              <div className="mt-3 space-y-2">
                {uploadedAppraisal.matchingFields.map(
                  (field) => (
                    <div
                      key={field}
                      className="flex items-center gap-2 text-sm text-slate-700"
                    >
                      <span
                        aria-hidden="true"
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700"
                      >
                        ✓
                      </span>

                      <span>{field}</span>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {uploadedAppraisal.conflictingFields.length > 0 && (
            <div className="border-b border-slate-100 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Conflicting Information
              </p>

              <div className="mt-3 space-y-3">
                {uploadedAppraisal.metadataConflicts &&
                uploadedAppraisal.metadataConflicts.length > 0 ? (
                  uploadedAppraisal.metadataConflicts.map(
                    (conflict) => (
                      <div
                        key={conflict.field}
                        className="rounded-xl border border-amber-200 bg-amber-50 p-3"
                      >
                        <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                          <span
                            aria-hidden="true"
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold"
                          >
                            !
                          </span>

                          <span>{conflict.field}</span>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-lg bg-white p-3">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                              Existing metadata
                            </p>

                            <p className="mt-1 text-sm text-slate-700">
                              {conflict.existingValue ??
                                "Blank"}
                            </p>
                          </div>

                          <div className="rounded-lg bg-white p-3">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                              Document says
                            </p>

                            <p className="mt-1 text-sm text-slate-700">
                              {conflict.documentValue ??
                                "Blank"}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  )
                ) : (
                  uploadedAppraisal.conflictingFields.map(
                    (field) => (
                      <div
                        key={field}
                        className="flex items-center gap-2 text-sm text-amber-800"
                      >
                        <span
                          aria-hidden="true"
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold"
                        >
                          !
                        </span>

                        <span>{field}</span>
                      </div>
                    )
                  )
                )}
              </div>
            </div>
          )}

          <div className="px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Decision
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                {appraisalDecisionLabel}
              </span>

              {appraisalIsLinked && (
                <span className="text-sm font-semibold text-emerald-700">
                  Document linked successfully.
                </span>
              )}
            </div>

            {!appraisalIsLinked &&
              uploadedAppraisal.matchType !== "NO_MATCH" &&
              !isCreatingNewMetadata && (
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  The system found a likely metadata match.
                  No link has been created automatically.
                  Please review the recommendation before
                  changing the record relationship.
                </p>
              )}

            {isCreatingNewMetadata && (
              <p className="mt-3 text-sm leading-6 text-slate-600">
                The AI match was rejected. Complete the metadata
                review below and select{" "}
                <span className="font-semibold text-slate-800">
                  Create Metadata
                </span>{" "}
                when you are ready to register the new metadata
                record and link this document.
              </p>
            )}

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs leading-5 text-slate-600">
                <span className="font-semibold text-slate-700">
                  Records principle:
                </span>{" "}
                The appraisal engine recommends a relationship;
                the human reviewer controls whether the document
                is linked to the metadata record.
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-600">
                <span className="font-semibold text-slate-700">
                  To cancel:
                </span>{" "}
                Press the{" "}
                <span className="font-semibold text-slate-800">
                  X
                </span>{" "}
                icon at the top right to cancel the upload and any
                metadata creation. No document or metadata record
                will be registered.
              </p>
            </div>

            {reviewError && (
              <div
                role="alert"
                aria-live="assertive"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {reviewError}
              </div>
            )}

            {canCreateNewMetadata && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Ready to create metadata
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Review the metadata above, then select
                      Create Metadata to prepare it for
                      registration. Nothing is saved until you
                      select Done.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={reviewingDecision}
                    onClick={handleCreateMetadata}
                    className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {reviewingDecision
                      ? "Preparing..."
                      : "Create Metadata"}
                  </button>
                </div>
              </div>
            )}

            {canAcceptSuggestedMetadata && (
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  disabled={reviewingDecision}
                  onClick={handleAcceptMetadata}
                  className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {reviewingDecision
                    ? "Processing..."
                    : "Accept Metadata"}
                </button>

                <button
                  type="button"
                  disabled={reviewingDecision}
                  onClick={handleRejectMatch}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Reject Match
                </button>
              </div>
            )}
          </div>

          {metadataReadyForRegistration && (
            <div className="border-t border-slate-100 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Your metadata is ready
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Your metadata has been prepared for registration.
                  Nothing has been saved yet. Select Done to register
                  the document and create the metadata record using
                  the automatically assigned department reference code.
                </p>
              </div>

              {!appraisalRequiredFieldsComplete &&
                !reviewError && (
                  <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                    Complete the required metadata fields before
                    registering the new metadata record.
                  </p>
                )}
            </div>
          )}
        </>
      )}
    </div>
  );
}


