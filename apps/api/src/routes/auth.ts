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
  findAuthenticatedOrganization,
  findAuthenticatedOrganizations,
  getSelectedOrganizationId,
  OrganizationSelectionError,
} from "../middleware/auth.js";
import { sendCompanyEmailVerificationEmail } from "../services/companyEmailVerification.js";

export function createAuthRouter(pool: Pool) {
  const router = Router();

router.post(
  "/signup",
  async (req: Request, res: Response) => {
    try {
      const companyName =
        typeof req.body?.companyName === "string"
          ? req.body.companyName.trim()
          : "";

      const companyEmail = normalizeEmail(
        typeof req.body?.companyEmail === "string"
          ? req.body.companyEmail
          : ""
      );

      const industryKey =
        typeof req.body?.industryKey === "string"
          ? req.body.industryKey.trim()
          : "";

      const industryOther =
        typeof req.body?.industryOther === "string"
          ? req.body.industryOther.trim()
          : "";

      const fullName =
        typeof req.body?.fullName === "string"
          ? req.body.fullName.trim()
          : "";

      const email = normalizeEmail(
        typeof req.body?.email === "string"
          ? req.body.email
          : ""
      );

      const jobPosition =
        typeof req.body?.jobPosition === "string"
          ? req.body.jobPosition.trim()
          : "";

      const jobTitleOther =
        typeof req.body?.jobTitleOther === "string"
          ? req.body.jobTitleOther.trim()
          : "";

      const password =
        typeof req.body?.password === "string"
          ? req.body.password
          : "";

      const confirmPassword =
        typeof req.body?.confirmPassword === "string"
          ? req.body.confirmPassword
          : "";

      const termsAccepted = req.body?.termsAccepted === true;

      const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!companyName || companyName.length > 255) {
        return res.status(400).json({
          success: false,
          error: "Company name is required and must be 255 characters or fewer.",
        });
      }

      if (!validEmail.test(companyEmail)) {
        return res.status(400).json({
          success: false,
          error: "A valid company email is required.",
        });
      }

      if (!industryKey || industryKey.length > 100) {
        return res.status(400).json({
          success: false,
          error: "Select your industry or business domain.",
        });
      }

      if (
        industryKey === "other_general_commercial" &&
        !industryOther
      ) {
        return res.status(400).json({
          success: false,
          error: "Enter your industry when selecting Other.",
        });
      }

      if (industryOther.length > 255) {
        return res.status(400).json({
          success: false,
          error: "Custom industry must be 255 characters or fewer.",
        });
      }

      if (!fullName || fullName.length > 255) {
        return res.status(400).json({
          success: false,
          error: "Owner full name is required and must be 255 characters or fewer.",
        });
      }

      if (!validEmail.test(email)) {
        return res.status(400).json({
          success: false,
          error: "A valid owner work email is required.",
        });
      }

      if (!jobPosition) {
        return res.status(400).json({
          success: false,
          error: "Select your job position.",
        });
      }

      const jobTitle =
        jobPosition === "Other"
          ? jobTitleOther
          : jobPosition;

      if (!jobTitle || jobTitle.length > 255) {
        return res.status(400).json({
          success: false,
          error: "Enter a valid job title.",
        });
      }

      if (!termsAccepted) {
        return res.status(400).json({
          success: false,
          error: "You must accept the terms to create an account.",
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          error: "Password must be at least 8 characters long.",
        });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({
          success: false,
          error: "Passwords do not match.",
        });
      }

      const specializationResult = await pool.query(
        `
          SELECT id
          FROM specializations
          WHERE specialization_key = $1
            AND is_active = TRUE
          LIMIT 1
        `,
        [industryKey]
      );

      if (!specializationResult.rowCount) {
        return res.status(400).json({
          success: false,
          error: "The selected industry is unavailable. Please choose another.",
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
          error: "An account with this owner email already exists.",
        });
      }

      const passwordHash = await createPasswordHash(password);
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        const result = await client.query(
          `
            INSERT INTO users (
              email,
              password_hash,
              full_name,
              role,
              is_active,
              job_title,
              terms_accepted_at,
              terms_version
            )
            VALUES (
              $1,
              $2,
              $3,
              'VIEWER',
              TRUE,
              $4,
              NOW(),
              '2026-10-18-v1'
            )
            RETURNING
              id,
              email,
              full_name AS "fullName",
              role,
              is_active AS "isActive"
          `,
          [email, passwordHash, fullName, jobTitle]
        );

        const user = result.rows[0] as {
          id: number;
          email: string;
          fullName: string | null;
          role: "ADMIN" | "APPRAISER" | "VIEWER";
          isActive: boolean;
        };

        const organizationResult = await client.query(
          `
            INSERT INTO organizations (
              name,
              slug,
              status,
              company_email,
              specialization_id,
              industry_other
            )
            VALUES (
              $1,
              $2,
              'ACTIVE',
              $3,
              $4,
              $5
            )
            ON CONFLICT (slug) DO NOTHING
            RETURNING id
          `,
          [
            companyName,
            `company-${user.id}`,
            companyEmail,
            specializationResult.rows[0].id,
            industryKey === "other_general_commercial"
              ? industryOther
              : null,
          ]
        );

        const organizationRow = organizationResult.rows[0];

        if (!organizationRow) {
          throw new Error("Signup failed to create the company organization.");
        }

        const organizationId = Number(organizationRow.id);

        await client.query(
          `
            INSERT INTO organization_trials (
              organization_id,
              trial_starts_at,
              trial_ends_at,
              document_limit
            )
            VALUES (
              $1,
              NOW(),
              NOW() + INTERVAL '14 days',
              10
            )
          `,
          [organizationId]
        );

        await client.query(
          `
            INSERT INTO organization_memberships (
              organization_id,
              user_id,
              role,
              is_active
            )
            VALUES ($1, $2, 'OWNER', TRUE)
          `,
          [organizationId, user.id]
        );

        await client.query(
          `
            INSERT INTO workspaces (
              organization_id,
              name,
              slug,
              status
            )
            VALUES ($1, 'Default Workspace', 'default', 'ACTIVE')
          `,
          [organizationId]
        );

        const verificationToken = createSessionToken();
        const verificationTokenHash = hashSessionToken(verificationToken);

        await client.query(
          `
            INSERT INTO company_email_verification_tokens (
              organization_id,
              token_hash,
              expires_at
            )
            VALUES ($1, $2, NOW() + INTERVAL '24 hours')
          `,
          [organizationId, verificationTokenHash]
        );

        await client.query("COMMIT");

        let verificationEmailSent = true;

        const webOrigin = (
          process.env.WEB_ORIGIN || "http://localhost:3000"
        ).replace(/\/+$/, "");

        const verificationUrl =
          `${webOrigin}/verify-company-email?token=${encodeURIComponent(verificationToken)}`;

        try {
          await sendCompanyEmailVerificationEmail(
            companyEmail,
            verificationUrl
          );
        } catch {
          verificationEmailSent = false;
          console.error(
            "Signup verification email delivery failed.",
            { organizationId }
          );
        }

        return res.status(201).json({
          success: true,
          verificationRequired: true,
          verificationEmailSent,
          message: verificationEmailSent
            ? "Workspace created. Check your company email to verify your address."
            : "Workspace created, but the verification email could not be sent. Request a new verification email to continue.",
          organization: {
            id: organizationId,
            name: companyName,
            companyEmail,
            industryKey,
          },
          trial: {
            durationDays: 14,
            documentLimit: 10,
          },
        });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Signup failed:", error);

      return res.status(500).json({
        success: false,
        error: "Unable to create account.",
      });
    }
  }
);
router.post(
  "/resend-company-email-verification",
  async (req: Request, res: Response) => {
    const companyEmail = normalizeEmail(
      typeof req.body?.companyEmail === "string"
        ? req.body.companyEmail
        : ""
    );

    const genericResponse = {
      success: true,
      message:
        "If an unverified workspace uses that company email, a verification message will be sent shortly.",
    };

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyEmail)) {
      return res.json(genericResponse);
    }

    let client;
    let organizationId: number | null = null;
    let verificationToken = "";

    try {
      client = await pool.connect();
      await client.query("BEGIN");

      const organizationResult = await client.query(
        `
          SELECT id
          FROM organizations
          WHERE LOWER(TRIM(company_email)) = $1
            AND company_email IS NOT NULL
            AND company_email_verified_at IS NULL
          FOR UPDATE
        `,
        [companyEmail]
      );

      if (organizationResult.rowCount !== 1) {
        await client.query("ROLLBACK");
        return res.json(genericResponse);
      }

      organizationId = Number(organizationResult.rows[0].id);

      const recentTokenResult = await client.query(
        `
          SELECT COUNT(*)::int AS token_count
          FROM company_email_verification_tokens
          WHERE organization_id = $1
            AND created_at >= NOW() - INTERVAL '1 hour'
        `,
        [organizationId]
      );

      if (Number(recentTokenResult.rows[0]?.token_count ?? 0) >= 3) {
        await client.query("ROLLBACK");
        return res.json(genericResponse);
      }

      verificationToken = createSessionToken();
      const verificationTokenHash = hashSessionToken(verificationToken);

      await client.query(
        `
          UPDATE company_email_verification_tokens
          SET consumed_at = NOW()
          WHERE organization_id = $1
            AND consumed_at IS NULL
        `,
        [organizationId]
      );

      await client.query(
        `
          INSERT INTO company_email_verification_tokens (
            organization_id,
            token_hash,
            expires_at
          )
          VALUES ($1, $2, NOW() + INTERVAL '24 hours')
        `,
        [organizationId, verificationTokenHash]
      );

      await client.query("COMMIT");
    } catch {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } catch {
          console.error("Verification resend rollback failed.");
        }
      }

      console.error("Company email verification resend preparation failed.");
      return res.status(500).json({
        success: false,
        error: "Unable to process the request. Please try again later.",
      });
    } finally {
      client?.release();
    }

    if (organizationId === null || !verificationToken) {
      return res.json(genericResponse);
    }

    const webOrigin = (
      process.env.WEB_ORIGIN || "http://localhost:3000"
    ).replace(/\/+$/, "");

    const verificationUrl =
      `${webOrigin}/verify-company-email?token=${encodeURIComponent(verificationToken)}`;

    try {
      await sendCompanyEmailVerificationEmail(companyEmail, verificationUrl);
    } catch {
      console.error(
        "Verification resend email delivery failed.",
        { organizationId }
      );
    }

    return res.json(genericResponse);
  }
);
router.post(
  "/verify-company-email",
  async (req: Request, res: Response) => {
    const token =
      typeof req.body?.token === "string"
        ? req.body.token.trim()
        : "";

    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_VERIFICATION_TOKEN",
        error: "The verification link is invalid or incomplete.",
      });
    }

    const tokenHash = hashSessionToken(token);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const tokenResult = await client.query(
        `
          SELECT
            id,
            organization_id,
            expires_at,
            consumed_at
          FROM company_email_verification_tokens
          WHERE token_hash = $1
          FOR UPDATE
        `,
        [tokenHash]
      );

      if (tokenResult.rowCount !== 1) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          code: "INVALID_VERIFICATION_TOKEN",
          error: "The verification link is invalid or has expired.",
        });
      }

      const verification = tokenResult.rows[0];

      if (verification.consumed_at) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          code: "VERIFICATION_TOKEN_USED",
          error: "This verification link has already been used.",
        });
      }

      const expiryTime = new Date(verification.expires_at).getTime();

      if (!Number.isFinite(expiryTime) || expiryTime <= Date.now()) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          code: "VERIFICATION_TOKEN_EXPIRED",
          error: "This verification link has expired. Request a new verification email.",
        });
      }

      const organizationResult = await client.query(
        `
          UPDATE organizations
          SET company_email_verified_at = NOW()
          WHERE id = $1
            AND company_email IS NOT NULL
            AND company_email_verified_at IS NULL
          RETURNING id
        `,
        [verification.organization_id]
      );

      if (organizationResult.rowCount !== 1) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          code: "COMPANY_EMAIL_ALREADY_VERIFIED",
          error: "This company email is already verified or the organization is unavailable.",
        });
      }

      await client.query(
        `
          UPDATE company_email_verification_tokens
          SET consumed_at = NOW()
          WHERE id = $1
            AND consumed_at IS NULL
        `,
        [verification.id]
      );

      await client.query("COMMIT");

      return res.json({
        success: true,
        verified: true,
        message: "Company email verified. You can now sign in.",
      });
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        console.error("Company email verification rollback failed.");
      }

      console.error("Company email verification failed.");
      return res.status(500).json({
        success: false,
        error: "Unable to verify company email. Please try again.",
      });
    } finally {
      client.release();
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

      const unverifiedOwnerResult = await pool.query(
        `
          SELECT
            o.id AS organization_id
          FROM organization_memberships om
          JOIN organizations o
            ON o.id = om.organization_id
          WHERE om.user_id = $1
            AND om.role = 'OWNER'
            AND om.is_active = TRUE
            AND o.company_email IS NOT NULL
            AND o.company_email_verified_at IS NULL
          LIMIT 1
        `,
        [Number(row.id)]
      );

      if (unverifiedOwnerResult.rowCount) {
        return res.status(403).json({
          success: false,
          code: "COMPANY_EMAIL_NOT_VERIFIED",
          error: "Verify your company email before signing in.",
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
        await findAuthenticatedUser(
          pool,
          req
        );

      if (!authenticated) {
        return res.status(401).json({
          success: false,
          authenticated: false,
          error:
            "Authentication required",
        });
      }

      const organizations =
        await findAuthenticatedOrganizations(
          pool,
          authenticated.user.id
        );

      const selectedOrganizationId =
        getSelectedOrganizationId(req);

      let organization = null;

      if (selectedOrganizationId !== undefined) {
        organization = await findAuthenticatedOrganization(
          pool,
          authenticated.user.id,
          selectedOrganizationId
        );
      } else if (organizations.length === 1) {
        organization = organizations[0] ?? null;
      }

      return res.json({
        success: true,
        authenticated: true,
        user: authenticated.user,
        organizations: organizations.map((item) => ({
          id: item.organizationId,
          name: item.organizationName,
          role: item.role,
        })),
        organization: organization
          ? {
              id: organization.organizationId,
              name: organization.organizationName,
              role: organization.role,
            }
          : null,
        organizationSelectionRequired:
          organizations.length > 1 && organization === null,
      });
    } catch (error) {
      if (error instanceof OrganizationSelectionError) {
        return res.status(error.statusCode).json({
          success: false,
          authenticated: true,
          code: error.code,
          error: error.message,
        });
      }
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

