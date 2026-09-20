import "dotenv/config";

import {
  randomBytes,
  scrypt as scryptCallback,
} from "crypto";
import { promisify } from "util";
import { createInterface } from "readline";
import { Pool } from "pg";

const scrypt = promisify(scryptCallback);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function createPasswordHash(
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

async function provisionOrganizationMembership(
  userId: number
): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingOrg = await client.query<{
      id: number;
    }>(
      `
        SELECT id
        FROM organizations
        WHERE status = 'ACTIVE'
        ORDER BY
          CASE
            WHEN slug = 'thuku-document-control' THEN 0
            ELSE 1
          END,
          id
        LIMIT 1
      `
    );

    let organizationId =
      existingOrg.rows[0]?.id;

    if (organizationId === undefined) {
      const createdOrg = await client.query<{
        id: number;
      }>(
        `
          INSERT INTO organizations (
            name,
            slug,
            status
          )
          VALUES (
            'Thuku Document Control',
            'thuku-document-control',
            'ACTIVE'
          )
          ON CONFLICT (slug) DO NOTHING
          RETURNING id
        `
      );

      organizationId =
        createdOrg.rows[0]?.id;

      await client.query(
        `
          INSERT INTO workspaces (
            organization_id,
            name,
            slug,
            status
          )
          VALUES (
            $1,
            'Default Workspace',
            'default',
            'ACTIVE'
          )
          ON CONFLICT (
            organization_id,
            slug
          ) DO NOTHING
        `,
        [organizationId]
      );
    }

    if (organizationId === undefined) {
      throw new Error(
        "Unable to resolve or create an organization for the ADMIN account."
      );
    }

    await client.query(
      `
        INSERT INTO organization_memberships (
          organization_id,
          user_id,
          role,
          is_active
        )
        VALUES (
          $1,
          $2,
          'OWNER',
          TRUE
        )
        ON CONFLICT (
          organization_id,
          user_id
        ) DO UPDATE
        SET
          role = 'OWNER',
          is_active = TRUE,
          updated_at = NOW()
      `,
      [
        organizationId,
        userId,
      ]
    );

    await client.query("COMMIT");

    console.log(
      `\nADMIN membership provisioned (organization=${organizationId}, role=OWNER).`
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function askQuestion(question: string): Promise<string> {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    readline.question(question, (answer) => {
      readline.close();
      resolve(answer);
    });
  });
}

function askPassword(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(
        new Error(
          "Password input requires an interactive terminal."
        )
      );
      return;
    }

    process.stdout.write(question);

    createInterface({
      input: process.stdin,
      output: process.stdout,
    }).close();

    let password = "";

    const stdin = process.stdin;

    const cleanup = () => {
      stdin.setRawMode?.(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      process.stdout.write("\n");
    };

    const finish = () => {
      cleanup();
      resolve(password);
    };

    const fail = (error: Error) => {
      cleanup();
      reject(error);
    };

    const onData = (chunk: Buffer | string) => {
      const input = chunk.toString("utf8");

      for (const character of input) {
        if (character === "\u0003") {
          fail(new Error("Password entry cancelled."));
          return;
        }

        if (
          character === "\r" ||
          character === "\n"
        ) {
          finish();
          return;
        }

        if (
          character === "\b" ||
          character === "\u007f"
        ) {
          if (password.length > 0) {
            password = password.slice(0, -1);
          }
          continue;
        }

        if (character >= " " && character !== "\u007f") {
          password += character;
        }
      }
    };

    stdin.resume();
    stdin.setRawMode(true);
    stdin.on("data", onData);
  });
}

async function main() {
  try {
    const emailInput = await askQuestion(
      "Admin email: "
    );

    const email = normalizeEmail(emailInput);

    if (!email || !email.includes("@")) {
      throw new Error(
        "Please provide a valid email address."
      );
    }

    const fullName = (
      await askQuestion("Full name: ")
    ).trim();

    const password = await askPassword(
      "Admin password: "
    );

    if (password.length < 8) {
      throw new Error(
        "Password must be at least 8 characters long."
      );
    }

    const confirmation = await askPassword(
      "Confirm password: "
    );

    if (password !== confirmation) {
      throw new Error(
        "Passwords do not match."
      );
    }

    const passwordHash =
      await createPasswordHash(password);

    const existingUser = await pool.query<{
      id: number;
      email: string;
    }>(
      `
        SELECT id, email
        FROM users
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1
      `,
      [email]
    );

    if (existingUser.rows.length > 0) {
      const userId = existingUser.rows[0]!.id;

      await pool.query(
        `
          UPDATE users
          SET
            email = $1,
            password_hash = $2,
            full_name = $3,
            role = 'ADMIN',
            is_active = TRUE,
            updated_at = NOW()
          WHERE id = $4
        `,
        [
          email,
          passwordHash,
          fullName || null,
          userId,
        ]
      );

      await pool.query(
        `
          UPDATE sessions
          SET revoked_at = NOW()
          WHERE user_id = $1
            AND revoked_at IS NULL
        `,
        [userId]
      );

      console.log(
        `\nADMIN account updated successfully.`
      );
      console.log(`User ID: ${userId}`);
      console.log(`Email: ${email}`);
console.log(
        "Existing sessions were revoked."
      );

      await provisionOrganizationMembership(
        userId
      );
    } else {
      const result = await pool.query<{
        id: number;
      }>(
        `
          INSERT INTO users (
            email,
            password_hash,
            full_name,
            role,
            is_active
          )
          VALUES (
            $1,
            $2,
            $3,
            'ADMIN',
            TRUE
          )
          RETURNING id
        `,
        [
          email,
          passwordHash,
          fullName || null,
        ]
      );

      console.log(
        `\nADMIN account created successfully.`
      );
      console.log(
        `User ID: ${result.rows[0]!.id}`
      );
console.log(`Email: ${email}`);

      await provisionOrganizationMembership(
        result.rows[0]!.id
      );
    }
  } catch (error) {
    console.error(
      "\nADMIN bootstrap failed."
    );

    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }

    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
