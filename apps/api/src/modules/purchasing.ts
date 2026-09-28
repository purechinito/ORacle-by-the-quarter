import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { AppError, requireRole, transaction } from "../db";
import { audit, id, key, lines, money, once, qty, text } from "./common";
import { move } from "./inventory";
export async function purchasingRoutes(app: FastifyInstance, pool: Pool) {
  app.get("/api/suppliers", async (req) => {
    requireRole(req.actor.role, ["manager", "stock"]);
    return (await pool.query("SELECT * FROM suppliers ORDER BY name")).rows;
  });
  app.post("/api/suppliers", async (req) => {
    requireRole(req.actor.role, ["manager"]);
    const b = z.object({ name: text }).parse(req.body);
    return (
      await pool.query("INSERT INTO suppliers(name) VALUES($1) RETURNING *", [
        b.name,
      ])
    ).rows[0];
  });
  app.get("/api/purchases", async (req) => {
    requireRole(req.actor.role, ["manager", "stock"]);
    const orders = (
      await pool.query(
        "SELECT p.*,s.name AS supplier FROM purchases p JOIN suppliers s ON s.id=p.supplier_id ORDER BY created_at DESC LIMIT 100",
      )
    ).rows;
    for (const p of orders) {
      p.lines = (
        await pool.query(
          "SELECT l.*,a.sku,a.name FROM purchase_lines l JOIN parts a ON a.id=l.part_id WHERE purchase_id=$1",
          [p.id],
        )
      ).rows;
      if (req.actor.role !== "manager")
        p.lines = p.lines.map(({ cost, ...l }: Record<string, unknown>) => l);
    }
    return orders;
  });
  app.post("/api/purchases", async (req) => {
    requireRole(req.actor.role, ["manager"]);
    const b = z
      .object({
        supplierId: id,
        lines: z
          .array(z.object({ partId: id, qty, cost: money }))
          .min(1)
          .max(500)
          .refine(
            (a) => new Set(a.map((x) => x.partId)).size === a.length,
            "Duplicate part",
          ),
      })
      .parse(req.body);
    return transaction(pool, async (tx) => {
      const p = (
        await tx.query(
          "INSERT INTO purchases(supplier_id,status) VALUES($1,'draft') RETURNING *",
          [b.supplierId],
        )
      ).rows[0];
      for (const l of b.lines)
        await tx.query(
          "INSERT INTO purchase_lines(purchase_id,part_id,qty,cost) VALUES($1,$2,$3,$4)",
          [p.id, l.partId, l.qty, l.cost],
        );
      await audit(tx, req.actor, "purchase.created", p.id);
      return p;
    });
  });
  app.post("/api/purchases/:id/submit", async (req) => {
    requireRole(req.actor.role, ["manager"]);
    const p = id.parse((req.params as any).id);
    return transaction(pool, async (tx) => {
      const r = await tx.query(
        "UPDATE purchases SET status='submitted' WHERE id=$1 AND status='draft' RETURNING *",
        [p],
      );
      if (!r.rowCount)
        throw new AppError(409, "Only draft orders can be submitted.");
      await audit(tx, req.actor, "purchase.submitted", p);
      return r.rows[0];
    });
  });
  app.post("/api/purchases/:id/cancel", async (req) => {
    requireRole(req.actor.role, ["manager"]);
    const p = id.parse((req.params as any).id);
    text.parse((req.body as any).reason);
    return transaction(pool, async (tx) => {
      const r = await tx.query(
        "UPDATE purchases SET status='cancelled' WHERE id=$1 AND status IN ('draft','submitted','partial') RETURNING *",
        [p],
      );
      if (!r.rowCount) throw new AppError(409, "Order cannot be cancelled.");
      await audit(tx, req.actor, "purchase.cancelled", p);
      return r.rows[0];
    });
  });
  app.post("/api/purchases/:id/receive", async (req) => {
    requireRole(req.actor.role, ["manager", "stock"]);
    const p = id.parse((req.params as any).id),
      b = z.object({ key, lines }).parse(req.body);
    return transaction(pool, (tx) =>
      once(tx, req.actor, "receipt", b.key, { p, ...b }, async () => {
        const order = (
          await tx.query("SELECT * FROM purchases WHERE id=$1 FOR UPDATE", [p])
        ).rows[0];
        if (!order || !["submitted", "partial"].includes(order.status))
          throw new AppError(409, "Order is not awaiting receipt.");
        for (const l of b.lines) {
          const r = await tx.query(
            "UPDATE purchase_lines SET received=received+$1 WHERE purchase_id=$2 AND part_id=$3 AND received+$1<=qty RETURNING part_id",
            [l.qty, p, l.partId],
          );
          if (!r.rowCount)
            throw new AppError(
              409,
              "Receipt exceeds the outstanding quantity.",
            );
        }
        const receipt = randomUUID();
        await tx.query(
          "INSERT INTO receipts(id,purchase_id,actor,lines) VALUES($1,$2,$3,$4)",
          [receipt, p, req.actor.id, JSON.stringify(b.lines)],
        );
        await move(
          tx,
          req.actor,
          b.lines,
          "receipt",
          "Purchase receipt",
          receipt,
        );
        const remaining = (
          await tx.query(
            "SELECT 1 FROM purchase_lines WHERE purchase_id=$1 AND received<qty",
            [p],
          )
        ).rowCount;
        await tx.query("UPDATE purchases SET status=$1 WHERE id=$2", [
          remaining ? "partial" : "received",
          p,
        ]);
        return { id: receipt, posted: true };
      }),
    );
  });
}
