import { beforeAll, afterAll, test, expect } from "vitest";
import { setup } from "./support";
let t: Awaited<ReturnType<typeof setup>>, m: Record<string, string>;
beforeAll(async () => {
  t = await setup();
  m = await t.login();
});
afterAll(async () => {
  await t?.close();
});
const post = (u: string, b: any) => t.request(m, "POST", u, b);
test("imports 5000 synthetic parts with bounded indexed search results", async () => {
  const csv =
    "sku,name,price,aliases\n" +
    Array.from(
      { length: 5000 },
      (_, i) => `LOAD-${i},Synthetic part ${i},0.10,BC${i}`,
    ).join("\n");
  const p = await post("/api/import/preview", { csv });
  expect(p.statusCode).toBe(200);
  expect(p.json().count).toBe(5000);
  expect(
    (await post("/api/import/commit", { id: p.json().id })).statusCode,
  ).toBe(200);
  const r = await t.request(m, "GET", "/api/parts?q=LOAD&limit=25");
  expect(r.json().items).toHaveLength(25);
  expect(r.json().total).toBe(5000);
  expect(
    (await t.request(m, "GET", "/api/parts?q=BC4999")).json().items[0].sku,
  ).toBe("LOAD-4999");
});
test("import detects alias conflicts against existing parts and within the batch", async () => {
  const p = await post("/api/import/preview", {
    csv: "sku,name,price,aliases\nALIAS-A,First,1.00,BC4999\nALIAS-B,Second,1.00,NEWALIAS\nALIAS-C,Third,1.00,NEWALIAS",
  });
  expect(p.json().errors.length).toBeGreaterThanOrEqual(2);
});
test("stock failure rolls back every line and ledger rows cannot be edited", async () => {
  const rows = (await t.request(m, "GET", "/api/parts?limit=2")).json().items;
  await post("/api/stock", {
    kind: "opening",
    key: crypto.randomUUID(),
    reason: "Start",
    lines: [{ partId: rows[0].id, qty: 3 }],
  });
  const r = await post("/api/stock", {
    kind: "adjustment",
    key: crypto.randomUUID(),
    reason: "Atomic count",
    lines: [
      { partId: rows[0].id, qty: 2 },
      { partId: rows[1].id, qty: -1 },
    ],
  });
  expect(r.statusCode).toBe(409);
  expect(
    (await t.pool.query("SELECT stock FROM parts WHERE id=$1", [rows[0].id]))
      .rows[0].stock,
  ).toBe(3);
  await expect(t.pool.query("UPDATE movements SET qty=99")).rejects.toThrow(
    "immutable",
  );
});
test("CSV neutralizes formulas and money totals use line rounding", async () => {
  const part = await post("/api/parts", {
    sku: "=FORMULA",
    name: "+external()",
    price: "0.10",
  });
  await post("/api/settings", {
    shopName: "Test",
    currency: "PHP",
    taxMode: "exclusive",
    taxRate: "5.00",
    timezone: "Asia/Manila",
  });
  const cart = await post("/api/carts", {
    lines: [{ partId: part.json().id, qty: 3 }],
  });
  expect(cart.json().subtotal).toBe("0.30");
  expect(cart.json().tax).toBe("0.02");
  expect(cart.json().total).toBe("0.32");
  expect((await t.request(m, "GET", "/api/reports/export")).body).toContain(
    "'=FORMULA",
  );
});
test("inactive parts and price overrides reject counter writes", async () => {
  const p = await post("/api/parts", {
    sku: "INACTIVE",
    name: "Old",
    price: "1.00",
    active: false,
  });
  expect(
    (await post("/api/carts", { lines: [{ partId: p.json().id, qty: 1 }] }))
      .statusCode,
  ).toBe(409);
  const c = await t.login("counter");
  const rows = (await t.request(m, "GET", "/api/parts?limit=1")).json().items;
  expect(
    (
      await t.request(c, "POST", "/api/carts", {
        lines: [{ partId: rows[0].id, qty: 1, price: "999.00" }],
      })
    ).statusCode,
  ).toBe(403);
});
