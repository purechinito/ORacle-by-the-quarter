import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import Decimal from "decimal.js";
import { randomUUID } from "node:crypto";
import { AppError, requireRole, transaction } from "../db";
import { audit, id, key, money, once, qty, text } from "./common";
import { requireActiveParty } from "./relationships";
import { move } from "./inventory";
import { historyQuery, checkDates } from "./history";
export function totals(lines: { price: string; qty: number }[], settings: any) {
  let subtotal = new Decimal(0),
    tax = new Decimal(0);
  for (const l of lines) {
    const gross = new Decimal(l.price).mul(l.qty);
    const rate = new Decimal(settings.taxRate ?? "0").div(100);
    let net = gross,
      t = new Decimal(0);
    if (settings.taxMode === "exclusive")
      t = gross.mul(rate).toDecimalPlaces(2);
    if (settings.taxMode === "inclusive") {
      t = gross.sub(gross.div(rate.add(1))).toDecimalPlaces(2);
      net = gross.sub(t);
    }
    subtotal = subtotal.add(net);
    tax = tax.add(t);
  }
  return {
    subtotal: subtotal.toFixed(2),
    tax: tax.toFixed(2),
    total: subtotal.add(tax).toFixed(2),
  };
}
export async function salesRoutes(app: FastifyInstance, pool: Pool) {
  app.get("/api/sales", async (req) => {
    requireRole(req.actor.role, ["manager", "counter"]);
    const q = historyQuery
      .extend({ status: z.enum(["draft", "posted", ""]).default("") })
      .parse(req.query);
    checkDates(q);
    return (
      await pool.query(
        "SELECT s.*,c.name AS customer FROM sales s LEFT JOIN customers c ON c.id=s.customer_id WHERE ($1='manager' OR s.actor=$2) AND ($3='' OR s.status=$3) AND ($4='' OR position(lower($4) in lower(s.id::text||' '||COALESCE(c.name,'Walk-in')||' '||s.lines::text))>0) AND ($5::date IS NULL OR COALESCE(s.posted_at,s.created_at)>=($5::date::timestamp AT TIME ZONE COALESCE((SELECT data->>'timezone' FROM settings WHERE id=1),'Asia/Manila'))) AND ($6::date IS NULL OR COALESCE(s.posted_at,s.created_at)<(($6::date+1)::timestamp AT TIME ZONE COALESCE((SELECT data->>'timezone' FROM settings WHERE id=1),'Asia/Manila'))) ORDER BY COALESCE(s.posted_at,s.created_at) DESC,s.id DESC LIMIT $7 OFFSET $8",
        [
          req.actor.role,
          req.actor.id,
          q.status,
          q.q,
          q.from ?? null,
          q.to ?? null,
          q.limit,
          (q.page - 1) * q.limit,
        ],
      )
    ).rows;
  });
  app.get("/api/sales/:id", async (req) => {
    requireRole(req.actor.role, ["manager", "counter"]);
    const r = (
      await pool.query(
        "SELECT * FROM sales WHERE id=$1 AND ($2='manager' OR actor=$3)",
        [id.parse((req.params as any).id), req.actor.role, req.actor.id],
      )
    ).rows[0];
    if (!r) throw new AppError(404, "Sale not found.");
    r.payment =
      (
        await pool.query(
          "SELECT amount,method,tendered,change FROM payments WHERE sale_id=$1",
          [r.id],
        )
      ).rows[0] ?? null;
    r.returns = (
      await pool.query(
        "SELECT * FROM returns WHERE sale_id=$1 ORDER BY created_at",
        [r.id],
      )
    ).rows;
    return r;
  });
  app.post("/api/carts", async (req) => {
    requireRole(req.actor.role, ["manager", "counter"]);
    const b = z
      .object({
        id: id.optional(),
        customerId: id.nullable().optional(),
        reason: z.string().max(200).optional(),
        lines: z
          .array(z.object({ partId: id, qty, price: money.optional() }))
          .min(1)
          .max(500)
          .refine(
            (a) => new Set(a.map((x) => x.partId)).size === a.length,
            "Duplicate part",
          ),
      })
      .parse(req.body);
    return transaction(pool, async (tx) => {
      if (b.id) {
        const old = (
          await tx.query("SELECT * FROM sales WHERE id=$1 FOR UPDATE", [b.id])
        ).rows[0];
        if (
          !old ||
          old.status !== "draft" ||
          (old.actor !== req.actor.id && req.actor.role !== "manager")
        )
          throw new AppError(409, "Cart is unavailable or already posted.");
      }
      await requireActiveParty(tx, "customers", b.customerId);
      const ls = [];
      for (const l of b.lines) {
        const p = (
          await tx.query("SELECT * FROM parts WHERE id=$1 AND active", [
            l.partId,
          ])
        ).rows[0];
        if (!p) throw new AppError(409, "Part is unavailable.");
        const overridden =
          l.price !== undefined && !new Decimal(l.price).eq(p.price);
        if (overridden) {
          requireRole(req.actor.role, ["manager"]);
          text.parse(b.reason);
        }
        ls.push({
          partId: p.id,
          sku: p.sku,
          name: p.name,
          qty: l.qty,
          price: l.price ?? p.price,
          ...(overridden ? { overrideReason: text.parse(b.reason) } : {}),
        });
      }
      const settings = (
        await tx.query("SELECT data FROM settings WHERE id=1 FOR SHARE")
      ).rows[0].data;
      const amounts = totals(ls, settings);
      const r = b.id
        ? await tx.query(
            "UPDATE sales SET lines=$1,customer_id=$2,subtotal=$3,tax=$4,total=$5 WHERE id=$6 RETURNING *",
            [
              JSON.stringify(ls),
              b.customerId ?? null,
              amounts.subtotal,
              amounts.tax,
              amounts.total,
              b.id,
            ],
          )
        : await tx.query(
            "INSERT INTO sales(status,actor,customer_id,lines,subtotal,tax,total) VALUES('draft',$1,$2,$3,$4,$5,$6) RETURNING *",
            [
              req.actor.id,
              b.customerId ?? null,
              JSON.stringify(ls),
              amounts.subtotal,
              amounts.tax,
              amounts.total,
            ],
          );
      await audit(
        tx,
        req.actor,
        b.reason ? "cart.price_override: " + b.reason : "cart.saved",
        r.rows[0].id,
      );
      return r.rows[0];
    });
  });
  app.post("/api/sales/:id/post", async (req) => {
    requireRole(req.actor.role, ["manager", "counter"]);
    const p = id.parse((req.params as any).id),
      b = z
        .object({ key, payment: money, method: z.enum(["cash", "external"]) })
        .parse(req.body);
    return transaction(pool, (tx) =>
      once(tx, req.actor, "sale", b.key, { p, ...b }, async () => {
        const sale = (
          await tx.query("SELECT * FROM sales WHERE id=$1 FOR UPDATE", [p])
        ).rows[0];
        if (
          !sale ||
          sale.status !== "draft" ||
          (sale.actor !== req.actor.id && req.actor.role !== "manager")
        )
          throw new AppError(409, "Sale is not a draft you can post.");
        await requireActiveParty(tx, "customers", sale.customer_id);
        const settings = (
          await tx.query("SELECT data FROM settings WHERE id=1 FOR SHARE")
        ).rows[0].data;
        if (
          settings.currency !== "PHP" ||
          settings.timezone !== "Asia/Manila" ||
          !settings.taxMode
        )
          throw new AppError(
            409,
            "Confirm Philippine shop tax treatment before posting.",
          );
        const amount = totals(sale.lines, settings);
        if (new Decimal(b.payment).lt(amount.total))
          throw new AppError(400, "Payment is below the sale total.");
        await move(
          tx,
          req.actor,
          sale.lines.map((l: any) => ({ partId: l.partId, qty: -l.qty })),
          "sale",
          "Counter sale",
          p,
        );
        await tx.query(
          "UPDATE sales SET status='posted',subtotal=$1,tax=$2,total=$3,settings=$4,posted_at=now() WHERE id=$5",
          [
            amount.subtotal,
            amount.tax,
            amount.total,
            JSON.stringify(settings),
            p,
          ],
        );
        await tx.query(
          "INSERT INTO payments(sale_id,amount,method,tendered,change) VALUES($1,$2,$3,$4,$5)",
          [
            p,
            amount.total,
            b.method,
            b.payment,
            new Decimal(b.payment).sub(amount.total).toFixed(2),
          ],
        );
        return {
          id: p,
          ...amount,
          change: new Decimal(b.payment).sub(amount.total).toFixed(2),
          posted: true,
        };
      }),
    );
  });
  app.post("/api/returns/:id/refund", async (req) => {
    requireRole(req.actor.role, ["manager"]);
    const rid = id.parse((req.params as any).id),
      b = z.object({ reference: text }).parse(req.body);
    return transaction(pool, async (tx) => {
      const r = (
        await tx.query("SELECT * FROM returns WHERE id=$1 FOR UPDATE", [rid])
      ).rows[0];
      if (!r) throw new AppError(404, "Return not found.");
      if (r.refund_status === "recorded") return r;
      const updated = (
        await tx.query(
          "UPDATE returns SET refund_status='recorded',refund_reference=$1,refunded_at=now(),refunded_by=$2 WHERE id=$3 RETURNING *",
          [b.reference, req.actor.id, rid],
        )
      ).rows[0];
      await audit(tx, req.actor, "refund.recorded", rid);
      return updated;
    });
  });
  app.post("/api/sales/:id/return", async (req) => {
    requireRole(req.actor.role, ["manager"]);
    const p = id.parse((req.params as any).id),
      b = z
        .object({
          key,
          reason: text,
          refundStatus: z.enum(["pending", "recorded"]),
          lines: z
            .array(z.object({ partId: id, qty, restock: z.boolean() }))
            .min(1)
            .max(500)
            .refine(
              (a) => new Set(a.map((x) => x.partId)).size === a.length,
              "Duplicate part",
            ),
        })
        .parse(req.body);
    return transaction(pool, (tx) =>
      once(tx, req.actor, "return", b.key, { p, ...b }, async () => {
        const sale = (
          await tx.query("SELECT * FROM sales WHERE id=$1 FOR UPDATE", [p])
        ).rows[0];
        if (!sale || sale.status !== "posted")
          throw new AppError(409, "Only posted sales can be returned.");
        const prior = (
          await tx.query("SELECT lines FROM returns WHERE sale_id=$1", [p])
        ).rows.flatMap((x) => x.lines);
        for (const l of b.lines) {
          const original = sale.lines.find((x: any) => x.partId === l.partId);
          const returned = prior
            .filter((x: any) => x.partId === l.partId)
            .reduce((n: number, x: any) => n + x.qty, 0);
          if (!original || returned + l.qty > original.qty)
            throw new AppError(409, "Return exceeds sold quantity.");
        }
        const rid = randomUUID();
        await tx.query(
          "INSERT INTO returns(id,sale_id,actor,lines,reason,refund_status) VALUES($1,$2,$3,$4,$5,$6)",
          [
            rid,
            p,
            req.actor.id,
            JSON.stringify(b.lines),
            b.reason,
            b.refundStatus,
          ],
        );
        await move(
          tx,
          req.actor,
          b.lines.filter((x) => x.restock),
          "return",
          b.reason,
          rid,
        );
        return { id: rid, posted: true };
      }),
    );
  });
}
