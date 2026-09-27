"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  cancelDocumentUpload,
  confirmDocumentUpload,
  uploadDocument,
} from "@/lib/api/documents";
import {
  getUniversalMetadataDraft,
  resetUniversalMetadataDraft,
} from "@/lib/metadata/universalMetadataDraft";
import { persistUniversalMetadataValues } from "@/lib/metadata/universalMetadataValues";

import type { DomainRelationshipSelection } from "@/components/metadata/DomainRelationshipSelector";

import type {
  AdditionalMetadataField,
  MetadataRecord,
} from "@/types/metadata";

import type { UploadedAppraisal } from "@/types/appraisal";
import type { UploadedDocument } from "@/types/documents";

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

type UseDocumentAppraisalOptions = {
  canManageDocuments: boolean;

  metadata: MetadataRecord[];

  loadData: () => Promise<void>;

  setShowUploadModal: (
    value: boolean
  ) => void;

  loadMetadataDomainRelationships: (
    metadataRecordId:
      | string
      | number
      | null
      | undefined
  ) => Promise<void>;

  saveMetadataDomainRelationships: (
    metadataRecordId: string | number,
    desiredRelationships:
      DomainRelationshipSelection[]
  ) => Promise<DomainRelationshipSelection[]>;

  setDomainRelationshipsError: (
    value: string
  ) => void;

  appraisalDomainClassifications: number[];
};

export function useDocumentAppraisal({
  canManageDocuments,
  metadata,
  loadData,
  setShowUploadModal,
  loadMetadataDomainRelationships,
  saveMetadataDomainRelationships,
  setDomainRelationshipsError,
  appraisalDomainClassifications,
}: UseDocumentAppraisalOptions) {
  const [
    uploading,
    setUploading,
  ] = useState(false);

  const uploadingRef =
    useRef(false);

  useEffect(() => {
    uploadingRef.current = uploading;
  }, [uploading]);

  const [
    uploadError,
    setUploadError,
  ] = useState("");

  const [
    selectedFile,
    setSelectedFile,
  ] = useState<File | null>(null);

  const [
    uploadToken,
    setUploadToken,
  ] = useState<string | null>(null);

  const [
    uploadedDocument,
    setUploadedDocument,
  ] = useState<UploadedDocument | null>(
    null
  );

  const [
    uploadedAppraisal,
    setUploadedAppraisal,
  ] = useState<UploadedAppraisal | null>(
    null
  );

  const [
    isCreatingNewMetadata,
    setIsCreatingNewMetadata,
  ] = useState(false);

  const [
    appraisalDomainRelationships,
    setAppraisalDomainRelationships,
  ] = useState<DomainRelationshipSelection[]>(
    []
  );

  const [
    appraisalMetadataForm,
    setAppraisalMetadataForm,
  ] = useState<AppraisalMetadataForm>({
    referenceCode: "",
    title: "",
    documentDate: "",
    year: "",
    personName: "",
    departmentId: "",
    documentTypeId: "",
    section: "",
    description: "",
  });

  const [
    appraisalAdditionalMetadata,
    setAppraisalAdditionalMetadata,
  ] = useState<AdditionalMetadataField[]>(
    []
  );

  const [
    appraisalCommittedAdditionalMetadata,
    setAppraisalCommittedAdditionalMetadata,
  ] = useState<AdditionalMetadataField[]>(
    []
  );

  const [
    reviewingDecision,
    setReviewingDecision,
  ] = useState(false);

  const [
    reviewError,
    setReviewError,
  ] = useState("");

  const appraisalRequiredFieldsComplete =
    Boolean(
      appraisalMetadataForm.referenceCode.trim() &&
        appraisalMetadataForm.title.trim() &&
        appraisalMetadataForm.documentDate &&
        appraisalMetadataForm.year.trim() &&
        appraisalMetadataForm.personName.trim() &&
        appraisalMetadataForm.departmentId &&
        appraisalMetadataForm.documentTypeId &&
        appraisalMetadataForm.section.trim() &&
        appraisalMetadataForm.description.trim()
    );

  const resetUploadState = () => {
    setSelectedFile(null);
    setUploadToken(null);
    setUploadedDocument(null);
    setUploadedAppraisal(null);
    setUploading(false);
    setUploadError("");
    setReviewingDecision(false);
    setReviewError("");
    setIsCreatingNewMetadata(false);
    setAppraisalDomainRelationships([]);
    setAppraisalAdditionalMetadata([]);
    setAppraisalCommittedAdditionalMetadata([]);
    setAppraisalMetadataForm({
      referenceCode: "",
      title: "",
      documentDate: "",
      year: "",
      personName: "",
      departmentId: "",
      documentTypeId: "",
      section: "",
      description: "",
    });
  };

  const closeUploadModal = async () => {
    if (uploading || reviewingDecision) {
      return;
    }

    const activeUploadToken =
      uploadToken;

    if (activeUploadToken) {
      try {
        setReviewError("");

        const response =
          await cancelDocumentUpload(
            activeUploadToken
          );

        const data =
          await response.json().catch(
            () => null
          );

        if (
          !response.ok ||
          !data?.success
        ) {
          throw new Error(
            data?.error ||
              data?.message ||
              "Unable to cancel the provisional document upload."
          );
        }

        setUploadToken(null);
      } catch (error) {
        setReviewError(
          error instanceof Error
            ? error.message
            : "Unable to cancel the provisional document upload."
        );

        return;
      }
    }

    setShowUploadModal(false);
    resetUploadState();
    setDomainRelationshipsError("");
  };

  const handleFileChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      event.target.files?.[0] ?? null;

    setUploadError("");
    setUploadedDocument(null);
    setUploadedAppraisal(null);
    setUploadToken(null);
    setAppraisalDomainRelationships([]);
    setAppraisalAdditionalMetadata([]);
    setAppraisalCommittedAdditionalMetadata([]);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    const extension =
      file.name
        .toLowerCase()
        .split(".")
        .pop();

    if (
      !allowedTypes.includes(file.type) &&
      extension !== "pdf" &&
      extension !== "docx"
    ) {
      setUploadError(
        "Only PDF and DOCX documents are currently supported."
      );

      setSelectedFile(null);
      event.target.value = "";
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    if (!canManageDocuments) {
      return;
    }

    event.preventDefault();

    if (!selectedFile) {
      setUploadError(
        "Please select a PDF or DOCX document."
      );

      return;
    }

    try {
      setUploading(true);
      setUploadError("");
      setUploadedDocument(null);
      setUploadedAppraisal(null);
      setUploadToken(null);
      setReviewingDecision(false);
      setReviewError("");
      setIsCreatingNewMetadata(false);
      setAppraisalDomainRelationships([]);
      setAppraisalAdditionalMetadata([]);
      setAppraisalCommittedAdditionalMetadata([]);

      const response =
        await uploadDocument(
          selectedFile
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Document upload failed."
        );
      }

      if (
        !data.uploadToken ||
        typeof data.uploadToken !==
          "string"
      ) {
        throw new Error(
          "The upload was processed, but the API did not return a provisional upload token."
        );
      }

      if (
        !data.document ||
        typeof data.document !==
          "object"
      ) {
        throw new Error(
          "Document uploaded, but the API returned an invalid document response."
        );
      }

      setUploadToken(
        data.uploadToken
      );

      setUploadedDocument(
        data.document as UploadedDocument
      );

      if (
        data.appraisal &&
        typeof data.appraisal ===
          "object"
      ) {
        const appraisal =
          data.appraisal as UploadedAppraisal;

        setUploadedAppraisal(
          appraisal
        );

        const metadata =
          appraisal.metadata ??
          null;

        setAppraisalMetadataForm({
          referenceCode:
            metadata?.reference_code ??
            data.metadata?.reference_code ??
            "",

          title:
            metadata?.title ??
            data.metadata?.title ??
            "",

          documentDate:
            metadata?.document_date ??
            data.metadata?.document_date ??
            "",

          year:
            metadata?.year != null
              ? String(metadata.year)
              : data.metadata?.year !=
                  null
                ? String(
                    data.metadata.year
                  )
                : "",

          personName:
            metadata?.person_name ??
            data.metadata?.person_name ??
            "",

          departmentId:
            metadata?.department_id !=
            null
              ? String(
                  metadata.department_id
                )
              : "",

          documentTypeId:
            metadata?.document_type_id !=
            null
              ? String(
                  metadata.document_type_id
                )
              : "",

          section:
            metadata?.section ??
            data.metadata?.section ??
            "",

          description:
            metadata?.description ??
            data.metadata?.description ??
            "",
        });

        setAppraisalCommittedAdditionalMetadata(
          Object.entries(
            metadata?.additional_metadata ??
              data.metadata
                ?.additional_metadata ??
              {}
          ).map(
            ([key, value]) => ({
              key,
              value:
                value === null ||
                value === undefined
                  ? ""
                  : String(value),
            })
          )
        );

        setAppraisalAdditionalMetadata(
          []
        );

        const metadataRecordId =
          appraisal.metadataRecordId ??
          data.metadata?.id ??
          null;

        if (metadataRecordId) {
          await loadMetadataDomainRelationships(
            metadataRecordId
          );
        } else {
          setAppraisalDomainRelationships(
            []
          );
        }
      } else {
        setUploadedAppraisal(null);
        setAppraisalDomainRelationships(
          []
        );
      }

      setReviewError("");
      setSelectedFile(null);

      const fileInput =
        document.getElementById(
          "document-upload"
        ) as HTMLInputElement | null;

      if (fileInput) {
        fileInput.value = "";
      }

      /*
       * Important:
       * The document is still provisional at this point.
       * Do not refresh the registry/dashboard until confirmation.
       */
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : "Unable to upload document."
      );
    } finally {
      setUploading(false);
    }
  };

  const normalizeAppraisalDocumentDate = (
    value: unknown
  ): string => {
    const raw =
      String(value ?? "").trim();

    if (
      /^\d{4}-\d{2}-\d{2}$/.test(
        raw
      )
    ) {
      return raw;
    }

    return "";
  };

  const buildAppraisalAdditionalMetadata =
    (): Record<string, unknown> => {
      const entries = [
        ...appraisalCommittedAdditionalMetadata,
        ...appraisalAdditionalMetadata,
      ]
        .map(
          (field) => ({
            key: String(
              field.key ?? ""
            ).trim(),

            value: String(
              field.value ?? ""
            ).trim(),
          })
        )
        .filter(
          (field) =>
            field.key.length > 0 &&
            field.value.length > 0
        );

      return entries.reduce<
        Record<string, unknown>
      >(
        (
          result,
          field
        ) => {
          result[field.key] =
            field.value;

          return result;
        },
        {}
      );
    };

  const buildAppraisalMetadata = (
    referenceCode: string
  ) => ({
    referenceCode:
      referenceCode.trim() || null,

    personName:
      appraisalMetadataForm.personName.trim() ||
      null,

    title:
      appraisalMetadataForm.title.trim() ||
      null,

    departmentId:
      appraisalMetadataForm.departmentId ||
      null,

    documentTypeId:
      appraisalMetadataForm.documentTypeId ||
      null,

    year:
      appraisalMetadataForm.year.trim() ||
      null,

    documentDate:
      normalizeAppraisalDocumentDate(
        appraisalMetadataForm.documentDate
      ) || null,

    section:
      appraisalMetadataForm.section.trim() ||
      null,

    description:
      appraisalMetadataForm.description.trim() ||
      null,

    additionalMetadata:
      buildAppraisalAdditionalMetadata(),
  });

  const handleDoneAppraisal =
    async () => {
      if (!canManageDocuments) {
        return;
      }

      if (
        !uploadToken ||
        !uploadedAppraisal
      ) {
        return;
      }

      const metadataRecordId =
        uploadedAppraisal.metadataRecordId ??
        null;

      const referenceCode =
        appraisalMetadataForm.referenceCode.trim() ||
        String(
          uploadedAppraisal.metadata
            ?.reference_code ??
            ""
        ).trim();

      if (!referenceCode) {
        setReviewError(
          "A metadata reference code has not been assigned to this document."
        );

        return;
      }

      if (
        metadataRecordId === null &&
        !appraisalRequiredFieldsComplete
      ) {
        setReviewError(
          "Please complete the required metadata fields before registering this document."
        );

        return;
      }

      try {
        setReviewingDecision(true);
        setReviewError("");

        const response =
          await confirmDocumentUpload(
            uploadToken,
            {
              metadataRecordId,
              metadata:
                buildAppraisalMetadata(
                  referenceCode
                ),
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.error ||
              data.message ||
              data.details ||
              "Unable to register the document."
          );
        }

        if (data.document) {
          setUploadedDocument(
            data.document as UploadedDocument
          );
        }

        const persistedMetadataId =
          Number(
            data.metadata?.id ??
              data.appraisal?.metadataRecordId ??
              metadataRecordId ??
              0
          );

        if (
          Number.isInteger(
            persistedMetadataId
          ) &&
          persistedMetadataId > 0
        ) {
          const desiredDomainRelationships = [
            ...appraisalDomainRelationships,
          ];

          for (const domainId of appraisalDomainClassifications) {
            const numericDomainId = Number(domainId);

            if (
              !Number.isInteger(numericDomainId) ||
              numericDomainId <= 0
            ) {
              continue;
            }

            if (
              !desiredDomainRelationships.some(
                (relationship) =>
                  relationship.domainId === numericDomainId &&
                  relationship.relationshipType === "SUBJECT"
              )
            ) {
              desiredDomainRelationships.push({
                domainId: numericDomainId,
                relationshipType: "SUBJECT",
              });
            }
          }

          await saveMetadataDomainRelationships(
            persistedMetadataId,
            desiredDomainRelationships
          );

          await persistUniversalMetadataValues(
            persistedMetadataId,
            getUniversalMetadataDraft("appraisal")
          );

          resetUniversalMetadataDraft("appraisal");
        }

        setUploadToken(null);

        await loadData();

        setReviewError("");
        setShowUploadModal(false);
        resetUploadState();
        setDomainRelationshipsError("");
      } catch (error) {
        setReviewError(
          error instanceof Error
            ? error.message
            : "Unable to register the document."
        );
      } finally {
        setReviewingDecision(false);
      }
    };

  const handleCreateMetadataFromAppraisal =
    async () => {
      if (!canManageDocuments) {
        return;
      }

      if (!uploadedAppraisal) {
        return;
      }

      if (!isCreatingNewMetadata) {
        return;
      }

      const referenceCode =
        appraisalMetadataForm.referenceCode.trim();

      if (!referenceCode) {
        setReviewError(
          "A reference code has not been assigned to this document."
        );

        return;
      }

      if (
        !appraisalRequiredFieldsComplete
      ) {
        setReviewError(
          "Please complete the required metadata fields before registering the document."
        );

        return;
      }

      /*
       * Creating new metadata is intentionally provisional.
       * The actual metadata record and document are created together
       * by handleDoneAppraisal() -> confirmDocumentUpload().
       */
      setReviewError("");

      setUploadedAppraisal(
        (current) =>
          current
            ? {
                ...current,
                decision:
                  "PENDING_CONFIRMATION",
                metadataRecordId:
                  null,
                metadata: {
                  ...(current.metadata ?? {}),
                  reference_code:
                    referenceCode,
                  title:
                    appraisalMetadataForm.title.trim() ||
                    null,
                  document_date:
                    normalizeAppraisalDocumentDate(
                      appraisalMetadataForm.documentDate
                    ) || null,
                  year:
                    appraisalMetadataForm.year.trim()
                      ? Number(
                          appraisalMetadataForm.year
                        )
                      : null,
                  person_name:
                    appraisalMetadataForm.personName.trim() ||
                    null,
                  department_id:
                    appraisalMetadataForm.departmentId ||
                    null,
                  document_type_id:
                    appraisalMetadataForm.documentTypeId ||
                    null,
                  section:
                    appraisalMetadataForm.section.trim() ||
                    null,
                  description:
                    appraisalMetadataForm.description.trim() ||
                    null,
                  additional_metadata:
                    buildAppraisalAdditionalMetadata(),
                },
              }
            : current
      );
    };

  const handleAppraisalReview =
    async (
      decision:
        | "APPROVE"
        | "REJECT"
    ) => {
      if (!canManageDocuments) {
        return;
      }

      if (
        !uploadToken ||
        !uploadedAppraisal
      ) {
        return;
      }

      setReviewError("");

      if (decision === "REJECT") {
        setIsCreatingNewMetadata(true);

        setUploadedAppraisal(
          (current) =>
            current
              ? {
                  ...current,
                  decision:
                    "PENDING_CONFIRMATION",
                }
              : current
        );

        return;
      }

      if (
        !uploadedAppraisal.metadataRecordId
      ) {
        setReviewError(
          "There is no matched metadata record available to link. Review the metadata and create a new metadata record instead."
        );

        return;
      }

      /*
       * APPROVE only records the human's provisional decision.
       * The database is changed only by Done -> confirmDocumentUpload().
       */
      setIsCreatingNewMetadata(false);

      setUploadedAppraisal(
        (current) =>
          current
            ? {
                ...current,
                decision:
                  "PENDING_CONFIRMATION",
              }
            : current
      );
    };

  const uploadFieldEntries =
    uploadedDocument
      ? Object.entries(
          uploadedDocument
        )
      : [];

  const matchedMetadata =
    uploadedAppraisal?.metadataRecordId
      ? metadata.find(
          (record) =>
            Number(record.id) ===
            Number(
              uploadedAppraisal.metadataRecordId
            )
        ) ?? null
      : null;

  const appraisalDecisionLabel =
    uploadedAppraisal?.decision ===
    "PENDING_CONFIRMATION"
      ? isCreatingNewMetadata
        ? "NEW METADATA — READY TO REGISTER"
        : "MATCH APPROVED — READY TO REGISTER"
      : uploadedAppraisal?.decision ===
          "LINKED"
        ? "LINKED"
        : uploadedAppraisal?.decision ===
            "NEW_METADATA_CREATED"
          ? "NEW METADATA CREATED & LINKED"
          : uploadedAppraisal?.decision ===
              "REJECT"
            ? "REJECTED"
            : "REVIEW REQUIRED";

  const appraisalIsLinked =
    uploadedAppraisal?.decision ===
    "LINKED";

  return {
    uploading,
    setUploading,

    uploadError,
    setUploadError,

    selectedFile,
    setSelectedFile,

    uploadToken,
    setUploadToken,

    uploadedDocument,
    setUploadedDocument,

    uploadedAppraisal,
    setUploadedAppraisal,

    isCreatingNewMetadata,
    setIsCreatingNewMetadata,

    appraisalDomainRelationships,
    setAppraisalDomainRelationships,

    appraisalMetadataForm,
    setAppraisalMetadataForm,

    appraisalAdditionalMetadata,
    setAppraisalAdditionalMetadata,

    appraisalCommittedAdditionalMetadata,
    setAppraisalCommittedAdditionalMetadata,

    appraisalRequiredFieldsComplete,

    reviewingDecision,
    setReviewingDecision,

    reviewError,
    setReviewError,

    uploadFieldEntries,
    matchedMetadata,
    appraisalDecisionLabel,
    appraisalIsLinked,

    closeUploadModal,
    handleFileChange,
    handleUpload,
    handleAppraisalReview,
    handleDoneAppraisal,
    handleCreateMetadataFromAppraisal,

    normalizeAppraisalDocumentDate,
    buildAppraisalAdditionalMetadata,
    buildAppraisalMetadata,
  };
}


