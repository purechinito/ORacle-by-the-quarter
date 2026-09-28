import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import Decimal from "decimal.js";
import { AppError, requireRole, transaction } from "../db";
import { audit, id, key, money, once, text } from "./common";
import { journalRecord, postJournal } from "./ledger";
const date = z.iso.date();
const line = z
  .object({
    accountId: id,
    description: z.string().trim().max(300).default(""),
    debit: money.default("0.00"),
    credit: money.default("0.00"),
  })
  .refine(
    (l) =>
      (new Decimal(l.debit).gt(0) && new Decimal(l.credit).eq(0)) ||
      (new Decimal(l.credit).gt(0) && new Decimal(l.debit).eq(0)),
    "Use one positive debit or credit per line.",
  );
const draftSchema = z.object({
  id: id.optional(),
  key: key.optional(),
  date,
  memo: text,
  lines: z.array(line).min(2).max(500),
  currency: z.literal("PHP").default("PHP"),
  version: z.number().int().positive().optional(),
});
const paging = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
const range = paging
  .extend({ from: date.default("1900-01-01"), to: date.default("2200-12-31") })
  .refine((v) => v.from <= v.to, "Start date must not be after end date.");
export async function financeRoutes(app: FastifyInstance, pool: Pool) {
  app.addHook("preValidation", async (req) => {
    if (req.url.startsWith("/api/finance/"))
      requireRole(req.actor.role, ["manager"]);
  });
  app.get(
    "/api/finance/accounts",
    async () =>
      (await pool.query("SELECT * FROM gl_accounts ORDER BY code")).rows,
  );
  app.post("/api/finance/accounts", async (req) => {
    const b = z
      .object({
        code: z
          .string()
          .trim()
          .regex(/^[A-Za-z0-9-]{1,20}$/),
        name: text,
        type: z.enum(["asset", "liability", "equity", "income", "expense"]),
        active: z.boolean().default(true),
      })
      .parse(req.body);
    return transaction(pool, async (tx) => {
      const a = (
        await tx.query(
          "INSERT INTO gl_accounts(code,name,type,active,created_by) VALUES($1,$2,$3,$4,$5) RETURNING *",
          [b.code, b.name, b.type, b.active, req.actor.id],
        )
      ).rows[0];
      await audit(tx, req.actor, "account.created", a.id);
      return a;
    });
  });
  app.get(
    "/api/finance/periods",
    async () =>
      (
        await pool.query(
          "SELECT *,starts_on::text AS starts_on,ends_on::text AS ends_on FROM gl_periods ORDER BY starts_on DESC",
        )
      ).rows,
  );
  app.post("/api/finance/periods", async (req) => {
    const b = z
      .object({ name: text, from: date, to: date })
      .refine((x) => x.from <= x.to, "Period dates are reversed.")
      .parse(req.body);
    return transaction(pool, async (tx) => {
      const p = (
        await tx.query(
          "INSERT INTO gl_periods(name,starts_on,ends_on,changed_by) VALUES($1,$2,$3,$4) RETURNING *,starts_on::text AS starts_on,ends_on::text AS ends_on",
          [b.name, b.from, b.to, req.actor.id],
        )
      ).rows[0];
      await audit(tx, req.actor, "period.created", p.id);
      return p;
    });
  });
  for (const action of ["close", "reopen"] as const)
    app.post("/api/finance/periods/:id/" + action, async (req) => {
      const p = id.parse((req.params as any).id),
        b = z.object({ reason: text }).parse(req.body);
      return transaction(pool, async (tx) => {
        const old = (
          await tx.query("SELECT * FROM gl_periods WHERE id=$1 FOR UPDATE", [p])
        ).rows[0];
        if (!old) throw new AppError(404, "Period not found.");
        const next = action === "close" ? "closed" : "open";
        if (old.status === next)
          throw new AppError(409, "Period is already " + next + ".");
        const result = (
          await tx.query(
            "UPDATE gl_periods SET status=$1,changed_by=$2,changed_at=now(),reason=$3 WHERE id=$4 RETURNING *,starts_on::text AS starts_on,ends_on::text AS ends_on",
            [next, req.actor.id, b.reason, p],
          )
        ).rows[0];
        await tx.query(
          "INSERT INTO audit_events(actor,action,record_id,details) VALUES($1,$2,$3,$4)",
          [
            req.actor.id,
            "period." + action,
            p,
            JSON.stringify({ reason: b.reason, status: next }),
          ],
        );
        return result;
      });
    });
  app.get("/api/finance/journals", async (req) => {
    const q = paging
      .extend({
        status: z.enum(["", "draft", "posted"]).default(""),
        q: z.string().max(200).default(""),
      })
      .parse(req.query);
    const where =
      "($1='' OR j.status=$1) AND ($2='' OR position(lower($2) in lower(j.memo||' '||j.id::text))>0)";
    const total = Number(
      (
        await pool.query("SELECT count(*) FROM gl_journals j WHERE " + where, [
          q.status,
          q.q,
        ])
      ).rows[0].count,
    );
    const items = (
      await pool.query(
        "SELECT j.*,j.journal_date::text AS journal_date,(SELECT sum(debit)::numeric(16,2)::text FROM gl_journal_lines WHERE journal_id=j.id) AS total,(SELECT id FROM gl_journals r WHERE r.reverses_id=j.id) AS reversal_id FROM gl_journals j WHERE " +
          where +
          " ORDER BY j.journal_date DESC,j.created_at DESC,j.id LIMIT $3 OFFSET $4",
        [q.status, q.q, q.limit, (q.page - 1) * q.limit],
      )
    ).rows;
    return {
      items,
      total,
      page: q.page,
      limit: q.limit,
      basis: "Manual journals only",
    };
  });
  app.get("/api/finance/journals/:id", async (req) =>
    transaction(pool, (tx) =>
      journalRecord(tx, id.parse((req.params as any).id)),
    ),
  );
  for (const method of ["POST", "PUT"] as const)
    app.route({
      method,
      url: "/api/finance/journals" + (method === "PUT" ? "/:id" : ""),
      handler: async (req) => {
        const b = draftSchema.parse(req.body),
          journalId =
            method === "PUT" ? id.parse((req.params as any).id) : b.id;
        return transaction(pool, async (tx) => {
          const save = async () => {
            if (journalId) {
              const old = (
                await tx.query(
                  "SELECT * FROM gl_journals WHERE id=$1 FOR UPDATE",
                  [journalId],
                )
              ).rows[0];
              if (!old || old.status !== "draft")
                throw new AppError(409, "Only draft journals can be edited.");
              if (old.version !== b.version)
                throw new AppError(
                  409,
                  "Journal changed. Reload before saving.",
                );
            }
            const accountIds = [
              ...new Set(b.lines.map((l) => l.accountId)),
            ].sort();
            const accounts = (
              await tx.query(
                "SELECT id FROM gl_accounts WHERE id=ANY($1::uuid[]) AND active ORDER BY id FOR SHARE",
                [accountIds],
              )
            ).rows;
            if (accounts.length !== accountIds.length)
              throw new AppError(
                409,
                "Choose existing active accounts for every line.",
              );
            const journal = journalId
              ? (
                  await tx.query(
                    "UPDATE gl_journals SET journal_date=$1,memo=$2,version=version+1 WHERE id=$3 RETURNING id",
                    [b.date, b.memo, journalId],
                  )
                ).rows[0]
              : (
                  await tx.query(
                    "INSERT INTO gl_journals(journal_date,memo,created_by) VALUES($1,$2,$3) RETURNING id",
                    [b.date, b.memo, req.actor.id],
                  )
                ).rows[0];
            if (journalId)
              await tx.query(
                "DELETE FROM gl_journal_lines WHERE journal_id=$1",
                [journal.id],
              );
            for (const [i, l] of b.lines.entries())
              await tx.query(
                "INSERT INTO gl_journal_lines(journal_id,line_no,account_id,description,debit,credit) VALUES($1,$2,$3,$4,$5,$6)",
                [
                  journal.id,
                  i + 1,
                  l.accountId,
                  l.description,
                  l.debit,
                  l.credit,
                ],
              );
            await audit(tx, req.actor, "journal.saved", journal.id);
            return journalRecord(tx, journal.id);
          };
          return b.key
            ? once(
                tx,
                req.actor,
                "journal.save",
                b.key,
                { journalId: journalId ?? null, ...b },
                save,
              )
            : save();
        });
      },
    });
  app.post("/api/finance/journals/:id/post", async (req) => {
    const p = id.parse((req.params as any).id),
      b = z.object({ key }).parse(req.body);
    return transaction(pool, (tx) =>
      once(tx, req.actor, "journal.post", b.key, { p }, () =>
        postJournal(tx, req.actor, p),
      ),
    );
  });
  app.post("/api/finance/journals/:id/reverse", async (req) => {
    const p = id.parse((req.params as any).id),
      b = z.object({ key, date, reason: text }).parse(req.body);
    return transaction(pool, (tx) =>
      once(tx, req.actor, "journal.reverse", b.key, { p, ...b }, async () => {
        const original = (
          await tx.query(
            "SELECT *,journal_date::text AS journal_date FROM gl_journals WHERE id=$1 FOR UPDATE",
            [p],
          )
        ).rows[0];
        if (!original || original.status !== "posted")
          throw new AppError(409, "Only posted journals can be reversed.");
        if (original.reverses_id)
          throw new AppError(
            409,
            "A reversal cannot itself be reversed; create a reviewed correction journal.",
          );
        if (
          (
            await tx.query("SELECT 1 FROM gl_journals WHERE reverses_id=$1", [
              p,
            ])
          ).rowCount
        )
          throw new AppError(409, "Journal already has a reversal.");
        if (b.date < original.journal_date)
          throw new AppError(
            400,
            "Reversal date cannot precede the original journal.",
          );
        const j = (
          await tx.query(
            "INSERT INTO gl_journals(journal_date,memo,created_by,reverses_id) VALUES($1,$2,$3,$4) RETURNING id",
            [b.date, b.reason, req.actor.id, p],
          )
        ).rows[0];
        await tx.query(
          "INSERT INTO gl_journal_lines(journal_id,line_no,account_id,description,debit,credit) SELECT $1,line_no,account_id,description,credit,debit FROM gl_journal_lines WHERE journal_id=$2",
          [j.id, p],
        );
        const result = await postJournal(tx, req.actor, j.id);
        await audit(tx, req.actor, "journal.reversed", p);
        return result;
      }),
    );
  });
  app.get("/api/finance/trial-balance", async (req) => {
    const q = range.parse(req.query);
    const rows = (
      await pool.query(
        "SELECT a.id,a.code,a.name,a.type,COALESCE(sum(CASE WHEN j.journal_date<$1::date THEN l.debit-l.credit ELSE 0 END),0)::text AS opening,COALESCE(sum(CASE WHEN j.journal_date BETWEEN $1::date AND $2::date THEN l.debit ELSE 0 END),0)::text AS debit,COALESCE(sum(CASE WHEN j.journal_date BETWEEN $1::date AND $2::date THEN l.credit ELSE 0 END),0)::text AS credit FROM gl_accounts a LEFT JOIN (gl_journal_lines l JOIN gl_journals j ON j.id=l.journal_id AND j.status='posted' AND j.journal_date<=$2::date) ON l.account_id=a.id GROUP BY a.id ORDER BY a.code",
        [q.from, q.to],
      )
    ).rows;
    const items = rows.map((r) => {
      const o = new Decimal(r.opening),
        d = new Decimal(r.debit),
        c = new Decimal(r.credit),
        end = o.add(d).sub(c);
      return {
        id: r.id,
        code: r.code,
        name: r.name,
        type: r.type,
        openingDebit: Decimal.max(o, 0).toFixed(2),
        openingCredit: Decimal.max(o.neg(), 0).toFixed(2),
        debit: d.toFixed(2),
        credit: c.toFixed(2),
        closingDebit: Decimal.max(end, 0).toFixed(2),
        closingCredit: Decimal.max(end.neg(), 0).toFixed(2),
      };
    });
    const totals = Object.fromEntries(
      [
        "openingDebit",
        "openingCredit",
        "debit",
        "credit",
        "closingDebit",
        "closingCredit",
      ].map((k) => [
        k,
        items.reduce((n, r) => n.add((r as any)[k]), new Decimal(0)).toFixed(2),
      ]),
    );
    return {
      items,
      totals,
      from: q.from,
      to: q.to,
      currency: "PHP",
      basis:
        "Manual journals only; sales, purchases and stock are not automatically posted.",
    };
  });
  app.get("/api/finance/ledger", async (req) => {
    const q = range.parse(req.query),
      accountId = id.parse((req.query as any).accountId);
    const where =
      "j.status='posted' AND l.account_id=$1 AND j.journal_date BETWEEN $2::date AND $3::date";
    const total = Number(
      (
        await pool.query(
          "SELECT count(*) FROM gl_journal_lines l JOIN gl_journals j ON j.id=l.journal_id WHERE " +
            where,
          [accountId, q.from, q.to],
        )
      ).rows[0].count,
    );
    const items = (
      await pool.query(
        "SELECT j.id,j.journal_date::text,j.memo,j.reverses_id,l.description,l.debit,l.credit,l.line_no FROM gl_journal_lines l JOIN gl_journals j ON j.id=l.journal_id WHERE " +
          where +
          " ORDER BY j.journal_date,j.created_at,j.id,l.line_no LIMIT $4 OFFSET $5",
        [accountId, q.from, q.to, q.limit, (q.page - 1) * q.limit],
      )
    ).rows;
    return { items, total, page: q.page, limit: q.limit, currency: "PHP" };
  });
}
