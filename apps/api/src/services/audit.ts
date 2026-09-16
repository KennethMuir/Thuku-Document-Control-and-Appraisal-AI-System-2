import type { PoolClient } from "pg";

async function createAuditLog(
  client: PoolClient,
  documentId: number | null,
  metadataRecordId: number | null,
  action: string,
  details: string
): Promise<void> {
  await client.query(
    `
      INSERT INTO document_audit_logs (
        document_id,
        metadata_record_id,
        action,
        details
      )
      VALUES ($1, $2, $3, $4)
    `,
    [
      documentId,
      metadataRecordId,
      action,
      details,
    ]
  );
}

export { createAuditLog };