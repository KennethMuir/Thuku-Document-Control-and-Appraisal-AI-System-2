import {
  createMetadataValue,
  deleteMetadataValue,
  getMetadataValues,
  updateMetadataValue,
} from "@/lib/api/metadataValues";

import type {
  UniversalMetadataDraft,
} from "@/lib/metadata/universalMetadataDraft";

type ExistingMetadataValue = {
  id: number;
  field_registry_id: number;
  value: unknown;
};

function extractValues(
  payload: unknown
): ExistingMetadataValue[] {
  if (
    typeof payload !== "object" ||
    payload === null
  ) {
    return [];
  }

  const object =
    payload as Record<string, unknown>;

  const candidate =
    Array.isArray(object.metadata_values)
      ? object.metadata_values
      : Array.isArray(object.values)
        ? object.values
        : [];

  return candidate
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" &&
        item !== null
    )
    .map((item) => ({
      id: Number(item.id ?? 0),
      field_registry_id: Number(
        item.field_registry_id ?? 0
      ),
      value: item.value,
    }))
    .filter(
      (item) =>
        item.id > 0 &&
        item.field_registry_id > 0
    );
}

function isEmptyValue(
  value: unknown
): boolean {
  if (
    value === null ||
    value === undefined
  ) {
    return true;
  }

  if (
    typeof value === "string"
  ) {
    return value.trim().length === 0;
  }

  return false;
}

async function readResponse(
  response: Response
): Promise<unknown> {
  const payload =
    await response
      .json()
      .catch(() => null);

  if (
    !response.ok
  ) {
    const object =
      payload as Record<
        string,
        unknown
      > | null;

    throw new Error(
      typeof object?.error ===
        "string"
        ? object.error
        : typeof object?.message ===
            "string"
          ? object.message
          : "Unable to save universal metadata."
    );
  }

  return payload;
}

export async function persistUniversalMetadataValues(
  metadataRecordId: number,
  draft: UniversalMetadataDraft
): Promise<void> {
  if (
    !Number.isInteger(
      metadataRecordId
    ) ||
    metadataRecordId <= 0
  ) {
    return;
  }

  if (
    draft.selectedFieldIds.length ===
    0
  ) {
    return;
  }

  const existingResponse =
    await getMetadataValues(
      metadataRecordId
    );

  const existingPayload =
    await readResponse(
      existingResponse
    );

  const existingValues =
    extractValues(
      existingPayload
    );

  for (const fieldRegistryId of draft.selectedFieldIds) {
    const key = String(
      fieldRegistryId
    );

    const desiredValues = (
      draft.values[key] ?? []
    ).filter(
      (value) =>
        !isEmptyValue(value)
    );

    const existing =
      existingValues.filter(
        (item) =>
          item.field_registry_id ===
          fieldRegistryId
      );

    const repeatable =
      Boolean(
        draft.repeatable[key]
      );

    if (repeatable) {
      for (const item of existing) {
        const response =
          await deleteMetadataValue(
            item.id
          );

        await readResponse(
          response
        );
      }

      for (const value of desiredValues) {
        const response =
          await createMetadataValue({
            metadata_record_id:
              metadataRecordId,
            field_registry_id:
              fieldRegistryId,
            value,
            source: "USER",
            verification_status:
              "UNVERIFIED",
          });

        await readResponse(
          response
        );
      }

      continue;
    }

    const firstValue =
      desiredValues[0];

    if (
      isEmptyValue(firstValue)
    ) {
      continue;
    }

    if (existing.length > 0) {
      const response =
        await updateMetadataValue(
          existing[0].id,
          {
            value: firstValue,
            source: "USER",
            verification_status:
              "UNVERIFIED",
          }
        );

      await readResponse(
        response
      );

      for (
        let index = 1;
        index < existing.length;
        index += 1
      ) {
        const response =
          await deleteMetadataValue(
            existing[index].id
          );

        await readResponse(
          response
        );
      }
    } else {
      const response =
        await createMetadataValue({
          metadata_record_id:
            metadataRecordId,
          field_registry_id:
            fieldRegistryId,
          value: firstValue,
          source: "USER",
          verification_status:
            "UNVERIFIED",
        });

      await readResponse(
        response
      );
    }
  }
}
