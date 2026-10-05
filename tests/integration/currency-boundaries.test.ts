import { beforeAll, afterAll, test, expect } from "vitest";
import { setup } from "./support";
import { snapshot, restoreSnapshot } from "../../scripts/snapshot";
let t: Awaited<ReturnType<typeof setup>>, m: Record<string, string>;
beforeAll(async () => {
  t = await setup();
  m = await t.login();
});
afterAll(async () => {
  await t?.close();
});
test("explicit foreign currency is rejected before an API schema can discard it", async () => {
  const r = await t.request(m, "POST", "/api/parts", {
    sku: "FOREIGN",
    name: "Do not create",
    price: "40.00",
    currency: "USD",
  });
  expect(r.statusCode).toBe(400);
  expect(
    (
      await t.pool.query(
        "SELECT count(*)::int n FROM parts WHERE sku='FOREIGN'",
      )
    ).rows[0].n,
  ).toBe(0);
  const p = (
    await t.request(m, "POST", "/api/parts", {
      sku: "PHP-PART",
      name: "Peso part",
      price: "40.00",
      currency: "PHP",
    })
  ).json();
  expect(p.currency).toBe("PHP");
  const supplier = (
    await t.request(m, "POST", "/api/suppliers", {
      name: "Currency test supplier",
    })
  ).json();
  expect(
    (
      await t.request(m, "POST", "/api/purchases", {
        supplierId: supplier.id,
        lines: [{ partId: p.id, qty: 1, cost: "20", currency: "USD" }],
      })
    ).statusCode,
  ).toBe(400);
  expect(
    (
      await t.request(m, "POST", "/api/carts", {
        lines: [{ partId: p.id, qty: 1, price: "40", currencyCode: "USD" }],
      })
    ).statusCode,
  ).toBe(400);
  expect(
    (await t.pool.query("SELECT count(*)::int n FROM purchases")).rows[0].n,
  ).toBe(0);
});
test("catalog CSV keeps foreign rows as preview errors and rejects their commit", async () => {
  const preview = await t.request(m, "POST", "/api/import/preview", {
    currency: "PHP",
    csv: "sku,name,price,currency\nFOREIGN-CSV,Foreign,50,USD\nLOCAL-CSV,Local,50,PHP",
  });
  expect(preview.statusCode).toBe(200);
  expect(preview.json().errors.join(" ")).toMatch(/PHP/);
  expect(
    (
      await t.request(m, "POST", "/api/import/commit", {
        id: preview.json().id,
      })
    ).statusCode,
  ).toBe(400);
  expect(
    (
      await t.pool.query(
        "SELECT count(*)::int n FROM parts WHERE sku LIKE '%-CSV'",
      )
    ).rows[0].n,
  ).toBe(0);
  const batch = await t.request(m, "POST", "/api/import/preview", {
    currency: "USD",
    csv: "sku,name,price\nBATCH-FX,Foreign,50",
  });
  expect(batch.statusCode).toBe(400);
});
test("PHP currency survives valid CSV import and cannot be changed in the database", async () => {
  const preview = (
    await t.request(m, "POST", "/api/import/preview", {
      csv: "sku,name,price,currency\nVALID-PHP,Valid,12.50,PHP",
    })
  ).json();
  expect(preview.errors).toEqual([]);
  expect(
    (await t.request(m, "POST", "/api/import/commit", { id: preview.id }))
      .statusCode,
  ).toBe(200);
  const p = (
    await t.pool.query(
      "SELECT id,currency,price FROM parts WHERE sku='VALID-PHP'",
    )
  ).rows[0];
  expect(p).toMatchObject({ currency: "PHP", price: "12.50" });
  await expect(
    t.pool.query("UPDATE parts SET currency='USD' WHERE id=$1", [p.id]),
  ).rejects.toThrow();
});
test("foreign labels in an opening-stock CSV cannot be silently ignored", async () => {
  const p = (
    await t.request(m, "POST", "/api/parts", {
      sku: "OPEN-PHP",
      name: "Stock fixture",
      price: "5",
    })
  ).json();
  const preview = (
    await t.request(m, "POST", "/api/stock-import/preview", {
      csv: "sku,qty,currency\nOPEN-PHP,3,USD",
    })
  ).json();
  expect(preview.errors.join(" ")).toMatch(/PHP/);
  expect(
    (await t.request(m, "POST", "/api/stock-import/commit", { id: preview.id }))
      .statusCode,
  ).toBe(400);
  expect(
    (await t.pool.query("SELECT stock FROM parts WHERE id=$1", [p.id])).rows[0]
      .stock,
  ).toBe(0);
});
test("restore rejects explicit non-PHP snapshot labels before touching any records", async () => {
  const copy = await snapshot(t.pool);
  (copy.tables.parts[0] as any).currency = "USD";
  await expect(restoreSnapshot(t.pool, copy)).rejects.toThrow(/PHP/);
  expect(
    (await t.pool.query("SELECT count(*)::int n FROM users")).rows[0].n,
  ).toBe(3);
});
test.each([
  [
    "/api/import/preview",
    "sku,name,price,currency,currency\nDUP-FX,Foreign,50,USD,PHP",
  ],
  [
    "/api/stock-import/preview",
    "sku,qty,currency,currency\nOPEN-PHP,3,USD,PHP",
  ],
])(
  "%s rejects duplicate CSV headers before a foreign label can be lost",
  async (path, csv) => {
    const before = (
      await t.pool.query("SELECT count(*)::int n FROM import_previews")
    ).rows[0].n;
    const result = await t.request(m, "POST", path, { csv });
    expect(result.statusCode).toBe(400);
    expect(result.json().error).toMatch(/duplicate.*column/i);
    expect(
      (await t.pool.query("SELECT count(*)::int n FROM import_previews"))
        .rows[0].n,
    ).toBe(before);
  },
);
