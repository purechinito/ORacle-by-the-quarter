import { beforeAll, afterAll, test, expect } from "vitest";
import { setup } from "./support";
let t: Awaited<ReturnType<typeof setup>>,
  m: Record<string, string>,
  c: Record<string, string>,
  s: Record<string, string>,
  part: string,
  po: string,
  sale: string;
const key = () => crypto.randomUUID();
beforeAll(async () => {
  t = await setup();
  m = await t.login();
  c = await t.login("counter");
  s = await t.login("stock");
});
afterAll(async () => {
  await t?.close();
});
const post = async (url: string, b: any, h = m) => t.request(h, "POST", url, b);
test("catalog preserves alias collisions and validates fitment", async () => {
  let r = await post("/api/parts", {
    sku: "BRAKE-001",
    name: "Front brake pad",
    brand: "Example",
    category: "Brakes",
    price: "19.95",
    reorder: 5,
    bin: "A-01",
    aliases: ["04465-123", "BC001"],
    fitments: [
      { make: "Example", model: "Sedan", from: 2010, to: 2015, engine: "1.6" },
    ],
  });
  expect(r.statusCode).toBe(200);
  part = r.json().id;
  expect(
    (
      await post("/api/parts", {
        sku: "BRAKE-001",
        name: "Duplicate",
        price: "1.00",
      })
    ).statusCode,
  ).toBe(409);
  expect(
    (
      await post("/api/parts", {
        sku: "OTHER",
        name: "Alternative",
        price: "2.00",
        aliases: ["04465123"],
      })
    ).statusCode,
  ).toBe(200);
  const found = await t.request(c, "GET", "/api/parts?q=04465-123");
  expect(found.json().total).toBe(2);
  expect(
    (
      await post("/api/parts", {
        sku: "BAD",
        name: "Bad years",
        price: "1",
        fitments: [{ make: "X", model: "Y", from: 2020, to: 2010 }],
      })
    ).statusCode,
  ).toBe(400);
  expect(
    (await post("/api/parts", { sku: "FORBIDDEN", name: "No", price: "1" }, c))
      .statusCode,
  ).toBe(403);
});
test("CSV preview reports invalid rows and commit is atomic and repeatable", async () => {
  const bad = await post("/api/import/preview", {
    csv: "sku,name,price\nIMPORT-A,Good,1.00\nIMPORT-A,Duplicate,1.00",
  });
  expect(bad.json().errors.length).toBeGreaterThan(0);
  expect(
    (await post("/api/import/commit", { id: bad.json().id })).statusCode,
  ).toBe(400);
  const preview = await post("/api/import/preview", {
    csv: 'sku,name,price\nIMPORT-A,"Line, with comma",1.00',
  });
  expect(preview.json().errors).toEqual([]);
  const a = await post("/api/import/commit", { id: preview.json().id }),
    b = await post("/api/import/commit", { id: preview.json().id });
  expect(a.statusCode).toBe(200);
  expect(b.json()).toEqual(a.json());
  expect(
    (await t.request(m, "GET", "/api/parts?q=IMPORT-A")).json().total,
  ).toBe(1);
});
test("opening stock and adjustments reject duplicates, negative stock and unauthorized staff", async () => {
  const k = key();
  const a = await post("/api/stock", {
    kind: "opening",
    key: k,
    reason: "Opening batch",
    lines: [{ partId: part, qty: 10 }],
  });
  expect(a.statusCode).toBe(200);
  expect(
    (
      await post("/api/stock", {
        kind: "opening",
        key: k,
        reason: "Opening batch",
        lines: [{ partId: part, qty: 10 }],
      })
    ).json(),
  ).toEqual(a.json());
  expect(
    (
      await post("/api/stock", {
        kind: "opening",
        key: k,
        reason: "Different",
        lines: [{ partId: part, qty: 10 }],
      })
    ).statusCode,
  ).toBe(409);
  expect(
    (
      await post("/api/stock", {
        kind: "adjustment",
        key: key(),
        reason: "Count",
        lines: [{ partId: part, qty: -11 }],
      })
    ).statusCode,
  ).toBe(409);
  expect(
    (
      await post("/api/stock", {
        kind: "adjustment",
        key: key(),
        reason: "Count",
        lines: [{ partId: part, qty: 1.5 }],
      })
    ).statusCode,
  ).toBe(400);
  expect(
    (
      await post(
        "/api/stock",
        {
          kind: "adjustment",
          key: key(),
          reason: "Count",
          lines: [{ partId: part, qty: 1 }],
        },
        c,
      )
    ).statusCode,
  ).toBe(403);
});
test("purchase receipts cannot exceed ordered quantity under concurrency", async () => {
  const supplier = await post("/api/suppliers", { name: "Example supplier" });
  expect(supplier.statusCode).toBe(200);
  const r = await post("/api/purchases", {
    supplierId: supplier.json().id,
    lines: [{ partId: part, qty: 10, cost: "8.00" }],
  });
  expect(r.statusCode).toBe(200);
  po = r.json().id;
  expect((await post("/api/purchases/" + po + "/submit", {})).statusCode).toBe(
    200,
  );
  const k = key(),
    body = { key: k, lines: [{ partId: part, qty: 4 }] };
  const first = await post("/api/purchases/" + po + "/receive", body, s);
  expect(first.statusCode).toBe(200);
  expect(
    (await post("/api/purchases/" + po + "/receive", body, s)).json(),
  ).toEqual(first.json());
  const results = await Promise.all([
    post(
      "/api/purchases/" + po + "/receive",
      { key: key(), lines: [{ partId: part, qty: 6 }] },
      s,
    ),
    post(
      "/api/purchases/" + po + "/receive",
      { key: key(), lines: [{ partId: part, qty: 6 }] },
      s,
    ),
  ]);
  expect(results.map((x) => x.statusCode).sort()).toEqual([200, 409]);
  const list = (await t.request(s, "GET", "/api/purchases")).json();
  expect(JSON.stringify(list)).not.toContain("8.00");
});
test("sales require settings and exact payment and preserve stock on failure", async () => {
  const draft = await post(
    "/api/carts",
    { lines: [{ partId: part, qty: 1 }] },
    c,
  );
  expect(draft.statusCode).toBe(200);
  sale = draft.json().id;
  expect(
    (
      await post(
        "/api/sales/" + sale + "/post",
        { key: key(), payment: "19.95", method: "cash" },
        c,
      )
    ).statusCode,
  ).toBe(409);
  expect(
    (
      await post("/api/settings", {
        shopName: "Example Auto",
        currency: "PHP",
        taxMode: "none",
        taxRate: "0",
        timezone: "Asia/Manila",
      })
    ).statusCode,
  ).toBe(200);
  expect(
    (
      await post(
        "/api/sales/" + sale + "/post",
        { key: key(), payment: "19.94", method: "cash" },
        c,
      )
    ).statusCode,
  ).toBe(400);
  const k = key(),
    body = { key: k, payment: "19.95", method: "cash" };
  const r = await post("/api/sales/" + sale + "/post", body, c);
  expect(r.statusCode).toBe(200);
  expect(r.json().total).toBe("19.95");
  expect((await post("/api/sales/" + sale + "/post", body, c)).json()).toEqual(
    r.json(),
  );
});
test("return limits hold and damaged goods do not increase sellable stock", async () => {
  let r = await post("/api/sales/" + sale + "/return", {
    key: key(),
    reason: "Damaged",
    refundStatus: "pending",
    lines: [{ partId: part, qty: 1, restock: false }],
  });
  expect(r.statusCode).toBe(200);
  expect(
    (
      await post("/api/sales/" + sale + "/return", {
        key: key(),
        reason: "Again",
        refundStatus: "pending",
        lines: [{ partId: part, qty: 1, restock: true }],
      })
    ).statusCode,
  ).toBe(409);
  expect(
    (await t.request(c, "GET", "/api/parts?q=BRAKE-001")).json().items[0].stock,
  ).toBe(19);
});
test("concurrent last-unit sales allow one commit and keep the other cart", async () => {
  const p = await post("/api/parts", {
    sku: "LAST",
    name: "Last unit",
    price: "0.10",
  });
  const id = p.json().id;
  await post("/api/stock", {
    kind: "opening",
    key: key(),
    reason: "Start",
    lines: [{ partId: id, qty: 1 }],
  });
  const a = await post("/api/carts", { lines: [{ partId: id, qty: 1 }] }, c),
    b = await post("/api/carts", { lines: [{ partId: id, qty: 1 }] }, c);
  const results = await Promise.all(
    [a, b].map((x) =>
      post(
        "/api/sales/" + x.json().id + "/post",
        { key: key(), payment: "0.10", method: "cash" },
        c,
      ),
    ),
  );
  expect(results.map((x) => x.statusCode).sort()).toEqual([200, 409]);
  expect(
    Number(
      (
        await t.pool.query(
          "SELECT count(*) FROM sales WHERE id=ANY($1::uuid[]) AND status='draft'",
          [[a.json().id, b.json().id]],
        )
      ).rows[0].count,
    ),
  ).toBe(1);
});
test("reports reconcile and cost fields do not leak", async () => {
  const r = await t.request(m, "GET", "/api/reports");
  expect(r.statusCode).toBe(200);
  expect(r.json().salesTotal).toBe("20.05");
  expect((await t.request(c, "GET", "/api/reports/export")).statusCode).toBe(
    403,
  );
  const mismatches = await t.pool.query(
    "SELECT p.id FROM parts p WHERE p.stock != COALESCE((SELECT sum(qty) FROM movements WHERE part_id=p.id),0)",
  );
  expect(mismatches.rowCount).toBe(0);
});
test("currency cannot be changed after a posted sale", async () => {
  const r = await post("/api/settings", {
    shopName: "Example Auto",
    currency: "USD",
    taxMode: "none",
    taxRate: "0",
    timezone: "Asia/Manila",
  });
  expect(r.statusCode).toBe(400);
  expect((await t.request(m, "GET", "/api/settings")).json().currency).toBe(
    "PHP",
  );
});
