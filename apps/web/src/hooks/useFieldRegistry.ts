import React from "react";

import { useEffect, useState } from "react";

import { getFieldRegistry } from "@/lib/api/fieldRegistry";

export type FieldDefinition = {
  id: string;
  field_key: string;
  display_name: string;
  description: string | null;
  category: string;
  data_type: string;
  aliases: string[];
  repeatable: boolean;
  searchable: boolean;
  filterable: boolean;
  sortable: boolean;
  ai_extractable: boolean;
  user_editable: boolean;
  sensitive: boolean;
  validation_rule: Record<string, unknown>;
  controlled_vocabulary: Record<string, unknown>;
  unit: string | null;
  default_value: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  organization_id: number | null;
};

export type FieldRegistryState = {
  fieldDefinitions:
    FieldDefinition[];

  loading:
    boolean;

  error:
    string | null;
};

export function useFieldRegistry(): FieldRegistryState {
  const [
    state,
    setState,
  ] = React.useState<FieldRegistryState>({
    fieldDefinitions: [],
    loading: true,
    error: null,
  });

  React.useEffect(() => {
    let cancelled = false;

    const loadFieldDefinitions =
      async (): Promise<void> => {
        setState((current) => ({
          ...current,
          loading: true,
          error: null,
        }));

        try {
          const response =
            await getFieldRegistry();

          let data: unknown = null;

          try {
            data =
              await response.json();
          } catch {
            data = null;
          }

          if (!response.ok) {
            const responseError =
              typeof data === "object" &&
              data !== null &&
              "error" in data &&
              typeof (
                data as {
                  error?: unknown;
                }
              ).error === "string"
                ? (
                    data as {
                      error: string;
                    }
                  ).error
                : "Unable to retrieve field definitions.";

            throw new Error(
              responseError
            );
          }

          const fieldRegistry =
            typeof data === "object" &&
            data !== null &&
            "field_registry" in data &&
            Array.isArray(
              (
                data as {
                  field_registry?: unknown;
                }
              ).field_registry
            )
              ? (
                  data as {
                    field_registry: unknown[];
                  }
                ).field_registry
              : [];

          if (cancelled) {
            return;
          }

          setState({
            fieldDefinitions:
              fieldRegistry as FieldDefinition[],
            loading: false,
            error: null,
          });
        } catch (error: unknown) {
          if (cancelled) {
            return;
          }

          setState({
            fieldDefinitions: [],
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : "Unable to retrieve field definitions.",
          });
        }
      };

    void loadFieldDefinitions();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

