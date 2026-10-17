import { Router, type Request, type Response } from "express";
import type { Pool } from "pg";

import {
  requireAuthentication,
  requireOrganizationContext,
  requireRole,
  type AuthenticatedRequest,
} from "../middleware/auth.js";

function organizationIdFor(req: Request, res: Response): number | null {
  const organizationId = (req as AuthenticatedRequest).authOrganization?.organizationId;
  if (typeof organizationId !== "number" || !Number.isInteger(organizationId) || organizationId <= 0) {
    res.status(403).json({ success: false, error: "Organization context is required." });
    return null;
  }
  return organizationId;
}

export function createUsersRouter(pool: Pool) {
  const router = Router();

  router.get("/", requireAuthentication(pool), requireOrganizationContext(pool), requireRole("ADMIN"), async (req, res) => {
    const organizationId = organizationIdFor(req, res);
    if (organizationId === null) return;
    try {
      const result = await pool.query(`
        SELECT u.id, u.email, u.full_name AS "fullName",
          CASE WHEN om.role = 'OWNER' THEN 'ADMIN' ELSE om.role END AS role,
          om.role AS "membershipRole",
          om.is_active AS "isActive", u.created_at AS "createdAt"
        FROM users u
        INNER JOIN organization_memberships om ON om.user_id = u.id
        WHERE om.organization_id = $1
        ORDER BY CASE om.role WHEN 'OWNER' THEN 1 WHEN 'ADMIN' THEN 2 WHEN 'APPRAISER' THEN 3 WHEN 'VIEWER' THEN 4 ELSE 5 END, LOWER(u.email)
      `, [organizationId]);
      return res.json({ success: true, users: result.rows });
    } catch (error) {
      console.error("User list retrieval failed:", error);
      return res.status(500).json({ success: false, error: "Unable to retrieve users." });
    }
  });

  router.patch("/:userId", requireAuthentication(pool), requireOrganizationContext(pool), requireRole("ADMIN"), async (req, res) => {
    const organizationId = organizationIdFor(req, res);
    if (organizationId === null) return;
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ success: false, error: "Invalid user ID." });

    const requestedRole = typeof req.body?.role === "string" ? req.body.role.trim().toUpperCase() : undefined;
    const requestedIsActive = typeof req.body?.isActive === "boolean" ? req.body.isActive : undefined;
    const validRoles = ["ADMIN", "APPRAISER", "VIEWER"] as const;
    if (requestedRole !== undefined && !validRoles.includes(requestedRole as typeof validRoles[number])) return res.status(400).json({ success: false, error: "Invalid user role." });
    if (requestedRole === undefined && requestedIsActive === undefined) return res.status(400).json({ success: false, error: "No user changes were provided." });

    const authenticatedRequest = req as AuthenticatedRequest;
    const authUser = authenticatedRequest.authUser;
    const actorRole = authenticatedRequest.authOrganization?.role;

    if (!authUser) return res.status(401).json({ success: false, error: "Authentication required." });
    if (actorRole !== "OWNER" && actorRole !== "ADMIN") {
      return res.status(403).json({ success: false, error: "Only organization owners and administrators can manage users." });
    }

    try {
      const existingResult = await pool.query(`
        SELECT CASE WHEN om.role = 'OWNER' THEN 'ADMIN' ELSE om.role END AS role,
          om.role AS membership_role, om.is_active AS "isActive"
        FROM organization_memberships om
        WHERE om.user_id = $1 AND om.organization_id = $2
        LIMIT 1
      `, [userId, organizationId]);
      if (existingResult.rowCount === 0) return res.status(404).json({ success: false, error: "User not found." });

      const existing = existingResult.rows[0];
      const targetRole = existing.membership_role as "OWNER" | "ADMIN" | "APPRAISER" | "VIEWER";
      const roleRank = { OWNER: 0, ADMIN: 1, APPRAISER: 2, VIEWER: 3 } as const;

      if (targetRole === "OWNER") {
        return res.status(403).json({ success: false, error: "Owner accounts cannot be managed through user management." });
      }

      if (authUser.id === userId && (requestedIsActive === false || requestedRole !== undefined)) {
        return res.status(400).json({
          success: false,
          error: requestedIsActive === false
            ? "You cannot deactivate your own account."
            : "You cannot change your own role."
        });
      }

      if (roleRank[targetRole] <= roleRank[actorRole]) {
        return res.status(403).json({ success: false, error: "You can only manage users with a lower organization role than your own." });
      }

      const finalRole = requestedRole ?? targetRole;
      const finalIsActive = requestedIsActive ?? existing.isActive;

      if (roleRank[finalRole as keyof typeof roleRank] <= roleRank[actorRole]) {
        return res.status(403).json({ success: false, error: "You cannot assign a role equal to or higher than your own." });
      }

      const removesActiveAdmin = (targetRole === "ADMIN") && Boolean(existing.isActive) && (finalRole !== "ADMIN" || finalIsActive !== true);
      if (removesActiveAdmin) {
        const count = await pool.query(`SELECT COUNT(*)::int AS count FROM organization_memberships WHERE organization_id = $1 AND role IN ('OWNER', 'ADMIN') AND is_active = TRUE`, [organizationId]);
        if (Number(count.rows[0]?.count || 0) <= 1) return res.status(400).json({ success: false, error: "The organization must always have at least one active ADMIN." });
      }

      await pool.query(`UPDATE organization_memberships SET role = $1, is_active = $2, updated_at = NOW() WHERE user_id = $3 AND organization_id = $4`, [finalRole, finalIsActive, userId, organizationId]);
      const updated = await pool.query(`
        SELECT u.id, u.email, u.full_name AS "fullName",
          CASE WHEN om.role = 'OWNER' THEN 'ADMIN' ELSE om.role END AS role,
          om.role AS "membershipRole",
          om.is_active AS "isActive", u.created_at AS "createdAt"
        FROM users u INNER JOIN organization_memberships om ON om.user_id = u.id
        WHERE u.id = $1 AND om.organization_id = $2 LIMIT 1
      `, [userId, organizationId]);
      return res.json({ success: true, user: updated.rows[0] });
    } catch (error) {
      console.error("User update failed:", error);
      return res.status(500).json({ success: false, error: "Unable to update user." });
    }
  });

  return router;
}
