import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  console.log("`n==============================================");
  console.log("M22 ORGANIZATIONS SCHEMA INSPECTION");
  console.log("==============================================");

  const result = await pool.query(`
    SELECT
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organizations'
    ORDER BY ordinal_position
  `);

  console.table(result.rows);

  console.log("`n==============================================");
  console.log("M22 ORGANIZATIONS CONSTRAINTS");
  console.log("==============================================");

  const constraints = await pool.query(`
    SELECT
      tc.constraint_name,
      tc.constraint_type,
      kcu.column_name
    FROM information_schema.table_constraints tc
    LEFT JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'organizations'
    ORDER BY tc.constraint_name, kcu.ordinal_position
  `);

  console.table(constraints.rows);

  await pool.end();

  console.log("`nM22 ORGANIZATIONS SCHEMA INSPECTION COMPLETE.");
}

main().catch(async (error) => {
  console.error("`nM22 schema inspection failed:");
  console.error(error);

  try {
    await pool.end();
  } catch {
    // Pool may already be closed.
  }
});
