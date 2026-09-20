"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  reviewDocument,
  uploadDocument,
} from "@/lib/api/documents";

import type { DomainRelationshipSelection } from "@/components/metadata/DomainRelationshipSelector";

import type { AdditionalMetadataField, MetadataRecord } from "@/types/metadata";
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
};

export function useDocumentAppraisal({
  canManageDocuments,
  metadata,
  loadData,
  setShowUploadModal,
  loadMetadataDomainRelationships,
  saveMetadataDomainRelationships,
  setDomainRelationshipsError,
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

  const closeUploadModal = () => {
    if (uploading) {
      return;
    }

    setShowUploadModal(false);
    setSelectedFile(null);
    setUploadError("");
    setUploadedDocument(null);
    setUploadedAppraisal(null);
    setReviewingDecision(false);
    setReviewError("");
    setIsCreatingNewMetadata(false);
    setAppraisalDomainRelationships([]);
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
    setAppraisalDomainRelationships([]);

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
      setReviewingDecision(false);
      setReviewError("");
      setAppraisalDomainRelationships([]);

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
        !data.document ||
        typeof data.document !==
          "object"
      ) {
        throw new Error(
          "Document uploaded, but the API returned an invalid document response."
        );
      }

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

      await loadData();
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
      referenceCode || null,

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
        !uploadedDocument?.id ||
        !uploadedAppraisal
      ) {
        return;
      }

      if (isCreatingNewMetadata) {
        closeUploadModal();
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

      if (
        !metadataRecordId &&
        !referenceCode
      ) {
        setReviewError(
          "A metadata reference code has not been assigned to this document."
        );

        return;
      }

      try {
        setReviewingDecision(true);
        setReviewError("");

        const response =
          await reviewDocument(
            Number(
              uploadedDocument.id
            ),
            {
              decision:
                metadataRecordId !== null
                  ? "APPROVE"
                  : "CREATE_METADATA",

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
              "Unable to save the appraisal."
          );
        }

        if (data.document) {
          setUploadedDocument(
            data.document
          );
        }

        const persistedMetadataId =
          Number(
            data.metadata?.id ??
              metadataRecordId ??
              0
          );

        if (
          Number.isInteger(
            persistedMetadataId
          ) &&
          persistedMetadataId > 0
        ) {
          await saveMetadataDomainRelationships(
            persistedMetadataId,
            appraisalDomainRelationships
          );
        }

        await loadData();

        setReviewError("");
        closeUploadModal();
      } catch (error) {
        setReviewError(
          error instanceof Error
            ? error.message
            : "Unable to save the appraisal."
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

      if (
        !uploadedDocument?.id ||
        !uploadedAppraisal
      ) {
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
          "Please complete the required metadata fields before creating the metadata record."
        );

        return;
      }

      try {
        setReviewingDecision(true);
        setReviewError("");

        const response =
          await reviewDocument(
            Number(
              uploadedDocument.id
            ),
            {
              decision:
                "CREATE_METADATA",

              metadataRecordId:
                uploadedAppraisal.metadataRecordId,

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
              "Unable to create and link the new metadata record."
          );
        }

        if (data.document) {
          setUploadedDocument(
            data.document
          );
        }

        const persistedMetadataId =
          Number(
            data.metadata?.id ??
              uploadedAppraisal.metadataRecordId ??
              0
          );

        if (
          Number.isInteger(
            persistedMetadataId
          ) &&
          persistedMetadataId > 0
        ) {
          await saveMetadataDomainRelationships(
            persistedMetadataId,
            appraisalDomainRelationships
          );
        }

        await loadData();

        setUploadedAppraisal(
          (current) =>
            current
              ? {
                  ...current,
                  decision:
                    "NEW_METADATA_CREATED",
                  metadataRecordId:
                    persistedMetadataId ||
                    current.metadataRecordId,
                }
              : current
        );

        setIsCreatingNewMetadata(false);
        setReviewError("");
      } catch (error) {
        setReviewError(
          error instanceof Error
            ? error.message
            : "Unable to create and link the new metadata record."
        );
      } finally {
        setReviewingDecision(false);
      }
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
        !uploadedDocument?.id ||
        !uploadedAppraisal
      ) {
        return;
      }

      if (decision === "REJECT") {
        setReviewError("");
        setIsCreatingNewMetadata(true);

        return;
      }

      if (
        !uploadedAppraisal.metadataRecordId
      ) {
        setReviewError(
          "There is no metadata record available to approve."
        );

        return;
      }

      try {
        setReviewingDecision(true);
        setReviewError("");

        const response =
          await reviewDocument(
            Number(
              uploadedDocument.id
            ),
            {
              decision: "APPROVE",

              metadataRecordId:
                uploadedAppraisal.metadataRecordId,

              metadata:
                buildAppraisalMetadata(
                  appraisalMetadataForm.referenceCode.trim()
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
              "Unable to approve the appraisal decision."
          );
        }

        if (data.document) {
          setUploadedDocument(
            data.document
          );
        }

        const persistedMetadataId =
          Number(
            data.metadata?.id ??
              uploadedAppraisal.metadataRecordId ??
              0
          );

        if (
          Number.isInteger(
            persistedMetadataId
          ) &&
          persistedMetadataId > 0
        ) {
          await saveMetadataDomainRelationships(
            persistedMetadataId,
            appraisalDomainRelationships
          );
        }

        await loadData();

        setUploadedAppraisal(
          (current) =>
            current
              ? {
                  ...current,
                  decision: "LINKED",
                  metadataRecordId:
                    persistedMetadataId ||
                    current.metadataRecordId,
                }
              : current
        );

        setReviewError("");
      } catch (error) {
        setReviewError(
          error instanceof Error
            ? error.message
            : "Unable to approve the appraisal decision."
        );
      } finally {
        setReviewingDecision(false);
      }
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
