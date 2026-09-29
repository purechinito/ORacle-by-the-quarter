import { z } from "zod";
import Decimal from "decimal.js";
import type { PoolClient } from "pg";
import { AppError } from "../db";
import { digest, type Actor } from "../auth";
export const id = z.string().uuid();
export const text = z.string().trim().min(1).max(200);
export const money = z
  .string()
  .regex(
    /^\d{1,10}(\.\d{1,2})?$/,
    "Use a non-negative amount with up to two decimal places.",
  )
  .transform((v) => new Decimal(v).toFixed(2));
export const qty = z.number().int().min(1).max(1000000);
export const line = z.object({ partId: id, qty });
export const lines = z
  .array(line)
  .min(1)
  .max(500)
  .refine(
    (a) => new Set(a.map((x) => x.partId)).size === a.length,
    "Each part must appear once.",
  );
export const key = z.string().min(8).max(100);
export async function audit(
  tx: PoolClient,
  actor: Actor,
  action: string,
  record: string,
) {
  await tx.query(
    "INSERT INTO audit_events(actor,action,record_id) VALUES($1,$2,$3)",
    [actor.id, action, record],
  );
}
function canonical(v: any): string {
  return JSON.stringify(v, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(
          Object.entries(x).sort(([a], [b]) => a.localeCompare(b)),
        )
      : x,
  );
}
export async function once(
  tx: PoolClient,
  actor: Actor,
  operation: string,
  k: string,
  input: unknown,
  fn: () => Promise<any>,
) {
  const scoped = actor.id + ":" + operation + ":" + k;
  await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
    scoped,
  ]);
  const old = (await tx.query("SELECT * FROM postings WHERE key=$1", [scoped]))
    .rows[0];
  const hash = digest(canonical(input));
  if (old) {
    if (old.fingerprint !== hash)
      throw new AppError(
        409,
        "This retry key was already used with different data.",
      );
    return old.result;
  }
  const result = await fn();
  await tx.query("INSERT INTO postings VALUES($1,$2,$3,$4,$5)", [
    scoped,
    actor.id,
    operation,
    hash,
    JSON.stringify(result),
  ]);
  return result;
}
