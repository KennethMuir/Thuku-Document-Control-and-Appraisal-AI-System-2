"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  ChangeEvent,
  FormEvent,
  ReactNode,
} from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Statistics = {
  documents: string | number;
  metadata: string | number;
  departments: string | number;
  linked: string | number;
  awaiting: string | number;
  review: string | number;
  unlinked: string | number;
};

type Department = {
  id: number;
  name: string;
  code: string;
  description: string;
};

type DocumentType = {
  id: number;
  name: string;
  description: string;
};

type AdditionalMetadataField = {
  key: string;
  value: string;
};

type MetadataRecord = {
  id: string;
  reference_code: string;
  title: string | null;
  document_date: string | null;
  year: number | null;
  person_name: string | null;
  description: string | null;
  section: string | null;
  status: string;
  additional_metadata: Record<string, unknown> | null;
  department_name: string | null;
  document_type_name: string | null;
  linked_document_id: string | null;
  linked_document_code: string | null;
  linked_filename: string | null;
};

type SearchResultDocument = {
  id: string | number;
  document_code: string;
  filename: string;
  title: string | null;
  document_date: string | null;
  upload_date: string;
  year: number | null;
  person_name: string | null;
  file_type: string | null;
  file_size: number | null;
  status: string;
  upload_number: number | null;
};

type SearchResult = {
  id: string;
  reference_code: string;
  title: string | null;
  document_date: string | null;
  year: number | null;
  person_name: string | null;
  description: string | null;
  section: string | null;
  status: string;
  department_id: number | null;
  department_name: string | null;
  department_code: string | null;
  document_type_id: number | null;
  document_type_name: string | null;
  linked_documents: SearchResultDocument[];
};
type AuthUser = {
  id: number;
  email: string;
  fullName: string | null;
  role: "ADMIN" | "APPRAISER" | "VIEWER";
  isActive: boolean;
};
type UserManagementUser = {
  id: number;
  email: string;
  fullName: string | null;
  role: "ADMIN" | "APPRAISER" | "VIEWER";
  isActive: boolean;
  createdAt: string;
};

type UploadedDocument = {
  [key: string]: unknown;
  id?: string | number;
  document_code?: string;
  filename?: string;
  file_type?: string;
  file_size?: number;
  status?: string;
};

type UploadedAppraisal = {
  matchType:
    | "STRONG_MATCH"
    | "PARTIAL_MATCH"
    | "NO_MATCH";
  confidence: number;
  metadataRecordId: number | null;
  matchingFields: string[];
  conflictingFields: string[];
  decision: string;
  metadata?: {
    id?: string | number;
    reference_code?: string | null;
    title?: string | null;
    document_date?: string | null;
    year?: number | null;
    person_name?: string | null;
    description?: string | null;
    section?: string | null;
    department_id?: string | number | null;
    department_name?: string | null;
    department_code?: string | null;
    document_type_id?: string | number | null;
    document_type_name?: string | null;
    additional_metadata?: Record<string, unknown> | null;
  } | null;
  metadataConflicts?: Array<{
    field: string;
    existingValue: string | number | null;
    documentValue: string | number | null;
  }>;
  match?: {
    id?: string | number;
    document_id?: string | number;
    metadata_record_id?: string | number | null;
    match_type?: string;
    confidence?: number | null;
    matching_fields?: string | null;
    conflicting_fields?: string | null;
    decision?: string;
    created_at?: string;
  };
};

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
  const [activePage, setActivePage] = useState("Dashboard");

  const [dashboardDocumentFilter, setDashboardDocumentFilter] =
    useState<"ALL" | "LINKED" | "UNLINKED" | "REVIEW">("ALL");

  const [dashboardMetadataFilter, setDashboardMetadataFilter] =
    useState<"ALL" | "AWAITING_DOCUMENT">("ALL");

  const [authUser, setAuthUser] =
    useState<AuthUser | null>(null);

  const [loggingOut, setLoggingOut] =
    useState(false);

  const [authLoading, setAuthLoading] =
    useState(true);

  const [authError, setAuthError] =
    useState("");

  const canManageDocuments =
    authUser?.role === "ADMIN" ||
    authUser?.role === "APPRAISER";

  const canManageMetadata =
    authUser?.role === "ADMIN" ||
    authUser?.role === "APPRAISER";

  const canManageDepartments =
    authUser?.role === "ADMIN";
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
    useState<MetadataRecord[]>([]);

  const [showBulkMetadataModal, setShowBulkMetadataModal] =
    useState(false);

  const [bulkMetadataFile, setBulkMetadataFile] =
    useState<File | null>(null);

  const [bulkMetadataPreview, setBulkMetadataPreview] =
    useState<{
      totalRows: number;
      rows: Array<Record<string, unknown>>;
      existingReferenceCodes: string[];
      canImport: boolean;
      truncated: boolean;
    } | null>(null);

  const [bulkMetadataError, setBulkMetadataError] =
    useState("");

  const [bulkMetadataLoading, setBulkMetadataLoading] =
    useState(false);

  const [bulkMetadataImporting, setBulkMetadataImporting] =
    useState(false);

  const [departments, setDepartments] =
    useState<Department[]>([]);

  const [departmentModalOpen, setDepartmentModalOpen] =
    useState(false);

  const [departmentEditingId, setDepartmentEditingId] =
    useState<number | null>(null);

  const [departmentForm, setDepartmentForm] = useState({
    name: "",
    code: "",
    description: "",
  });

  const [departmentMutationError, setDepartmentMutationError] =
    useState("");

  const [departmentSaving, setDepartmentSaving] =
    useState(false);

  const [documentTypes, setDocumentTypes] =
    useState<DocumentType[]>([]);

  const refreshDepartments = async () => {
    const response =
      await fetch(`${API_URL}/api/departments`, { credentials: "include" });

    const data =
      await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.error ||
          "Unable to retrieve departments."
      );
    }

    setDepartments(
      Array.isArray(data.departments)
        ? data.departments
        : []
    );
  };

  const openAddDepartmentModal = () => {
    if (!canManageDepartments) {
      return
    }

    setDepartmentEditingId(null);

    setDepartmentForm({
      name: "",
      code: "",
      description: "",
    });

    setDepartmentMutationError("");
    setDepartmentModalOpen(true);
  };

  const openEditDepartmentModal = (
    department: Department
  ) => {
    if (!canManageDepartments) {
      return
    }

    setDepartmentEditingId(
      department.id
    );

    setDepartmentForm({
      name: department.name,
      code: department.code,
      description:
        department.description || "",
    });

    setDepartmentMutationError("");
    setDepartmentModalOpen(true);
  };

  const closeDepartmentModal = () => {
    if (departmentSaving) {
      return;
    }

    setDepartmentModalOpen(false);
    setDepartmentMutationError("");
  };

  const saveDepartment = async () => {
    if (!canManageDepartments) {
      return
    }

    const name =
      departmentForm.name.trim();

    const code =
      departmentForm.code
        .trim()
        .toUpperCase();

    const description =
      departmentForm.description.trim();

    if (!name || !code) {
      setDepartmentMutationError(
        "Department name and code are required."
      );

      return;
    }

    setDepartmentSaving(true);
    setDepartmentMutationError("");

    try {
      const endpoint =
        departmentEditingId === null
          ? `${API_URL}/api/departments`
          : `${API_URL}/api/departments/${departmentEditingId}`;

      const response =
        await fetch(endpoint, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            name,
            code,
            description,
          }),
        });

      const data =
        await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Unable to save department."
        );
      }

      await refreshDepartments();

      setDepartmentModalOpen(false);
      setDepartmentMutationError("");
    } catch (error) {
      setDepartmentMutationError(
        error instanceof Error
          ? error.message
          : "Unable to save department."
      );
    } finally {
      setDepartmentSaving(false);
    }
  };

  const deleteDepartment = async (
    department: Department
  ): Promise<boolean> => {
    if (!canManageDepartments) {
      return false
    }

    const confirmed =
      window.confirm(
        `Delete the "${department.name}" department? Existing metadata and documents will remain, but their department assignment will become unassigned.`
      );

    if (!confirmed) {
      return false;
    }

    setDepartmentMutationError("");

    try {
      const response =
        await fetch(
          `${API_URL}/api/departments/${department.id}/delete`,
          {
            method: "POST",
          credentials: "include",
          }
        );

      const data =
        await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Unable to delete department."
        );
      }

      if (
        selectedDepartmentId ===
        department.id
      ) {
        setSelectedDepartmentId(null);
      }

      await refreshDepartments();

      return true;
    } catch (error) {
      setDepartmentMutationError(
        error instanceof Error
          ? error.message
          : "Unable to delete department."
      );

      return false;
    }
  };
  const [documents, setDocuments] =
    useState<UploadedDocument[]>([]);

  const [loading, setLoading] = useState(true);

  const [showMetadataModal, setShowMetadataModal] =
    useState(false);

  const [showUploadModal, setShowUploadModal] =
    useState(false);

  const [uploading, setUploading] =
    useState(false);

  const [uploadError, setUploadError] =
    useState("");

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [uploadedDocument, setUploadedDocument] =
    useState<UploadedDocument | null>(null);

  const [uploadedAppraisal, setUploadedAppraisal] =
    useState<UploadedAppraisal | null>(null);
const [appraisalMetadataForm, setAppraisalMetadataForm] =
  useState({
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


  const [expandedAdditionalMetadata, setExpandedAdditionalMetadata] =
    useState<Set<string>>(new Set());
  const [appraisalAdditionalMetadata, setAppraisalAdditionalMetadata] =
    useState<AdditionalMetadataField[]>([]);

  const [
    appraisalCommittedAdditionalMetadata,
    setAppraisalCommittedAdditionalMetadata,
  ] = useState<AdditionalMetadataField[]>([]);

  const [reviewingDecision, setReviewingDecision] =
    useState(false);

  const [reviewError, setReviewError] =
    useState("");

  const [searchResults, setSearchResults] =
    useState<SearchResult[]>([]);

  const [searchLoading, setSearchLoading] =
    useState(false);

  const [searchError, setSearchError] =
    useState("");
  const [searchTerm, setSearchTerm] =
    useState("");

const [selectedDepartmentId, setSelectedDepartmentId] =
  useState<number | null>(null);

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

  const uploadingRef =
    useRef(false);

  const [form, setForm] =
    useState(EMPTY_FORM);

  /*
   * Keep the upload state available to the modal keyboard handler
   * without making the focus-management effect restart during upload.
   */
  useEffect(() => {
    uploadingRef.current = uploading;
  }, [uploading]);

  const getStatValue = (
    key: (typeof statCards)[number]["key"]
  ): string | number => {
    if (!statistics) return "—";

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
        setDashboardMetadataFilter("AWAITING_DOCUMENT");
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

  const formatDate = (
    value: string | null | undefined
  ): string => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat(
      "en-GB",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    ).format(date);
  };

  const formatFileSize = (
    value: number | null | undefined
  ): string => {
    if (
      value === null ||
      value === undefined ||
      Number.isNaN(value)
    ) {
      return "—";
    }

    if (value < 1024) {
      return `${value} B`;
    }

    if (value < 1024 * 1024) {
      return `${(value / 1024).toFixed(1)} KB`;
    }

    if (value < 1024 * 1024 * 1024) {
      return `${(value / (1024 * 1024)).toFixed(1)} MB`;
    }

    return `${(
      value /
      (1024 * 1024 * 1024)
    ).toFixed(1)} GB`;
  };

  const formatUploadFieldLabel = (
    value: string
  ): string => {
    return value
      .replace(/_/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  };

  const formatUploadFieldValue = (
    key: string,
    value: unknown
  ): string => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "—";
    }

    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }

    if (
      typeof value === "object"
    ) {
      try {
        return JSON.stringify(value);
      } catch {
        return "—";
      }
    }

    return String(value);
  };

  /*
   * =============================================================
   * MODAL CLOSE HELPERS
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
        fetch(`${API_URL}/api/dashboard`, { credentials: "include" }),
        fetch(`${API_URL}/api/metadata`, { credentials: "include" }),
        fetch(`${API_URL}/api/departments`, { credentials: "include" }),
        fetch(`${API_URL}/api/document-types`, { credentials: "include" }),
        fetch(`${API_URL}/api/documents`, { credentials: "include" }),
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
          Array.isArray(metadataData.metadata)
            ? metadataData.metadata
            : []
        );
      }

      if (departmentsData.success) {
        setDepartments(
          Array.isArray(departmentsData.departments)
            ? departmentsData.departments
            : []
        );
      }

      if (typesData.success) {
        setDocumentTypes(
          Array.isArray(typesData.documentTypes)
            ? typesData.documentTypes
            : []
        );
      }

      if (documentsData.success) {
        setDocuments(
          Array.isArray(documentsData.documents)
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

  useEffect(() => {
    let cancelled = false;

    const verifySession = async () => {
      try {
        setAuthError("");

        const response = await fetch(
          `${API_URL}/api/auth/me`,
          {
            method: "GET",
            credentials: "include",
          }
        );

        const data = await response.json();

        if (cancelled) {
          return;
        }

        if (
          !response.ok ||
          !data.success ||
          !data.authenticated ||
          !data.user
        ) {
          setAuthUser(null);
          setAuthError(
            data.error ||
              "Your session has expired. Please sign in again."
          );
          return;
        }

        setAuthUser(data.user);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error(
          "Session verification failed:",
          error
        );

        setAuthUser(null);
        setAuthError(
          "Unable to verify your session. Please sign in again."
        );
      } finally {
        if (!cancelled) {
          setAuthLoading(false);
        }
      }
    };

    void verifySession();

    return () => {
      cancelled = true;
    };
  }, []);

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

    const query = searchTerm.trim();

    if (!query) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError("");
      return;
    }

    let cancelled = false;

    const timer = window.setTimeout(async () => {
      try {
        setSearchLoading(true);
        setSearchError("");

        const response = await fetch(
          `${API_URL}/api/search?q=${encodeURIComponent(query)}`,
          {
            method: "GET",
            credentials: "include",
          }
        );

        const data = await response.json();

        if (cancelled) {
          return;
        }

        if (!response.ok || !data.success) {
          throw new Error(
            data.error ||
              "Unable to search records."
          );
        }

        setSearchResults(
          Array.isArray(data.results)
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
          setSearchLoading(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchTerm, authLoading, authUser]);

  const closeMetadataModal = () => {
    setShowMetadataModal(false);
  };

  const closeBulkMetadataModal = () => {
    if (bulkMetadataLoading || bulkMetadataImporting) {
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
      "DOC-EXAMPLE-001,Jane Doe,Example Document,Finance,Contract,2026,2026-01-15,Section A,Example metadata record,CNT-2026-001,EMP-00001,2028-06-30"
    ].join("\\r\\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "metadata-upload-template.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleBulkMetadataPreview = async () => {
    if (!canManageMetadata || !bulkMetadataFile) {
      return;
    }

    setBulkMetadataLoading(true);
    setBulkMetadataError("");
    setBulkMetadataPreview(null);

    try {
      const formData = new FormData();
      formData.append("file", bulkMetadataFile);

      const response = await fetch(
        `${API_URL}/api/metadata/bulk?preview=true`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          Array.isArray(data.errors)
            ? data.errors.join("\\n")
            : data.error || "Unable to preview bulk metadata."
        );
      }

      setBulkMetadataPreview({
        totalRows: Number(data.totalRows || 0),
        rows: Array.isArray(data.rows) ? data.rows : [],
        existingReferenceCodes:
          Array.isArray(data.existingReferenceCodes)
            ? data.existingReferenceCodes
            : [],
        canImport: data.canImport !== false,
        truncated: data.truncated === true,
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

  const handleBulkMetadataImport = async () => {
    if (!canManageMetadata || !bulkMetadataFile || !bulkMetadataPreview?.canImport) {
      return;
    }

    setBulkMetadataImporting(true);
    setBulkMetadataError("");

    try {
      const formData = new FormData();
      formData.append("file", bulkMetadataFile);

      const response = await fetch(
        `${API_URL}/api/metadata/bulk`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          Array.isArray(data.errors)
            ? data.errors.join("\\n")
            : data.error || "Unable to import metadata."
        );
      }

      closeBulkMetadataModal();
      await loadData();
      window.alert(
        `${Number(data.importedCount || data.count || bulkMetadataPreview.totalRows)} metadata records imported successfully.`
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
      return
    }

    event.preventDefault();

    try {
      const response = await fetch(
        `${API_URL}/api/metadata`,
        {
          method: "POST",
        credentials: "include",
        headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
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
          }),
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
            "Unable to create metadata record."
        );
      }

      closeMetadataModal();
      setForm({
        ...EMPTY_FORM,
      });

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

  const handleFileChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      event.target.files?.[0] ??
      null;

    setUploadError("");
    setUploadedDocument(null);

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
      !allowedTypes.includes(
        file.type
      ) &&
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

  /*
   * =============================================================
   * DOCUMENT UPLOAD
   * =============================================================
   */

  const handleUpload = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    if (!canManageDocuments) {
      return
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

      const formData =
        new FormData();

      formData.append(
        "file",
        selectedFile
      );

      const response =
        await fetch(
          `${API_URL}/api/documents/upload`,
          {
            method: "POST",
            body: formData,
            credentials: "include",
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
        typeof data.appraisal === "object"
      ) {
        const appraisal =
          data.appraisal as UploadedAppraisal;

        setUploadedAppraisal(appraisal);

        const metadata =
          appraisal.metadata ?? null;

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
              : data.metadata?.year != null
                ? String(data.metadata.year)
                : "",
          personName:
            metadata?.person_name ??
            data.metadata?.person_name ??
            "",
          departmentId:
            metadata?.department_id != null
              ? String(metadata.department_id)
              : "",
          documentTypeId:
            metadata?.document_type_id != null
              ? String(metadata.document_type_id)
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
              data.metadata?.additional_metadata ??
              {}
          ).map(([key, value]) => ({
            key,
            value:
              value === null || value === undefined
                ? ""
                : String(value),
          }))
        );
        setAppraisalAdditionalMetadata([]);
      } else {
        setUploadedAppraisal(null);
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

  /*
   * =============================================================
   * APPRAISAL REVIEW
   * =============================================================
   */


  const handleOpenDocument = async (
  documentId: string | number
) => {
  const numericDocumentId =
    Number(documentId);

  if (
    !Number.isInteger(numericDocumentId) ||
    numericDocumentId <= 0
  ) {
    return;
  }

  const documentWindow =
    window.open("", "_blank");

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

    const response = await fetch(
      `${API_URL}/api/documents/${numericDocumentId}/file`,
      {
        method: "GET",
        credentials: "include",
      }
    );

    if (!response.ok) {
      let errorMessage =
        "Unable to open the document.";

      try {
        const data = await response.json();

        if (
          data &&
          typeof data.error === "string" &&
          data.error.trim()
        ) {
          errorMessage = data.error;
        }
      } catch {
        // Non-JSON error response.
      }

      throw new Error(errorMessage);
    }

    const blob =
      await response.blob();

    const objectUrl =
      URL.createObjectURL(blob);

    documentWindow.location.href =
      objectUrl;

    window.setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 60_000);
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

const handleAppraisalReview = async (
  decision: "APPROVE" | "REJECT"
) => {
    if (!canManageDocuments) {
      return
    }

  if (!uploadedDocument?.id || !uploadedAppraisal) return;

  if (
    decision === "APPROVE" &&
    !appraisalRequiredFieldsComplete
  ) {
    setReviewError(
      "Complete all required metadata fields before linking this document."
    );
    return;
  }

  if (
    decision === "APPROVE" &&
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

    const response = await fetch(
      `${API_URL}/api/documents/${uploadedDocument.id}/review`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          decision,
          metadataRecordId:
            uploadedAppraisal.metadataRecordId,
          metadata: {
            referenceCode:
              appraisalMetadataForm.referenceCode.trim() || null,
            title:
              appraisalMetadataForm.title.trim() || null,
            documentDate:
              appraisalMetadataForm.documentDate || null,
            year:
              appraisalMetadataForm.year.trim() || null,
            personName:
              appraisalMetadataForm.personName.trim() || null,
            departmentId:
              appraisalMetadataForm.departmentId || null,
            documentTypeId:
              appraisalMetadataForm.documentTypeId || null,
            section:
              appraisalMetadataForm.section.trim() || null,
            description:
              appraisalMetadataForm.description.trim() || null,
              additionalMetadata: Object.fromEntries(
                [
                  ...appraisalCommittedAdditionalMetadata,
                  ...appraisalAdditionalMetadata,
                ]
                  .map((field) => [
                    field.key.trim(),
                    field.value.trim(),
                  ] as const)
                  .filter(([key]) => Boolean(key))
              ),
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.error ||
          data.message ||
          data.details ||
          "Unable to process the appraisal decision."
      );
    }

    if (data.document) {
      setUploadedDocument(data.document);
    }

    await loadData();

    if (decision === "REJECT" && data.metadata) {
      setUploadedAppraisal((current) => ({
        ...(current || {
          matchType: "NO_MATCH",
          confidence: 0,
          metadataRecordId: null,
          matchingFields: [],
          conflictingFields: [],
          decision: "",
        }),
        metadataRecordId: Number(data.metadata.id),
        decision: "NEW_METADATA_CREATED",
        matchType: "NO_MATCH",
        confidence: 100,
        matchingFields: [
          "Metadata created from reviewed document",
        ],
        conflictingFields: [],
        match: data.match
          ? {
              ...data.match,
              metadata_record_id: data.metadata.id,
              match_type: "HUMAN_CREATED_METADATA",
              confidence: 100,
              decision: "LINKED",
            }
          : undefined,
      }));

      /*
       * The backend may generate a new unique reference
       * code when the rejected metadata reference already
       * exists. Reflect that new reference in the editable
       * appraisal form while preserving every other field.
       */
      setAppraisalMetadataForm((current) => ({
        ...current,
        referenceCode:
          data.metadata?.reference_code ??
          current.referenceCode,
      }));

      setReviewError("");
      return;
    }

    if (decision === "APPROVE") {
      setUploadedAppraisal((current) =>
        current
          ? {
              ...current,
              decision: "LINKED",
              metadataRecordId:
                data.metadata?.id ??
                current.metadataRecordId,
            }
          : current
      );

      setReviewError("");
    }
  } catch (error) {
    setReviewError(
      error instanceof Error
        ? error.message
        : "Unable to process the appraisal decision."
    );
  } finally {
    setReviewingDecision(false);
  }
};

  const loadUserManagementUsers =
    async () => {
      if (authUser?.role !== "ADMIN") {
        return;
      }

      try {
        setUserManagementLoading(true);
        setUserManagementError("");

        const response =
          await fetch(
            `${API_URL}/api/users`,
            {
              method: "GET",
              credentials: "include",
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
              "Unable to retrieve users."
          );
        }

        setUserManagementUsers(
          Array.isArray(data.users)
            ? data.users
            : []
        );
      } catch (error) {
        console.error(
          "User management load failed:",
          error
        );

        setUserManagementUsers([]);

        setUserManagementError(
          error instanceof Error
            ? error.message
            : "Unable to retrieve users."
        );
      } finally {
        setUserManagementLoading(false);
      }
    };

  const updateManagedUser =
    async (
      userId: number,
      changes: {
        role?: "ADMIN" | "APPRAISER" | "VIEWER";
        isActive?: boolean;
      }
    ) => {
      if (authUser?.role !== "ADMIN") {
        return;
      }

      try {
        setUpdatingUserId(userId);
        setUserManagementError("");

        const response =
          await fetch(
            `${API_URL}/api/users/${userId}`,
            {
              method: "PATCH",
              credentials: "include",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify(
                changes
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
              "Unable to update user."
          );
        }

        setUserManagementUsers(
          (currentUsers) =>
            currentUsers.map(
              (user) =>
                user.id === userId
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
        setUpdatingUserId(null);
      }
    };

  useEffect(() => {
    if (
      activePage === "Settings" &&
      authUser?.role === "ADMIN"
    ) {
      void loadUserManagementUsers();
    }
  }, [
    activePage,
    authUser?.role,
  ]);
  const logout = async () => {
    if (loggingOut) {
      return;
    }

    try {
      setLoggingOut(true);

      await fetch(
        `${API_URL}/api/auth/logout`,
        {
          method: "POST",
          credentials: "include",
        }
      );
    } catch (error) {
      console.error("Logout request failed:", error);
    } finally {
      window.location.href = "/login";
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

  const filteredMetadata =
    metadata.filter((record: MetadataRecord) => {
      if (
        dashboardMetadataFilter !== "ALL" &&
        record.status !== dashboardMetadataFilter
      ) {
        return false;
      }

      if (selectedDepartmentId !== null) {
        const department =
          departments.find(
            (item) =>
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
        searchTerm.trim().toLowerCase();

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
        .some((value) =>
          String(value)
            .toLowerCase()
            .includes(query)
        );
    });
const selectedDepartment =
  selectedDepartmentId !== null
    ? departments.find(
        (department) =>
          department.id ===
          selectedDepartmentId
      ) ?? null
    : null;

const dashboardFilteredDocuments =
  dashboardDocumentFilter === "ALL"
    ? documents
    : documents.filter((document) => {
        const status = String(
          document.status ?? ""
        ).toUpperCase();

        if (dashboardDocumentFilter === "LINKED") {
          return status === "LINKED";
        }

        if (dashboardDocumentFilter === "UNLINKED") {
          return status === "UNLINKED";
        }

        return (
          status === "REVIEW_REQUIRED" ||
          status === "NEEDS_REVIEW" ||
          status === "REVIEW"
        );
      });

const selectedDepartmentDocuments =
  selectedDepartmentId !== null
    ? documents.filter((document) => {
        const documentDepartmentId =
          document.department_id;

        return (
          documentDepartmentId !==
            undefined &&
          documentDepartmentId !==
            null &&
          Number(documentDepartmentId) ===
            selectedDepartmentId
        );
      })
    : [];

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
            {authError || "Redirecting to sign in..."}
          </p>

          {authError ? (
            <button
              type="button"
              onClick={() => {
                window.location.href = "/login";
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
        {/* ========================================================= */}
        {/* SIDEBAR */}
        {/* ========================================================= */}

        <aside className="hidden w-64 border-r border-slate-200 bg-white lg:flex lg:flex-col">
          <div className="border-b border-slate-200 px-6 py-6">
            <div className="flex items-center gap-3">
              <div
                aria-hidden="true"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-lg font-bold text-white"
              >
                DA
              </div>

              <div>
                <p className="text-sm font-bold tracking-tight">
                  Document Appraisal
                </p>

                <p className="text-xs text-slate-500">
                  AI System
                </p>
              </div>
            </div>
          </div>

          <nav
            aria-label="Main navigation"
            className="flex-1 space-y-1 px-3 py-5"
          >
            <NavItem
              active={
                activePage ===
                "Dashboard"
              }
              icon="⌂"
              label="Dashboard"
              onClick={() =>
                setActivePage(
                  "Dashboard"
                )
              }
            />

            <NavItem
              active={
                activePage ===
                "Documents"
              }
              icon="▣"
              label="Documents"
              onClick={() =>
                setActivePage(
                  "Documents"
                )
              }
            />

            <NavItem
              active={
                activePage ===
                "Metadata Registry"
              }
              icon="◫"
              label="Metadata"
              onClick={() =>
                setActivePage(
                  "Metadata Registry"
                )
              }
            />

            <NavItem
              active={
                activePage ===
                "Search"
              }
              icon="⌕"
              label="Search"
              onClick={() =>
                setActivePage(
                  "Search"
                )
              }
            />

            <NavItem
              active={
                activePage ===
                "Departments"
              }
              icon="▤"
              label="Departments"
              onClick={() =>
                setActivePage(
                  "Departments"
                )
              }
            />

            <NavItem
              active={
                activePage ===
                "Settings"
              }
              icon="⚙"
              label="Settings"
              onClick={() =>
                setActivePage(
                  "Settings"
                )
              }
            />
          </nav>

          <div className="border-t border-slate-200 p-4">
            {canManageDocuments && (
<button
              type="button"
              onClick={() =>
                setShowUploadModal(
                  true
                )
              }
              className="mb-4 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
            >
              + Upload Document
            </button>
            )}

            <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {authUser?.fullName ||
                    authUser?.email}
                </p>

                <p className="mt-1 truncate text-xs text-slate-500">
                  {authUser?.email}
                </p>

                <p className="mt-2 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  {authUser?.role}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  void logout();
                }}
                disabled={loggingOut}
                className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loggingOut
                  ? "Signing out..."
                  : "Sign out"}
              </button>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                System status
              </p>

              <div className="mt-3 flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-full bg-emerald-500"
                />

                <span className="text-sm font-medium text-slate-700">
                  API connected
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* ========================================================= */}
        {/* MAIN */}
        {/* ========================================================= */}

        <section className="flex-1">
          <header className="border-b border-slate-200 bg-white">
            <div className="flex flex-col justify-between gap-4 px-6 py-5 md:flex-row md:items-center lg:px-10">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Records intelligence
                </p>

                <h1 className="mt-1 text-2xl font-bold tracking-tight">
                  {activePage}
                </h1>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setActivePage(
                      "Search"
                    )
                  }
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                >
                  Search
                </button>

                {canManageDocuments && (
<button
                  type="button"
                  onClick={() =>
                    setShowUploadModal(
                      true
                    )
                  }
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                >
                  + Upload Document
                </button>
                )}
              </div>
            </div>
          </header>

          {/* ======================================================= */}
          {/* CONTENT */}
          {/* ======================================================= */}

          <div className="px-6 py-8 lg:px-10">
            {/* ===================================================== */}
            {/* DASHBOARD */}
            {/* ===================================================== */}

            {activePage ===
              "Dashboard" && (
              <>
                <div className="mb-8 rounded-2xl bg-slate-900 p-7 text-white shadow-sm">
                  <div className="max-w-3xl">
                    <p className="text-sm font-semibold text-slate-300">
                      DOCUMENT APPRAISAL AI
                    </p>

                    <h2 className="mt-2 text-3xl font-bold tracking-tight">
                      Intelligent control of your institutional records.
                    </h2>

                    <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                      Register metadata before documents arrive, analyze
                      incoming files, identify possible matches, and maintain
                      a searchable relationship between metadata and physical
                      records.
                    </p>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    {canManageMetadata && (
<button
                      type="button"
                      onClick={() =>
                        setShowMetadataModal(
                          true
                        )
                      }
                      className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-900"
                    >
                      + Add Metadata
                    </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setActivePage(
                          "Documents"
                        )
                      }
                      className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-900"
                    >
                      Browse Documents
                    </button>
                  </div>
                </div>

                <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {statCards.map(
                    (card) => (
                      <div
                        key={
                          card.key
                        }
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          handleDashboardStatCardClick(
                            card.key
                          )
                        }
                        onKeyDown={(event) => {
                          if (
                            event.key === "Enter" ||
                            event.key === " "
                          ) {
                            event.preventDefault();
                            handleDashboardStatCardClick(
                              card.key
                            );
                          }
                        }}
                        className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 ${
                          (
                            card.key === "documents" &&
                            dashboardDocumentFilter === "ALL"
                          ) ||
                          (
                            card.key === "metadata" &&
                            dashboardMetadataFilter === "ALL"
                          ) ||
                          (
                            card.key === "awaiting" &&
                            dashboardMetadataFilter === "AWAITING_DOCUMENT"
                          ) ||
                          (
                            card.key === "review" &&
                            dashboardDocumentFilter === "REVIEW"
                          ) ||
                          (
                            card.key === "linked" &&
                            dashboardDocumentFilter === "LINKED"
                          ) ||
                          (
                            card.key === "unlinked" &&
                            dashboardDocumentFilter === "UNLINKED"
                          )
                            ? "border-slate-900 ring-1 ring-slate-900"
                            : "border-slate-200"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-500">
                              {
                                card.label
                              }
                            </p>

                            <p className="mt-2 text-3xl font-bold tracking-tight">
                              {getStatValue(
                                card.key
                              )}
                            </p>
                          </div>

                          <div
                            aria-hidden="true"
                            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-700"
                          >
                            {
                              card.icon
                            }
                          </div>
                        </div>

                        <p className="mt-3 text-xs leading-5 text-slate-400">
                          {
                            card.description
                          }
                        </p>
                      </div>
                    )
                  )}
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
                  <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                      <div>
                        <h3 className="font-bold">
                          Department Records
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                          Browse records by organizational department.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setActivePage(
                            "Departments"
                          )
                        }
                        className="rounded-lg text-sm font-semibold text-slate-700 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                      >
                        View all
                      </button>
                    </div>

                    <div className="grid gap-3 p-5 sm:grid-cols-2">
                      {departments
                        .slice(0, 8)
                        .map(
                          (
                            department
                          ) => (
                            <button
                              type="button"
                              key={
                                department.id
                              }
                              onClick={() =>
                                openDepartmentRecords(
                                  department
                                )
                              }
                              className="group rounded-xl border border-slate-200 p-4 text-left transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div
                                    aria-hidden="true"
                                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-700"
                                  >
                                    {department.code.slice(
                                      0,
                                      2
                                    )}
                                  </div>

                                  <div>
                                    <p className="text-sm font-semibold">
                                      {
                                        department.name
                                      }
                                    </p>

                                    <p className="mt-0.5 text-xs text-slate-400">
                                      {
                                        department.code
                                      }
                                    </p>
                                  </div>
                                </div>

                                <span
                                  aria-hidden="true"
                                  className="text-slate-300 transition group-hover:text-slate-600"
                                >
                                  →
                                </span>
                              </div>
                            </button>
                          )
                        )}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 px-6 py-5">
                      <h3 className="font-bold">
                        Appraisal Workflow
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        How the system handles incoming records.
                      </p>
                    </div>

                    <div className="space-y-5 p-6">
                      <WorkflowStep
                        number="01"
                        title="Metadata first"
                        text="Create an expected record before the physical document arrives."
                      />

                      <WorkflowStep
                        number="02"
                        title="Document arrives"
                        text="Upload a PDF or DOCX and preserve its physical file securely."
                      />

                      <WorkflowStep
                        number="03"
                        title="Appraisal"
                        text="Extract available information and compare it against existing metadata."
                      />

                      <WorkflowStep
                        number="04"
                        title="Decision"
                        text="Strong matches link automatically; uncertain matches require user review."
                      />
                    </div>
                  </section>
                </div>

                <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-6">
                  <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                    <div>
                      <p className="text-sm font-bold">
                        Ready to register a record?
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Add metadata now, even if the physical document has
                        not arrived yet.
                      </p>
                    </div>

                    {canManageMetadata && (
<button
                      type="button"
                      onClick={() =>
                        setShowMetadataModal(
                          true
                        )
                      }
                      className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                    >
                      Create Metadata Record
                    </button>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ===================================================== */}
            {/* METADATA REGISTRY */}
            {/* ===================================================== */}

            {activePage ===
              "Metadata Registry" && (
              <>
                {selectedDepartment && (
                  <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-col justify-between gap-4 border-b border-slate-200 px-6 py-5 md:flex-row md:items-center">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Department records
                        </p>
                        <h2 className="mt-1 text-xl font-bold text-slate-950">
                          {selectedDepartment.name}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                          All documents currently assigned to{" "}
                          {selectedDepartment.name}.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setSelectedDepartmentId(null)
                        }
                        className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                      >
                        View All Metadata
                      </button>
                    </div>

                    {selectedDepartmentDocuments.length === 0 ? (
                      <div className="p-8 text-center">
                        <p className="text-sm font-semibold text-slate-700">
                          No documents assigned to this department.
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Uploaded documents assigned to{" "}
                          {selectedDepartment.name} will appear here.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                          <thead className="bg-slate-50">
                            <tr>
                              <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                              >
                                Document Code
                              </th>
                              <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                              >
                                Filename
                              </th>
                              <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                              >
                                Type
                              </th>
                              <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                              >
                                Size
                              </th>
                              <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                              >
                                Status
                              </th>
                            </tr>
                          </thead>

                          <tbody className="divide-y divide-slate-100 bg-white">
                            {selectedDepartmentDocuments.map(
                              (document) => (
                                <tr key={String(document.id)}>
                                  <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-slate-900">
                                    {document.document_code ?? "—"}
                                  </td>

                                  <td className="px-6 py-4 text-sm text-slate-700">
                                    {document.filename ?? "—"}
                                  </td>

                                  <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                                    {document.file_type ?? "—"}
                                  </td>

                                  <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                                    {formatFileSize(
                                      document.file_size as
                                        | number
                                        | undefined
                                    )}
                                  </td>

                                  <td className="whitespace-nowrap px-6 py-4">
                                    <StatusBadge
                                      status={
                                        document.status ??
                                        "UNKNOWN"
                                      }
                                    />
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                )}
                <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <SummaryCard
                    label="Metadata Records"
                    value={
                      metadata.length
                    }
                  />

                  <SummaryCard
                    label="Awaiting Documents"
                    value={
                      metadata.filter(
                        (item) =>
                          item.status ===
                          "AWAITING_DOCUMENT"
                      ).length
                    }
                  />

                  <SummaryCard
                    label="Linked"
                    value={
                      metadata.filter(
                        (item) =>
                          Boolean(
                            item.linked_document_id
                          )
                      ).length
                    }
                  />

                  <SummaryCard
                    label="Departments"
                    value={
                      departments.length
                    }
                  />
                </div>

                <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Metadata management
                    </p>

                    <h2 className="mt-1 text-xl font-bold">
                      Pre-fed Metadata
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Register expected documents before the physical file
                      arrives.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setShowMetadataModal(
                        true
                      )
                    }
                    className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                  >
                    + Register Metadata
                  </button>

                  {canManageMetadata && (
                    <button
                      type="button"
                      onClick={() => setShowBulkMetadataModal(true)}
                      className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                    >
                      Bulk Upload Metadata
                    </button>
                  )}
                </div>

                <div className="mb-5 flex items-center gap-3">
                  <div className="relative flex-1">
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                      ⌕
                    </span>

                    <input
                      aria-label="Search metadata records"
                      value={
                        searchTerm
                      }
                      onChange={(
                        event
                      ) =>
                        setSearchTerm(
                          event.target
                            .value
                        )
                      }
                      placeholder="Search reference, person, title, department..."
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    />
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  {loading ? (
                    <div
                      role="status"
                      aria-live="polite"
                      className="p-10 text-center text-sm text-slate-500"
                    >
                      Loading metadata registry...
                    </div>
                  ) : filteredMetadata.length ===
                    0 ? (
                    <div className="p-12 text-center">
                      <div
                        aria-hidden="true"
                        className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-lg"
                      >
                        ◫
                      </div>

                      <h3 className="mt-4 font-bold">
                        No metadata records found
                      </h3>

                      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                        Register expected document information before
                        uploading physical documents.
                      </p>

                      <button
                        type="button"
                        onClick={() =>
                          setShowMetadataModal(
                            true
                          )
                        }
                        className="mt-5 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                      >
                        + Register Metadata
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-slate-200 bg-slate-50">
                          <tr>
                            <th className="px-5 py-4 font-semibold">
                              Reference
                            </th>

                            <th className="px-5 py-4 font-semibold">
                              Document
                            </th>

                            <th className="px-5 py-4 font-semibold">
                              Person
                            </th>

                            <th className="px-5 py-4 font-semibold">
                              Department
                            </th>

                            <th className="px-5 py-4 font-semibold">
                              Type
                            </th>

                                                        <th className="px-5 py-4 font-semibold">
                              Section
                            </th>
<th className="px-5 py-4 font-semibold">
                              Date
                            </th>

                            <th className="px-5 py-4 font-semibold">
                              Status
                            </th>
                            <th className="px-5 py-4 font-semibold">
                              Additional Metadata
                            </th>

                          </tr>
                        </thead>

                        <tbody>
                          {filteredMetadata.map(
                            (record) => (
                              <tr
                                key={
                                  record.id
                                }
                                className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                              >
                                <td className="px-5 py-5">
                                  <div className="font-semibold">
                                    {
                                      record.reference_code
                                    }
                                  </div>
                                </td>

                                <td className="px-5 py-5">
                                  <div className="font-medium">
                                    {
                                      record.title ||
                                      "Untitled"
                                    }
                                  </div>

                                  {record.linked_document_code && (
                                    <div className="mt-1 text-xs font-semibold text-blue-600">
                                      {
                                        record.linked_document_code
                                      }
                                    </div>
                                  )}
                                </td>

                                <td className="px-5 py-5">
                                  {
                                    record.person_name ||
                                    "—"
                                  }
                                </td>

                                <td className="px-5 py-5">
                                  {
                                    record.department_name ||
                                    "—"
                                  }
                                </td>

                                <td className="px-5 py-5">
                                  {
                                    record.document_type_name ||
                                    "—"
                                  }
                                </td>
                                <td className="px-5 py-5 text-sm text-slate-600">
                                  {record.section || "—"}
                                </td>

                                <td className="px-5 py-5">
                                  {formatDate(
                                    record.document_date
                                  )}
                                </td>

                                <td className="px-5 py-5">
                                  <StatusBadge
                                    status={
                                      record.status
                                    }
                                  />
                                </td>

                                <td className="px-5 py-5 align-top">
                                  {record.additional_metadata &&
                                  Object.keys(record.additional_metadata).length > 0 ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setExpandedAdditionalMetadata((current) => {
                                            const next = new Set(current);
                                            if (next.has(record.id)) {
                                              next.delete(record.id);
                                            } else {
                                              next.add(record.id);
                                            }
                                            return next;
                                          });
                                        }}
                                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                                      >
                                        {expandedAdditionalMetadata.has(record.id)
                                          ? "Hide Additional Metadata"
                                          : "Additional Metadata"}
                                      </button>

                                      {expandedAdditionalMetadata.has(record.id) && (
                                        <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                                          {Object.entries(record.additional_metadata).map(([key, value]) => (
                                            <div
                                              key={key}
                                              className="text-xs text-slate-600"
                                            >
                                              <span className="font-semibold text-slate-700">
                                                {key}:
                                              </span>{" "}
                                              {value === null || value === undefined || value === ""
                                                ? "—"
                                                : String(value)}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <span className="text-sm text-slate-400">—</span>
                                  )}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ===================================================== */}
            {/* DOCUMENTS */}
            {/* ===================================================== */}

            {activePage ===
              "Documents" && (
              <>
                <div className="mb-8 rounded-2xl bg-slate-900 p-7 text-white">
                  <p className="text-sm font-semibold text-slate-300">
                    DOCUMENT LIBRARY
                  </p>

                  <h2 className="mt-2 text-3xl font-bold">
                    Institutional Document Library
                  </h2>

                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                    Securely store, identify and organize incoming PDF and
                    DOCX records. Each uploaded document receives a unique
                    system document code.
                  </p>

                  {canManageDocuments && (
<button
                    type="button"
                    onClick={() =>
                      setShowUploadModal(
                        true
                      )
                    }
                    className="mt-6 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-900"
                  >
                    + Upload Document
                  </button>
                  )}
                </div>

                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-6 py-5">
                    <h3 className="font-bold">
                      Uploaded Documents
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      {dashboardDocumentFilter === "ALL"
                        ? "Documents currently stored in the records system."
                        : dashboardDocumentFilter === "LINKED"
                          ? "Showing documents linked to metadata."
                          : dashboardDocumentFilter === "UNLINKED"
                            ? "Showing documents requiring appraisal."
                            : "Showing documents requiring review."}
                    </p>
                  </div>

                  {loading ? (
                    <div
                      role="status"
                      aria-live="polite"
                      className="p-10 text-center text-sm text-slate-500"
                    >
                      Loading documents...
                    </div>
                  ) : dashboardFilteredDocuments.length ===
                    0 ? (
                    <div className="p-12 text-center">
                      <div
                        aria-hidden="true"
                        className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100"
                      >
                        ▣
                      </div>

                      <h3 className="mt-4 font-bold">
                        No documents uploaded
                      </h3>

                      <p className="mt-2 text-sm text-slate-500">
                        Upload your first PDF or DOCX document to begin
                        the appraisal workflow.
                      </p>

                      {canManageDocuments && (
<button
                        type="button"
                        onClick={() =>
                          setShowUploadModal(
                            true
                          )
                        }
                        className="mt-5 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                      >
                        Upload Document
                      </button>
                        )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-slate-200 bg-slate-50">
                          <tr>
                            <th className="px-5 py-4 font-semibold">
                              Document Code
                            </th>

                            <th className="px-5 py-4 font-semibold">
                              Filename
                            </th>

                            <th className="px-5 py-4 font-semibold">
                              Type
                            </th>

                            <th className="px-5 py-4 font-semibold">
                              Size
                            </th>

                            <th className="px-5 py-4 font-semibold">
                              Status
                            </th>
                            <th className="px-5 py-4 text-right font-semibold">
                              Action
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {dashboardFilteredDocuments.map(
                            (document) => (
                              <tr
                                key={
                                  document.id
                                }
                                className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                              >
                                <td className="px-5 py-5">
                                  <span className="font-bold text-blue-600">
                                    {
                                      document.document_code ??
                                      "—"
                                    }
                                  </span>
                                </td>

                                <td className="px-5 py-5 font-medium">
                                  {
                                    document.filename ??
                                    "—"
                                  }
                                </td>

                                <td className="px-5 py-5">
                                  {
                                    document.file_type ??
                                    "—"
                                  }
                                </td>

                                <td className="px-5 py-5">
                                  {formatFileSize(
                                    document.file_size
                                  )}
                                </td>

                                <td className="px-5 py-5">
                                  <StatusBadge
                                    status={
                                      document.status ??
                                      "UNKNOWN"
                                    }
                                  />
                                </td>
                                <td className="px-5 py-5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (document.id == null) {
                                        setReviewError(
                                          "This document does not have a valid document ID."
                                        );
                                        return;
                                      }

                                      handleOpenDocument(
                                        document.id
                                      );
                                    }}
                                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                                  >
                                    Open
                                  </button>
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </>
            )}

            {/* ===================================================== */}
            {/* SEARCH */}
            {/* ===================================================== */}
            {activePage ===
              "Search" && (
              <>
                <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Records intelligence
                  </p>

                  <h2 className="mt-2 text-3xl font-bold">
                    Search the records
                  </h2>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                    Search across metadata and documents using document codes,
                    reference codes, people, titles, departments, sections,
                    document types, dates and statuses.
                  </p>

                  <div className="relative mt-6">
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                      ⌕
                    </span>

                    <input
                      aria-label="Search records"
                      value={
                        searchTerm
                      }
                      onChange={(
                        event
                      ) =>
                        setSearchTerm(
                          event.target
                            .value
                        )
                      }
                      placeholder="Search records..."
                      className="w-full rounded-xl border border-slate-200 px-11 py-4 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    />
                  </div>
                </div>

                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-6 py-5">
                    <h3 className="font-bold">
                      Search Results
                    </h3>

                    <p
                      role="status"
                      aria-live="polite"
                      className="mt-1 text-sm text-slate-500"
                    >
                      {searchLoading
                        ? "Searching records..."
                        : searchError
                          ? searchError
                          : searchTerm.trim()
                            ? `${searchResults.length} matching record${
                                searchResults.length ===
                                1
                                  ? ""
                                  : "s"
                              }`
                            : "Enter a search term to explore the registry."}
                    </p>
                  </div>

                  {searchError && (
                    <div
                      role="alert"
                      className="border-b border-red-100 bg-red-50 px-6 py-5"
                    >
                      <p className="font-semibold text-red-700">
                        Search unavailable
                      </p>

                      <p className="mt-1 text-sm text-red-600">
                        {searchError}
                      </p>
                    </div>
                  )}

                  <div className="divide-y divide-slate-100">
                    {searchLoading && (
                      <div className="p-12 text-center">
                        <div
                          aria-hidden="true"
                          className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700"
                        />

                        <p className="mt-4 font-semibold">
                          Searching your records
                        </p>

                        <p className="mt-2 text-sm text-slate-500">
                          Checking metadata and linked documents...
                        </p>
                      </div>
                    )}

                    {!searchLoading &&
                      !searchError &&
                      searchTerm.trim() &&
                      searchResults.map(
                        (record) => (
                          <div
                            key={
                              record.id
                            }
                            className="p-6 transition hover:bg-slate-50"
                          >
                            <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-3">
                                  <span className="font-bold text-blue-600">
                                    {
                                      record.reference_code
                                    }
                                  </span>

                                  <StatusBadge
                                    status={
                                      record.status
                                    }
                                  />

                                  {record.section && (
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                                      {
                                        record.section
                                      }
                                    </span>
                                  )}
                                </div>

                                <h4 className="mt-3 text-lg font-bold">
                                  {
                                    record.title ||
                                    "Untitled metadata record"
                                  }
                                </h4>

                                <div className="mt-3 grid gap-2 text-sm text-slate-500 md:grid-cols-2">
                                  <p>
                                    <span className="font-semibold text-slate-700">
                                      Person:
                                    </span>{" "}
                                    {
                                      record.person_name ||
                                      "Not recorded"
                                    }
                                  </p>

                                  <p>
                                    <span className="font-semibold text-slate-700">
                                      Department:
                                    </span>{" "}
                                    {
                                      record.department_name ||
                                      "Not assigned"
                                    }
                                  </p>

                                  <p>
                                    <span className="font-semibold text-slate-700">
                                      Type:
                                    </span>{" "}
                                    {
                                      record.document_type_name ||
                                      "Not assigned"
                                    }
                                  </p>

                                  <p>
                                    <span className="font-semibold text-slate-700">
                                      Year:
                                    </span>{" "}
                                    {
                                      record.year ||
                                      "Not recorded"
                                    }
                                  </p>

                                  <p>
                                    <span className="font-semibold text-slate-700">
                                      Document date:
                                    </span>{" "}
                                    {
                                      record.document_date ||
                                      "Not recorded"
                                    }
                                  </p>
                                </div>

                                {record.description && (
                                  <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-500">
                                    {
                                      record.description
                                    }
                                  </p>
                                )}
                              </div>

                              <div className="w-full lg:max-w-md">
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                    Linked documents
                                  </p>

                                  {record.linked_documents.length >
                                  0 ? (
                                    <div className="mt-3 space-y-3">
                                      {record.linked_documents.map(
                                        (document) => (
                                          <button
                                            type="button"
                                            key={
                                              document.id
                                            }
                                            onClick={(event) => {
                                              event.stopPropagation();

                                              void handleOpenDocument(
                                                document.id
                                              );
                                            }}
                                            className="block w-full rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                                          >
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                              <span className="font-bold text-blue-700">
                                                {
                                                  document.document_code
                                                }
                                              </span>

                                              <StatusBadge
                                                status={
                                                  document.status
                                                }
                                              />
                                            </div>

                                            <p className="mt-1 break-words text-sm font-medium text-slate-700">
                                              {
                                                document.filename
                                              }
                                            </p>

                                            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                                              {document.year && (
                                                <span>
                                                  Year:{" "}
                                                  {
                                                    document.year
                                                  }
                                                </span>
                                              )}

                                              {document.document_date && (
                                                <span>
                                                  Date:{" "}
                                                  {
                                                    document.document_date
                                                  }
                                                </span>
                                              )}

                                              {document.file_type && (
                                                <span>
                                                  {
                                                    document.file_type
                                                  }
                                                </span>
                                              )}
                                            </div>
                                          </button>
                                        )
                                      )}
                                    </div>
                                  ) : (
                                    <p className="mt-2 text-sm text-slate-500">
                                      No document is currently linked to
                                      this metadata record.
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      )}

                    {!searchLoading &&
                      !searchError &&
                      searchTerm.trim() &&
                      searchResults.length ===
                        0 && (
                        <div className="p-12 text-center">
                          <div
                            aria-hidden="true"
                            className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-lg"
                          >
                            ⌕
                          </div>

                          <p className="mt-4 font-semibold">
                            No matching records
                          </p>

                          <p className="mt-2 text-sm text-slate-500">
                            Try a document code, reference code,
                            person, title, department, section or
                            document type.
                          </p>
                        </div>
                      )}

                    {!searchLoading &&
                      !searchError &&
                      !searchTerm.trim() && (
                        <div className="p-12 text-center">
                          <div
                            aria-hidden="true"
                            className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-lg"
                          >
                            ⌕
                          </div>

                          <p className="mt-4 font-semibold">
                            Search your records
                          </p>

                          <p className="mt-2 text-sm text-slate-500">
                            Search by document code, reference code,
                            person, title, department, section,
                            document type, year or status.
                          </p>
                        </div>
                      )}
                  </div>
                </section>
              </>
            )}




            {activePage ===
              "Departments" && (
              <>
                <div className="mb-8">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Organizational structure
                  </p>

                  <h2 className="mt-1 text-2xl font-bold">
                    Departments
                  </h2>

                  <p className="mt-2 text-sm text-slate-500">
                    Browse the organizational departments used to classify
                    institutional records.
                  </p>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    {canManageDepartments && (
<button
                      type="button"
                      onClick={openAddDepartmentModal}
                      className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                    >
                      + Add Department
                    </button>
                    )}

                    {departmentMutationError &&
                      !departmentModalOpen && (
                        <p
                          role="alert"
                          className="text-sm font-medium text-red-600"
                        >
                          {departmentMutationError}
                        </p>
                      )}
                  </div>
                </div>

                                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {departments.map(
                    (department) => (
                      <div
                        key={
                          department.id
                        }
                        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            openDepartmentRecords(
                              department
                            )
                          }
                          className="block w-full p-6 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-slate-900"
                          aria-label={`View documents and metadata for ${department.name}`}
                        >
                          <div className="flex items-start justify-between">
                            <div
                              aria-hidden="true"
                              className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-700"
                            >
                              {department.code.slice(
                                0,
                                2
                              )}
                            </div>

                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                              {
                                department.code
                              }
                            </span>
                          </div>

                          <h3 className="mt-5 text-lg font-bold">
                            {
                              department.name
                            }
                          </h3>

                          <p className="mt-2 text-sm leading-6 text-slate-500">
                            {
                              department.description ||
                              "No department description available."
                            }
                          </p>

                          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                            View department records →
                          </p>
                        </button>

                        <div className="flex items-center border-t border-slate-100 px-6 py-4">
                          <button
                            type="button"
                            onClick={() =>
                              openEditDepartmentModal(
                                department
                              )
                            }
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </>
            )}

            {/* SETTINGS */}
            {/* ===================================================== */}

            {activePage ===
              "Settings" && (
              <>
                <div className="mb-8">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    System configuration
                  </p>

                  <h2 className="mt-1 text-2xl font-bold">
                    Settings
                  </h2>

                  <p className="mt-2 text-sm text-slate-500">
                    Basic system information and current configuration.
                  </p>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <SettingsCard
                    title="Document Processing"
                    description="Current document formats accepted by the system."
                  >
                    <SettingRow
                      label="PDF documents"
                      value="Supported"
                    />

                    <SettingRow
                      label="DOCX documents"
                      value="Supported"
                    />

                    <SettingRow
                      label="OCR"
                      value="Planned"
                    />
                  </SettingsCard>

                  <SettingsCard
                    title="System Connection"
                    description="Application connectivity information."
                  >
                    <SettingRow
                      label="API"
                      value="Connected"
                    />

                    <SettingRow
                      label="Database"
                      value="PostgreSQL"
                    />

                    <SettingRow
                      label="Environment"
                      value="Local"
                    />
                  </SettingsCard>
                  {authUser?.role === "ADMIN" && (
                    <SettingsCard
                      title="User Management"
                      description="Manage application access, roles, and account status."
                    >
                      <div className="px-6 py-5">
                        {userManagementError && (
                          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                            {userManagementError}
                          </div>
                        )}

                        {userManagementLoading ? (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                            Loading users...
                          </div>
                        ) : userManagementUsers.length === 0 ? (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                            No users found.
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[760px] text-left">
                              <thead>
                                <tr className="border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-400">
                                  <th className="px-3 py-3">
                                    User
                                  </th>
                                  <th className="px-3 py-3">
                                    Role
                                  </th>
                                  <th className="px-3 py-3">
                                    Status
                                  </th>
                                  <th className="px-3 py-3 text-right">
                                    Access
                                  </th>
                                </tr>
                              </thead>

                              <tbody className="divide-y divide-slate-100">
                                {userManagementUsers.map(
                                  (user) => {
                                    const isCurrentUser =
                                      user.id ===
                                      authUser.id;

                                    const isUpdating =
                                      updatingUserId ===
                                      user.id;

                                    return (
                                      <tr
                                        key={user.id}
                                        className="align-middle"
                                      >
                                        <td className="px-3 py-4">
                                          <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-slate-800">
                                              {user.fullName ||
                                                "Unnamed user"}
                                            </p>

                                            <p className="mt-1 truncate text-xs text-slate-500">
                                              {user.email}
                                            </p>
                                          </div>
                                        </td>

                                        <td className="px-3 py-4">
                                          <select
                                            value={user.role}
                                            disabled={
                                              isUpdating ||
                                              isCurrentUser
                                            }
                                            onChange={(
                                              event
                                            ) => {
                                              const role =
                                                event
                                                  .target
                                                  .value as
                                                  | "ADMIN"
                                                  | "APPRAISER"
                                                  | "VIEWER";

                                              void updateManagedUser(
                                                user.id,
                                                { role }
                                              );
                                            }}
                                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60"
                                          >
                                            <option value="VIEWER">
                                              VIEWER
                                            </option>
                                            <option value="APPRAISER">
                                              APPRAISER
                                            </option>
                                            <option value="ADMIN">
                                              ADMIN
                                            </option>
                                          </select>
                                        </td>

                                        <td className="px-3 py-4">
                                          <span
                                            className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                                              user.isActive
                                                ? "bg-emerald-50 text-emerald-700"
                                                : "bg-slate-100 text-slate-500"
                                            }`}
                                          >
                                            {user.isActive
                                              ? "Active"
                                              : "Inactive"}
                                          </span>
                                        </td>

                                        <td className="px-3 py-4 text-right">
                                          <button
                                            type="button"
                                            disabled={
                                              isUpdating ||
                                              isCurrentUser
                                            }
                                            onClick={() => {
                                              void updateManagedUser(
                                                user.id,
                                                {
                                                  isActive:
                                                    !user.isActive,
                                                }
                                              );
                                            }}
                                            className={`rounded-lg border px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                              user.isActive
                                                ? "border-red-200 text-red-700 hover:bg-red-50"
                                                : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                            }`}
                                          >
                                            {isUpdating
                                              ? "Updating..."
                                              : user.isActive
                                                ? "Deactivate"
                                                : "Activate"}
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  }
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}

                        <p className="mt-4 text-xs leading-5 text-slate-400">
                          Your own ADMIN role and account cannot be removed from this screen. The system also requires at least one active ADMIN.
                        </p>
                      </div>
                    </SettingsCard>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      {/* =========================================================== */}
            {/* =========================================================== */}
      {/* DEPARTMENT MODAL */}
      {/* =========================================================== */}

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
{/* METADATA MODAL */}
      {/* =========================================================== */}

      {/* BULK METADATA UPLOAD */}
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
                <h2 id="bulk-metadata-title" className="mt-1 text-xl font-bold text-slate-900">
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
                      const file = event.target.files?.[0] ?? null;
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
                <p className="font-semibold text-slate-800">Required column</p>
                <p className="mt-1">reference_code</p>
                <p className="mt-2 font-semibold text-slate-800">Optional columns</p>
                <p className="mt-1">person_name, title, department, document_type, year, document_date, section, description</p>
                <p className="mt-2">Any other columns are preserved as additional metadata.</p>
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
                  disabled={bulkMetadataLoading || bulkMetadataImporting}
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkMetadataPreview}
                  disabled={!bulkMetadataFile || bulkMetadataLoading || bulkMetadataImporting}
                  className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {bulkMetadataLoading ? "Validating..." : "Preview Upload"}
                </button>
              </div>

              {bulkMetadataPreview && (
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                    <p className="font-semibold text-slate-900">
                      Preview: {bulkMetadataPreview.totalRows} row(s)
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {bulkMetadataPreview.truncated ? "Showing the first 100 rows." : "All rows are shown."}
                    </p>
                    {bulkMetadataPreview.existingReferenceCodes.length > 0 && (
                      <p className="mt-2 text-sm font-semibold text-red-600">
                        Existing references: {bulkMetadataPreview.existingReferenceCodes.join(", ")}
                      </p>
                    )}
                  </div>

                  <div className="max-h-80 overflow-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="sticky top-0 bg-white shadow-sm">
                        <tr className="border-b border-slate-200">
                          <th className="px-4 py-3 font-semibold text-slate-700">Row</th>
                          <th className="px-4 py-3 font-semibold text-slate-700">Reference</th>
                          <th className="px-4 py-3 font-semibold text-slate-700">Title</th>
                          <th className="px-4 py-3 font-semibold text-slate-700">Person</th>
                          <th className="px-4 py-3 font-semibold text-slate-700">Year</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkMetadataPreview.rows.map((row, index) => (
                          <tr key={`${String(row.referenceCode ?? "row")}-${index}`} className="border-b border-slate-100">
                            <td className="px-4 py-3 text-slate-500">{String(row.rowNumber ?? index + 1)}</td>
                            <td className="px-4 py-3 font-medium text-slate-900">{String(row.referenceCode ?? "")}</td>
                            <td className="px-4 py-3 text-slate-700">{String(row.title ?? "")}</td>
                            <td className="px-4 py-3 text-slate-700">{String(row.personName ?? "")}</td>
                            <td className="px-4 py-3 text-slate-700">{String(row.year ?? "")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-4">
                    <button
                      type="button"
                      onClick={handleBulkMetadataImport}
                      disabled={!bulkMetadataPreview.canImport || bulkMetadataImporting}
                      className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {bulkMetadataImporting ? "Importing..." : "Confirm Import"}
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
                  ref={
                    modalCloseButtonRef
                  }
                  type="button"
                  onClick={
                    closeMetadataModal
                  }
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
              onSubmit={
                handleMetadataSubmit
              }
              className="space-y-5 p-6"
            >
              <div className="grid gap-5 md:grid-cols-2">
                <FormField
                  id="metadata-reference-code"
                  label="Reference Code *"
                  value={
                    form.referenceCode
                  }
                  onChange={(value) =>
                    setForm({
                      ...form,
                      referenceCode:
                        value,
                    })
                  }
                  placeholder="HR-002"
                  required
                />

                <FormField
                  id="metadata-person-name"
                  label="Person Name"
                  value={
                    form.personName
                  }
                  onChange={(value) =>
                    setForm({
                      ...form,
                      personName:
                        value,
                    })
                  }
                  placeholder="Ian Mwangi"
                />
              </div>

              <FormField
                id="metadata-title"
                label="Document Title"
                value={
                  form.title
                }
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
                    value={
                      form.departmentId
                    }
                    onChange={(
                      event
                    ) =>
                      setForm({
                        ...form,
                        departmentId:
                          event.target
                            .value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  >
                    <option value="">
                      Select department
                    </option>

                    {departments.map(
                      (
                        department
                      ) => (
                        <option
                          key={
                            department.id
                          }
                          value={
                            department.id
                          }
                        >
                          {
                            department.name
                          }
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
                    value={
                      form.documentTypeId
                    }
                    onChange={(
                      event
                    ) =>
                      setForm({
                        ...form,
                        documentTypeId:
                          event.target
                            .value,
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
                          key={
                            type.id
                          }
                          value={
                            type.id
                          }
                        >
                          {
                            type.name
                          }
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
                  value={
                    form.year
                  }
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
                    value={
                      form.documentDate
                    }
                    onChange={(
                      event
                    ) =>
                      setForm({
                        ...form,
                        documentDate:
                          event.target
                            .value,
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
                        section: event.target.value,
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
                  value={
                    form.description
                  }
                  onChange={(event) =>
                    setForm({
                      ...form,
                      description:
                        event.target
                          .value,
                    })
                  }
                  placeholder="Additional record information..."
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>

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

                {form.additionalMetadata.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {form.additionalMetadata.map(
                      (field: AdditionalMetadataField, index: number) => (
                        <div
                          key={`${index}-${field.key}`}
                          className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"
                        >
                          <input
                            type="text"
                            value={field.key}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                additionalMetadata:
                                  current.additionalMetadata.map(
                                    (
                                      item: AdditionalMetadataField,
                                      itemIndex: number
                                    ) =>
                                      itemIndex === index
                                        ? {
                                            ...item,
                                            key: event.target.value,
                                          }
                                        : item
                                  ),
                              }))
                            }
                            placeholder="Field name e.g. Contract Number"
                            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                          />

                          <input
                            type="text"
                            value={field.value}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                additionalMetadata:
                                  current.additionalMetadata.map(
                                    (
                                      item: AdditionalMetadataField,
                                      itemIndex: number
                                    ) =>
                                      itemIndex === index
                                        ? {
                                            ...item,
                                            value: event.target.value,
                                          }
                                        : item
                                  ),
                              }))
                            }
                            placeholder="Value"
                            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                          />

                          <button
                            type="button"
                            onClick={() =>
                              setForm((current) => ({
                                ...current,
                                additionalMetadata:
                                  current.additionalMetadata.filter(
                                    (
                                      _item: AdditionalMetadataField,
                                      itemIndex: number
                                    ) => itemIndex !== index
                                  ),
                              }))
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
                  onClick={
                    closeMetadataModal
                  }
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

      {/* =========================================================== */}
      {/* UPLOAD MODAL */}
      {/* =========================================================== */}

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
                  ref={
                    modalCloseButtonRef
                  }
                  type="button"
                  onClick={
                    closeUploadModal
                  }
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
                      onChange={
                        handleFileChange
                      }
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
                            {
                              selectedFile.name
                            }
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
                      {
                        uploadError
                      }
                    </div>
                  )}

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={
                        closeUploadModal
                      }
                      disabled={
                        uploading
                      }
                      className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={
                        !selectedFile ||
                        uploading
                      }
                      aria-busy={
                        uploading
                      }
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
                              key ===
                              "document_code";

                            const isFilename =
                              key ===
                              "filename";

                            const isStatus =
                              key ===
                              "status";

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
                    <div className="mt-4 shrink-0 rounded-2xl border border-slate-200 bg-white text-left shadow-sm">
                      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                              AI Appraisal
                            </p>

                            <h4 className="mt-1 text-lg font-bold text-slate-900">
                              {uploadedAppraisal.matchType ===
                              "NO_MATCH"
                                ? "No metadata match found"
                                : "Likely metadata match detected"}
                            </h4>
                          </div>

                          <div className="rounded-xl bg-white px-4 py-3 text-center shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                              Confidence
                            </p>

                            <p className="mt-1 text-2xl font-bold text-blue-600">
                              {uploadedAppraisal.confidence}%
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <div className="mb-4">
                          <h3 className="text-base font-semibold text-slate-900">
                            Review & Edit Metadata
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">
                            Review and complete the extracted metadata before linking this document.
                            All metadata fields are required before the document can be linked.
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
                              onChange={(event) =>
                                setAppraisalMetadataForm((current) => ({
                                  ...current,
                                  referenceCode: event.target.value,
                                }))
                              }
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                            />
                          </label>

                          <label className="block">
                            <span className="mb-1 block text-sm font-medium text-slate-700">
                              Title
                            </span>
                            <input
                              type="text"
                              value={appraisalMetadataForm.title}
                              onChange={(event) =>
                                setAppraisalMetadataForm((current) => ({
                                  ...current,
                                  title: event.target.value,
                                }))
                              }
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                            />
                          </label>

                          <label className="block">
                            <span className="mb-1 block text-sm font-medium text-slate-700">
                              Document Date
                            </span>
                            <input
                              type="date"
                              value={appraisalMetadataForm.documentDate}
                              onChange={(event) =>
                                setAppraisalMetadataForm((current) => ({
                                  ...current,
                                  documentDate: event.target.value,
                                }))
                              }
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                            />
                          </label>

                          <label className="block">
                            <span className="mb-1 block text-sm font-medium text-slate-700">
                              Year
                            </span>
                            <input
                              type="number"
                              value={appraisalMetadataForm.year}
                              onChange={(event) =>
                                setAppraisalMetadataForm((current) => ({
                                  ...current,
                                  year: event.target.value,
                                }))
                              }
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                            />
                          </label>

                          <label className="block">
                            <span className="mb-1 block text-sm font-medium text-slate-700">
                              Person Name
                            </span>
                            <input
                              type="text"
                              value={appraisalMetadataForm.personName}
                              onChange={(event) =>
                                setAppraisalMetadataForm((current) => ({
                                  ...current,
                                  personName: event.target.value,
                                }))
                              }
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                            />
                          </label>

                          <label className="block">
                            <span className="mb-1 block text-sm font-medium text-slate-700">
                              Department
                            </span>
                            <select
                              value={appraisalMetadataForm.departmentId}
                              onChange={(event) =>
                                setAppraisalMetadataForm((current) => ({
                                  ...current,
                                  departmentId: event.target.value,
                                }))
                              }
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
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
                              onChange={(event) =>
                                setAppraisalMetadataForm((current) => ({
                                  ...current,
                                  documentTypeId: event.target.value,
                                }))
                              }
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
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
                              onChange={(event) =>
                                setAppraisalMetadataForm((current) => ({
                                  ...current,
                                  section: event.target.value,
                                }))
                              }
                              placeholder="e.g. Operations, Finance, Procurement"
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                            />
                          </label>

                          <label className="block md:col-span-2">
                            <span className="mb-1 block text-sm font-medium text-slate-700">
                              Description
                            </span>
                            <textarea
                              value={appraisalMetadataForm.description}
                              onChange={(event) =>
                                setAppraisalMetadataForm((current) => ({
                                  ...current,
                                  description: event.target.value,
                                }))
                              }
                              rows={4}
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                            />
                          </label>
                        </div>

                        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h4 className="text-sm font-bold text-slate-900">
                                Additional Metadata
                              </h4>
                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                Add document-specific fields discovered during
                                appraisal. These are saved with the metadata
                                record when you approve or create it.
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                setAppraisalAdditionalMetadata((current) => [
                                  ...current,
                                  {
                                    key: "",
                                    value: "",
                                  },
                                ])
                              }
                              className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
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
                                    key={"committed-" + index}
                                    className="grid gap-3 sm:grid-cols-[1fr_1.5fr_auto]"
                                  >
                                    <input
                                      type="text"
                                      value={field.key}
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
                                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
                                    />

                                    <input
                                      type="text"
                                      value={field.value}
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
                                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
                                    />

                                    <button
                                      type="button"
                                      onClick={() =>
                                        setAppraisalCommittedAdditionalMetadata(
                                          (current) =>
                                            current.filter(
                                              (_, itemIndex) =>
                                                itemIndex !== index
                                            )
                                        )
                                      }
                                      className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-white hover:text-red-600"
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
                                      key={"draft-" + index}
                                      className="grid gap-3 sm:grid-cols-[1fr_1.5fr_auto]"
                                    >
                                      <input
                                        type="text"
                                        value={field.key}
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
                                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
                                      />

                                      <input
                                        type="text"
                                        value={field.value}
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
                                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
                                      />

                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const fieldKey = field.key.trim();
                                            const fieldValue = field.value.trim();

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
                                          className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                                        >
                                          + Add
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            setAppraisalAdditionalMetadata(
                                              (current) =>
                                                current.filter(
                                                  (_, itemIndex) =>
                                                    itemIndex !== index
                                                )
                                            )
                                          }
                                          className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-white hover:text-red-600"
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

                                  <span>
                                    {field}
                                  </span>
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

                                      <span>
                                        {conflict.field}
                                      </span>
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

                                    <span>
                                      {field}
                                    </span>
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
                          uploadedAppraisal.matchType !==
                            "NO_MATCH" && (
                            <p className="mt-3 text-sm leading-6 text-slate-600">
                              The system found a likely metadata match.
                              No link has been created automatically.
                              Please review the recommendation before
                              changing the record relationship.
                            </p>
                          )}



                        {reviewError && (
                          <div
                            role="alert"
                            aria-live="assertive"
                            className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                          >
                            {reviewError}
                          </div>
                        )}

                        {uploadedAppraisal.decision !== "LINKED" &&
                          uploadedAppraisal.decision !==
                            "NEW_METADATA_CREATED" && (
                            <>
                              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-500"
                                    aria-hidden="true"
                                  />
                                  <span className="text-sm font-semibold text-amber-800">
                                    {appraisalRequiredFieldsComplete
                                      ? "Metadata complete."
                                      : "REVIEW REQUIRED"}
                                  </span>
                                </div>

                                <p className="mt-2 text-sm leading-6 text-amber-700">
                                  {appraisalRequiredFieldsComplete
                                    ? "All required metadata fields are complete. Approve & Link or select Done to save the metadata and link this document."
                                    : "Complete every required metadata field before this document can be linked."}
                                </p>
                              </div>

                              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                                {canManageDocuments && uploadedAppraisal.metadataRecordId && (
                                  <button
                                    type="button"
                                    disabled={
                                      reviewingDecision ||
                                      !appraisalRequiredFieldsComplete
                                    }
                                    onClick={() =>
                                      void handleAppraisalReview(
                                        "APPROVE"
                                      )
                                    }
                                    className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {reviewingDecision
                                      ? "Processing..."
                                      : "Approve & Link"}
                                  </button>
                                )}

                                {canManageDocuments && uploadedAppraisal.metadataRecordId && (
                                  <button
                                    type="button"
                                    disabled={reviewingDecision}
                                    onClick={() =>
                                      void handleAppraisalReview(
                                        "REJECT"
                                      )
                                    }
                                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    Reject Match
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                      </div>
                    </div>
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
                      disabled={
                        reviewingDecision ||
                        !appraisalRequiredFieldsComplete
                      }
                      onClick={() => {
                        if (!uploadedAppraisal) return;

                        if (
                          uploadedAppraisal.decision ===
                            "LINKED" ||
                          uploadedAppraisal.decision ===
                            "NEW_METADATA_CREATED"
                        ) {
                          closeUploadModal();
                          return;
                        }

                        void handleAppraisalReview(
                          uploadedAppraisal.metadataRecordId
                            ? "APPROVE"
                            : "REJECT"
                        );
                      }}
                      className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white 
transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 
disabled:cursor-not-allowed disabled:opacity-50"
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
    </main>
  );
}

/* =============================================================== */
/* NAV ITEM */
/* =============================================================== */

function NavItem({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: string;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={
        active
          ? "page"
          : undefined
      }
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 ${
        active
          ? "bg-slate-900 text-white shadow-sm"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      <span
        aria-hidden="true"
        className="w-5 text-center"
      >
        {icon}
      </span>

      {label}
    </button>
  );
}

/* =============================================================== */
/* WORKFLOW STEP */
/* =============================================================== */

function WorkflowStep({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-4">
      <div
        aria-hidden="true"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-bold text-slate-600"
      >
        {number}
      </div>

      <div>
        <p className="text-sm font-bold">
          {title}
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          {text}
        </p>
      </div>
    </div>
  );
}

/* =============================================================== */
/* SUMMARY CARD */
/* =============================================================== */

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-3xl font-bold tracking-tight">
        {value}
      </p>
    </div>
  );
}

/* =============================================================== */
/* STATUS BADGE */
/* =============================================================== */

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const normalized =
    status.toUpperCase();

  let classes =
    "bg-slate-100 text-slate-700";

  let label = status;

  if (
    normalized ===
    "AWAITING_DOCUMENT"
  ) {
    classes =
      "bg-amber-100 text-amber-800";

    label =
      "Awaiting Document";
  }

  if (
    normalized === "LINKED"
  ) {
    classes =
      "bg-emerald-100 text-emerald-800";

    label = "Linked";
  }

  if (
    normalized === "UNLINKED"
  ) {
    classes =
      "bg-slate-100 text-slate-700";

    label = "Unlinked";
  }

  if (
    normalized === "NEEDS_REVIEW" ||
    normalized === "REVIEW"
  ) {
    classes =
      "bg-orange-100 text-orange-800";

    label = "Needs Review";
  }

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${classes}`}
    >
      {label}
    </span>
  );
}

/* =============================================================== */
/* FORM FIELD */
/* =============================================================== */

function FormField({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-semibold"
      >
        {label}
      </label>

      <input
        id={id}
        required={required}
        type={type}
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        placeholder={
          placeholder
        }
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
      />
    </div>
  );
}

/* =============================================================== */
/* SETTINGS CARD */
/* =============================================================== */

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5">
        <h3 className="font-bold">
          {title}
        </h3>

        <p className="mt-1 text-sm text-slate-500">
          {description}
        </p>
      </div>

      <div className="divide-y divide-slate-100">
        {children}
      </div>
    </section>
  );
}

/* =============================================================== */
/* SETTING ROW */
/* =============================================================== */

function SettingRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <span className="text-sm text-slate-600">
        {label}
      </span>

      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
        {value}
      </span>
    </div>
  );
}



