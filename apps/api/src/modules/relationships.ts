import type { FastifyInstance } from "fastify";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import type { Actor } from "../auth";
import { AppError, requireRole, transaction } from "../db";
import { id, money, text } from "./common";
const kindSchema = z.enum(["customers", "suppliers"]);
type Kind = z.infer<typeof kindSchema>;
const optionalText = z.string().trim().max(200).default("");
const profileSchema = z.object({
  name: text,
  phone: optionalText,
  email: z.union([z.literal(""), z.email().max(200)]).default(""),
  contactName: optionalText,
  partyType: z.enum(["company", "individual"]).default("company"),
  tin: z.string().trim().max(80).default(""),
  address: z
    .object({
      street: optionalText,
      barangay: optionalText,
      city: optionalText,
      province: optionalText,
      postalCode: z.string().trim().max(20).default(""),
    })
    .default({
      street: "",
      barangay: "",
      city: "",
      province: "",
      postalCode: "",
    }),
  termsDays: z.number().int().min(0).max(365).default(0),
  creditLimit: money.default("0.00"),
  notes: z.string().trim().max(2000).default(""),
  active: z.boolean().default(true),
  version: z.number().int().positive().optional(),
});
const listQuery = z.object({
  q: z.string().trim().max(200).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  active: z.enum(["true", "false", "all"]).default("true"),
});
function canRead(actor: Actor, kind: Kind) {
  requireRole(
    actor.role,
    kind === "customers" ? ["manager", "counter"] : ["manager", "stock"],
  );
}
function present(p: any, actor: Actor) {
  if (actor.role === "manager") return p;
  const { tin, notes, credit_limit, terms_days, ...safe } = p;
  return safe;
}
export async function requireActiveParty(
  tx: PoolClient,
  kind: Kind,
  partyId: string | null | undefined,
) {
  if (!partyId) return;
  const p = (
    await tx.query("SELECT active FROM " + kind + " WHERE id=$1 FOR SHARE", [
      partyId,
    ])
  ).rows[0];
  if (!p?.active)
    throw new AppError(
      409,
      kind === "customers"
        ? "Customer is unavailable or inactive."
        : "Supplier is unavailable or inactive.",
    );
}
async function list(pool: Pool, actor: Actor, kind: Kind, query: unknown) {
  canRead(actor, kind);
  const q = listQuery.parse(query);
  const where =
    "($1='' OR position(lower($1) in lower(name||' '||phone||' '||email||' '||contact_name))>0) AND ($2='all' OR active=($2='true'))";
  const total = Number(
    (
      await pool.query("SELECT count(*) FROM " + kind + " WHERE " + where, [
        q.q,
        q.active,
      ])
    ).rows[0].count,
  );
  const items = (
    await pool.query(
      "SELECT * FROM " +
        kind +
        " WHERE " +
        where +
        " ORDER BY lower(name),id LIMIT $3 OFFSET $4",
      [q.q, q.active, q.limit, (q.page - 1) * q.limit],
    )
  ).rows.map((p) => present(p, actor));
  return { items, total, page: q.page, limit: q.limit };
}
async function save(
  pool: Pool,
  actor: Actor,
  kind: Kind,
  input: unknown,
  partyId?: string,
) {
  requireRole(
    actor.role,
    kind === "customers" && !partyId ? ["manager", "counter"] : ["manager"],
  );
  if (
    actor.role !== "manager" &&
    input &&
    typeof input === "object" &&
    ["tin", "termsDays", "creditLimit", "notes", "active"].some((k) =>
      Object.hasOwn(input, k),
    )
  )
    throw new AppError(
      403,
      "Only managers can set account controls or private identifiers.",
    );
  const p = profileSchema.parse(input);
  if (partyId && !p.version)
    throw new AppError(400, "Reload the record before editing.");
  return transaction(pool, async (tx) => {
    const vals = [
      p.name,
      p.phone,
      p.email,
      p.contactName,
      p.partyType,
      p.tin,
      JSON.stringify(p.address),
      p.termsDays,
      p.creditLimit,
      p.notes,
      p.active,
    ];
    let before: any = null;
    if (partyId) {
      before = (
        await tx.query("SELECT * FROM " + kind + " WHERE id=$1 FOR UPDATE", [
          partyId,
        ])
      ).rows[0];
      if (!before) throw new AppError(404, "Record not found.");
      if (before.version !== p.version)
        throw new AppError(
          409,
          "This record changed. Reload it before saving.",
        );
    }
    const row = (
      partyId
        ? await tx.query(
            "UPDATE " +
              kind +
              " SET name=$1,phone=$2,email=$3,contact_name=$4,party_type=$5,tin=$6,address=$7,terms_days=$8,credit_limit=$9,notes=$10,active=$11,version=version+1,updated_at=now() WHERE id=$12 RETURNING *",
            [...vals, partyId],
          )
        : await tx.query(
            "INSERT INTO " +
              kind +
              "(name,phone,email,contact_name,party_type,tin,address,terms_days,credit_limit,notes,active) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *",
            vals,
          )
    ).rows[0];
    await tx.query(
      "INSERT INTO audit_events(actor,action,record_id,details) VALUES($1,$2,$3,$4)",
      [
        actor.id,
        (kind === "customers" ? "customer" : "supplier") +
          (partyId ? ".updated" : ".created"),
        row.id,
        JSON.stringify({
          version: row.version,
          changedFields: before
            ? Object.keys(row).filter(
                (k) =>
                  !["updated_at", "version"].includes(k) &&
                  JSON.stringify(before[k]) !== JSON.stringify(row[k]),
              )
            : ["profile"],
          previousActive: before?.active,
          active: row.active,
        }),
      ],
    );
    return present(row, actor);
  });
}
export async function relationshipRoutes(app: FastifyInstance, pool: Pool) {
  for (const kind of ["customers", "suppliers"] as const) {
    app.get(
      "/api/" + kind,
      async (req) => (await list(pool, req.actor, kind, req.query)).items,
    );
    app.post("/api/" + kind, async (req) =>
      save(pool, req.actor, kind, req.body),
    );
  }
  app.get("/api/parties/:kind", async (req) =>
    list(
      pool,
      req.actor,
      kindSchema.parse((req.params as any).kind),
      req.query,
    ),
  );
  app.post("/api/parties/:kind", async (req) =>
    save(pool, req.actor, kindSchema.parse((req.params as any).kind), req.body),
  );
  app.put("/api/parties/:kind/:id", async (req) =>
    save(
      pool,
      req.actor,
      kindSchema.parse((req.params as any).kind),
      req.body,
      id.parse((req.params as any).id),
    ),
  );
  app.get("/api/parties/:kind/:id", async (req) => {
    const kind = kindSchema.parse((req.params as any).kind),
      p = id.parse((req.params as any).id),
      q = listQuery.parse(req.query);
    canRead(req.actor, kind);
    const profile = (
      await pool.query("SELECT * FROM " + kind + " WHERE id=$1", [p])
    ).rows[0];
    if (!profile) throw new AppError(404, "Record not found.");
    const customer = kind === "customers";
    const where = customer
      ? "customer_id=$1 AND ($2='manager' OR actor=$3)"
      : "supplier_id=$1";
    const args = customer ? [p, req.actor.role, req.actor.id] : [p];
    const table = customer ? "sales" : "purchases";
    const total = Number(
      (
        await pool.query(
          "SELECT count(*) FROM " + table + " WHERE " + where,
          args,
        )
      ).rows[0].count,
    );
    const columns = customer
      ? "id,status,created_at,total,currency"
      : req.actor.role === "manager"
        ? "id,status,created_at,currency,(SELECT sum(qty*cost)::numeric(14,2)::text FROM purchase_lines WHERE purchase_id=purchases.id) AS total"
        : "id,status,created_at,currency";
    const items = (
      await pool.query(
        "SELECT " +
          columns +
          " FROM " +
          table +
          " WHERE " +
          where +
          " ORDER BY created_at DESC,id DESC LIMIT $" +
          (args.length + 1) +
          " OFFSET $" +
          (args.length + 2),
        [...args, q.limit, (q.page - 1) * q.limit],
      )
    ).rows;
    return {
      profile: present(profile, req.actor),
      history: { items, total, page: q.page, limit: q.limit },
    };
  });
}
