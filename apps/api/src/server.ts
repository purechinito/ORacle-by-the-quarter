import pg from "pg";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import staticFiles from "@fastify/static";
import { buildApp } from "./app";
import { migrate } from "./db";
if (!process.env.DATABASE_URL)
  throw Error("DATABASE_URL is required. See README.");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
await migrate(pool);
const app = await buildApp(pool);
if (existsSync("dist")) {
  await app.register(staticFiles, { root: resolve("dist") });
  app.setNotFoundHandler((req, reply) =>
    req.url.startsWith("/api/")
      ? reply.code(404).send({ error: "Not found" })
      : reply.sendFile("index.html"),
  );
}
await app.listen({
  host: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT ?? 3001),
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, async () => {
    await app.close();
    await pool.end();
    process.exit(0);
  });
