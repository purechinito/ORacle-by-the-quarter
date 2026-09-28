import type { Pool } from "pg";
import { transaction } from "../apps/api/src/db";
const tables = [
  "users",
  "settings",
  "parts",
  "suppliers",
  "customers",
  "purchases",
  "purchase_lines",
  "receipts",
  "sales",
  "payments",
  "returns",
  "movements",
  "opening_parts",
  "audit_events",
  "postings",
] as const;
export async function snapshot(pool: Pool) {
  return transaction(pool, async (tx) => {
    await tx.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const data: Record<string, unknown[]> = {};
    for (const table of tables)
      data[table] = (await tx.query("SELECT * FROM " + table)).rows;
    return {
      version: 1,
      createdAt: new Date().toISOString(),
      migrations: (
        await tx.query("SELECT name FROM migrations ORDER BY name")
      ).rows.map((x) => x.name),
      tables: data,
    };
  });
}
export async function restoreSnapshot(pool: Pool, copy: any) {
  if (
    copy.version !== 1 ||
    !copy.tables ||
    tables.some((t) => !Array.isArray(copy.tables[t]))
  )
    throw Error("Unsupported snapshot.");
  await transaction(pool, async (tx) => {
    const migrations = (
      await tx.query("SELECT name FROM migrations ORDER BY name")
    ).rows.map((x) => x.name);
    if (JSON.stringify(copy.migrations) !== JSON.stringify(migrations))
      throw Error("Snapshot schema does not match this release.");
    for (const table of tables) {
      await tx.query("LOCK TABLE " + table + " IN ACCESS EXCLUSIVE MODE");
      if (
        table !== "settings" &&
        (await tx.query("SELECT 1 FROM " + table + " LIMIT 1")).rowCount
      )
        throw Error("Restore requires an empty database.");
    }
    await tx.query("DELETE FROM settings");
    for (const table of tables)
      await tx.query(
        "INSERT INTO " +
          table +
          " SELECT * FROM jsonb_populate_recordset(NULL::" +
          table +
          ",$1::jsonb)",
        [JSON.stringify(copy.tables[table])],
      );
    for (const table of ["movements", "audit_events"])
      await tx.query(
        "SELECT setval(pg_get_serial_sequence($1,'id'),GREATEST(COALESCE((SELECT max(id) FROM " +
          table +
          "),0),1),EXISTS(SELECT 1 FROM " +
          table +
          "))",
        [table],
      );
    const mismatch = await tx.query(
      "SELECT id FROM parts WHERE stock<>COALESCE((SELECT sum(qty) FROM movements WHERE part_id=parts.id),0)",
    );
    if (mismatch.rowCount) throw Error("Snapshot stock does not reconcile.");
    await tx.query("DELETE FROM sessions");
  });
}
