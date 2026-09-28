import pg from "pg";
import { migrate } from "../apps/api/src/db";
if (!process.env.DATABASE_URL) throw Error("DATABASE_URL required");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await migrate(pool);
} finally {
  await pool.end();
}
