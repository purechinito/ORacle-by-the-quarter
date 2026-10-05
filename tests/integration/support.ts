import EmbeddedPostgres from "embedded-postgres";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import pg from "pg";
import { buildApp } from "../../apps/api/src/app";
import { migrate } from "../../apps/api/src/db";
import { createUser } from "../../apps/api/src/auth";
export async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "quarter-test-"));
  const port = 19000 + Math.floor(Math.random() * 10000);
  const password = randomBytes(20).toString("hex");
  const db = new EmbeddedPostgres({
    databaseDir: dir,
    port,
    user: "postgres",
    password,
    persistent: false,
    onLog: () => {},
    onError: () => {},
  });
  await db.initialise();
  await db.start();
  const pool = new pg.Pool({
    host: "127.0.0.1",
    port,
    user: "postgres",
    password,
    database: "postgres",
  });
  await migrate(pool);
  for (const role of ["manager", "counter", "stock"] as const)
    await createUser(pool, role, password, role);
  const app = await buildApp(pool);
  async function login(username = "manager") {
    const r = await app.inject({
      method: "POST",
      url: "/api/login",
      payload: { username, password },
    });
    if (r.statusCode !== 200) throw Error(r.body);
    return {
      cookie: r.headers["set-cookie"]!.toString().split(";")[0],
      "x-csrf-token": r.json().csrf,
    };
  }
  async function request(
    headers: Record<string, string>,
    method: any,
    url: string,
    payload?: any,
  ) {
    return app.inject({ method, url, headers, payload });
  }
  return {
    app,
    pool,
    password,
    login,
    request,
    close: async () => {
      await app.close();
      await pool.end();
      await db.stop();
      await rm(dir, { recursive: true, force: true });
    },
  };
}
