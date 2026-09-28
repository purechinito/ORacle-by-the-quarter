import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import { parse } from "csv-parse/sync";
import { AppError, requireRole, transaction } from "../db";
import { id, qty } from "./common";
import { move } from "./inventory";
export async function openingImportRoutes(app: FastifyInstance, pool: Pool) {
  app.post("/api/stock-import/preview", async (req) => {
    requireRole(req.actor.role, ["manager"]);
    const { csv } = z.object({ csv: z.string().max(4000000) }).parse(req.body);
    let raw: any[];
    try {
      raw = parse(csv, { columns: true, bom: true, skip_empty_lines: true });
    } catch {
      throw new AppError(400, "Invalid CSV. Required columns: sku,qty.");
    }
    if (raw.length > 10000) throw new AppError(400, "Maximum 10,000 rows.");
    const parts = (
      await pool.query(
        "SELECT p.id,p.sku,EXISTS(SELECT 1 FROM opening_parts o WHERE o.part_id=p.id) AS opened FROM parts p WHERE active",
      )
    ).rows;
    const map = new Map(parts.map((x) => [x.sku, x])),
      seen = new Set(),
      errors: string[] = [],
      rows: any[] = [];
    raw.forEach((r, i) => {
      const p = map.get(r.sku),
        v = qty.safeParse(Number(r.qty));
      if (!p || !v.success || seen.has(r.sku) || p.opened) {
        errors.push(
          "Row " +
            (i + 2) +
            ": unknown/inactive SKU, invalid quantity, duplicate, or opening already posted.",
        );
        return;
      }
      seen.add(r.sku);
      rows.push({ partId: p.id, qty: v.data, sku: r.sku });
    });
    if (!raw.length) errors.push("No rows.");
    const p = (
      await pool.query(
        "INSERT INTO import_previews(actor,rows,errors,kind) VALUES($1,$2,$3,'opening') RETURNING id",
        [req.actor.id, JSON.stringify(rows), JSON.stringify(errors)],
      )
    ).rows[0];
    return { ...p, count: rows.length, errors, preview: rows.slice(0, 5) };
  });
  app.post("/api/stock-import/commit", async (req) => {
    requireRole(req.actor.role, ["manager"]);
    const b = z.object({ id }).parse(req.body);
    return transaction(pool, async (tx) => {
      const p = (
        await tx.query(
          "SELECT * FROM import_previews WHERE id=$1 AND actor=$2 AND kind='opening' FOR UPDATE",
          [b.id, req.actor.id],
        )
      ).rows[0];
      if (!p) throw new AppError(404, "Preview not found.");
      if (p.result) return p.result;
      if (p.errors.length) throw new AppError(400, "Resolve preview errors.");
      if (new Date(p.expires_at) < new Date())
        throw new AppError(409, "Preview expired.");
      for (const l of [...p.rows].sort((a, b) =>
        a.partId.localeCompare(b.partId),
      )) {
        if (
          !(
            await tx.query(
              "INSERT INTO opening_parts VALUES($1) ON CONFLICT DO NOTHING RETURNING part_id",
              [l.partId],
            )
          ).rowCount
        )
          throw new AppError(409, "Opening stock already exists for a part.");
      }
      await move(
        tx,
        req.actor,
        p.rows,
        "opening",
        "Opening stock import",
        p.id,
      );
      const result = { id: p.id, count: p.rows.length };
      await tx.query("UPDATE import_previews SET result=$1 WHERE id=$2", [
        JSON.stringify(result),
        p.id,
      ]);
      return result;
    });
  });
}
