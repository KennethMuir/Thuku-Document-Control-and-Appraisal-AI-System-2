"use client";

import {
  useSyncExternalStore,
} from "react";

export type UniversalMetadataScope =
  | "register"
  | "appraisal";

export type UniversalMetadataDraft = {
  selectedFieldIds: number[];
  values: Record<string, unknown[]>;
  repeatable: Record<string, boolean>;
};

const EMPTY_DRAFT: UniversalMetadataDraft = {
  selectedFieldIds: [],
  values: {},
  repeatable: {},
};

let state: Record<
  UniversalMetadataScope,
  UniversalMetadataDraft
> = {
  register: EMPTY_DRAFT,
  appraisal: EMPTY_DRAFT,
};

const listeners = new Set<() => void>();

const cloneDraft = (
  draft: UniversalMetadataDraft
): UniversalMetadataDraft => ({
  selectedFieldIds: [...draft.selectedFieldIds],
  values: { ...draft.values },
  repeatable: { ...draft.repeatable },
});

const notify = () => {
  for (const listener of listeners) {
    listener();
  }
};

export function subscribeUniversalMetadataDraft(
  listener: () => void
): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getUniversalMetadataDraft(
  scope: UniversalMetadataScope
): UniversalMetadataDraft {
  return state[scope];
}

export function resetUniversalMetadataDraft(
  scope: UniversalMetadataScope
): void {
  state = {
    ...state,
    [scope]: cloneDraft(EMPTY_DRAFT),
  };

  notify();
}

export function setUniversalMetadataFieldSelected(
  scope: UniversalMetadataScope,
  fieldId: number,
  selected: boolean,
  repeatable = false
): void {
  const current = state[scope];
  const ids = new Set(current.selectedFieldIds);

  if (selected) {
    ids.add(fieldId);

    state = {
      ...state,
      [scope]: {
        selectedFieldIds: [...ids],
        values: {
          ...current.values,
          [String(fieldId)]:
            current.values[String(fieldId)] ??
            [""],
        },
        repeatable: {
          ...current.repeatable,
          [String(fieldId)]: repeatable,
        },
      },
    };
  } else {
    ids.delete(fieldId);

    const values = {
      ...current.values,
    };

    const repeatability = {
      ...current.repeatable,
    };

    delete values[String(fieldId)];
    delete repeatability[String(fieldId)];

    state = {
      ...state,
      [scope]: {
        selectedFieldIds: [...ids],
        values,
        repeatable: repeatability,
      },
    };
  }

  notify();
}

export function setUniversalMetadataValue(
  scope: UniversalMetadataScope,
  fieldId: number,
  value: unknown,
  index = 0
): void {
  const current = state[scope];
  const key = String(fieldId);
  const values = [
    ...(current.values[key] ?? [""]),
  ];

  values[index] = value;

  state = {
    ...state,
    [scope]: {
      ...current,
      values: {
        ...current.values,
        [key]: values,
      },
    },
  };

  notify();
}

export function addUniversalMetadataRepeatValue(
  scope: UniversalMetadataScope,
  fieldId: number
): void {
  const current = state[scope];
  const key = String(fieldId);

  state = {
    ...state,
    [scope]: {
      ...current,
      values: {
        ...current.values,
        [key]: [
          ...(current.values[key] ?? [""]),
          "",
        ],
      },
    },
  };

  notify();
}

export function removeUniversalMetadataRepeatValue(
  scope: UniversalMetadataScope,
  fieldId: number,
  index: number
): void {
  const current = state[scope];
  const key = String(fieldId);

  const values = [
    ...(current.values[key] ?? []),
  ].filter(
    (_value, valueIndex) =>
      valueIndex !== index
  );

  state = {
    ...state,
    [scope]: {
      ...current,
      values: {
        ...current.values,
        [key]:
          values.length > 0
            ? values
            : [""],
      },
    },
  };

  notify();
}

export function useUniversalMetadataDraft(
  scope: UniversalMetadataScope
): UniversalMetadataDraft {
  return useSyncExternalStore(
    subscribeUniversalMetadataDraft,
    () => state[scope],
    () => EMPTY_DRAFT
  );
}
