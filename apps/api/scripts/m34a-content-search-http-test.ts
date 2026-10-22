import "dotenv/config";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { Pool } from "pg";

const API_URL = (process.env.API_URL || "http://localhost:4000").replace(/\/+$/, "");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
const searchToken = `M34CONTENT${suffix}`;
const ownCodePrefix = `M34A2J16-${suffix}-`;
const foreignCodePrefix = `M34A2J16-FOREIGN-${suffix}-`;

let organizationId: string | undefined;
let foreignOrganizationId: string | undefined;
let ownerUserId: string | undefined;
let foreignOwnerUserId: string | undefined;
let noMembershipUserId: string | undefined;
let ownerToken: string | undefined;
let noMembershipToken: string | undefined;

const sessionIds: string[] = [];
const documentIds: string[] = [];
const metadataIds: string[] = [];
const checks: string[] = [];

function checkStatus(actual: number, expected: number, label: string) {
  assert.equal(
    actual,
    expected,
    `${label}: expected HTTP ${expected}, received ${actual}`,
  );
  checks.push(`${label}: HTTP ${actual}`);
}

async function createSession(userId: string): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  const result = await pool.query(
    `INSERT INTO sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '1 hour')
     RETURNING id`,
    [userId, tokenHash],
  );

  sessionIds.push(String(result.rows[0].id));
  return rawToken;
}

async function requestSearch(options: {
  token?: string;
  query?: string;
  rawQuery?: string;
  organizationId?: string;
} = {}) {
  const headers: Record<string, string> = {};

  if (options.token) {
    headers.Cookie = `session=${options.token}`;
  }

  if (options.organizationId) {
    headers["X-Organization-Id"] = options.organizationId;
  }

  const url = `${API_URL}/api/search/content${
    options.rawQuery !== undefined
      ? options.rawQuery
      : options.query !== undefined
        ? `?${new URLSearchParams({ q: options.query }).toString()}`
        : ""
  }`;

  return fetch(url, { method: "GET", headers });
}

async function createTestDocument(
  code: string,
  filename: string,
  userId: string,
  orgId: string,
  text: string,
) {
  const result = await pool.query(
    `INSERT INTO documents (
       document_code,
       filename,
       title,
       upload_number,
       owner_user_id,
       organization_id
     )
     VALUES (
       $1, $2, $3, nextval('document_upload_number_seq'), $4, $5
     )
     RETURNING id`,
    [code, filename, `Content search test ${suffix}`, userId, orgId],
  );

  const documentId = String(result.rows[0].id);
  documentIds.push(documentId);

  await pool.query(
    `INSERT INTO document_extractions (
       document_id,
       extracted_text,
       extraction_status
     )
     VALUES ($1, $2, 'COMPLETED')`,
    [documentId, text],
  );

  return documentId;
}

async function main() {
  try {
    assert.ok(process.env.DATABASE_URL, "DATABASE_URL is not configured");

    const org = await pool.query(
      `INSERT INTO organizations (name, slug, status)
       VALUES ($1, $2, 'ACTIVE')
       RETURNING id`,
      [`M34 Content Search ${suffix}`, `m34-content-${suffix}`],
    );
    organizationId = String(org.rows[0].id);

    const foreignOrg = await pool.query(
      `INSERT INTO organizations (name, slug, status)
       VALUES ($1, $2, 'ACTIVE')
       RETURNING id`,
      [`M34 Foreign Content ${suffix}`, `m34-foreign-content-${suffix}`],
    );
    foreignOrganizationId = String(foreignOrg.rows[0].id);

    const owner = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, 'ADMIN', TRUE)
       RETURNING id`,
      [
        `m34-content-owner-${suffix}@example.invalid`,
        "runtime-test-only-not-a-real-password-hash",
        "M34 Content Search Test Owner",
      ],
    );
    ownerUserId = String(owner.rows[0].id);

    const noMembershipUser = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, 'VIEWER', TRUE)
       RETURNING id`,
      [
        `m34-content-no-membership-${suffix}@example.invalid`,
        "runtime-test-only-not-a-real-password-hash",
        "M34 Content Search Test Without Membership",
      ],
    );
    noMembershipUserId = String(noMembershipUser.rows[0].id);

    const foreignOwner = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, 'ADMIN', TRUE)
       RETURNING id`,
      [
        `m34-content-foreign-owner-${suffix}@example.invalid`,
        "runtime-test-only-not-a-real-password-hash",
        "M34 Foreign Content Test Owner",
      ],
    );
    foreignOwnerUserId = String(foreignOwner.rows[0].id);

    await pool.query(
      `INSERT INTO organization_memberships
         (organization_id, user_id, role, is_active)
       VALUES ($1, $2, 'OWNER', TRUE)`,
      [organizationId, ownerUserId],
    );

    await pool.query(
      `INSERT INTO organization_memberships
         (organization_id, user_id, role, is_active)
       VALUES ($1, $2, 'OWNER', TRUE)`,
      [foreignOrganizationId, foreignOwnerUserId],
    );

    ownerToken = await createSession(ownerUserId);
    noMembershipToken = await createSession(noMembershipUserId);

    console.log("\n=== CONTENT SEARCH HTTP RUNTIME TEST ===");
    console.log(`API: ${API_URL}`);
    console.log("Temporary organizations, users, and sessions created.");

    // Authentication is checked before query validation.
    let response = await requestSearch();
    checkStatus(response.status, 401, "Unauthenticated request rejected");

    response = await requestSearch({ token: "invalid-session-token" });
    checkStatus(response.status, 401, "Invalid session rejected");

    // Authenticated users must have an active organization membership.
    response = await requestSearch({
      token: noMembershipToken,
      query: searchToken,
    });
    checkStatus(response.status, 403, "User without membership rejected");

    // Repeated q parameters must be rejected as non-single-string input.
    response = await requestSearch({
      token: ownerToken,
      rawQuery: `?q=${encodeURIComponent(searchToken)}&q=another`,
    });
    checkStatus(response.status, 400, "Repeated query parameter rejected");

    // Query length is measured after URL decoding and trimming.
    response = await requestSearch({
      token: ownerToken,
      query: "x".repeat(201),
    });
    checkStatus(response.status, 400, "Query longer than 200 characters rejected");

    // Empty and whitespace-only queries return a valid empty response.
    for (const query of ["", "   "]) {
      response = await requestSearch({ token: ownerToken, query });
      checkStatus(response.status, 200, "Empty query accepted");

      const body = await response.json();
      assert.equal(body.success, true);
      assert.equal(body.query, "");
      assert.deepEqual(body.results, []);
      assert.equal(body.total, 0);
      assert.equal(body.limit, 50);
    }
    checks.push("Empty-query response structure validated");

    // A selected organization outside the user's memberships must be denied.
    response = await requestSearch({
      token: ownerToken,
      query: searchToken,
      organizationId: foreignOrganizationId,
    });
    checkStatus(response.status, 403, "Foreign organization selection rejected");

    // Create 51 matching documents in the owner's tenant.
    for (let index = 1; index <= 51; index++) {
      await createTestDocument(
        `${ownCodePrefix}${index}`,
        `m34-content-${suffix}-${index}.txt`,
        ownerUserId,
        organizationId,
        `Temporary extracted content ${searchToken}. Fixture number ${index}.`,
      );
    }

    // Add a matching document in the foreign tenant.
    await createTestDocument(
      `${foreignCodePrefix}1`,
      `m34-foreign-content-${suffix}.txt`,
      foreignOwnerUserId,
      foreignOrganizationId,
      `Foreign tenant content must not leak: ${searchToken}.`,
    );

    response = await requestSearch({
      token: ownerToken,
      query: searchToken,
      organizationId,
    });
    checkStatus(response.status, 200, "Authenticated content search succeeds");

    const body = await response.json();

    assert.equal(body.success, true, "Expected success=true");
    assert.equal(body.query, searchToken, "Expected normalized query in response");
    assert.equal(body.limit, 50, "Expected limit=50");
    assert.equal(body.total, 50, "Expected exactly 50 returned results");
    assert.equal(body.results.length, 50, "Expected 50 result objects");

    for (const result of body.results) {
      assert.equal(typeof result.document_id, "string");
      assert.ok(
        typeof result.document_code === "string" &&
          result.document_code.startsWith(ownCodePrefix),
        "Search returned a document outside the test tenant's fixture set",
      );
      assert.equal(typeof result.filename, "string");
      assert.equal(typeof result.document_status, "string");
      assert.equal(typeof result.excerpt, "string");
      assert.ok(result.excerpt.toLowerCase().includes(searchToken.toLowerCase()));
      assert.equal(typeof result.match_position, "number");
    }

    assert.equal(
      body.results.some((result: { document_code: string }) =>
        result.document_code.startsWith(foreignCodePrefix),
      ),
      false,
      "Foreign-tenant document must never appear in results",
    );

    checks.push("Response fields and excerpt content validated");
    checks.push("50-result limit respected with 51 matching tenant documents");
    checks.push("Foreign-tenant content excluded from search results");

    // Verify a saved metadata description is searchable without matching extracted text.
    const descriptionPhrase = `unique description topic ${suffix}`;
    const metadataResult = await pool.query(
      `INSERT INTO metadata_records (
         reference_code, title, description, organization_id
       )
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [
        `M34-DESC-${suffix}`,
        `Description-only fixture ${suffix}`,
        `This record concerns ${descriptionPhrase} for regression testing.`,
        organizationId,
      ],
    );
    const metadataId = String(metadataResult.rows[0].id);
    metadataIds.push(metadataId);

    const descriptionDocumentId = await createTestDocument(
      `${ownCodePrefix}DESCRIPTION`,
      `m34-description-${suffix}.txt`,
      ownerUserId,
      organizationId,
      `Extracted content unrelated to the saved description. Fixture ${suffix}.`,
    );

    await pool.query(
      `UPDATE documents
       SET metadata_record_id = $1
       WHERE id = $2 AND organization_id = $3`,
      [metadataId, descriptionDocumentId, organizationId],
    );

    response = await requestSearch({
      token: ownerToken,
      query: descriptionPhrase,
      organizationId,
    });
    checkStatus(response.status, 200, "Saved-description-only search succeeds");

    const descriptionBody = await response.json();
    const descriptionMatch = descriptionBody.results.find(
      (result: { document_id: string }) =>
        result.document_id === descriptionDocumentId,
    );

    assert.ok(descriptionMatch, "Document matching only through its saved description must be returned");
    assert.equal(descriptionMatch.metadata_record_id, metadataId);
    assert.ok(
      descriptionMatch.excerpt.toLowerCase().includes(descriptionPhrase.toLowerCase()),
      "Result excerpt must contain the matching saved-description phrase",
    );
    checks.push("Saved description searchable independently of extracted text");
    checks.push("Description-only result links the correct metadata record and excerpt");

    // Contextual token matches must return an excerpt from a field that matches.
    const contextualPhrase = `budget compliance ${suffix}`;
    const contextualDocumentId = await createTestDocument(
      `${ownCodePrefix}CONTEXTUAL`,
      `m34-contextual-${suffix}.txt`,
      ownerUserId,
      organizationId,
      `The annual budget was reviewed separately. Compliance checks followed during the final audit. Fixture ${suffix}.`,
    );

    response = await requestSearch({
      token: ownerToken,
      query: contextualPhrase,
      organizationId,
    });
    checkStatus(response.status, 200, "Contextual token search succeeds");

    const contextualBody = await response.json();
    const contextualMatch = contextualBody.results.find(
      (result: { document_id: string }) =>
        result.document_id === contextualDocumentId,
    );

    assert.ok(contextualMatch, "Document containing both contextual query tokens must be returned");
    assert.match(contextualMatch.excerpt.toLowerCase(), /budget/);
    assert.match(contextualMatch.excerpt.toLowerCase(), /compliance/);
    checks.push("Contextual match excerpt contains both query terms");

    // No-match behavior should return a successful empty result set.
    response = await requestSearch({
      token: ownerToken,
      query: `NO_MATCH_${suffix}`,
      organizationId,
    });
    checkStatus(response.status, 200, "No-match query succeeds");

    const noMatchBody = await response.json();
    assert.equal(noMatchBody.success, true);
    assert.deepEqual(noMatchBody.results, []);
    assert.equal(noMatchBody.total, 0);
    checks.push("No-match response structure validated");

    console.log("\n=== PASSED CHECKS ===");
    for (const item of checks) console.log(`PASS: ${item}`);
    console.log(`\nAll ${checks.length} checks passed.`);
  } finally {
    try {
      if (sessionIds.length) {
        await pool.query(
          `DELETE FROM sessions WHERE id = ANY($1::bigint[])`,
          [sessionIds],
        );
      }

      if (documentIds.length) {
        await pool.query(
          `DELETE FROM documents WHERE id = ANY($1::bigint[])`,
          [documentIds],
        );
      }

      if (metadataIds.length) {
        await pool.query(
          `DELETE FROM metadata_records WHERE id = ANY($1::bigint[])`,
          [metadataIds],
        );
      }

      const userIds = [ownerUserId, foreignOwnerUserId, noMembershipUserId].filter(
        (id): id is string => Boolean(id),
      );

      if (userIds.length) {
        await pool.query(
          `DELETE FROM organization_memberships WHERE user_id = ANY($1::bigint[])`,
          [userIds],
        );
      }

      const organizationIds = [organizationId, foreignOrganizationId].filter(
        (id): id is string => Boolean(id),
      );

      if (organizationIds.length) {
        await pool.query(
          `DELETE FROM organizations WHERE id = ANY($1::bigint[])`,
          [organizationIds],
        );
      }

      if (userIds.length) {
        await pool.query(
          `DELETE FROM users WHERE id = ANY($1::bigint[])`,
          [userIds],
        );
      }

      console.log("\nCleanup completed for this test's temporary records.");
    } finally {
      await pool.end();
    }
  }
}

main().catch((error) => {
  console.error("\nCONTENT SEARCH HTTP TEST FAILED");
  console.error(error);
  process.exitCode = 1;
});
