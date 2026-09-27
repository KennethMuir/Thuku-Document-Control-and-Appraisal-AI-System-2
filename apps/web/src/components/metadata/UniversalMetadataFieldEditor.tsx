"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useFieldRegistry,
  type FieldDefinition,
} from "@/hooks/useFieldRegistry";

import {
  UNIVERSAL_METADATA_CATALOGUE,
} from "@/lib/metadata/universalMetadataCatalogue";

import {
  resetUniversalMetadataDraft,
  setUniversalMetadataFieldSelected,
  setUniversalMetadataValue,
  addUniversalMetadataRepeatValue,
  removeUniversalMetadataRepeatValue,
  useUniversalMetadataDraft,
  type UniversalMetadataScope,
} from "@/lib/metadata/universalMetadataDraft";

type UniversalMetadataFieldEditorProps = {
  scope: UniversalMetadataScope;
  disabled?: boolean;
  title?: string;
  description?: string;
};

function getVocabularyOptions(
  field: FieldDefinition
): string[] {
  const vocabulary =
    field.controlled_vocabulary;

  if (
    vocabulary &&
    typeof vocabulary === "object" &&
    !Array.isArray(vocabulary) &&
    "options" in vocabulary
  ) {
    const options =
      (vocabulary as {
        options?: unknown;
      }).options;

    if (Array.isArray(options)) {
      return options
        .filter(
          (option): option is string =>
            typeof option === "string"
        )
        .map((option) => option.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function formatDataType(
  value: string
): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

export function UniversalMetadataFieldEditor({
  scope,
  disabled = false,
  title = "Universal Metadata",
  description = "Select fields from the global metadata catalogue and enter their values.",
}: UniversalMetadataFieldEditorProps) {
  const {
    fieldDefinitions,
    loading,
    error,
  } = useFieldRegistry();

  const draft =
    useUniversalMetadataDraft(scope);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    isOpen,
    setIsOpen,
  ] = useState(false);

  useEffect(() => {
    resetUniversalMetadataDraft(scope);
  }, [scope]);

  const activeFields =
    useMemo(
      () =>
        fieldDefinitions
          .filter(
            (field) =>
              field.is_active
          )
          .sort((left, right) =>
            left.display_name.localeCompare(
              right.display_name
            )
          ),
      [fieldDefinitions]
    );

  const fieldByKey = useMemo(() => {
    const map = new Map<
      string,
      FieldDefinition
    >();

    for (const field of activeFields) {
      map.set(
        field.field_key,
        field
      );
    }

    return map;
  }, [activeFields]);

  const normalizedSearch =
    search.trim().toLowerCase();

  const visibleGroups =
    UNIVERSAL_METADATA_CATALOGUE.map(
      (group) => {
        const fields =
          group.fieldKeys
            .map((fieldKey) =>
              fieldByKey.get(fieldKey)
            )
            .filter(
              (
                field
              ): field is FieldDefinition =>
                Boolean(field)
            )
            .filter((field) => {
              if (!normalizedSearch) {
                return true;
              }

              return (
                field.display_name
                  .toLowerCase()
                  .includes(
                    normalizedSearch
                  ) ||
                field.field_key
                  .toLowerCase()
                  .includes(
                    normalizedSearch
                  ) ||
                (
                  field.description ??
                  ""
                )
                  .toLowerCase()
                  .includes(
                    normalizedSearch
                  )
              );
            });

        return {
          ...group,
          fields,
        };
      }
    ).filter(
      (group) =>
        group.fields.length > 0
    );

  const selectedFields =
    draft.selectedFieldIds
      .map((id) =>
        activeFields.find(
          (field) =>
            Number(field.id) === id
        )
      )
      .filter(
        (
          field
        ): field is FieldDefinition =>
          Boolean(field)
      );

  const renderInput = (
    field: FieldDefinition,
    value: unknown,
    index: number
  ) => {
    const stringValue =
      value === null ||
      value === undefined
        ? ""
        : String(value);

    const commonClass =
      "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100";

    const updateValue = (
      nextValue: unknown
    ) => {
      setUniversalMetadataValue(
        scope,
        Number(field.id),
        nextValue,
        index
      );
    };

    if (
      field.data_type ===
      "boolean"
    ) {
      return (
        <select
          value={
            value === true
              ? "true"
              : value === false
                ? "false"
                : ""
          }
          disabled={disabled}
          onChange={(event) => {
            if (
              event.target.value ===
              ""
            ) {
              updateValue("");
            } else {
              updateValue(
                event.target.value ===
                  "true"
              );
            }
          }}
          className={commonClass}
        >
          <option value="">
            Select value
          </option>
          <option value="true">
            Yes / True
          </option>
          <option value="false">
            No / False
          </option>
        </select>
      );
    }

    const vocabularyOptions =
      getVocabularyOptions(field);

    if (
      field.data_type ===
        "controlled_vocabulary" &&
      vocabularyOptions.length > 0
    ) {
      return (
        <select
          value={stringValue}
          disabled={disabled}
          onChange={(event) =>
            updateValue(
              event.target.value
            )
          }
          className={commonClass}
        >
          <option value="">
            Select value
          </option>

          {vocabularyOptions.map(
            (option) => (
              <option
                key={option}
                value={option}
              >
                {option}
              </option>
            )
          )}
        </select>
      );
    }

    let inputType = "text";
    let step:
      | string
      | undefined;

    switch (field.data_type) {
      case "integer":
      case "year":
        inputType = "number";
        step = "1";
        break;

      case "decimal":
        inputType = "number";
        step = "any";
        break;

      case "date":
        inputType = "date";
        break;

      case "datetime":
        inputType = "datetime-local";
        break;

      case "email":
        inputType = "email";
        break;

      case "url":
        inputType = "url";
        break;

      default:
        inputType = "text";
    }

    if (
      field.data_type ===
        "text" &&
      (
        field.field_key ===
          "description" ||
        field.field_key ===
          "subject" ||
        field.field_key ===
          "keywords"
      )
    ) {
      return (
        <textarea
          value={stringValue}
          disabled={disabled}
          rows={3}
          onChange={(event) =>
            updateValue(
              event.target.value
            )
          }
          className={commonClass}
        />
      );
    }

    return (
      <input
        type={inputType}
        step={step}
        value={stringValue}
        disabled={disabled}
        onChange={(event) =>
          updateValue(
            event.target.value
          )
        }
        className={commonClass}
      />
    );
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={() =>
          setIsOpen((current) => !current)
        }
        disabled={disabled}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="min-w-0">
          <span className="block text-sm font-bold text-slate-900">
            {title}
          </span>

          <span className="mt-0.5 block text-xs text-slate-500">
            {draft.selectedFieldIds.length} field
            {draft.selectedFieldIds.length === 1
              ? ""
              : "s"} selected
          </span>
        </span>

        <span
          aria-hidden="true"
          className={`shrink-0 text-xs text-slate-500 transition-transform ${
            isOpen
              ? "rotate-180"
              : ""
          }`}
        >
          ▼
        </span>
      </button>

      {isOpen ? (
        <div className="border-t border-slate-200 p-5">
          <div>
            <p className="mb-4 text-xs leading-5 text-slate-500">
              {description}
            </p>

        <div className="mt-4">
          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search universal metadata fields..."
            disabled={disabled}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          />
        </div>

      {loading && (
        <p className="mt-4 text-sm text-slate-500">
          Loading universal metadata fields...
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {!loading &&
        !error && (
          <>
            <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
              {visibleGroups.map(
                (group) => {
                  const allSelected =
                    group.fields.length >
                      0 &&
                    group.fields.every(
                      (field) =>
                        draft.selectedFieldIds.includes(
                          Number(
                            field.id
                          )
                        )
                    );

                  return (
                    <details
                      key={group.key}
                      open={
                        Boolean(
                          normalizedSearch
                        ) ||
                        group.fields.some(
                          (field) =>
                            draft.selectedFieldIds.includes(
                              Number(
                                field.id
                              )
                            )
                        )
                      }
                      className="rounded-xl border border-slate-200 bg-white"
                    >
                      <summary className="cursor-pointer list-none px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-slate-900">
                              {group.label}
                            </p>

                            <p className="mt-0.5 text-xs text-slate-500">
                              {group.fields.length} available
                            </p>
                          </div>

                          <span className="text-xs text-slate-400">
                            {allSelected
                              ? "All selected"
                              : "Browse"}
                          </span>
                        </div>
                      </summary>

                      <div className="border-t border-slate-100 p-3">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            for (const field of group.fields) {
                              setUniversalMetadataFieldSelected(
                                scope,
                                Number(field.id),
                                !allSelected,
                                Boolean(field.repeatable)
                              );
                            }
                          }}
                          className="mb-2 text-xs font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50"
                        >
                          {allSelected
                            ? "Clear group"
                            : "Select all in group"}
                        </button>

                        <div className="grid gap-2 sm:grid-cols-2">
                          {group.fields.map(
                            (field) => {
                              const id =
                                Number(
                                  field.id
                                );

                              const selected =
                                draft.selectedFieldIds.includes(
                                  id
                                );

                              return (
                                <label
                                  key={field.id}
                                  className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition ${
                                    selected
                                      ? "border-blue-300 bg-blue-50"
                                      : "border-slate-200 bg-white hover:bg-slate-50"
                                  } ${
                                    disabled
                                      ? "cursor-not-allowed opacity-60"
                                      : ""
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selected}
                                    disabled={
                                      disabled
                                    }
                                    onChange={(
                                      event
                                    ) =>
                                      setUniversalMetadataFieldSelected(
                                        scope,
                                        id,
                                        event
                                          .target
                                          .checked,
                                        Boolean(
                                          field.repeatable
                                        )
                                      )
                                    }
                                    className="mt-1 h-4 w-4 rounded border-slate-300"
                                  />

                                  <span className="min-w-0">
                                    <span className="block text-sm font-semibold text-slate-800">
                                      {
                                        field.display_name
                                      }
                                    </span>

                                    <span className="mt-0.5 block text-[11px] text-slate-400">
                                      {
                                        field.field_key
                                      }{" "}
                                      ·{" "}
                                      {formatDataType(
                                        field.data_type
                                      )}
                                    </span>
                                  </span>
                                </label>
                              );
                            }
                          )}
                        </div>
                      </div>
                    </details>
                  );
                }
              )}
            </div>

            {selectedFields.length > 0 && (
              <div className="mt-5 border-t border-slate-200 pt-5">
                <div className="mb-3">
                  <h4 className="text-sm font-bold text-slate-900">
                    Selected Universal Metadata Values
                  </h4>

                  <p className="mt-1 text-xs text-slate-500">
                    Enter only values that apply to this record.
                  </p>
                </div>

                <div className="space-y-4">
                  {selectedFields.map(
                    (field) => {
                      const fieldId =
                        Number(
                          field.id
                        );

                      const values =
                        draft.values[
                          String(fieldId)
                        ] ?? [""];

                      const repeatable =
                        Boolean(
                          field.repeatable
                        );

                      return (
                        <div
                          key={field.id}
                          className="rounded-xl border border-slate-200 bg-white p-4"
                        >
                          <div className="mb-2 flex items-start justify-between gap-3">
                            <div>
                              <label className="block text-sm font-semibold text-slate-800">
                                {
                                  field.display_name
                                }
                              </label>

                              <p className="mt-0.5 text-[11px] text-slate-400">
                                {
                                  field.field_key
                                }{" "}
                                ·{" "}
                                {formatDataType(
                                  field.data_type
                                )}
                                {field.unit
                                  ? ` · ${field.unit}`
                                  : ""}
                              </p>
                            </div>

                            <button
                              type="button"
                              disabled={disabled}
                              onClick={() =>
                                setUniversalMetadataFieldSelected(
                                  scope,
                                  fieldId,
                                  false,
                                  repeatable
                                )
                              }
                              className="text-xs font-semibold text-slate-500 hover:text-red-600 disabled:opacity-50"
                            >
                              Remove
                            </button>
                          </div>

                          <div className="space-y-2">
                            {values.map(
                              (
                                value,
                                index
                              ) => (
                                <div
                                  key={`${field.id}-${index}`}
                                  className="flex items-start gap-2"
                                >
                                  <div className="min-w-0 flex-1">
                                    {renderInput(
                                      field,
                                      value,
                                      index
                                    )}
                                  </div>

                                  {repeatable &&
                                    values.length >
                                      1 && (
                                      <button
                                        type="button"
                                        disabled={
                                          disabled
                                        }
                                        onClick={() =>
                                          removeUniversalMetadataRepeatValue(
                                            scope,
                                            fieldId,
                                            index
                                          )
                                        }
                                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-500 hover:text-red-600 disabled:opacity-50"
                                      >
                                        Remove
                                      </button>
                                    )}
                                </div>
                              )
                            )}
                          </div>

                          {repeatable && (
                            <button
                              type="button"
                              disabled={disabled}
                              onClick={() =>
                                addUniversalMetadataRepeatValue(
                                  scope,
                                  fieldId
                                )
                              }
                              className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50"
                            >
                              + Add another value
                            </button>
                          )}

                          {field.description && (
                            <p className="mt-2 text-xs leading-5 text-slate-500">
                              {
                                field.description
                              }
                            </p>
                          )}
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            )}
          </>
        )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default UniversalMetadataFieldEditor;


