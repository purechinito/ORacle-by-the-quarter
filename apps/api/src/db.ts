import type { Pool, PoolClient } from "pg";
import { readFile, readdir } from "node:fs/promises";
export async function transaction<T>(
  pool: Pool,
  fn: (tx: PoolClient) => Promise<T>,
): Promise<T> {
  const tx = await pool.connect();
  try {
    await tx.query("BEGIN");
    const result = await fn(tx);
    await tx.query("COMMIT");
    return result;
  } catch (e) {
    await tx.query("ROLLBACK");
    throw e;
  } finally {
    tx.release();
  }
}
export async function migrate(pool: Pool) {
  await pool.query(
    "CREATE TABLE IF NOT EXISTS migrations(name text PRIMARY KEY)",
  );
  for (const name of (await readdir("db/migrations")).sort()) {
    if (
      !(await pool.query("SELECT 1 FROM migrations WHERE name=$1", [name]))
        .rowCount
    )
      await transaction(pool, async (tx) => {
        await tx.query(await readFile("db/migrations/" + name, "utf8"));
        await tx.query("INSERT INTO migrations VALUES($1)", [name]);
      });
  }
}
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
export function requireRole(role: string, allowed: string[]) {
  if (!allowed.includes(role))
    throw new AppError(403, "You do not have permission for this action.");
}
