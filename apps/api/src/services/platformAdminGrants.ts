import type { Pool } from "pg";

type PlatformGrantMutation = {
  actorUserId: number;
  targetUserId: number;
  reason: string;
};

function validateMutation(input: PlatformGrantMutation): void {
  if (
    !Number.isSafeInteger(input.actorUserId) ||
    input.actorUserId <= 0 ||
    !Number.isSafeInteger(input.targetUserId) ||
    input.targetUserId <= 0
  ) {
    throw new Error("Actor and target user IDs must be positive integers.");
  }

  if (input.actorUserId === input.targetUserId) {
    throw new Error("Self-appointment or self-revocation is not permitted.");
  }

  if (typeof input.reason !== "string" || !input.reason.trim()) {
    throw new Error("A non-empty reason is required.");
  }

  if (input.reason.trim().length > 2000) {
    throw new Error("Reason must not exceed 2000 characters.");
  }
}

/**
 * Internal service only. Callers must establish platform authority
 * independently before invoking this service.
 *
 * The initial platform administrator is deliberately not handled here.
 */
export async function appointPlatformAdmin(
  pool: Pool,
  input: PlatformGrantMutation
): Promise<number> {
  validateMutation(input);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const ids = [input.actorUserId, input.targetUserId].sort(
      (a, b) => a - b
    );

    const usersResult = await client.query<{
      id: string | number;
      is_active: boolean;
    }>(
      `
        SELECT id, is_active
        FROM users
        WHERE id = ANY($1::bigint[])
        ORDER BY id
        FOR UPDATE
      `,
      [ids]
    );

    const usersById = new Map(
      usersResult.rows.map((row) => [Number(row.id), row])
    );

    const actor = usersById.get(input.actorUserId);
    const target = usersById.get(input.targetUserId);

    if (!actor?.is_active || !target?.is_active) {
      throw new Error("Actor and target accounts must both be active.");
    }

    const actorGrantResult = await client.query(
      `
        SELECT id
        FROM platform_admin_grants
        WHERE user_id = $1
          AND revoked_at IS NULL
        FOR UPDATE
      `,
      [input.actorUserId]
    );

    if (!actorGrantResult.rowCount) {
      throw new Error(
        "An active platform administrator grant is required for the actor."
      );
    }

    const activeGrant = await client.query(
      `
        SELECT id
        FROM platform_admin_grants
        WHERE user_id = $1
          AND revoked_at IS NULL
        FOR UPDATE
      `,
      [input.targetUserId]
    );

    if (activeGrant.rowCount) {
      throw new Error("Target user already has an active platform grant.");
    }

    const grantResult = await client.query<{ id: string | number }>(
      `
        INSERT INTO platform_admin_grants (
          user_id,
          grant_origin,
          granted_by_user_id,
          grant_reason
        )
        VALUES ($1, 'PLATFORM_ADMIN', $2, $3)
        RETURNING id
      `,
      [input.targetUserId, input.actorUserId, input.reason.trim()]
    );

    const grantId = grantResult.rows[0]?.id;

    if (grantId === undefined) {
      throw new Error("Platform grant insert returned no ID.");
    }



    await client.query("COMMIT");
    return Number(grantId);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original failure.
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function revokePlatformAdmin(
  pool: Pool,
  input: PlatformGrantMutation
): Promise<void> {
  validateMutation(input);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const ids = [input.actorUserId, input.targetUserId].sort(
      (a, b) => a - b
    );

    const usersResult = await client.query<{
      id: string | number;
      is_active: boolean;
    }>(
      `
        SELECT id, is_active
        FROM users
        WHERE id = ANY($1::bigint[])
        ORDER BY id
        FOR UPDATE
      `,
      [ids]
    );

    const usersById = new Map(
      usersResult.rows.map((row) => [Number(row.id), row])
    );

    const actor = usersById.get(input.actorUserId);
    const target = usersById.get(input.targetUserId);

    if (!actor?.is_active || !target?.is_active) {
      throw new Error("Actor and target accounts must both be active.");
    }

    const actorGrantResult = await client.query(
      `
        SELECT id
        FROM platform_admin_grants
        WHERE user_id = $1
          AND revoked_at IS NULL
        FOR UPDATE
      `,
      [input.actorUserId]
    );

    if (!actorGrantResult.rowCount) {
      throw new Error(
        "An active platform administrator grant is required for the actor."
      );
    }

    const grantResult = await client.query<{ id: string | number }>(
      `
        SELECT id
        FROM platform_admin_grants
        WHERE user_id = $1
          AND revoked_at IS NULL
        FOR UPDATE
      `,
      [input.targetUserId]
    );

    const grant = grantResult.rows[0];

    if (!grant) {
      throw new Error("Target user has no active platform grant.");
    }

    await client.query(
      `
        UPDATE platform_admin_grants
        SET
          revoked_at = NOW(),
          revoked_by_user_id = $2,
          revocation_reason = $3
        WHERE id = $1
          AND revoked_at IS NULL
      `,
      [grant.id, input.actorUserId, input.reason.trim()]
    );



    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original failure.
    }
    throw error;
  } finally {
    client.release();
  }
}

