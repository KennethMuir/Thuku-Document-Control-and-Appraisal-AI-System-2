import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  const columns = await pool.query(`
    SELECT
      ordinal_position,
      column_name,
      data_type,
      udt_name,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'metadata_domain_relationships'
    ORDER BY ordinal_position;
  `);

  const constraints = await pool.query(`
    SELECT
      tc.constraint_name,
      tc.constraint_type,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints tc
    LEFT JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    LEFT JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
      AND tc.table_schema = ccu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'metadata_domain_relationships'
    ORDER BY tc.constraint_type, tc.constraint_name, kcu.ordinal_position;
  `);

  const indexes = await pool.query(`
    SELECT
      indexname,
      indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'metadata_domain_relationships'
    ORDER BY indexname;
  `);

  const relationshipTypes = await pool.query(`
    SELECT
      relationship_type,
      COUNT(*)::INTEGER AS relationship_count
    FROM metadata_domain_relationships
    GROUP BY relationship_type
    ORDER BY relationship_type;
  `);

  const rows = await pool.query(`
    SELECT
      mdr.id,
      mdr.metadata_record_id,
      mdr.domain_id,
      dr.domain_key,
      dr.display_name AS domain_name,
      dr.organization_id AS domain_organization_id,
      mdr.organization_id AS relationship_organization_id,
      mdr.relationship_type,
      mdr.created_at,
      mdr.updated_at
    FROM metadata_domain_relationships mdr
    JOIN domain_registry dr
      ON dr.id = mdr.domain_id
    ORDER BY mdr.id;
  `);

  console.log("\n--- COLUMNS ---");
  console.table(columns.rows);

  console.log("\n--- CONSTRAINTS ---");
  console.table(constraints.rows);

  console.log("\n--- INDEXES ---");
  console.table(indexes.rows);

  console.log("\n--- RELATIONSHIP TYPES IN USE ---");
  console.table(relationshipTypes.rows);

  console.log("\n--- CURRENT RELATIONSHIP ROWS ---");
  console.table(rows.rows);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
