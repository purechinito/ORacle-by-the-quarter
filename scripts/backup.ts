import pg from "pg";
import { writeFile } from "node:fs/promises";
import { snapshot } from "./snapshot";
const output = process.argv[2];
if (!output || !process.env.DATABASE_URL)
  throw Error(
    "Usage: DATABASE_URL=… npm run backup -- /secure/path/backup.json",
  );
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await writeFile(output, JSON.stringify(await snapshot(pool)), {
    flag: "wx",
    mode: 0o600,
  });
  console.log(
    "Backup created. Store it securely; it contains business data and password hashes.",
  );
} finally {
  await pool.end();
}
