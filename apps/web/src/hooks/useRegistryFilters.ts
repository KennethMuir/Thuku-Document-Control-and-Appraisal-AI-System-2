"use client";

import {
  useMemo,
  useState,
} from "react";

import type {
  Department,
} from "@/types/departments";

import type {
  UploadedDocument,
} from "@/types/documents";

import type {
  MetadataRecord,
} from "@/types/metadata";

type DashboardDocumentFilter =
  | "ALL"
  | "LINKED"
  | "UNLINKED"
  | "REVIEW";

type DashboardMetadataFilter =
  | "ALL"
  | "AWAITING_DOCUMENT";

type UseRegistryFiltersOptions = {
  departments: Department[];
  documents: UploadedDocument[];
  metadata: MetadataRecord[];
  searchTerm: string;
  setSearchTerm: (
    value: string
  ) => void;
  setActivePage: (
    value: string
  ) => void;
};

export function useRegistryFilters({
  departments,
  documents,
  metadata,
  searchTerm,
  setSearchTerm,
  setActivePage,
}: UseRegistryFiltersOptions) {
  const [
    dashboardDocumentFilter,
    setDashboardDocumentFilter,
  ] = useState<DashboardDocumentFilter>(
    "ALL"
  );

  const [
    dashboardMetadataFilter,
    setDashboardMetadataFilter,
  ] = useState<DashboardMetadataFilter>(
    "ALL"
  );

  const [
    selectedDepartmentId,
    setSelectedDepartmentId,
  ] = useState<number | null>(
    null
  );

  const openDepartmentRecords = (
    department: Department
  ) => {
    setSelectedDepartmentId(
      department.id
    );

    setSearchTerm("");

    setActivePage(
      "Metadata Registry"
    );
  };

  const handleDashboardStatCardClick = (
    key:
      | "documents"
      | "metadata"
      | "awaiting"
      | "review"
      | "linked"
      | "unlinked"
  ) => {
    setSelectedDepartmentId(
      null
    );

    setSearchTerm("");

    switch (key) {
      case "documents":
        setDashboardDocumentFilter(
          "ALL"
        );

        setActivePage(
          "Documents"
        );
        break;

      case "metadata":
        setDashboardMetadataFilter(
          "ALL"
        );

        setActivePage(
          "Metadata Registry"
        );
        break;

      case "awaiting":
        setDashboardMetadataFilter(
          "AWAITING_DOCUMENT"
        );

        setActivePage(
          "Metadata Registry"
        );
        break;

      case "review":
        setDashboardDocumentFilter(
          "REVIEW"
        );

        setActivePage(
          "Documents"
        );
        break;

      case "linked":
        setDashboardDocumentFilter(
          "LINKED"
        );

        setActivePage(
          "Documents"
        );
        break;

      case "unlinked":
        setDashboardDocumentFilter(
          "UNLINKED"
        );

        setActivePage(
          "Documents"
        );
        break;
    }
  };

  const filteredMetadata =
    useMemo(() => {
      return metadata.filter(
        (
          record: MetadataRecord
        ) => {
          if (
            dashboardMetadataFilter !==
              "ALL" &&
            record.status !==
              dashboardMetadataFilter
          ) {
            return false;
          }

          if (
            selectedDepartmentId !==
            null
          ) {
            const department =
              departments.find(
                (
                  item
                ) =>
                  item.id ===
                  selectedDepartmentId
              );

            if (
              !department ||
              record.department_name !==
                department.name
            ) {
              return false;
            }
          }

          const query =
            searchTerm
              .trim()
              .toLowerCase();

          if (!query) {
            return true;
          }

          return [
            record.reference_code,
            record.title,
            record.person_name,
            record.description,
            record.section,
            record.department_name,
            record.document_type_name,
            record.status,
            record.linked_document_code,
            record.linked_filename,
          ]
            .filter(Boolean)
            .some(
              (
                value
              ) =>
                String(
                  value
                )
                  .toLowerCase()
                  .includes(
                    query
                  )
            );
        }
      );
    }, [
      metadata,
      departments,
      dashboardMetadataFilter,
      selectedDepartmentId,
      searchTerm,
    ]);

  const selectedDepartment =
    useMemo(
      () =>
        selectedDepartmentId !==
        null
          ? departments.find(
              (
                department
              ) =>
                department.id ===
                selectedDepartmentId
            ) ?? null
          : null,
      [
        departments,
        selectedDepartmentId,
      ]
    );

  const dashboardFilteredDocuments =
    useMemo(() => {
      if (
        dashboardDocumentFilter ===
        "ALL"
      ) {
        return documents;
      }

      return documents.filter(
        (
          document
        ) => {
          const status =
            String(
              document.status ??
                ""
            ).toUpperCase();

          if (
            dashboardDocumentFilter ===
            "LINKED"
          ) {
            return (
              status ===
              "LINKED"
            );
          }

          if (
            dashboardDocumentFilter ===
            "UNLINKED"
          ) {
            return (
              status ===
              "UNLINKED"
            );
          }

          return (
            status ===
              "REVIEW_REQUIRED" ||
            status ===
              "NEEDS_REVIEW" ||
            status ===
              "REVIEW"
          );
        }
      );
    }, [
      documents,
      dashboardDocumentFilter,
    ]);

  const selectedDepartmentDocuments =
    useMemo(
      () =>
        selectedDepartmentId !==
        null
          ? documents.filter(
              (
                document
              ) => {
                const documentDepartmentId =
                  document.department_id;

                return (
                  documentDepartmentId !==
                    undefined &&
                  documentDepartmentId !==
                    null &&
                  Number(
                    documentDepartmentId
                  ) ===
                    selectedDepartmentId
                );
              }
            )
          : [],
      [
        documents,
        selectedDepartmentId,
      ]
    );

  return {
    dashboardDocumentFilter,
    setDashboardDocumentFilter,

    dashboardMetadataFilter,
    setDashboardMetadataFilter,

    selectedDepartmentId,
    setSelectedDepartmentId,

    selectedDepartment,

    filteredMetadata,

    dashboardFilteredDocuments,

    selectedDepartmentDocuments,

    openDepartmentRecords,
    handleDashboardStatCardClick,
  };
}