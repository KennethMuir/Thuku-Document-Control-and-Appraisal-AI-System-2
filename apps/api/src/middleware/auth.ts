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

export type AuthenticatedRequest = Request & {
  authUser?: AuthUser;
  authSessionId?: number;
};

export function normalizeEmail(value: unknown): string {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : "";
}

export async function createPasswordHash(
  password: string
): Promise<string> {
  const salt = randomBytes(16).toString("hex");

  const derivedKey = (await scrypt(
    password,
    salt,
    64
  )) as Buffer;

  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  const [salt, keyHex] = storedHash.split(":");

  if (!salt || !keyHex) {
    return false;
  }

  try {
    const storedKey = Buffer.from(keyHex, "hex");

    const derivedKey = (await scrypt(
      password,
      salt,
      storedKey.length
    )) as Buffer;

    if (derivedKey.length !== storedKey.length) {
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
