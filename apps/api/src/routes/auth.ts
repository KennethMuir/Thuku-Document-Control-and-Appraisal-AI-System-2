import type { Request, Response } from "express";
import { Router } from "express";
import type { Pool } from "pg";

import {
  SESSION_DURATION_DAYS,
  normalizeEmail,
  createPasswordHash,
  verifyPassword,
  createSessionToken,
  hashSessionToken,
  getSessionToken,
  setSessionCookie,
  clearSessionCookie,
  findAuthenticatedUser,
} from "../middleware/auth.js";

export function createAuthRouter(pool: Pool) {
  const router = Router();

router.post(
  "/signup",
  async (req: Request, res: Response) => {
    try {
      const fullName =
        typeof req.body?.fullName ===
          "string"
          ? req.body.fullName.trim()
          : "";

      const email = normalizeEmail(
        typeof req.body?.email ===
          "string"
          ? req.body.email
          : ""
      );

      const password =
        typeof req.body?.password ===
          "string"
          ? req.body.password
          : "";

      const confirmPassword =
        typeof req.body?.confirmPassword ===
          "string"
          ? req.body.confirmPassword
          : "";

      if (!fullName) {
        return res.status(400).json({
          success: false,
          error: "Full name is required.",
        });
      }

      if (!email) {
        return res.status(400).json({
          success: false,
          error: "Email is required.",
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          error:
            "Password must be at least 8 characters long.",
        });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({
          success: false,
          error: "Passwords do not match.",
        });
      }

      const existingUser = await pool.query(
        `
          SELECT id
          FROM users
          WHERE LOWER(email) = LOWER($1)
          LIMIT 1
        `,
        [email]
      );

      if (existingUser.rowCount) {
        return res.status(409).json({
          success: false,
          error:
            "An account with this email already exists.",
        });
      }

      const passwordHash =
        await createPasswordHash(password);

      const result = await pool.query(
        `
          INSERT INTO users (
            email,
            password_hash,
            full_name,
            role,
            is_active
          )
          VALUES ($1, $2, $3, 'VIEWER', TRUE)
          RETURNING
            id,
            email,
            full_name AS "fullName",
            role,
            is_active AS "isActive"
        `,
        [email, passwordHash, fullName]
      );

      const user = result.rows[0] as {
        id: number;
        email: string;
        fullName: string | null;
        role:
          | "ADMIN"
          | "APPRAISER"
          | "VIEWER";
        isActive: boolean;
      };

      const sessionToken =
        createSessionToken();

      const tokenHash =
        hashSessionToken(sessionToken);

      const expiresAt = new Date(
        Date.now() +
          SESSION_DURATION_DAYS *
          24 *
          60 *
          60 *
          1000
      );

      await pool.query(
        `
          INSERT INTO sessions (
            user_id,
            token_hash,
            expires_at
          )
          VALUES ($1, $2, $3)
        `,
        [
          user.id,
          tokenHash,
          expiresAt,
        ]
      );

      setSessionCookie(
        res,
        sessionToken
      );

      return res.status(201).json({
        success: true,
        user,
      });
    } catch (error) {
      console.error(
        "Signup failed:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Unable to create account.",
      });
    }
  }
);
router.post(
  "/login",
  async (
    req: Request,
    res: Response
  ) => {
    const email =
      normalizeEmail(
        req.body?.email
      );

    const password =
      typeof req.body?.password ===
      "string"
        ? req.body.password
        : "";

    if (
      !email ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Email and password are required",
      });
    }

    try {
      const result =
        await pool.query(
          `
            SELECT
              id,
              email,
              password_hash,
              full_name,
              role,
              is_active
            FROM users
            WHERE LOWER(email) = LOWER($1)
            LIMIT 1
          `,
          [email]
        );

      if (
        result.rowCount === 0
      ) {
        return res.status(401).json({
          success: false,
          error:
            "Invalid email or password",
        });
      }

      const row =
        result.rows[0];

      if (!row.is_active) {
        return res.status(403).json({
          success: false,
          error:
            "This account is inactive",
        });
      }

      const passwordValid =
        await verifyPassword(
          password,
          row.password_hash
        );

      if (!passwordValid) {
        return res.status(401).json({
          success: false,
          error:
            "Invalid email or password",
        });
      }

      const token =
        createSessionToken();

      const tokenHash =
        hashSessionToken(token);

      const expiresAt =
        new Date(
          Date.now() +
            SESSION_DURATION_DAYS *
              24 *
              60 *
              60 *
              1000
        );

      await pool.query(
        `
          INSERT INTO sessions (
            user_id,
            token_hash,
            expires_at
          )
          VALUES ($1, $2, $3)
        `,
        [
          Number(row.id),
          tokenHash,
          expiresAt,
        ]
      );

      setSessionCookie(
        res,
        token
      );

      return res.json({
        success: true,
        user: {
          id: Number(row.id),
          email: row.email,
          fullName:
            row.full_name || null,
          role: row.role,
          isActive:
            Boolean(row.is_active),
        },
      });
    } catch (error) {
      console.error(
        "Login failed:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Unable to log in",
      });
    }
  }
);

router.post(
  "/logout",
  async (
    req: Request,
    res: Response
  ) => {
    const token =
      getSessionToken(req);

    if (token) {
      try {
        await pool.query(
          `
            UPDATE sessions
            SET revoked_at = NOW()
            WHERE token_hash = $1
              AND revoked_at IS NULL
          `,
          [hashSessionToken(token)]
        );
      } catch (error) {
        console.error(
          "Logout session update failed:",
          error
        );
      }
    }

    clearSessionCookie(res);

    return res.json({
      success: true,
    });
  }
);

router.get(
  "/me",
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const authenticated =
        await findAuthenticatedUser(pool, req);

      if (!authenticated) {
        return res.status(401).json({
          success: false,
          authenticated: false,
          error:
            "Authentication required",
        });
      }

      return res.json({
        success: true,
        authenticated: true,
        user:
          authenticated.user,
      });
    } catch (error) {
      console.error(
        "Auth session lookup failed:",
        error
      );

      return res.status(500).json({
        success: false,
        authenticated: false,
        error:
          "Unable to validate session",
      });
    }
  }
);


  return router;
}
