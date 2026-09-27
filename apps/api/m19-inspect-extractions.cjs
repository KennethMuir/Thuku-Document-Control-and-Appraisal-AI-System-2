const { Pool } = require("pg");
require("dotenv/config");

const pool = new Pool();

async function main() {
  try {
    const result = await pool.query(`
      SELECT
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'document_extractions'
      ORDER BY ordinal_position
    `);

    console.table(result.rows);
  } catch (error) {
    console.error("DATABASE INSPECTION FAILED:");
    console.error(error);
  } finally {
    await pool.end();
  }
}

main();
