import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool } from "./client.server";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const migrationsDir = path.join(root, "migrations");

async function main() {
  const pool = getPool();
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id varchar(255) NOT NULL PRIMARY KEY,
      applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [rows] = await pool.execute("SELECT id FROM schema_migrations");
  const applied = new Set((rows as Array<{ id: string }>).map((row) => row.id));
  const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
    console.log(`Applying migration ${file}`);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const statement of sql.split(/;\s*(?:\n|$)/).map((part) => part.trim()).filter(Boolean)) {
        await connection.query(statement);
      }
      await connection.execute("INSERT INTO schema_migrations (id) VALUES (?)", [file]);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  await pool.end();
  console.log("Migrations complete");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
