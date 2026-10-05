import pg from "pg";
import { readFile } from "node:fs/promises";
import { migrate } from "../apps/api/src/db";
import { restoreSnapshot } from "./snapshot";
const input = process.argv[2];
if (!input || !process.env.RESTORE_DATABASE_URL)
  throw Error(
    "Usage: RESTORE_DATABASE_URL=… npm run restore -- /secure/path/backup.json",
  );
if (
  process.env.DATABASE_URL &&
  process.env.RESTORE_DATABASE_URL === process.env.DATABASE_URL
)
  throw Error("Restore into a separate database, never the active database.");
const pool = new pg.Pool({
  connectionString: process.env.RESTORE_DATABASE_URL,
});
try {
  await migrate(pool);
  await restoreSnapshot(pool, JSON.parse(await readFile(input, "utf8")));
  console.log(
    "Snapshot restored and stock reconciled. All sessions invalidated.",
  );
} finally {
  await pool.end();
}
