import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "vite";
import { migrate } from "../apps/api/src/db";
import { createUser } from "../apps/api/src/auth";
import { seedDemo } from "./seed-demo";
await mkdir(".data", { recursive: true });
let credentials: any;
try {
  credentials = JSON.parse(
    await readFile(".data/dev-credentials.json", "utf8"),
  );
} catch {
  credentials = {
    username: "owner",
    password: randomBytes(18).toString("base64url"),
    dbPassword: randomBytes(24).toString("hex"),
  };
  await writeFile(".data/dev-credentials.json", JSON.stringify(credentials), {
    mode: 0o600,
  });
}
const db = new EmbeddedPostgres({
  databaseDir: ".data/postgres",
  port: 15432,
  user: "postgres",
  password: credentials.dbPassword,
  persistent: true,
  onLog: () => {},
  onError: () => {},
});
try {
  await access(".data/postgres/PG_VERSION");
} catch {
  await db.initialise();
}
await db.start();
const url = `postgresql://postgres:${credentials.dbPassword}@127.0.0.1:15432/postgres`;
const pool = new pg.Pool({ connectionString: url });
await migrate(pool);
if (!(await pool.query("SELECT 1 FROM users")).rowCount) {
  const owner = await createUser(
    pool,
    credentials.username,
    credentials.password,
    "manager",
  );
  await seedDemo(pool, owner.id);
}
await pool.end();
const child = spawn(
  process.execPath,
  ["--import", "tsx", "apps/api/src/server.ts"],
  { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } },
);
const vite = await createServer();
await vite.listen();
console.log(
  "Quarter preview: http://127.0.0.1:5173 — local login is in .data/dev-credentials.json. Synthetic catalog only; PHP and Philippine time are fixed. Confirm VAT treatment before sales.",
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  child.kill("SIGTERM");
  await vite.close();
  await db.stop();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
