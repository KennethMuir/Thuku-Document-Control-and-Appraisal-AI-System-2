import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function inspectDatabase() {
  const client = await pool.connect();

  try {
    console.log("\n--- DATABASE TABLES ---");

    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.table(tables.rows);

    console.log("\n--- USERS COLUMNS ---");

    const users = await client.query(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
      ORDER BY ordinal_position;
    `);

    console.table(users.rows);

    console.log("\n--- DOCUMENTS COLUMNS ---");

    const documents = await client.query(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'documents'
      ORDER BY ordinal_position;
    `);

    console.table(documents.rows);

    console.log("\n--- METADATA COLUMNS ---");

    const metadata = await client.query(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'metadata_records'
      ORDER BY ordinal_position;
    `);

    console.table(metadata.rows);

    console.log("\n--- FOREIGN KEYS ---");

    const foreignKeys = await client.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS referenced_table,
        ccu.column_name AS referenced_column
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name;
    `);

    console.table(foreignKeys.rows);

    console.log("\n--- USERS SUMMARY ---");

    const userSummary = await client.query(`
      SELECT
        COUNT(*) AS total_users,
        COUNT(*) FILTER (WHERE is_active = TRUE) AS active_users,
        COUNT(*) FILTER (WHERE role = 'ADMIN') AS admin_users,
        COUNT(*) FILTER (WHERE role = 'APPRAISER') AS appraiser_users,
        COUNT(*) FILTER (WHERE role = 'VIEWER') AS viewer_users
      FROM users;
    `);

    console.table(userSummary.rows);

    console.log("\n--- DOCUMENT OWNERSHIP SUMMARY ---");

    const ownership = await client.query(`
      SELECT
        COUNT(*) AS total_documents,
        COUNT(DISTINCT owner_user_id) AS document_owners,
        COUNT(*) FILTER (WHERE owner_user_id IS NULL) AS unowned_documents
      FROM documents;
    `);

    console.table(ownership.rows);

    console.log("\nDATABASE INSPECTION SUCCESSFUL");
  } finally {
    client.release();
    await pool.end();
  }
}

inspectDatabase().catch((error) => {
  console.error("\nDATABASE INSPECTION FAILED:");
  console.error(error.message);
  process.exit(1);
});
