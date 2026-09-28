import type { PoolClient } from "pg";
import Decimal from "decimal.js";
import type { Actor } from "../auth";
import { AppError } from "../db";
import { audit } from "./common";
export async function journalRecord(tx: PoolClient, journalId: string) {
  const row = (
    await tx.query(
      "SELECT *,journal_date::text AS journal_date FROM gl_journals WHERE id=$1",
      [journalId],
    )
  ).rows[0];
  if (!row) throw new AppError(404, "Journal not found.");
  row.lines = (
    await tx.query(
      "SELECT l.*,a.code,a.name,a.type FROM gl_journal_lines l JOIN gl_accounts a ON a.id=l.account_id WHERE journal_id=$1 ORDER BY line_no",
      [journalId],
    )
  ).rows;
  row.reversal =
    (
      await tx.query(
        "SELECT id,journal_date::text FROM gl_journals WHERE reverses_id=$1",
        [journalId],
      )
    ).rows[0] ?? null;
  return row;
}
export async function postJournal(
  tx: PoolClient,
  actor: Actor,
  journalId: string,
) {
  const row = (
    await tx.query(
      "SELECT *,journal_date::text AS journal_date FROM gl_journals WHERE id=$1 FOR UPDATE",
      [journalId],
    )
  ).rows[0];
  if (!row) throw new AppError(404, "Journal not found.");
  if (row.status === "posted") return journalRecord(tx, journalId);
  const period = (
    await tx.query(
      "SELECT * FROM gl_periods WHERE $1::date BETWEEN starts_on AND ends_on FOR SHARE",
      [row.journal_date],
    )
  ).rows[0];
  if (!period || period.status !== "open")
    throw new AppError(
      409,
      "Choose an open accounting period for this journal date.",
    );
  const lines = (
    await tx.query(
      "SELECT debit,credit FROM gl_journal_lines WHERE journal_id=$1",
      [journalId],
    )
  ).rows;
  const dr = lines.reduce((n, l) => n.add(l.debit), new Decimal(0)),
    cr = lines.reduce((n, l) => n.add(l.credit), new Decimal(0));
  if (lines.length < 2 || !dr.gt(0) || !dr.eq(cr))
    throw new AppError(
      400,
      "Debits and credits must balance to the cent before posting.",
    );
  const accounts = (
    await tx.query(
      "SELECT a.id,a.active FROM gl_accounts a JOIN gl_journal_lines l ON l.account_id=a.id WHERE l.journal_id=$1 ORDER BY a.id FOR SHARE OF a",
      [journalId],
    )
  ).rows;
  if (accounts.some((a) => !a.active))
    throw new AppError(409, "A journal account is inactive.");
  await tx.query(
    "UPDATE gl_journals SET status='posted',period_id=$1,posted_by=$2,posted_at=now(),version=version+1 WHERE id=$3",
    [period.id, actor.id, journalId],
  );
  await audit(tx, actor, "journal.posted", journalId);
  return journalRecord(tx, journalId);
}
