"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  searchDocuments,
} from "@/lib/api/search";

import type {
  AuthUser,
} from "@/types/auth";

import type {
  SearchResult,
} from "@/types/search";

type UseDocumentSearchOptions = {
  authLoading: boolean;
  authUser: AuthUser | null;
};

export function useDocumentSearch({
  authLoading,
  authUser,
}: UseDocumentSearchOptions) {
  const [
    searchResults,
    setSearchResults,
  ] = useState<SearchResult[]>(
    []
  );

  const [
    searchLoading,
    setSearchLoading,
  ] = useState(false);

  const [
    searchError,
    setSearchError,
  ] = useState("");

  const [
    searchTerm,
    setSearchTerm,
  ] = useState("");

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

  return {
    searchResults,
    setSearchResults,

    searchLoading,
    setSearchLoading,

    searchError,
    setSearchError,

    searchTerm,
    setSearchTerm,
  };
}