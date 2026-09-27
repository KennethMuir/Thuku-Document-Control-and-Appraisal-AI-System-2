import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  console.log("\n===== M22 — CHECK LOWER-ROLE TEST CONTEXT =====");

  const result = await pool.query(`
    SELECT
      om.user_id,
      om.organization_id,
      om.role,
      u.email,
      u.is_active AS user_active,
      om.is_active AS membership_active,
      o.status AS organization_status
    FROM organization_memberships om
    INNER JOIN users u
      ON u.id = om.user_id
    INNER JOIN organizations o
      ON o.id = om.organization_id
    WHERE
      om.is_active = TRUE
      AND u.is_active = TRUE
      AND om.role IN ('APPRAISER', 'VIEWER')
      AND o.status = 'ACTIVE'
    ORDER BY
      CASE om.role
        WHEN 'APPRAISER' THEN 1
        WHEN 'VIEWER' THEN 2
      END,
      om.user_id
    LIMIT 10
  `);

  if (result.rows.length === 0) {
    console.log("No active APPRAISER or VIEWER membership was found.");
  } else {
    console.table(result.rows);
  }

  await pool.end();

  console.log("\n===== M22 — LOWER-ROLE CONTEXT CHECK COMPLETE =====");
}

main().catch(async (error) => {
  console.error("\nM22 lower-role context check failed:");
  console.error(error);
  await pool.end();
});
