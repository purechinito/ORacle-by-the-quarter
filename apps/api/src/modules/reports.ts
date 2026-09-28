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
        currency: z.literal("PHP").default("PHP"),
        taxMode: z.enum(["none", "inclusive", "exclusive"]),
        taxRate: money.refine((x) => Number(x) <= 100),
        timezone: z.literal("Asia/Manila").default("Asia/Manila"),
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
    const q = historyQuery
      .extend({ period: z.enum(["range", "today"]).default("range") })
      .parse(req.query);
    checkDates(q);
    if (q.period === "today" && (q.from || q.to))
      throw new AppError(
        400,
        "Choose today or an explicit date range, not both.",
      );
    return transaction(pool, async (tx) => {
      await tx.query(
        "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
      );
      const settings = (await tx.query("SELECT data FROM settings WHERE id=1"))
        .rows[0].data;
      const today = (
        await tx.query(
          "SELECT (now() AT TIME ZONE 'Asia/Manila')::date::text AS today",
        )
      ).rows[0].today;
      const range = {
        from: q.period === "today" ? today : (q.from ?? null),
        to: q.period === "today" ? today : (q.to ?? null),
      };
      const args = [
        range.from,
        range.to,
        "Asia/Manila",
        req.actor.role,
        req.actor.id,
      ];
      const where =
        "s.status='posted' AND ($1::date IS NULL OR s.posted_at >= ($1::date::timestamp AT TIME ZONE $3)) AND ($2::date IS NULL OR s.posted_at < (($2::date+1)::timestamp AT TIME ZONE $3)) AND ($4='manager' OR s.actor=$5)";
      const canReadSales = req.actor.role !== "stock";
      const summary = canReadSales
        ? (
            await tx.query(
              "SELECT count(*)::int AS count,COALESCE(sum(s.total),0)::numeric(14,2)::text AS total FROM sales s WHERE " +
                where,
              args,
            )
          ).rows[0]
        : { count: null, total: null };
      const stats = (
        await tx.query(
          "SELECT count(*) FILTER(WHERE active)::int AS parts,COALESCE(sum(stock),0)::int AS units,count(*) FILTER(WHERE stock<=reorder AND active)::int AS low FROM parts",
        )
      ).rows[0];
      const low = (
        await tx.query(
          "SELECT id,sku,name,stock,reorder,bin FROM parts WHERE stock<=reorder AND active ORDER BY stock,sku LIMIT 25",
        )
      ).rows;
      const recent = canReadSales
        ? (
            await tx.query(
              "SELECT s.id,s.total,s.posted_at FROM sales s WHERE " +
                where +
                " ORDER BY s.posted_at DESC,s.id DESC LIMIT $6 OFFSET $7",
              [...args, q.limit, (q.page - 1) * q.limit],
            )
          ).rows
        : [];
      const paid = canReadSales
        ? (
            await tx.query(
              "SELECT COALESCE(sum(p.amount),0)::numeric(14,2)::text AS total FROM payments p JOIN sales s ON s.id=p.sale_id WHERE " +
                where,
              args,
            )
          ).rows[0].total
        : null;
      const outstanding =
        req.actor.role === "counter"
          ? null
          : (
              await tx.query(
                "SELECT count(*)::int AS count FROM purchases WHERE status IN ('submitted','partial')",
              )
            ).rows[0].count;
      const returned = canReadSales
        ? (
            await tx.query(
              "SELECT count(*)::int AS count FROM returns r JOIN sales s ON s.id=r.sale_id WHERE ($1::date IS NULL OR r.created_at>=($1::date::timestamp AT TIME ZONE $3)) AND ($2::date IS NULL OR r.created_at<(($2::date+1)::timestamp AT TIME ZONE $3)) AND ($4='manager' OR s.actor=$5)",
              args,
            )
          ).rows[0].count
        : null;
      return {
        ...stats,
        lowStock: low,
        salesTotal: summary.total,
        salesCount: summary.count,
        paymentTotal: paid,
        outstanding,
        returns: returned,
        recent,
        range,
        scope:
          req.actor.role === "manager"
            ? "business"
            : canReadSales
              ? "own-sales"
              : "inventory",
        currency: settings.currency ?? "PHP",
        timezone: "Asia/Manila",
        location: "Main stockroom",
      };
    });
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
      .header("Content-Disposition", 'attachment; filename="stock-php.csv"');
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
        "SELECT a.*,u.username FROM audit_events a JOIN users u ON u.id=a.actor WHERE ($1='' OR position(lower($1) in lower(a.action||' '||a.record_id||' '||u.username))>0) AND ($2::date IS NULL OR a.created_at>=($2::date::timestamp AT TIME ZONE COALESCE((SELECT data->>'timezone' FROM settings WHERE id=1),'Asia/Manila'))) AND ($3::date IS NULL OR a.created_at<(($3::date+1)::timestamp AT TIME ZONE COALESCE((SELECT data->>'timezone' FROM settings WHERE id=1),'Asia/Manila'))) ORDER BY a.id DESC LIMIT $4 OFFSET $5",
        [q.q, q.from ?? null, q.to ?? null, q.limit, (q.page - 1) * q.limit],
      )
    ).rows;
  });
}
