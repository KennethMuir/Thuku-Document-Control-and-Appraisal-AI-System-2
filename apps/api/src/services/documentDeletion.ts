import type { Pool } from "pg";

import { createAuditLog } from "./audit.js";

export type DocumentDeletionResult = {
  documentId: number;
  metadataRecordId: number | null;
};

type DocumentDeletionRow = {
  id: number;
  metadata_record_id: number | null;
};

export async function deleteDocument(
  pool: Pool,
  organizationId: number,
  actorUserId: number | null,
  documentId: number
): Promise<DocumentDeletionResult | null> {
  const client = await pool.connect();

  let metadataRecordId: number | null = null;

  try {
    await client.query("BEGIN");

    const documentResult =
      await client.query<DocumentDeletionRow>(
        `
          SELECT
            id,
            metadata_record_id
          FROM documents
          WHERE
            id = $1
            AND organization_id = $2
          FOR UPDATE
        `,
        [
          documentId,
          organizationId,
        ]
      );

    if (documentResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    const documentRow =
      documentResult.rows[0];

    if (!documentRow) {
      throw new Error(
        "Document query returned no row after a successful existence check."
      );
    }

    metadataRecordId =
      documentRow.metadata_record_id;

    await createAuditLog(
      client,
      organizationId,
      actorUserId,
      documentId,
      metadataRecordId,
      "DOCUMENT_DELETED",
      `Document ${documentId} was deleted.`
    );

    const deleteResult =
      await client.query(
        `
          DELETE FROM documents
          WHERE
            id = $1
            AND organization_id = $2
          RETURNING id
        `,
        [
          documentId,
          organizationId,
        ]
      );

    if (deleteResult.rowCount === 0) {
      throw new Error(
        "The document could not be deleted."
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original database error.
    }

    throw error;
  } finally {
    client.release();
  }

  return {
    documentId,
    metadataRecordId,
  };
}
