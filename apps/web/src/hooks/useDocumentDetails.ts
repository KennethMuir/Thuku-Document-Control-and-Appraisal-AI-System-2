"use client";

import { useCallback, useState } from "react";

import { getDocumentDetails } from "@/lib/api/documentDetails";

export type DocumentDetailsData = {
  document: Record<string, unknown>;
  mainMetadata: Record<string, unknown> | null;
  additionalMetadata: Record<string, unknown>;
  universalMetadata: Array<Record<string, unknown>>;
  domainClassifications: Array<Record<string, unknown>>;
  domainRelationships: Array<Record<string, unknown>>;
};

export function useDocumentDetails() {
  const [expandedDocumentId, setExpandedDocumentId] =
    useState<number | null>(null);

  const [documentDetails, setDocumentDetails] =
    useState<DocumentDetailsData | null>(null);

  const [loadingDocumentDetails, setLoadingDocumentDetails] =
    useState(false);

  const [documentDetailsError, setDocumentDetailsError] =
    useState<string | null>(null);

  const closeDocumentDetails = useCallback(() => {
    setExpandedDocumentId(null);
    setDocumentDetails(null);
    setDocumentDetailsError(null);
  }, []);

  const openDocumentDetails = useCallback(
    async (documentId: number) => {
      if (expandedDocumentId === documentId) {
        closeDocumentDetails();
        return;
      }

      setExpandedDocumentId(documentId);
      setDocumentDetails(null);
      setDocumentDetailsError(null);
      setLoadingDocumentDetails(true);

      try {
        const response =
          await getDocumentDetails(documentId);

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(
            payload?.error ||
              "Failed to load document details."
          );
        }

        if (
          !payload?.success ||
          !payload?.data
        ) {
          throw new Error(
            "Document details response was invalid."
          );
        }

        setDocumentDetails(payload.data);
      } catch (error) {
        setDocumentDetailsError(
          error instanceof Error
            ? error.message
            : "Failed to load document details."
        );
      } finally {
        setLoadingDocumentDetails(false);
      }
    },
    [
      expandedDocumentId,
      closeDocumentDetails,
    ]
  );

  return {
    expandedDocumentId,
    documentDetails,
    loadingDocumentDetails,
    documentDetailsError,
    openDocumentDetails,
    closeDocumentDetails,
  };
}
