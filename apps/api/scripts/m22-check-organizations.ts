import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  console.log("\n==============================================");
  console.log("M22 CROSS-ORGANIZATION TEST CONTEXT");
  console.log("==============================================");

  const result = await pool.query(`
    SELECT
      o.id AS organization_id,
      o.name AS organization_name,
      o.status AS organization_status,
      COUNT(om.id)::int AS active_memberships
    FROM organizations o
    LEFT JOIN organization_memberships om
      ON om.organization_id = o.id
      AND om.is_active = TRUE
    WHERE o.status = 'ACTIVE'
    GROUP BY
      o.id,
      o.name,
      o.status
    ORDER BY o.id
  `);

  console.table(result.rows);

  console.log("\n===== M22 CROSS-ORGANIZATION CONTEXT CHECK COMPLETE =====");

  await pool.end();
}

main().catch(async (error) => {
  console.error("\nM22 context check failed:");
  console.error(error);

  try {
    await pool.end();
  } catch {
    // Pool may already be closed.
  }
});
