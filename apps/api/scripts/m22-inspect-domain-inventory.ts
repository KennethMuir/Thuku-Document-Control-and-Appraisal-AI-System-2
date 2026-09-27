import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  const summary = await pool.query(`
    SELECT
      CASE
        WHEN organization_id IS NULL THEN 'SYSTEM'
        ELSE 'ORGANIZATION'
      END AS domain_scope,
      COUNT(*)::INTEGER AS domain_count
    FROM domain_registry
    GROUP BY 1
    ORDER BY 1;
  `);

  const domains = await pool.query(`
    SELECT
      dr.id,
      dr.domain_key,
      dr.display_name,
      dr.domain_family,
      dr.organization_id,
      o.name AS organization_name,
      dr.is_active,
      COUNT(mdr.id)::INTEGER AS relationship_count
    FROM domain_registry dr
    LEFT JOIN organizations o
      ON o.id = dr.organization_id
    LEFT JOIN metadata_domain_relationships mdr
      ON mdr.domain_id = dr.id
    GROUP BY
      dr.id,
      dr.domain_key,
      dr.display_name,
      dr.domain_family,
      dr.organization_id,
      o.name,
      dr.is_active
    ORDER BY
      CASE WHEN dr.organization_id IS NULL THEN 0 ELSE 1 END,
      dr.id;
  `);

  console.log("\n--- DOMAIN SCOPE SUMMARY ---");
  console.table(summary.rows);

  console.log("\n--- DOMAIN INVENTORY ---");
  console.table(domains.rows);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
