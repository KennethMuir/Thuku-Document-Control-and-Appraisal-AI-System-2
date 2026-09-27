import { Router, type Request, type Response } from "express";
import type { Pool } from "pg";

import {
  requireAuthentication,
  requireRole,
  type AuthenticatedRequest,
} from "../middleware/auth.js";

export function createUsersRouter(pool: Pool) {
  const router = Router();

router.get(
  "/",
  requireAuthentication(pool),
  requireRole("ADMIN"),
  async (
    _req: Request,
    res: Response
  ) => {
    try {
      const result = await pool.query(
        `
          SELECT
            id,
            email,
            full_name AS "fullName",
            role,
            is_active AS "isActive",
            created_at AS "createdAt"
          FROM users
          ORDER BY
            CASE role
              WHEN 'ADMIN' THEN 1
              WHEN 'APPRAISER' THEN 2
              WHEN 'VIEWER' THEN 3
              ELSE 4
            END,
            LOWER(email)
        `
      );

      return res.json({
        success: true,
        users: result.rows,
      });
    } catch (error) {
      console.error(
        "User list retrieval failed:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Unable to retrieve users.",
      });
    }
  }
);

router.patch(
  "/:userId",
  requireAuthentication(pool),
  requireRole("ADMIN"),
  async (
    req: Request,
    res: Response
  ) => {
    const userId = Number(
      req.params.userId
    );

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Invalid user ID.",
      });
    }

    const requestedRole =
      typeof req.body?.role === "string"
        ? req.body.role.trim().toUpperCase()
        : undefined;

    const requestedIsActive =
      typeof req.body?.isActive === "boolean"
        ? req.body.isActive
        : undefined;

    const validRoles = [
      "ADMIN",
      "APPRAISER",
      "VIEWER",
    ] as const;

    if (
      requestedRole !== undefined &&
      !validRoles.includes(
        requestedRole as
          | "ADMIN"
          | "APPRAISER"
          | "VIEWER"
      )
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Invalid user role.",
      });
    }

    if (
      requestedRole === undefined &&
      requestedIsActive === undefined
    ) {
      return res.status(400).json({
        success: false,
        error:
          "No user changes were provided.",
      });
    }

    try {
      const authenticatedRequest =
        req as AuthenticatedRequest;

      const authUser =
        authenticatedRequest.authUser;

      if (!authUser) {
        return res.status(401).json({
          success: false,
          error:
            "Authentication required",
        });
      }

      if (authUser.id === userId) {
        if (
          requestedIsActive === false
        ) {
          return res.status(400).json({
            success: false,
            error:
              "You cannot deactivate your own account.",
          });
        }

        if (
          requestedRole !== undefined &&
          requestedRole !== "ADMIN"
        ) {
          return res.status(400).json({
            success: false,
            error:
              "You cannot remove your own ADMIN role.",
          });
        }
      }

      const existingResult =
        await pool.query(
          `
            SELECT
              id,
              email,
              full_name AS "fullName",
              role,
              is_active AS "isActive",
              created_at AS "createdAt"
            FROM users
            WHERE id = $1
            LIMIT 1
          `,
          [userId]
        );

      if (
        existingResult.rowCount === 0
      ) {
        return res.status(404).json({
          success: false,
          error:
            "User not found.",
        });
      }

      const existingUser =
        existingResult.rows[0];

      const finalRole =
        requestedRole ??
        existingUser.role;

      const finalIsActive =
        requestedIsActive ??
        existingUser.isActive;

      const existingIsActive =
        Boolean(
          existingUser.isActive
        );

      const existingRole =
        String(
          existingUser.role
        ).toUpperCase();

      const removesActiveAdmin =
        existingRole === "ADMIN" &&
        existingIsActive &&
        (
          finalRole !== "ADMIN" ||
          finalIsActive !== true
        );

      if (removesActiveAdmin) {
        const adminCountResult =
          await pool.query(
            `
              SELECT COUNT(*)::int AS count
              FROM users
              WHERE role = 'ADMIN'
                AND is_active = TRUE
            `
          );

        const activeAdminCount =
          Number(
            adminCountResult.rows[0]?.count ||
              0
          );

        if (
          activeAdminCount <= 1
        ) {
          return res.status(400).json({
            success: false,
            error:
              "The system must always have at least one active ADMIN.",
          });
        }
      }

      const updatedResult =
        await pool.query(
          `
            UPDATE users
            SET
              role = $1,
              is_active = $2
            WHERE id = $3
            RETURNING
              id,
              email,
              full_name AS "fullName",
              role,
              is_active AS "isActive",
              created_at AS "createdAt"
          `,
          [
            finalRole,
            finalIsActive,
            userId,
          ]
        );

      return res.json({
        success: true,
        user:
          updatedResult.rows[0],
      });
    } catch (error) {
      console.error(
        "User update failed:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Unable to update user.",
      });
    }
  }
);

  return router;
}
