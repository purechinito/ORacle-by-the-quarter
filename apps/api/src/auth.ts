import {
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import type { Pool } from "pg";
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
  pool: Pool,
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
      "INSERT INTO users(username,password_hash,role) VALUES($1,$2,$3) RETURNING id,username,role",
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
      await pool.query(
        "INSERT INTO sessions VALUES($1,$2,$3,now()+interval '8 hours')",
        [digest(token), user.id, csrf],
      );
      reply.setCookie("sid", token, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 28800,
      });
      return {
        user: { id: user.id, username: user.username, role: user.role },
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
        "SELECT id,username,role,active FROM users ORDER BY username",
      )
    ).rows;
  });
  app.post("/api/users", async (req) => {
    requireRole(req.actor.role, ["manager"]);
    const b = req.body as any;
    const user = await createUser(pool, b.username, b.password, b.role);
    await pool.query(
      "INSERT INTO audit_events(actor,action,record_id) VALUES($1,'user.created',$2)",
      [req.actor.id, user.id],
    );
    return user;
  });
}
