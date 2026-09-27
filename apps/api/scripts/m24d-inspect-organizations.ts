import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  const organizations = await pool.query(`
    SELECT
      id,
      name,
      slug,
      status,
      created_at,
      updated_at
    FROM organizations
    ORDER BY id;
  `);

  console.log("\n--- ORGANIZATIONS ---");
  console.table(organizations.rows);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
