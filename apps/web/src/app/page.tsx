"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import { Modals } from "@/components/modals/Modals";
import { Departments } from "@/components/departments/Departments";
import { Settings } from "@/components/settings/Settings";
import { Search } from "@/components/search/Search";
import { SummaryCard } from "@/components/common/SummaryCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { FormField } from "@/components/common/FormField";

import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";

import { MetadataRegistry } from "@/components/metadata/MetadataRegistry";
import { DomainRegistry } from "@/components/metadata/DomainRegistry";

import { Documents } from "@/components/documents/Documents";
import { Dashboard } from "@/components/dashboard/Dashboard";

import {
  getDepartments,
} from "@/lib/api/departments";

import {
  getDashboard,
} from "@/lib/api/dashboard";

import {
  getDocumentTypes,
} from "@/lib/api/document-types";

import {
  getDocuments,
  getDocumentFile,
} from "@/lib/api/documents";

import {
  createMetadata,
  getMetadata,
} from "@/lib/api/metadata";

import {
  formatFileSize,
  formatUploadFieldLabel,
  formatUploadFieldValue,
} from "@/lib/utils/formatting";

import {
  useAuthSession,
} from "@/hooks/useAuthSession";

import {
  useDepartmentManagement,
} from "@/hooks/useDepartmentManagement";

import {
  useBulkMetadata,
} from "@/hooks/useBulkMetadata";

import {
  useDocumentAppraisal,
} from "@/hooks/useDocumentAppraisal";

import {
  useUserManagement,
} from "@/hooks/useUserManagement";

import {
  useDocumentSearch,
} from "@/hooks/useDocumentSearch";

import {
  useRegistryFilters,
} from "@/hooks/useRegistryFilters";

import {
  useDomainRelationships,
} from "@/hooks/useDomainRelationships";

import type {
  FormEvent,
} from "react";

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
  AdditionalMetadataField,
  MetadataRecord,
} from "@/types/metadata";

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
    description:
      "Metadata waiting for a physical file",
    icon: "◷",
  },
  {
    key: "review",
    label: "Needs Review",
    description:
      "Potential matches requiring a decision",
    icon: "!",
  },
  {
    key: "linked",
    label: "Linked Documents",
    description:
      "Documents matched to metadata",
    icon: "✓",
  },
  {
    key: "unlinked",
    label: "Unlinked Documents",
    description:
      "Documents requiring appraisal",
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
  additionalMetadata:
    [] as AdditionalMetadataField[],
};

export default function Home() {
  const [
    activePage,
    setActivePage,
  ] = useState("Dashboard");

  const [
    statistics,
    setStatistics,
  ] = useState<Statistics | null>(null);

  const [
    metadata,
    setMetadata,
  ] = useState<MetadataRecord[]>([]);

  const [
    documentTypes,
    setDocumentTypes,
  ] = useState<DocumentType[]>([]);

  const [
    documents,
    setDocuments,
  ] = useState<UploadedDocument[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

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
  ] = useState<Set<string>>(
    new Set()
  );

  const [
    selectedDepartmentId,
    setSelectedDepartmentId,
  ] = useState<number | null>(null);


  const [
    form,
    setForm,
  ] = useState(EMPTY_FORM);

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

  /*
   * =============================================================
   * AUTHENTICATION
   * =============================================================
   */

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

  /*
   * =============================================================
   * DEPARTMENTS
   * =============================================================
   */

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
    setSelectedDepartmentId,
  });

  /*
   * =============================================================
   * USER MANAGEMENT
   * =============================================================
   */

  const {
    userManagementUsers,
    userManagementLoading,
    userManagementError,
    updatingUserId,
    updateManagedUser,
  } = useUserManagement({
    authUser,
    activePage,
  });

  /*
   * =============================================================
   * DOCUMENT SEARCH
   * =============================================================
   */

  const {
    searchResults,
    searchLoading,
    searchError,
    searchTerm,
    setSearchTerm,
  } = useDocumentSearch({
    authLoading,
    authUser,
  });

  /*
   * =============================================================
   * REGISTRY FILTERS
   * =============================================================
   */

  const {
    dashboardDocumentFilter,
    setDashboardDocumentFilter,
    dashboardMetadataFilter,
    setDashboardMetadataFilter,
    selectedDepartment,
    filteredMetadata,
    dashboardFilteredDocuments,
    selectedDepartmentDocuments,
    openDepartmentRecords,
    handleDashboardStatCardClick,
  } = useRegistryFilters({
    departments,
    documents,
    metadata,
    searchTerm,
    setSearchTerm,
    setActivePage,
    selectedDepartmentId,
    setSelectedDepartmentId,
  });

  /*
   * =============================================================
   * DOMAIN RELATIONSHIPS
   * =============================================================
   */

  const {
    domainRelationshipDomains,
    domainRelationshipTypes,
    metadataDomainRelationships,
    appraisalDomainRelationships,
    domainRelationshipsLoading,
    domainRelationshipsError,
    setMetadataDomainRelationships,
    setAppraisalDomainRelationships,
    loadMetadataDomainRelationships,
    saveMetadataDomainRelationships,
    clearMetadataDomainRelationships,
    clearAppraisalDomainRelationships,
    setDomainRelationshipsError,
  } = useDomainRelationships(
    authUser
  );

  /*
   * =============================================================
   * DATA LOADING
   * =============================================================
   */

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

  /*
   * =============================================================
   * DOCUMENT APPRAISAL
   * =============================================================
   */

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

  /*
   * =============================================================
   * BULK METADATA
   * =============================================================
   */

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

  /*
   * =============================================================
   * INITIAL DATA EFFECT
   * =============================================================
   */

  useEffect(() => {
    void loadData();
  }, []);

  /*
   * =============================================================
   * METADATA MODAL
   * =============================================================
   */

  const closeMetadataModal = () => {
    setShowMetadataModal(false);

    clearMetadataDomainRelationships();
    clearAppraisalDomainRelationships();

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

      clearMetadataDomainRelationships();
      clearAppraisalDomainRelationships();

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
   * DOCUMENT OPENING
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
   * STATISTICS
   * =============================================================
   */

  const getStatValue = (
    key:
      (typeof statCards)[number]["key"]
  ): string | number => {
    if (!statistics) {
      return "—";
    }

    return (
      statistics[key] ??
      "—"
    );
  };

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

  /*
   * =============================================================
   * MAIN APPLICATION
   * =============================================================
   */

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
