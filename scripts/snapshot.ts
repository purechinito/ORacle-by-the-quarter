import type { Pool } from "pg";
import { transaction } from "../apps/api/src/db";
import { assertPesoCurrency } from "../apps/api/src/currency";
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
  "gl_accounts",
  "gl_periods",
  "gl_journals",
  "gl_journal_lines",
  "audit_events",
  "postings",
] as const;
export async function snapshot(pool: Pool) {
  return transaction(pool, async (tx) => {
    await tx.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const data: Record<string, unknown[]> = {};
    for (const table of tables) {
      const dates =
        table === "gl_periods"
          ? ",starts_on::text AS starts_on,ends_on::text AS ends_on"
          : table === "gl_journals"
            ? ",journal_date::text AS journal_date"
            : "";
      data[table] = (
        await tx.query("SELECT *" + dates + " FROM " + table)
      ).rows;
    }
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
  assertPesoCurrency(copy);
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
    // Reconstruct journals through normal posting constraints, inside this
    // isolated restore transaction. No trigger bypass is used. Closed periods
    // and inactive accounts regain their captured state after validation.
    for (const table of tables) {
      let rows = copy.tables[table];
      if (table === "gl_accounts")
        rows = rows.map((r: any) => ({ ...r, active: true }));
      if (table === "gl_periods")
        rows = rows.map((r: any) => ({ ...r, status: "open" }));
      if (table === "gl_journals")
        rows = rows.map((r: any) => ({ ...r, status: "draft" }));
      await tx.query(
        "INSERT INTO " +
          table +
          " SELECT * FROM jsonb_populate_recordset(NULL::" +
          table +
          ",$1::jsonb)",
        [JSON.stringify(rows)],
      );
    }
    for (const journal of copy.tables.gl_journals) {
      if (journal.status === "posted")
        await tx.query("UPDATE gl_journals SET status='posted' WHERE id=$1", [
          journal.id,
        ]);
      else if (journal.status !== "draft")
        throw Error("Invalid journal status in snapshot.");
    }
    for (const period of copy.tables.gl_periods)
      await tx.query("UPDATE gl_periods SET status=$1 WHERE id=$2", [
        period.status,
        period.id,
      ]);
    for (const account of copy.tables.gl_accounts)
      await tx.query("UPDATE gl_accounts SET active=$1 WHERE id=$2", [
        account.active,
        account.id,
      ]);
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
