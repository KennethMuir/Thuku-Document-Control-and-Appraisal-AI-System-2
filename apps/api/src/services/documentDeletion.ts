import type { Pool } from "pg";

import { createAuditLog } from "./audit.js";
import { LocalFileStorage } from "./storage.js";

export type DocumentDeletionResult = {
  documentId: number;
  metadataRecordId: number | null;
  deletedFilePaths: string[];
  fileCleanupWarnings: string[];
};

type DocumentDeletionRow = {
  id: number;
  metadata_record_id: number | null;
};

type DocumentFileRow = {
  storage_path: string;
};

export async function deleteDocument(
  pool: Pool,
  localFileStorage: LocalFileStorage,
  organizationId: number,
  actorUserId: number | null,
  documentId: number
): Promise<DocumentDeletionResult | null> {
  const client = await pool.connect();

  let deletedFilePaths: string[] = [];
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

    const filesResult =
      await client.query<DocumentFileRow>(
        `
          SELECT storage_path
          FROM document_files
          WHERE document_id = $1
          ORDER BY id
        `,
        [documentId]
      );

    deletedFilePaths =
      filesResult.rows
        .map(
          (row) =>
            String(
              row.storage_path ?? ""
            ).trim()
        )
        .filter(
          (storagePath) =>
            storagePath.length > 0
        );

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

  const fileCleanupWarnings: string[] = [];

  for (const storagePath of deletedFilePaths) {
    try {
      await localFileStorage.delete(
        storagePath
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      fileCleanupWarnings.push(
        `Unable to remove stored file "${storagePath}": ${message}`
      );
    }
  }

  return {
    documentId,
    metadataRecordId,
    deletedFilePaths,
    fileCleanupWarnings,
  };
}
