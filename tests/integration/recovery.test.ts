import { beforeAll, afterAll, test, expect } from "vitest";
import pg from "pg";
import { setup } from "./support";
import { migrate } from "../../apps/api/src/db";
import { snapshot, restoreSnapshot } from "../../scripts/snapshot";
let t: Awaited<ReturnType<typeof setup>>;
beforeAll(async () => {
  t = await setup();
});
afterAll(async () => {
  await t?.close();
});
test("backup restores documents and stock into an empty database and rejects overwrite", async () => {
  const m = await t.login();
  const p = await t.request(m, "POST", "/api/parts", {
    sku: "BACKUP-1",
    name: "Restore test",
    price: "12.50",
  });
  await t.request(m, "POST", "/api/stock", {
    kind: "opening",
    key: crypto.randomUUID(),
    reason: "Opening",
    lines: [{ partId: p.json().id, qty: 7 }],
  });
  await t.request(m, "POST", "/api/settings", {
    shopName: "Restore shop",
    currency: "USD",
    taxMode: "none",
    taxRate: "0",
    timezone: "UTC",
  });
  const sale = await t.request(m, "POST", "/api/carts", {
    lines: [{ partId: p.json().id, qty: 3 }],
  });
  expect(
    (
      await t.request(m, "POST", "/api/sales/" + sale.json().id + "/post", {
        key: crypto.randomUUID(),
        payment: "37.50",
        method: "cash",
      })
    ).statusCode,
  ).toBe(200);
  expect(
    (
      await t.request(m, "POST", "/api/sales/" + sale.json().id + "/return", {
        key: crypto.randomUUID(),
        reason: "Recovery fixture",
        refundStatus: "pending",
        lines: [{ partId: p.json().id, qty: 1, restock: true }],
      })
    ).statusCode,
  ).toBe(200);
  const copy = await snapshot(t.pool);
  expect(copy.tables.parts).toHaveLength(1);
  expect(copy.tables.sessions).toBeUndefined();
  await t.pool.query("CREATE DATABASE restore_check");
  const pool = new pg.Pool({
    ...t.pool.options,
    password: t.password,
    database: "restore_check",
  });
  try {
    await migrate(pool);
    await restoreSnapshot(pool, copy);
    expect((await pool.query("SELECT sku,stock FROM parts")).rows).toEqual([
      { sku: "BACKUP-1", stock: 5 },
    ]);
    expect(
      (await pool.query("SELECT sum(qty)::int AS n FROM movements")).rows[0].n,
    ).toBe(5);
    expect(
      (await pool.query("SELECT count(*)::int AS n FROM users")).rows[0].n,
    ).toBe(3);
    expect((await pool.query("SELECT status,total FROM sales")).rows).toEqual([
      { status: "posted", total: "37.50" },
    ]);
    expect((await pool.query("SELECT amount FROM payments")).rows).toEqual([
      { amount: "37.50" },
    ]);
    expect(
      (await pool.query("SELECT refund_status FROM returns")).rows,
    ).toEqual([{ refund_status: "pending" }]);
    await expect(restoreSnapshot(pool, copy)).rejects.toThrow("empty");
  } finally {
    await pool.end();
  }
});
