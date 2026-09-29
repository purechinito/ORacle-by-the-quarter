import Fastify from "fastify";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import type { Pool } from "pg";
import { ZodError } from "zod";
import { authRoutes } from "./auth";
import { openingImportRoutes } from "./modules/opening-import";
import { catalogRoutes } from "./modules/catalog";
import { inventoryRoutes } from "./modules/inventory";
import { purchasingRoutes } from "./modules/purchasing";
import { salesRoutes } from "./modules/sales";
import { relationshipRoutes } from "./modules/relationships";
import { financeRoutes } from "./modules/finance";
import { reportsRoutes } from "./modules/reports";
import { assertPesoCurrency } from "./currency";
export async function buildApp(pool: Pool) {
  const app = Fastify({ bodyLimit: 5 * 1024 * 1024, logger: false });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  app.setErrorHandler((err, req, reply) => {
    const e = err as any;
    const status =
      e instanceof ZodError
        ? 400
        : e.code === "23P01"
          ? 409
          : e.code === "23514"
            ? 400
            : e.code === "23505"
              ? 409
              : e.code === "23503"
                ? 400
                : (e.statusCode ?? 500);
    reply.code(status).send({
      error:
        status === 500
          ? "Unexpected server error."
          : e instanceof ZodError
            ? e.issues
                .map((x: any) => x.path.join(".") + ": " + x.message)
                .join("; ")
            : e.code === "23P01"
              ? "These dates overlap an existing accounting period. Choose a separate date range."
              : e.code === "23514"
                ? "This change violates a record rule. Check the amounts, dates and linked records."
                : e.code === "23505"
                  ? "This record already exists."
                  : e.code === "23503"
                    ? "Referenced record does not exist."
                    : e.message,
    });
  });
  await authRoutes(app, pool);
  app.addHook("preValidation", async (req) => {
    if (
      req.url.startsWith("/api/") &&
      !["GET", "HEAD", "OPTIONS"].includes(req.method)
    )
      assertPesoCurrency(req.body);
  });
  await catalogRoutes(app, pool);
  await inventoryRoutes(app, pool);
  await openingImportRoutes(app, pool);
  await purchasingRoutes(app, pool);
  await relationshipRoutes(app, pool);
  await salesRoutes(app, pool);
  await reportsRoutes(app, pool);
  await financeRoutes(app, pool);
  return app;
}
