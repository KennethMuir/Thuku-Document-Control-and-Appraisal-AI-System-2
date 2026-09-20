import type { PoolClient } from "pg";

async function createAuditLog(
  client: PoolClient,
  organizationId: number,
  actorUserId: number | null,
  documentId: number | null,
  metadataRecordId: number | null,
  action: string,
  details: string
): Promise<void> {
  await client.query(
    `
      INSERT INTO document_audit_logs (
        organization_id,
        actor_user_id,
        document_id,
        metadata_record_id,
        action,
        details
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      organizationId,
      actorUserId,
      documentId,
      metadataRecordId,
      action,
      details,
    ]
  );
}

export { createAuditLog };