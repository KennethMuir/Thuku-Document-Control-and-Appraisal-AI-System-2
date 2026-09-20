"use client";

import { useState } from "react";

import {
  importBulkMetadata,
  previewBulkMetadata,
} from "@/lib/api/metadata";

type BulkMetadataPreview = {
  totalRows: number;
  rows: Array<Record<string, unknown>>;
  existingReferenceCodes: string[];
  canImport: boolean;
  truncated: boolean;
};

type UseBulkMetadataOptions = {
  canManageMetadata: boolean;
  refreshData: () => Promise<void>;
};

export function useBulkMetadata({
  canManageMetadata,
  refreshData,
}: UseBulkMetadataOptions) {
  const [
    showBulkMetadataModal,
    setShowBulkMetadataModal,
  ] = useState(false);

  const [
    bulkMetadataFile,
    setBulkMetadataFile,
  ] = useState<File | null>(null);

  const [
    bulkMetadataPreview,
    setBulkMetadataPreview,
  ] = useState<BulkMetadataPreview | null>(
    null
  );

  const [
    bulkMetadataError,
    setBulkMetadataError,
  ] = useState("");

  const [
    bulkMetadataLoading,
    setBulkMetadataLoading,
  ] = useState(false);

  const [
    bulkMetadataImporting,
    setBulkMetadataImporting,
  ] = useState(false);

  const closeBulkMetadataModal = () => {
    if (
      bulkMetadataLoading ||
      bulkMetadataImporting
    ) {
      return;
    }

    setShowBulkMetadataModal(false);
    setBulkMetadataFile(null);
    setBulkMetadataPreview(null);
    setBulkMetadataError("");
  };

  const downloadBulkMetadataTemplate = () => {
    const csv = [
      "reference_code,person_name,title,department,document_type,year,document_date,section,description,contract_number,employee_number,expiry_date",
      "DOC-EXAMPLE-001,Jane Doe,Example Document,Finance,Contract,2026,2026-01-15,Section A,Example metadata record,CNT-2026-001,EMP-00001,2028-06-30",
    ].join("\r\n");

    const blob = new Blob(
      [csv],
      {
        type: "text/csv;charset=utf-8;",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const anchor =
      document.createElement("a");

    anchor.href = url;
    anchor.download =
      "metadata-upload-template.csv";

    document.body.appendChild(anchor);

    anchor.click();

    anchor.remove();

    URL.revokeObjectURL(url);
  };

  const handleBulkMetadataPreview =
    async () => {
      if (
        !canManageMetadata ||
        !bulkMetadataFile
      ) {
        return;
      }

      setBulkMetadataLoading(true);

      setBulkMetadataError("");

      setBulkMetadataPreview(null);

      try {
        const formData =
          new FormData();

        formData.append(
          "file",
          bulkMetadataFile
        );

        const response =
          await previewBulkMetadata(
            formData
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            Array.isArray(data.errors)
              ? data.errors.join("\n")
              : data.error ||
                  "Unable to preview bulk metadata."
          );
        }

        setBulkMetadataPreview({
          totalRows: Number(
            data.totalRows || 0
          ),
          rows: Array.isArray(
            data.rows
          )
            ? data.rows
            : [],
          existingReferenceCodes:
            Array.isArray(
              data.existingReferenceCodes
            )
              ? data.existingReferenceCodes
              : [],
          canImport:
            data.canImport !== false,
          truncated:
            data.truncated === true,
        });
      } catch (error) {
        setBulkMetadataError(
          error instanceof Error
            ? error.message
            : "Unable to preview bulk metadata."
        );
      } finally {
        setBulkMetadataLoading(false);
      }
    };

  const handleBulkMetadataImport =
    async () => {
      if (
        !canManageMetadata ||
        !bulkMetadataFile ||
        !bulkMetadataPreview?.canImport
      ) {
        return;
      }

      setBulkMetadataImporting(true);

      setBulkMetadataError("");

      try {
        const formData =
          new FormData();

        formData.append(
          "file",
          bulkMetadataFile
        );

        const response =
          await importBulkMetadata(
            formData
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            Array.isArray(data.errors)
              ? data.errors.join("\n")
              : data.error ||
                  "Unable to import metadata."
          );
        }

        const importedCount =
          Number(
            data.importedCount ||
              data.count ||
              bulkMetadataPreview.totalRows
          );

        closeBulkMetadataModal();

        await refreshData();

        window.alert(
          `${importedCount} metadata records imported successfully.`
        );
      } catch (error) {
        setBulkMetadataError(
          error instanceof Error
            ? error.message
            : "Unable to import metadata."
        );
      } finally {
        setBulkMetadataImporting(false);
      }
    };

  return {
    showBulkMetadataModal,
    setShowBulkMetadataModal,

    bulkMetadataFile,
    setBulkMetadataFile,

    bulkMetadataPreview,
    setBulkMetadataPreview,

    bulkMetadataError,
    setBulkMetadataError,

    bulkMetadataLoading,

    bulkMetadataImporting,

    closeBulkMetadataModal,
    handleBulkMetadataPreview,
    handleBulkMetadataImport,
    downloadBulkMetadataTemplate,
  };
}