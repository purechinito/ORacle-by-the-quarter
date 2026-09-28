import type { FastifyInstance } from "fastify";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import { parse } from "csv-parse/sync";
import { AppError, requireRole, transaction } from "../db";
import { audit, id, money, text } from "./common";
const normalize = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
const fit = z
  .object({
    make: text,
    model: text,
    from: z.number().int().min(1900).max(2200),
    to: z.number().int().min(1900).max(2200),
    engine: z.string().max(100).default(""),
  })
  .refine((x) => x.from <= x.to, "Invalid year range");
const schema = z.object({
  sku: text,
  name: text,
  brand: z.string().max(100).default(""),
  category: z.string().max(100).default(""),
  price: money,
  reorder: z.number().int().min(0).max(1000000).default(0),
  bin: z.string().max(100).default(""),
  active: z.boolean().default(true),
  aliases: z.array(text).max(50).default([]),
  fitments: z.array(fit).max(200).default([]),
  substitutes: z.array(id).max(50).default([]),
});
async function save(tx: PoolClient, input: unknown, partId?: string) {
  const p = schema.parse(input);
  if (
    p.substitutes.includes(partId ?? "") ||
    new Set(p.substitutes).size !== p.substitutes.length
  )
    throw new AppError(
      400,
      "Substitutes must be distinct parts, excluding this part.",
    );
  if (
    p.substitutes.length &&
    (
      await tx.query("SELECT id FROM parts WHERE id=ANY($1::uuid[])", [
        p.substitutes,
      ])
    ).rowCount !== p.substitutes.length
  )
    throw new AppError(400, "A substitute part does not exist.");
  const search = normalize([p.sku, p.name, p.brand, ...p.aliases].join(" "));
  const vals = [
    p.sku,
    p.name,
    p.brand,
    p.category,
    p.price,
    p.reorder,
    p.bin,
    p.active,
    JSON.stringify(p.aliases),
    JSON.stringify(p.fitments),
    JSON.stringify(p.substitutes),
    search,
  ];
  if (partId) {
    const r = await tx.query(
      "UPDATE parts SET sku=$1,name=$2,brand=$3,category=$4,price=$5,reorder=$6,bin=$7,active=$8,aliases=$9,fitments=$10,substitutes=$11,search_key=$12 WHERE id=$13 RETURNING *",
      [...vals, partId],
    );
    if (!r.rowCount) throw new AppError(404, "Part not found.");
    return r.rows[0];
  }
  return (
    await tx.query(
      "INSERT INTO parts(sku,name,brand,category,price,reorder,bin,active,aliases,fitments,substitutes,search_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *",
      vals,
    )
  ).rows[0];
}
export async function catalogRoutes(app: FastifyInstance, pool: Pool) {
  app.get("/api/parts", async (req) => {
    const q = z
      .object({
        q: z.string().max(200).default(""),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(25),
        active: z.enum(["true", "false", "all"]).default("true"),
        category: z.string().default(""),
        make: z.string().default(""),
        model: z.string().default(""),
        year: z.coerce.number().int().optional(),
      })
      .parse(req.query);
    const where =
      "search_key LIKE $1 AND ($2='all' OR active=($2='true')) AND ($3='' OR category=$3) AND ($4='' AND $5='' AND $6::int IS NULL OR EXISTS(SELECT 1 FROM jsonb_array_elements(fitments) f WHERE ($4='' OR lower(f->>'make')=lower($4)) AND ($5='' OR lower(f->>'model')=lower($5)) AND ($6::int IS NULL OR $6 BETWEEN (f->>'from')::int AND (f->>'to')::int)))";
    const args = [
      "%" + normalize(q.q) + "%",
      q.active,
      q.category,
      q.make,
      q.model,
      q.year ?? null,
    ];
    const total = Number(
      (await pool.query("SELECT count(*) FROM parts WHERE " + where, args))
        .rows[0].count,
    );
    const items = (
      await pool.query(
        "SELECT * FROM parts WHERE " +
          where +
          " ORDER BY sku LIMIT $7 OFFSET $8",
        [...args, q.limit, (q.page - 1) * q.limit],
      )
    ).rows;
    return { items, total, page: q.page, limit: q.limit };
  });
  app.get("/api/parts/:id/substitutes", async (req) => {
    const p = id.parse((req.params as any).id);
    return (
      await pool.query(
        "SELECT p.* FROM parts p JOIN parts source ON source.id=$1 WHERE source.substitutes ? p.id::text ORDER BY p.sku",
        [p],
      )
    ).rows;
  });
  for (const method of ["POST", "PUT"] as const)
    app.route({
      method,
      url: "/api/parts" + (method === "PUT" ? "/:id" : ""),
      handler: async (req) => {
        requireRole(req.actor.role, ["manager"]);
        return transaction(pool, async (tx) => {
          const p = await save(
            tx,
            req.body,
            method === "PUT" ? id.parse((req.params as any).id) : undefined,
          );
          await audit(tx, req.actor, "part.saved", p.id);
          return p;
        });
      },
    });
  app.post("/api/import/preview", async (req) => {
    requireRole(req.actor.role, ["manager"]);
    const { csv } = z.object({ csv: z.string().max(4000000) }).parse(req.body);
    let raw: any[];
    try {
      raw = parse(csv, { columns: true, skip_empty_lines: true, bom: true });
    } catch {
      throw new AppError(
        400,
        "CSV could not be parsed. Check quotes and columns.",
      );
    }
    if (raw.length > 10000)
      throw new AppError(400, "Import at most 10,000 rows per batch.");
    const rows: any[] = [],
      errors: string[] = [],
      seen = new Set<string>();
    const all = (await pool.query("SELECT sku,aliases FROM parts")).rows;
    const existing = new Set(all.map((x) => x.sku));
    const usedAliases = new Set<string>(
      all.flatMap((x) => x.aliases.map((a: string) => a.trim().toLowerCase())),
    );
    raw.forEach((r, i) => {
      const v = schema.safeParse({
        ...r,
        reorder: r.reorder ? Number(r.reorder) : 0,
        aliases: r.aliases ? r.aliases.split("|") : [],
      });
      if (!v.success) {
        errors.push(
          "Row " +
            (i + 2) +
            ": " +
            v.error.issues.map((x) => x.path + ": " + x.message).join(", "),
        );
        return;
      }
      if (seen.has(v.data.sku) || existing.has(v.data.sku))
        errors.push("Row " + (i + 2) + ": duplicate SKU " + v.data.sku);
      seen.add(v.data.sku);
      for (const alias of v.data.aliases) {
        const k = alias.trim().toLowerCase();
        if (usedAliases.has(k))
          errors.push("Row " + (i + 2) + ": alias conflict " + alias);
        usedAliases.add(k);
      }
      rows.push(v.data);
    });
    if (!rows.length) errors.push("No valid rows.");
    const r = (
      await pool.query(
        "INSERT INTO import_previews(actor,rows,errors) VALUES($1,$2,$3) RETURNING id",
        [req.actor.id, JSON.stringify(rows), JSON.stringify(errors)],
      )
    ).rows[0];
    return { ...r, count: rows.length, errors, preview: rows.slice(0, 5) };
  });
  app.post("/api/import/commit", async (req) => {
    requireRole(req.actor.role, ["manager"]);
    const b = z.object({ id }).parse(req.body);
    return transaction(pool, async (tx) => {
      const p = (
        await tx.query(
          "SELECT * FROM import_previews WHERE id=$1 AND actor=$2 AND kind='catalog' FOR UPDATE",
          [b.id, req.actor.id],
        )
      ).rows[0];
      if (!p) throw new AppError(404, "Preview not found.");
      if (p.result) return p.result;
      if (p.errors.length)
        throw new AppError(400, "Resolve the import errors first.");
      if (new Date(p.expires_at) < new Date())
        throw new AppError(409, "Import preview expired.");
      for (const row of p.rows) await save(tx, row);
      const result = { count: p.rows.length };
      await tx.query("UPDATE import_previews SET result=$1 WHERE id=$2", [
        JSON.stringify(result),
        p.id,
      ]);
      await audit(tx, req.actor, "catalog.imported", p.id);
      return result;
    });
  });
}
