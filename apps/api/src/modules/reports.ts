import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import { AppError, requireRole, transaction } from "../db";
import { audit, money, text } from "./common";
import { historyQuery, checkDates } from "./history";
export const csvCell = (x: unknown) =>
  '"' +
  String(x ?? "")
    .replace(/^[=+@\-\t\r]/, "'$&")
    .replaceAll('"', '""') +
  '"';
export async function reportsRoutes(app: FastifyInstance, pool: Pool) {
  app.get(
    "/api/settings",
    async () =>
      (await pool.query("SELECT data FROM settings WHERE id=1")).rows[0].data,
  );
  app.post("/api/settings", async (req) => {
    requireRole(req.actor.role, ["manager"]);
    const b = z
      .object({
        shopName: text,
        currency: z
          .string()
          .regex(/^[A-Z]{3}$/)
          .refine((c) => {
            try {
              return (
                new Intl.NumberFormat("en", {
                  style: "currency",
                  currency: c,
                }).resolvedOptions().maximumFractionDigits === 2 &&
                Intl.supportedValuesOf("currency").includes(c)
              );
            } catch {
              return false;
            }
          }, "Choose a supported currency with two decimal places."),
        taxMode: z.enum(["none", "inclusive", "exclusive"]),
        taxRate: money.refine((x) => Number(x) <= 100),
        timezone: z.string().refine((t) => {
          try {
            new Intl.DateTimeFormat("en", { timeZone: t });
            return true;
          } catch {
            return false;
          }
        }, "Invalid timezone"),
      })
      .parse(req.body);
    return transaction(pool, async (tx) => {
      const previous = (
        await tx.query("SELECT data FROM settings WHERE id=1 FOR UPDATE")
      ).rows[0].data;
      if (
        previous.currency &&
        previous.currency !== b.currency &&
        (await tx.query("SELECT 1 FROM sales WHERE status='posted' LIMIT 1"))
          .rowCount
      )
        throw new AppError(
          409,
          "Currency is locked after the first posted sale.",
        );
      await tx.query("UPDATE settings SET data=$1 WHERE id=1", [
        JSON.stringify(b),
      ]);
      await audit(tx, req.actor, "settings.saved", "1");
      return b;
    });
  });
  app.get("/api/reports", async (req) => {
    const q = historyQuery.parse(req.query);
    checkDates(q);
    const settings = (await pool.query("SELECT data FROM settings WHERE id=1"))
      .rows[0].data;
    const args = [q.from ?? null, q.to ?? null, settings.timezone ?? "UTC"];
    const where =
      "status='posted' AND ($1::date IS NULL OR posted_at >= ($1::date::timestamp AT TIME ZONE $3)) AND ($2::date IS NULL OR posted_at < (($2::date+1)::timestamp AT TIME ZONE $3))";
    const summary = (
      await pool.query(
        "SELECT count(*)::int AS count,COALESCE(sum(total),0)::numeric(14,2)::text AS total FROM sales WHERE " +
          where,
        args,
      )
    ).rows[0];
    const stats = (
      await pool.query(
        "SELECT count(*)::int AS parts,COALESCE(sum(stock),0)::int AS units,count(*) FILTER(WHERE stock<=reorder AND active)::int AS low FROM parts",
      )
    ).rows[0];
    const low = (
      await pool.query(
        "SELECT id,sku,name,stock,reorder,bin FROM parts WHERE stock<=reorder AND active ORDER BY stock,sku LIMIT 25",
      )
    ).rows;
    const recent = (
      await pool.query(
        "SELECT id,total,posted_at FROM sales WHERE " +
          where +
          " ORDER BY posted_at DESC,id DESC LIMIT $4 OFFSET $5",
        [...args, q.limit, (q.page - 1) * q.limit],
      )
    ).rows;
    const paid = (
      await pool.query(
        "SELECT COALESCE(sum(p.amount),0)::numeric(14,2)::text AS total FROM payments p JOIN sales s ON s.id=p.sale_id WHERE " +
          where
            .replaceAll("status", "s.status")
            .replaceAll("posted_at", "s.posted_at"),
        args,
      )
    ).rows[0].total;
    const outstanding = Number(
      (
        await pool.query(
          "SELECT count(*) FROM purchases WHERE status IN ('submitted','partial')",
        )
      ).rows[0].count,
    );
    const returned = Number(
      (
        await pool.query(
          "SELECT count(*) FROM returns WHERE ($1::date IS NULL OR created_at>=($1::date::timestamp AT TIME ZONE $3)) AND ($2::date IS NULL OR created_at<(($2::date+1)::timestamp AT TIME ZONE $3))",
          args,
        )
      ).rows[0].count,
    );
    return {
      ...stats,
      lowStock: low,
      salesTotal: summary.total,
      salesCount: summary.count,
      paymentTotal: paid,
      outstanding,
      returns: returned,
      recent,
      currency: settings.currency ?? "",
      timezone: settings.timezone ?? "UTC",
      location: "Main stockroom",
    };
  });
  app.get("/api/reports/export", async (req, reply) => {
    requireRole(req.actor.role, ["manager"]);
    const rows = (
      await pool.query(
        "SELECT sku,name,brand,category,stock,reorder,price,bin FROM parts ORDER BY sku",
      )
    ).rows;
    reply
      .type("text/csv")
      .header("Content-Disposition", 'attachment; filename="stock.csv"');
    return [
      "sku,name,brand,category,stock,reorder,price,bin",
      ...rows.map((r) => Object.values(r).map(csvCell).join(",")),
    ].join("\r\n");
  });
  app.get("/api/audit", async (req) => {
    requireRole(req.actor.role, ["manager"]);
    const q = historyQuery.parse(req.query);
    checkDates(q);
    return (
      await pool.query(
        "SELECT a.*,u.username FROM audit_events a JOIN users u ON u.id=a.actor WHERE ($1='' OR position(lower($1) in lower(a.action||' '||a.record_id||' '||u.username))>0) AND ($2::date IS NULL OR a.created_at>=($2::date::timestamp AT TIME ZONE COALESCE((SELECT data->>'timezone' FROM settings WHERE id=1),'UTC'))) AND ($3::date IS NULL OR a.created_at<(($3::date+1)::timestamp AT TIME ZONE COALESCE((SELECT data->>'timezone' FROM settings WHERE id=1),'UTC'))) ORDER BY a.id DESC LIMIT $4 OFFSET $5",
        [q.q, q.from ?? null, q.to ?? null, q.limit, (q.page - 1) * q.limit],
      )
    ).rows;
  });
}
