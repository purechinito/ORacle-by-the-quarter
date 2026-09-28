import {
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import type { Pool, PoolClient } from "pg";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { AppError, requireRole, transaction } from "./db";
const scrypt = promisify(scryptCb);
export const digest = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export type Actor = {
  id: string;
  username: string;
  role: "manager" | "counter" | "stock";
};
declare module "fastify" {
  interface FastifyRequest {
    actor: Actor;
    csrf: string;
  }
}
export async function createUser(
  pool: Pool | PoolClient,
  username: string,
  password: string,
  role: string,
) {
  const v = z
    .object({
      username: z.string().trim().min(2).max(80),
      password: z.string().min(12).max(200),
      role: z.enum(["manager", "counter", "stock"]),
    })
    .parse({ username, password, role });
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(v.password, salt, 64)) as Buffer;
  return (
    await pool.query(
      "INSERT INTO users(username,password_hash,role) VALUES($1,$2,$3) RETURNING id,username,role,active,version",
      [v.username, salt + ":" + hash.toString("hex"), v.role],
    )
  ).rows[0];
}
export async function authRoutes(app: FastifyInstance, pool: Pool) {
  app.decorateRequest("actor");
  app.decorateRequest("csrf", "");
  app.addHook("onRequest", async (req) => {
    if (!req.url.startsWith("/api/") || req.url.split("?")[0] === "/api/login")
      return;
    const row = (
      await pool.query(
        "SELECT u.id,u.username,u.role,s.csrf FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active",
        [digest(req.cookies.sid ?? "")],
      )
    ).rows[0];
    if (!row) throw new AppError(401, "Please sign in.");
    req.actor = { id: row.id, username: row.username, role: row.role };
    req.csrf = row.csrf;
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers["x-csrf-token"] !== row.csrf
    )
      throw new AppError(
        403,
        "Session verification failed. Reload and try again.",
      );
  });
  app.post(
    "/api/login",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const { username, password } = z
        .object({ username: z.string().max(80), password: z.string().max(200) })
        .parse(req.body);
      const user = (
        await pool.query("SELECT * FROM users WHERE username=$1 AND active", [
          username,
        ])
      ).rows[0];
      const [salt, stored] = (
        user?.password_hash ?? "dummy:" + Buffer.alloc(64).toString("hex")
      ).split(":");
      const derived = (await scrypt(password, salt, 64)) as Buffer;
      if (!user || !timingSafeEqual(derived, Buffer.from(stored, "hex")))
        throw new AppError(401, "Invalid username or password.");
      const token = randomBytes(32).toString("hex"),
        csrf = randomBytes(24).toString("hex");
      const signedIn = await transaction(pool, async (tx) => {
        const current = (
          await tx.query(
            "SELECT id,username,role FROM users WHERE id=$1 AND active AND password_hash=$2 FOR SHARE",
            [user.id, user.password_hash],
          )
        ).rows[0];
        if (!current) throw new AppError(401, "Invalid username or password.");
        await tx.query(
          "INSERT INTO sessions VALUES($1,$2,$3,now()+interval '8 hours')",
          [digest(token), current.id, csrf],
        );
        return current;
      });
      reply.setCookie("sid", token, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 28800,
      });
      return {
        user: signedIn,
        csrf,
      };
    },
  );
  app.get("/api/me", async (req) => ({ user: req.actor, csrf: req.csrf }));
  app.post("/api/logout", async (req, reply) => {
    await pool.query("DELETE FROM sessions WHERE token_hash=$1", [
      digest(req.cookies.sid ?? ""),
    ]);
    reply.clearCookie("sid", { path: "/" });
    return { ok: true };
  });
  app.get("/api/users", async (req) => {
    requireRole(req.actor.role, ["manager"]);
    return (
      await pool.query(
        "SELECT id,username,role,active,version FROM users ORDER BY username",
      )
    ).rows;
  });
  app.post("/api/users", async (req) => {
    requireRole(req.actor.role, ["manager"]);
    const b = req.body as any;
    return administer(pool, req.actor, async (tx) => {
      const user = await createUser(tx, b.username, b.password, b.role);
      await tx.query(
        "INSERT INTO audit_events(actor,action,record_id) VALUES($1,'user.created',$2)",
        [req.actor.id, user.id],
      );
      return user;
    });
  });
  app.put("/api/users/:id", async (req) => {
    requireRole(req.actor.role, ["manager"]);
    const userId = z
      .string()
      .uuid()
      .parse((req.params as any).id);
    const b = z
      .object({
        role: z.enum(["manager", "counter", "stock"]),
        active: z.boolean(),
        version: z.number().int().positive(),
        reason: z.string().trim().min(1).max(200),
      })
      .parse(req.body);
    return administer(pool, req.actor, async (tx) => {
      const old = (
        await tx.query(
          "SELECT id,username,role,active,version FROM users WHERE id=$1 FOR UPDATE",
          [userId],
        )
      ).rows[0];
      if (!old) throw new AppError(404, "Staff account not found.");
      if (old.version !== b.version)
        throw new AppError(409, "This account changed. Reload before saving.");
      if (userId === req.actor.id && (!b.active || b.role !== "manager"))
        throw new AppError(
          409,
          "Ask another manager to change your access; you cannot lock yourself out.",
        );
      if (
        old.active &&
        old.role === "manager" &&
        (!b.active || b.role !== "manager") &&
        Number(
          (
            await tx.query(
              "SELECT count(*) FROM users WHERE active AND role='manager'",
            )
          ).rows[0].count,
        ) <= 1
      )
        throw new AppError(409, "Keep at least one active manager.");
      const user = (
        await tx.query(
          "UPDATE users SET role=$1,active=$2,version=version+1 WHERE id=$3 RETURNING id,username,role,active,version",
          [b.role, b.active, userId],
        )
      ).rows[0];
      await tx.query("DELETE FROM sessions WHERE user_id=$1", [userId]);
      await tx.query(
        "INSERT INTO audit_events(actor,action,record_id,details) VALUES($1,'user.updated',$2,$3)",
        [
          req.actor.id,
          userId,
          JSON.stringify({
            previousRole: old.role,
            role: user.role,
            previousActive: old.active,
            active: user.active,
            reason: b.reason,
          }),
        ],
      );
      return user;
    });
  });
  app.post("/api/users/:id/password", async (req) => {
    requireRole(req.actor.role, ["manager"]);
    const userId = z
        .string()
        .uuid()
        .parse((req.params as any).id),
      b = z
        .object({
          password: z.string().min(12).max(200),
          reason: z.string().trim().min(1).max(200),
        })
        .parse(req.body);
    const salt = randomBytes(16).toString("hex"),
      hash = (await scrypt(b.password, salt, 64)) as Buffer;
    return administer(pool, req.actor, async (tx) => {
      const result = await tx.query(
        "UPDATE users SET password_hash=$1,version=version+1 WHERE id=$2 RETURNING id",
        [salt + ":" + hash.toString("hex"), userId],
      );
      if (!result.rowCount) throw new AppError(404, "Staff account not found.");
      await tx.query("DELETE FROM sessions WHERE user_id=$1", [userId]);
      await tx.query(
        "INSERT INTO audit_events(actor,action,record_id,details) VALUES($1,'user.password_reset',$2,$3)",
        [req.actor.id, userId, JSON.stringify({ reason: b.reason })],
      );
      return { ok: true };
    });
  });
  app.post("/api/users/:id/revoke-sessions", async (req) => {
    requireRole(req.actor.role, ["manager"]);
    const userId = z
        .string()
        .uuid()
        .parse((req.params as any).id),
      b = z
        .object({ reason: z.string().trim().min(1).max(200) })
        .parse(req.body);
    return administer(pool, req.actor, async (tx) => {
      if (
        !(
          await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
            userId,
          ])
        ).rowCount
      )
        throw new AppError(404, "Staff account not found.");
      await tx.query("DELETE FROM sessions WHERE user_id=$1", [userId]);
      await tx.query(
        "INSERT INTO audit_events(actor,action,record_id,details) VALUES($1,'user.sessions_revoked',$2,$3)",
        [req.actor.id, userId, JSON.stringify({ reason: b.reason })],
      );
      return { ok: true };
    });
  });
}

async function administer<T>(
  pool: Pool,
  actor: Actor,
  fn: (tx: PoolClient) => Promise<T>,
): Promise<T> {
  return transaction(pool, async (tx) => {
    await tx.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('staff-administration',0))",
    );
    const allowed = await tx.query(
      "SELECT id FROM users WHERE id=$1 AND active AND role='manager' FOR SHARE",
      [actor.id],
    );
    if (!allowed.rowCount)
      throw new AppError(
        403,
        "Your staff administration access changed. Sign in again.",
      );
    return fn(tx);
  });
}
