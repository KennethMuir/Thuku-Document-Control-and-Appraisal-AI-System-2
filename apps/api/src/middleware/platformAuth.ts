import type {
  NextFunction,
  Request,
  Response,
} from "express";
import type { Pool } from "pg";

import type {
  AuthenticatedRequest,
} from "./auth.js";

export function requirePlatformAdmin(pool: Pool) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const authUser =
      (req as AuthenticatedRequest).authUser;

    if (
      !authUser ||
      !Number.isSafeInteger(authUser.id) ||
      authUser.id <= 0
    ) {
      res.status(401).json({
        success: false,
        error: "Authentication required.",
      });
      return;
    }

    try {
      const result = await pool.query(
        `
          SELECT
            u.is_active AS account_active,
            g.id AS grant_id
          FROM users AS u
          LEFT JOIN platform_admin_grants AS g
            ON g.user_id = u.id
           AND g.revoked_at IS NULL
          WHERE u.id = $1
          LIMIT 1
        `,
        [authUser.id]
      );

      const row = result.rows[0] as
        | { account_active: boolean; grant_id: number | string | null }
        | undefined;

      if (
        !row ||
        row.account_active !== true ||
        row.grant_id === null ||
        row.grant_id === undefined
      ) {
        res.status(403).json({
          success: false,
          error: "Platform administrator access required.",
        });
        return;
      }

      next();
    } catch (error) {
      console.error(
        "Platform authorization check failed.",
        error instanceof Error ? error.message : "Unknown error"
      );

      res.status(503).json({
        success: false,
        error: "Platform authorization is temporarily unavailable.",
      });
    }
  };
}
