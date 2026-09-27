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

export type AuthUser = {
  id: number;
  email: string;
  fullName: string | null;
  role: "ADMIN" | "APPRAISER" | "VIEWER";
  isActive: boolean;
};

export type AuthOrganization = {
  organizationId: number;
  organizationName: string;
  membershipId: number;
  role: "OWNER" | "ADMIN" | "APPRAISER" | "VIEWER";
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

export async function findAuthenticatedOrganization(
  pool: Pool,
  userId: number
): Promise<AuthOrganization | null> {
  const result = await pool.query<{
    membership_id: number;
    organization_id: number;
    organization_name: string;
    role: "OWNER" | "ADMIN" | "APPRAISER" | "VIEWER";
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
      LIMIT 1
    `,
    [userId]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    organizationId: Number(row.organization_id),
    organizationName: row.organization_name,
    membershipId: Number(row.membership_id),
    role: row.role,
  };
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
          error: "Authentication required.",
        });
        return;
      }

      const organization =
        await findAuthenticatedOrganization(
          pool,
          authUser.id
        );

      if (!organization) {
        res.status(403).json({
          error:
            "No active organization membership is available for this account.",
        });
        return;
      }

      authenticatedRequest.authOrganization =
        organization;

      next();
    } catch (error) {
      console.error(
        "Organization context middleware error:",
        error
      );

      res.status(500).json({
        error:
          "Organization context could not be resolved.",
      });
    }
  };
}
export function requireRole(
  ...allowedRoles: Array<
    "ADMIN" |
    "APPRAISER" |
    "VIEWER"
  >
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

    if (
      !allowedRoles.includes(
        user.role
      )
    ) {
      res.status(403).json({
        success: false,
        error:
          "You do not have permission to perform this action",
      });
      return;
    }

    next();
  };
}

