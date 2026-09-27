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
  updateMetadataValue,
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
  UpdateMetadataValueInput,
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

function formatEditorValue(
  value: unknown
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  if (
    typeof value === "object"
  ) {
    try {
      return JSON.stringify(
        value
      );
    } catch {
      return String(value);
    }
  }

  return String(value);
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

  const [editingValueId, setEditingValueId] =
    useState<number | null>(null);

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

  // Intentional data-loading effect: loadFields updates state when its request resolves.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void loadFields();
  }, [loadFields]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Intentional data-loading effect: loadValues updates state when its request resolves.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void loadValues();
  }, [loadValues]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Intentional editor synchronization: persisted values populate Step 2
  // after the selected record, field, and loaded values are available.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!metadataRecordId || !selectedFieldId) {
      return;
    }

    const existingValue = values.find(
      (value) =>
        String(value.metadata_record_id) ===
          String(metadataRecordId) &&
        String(value.field_registry_id) ===
          String(selectedFieldId)
    );

    if (
      selectedField?.field_key ===
      "reference_code"
    ) {
      setEditingValueId(null);
      setValueInput("");
      setSource("SYSTEM");
      setConfidenceInput("");
      setVerificationStatus("VERIFIED");
      return;
    }

    if (
      selectedField?.repeatable &&
      editingValueId === null
    ) {
      setValueInput("");
      setSource("USER");
      setConfidenceInput("");
      setVerificationStatus("UNVERIFIED");
      return;
    }

    if (existingValue) {
      setEditingValueId(existingValue.id);
      setValueInput(
        formatEditorValue(existingValue.value)
      );
      setSource(existingValue.source);
      setConfidenceInput(
        existingValue.confidence === null ||
          existingValue.confidence === undefined
          ? ""
          : String(existingValue.confidence)
      );
      setVerificationStatus(
        existingValue.verification_status
      );
      return;
    }

    setEditingValueId(null);
    setValueInput("");
    setSource("USER");
    setConfidenceInput("");
    setVerificationStatus("UNVERIFIED");
  }, [
    metadataRecordId,
    selectedFieldId,
    selectedField,
    values,
    editingValueId,
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const resetEditor = useCallback(() => {
    setValueInput("");
    setConfidenceInput("");
    setSelectedFieldId("");
    setSource("USER");
    setVerificationStatus("UNVERIFIED");
    setEditingValueId(null);
  }, []);

  const editValue = useCallback(
    (value: MetadataValue) => {
      setError("");

      setEditingValueId(value.id);
      setSelectedFieldId(
        String(value.field_registry_id)
      );
      setValueInput(
        formatEditorValue(value.value)
      );
      setSource(value.source);
      setConfidenceInput(
        value.confidence === null ||
        value.confidence === undefined
          ? ""
          : String(value.confidence)
      );
      setVerificationStatus(
        value.verification_status
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    },
    []
  );

  const cancelEdit = useCallback(() => {
    resetEditor();
    setError("");
  }, [resetEditor]);

  const saveValue = useCallback(
    async () => {
      if (!metadataRecordId) {
        return;
      }

      if (!selectedFieldId) {
        return;
      }

      if (
        selectedField?.field_key ===
        "reference_code"
      ) {
        setError(
          "Reference Code is system-generated from the selected Department and cannot be manually changed."
        );
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

      const createInput: CreateMetadataValueInput = {
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

        let response: Response;

        if (editingValueId !== null) {
          const updateInput: UpdateMetadataValueInput = {
            value: valueInput,
            source,
            confidence,
            verification_status:
              verificationStatus,
          };

          response =
            await updateMetadataValue(
              editingValueId,
              updateInput
            );
        } else {
          response =
            await createMetadataValue(
              createInput
            );
        }

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            getErrorMessage(
              data,
              editingValueId !== null
                ? "Unable to update metadata value."
                : "Unable to save metadata value."
            )
          );
        }

        await loadValues();

        resetEditor();

        return data;
      } catch (saveError) {
        console.error(
          "Metadata value save failed:",
          saveError
        );

        setError(
          saveError instanceof Error
            ? saveError.message
            : editingValueId !== null
              ? "Unable to update metadata value."
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
      editingValueId,
      selectedField,
      loadValues,
      resetEditor,
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

        if (editingValueId === valueId) {
          resetEditor();
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
    [
      editingValueId,
      loadValues,
      resetEditor,
    ]
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

    editingValueId,
    editValue,
    cancelEdit,

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




