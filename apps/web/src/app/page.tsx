"use client";

import { Modals } from "@/components/modals/Modals";
import { Departments } from "@/components/departments/Departments";
import { Settings } from "@/components/settings/Settings";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  getDepartments,
} from "@/lib/api/departments";

import { getDashboard } from "@/lib/api/dashboard";
import { getDocumentTypes } from "@/lib/api/document-types";

import {
  getDocuments,
  getDocumentFile,
  reviewDocument,
  uploadDocument,
} from "@/lib/api/documents";

import { searchDocuments } from "@/lib/api/search";

import {
  createMetadata,
  getMetadata,
  importBulkMetadata,
  previewBulkMetadata,
} from "@/lib/api/metadata";

import { getUsers, updateUser } from "@/lib/api/users";

import {
  createDomainRelationship,
  deleteDomainRelationship,
  getMetadataDomainRelationships,
  getRelationshipTypes,
} from "@/lib/api/domainRelationships";

import { getDomainRegistry } from "@/lib/api/domainRegistry";

import type {
  DomainRelationshipSelection,
  DomainRelationshipDomain,
  DomainRelationshipType,
} from "@/components/metadata/DomainRelationshipSelector";

import { Search } from "@/components/search/Search";
import { SummaryCard } from "@/components/common/SummaryCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { FormField } from "@/components/common/FormField";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useDepartmentManagement } from "@/hooks/useDepartmentManagement";
import { useBulkMetadata } from "@/hooks/useBulkMetadata";
import { useDocumentAppraisal } from "@/hooks/useDocumentAppraisal";

import type {
  ChangeEvent,
  FormEvent,
} from "react";

import {
  formatFileSize,
  formatUploadFieldLabel,
  formatUploadFieldValue,
} from "@/lib/utils/formatting";

import type {
  AuthUser,
  UserManagementUser,
} from "@/types/auth";

import type {
  Statistics,
} from "@/types/dashboard";

import type {
  Department,
  DocumentType,
} from "@/types/departments";

import type {
  UploadedDocument,
} from "@/types/documents";

import type {
  UploadedAppraisal,
} from "@/types/appraisal";

import type {
  AdditionalMetadataField,
  MetadataRecord,
} from "@/types/metadata";

import type {
  SearchResult,
} from "@/types/search";

import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { MetadataRegistry } from "@/components/metadata/MetadataRegistry";
import { DomainRegistry } from "@/components/metadata/DomainRegistry";
import { Documents } from "@/components/documents/Documents";
import { Dashboard } from "@/components/dashboard/Dashboard";

const statCards = [
  {
    key: "documents",
    label: "Total Documents",
    description: "Documents stored in the system",
    icon: "▣",
  },
  {
    key: "metadata",
    label: "Metadata Records",
    description: "Pre-fed and registered records",
    icon: "◫",
  },
  {
    key: "awaiting",
    label: "Awaiting Documents",
    description: "Metadata waiting for a physical file",
    icon: "◷",
  },
  {
    key: "review",
    label: "Needs Review",
    description: "Potential matches requiring a decision",
    icon: "!",
  },
  {
    key: "linked",
    label: "Linked Documents",
    description: "Documents matched to metadata",
    icon: "✓",
  },
  {
    key: "unlinked",
    label: "Unlinked Documents",
    description: "Documents requiring appraisal",
    icon: "○",
  },
] as const;

const EMPTY_FORM = {
  referenceCode: "",
  personName: "",
  title: "",
  departmentId: "",
  documentTypeId: "",
  year: "",
  documentDate: "",
  section: "",
  description: "",
  additionalMetadata: [] as AdditionalMetadataField[],
};

export default function Home() {
  const [activePage, setActivePage] =
    useState("Dashboard");

  const [
    dashboardDocumentFilter,
    setDashboardDocumentFilter,
  ] = useState<
    "ALL" | "LINKED" | "UNLINKED" | "REVIEW"
  >("ALL");

  const [
    dashboardMetadataFilter,
    setDashboardMetadataFilter,
  ] = useState<
    "ALL" | "AWAITING_DOCUMENT"
  >("ALL");

  const {
    authUser,
    authLoading,
    authError,
    loggingOut,
    canManageDocuments,
    canManageMetadata,
    canManageDepartments,
    canManageDomains,
    logout,
  } = useAuthSession();
  const [statistics, setStatistics] =
    useState<Statistics | null>(null);

  const [
    userManagementUsers,
    setUserManagementUsers,
  ] = useState<UserManagementUser[]>([]);

  const [
    userManagementLoading,
    setUserManagementLoading,
  ] = useState(false);

  const [
    userManagementError,
    setUserManagementError,
  ] = useState("");

  const [
    updatingUserId,
    setUpdatingUserId,
  ] = useState<number | null>(null);

  const [metadata, setMetadata] =
    useState<MetadataRecord[]>([]);const [documentTypes, setDocumentTypes] =
    useState<DocumentType[]>([]);

  /*
   * =============================================================
   * M23 DOMAIN RELATIONSHIP STATE
   * =============================================================
   */

  const [
    domainRelationshipDomains,
    setDomainRelationshipDomains,
  ] = useState<DomainRelationshipDomain[]>([]);

  const [
    domainRelationshipTypes,
    setDomainRelationshipTypes,
  ] = useState<DomainRelationshipType[]>([]);

  const [
    metadataDomainRelationships,
    setMetadataDomainRelationships,
  ] = useState<DomainRelationshipSelection[]>([]);

  

  const [
    domainRelationshipsLoading,
    setDomainRelationshipsLoading,
  ] = useState(false);

  const [
    domainRelationshipsError,
    setDomainRelationshipsError,
  ] = useState("");

  const [documents, setDocuments] =
    useState<UploadedDocument[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [
    showMetadataModal,
    setShowMetadataModal,
  ] = useState(false);

  const [
    showUploadModal,
    setShowUploadModal,
  ] = useState(false);

  

  

  

  

  

  

  

  

  const [
    expandedAdditionalMetadata,
    setExpandedAdditionalMetadata,
  ] = useState<Set<string>>(new Set());

  

  

  

  

  const [searchResults, setSearchResults] =
    useState<SearchResult[]>([]);

  const [searchLoading, setSearchLoading] =
    useState(false);

  const [searchError, setSearchError] =
    useState("");

  const [searchTerm, setSearchTerm] =
    useState("");

  const [
    selectedDepartmentId,
    setSelectedDepartmentId,
  ] = useState<number | null>(null);


  const {
    departments,
    setDepartments,
    departmentModalOpen,
    setDepartmentModalOpen,
    departmentEditingId,
    setDepartmentEditingId,
    departmentForm,
    setDepartmentForm,
    departmentMutationError,
    setDepartmentMutationError,
    departmentSaving,
    setDepartmentSaving,
    refreshDepartments,
    openAddDepartmentModal,
    openEditDepartmentModal,
    closeDepartmentModal,
    saveDepartment,
    deleteDepartment,
  } = useDepartmentManagement({
    canManageDepartments,
    selectedDepartmentId,
    setSelectedDepartmentId,
  });
  const openDepartmentRecords = (
    department: Department
  ) => {
    setSelectedDepartmentId(department.id);
    setSearchTerm("");
    setActivePage("Metadata Registry");
  };

  const appContentRef =
    useRef<HTMLDivElement | null>(null);

  const modalRef =
    useRef<HTMLDivElement | null>(null);

  const modalCloseButtonRef =
    useRef<HTMLButtonElement | null>(null);

  const previousFocusedElementRef =
    useRef<HTMLElement | null>(null);

  const previousBodyOverflowRef =
    useRef("");

  const bodyScrollLockActiveRef =
    useRef(false);

  

  const [form, setForm] =
    useState(EMPTY_FORM);

  /*
   * =============================================================
   * UPLOAD STATE REF
   * =============================================================
   */

  

  /*
   * =============================================================
   * M23 DOMAIN REGISTRY / RELATIONSHIP LOADERS
   * =============================================================
   */

  const loadDomainRelationshipDefinitions =
    async () => {
      if (!authUser) {
        return;
      }

      try {
        setDomainRelationshipsLoading(true);
        setDomainRelationshipsError("");

        const [
          domainsResponse,
          relationshipTypesResponse,
        ] = await Promise.all([
          getDomainRegistry(),
          getRelationshipTypes(),
        ]);

        const [
          domainsData,
          relationshipTypesData,
        ] = await Promise.all([
          domainsResponse.json(),
          relationshipTypesResponse.json(),
        ]);

        if (
          !domainsResponse.ok ||
          !domainsData.success
        ) {
          throw new Error(
            domainsData.error ||
              "Unable to load the domain registry."
          );
        }

        if (
          !relationshipTypesResponse.ok ||
          !relationshipTypesData.success
        ) {
          throw new Error(
            relationshipTypesData.error ||
              "Unable to load domain relationship types."
          );
        }

        const rawDomains =
          Array.isArray(domainsData.domains)
            ? domainsData.domains
            : [];

        const normalizedDomains =
          rawDomains
            .map(
              (
                domain: Record<string, unknown>
              ) => {
                const id = Number(
                  domain.id
                );

                const domainKey =
                  String(
                    domain.domain_key ??
                      domain.domainKey ??
                      ""
                  ).trim();

                const displayName =
                  String(
                    domain.display_name ??
                      domain.displayName ??
                      domainKey
                  ).trim();

                if (
                  !Number.isInteger(id) ||
                  id <= 0 ||
                  !domainKey
                ) {
                  return null;
                }

                return {
                  id,
                  domain_key: domainKey,
                  display_name:
                    displayName,
                  description:
                    domain.description == null
                      ? null
                      : String(
                          domain.description
                        ),
                  domain_family:
                    domain.domain_family == null
                      ? null
                      : String(
                          domain.domain_family
                        ),
                };
              }
            )
            .filter(
              (domain: unknown): domain is DomainRelationshipDomain =>
                domain !== null
            );

        const rawTypes =
          Array.isArray(
            relationshipTypesData.relationshipTypes
          )
            ? relationshipTypesData.relationshipTypes
            : Array.isArray(
                relationshipTypesData.types
              )
              ? relationshipTypesData.types
              : [];

        const normalizedTypes =
          rawTypes
            .map(
              (
                relationshipType: unknown
              ) => {
                if (
                  typeof relationshipType ===
                  "string"
                ) {
                  return {
                    value:
                      relationshipType,
                    label:
                      relationshipType,
                  };
                }

                if (
                  !relationshipType ||
                  typeof relationshipType !==
                    "object"
                ) {
                  return null;
                }

                const item =
                  relationshipType as Record<
                    string,
                    unknown
                  >;

                const value =
                  String(
                    item.value ??
                      item.relationship_type ??
                      item.relationshipType ??
                      item.key ??
                      ""
                  ).trim();

                if (!value) {
                  return null;
                }

                return {
                  value,
                  label:
                    String(
                      item.label ??
                        item.display_name ??
                        item.displayName ??
                        value
                    ).trim() || value,
                };
              }
            )
            .filter(
              (relationshipType: unknown): relationshipType is DomainRelationshipType =>
                relationshipType !== null
            );

        setDomainRelationshipDomains(
          normalizedDomains
        );

        setDomainRelationshipTypes(
          normalizedTypes
        );
      } catch (error) {
        console.error(
          "Unable to load domain relationship definitions:",
          error
        );

        setDomainRelationshipsError(
          error instanceof Error
            ? error.message
            : "Unable to load domain relationships."
        );
      } finally {
        setDomainRelationshipsLoading(
          false
        );
      }
    };

  const extractRelationshipSelections =
    (
      data: Record<string, unknown>
    ): DomainRelationshipSelection[] => {
      const relationships =
        Array.isArray(
          data.relationships
        )
          ? data.relationships
          : [];

      return relationships
        .map(
          (
            relationship: unknown
          ) => {
            if (
              !relationship ||
              typeof relationship !==
                "object"
            ) {
              return null;
            }

            const item =
              relationship as Record<
                string,
                unknown
              >;

            const domainId = Number(
              item.domain_id ??
                item.domainId ??
                (
                  item.domain &&
                  typeof item.domain ===
                    "object"
                    ? (
                        item.domain as Record<
                          string,
                          unknown
                        >
                      ).id
                    : undefined
                )
            );

            const relationshipType =
              String(
                item.relationship_type ??
                  item.relationshipType ??
                  ""
              ).trim();

            if (
              !Number.isInteger(
                domainId
              ) ||
              domainId <= 0 ||
              !relationshipType
            ) {
              return null;
            }

            return {
              domainId,
              relationshipType,
            };
          }
        )
        .filter(
          (
            relationship
          ): relationship is DomainRelationshipSelection =>
            relationship !== null
        );
    };

  const loadMetadataDomainRelationships =
    async (
      metadataRecordId:
        | string
        | number
        | null
        | undefined
    ) => {
      if (
        metadataRecordId === null ||
        metadataRecordId ===
          undefined ||
        String(metadataRecordId).trim() ===
          ""
      ) {
        setMetadataDomainRelationships(
          []
        );

        setAppraisalDomainRelationships(
          []
        );

        return;
      }

      try {
        setDomainRelationshipsLoading(
          true
        );
        setDomainRelationshipsError("");

        const response =
          await getMetadataDomainRelationships(
            metadataRecordId
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.error ||
              "Unable to load metadata domain relationships."
          );
        }

        const selections =
          extractRelationshipSelections(
            data
          );

        setMetadataDomainRelationships(
          selections
        );

        setAppraisalDomainRelationships(
          selections
        );
      } catch (error) {
        console.error(
          "Unable to load metadata domain relationships:",
          error
        );

        setMetadataDomainRelationships(
          []
        );

        setAppraisalDomainRelationships(
          []
        );

        setDomainRelationshipsError(
          error instanceof Error
            ? error.message
            : "Unable to load metadata domain relationships."
        );
      } finally {
        setDomainRelationshipsLoading(
          false
        );
      }
    };

  const saveMetadataDomainRelationships =
    async (
      metadataRecordId: string | number,
      desiredRelationships:
        DomainRelationshipSelection[]
    ) => {
      const numericMetadataId =
        Number(metadataRecordId);

      if (
        !Number.isInteger(
          numericMetadataId
        ) ||
        numericMetadataId <= 0
      ) {
        throw new Error(
          "A valid metadata record is required before domain relationships can be saved."
        );
      }

      setDomainRelationshipsLoading(
        true
      );
      setDomainRelationshipsError("");

      try {
        const currentResponse =
          await getMetadataDomainRelationships(
            numericMetadataId
          );

        const currentData =
          await currentResponse.json();

        if (
          !currentResponse.ok ||
          !currentData.success
        ) {
          throw new Error(
            currentData.error ||
              "Unable to retrieve the current metadata domain relationships."
          );
        }

        const currentRelationships =
          Array.isArray(
            currentData.relationships
          )
            ? currentData.relationships
            : [];

        const currentSelections =
          extractRelationshipSelections(
            currentData
          );

        const keyFor =
          (
            relationship: DomainRelationshipSelection
          ) =>
            `${relationship.domainId}:${relationship.relationshipType}`;

        const desiredKeys =
          new Set(
            desiredRelationships.map(
              keyFor
            )
          );

        const currentKeys =
          new Set(
            currentSelections.map(
              keyFor
            )
          );

        /*
         * Delete relationships that were removed
         * from the selector.
         */
        for (
          const relationship of currentRelationships
        ) {
          if (
            !relationship ||
            typeof relationship !==
              "object"
          ) {
            continue;
          }

          const item =
            relationship as Record<
              string,
              unknown
            >;

          const relationshipId =
            Number(
              item.id
            );

          const domainId =
            Number(
              item.domain_id ??
                item.domainId
            );

          const relationshipType =
            String(
              item.relationship_type ??
                item.relationshipType ??
                ""
            ).trim();

          if (
            !Number.isInteger(
              relationshipId
            ) ||
            relationshipId <= 0 ||
            !Number.isInteger(
              domainId
            ) ||
            domainId <= 0 ||
            !relationshipType
          ) {
            continue;
          }

          const key =
            `${domainId}:${relationshipType}`;

          if (
            !desiredKeys.has(key)
          ) {
            const response =
              await deleteDomainRelationship(
                relationshipId
              );

            const data =
              await response.json();

            if (
              !response.ok ||
              !data.success
            ) {
              throw new Error(
                data.error ||
                  "Unable to remove a metadata domain relationship."
              );
            }
          }
        }

        /*
         * Create newly selected relationships.
         */
        for (
          const relationship of desiredRelationships
        ) {
          const key =
            keyFor(
              relationship
            );

          if (
            currentKeys.has(key)
          ) {
            continue;
          }

          const response =
            await createDomainRelationship({
              metadata_record_id:
                numericMetadataId,
              domain_id:
                relationship.domainId,
              relationship_type:
                relationship.relationshipType,
            });

          const data =
            await response.json();

          if (
            !response.ok ||
            !data.success
          ) {
            throw new Error(
              data.error ||
                "Unable to create a metadata domain relationship."
            );
          }
        }

        /*
         * Re-read the server state so the UI reflects
         * the actual persisted relationships.
         */
        const finalResponse =
          await getMetadataDomainRelationships(
            numericMetadataId
          );

        const finalData =
          await finalResponse.json();

        if (
          !finalResponse.ok ||
          !finalData.success
        ) {
          throw new Error(
            finalData.error ||
              "Domain relationships were saved but could not be reloaded."
          );
        }

        const finalSelections =
          extractRelationshipSelections(
            finalData
          );

        setMetadataDomainRelationships(
          finalSelections
        );

        setAppraisalDomainRelationships(
          finalSelections
        );

        return finalSelections;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to save metadata domain relationships.";

        setDomainRelationshipsError(
          message
        );

        throw error;
      } finally {
        setDomainRelationshipsLoading(
          false
        );
      }
    };

  /*
   * =============================================================
   * INITIAL DATA
   * =============================================================
   */

  const getStatValue = (
    key: (typeof statCards)[number]["key"]
  ): string | number => {
    if (!statistics) {
      return "—";
    }

    return statistics[key] ?? "—";
  };

  const handleDashboardStatCardClick = (
    key: (typeof statCards)[number]["key"]
  ) => {
    setSelectedDepartmentId(null);
    setSearchTerm("");

    switch (key) {
      case "documents":
        setDashboardDocumentFilter("ALL");
        setActivePage("Documents");
        break;

      case "metadata":
        setDashboardMetadataFilter("ALL");
        setActivePage("Metadata Registry");
        break;

      case "awaiting":
        setDashboardMetadataFilter(
          "AWAITING_DOCUMENT"
        );
        setActivePage("Metadata Registry");
        break;

      case "review":
        setDashboardDocumentFilter("REVIEW");
        setActivePage("Documents");
        break;

      case "linked":
        setDashboardDocumentFilter("LINKED");
        setActivePage("Documents");
        break;

      case "unlinked":
        setDashboardDocumentFilter("UNLINKED");
        setActivePage("Documents");
        break;
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);

      const [
        dashboardResponse,
        metadataResponse,
        departmentsResponse,
        typesResponse,
        documentsResponse,
      ] = await Promise.all([
        getDashboard(),
        getMetadata(),
        getDepartments(),
        getDocumentTypes(),
        getDocuments(),
      ]);

      const [
        dashboardData,
        metadataData,
        departmentsData,
        typesData,
        documentsData,
      ] = await Promise.all([
        dashboardResponse.json(),
        metadataResponse.json(),
        departmentsResponse.json(),
        typesResponse.json(),
        documentsResponse.json(),
      ]);

      if (dashboardData.success) {
        setStatistics(
          dashboardData.statistics ??
            dashboardData.dashboard ??
            null
        );
      }

      if (metadataData.success) {
        setMetadata(
          Array.isArray(
            metadataData.metadata
          )
            ? metadataData.metadata
            : []
        );
      }

      if (departmentsData.success) {
        setDepartments(
          Array.isArray(
            departmentsData.departments
          )
            ? departmentsData.departments
            : []
        );
      }

      if (typesData.success) {
        setDocumentTypes(
          Array.isArray(
            typesData.documentTypes
          )
            ? typesData.documentTypes
            : []
        );
      }

      if (documentsData.success) {
        setDocuments(
          Array.isArray(
            documentsData.documents
          )
            ? documentsData.documents
            : []
        );
      }
    } catch (error) {
      console.error(
        "Unable to load system data:",
        error
      );
    } finally {
      setLoading(false);
    }
  };

  const {
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
  } = useDocumentAppraisal({
    canManageDocuments,
    metadata,
    loadData,
    setShowUploadModal,
    loadMetadataDomainRelationships,
    saveMetadataDomainRelationships,
    setDomainRelationshipsError,
  });




  const {
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
  } = useBulkMetadata({
    canManageMetadata,
    refreshData: loadData,
  });
  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!authUser) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError("");
      return;
    }

    const query =
      searchTerm.trim();

    if (!query) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError("");
      return;
    }

    let cancelled = false;

    const timer =
      window.setTimeout(
        async () => {
          try {
            setSearchLoading(true);
            setSearchError("");

            const response =
              await searchDocuments(
                query
              );

            const data =
              await response.json();

            if (cancelled) {
              return;
            }

            if (
              !response.ok ||
              !data.success
            ) {
              throw new Error(
                data.error ||
                  "Unable to search records."
              );
            }

            setSearchResults(
              Array.isArray(
                data.results
              )
                ? data.results
                : []
            );
          } catch (error) {
            if (cancelled) {
              return;
            }

            console.error(
              "Search request failed:",
              error
            );

            setSearchResults([]);

            setSearchError(
              error instanceof Error
                ? error.message
                : "Unable to search records."
            );
          } finally {
            if (!cancelled) {
              setSearchLoading(
                false
              );
            }
          }
        },
        300
      );

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    searchTerm,
    authLoading,
    authUser,
  ]);

  useEffect(() => {
    if (!authUser) {
      return;
    }

    void loadDomainRelationshipDefinitions();
  }, [authUser]);

  /*
   * =============================================================
   * MODAL CLOSE HELPERS
   * =============================================================
   */

  const closeMetadataModal = () => {
    setShowMetadataModal(false);
    setMetadataDomainRelationships([]);
    setDomainRelationshipsError("");
  };

  

  /*
   * =============================================================
   * METADATA SUBMISSION
   * =============================================================
   */

  const handleMetadataSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    if (!canManageMetadata) {
      return;
    }

    event.preventDefault();

    try {
      setDomainRelationshipsError("");

      const response =
        await createMetadata({
          referenceCode:
            form.referenceCode.trim(),

          personName:
            form.personName.trim() ||
            null,

          title:
            form.title.trim() ||
            null,

          departmentId:
            form.departmentId ||
            null,

          documentTypeId:
            form.documentTypeId ||
            null,

          year:
            form.year ||
            null,

          documentDate:
            form.documentDate ||
            null,

          section:
            form.section.trim() ||
            null,

          description:
            form.description.trim() ||
            null,
        });

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Unable to create metadata record."
        );
      }

      const metadataRecordId =
        Number(
          data.metadata?.id ??
            data.record?.id ??
            data.id ??
            0
        );

      if (
        Number.isInteger(
          metadataRecordId
        ) &&
        metadataRecordId > 0
      ) {
        await saveMetadataDomainRelationships(
          metadataRecordId,
          metadataDomainRelationships
        );
      }

      setForm({
        ...EMPTY_FORM,
      });

      setMetadataDomainRelationships(
        []
      );

      closeMetadataModal();

      await loadData();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to create metadata record."
      );
    }
  };

  /*
   * =============================================================
   * FILE SELECTION
   * =============================================================
   */

  

  /*
   * =============================================================
   * DOCUMENT UPLOAD
   * =============================================================
   */

  

  /*
   * =============================================================
   * APPRAISAL REVIEW
   * =============================================================
   */

  const handleOpenDocument =
    async (
      documentId:
        | string
        | number
    ) => {
      const numericDocumentId =
        Number(documentId);

      if (
        !Number.isInteger(
          numericDocumentId
        ) ||
        numericDocumentId <= 0
      ) {
        return;
      }

      const documentWindow =
        window.open(
          "",
          "_blank"
        );

      if (!documentWindow) {
        setReviewError(
          "Unable to open the document. Please allow pop-ups for this site and try again."
        );

        return;
      }

      documentWindow.document.title =
        "Opening document...";

      try {
        setReviewError("");

        const response =
          await getDocumentFile(
            numericDocumentId
          );

        if (!response.ok) {
          let errorMessage =
            "Unable to open the document.";

          try {
            const data =
              await response.json();

            if (
              data &&
              typeof data.error ===
                "string" &&
              data.error.trim()
            ) {
              errorMessage =
                data.error;
            }
          } catch {
            // Non-JSON error response.
          }

          throw new Error(
            errorMessage
          );
        }

        const blob =
          await response.blob();

        const objectUrl =
          URL.createObjectURL(
            blob
          );

        documentWindow.location.href =
          objectUrl;

        window.setTimeout(
          () => {
            URL.revokeObjectURL(
              objectUrl
            );
          },
          60_000
        );
      } catch (error) {
        documentWindow.close();

        console.error(
          "Document opening failed:",
          error
        );

        setReviewError(
          error instanceof Error
            ? error.message
            : "Unable to open the document."
        );
      }
    };

  

  

  

  

  

  

  /*
   * =============================================================
   * USER MANAGEMENT
   * =============================================================
   */

  const loadUserManagementUsers =
    async () => {
      if (
        authUser?.role !==
        "ADMIN"
      ) {
        return;
      }

      try {
        setUserManagementLoading(
          true
        );

        setUserManagementError("");

        const response =
          await getUsers();

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.error ||
              "Unable to retrieve users."
          );
        }

        setUserManagementUsers(
          Array.isArray(
            data.users
          )
            ? data.users
            : []
        );
      } catch (error) {
        console.error(
          "User management load failed:",
          error
        );

        setUserManagementUsers(
          []
        );

        setUserManagementError(
          error instanceof Error
            ? error.message
            : "Unable to retrieve users."
        );
      } finally {
        setUserManagementLoading(
          false
        );
      }
    };

  const updateManagedUser =
    async (
      userId: number,
      changes: {
        role?:
          | "ADMIN"
          | "APPRAISER"
          | "VIEWER";

        isActive?: boolean;
      }
    ) => {
      if (
        authUser?.role !==
        "ADMIN"
      ) {
        return;
      }

      try {
        setUpdatingUserId(
          userId
        );

        setUserManagementError("");

        const response =
          await updateUser(
            userId,
            changes
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.error ||
              "Unable to update user."
          );
        }

        setUserManagementUsers(
          (
            currentUsers
          ) =>
            currentUsers.map(
              (
                user
              ) =>
                user.id ===
                userId
                  ? data.user
                  : user
            )
        );
      } catch (error) {
        console.error(
          "User update failed:",
          error
        );

        setUserManagementError(
          error instanceof Error
            ? error.message
            : "Unable to update user."
        );
      } finally {
        setUpdatingUserId(
          null
        );
      }
    };

  useEffect(() => {
    if (
      activePage ===
        "Settings" &&
      authUser?.role ===
        "ADMIN"
    ) {
      void loadUserManagementUsers();
    }
  }, [
    activePage,
    authUser?.role,
  ]);


  /*
   * =============================================================
   * DERIVED STATE
   * =============================================================
   */

  

  

  

  

  const filteredMetadata =
    metadata.filter(
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

  const selectedDepartment =
    selectedDepartmentId !==
    null
      ? departments.find(
          (
            department
          ) =>
            department.id ===
            selectedDepartmentId
        ) ?? null
      : null;

  const dashboardFilteredDocuments =
    dashboardDocumentFilter ===
    "ALL"
      ? documents
      : documents.filter(
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

  const selectedDepartmentDocuments =
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
      : [];

  /*
   * =============================================================
   * AUTH GATES
   * =============================================================
   */

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7fa] text-slate-900">
        <div className="rounded-2xl border border-slate-200 bg-white px-8 py-6 text-center shadow-sm">
          <p className="text-sm font-semibold">
            Verifying your session...
          </p>

          <p className="mt-2 text-xs text-slate-500">
            Please wait.
          </p>
        </div>
      </main>
    );
  }

  if (!authUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7fa] text-slate-900">
        <div className="rounded-2xl border border-slate-200 bg-white px-8 py-6 text-center shadow-sm">
          <p className="text-sm font-semibold">
            {authError ||
              "Redirecting to sign in..."}
          </p>

          {authError ? (
            <button
              type="button"
              onClick={() => {
                window.location.href =
                  "/login";
              }}
              className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Go to sign in
            </button>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f7fa] text-slate-900">
      <div
        ref={appContentRef}
        className="flex min-h-screen"
      >
        <Sidebar
          activePage={activePage}
          setActivePage={setActivePage}
          canManageDocuments={
            canManageDocuments
          }
          setShowUploadModal={
            setShowUploadModal
          }
          authUser={authUser}
          logout={logout}
          loggingOut={loggingOut}
        />

        <section className="flex-1">
          <TopBar
            activePage={activePage}
            setActivePage={setActivePage}
            canManageDocuments={
              canManageDocuments
            }
            setShowUploadModal={
              setShowUploadModal
            }
          />

          <div className="px-6 py-8 lg:px-10">
            {activePage ===
              "Dashboard" && (
              <Dashboard
                statistics={statistics}
                departments={
                  departments
                }
                documents={
                  documents
                }
                metadata={
                  metadata
                }
                statCards={
                  statCards
                }
                dashboardDocumentFilter={
                  dashboardDocumentFilter
                }
                dashboardMetadataFilter={
                  dashboardMetadataFilter
                }
                canManageMetadata={
                  canManageMetadata
                }
                setDashboardDocumentFilter={
                  setDashboardDocumentFilter
                }
                setDashboardMetadataFilter={
                  setDashboardMetadataFilter
                }
                setShowMetadataModal={
                  setShowMetadataModal
                }
                setActivePage={
                  setActivePage
                }
                handleDashboardStatCardClick={
                  handleDashboardStatCardClick
                }
                openDepartmentRecords={
                  openDepartmentRecords
                }
                getStatValue={
                  getStatValue
                }
              />
            )}

            {activePage ===
              "Domain Registry" && (
              <DomainRegistry
                canManageDomains={
                  canManageDomains
                }
              />
            )}

            {activePage ===
              "Metadata Registry" && (
              <MetadataRegistry
                metadata={
                  metadata
                }
                departments={
                  departments
                }
                documents={
                  documents
                }
                selectedDepartment={
                  selectedDepartment
                }
                selectedDepartmentDocuments={
                  selectedDepartmentDocuments
                }
                filteredMetadata={
                  filteredMetadata
                }
                searchTerm={
                  searchTerm
                }
                canManageMetadata={
                  canManageMetadata
                }
                loading={
                  loading
                }
                expandedAdditionalMetadata={
                  expandedAdditionalMetadata
                }
                setExpandedAdditionalMetadata={
                  setExpandedAdditionalMetadata
                }
                setSearchTerm={
                  setSearchTerm
                }
                setSelectedDepartmentId={
                  setSelectedDepartmentId
                }
                setShowMetadataModal={
                  setShowMetadataModal
                }
                setShowBulkMetadataModal={
                  setShowBulkMetadataModal
                }
                SummaryCard={
                  SummaryCard
                }
                StatusBadge={
                  StatusBadge
                }
              />
            )}

            {activePage ===
              "Documents" && (
              <Documents
                documents={
                  documents
                }
                dashboardFilteredDocuments={
                  dashboardFilteredDocuments
                }
                metadata={
                  metadata
                }
                dashboardDocumentFilter={
                  dashboardDocumentFilter
                }
                canManageDocuments={
                  canManageDocuments
                }
                loading={
                  loading
                }
                setShowUploadModal={
                  setShowUploadModal
                }
                setReviewError={
                  setReviewError
                }
                handleOpenDocument={
                  handleOpenDocument
                }
                formatFileSize={
                  formatFileSize
                }
                StatusBadge={
                  StatusBadge
                }
              />
            )}

            {activePage ===
              "Search" && (
              <Search
                searchLoading={
                  searchLoading
                }
                searchError={
                  searchError
                }
                searchResults={
                  searchResults
                }
                searchTerm={
                  searchTerm
                }
                setSearchTerm={
                  setSearchTerm
                }
                departments={
                  departments
                }
                documents={
                  documents
                }
                metadata={
                  metadata
                }
                StatusBadge={
                  StatusBadge
                }
                handleOpenDocument={
                  handleOpenDocument
                }
              />
            )}

            {activePage ===
              "Departments" && (
              <Departments
                departments={
                  departments
                }
                canManageDepartments={
                  canManageDepartments
                }
                departmentModalOpen={
                  departmentModalOpen
                }
                departmentMutationError={
                  departmentMutationError
                }
                openAddDepartmentModal={
                  openAddDepartmentModal
                }
                openEditDepartmentModal={
                  openEditDepartmentModal
                }
                openDepartmentRecords={
                  openDepartmentRecords
                }
              />
            )}

            {activePage ===
              "Settings" && (
              <Settings
                authUser={
                  authUser
                }
                userManagementUsers={
                  userManagementUsers
                }
                userManagementLoading={
                  userManagementLoading
                }
                userManagementError={
                  userManagementError
                }
                updatingUserId={
                  updatingUserId
                }
                updateManagedUser={
                  updateManagedUser
                }
              />
            )}
          </div>
        </section>
      </div>

      <Modals
        canManageDepartments={
          canManageDepartments
        }
        canManageMetadata={
          canManageMetadata
        }
        canManageDocuments={
          canManageDocuments
        }
        isCreatingNewMetadata={
          isCreatingNewMetadata
        }

        /*
         * M23 DOMAIN RELATIONSHIPS
         */
        domainRelationshipDomains={
          domainRelationshipDomains
        }
        domainRelationshipTypes={
          domainRelationshipTypes
        }
        metadataDomainRelationships={
          metadataDomainRelationships
        }
        appraisalDomainRelationships={
          appraisalDomainRelationships
        }
        domainRelationshipsLoading={
          domainRelationshipsLoading
        }
        domainRelationshipsError={
          domainRelationshipsError
        }
        setMetadataDomainRelationships={
          setMetadataDomainRelationships
        }
        setAppraisalDomainRelationships={
          setAppraisalDomainRelationships
        }

        departmentModalOpen={
          departmentModalOpen
        }
        departmentEditingId={
          departmentEditingId
        }
        departmentForm={
          departmentForm
        }
        departmentMutationError={
          departmentMutationError
        }
        departmentSaving={
          departmentSaving
        }
        departments={
          departments
        }

        setDepartmentForm={
          setDepartmentForm
        }
        setDepartmentModalOpen={
          setDepartmentModalOpen
        }
        setDepartmentMutationError={
          setDepartmentMutationError
        }
        setDepartmentSaving={
          setDepartmentSaving
        }

        closeDepartmentModal={
          closeDepartmentModal
        }
        saveDepartment={
          saveDepartment
        }
        deleteDepartment={
          deleteDepartment
        }

        showBulkMetadataModal={
          showBulkMetadataModal
        }
        bulkMetadataFile={
          bulkMetadataFile
        }
        bulkMetadataPreview={
          bulkMetadataPreview
        }
        bulkMetadataError={
          bulkMetadataError
        }
        bulkMetadataLoading={
          bulkMetadataLoading
        }
        bulkMetadataImporting={
          bulkMetadataImporting
        }

        setBulkMetadataFile={
          setBulkMetadataFile
        }
        setBulkMetadataPreview={
          setBulkMetadataPreview
        }
        setBulkMetadataError={
          setBulkMetadataError
        }

        closeBulkMetadataModal={
          closeBulkMetadataModal
        }
        handleBulkMetadataPreview={
          handleBulkMetadataPreview
        }
        handleBulkMetadataImport={
          handleBulkMetadataImport
        }
        downloadBulkMetadataTemplate={
          downloadBulkMetadataTemplate
        }

        showMetadataModal={
          showMetadataModal
        }
        form={
          form
        }
        documentTypes={
          documentTypes
        }

        setForm={
          setForm
        }
        closeMetadataModal={
          closeMetadataModal
        }
        handleMetadataSubmit={
          handleMetadataSubmit
        }

        showUploadModal={
          showUploadModal
        }
        selectedFile={
          selectedFile
        }
        uploading={
          uploading
        }
        uploadError={
          uploadError
        }
        uploadedDocument={
          uploadedDocument
        }
        uploadedAppraisal={
          uploadedAppraisal
        }

        uploadFieldEntries={
          uploadFieldEntries
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
        reviewError={
          reviewError
        }

        setAppraisalMetadataForm={
          setAppraisalMetadataForm
        }
        setAppraisalAdditionalMetadata={
          setAppraisalAdditionalMetadata
        }
        setAppraisalCommittedAdditionalMetadata={
          setAppraisalCommittedAdditionalMetadata
        }

        handleFileChange={
          handleFileChange
        }
        handleUpload={
          handleUpload
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
        closeUploadModal={
          closeUploadModal
        }

        modalRef={
          modalRef
        }
        modalCloseButtonRef={
          modalCloseButtonRef
        }

        StatusBadge={
          StatusBadge
        }
        FormField={
          FormField
        }
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
    </main>
  );
}








