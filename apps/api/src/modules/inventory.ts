import type { FastifyInstance } from "fastify";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { AppError, requireRole, transaction } from "../db";
import type { Actor } from "../auth";
import { audit, id, key, once, text } from "./common";
export async function move(
  tx: PoolClient,
  actor: Actor,
  lines: { partId: string; qty: number }[],
  kind: string,
  reason: string,
  document: string,
) {
  for (const l of [...lines].sort((a, b) => a.partId.localeCompare(b.partId))) {
    const p = (
      await tx.query("SELECT stock,active FROM parts WHERE id=$1 FOR UPDATE", [
        l.partId,
      ])
    ).rows[0];
    if (!p) throw new AppError(404, "Part not found.");
    if (!p.active) throw new AppError(409, "Inactive parts cannot be posted.");
    if (p.stock + l.qty < 0)
      throw new AppError(409, "Insufficient stock. Your draft has been kept.");
    if (l.qty === 0) continue;
    await tx.query("UPDATE parts SET stock=stock+$1 WHERE id=$2", [
      l.qty,
      l.partId,
    ]);
    await tx.query(
      "INSERT INTO movements(part_id,qty,kind,reason,document_id,actor) VALUES($1,$2,$3,$4,$5,$6)",
      [l.partId, l.qty, kind, reason, document, actor.id],
    );
  }
  await audit(tx, actor, kind + ".posted", document);
}
export async function inventoryRoutes(app: FastifyInstance, pool: Pool) {
  app.get("/api/movements", async (req) => {
    const q = z
      .object({
        partId: id.optional(),
        page: z.coerce.number().int().min(1).default(1),
      })
      .parse(req.query);
    return (
      await pool.query(
        "SELECT m.*,p.sku,p.name,u.username FROM movements m JOIN parts p ON p.id=m.part_id JOIN users u ON u.id=m.actor WHERE ($1::uuid IS NULL OR m.part_id=$1) ORDER BY m.id DESC LIMIT 100 OFFSET $2",
        [q.partId ?? null, (q.page - 1) * 100],
      )
    ).rows;
  });
  app.post("/api/stock", async (req) => {
    requireRole(req.actor.role, ["manager"]);
    const b = z
      .object({
        key,
        kind: z.enum(["opening", "adjustment"]),
        reason: text,
        lines: z
          .array(
            z.object({
              partId: id,
              qty: z
                .number()
                .int()
                .min(-1000000)
                .max(1000000)
                .refine((n) => n !== 0),
            }),
          )
          .min(1)
          .max(10000)
          .refine(
            (a) => new Set(a.map((x) => x.partId)).size === a.length,
            "Duplicate part",
          ),
      })
      .parse(req.body);
    if (b.kind === "opening" && b.lines.some((x) => x.qty < 0))
      throw new AppError(400, "Opening quantities must be positive.");
    return transaction(pool, (tx) =>
      once(tx, req.actor, "stock", b.key, b, async () => {
        if (b.kind === "opening")
          for (const l of [...b.lines].sort((a, b) =>
            a.partId.localeCompare(b.partId),
          )) {
            const exists = await tx.query(
              "INSERT INTO opening_parts VALUES($1) ON CONFLICT DO NOTHING RETURNING part_id",
              [l.partId],
            );
            if (!exists.rowCount)
              throw new AppError(
                409,
                "Opening stock has already been recorded for this part.",
              );
          }
        const doc = randomUUID();
        await move(tx, req.actor, b.lines, b.kind, b.reason, doc);
        return { id: doc, posted: true };
      }),
    );
  });
}
