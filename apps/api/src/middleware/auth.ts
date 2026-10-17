import type { NextFunction, Request, Response } from "express";
import type { Pool } from "pg";
import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCallback);

export const SESSION_DURATION_DAYS = 7;

/**
 * Legacy application-level roles stored on users.
 *
 * Organization authorization must NOT be granted from this value.
 * The active organization membership remains the authoritative source
 * for organization-level permissions.
 */
export type LegacyUserRole =
  | "ADMIN"
  | "APPRAISER"
  | "VIEWER";

/**
 * Authoritative organization membership roles.
 *
 * OWNER represents the company-level organization owner.
 * ADMIN represents a delegated organization/workspace administrator.
 * APPRAISER represents appraisal/review authority.
 * VIEWER represents viewing/access authority.
 *
 * Keep this as the single reusable role definition for middleware,
 * routes, services, and authorization helpers.
 */
export type OrganizationRole =
  | "OWNER"
  | "ADMIN"
  | "APPRAISER"
  | "VIEWER";

/**
 * Roles that can be explicitly required by authorization middleware.
 *
 * This is currently the same as OrganizationRole, but keeping the
 * semantic alias allows the authorization API to evolve independently
 * if additional permission concepts are introduced later.
 */
export type RequiredOrganizationRole =
  OrganizationRole;

export type AuthUser = {
  id: number;
  email: string;
  fullName: string | null;
  role: LegacyUserRole;
  isActive: boolean;
};

export type AuthOrganization = {
  organizationId: number;
  organizationName: string;
  membershipId: number;
  role: OrganizationRole;
};

export type AuthenticatedRequest = Request & {
  authUser?: AuthUser;
  authSessionId?: number;
  authOrganization?: AuthOrganization;
};

export function normalizeEmail(value: unknown): string {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : "";
}

export async function createPasswordHash(
  password: string
): Promise<string> {
  const salt = randomBytes(16);

  const derivedKey = (await scrypt(
    password,
    salt,
    64
  )) as Buffer;

  return [
    "scrypt",
    salt.toString("hex"),
    derivedKey.toString("hex"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  let salt: string;
  let keyHex: string;

  if (storedHash.startsWith("scrypt$")) {
    const parts = storedHash.split("$");

    if (parts.length !== 3) {
      return false;
    }

    const parsedSalt = parts[1];
    const parsedKeyHex = parts[2];

    if (!parsedSalt || !parsedKeyHex) {
      return false;
    }

    salt = parsedSalt;
    keyHex = parsedKeyHex;
  } else {
    /*
     * Preserve compatibility with the legacy salt:key format.
     */
    const parts = storedHash.split(":");

    if (parts.length !== 2) {
      return false;
    }

    const parsedSalt = parts[0];
    const parsedKeyHex = parts[1];

    if (!parsedSalt || !parsedKeyHex) {
      return false;
    }

    salt = parsedSalt;
    keyHex = parsedKeyHex;
  }

  if (!salt || !keyHex) {
    return false;
  }

  try {
    const storedKey = Buffer.from(
      keyHex,
      "hex"
    );

    if (storedKey.length === 0) {
      return false;
    }

    const saltBuffer = Buffer.from(
      salt,
      "hex"
    );

    const derivedKey = (await scrypt(
      password,
      saltBuffer,
      storedKey.length
    )) as Buffer;

    if (
      derivedKey.length !==
      storedKey.length
    ) {
      return false;
    }

    return timingSafeEqual(
      derivedKey,
      storedKey
    );
  } catch {
    return false;
  }
}

export function createSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashSessionToken(
  token: string
): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

export function getSessionToken(
  req: Request
): string | null {
  const cookieHeader = req.headers.cookie;

  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader
    .split(";")
    .map((part) => part.trim());

  const sessionCookie = cookies.find(
    (cookie) =>
      cookie.startsWith("session=")
  );

  if (!sessionCookie) {
    return null;
  }

  const token = sessionCookie.slice(
    "session=".length
  );

  return token || null;
}

export function setSessionCookie(
  res: Response,
  token: string
): void {
  const isProduction =
    process.env.NODE_ENV === "production";

  res.setHeader(
    "Set-Cookie",
    [
      `session=${token}`,
      "HttpOnly",
      "Path=/",
      `Max-Age=${SESSION_DURATION_DAYS * 24 * 60 * 60}`,
      "SameSite=Lax",
      ...(isProduction ? ["Secure"] : []),
    ].join("; ")
  );
}

export function clearSessionCookie(
  res: Response
): void {
  res.setHeader(
    "Set-Cookie",
    [
      "session=",
      "HttpOnly",
      "Path=/",
      "Max-Age=0",
      "SameSite=Lax",
      ...(process.env.NODE_ENV === "production"
        ? ["Secure"]
        : []),
    ].join("; ")
  );
}

export async function findAuthenticatedUser(
  pool: Pool,
  req: Request
): Promise<{
  user: AuthUser;
  sessionId: number;
} | null> {
  const token = getSessionToken(req);

  if (!token) {
    return null;
  }

  const tokenHash =
    hashSessionToken(token);

  const result = await pool.query(
    `
      SELECT
        s.id AS session_id,
        u.id,
        u.email,
        u.full_name,
        u.role,
        u.is_active
      FROM sessions s
      INNER JOIN users u
        ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > NOW()
      LIMIT 1
    `,
    [tokenHash]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];

  if (!row.is_active) {
    return null;
  }

  await pool.query(
    `
      UPDATE sessions
      SET last_seen_at = NOW()
      WHERE id = $1
    `,
    [row.session_id]
  );

  return {
    user: {
      id: Number(row.id),
      email: row.email,
      fullName:
        row.full_name || null,
      role: row.role,
      isActive:
        Boolean(row.is_active),
    },
    sessionId:
      Number(row.session_id),
  };
}

export class OrganizationSelectionError extends Error {
  constructor(
    public readonly statusCode: 403 | 409,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "OrganizationSelectionError";
  }
}

export function getSelectedOrganizationId(
  req: Request
): number | undefined {
  const raw = req.header("X-Organization-Id");

  if (raw === undefined) {
    return undefined;
  }

  const value = raw.trim();

  if (!/^[1-9]\d*$/.test(value)) {
    throw new OrganizationSelectionError(
      403,
      "INVALID_ORGANIZATION_SELECTION",
      "The selected organization ID is invalid."
    );
  }

  const organizationId = Number(value);

  if (!Number.isSafeInteger(organizationId)) {
    throw new OrganizationSelectionError(
      403,
      "INVALID_ORGANIZATION_SELECTION",
      "The selected organization ID is invalid."
    );
  }

  return organizationId;
}

export async function findAuthenticatedOrganizations(
  pool: Pool,
  userId: number
): Promise<AuthOrganization[]> {
  const result = await pool.query<{
    membership_id: number;
    organization_id: number;
    organization_name: string;
    role: OrganizationRole;
  }>(
    `
      SELECT
        om.id AS membership_id,
        o.id AS organization_id,
        o.name AS organization_name,
        om.role
      FROM organization_memberships om
      INNER JOIN organizations o
        ON o.id = om.organization_id
      WHERE om.user_id = $1
        AND om.is_active = TRUE
        AND o.status = 'ACTIVE'
      ORDER BY
        CASE om.role
          WHEN 'OWNER' THEN 1
          WHEN 'ADMIN' THEN 2
          WHEN 'APPRAISER' THEN 3
          WHEN 'VIEWER' THEN 4
          ELSE 5
        END,
        om.id
    `,
    [userId]
  );

  return result.rows.map((row) => ({
    organizationId: Number(row.organization_id),
    organizationName: row.organization_name,
    membershipId: Number(row.membership_id),
    role: row.role,
  }));
}

export async function findAuthenticatedOrganization(
  pool: Pool,
  userId: number,
  selectedOrganizationId?: number
): Promise<AuthOrganization | null> {
  const organizations = await findAuthenticatedOrganizations(
    pool,
    userId
  );

  if (selectedOrganizationId !== undefined) {
    const selected = organizations.find(
      (organization) =>
        organization.organizationId === selectedOrganizationId
    );

    if (!selected) {
      throw new OrganizationSelectionError(
        403,
        "ORGANIZATION_ACCESS_DENIED",
        "You do not have an active membership in the selected organization."
      );
    }

    return selected;
  }

  if (organizations.length === 0) {
    return null;
  }

  if (organizations.length > 1) {
    throw new OrganizationSelectionError(
      409,
      "ORGANIZATION_SELECTION_REQUIRED",
      "Select an organization before accessing organization data."
    );
  }

  return organizations[0] ?? null;
}
export function requireAuthentication(
  pool: Pool
) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authenticated =
        await findAuthenticatedUser(
          pool,
          req
        );

      if (!authenticated) {
        res.status(401).json({
          success: false,
          error:
            "Authentication required",
        });
        return;
      }

      const authenticatedRequest =
        req as AuthenticatedRequest;

      authenticatedRequest.authUser =
        authenticated.user;

      authenticatedRequest.authSessionId =
        authenticated.sessionId;

      next();
    } catch (error) {
      console.error(
        "Authentication check failed:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          "Unable to verify authentication",
      });
    }
  };
}

export function requireOrganizationContext(
  pool: Pool
) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authenticatedRequest =
        req as AuthenticatedRequest;

      const authUser =
        authenticatedRequest.authUser;

      if (!authUser) {
        res.status(401).json({
          success: false,
          error: "Authentication required.",
        });
        return;
      }

      const selectedOrganizationId =
        getSelectedOrganizationId(req);

      const organization =
        await findAuthenticatedOrganization(
          pool,
          authUser.id,
          selectedOrganizationId
        );

      if (!organization) {
        res.status(403).json({
          success: false,
          error:
            "No active organization membership is available for this account.",
        });
        return;
      }

      authenticatedRequest.authOrganization =
        organization;

      next();
    } catch (error) {
      if (error instanceof OrganizationSelectionError) {
        res.status(error.statusCode).json({
          success: false,
          code: error.code,
          error: error.message,
        });
        return;
      }

      console.error(
        "Organization context middleware error:",
        error
      );

      res.status(500).json({
        success: false,
        error: "Organization context could not be resolved.",
      });
    }
  };
}
/**
 * Converts the authoritative organization role into the effective
 * legacy permission level used by existing ADMIN-level routes.
 *
 * OWNER has all existing ADMIN-level capabilities.
 *
 * This mapping does NOT elevate ADMIN to OWNER and does NOT allow
 * APPRAISER or VIEWER to inherit administrative permissions.
 *
 * Keep this compatibility mapping centralized so future authorization
 * changes do not require duplicating OWNER/ADMIN logic throughout
 * individual routes.
 */
export function getEffectiveRole(
  organizationRole: OrganizationRole
): LegacyUserRole {
  if (organizationRole === "OWNER") {
    return "ADMIN";
  }

  return organizationRole;
}

/**
 * Organization-level authorization middleware.
 *
 * Authorization is derived exclusively from the active organization
 * membership. The legacy users.role field must never silently grant
 * organization privileges.
 *
 * Examples:
 *
 *   requireRole("OWNER")
 *     -> OWNER only
 *
 *   requireRole("OWNER", "ADMIN")
 *     -> OWNER or ADMIN
 *
 *   requireRole("ADMIN")
 *     -> OWNER or ADMIN, because OWNER inherits ADMIN capabilities
 *
 *   requireRole("APPRAISER")
 *     -> APPRAISER only
 *
 *   requireRole("VIEWER")
 *     -> VIEWER only
 */
export function requireRole(
  ...allowedRoles: RequiredOrganizationRole[]
) {
  return (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    const authenticatedRequest =
      req as AuthenticatedRequest;

    const user =
      authenticatedRequest.authUser;

    if (!user) {
      res.status(401).json({
        success: false,
        error:
          "Authentication required",
      });
      return;
    }

    const organizationRole =
      authenticatedRequest.authOrganization
        ?.role;

    if (!organizationRole) {
      res.status(403).json({
        success: false,
        error:
          "An active organization membership is required to perform this action",
      });
      return;
    }

    /*
     * OWNER is the company-level administrator/owner.
     *
     * OWNER inherits existing ADMIN-level capabilities, but ADMIN
     * does not become OWNER. This preserves the intended hierarchy:
     *
     * OWNER
     *   └── ADMIN
     *        ├── APPRAISER
     *        └── VIEWER
     *
     * The actual permission check is still performed against the
     * authoritative organization membership role.
     */
    const effectiveRole =
      getEffectiveRole(
        organizationRole
      );

    /*
     * Explicit OWNER authorization must remain distinct.
     *
     * If a route requires OWNER, an ADMIN must not satisfy it merely
     * because ADMIN is a delegated administrative role.
     */
    if (
      allowedRoles.includes("OWNER") &&
      !allowedRoles.includes(
        organizationRole
      )
    ) {
      res.status(403).json({
        success: false,
        error:
          "You do not have permission to perform this action",
      });
      return;
    }

    /*
     * Direct organization-role authorization.
     *
     * This allows routes to explicitly declare the organization
     * membership roles they accept.
     */
    if (
      allowedRoles.includes(
        organizationRole
      )
    ) {
      next();
      return;
    }

    /*
     * OWNER inherits ADMIN-level permissions.
     *
     * This is intentionally limited to ADMIN authorization and does
     * not grant OWNER status to any other role.
     */
    if (
      effectiveRole === "ADMIN" &&
      allowedRoles.includes("ADMIN")
    ) {
      next();
      return;
    }

    res.status(403).json({
      success: false,
      error:
        "You do not have permission to perform this action",
    });
  };
}
