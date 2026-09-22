"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createMetadataValue,
  deleteMetadataValue,
  getMetadataValues,
} from "@/lib/api/metadataValues";

import {
  getFieldRegistry,
} from "@/lib/api/fieldRegistry";

import type {
  AuthUser,
} from "@/types/auth";

import type {
  CreateMetadataValueInput,
  MetadataFieldDefinition,
  MetadataValue,
  MetadataValueSource,
  MetadataValueVerificationStatus,
} from "@/types/metadataValues";

type UseMetadataValuesOptions = {
  authLoading: boolean;
  authUser: AuthUser | null;
};

function getErrorMessage(
  data: unknown,
  fallback: string
): string {
  if (
    typeof data === "object" &&
    data !== null &&
    "message" in data &&
    typeof data.message === "string"
  ) {
    return data.message;
  }

  if (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof data.error === "string"
  ) {
    return data.error;
  }

  return fallback;
}

export function useMetadataValues({
  authLoading,
  authUser,
}: UseMetadataValuesOptions) {
  const [metadataRecordId, setMetadataRecordId] =
    useState<string | null>(null);

  const [fields, setFields] =
    useState<MetadataFieldDefinition[]>([]);

  const [values, setValues] =
    useState<MetadataValue[]>([]);

  const [selectedFieldId, setSelectedFieldId] =
    useState<string>("");

  const [valueInput, setValueInput] =
    useState("");

  const [source, setSource] =
    useState<MetadataValueSource>("USER");

  const [confidenceInput, setConfidenceInput] =
    useState("");

  const [verificationStatus, setVerificationStatus] =
    useState<MetadataValueVerificationStatus>("UNVERIFIED");

  const [loading, setLoading] =
    useState(false);

  const [fieldsLoading, setFieldsLoading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [deletingId, setDeletingId] =
    useState<number | null>(null);

  const [error, setError] =
    useState("");

  const [fieldRegistryError, setFieldRegistryError] =
    useState("");

  const selectedField = useMemo(
    () =>
      fields.find(
        (field) =>
          String(field.id) ===
          String(selectedFieldId)
      ) ?? null,
    [fields, selectedFieldId]
  );

  const loadFields = useCallback(
    async () => {
      if (authLoading || !authUser) {
        return;
      }

      try {
        setFieldsLoading(true);
        setFieldRegistryError("");

        const response =
          await getFieldRegistry();

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            getErrorMessage(
              data,
              "Unable to load field definitions."
            )
          );
        }

        setFields(
          Array.isArray(data.field_registry)
            ? data.field_registry
            : Array.isArray(data.fields)
              ? data.fields
              : Array.isArray(data.data)
                ? data.data
                : []
        );
      } catch (loadError) {
        console.error(
          "Field registry request failed:",
          loadError
        );

        setFields([]);

        setFieldRegistryError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load field definitions."
        );
      } finally {
        setFieldsLoading(false);
      }
    },
    [authLoading, authUser]
  );

  const loadValues = useCallback(
    async () => {
      if (
        authLoading ||
        !authUser ||
        !metadataRecordId
      ) {
        setValues([]);
        return;
      }

      const recordId =
        Number(metadataRecordId);

      if (!Number.isInteger(recordId) || recordId <= 0) {
        setValues([]);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const response =
          await getMetadataValues(recordId);

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            getErrorMessage(
              data,
              "Unable to load metadata values."
            )
          );
        }

        setValues(
          Array.isArray(data.values)
            ? data.values
            : Array.isArray(data.data)
              ? data.data
              : []
        );
      } catch (loadError) {
        console.error(
          "Metadata values request failed:",
          loadError
        );

        setValues([]);

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load metadata values."
        );
      } finally {
        setLoading(false);
      }
    },
    [
      authLoading,
      authUser,
      metadataRecordId,
    ]
  );

  useEffect(() => {
    void loadFields();
  }, [loadFields]);

  useEffect(() => {
    void loadValues();
  }, [loadValues]);

  const saveValue = useCallback(
    async () => {
      if (!metadataRecordId) {
        return;
      }

      if (!selectedFieldId) {
        return;
      }

      const recordId =
        Number(metadataRecordId);

      const fieldId =
        Number(selectedFieldId);

      if (
        !Number.isInteger(recordId) ||
        recordId <= 0 ||
        !Number.isInteger(fieldId) ||
        fieldId <= 0
      ) {
        return;
      }

      const confidence =
        confidenceInput.trim() === ""
          ? null
          : Number(confidenceInput);

      const input: CreateMetadataValueInput = {
        metadata_record_id: recordId,
        field_registry_id: fieldId,
        value: valueInput,
        source,
        confidence,
        verification_status:
          verificationStatus,
      };

      try {
        setSaving(true);
        setError("");

        const response =
          await createMetadataValue(input);

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            getErrorMessage(
              data,
              "Unable to save metadata value."
            )
          );
        }

        await loadValues();

        setValueInput("");
        setConfidenceInput("");
        setSelectedFieldId("");
        setSource("USER");
        setVerificationStatus("UNVERIFIED");

        return data;
      } catch (saveError) {
        console.error(
          "Metadata value save failed:",
          saveError
        );

        setError(
          saveError instanceof Error
            ? saveError.message
            : "Unable to save metadata value."
        );

        throw saveError;
      } finally {
        setSaving(false);
      }
    },
    [
      metadataRecordId,
      selectedFieldId,
      valueInput,
      source,
      confidenceInput,
      verificationStatus,
      loadValues,
    ]
  );

  const removeValue = useCallback(
    async (valueId: number) => {
      try {
        setDeletingId(valueId);
        setError("");

        const response =
          await deleteMetadataValue(valueId);

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            getErrorMessage(
              data,
              "Unable to delete metadata value."
            )
          );
        }

        await loadValues();

        return data;
      } catch (deleteError) {
        console.error(
          "Metadata value deletion failed:",
          deleteError
        );

        setError(
          deleteError instanceof Error
            ? deleteError.message
            : "Unable to delete metadata value."
        );

        throw deleteError;
      } finally {
        setDeletingId(null);
      }
    },
    [loadValues]
  );

  return {
    metadataRecordId,
    setMetadataRecordId,

    values,
    fields,

    selectedField,
    selectedFieldId,
    setSelectedFieldId,

    valueInput,
    setValueInput,

    source,
    setSource,

    confidenceInput,
    setConfidenceInput,

    verificationStatus,
    setVerificationStatus,

    loading,
    fieldsLoading,
    saving,

    deletingId,
    error,
    fieldRegistryError,

    saveValue,
    removeValue,
  };
}
