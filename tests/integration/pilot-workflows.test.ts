import { beforeAll, afterAll, test, expect } from "vitest";
import { setup } from "./support";
import { createCheckout } from "../../apps/web/src/checkout";
let t: Awaited<ReturnType<typeof setup>>, m: Record<string, string>;
beforeAll(async () => {
  t = await setup();
  m = await t.login();
});
afterAll(async () => {
  await t?.close();
});
const request = (method: string, path: string, body?: any) =>
  t.request(m, method, "/api" + path, body);
const post = (path: string, body: any) => request("POST", path, body);

test("draft orders can be corrected, submitted orders cannot, and cancellation retains its reason", async () => {
  const part = (
    await post("/parts", { sku: "EDIT-PO", name: "Order part", price: "4.00" })
  ).json();
  const supplier = (
    await post("/suppliers", { name: "Pilot supplier" })
  ).json();
  const order = (
    await post("/purchases", {
      supplierId: supplier.id,
      lines: [{ partId: part.id, qty: 2, cost: "1.00" }],
    })
  ).json();
  const edit = {
    supplierId: supplier.id,
    lines: [{ partId: part.id, qty: 7, cost: "1.50" }],
  };
  expect(
    (await request("PUT", "/purchases/" + order.id, edit)).statusCode,
  ).toBe(200);
  expect(
    (await request("GET", "/purchases?q=" + order.id)).json()[0].lines[0],
  ).toMatchObject({ qty: 7, cost: "1.50" });
  await post("/purchases/" + order.id + "/submit", {});
  expect(
    (await request("PUT", "/purchases/" + order.id, edit)).statusCode,
  ).toBe(409);
  const cancelled = await post("/purchases/" + order.id + "/cancel", {
    reason: "Supplier discontinued this line",
  });
  expect(cancelled.json().cancel_reason).toBe(
    "Supplier discontinued this line",
  );
  expect(
    (await t.pool.query("SELECT stock FROM parts WHERE id=$1", [part.id]))
      .rows[0].stock,
  ).toBe(0);
});

test("cash tender and change survive receipt reopening; refund completion does not move stock again", async () => {
  const part = (
    await post("/parts", { sku: "TENDER", name: "Tender part", price: "3.50" })
  ).json();
  await post("/stock", {
    key: crypto.randomUUID(),
    kind: "opening",
    reason: "Initial",
    lines: [{ partId: part.id, qty: 10 }],
  });
  await post("/settings", {
    shopName: "Pilot",
    currency: "USD",
    taxMode: "none",
    taxRate: "0",
    timezone: "UTC",
  });
  const sale = (
    await post("/carts", { lines: [{ partId: part.id, qty: 2 }] })
  ).json();
  await post("/sales/" + sale.id + "/post", {
    key: crypto.randomUUID(),
    payment: "10.00",
    method: "cash",
  });
  const receipt = (await request("GET", "/sales/" + sale.id)).json();
  expect(receipt.payment).toMatchObject({
    amount: "7.00",
    tendered: "10.00",
    change: "3.00",
    method: "cash",
  });
  const ret = (
    await post("/sales/" + sale.id + "/return", {
      key: crypto.randomUUID(),
      reason: "Unused",
      refundStatus: "pending",
      lines: [{ partId: part.id, qty: 1, restock: true }],
    })
  ).json();
  const route = "/returns/" + ret.id + "/refund";
  expect(
    (await post(route, { reference: "Cash refund voucher 42" })).statusCode,
  ).toBe(200);
  expect(
    (await post(route, { reference: "Cash refund voucher 42" })).statusCode,
  ).toBe(200);
  const stock = (
    await t.pool.query("SELECT stock FROM parts WHERE id=$1", [part.id])
  ).rows[0].stock;
  expect(stock).toBe(9);
  const reopened = (await request("GET", "/sales/" + sale.id)).json();
  expect(reopened.returns[0]).toMatchObject({
    refund_status: "recorded",
    refund_reference: "Cash refund voucher 42",
  });
  const c = await t.login("counter");
  expect(
    (await t.request(c, "POST", "/api" + route, { reference: "Denied" }))
      .statusCode,
  ).toBe(403);
});

test("an uncertain sale retains its exact attempt across navigation and session expiry", async () => {
  let saved: string | null = null,
    saves = 0,
    stage = 0;
  const calls: any[] = [];
  const store = {
    get: () => saved,
    set: (v: string) => {
      saved = v;
    },
    clear: () => {
      saved = null;
    },
  };
  const request = async (path: string, method?: string, body?: any) => {
    calls.push({ path, body });
    if (path.endsWith("/post")) {
      if (stage++ === 0) throw Error("Response lost");
      if (stage === 2)
        throw Object.assign(Error("Sign in again"), { status: 401 });
      return { change: "3.00" };
    }
    return { id: "existing-sale", status: "posted" };
  };
  const save = async () => {
    saves++;
    return { id: "existing-sale" };
  };
  const input = { key: "original", payment: "10.00", method: "cash" };
  await expect(
    createCheckout(request, store).complete(save, input),
  ).rejects.toThrow("Response lost");
  await expect(
    createCheckout(request, store).complete(save, input),
  ).rejects.toThrow("Sign in again");
  const resumed = createCheckout(request, store);
  expect(resumed.pending).toBe(true);
  await resumed.complete(save, { ...input, key: "different" });
  expect(saves).toBe(1);
  expect(calls[0]).toEqual(calls[2]);
  expect(saved).toBe(null);
});

test("transaction history reaches beyond the first 100 records with role scoping and filters", async () => {
  const manager = (
    await t.pool.query("SELECT id FROM users WHERE username='manager'")
  ).rows[0];
  await t.pool.query(
    "INSERT INTO sales(actor,status,lines,total,created_at) SELECT $1,'draft','[]',1,now()-n*interval '1 minute' FROM generate_series(1,105) n",
    [manager.id],
  );
  const first = (
    await request("GET", "/sales?status=draft&limit=100&page=1")
  ).json();
  const second = (
    await request("GET", "/sales?status=draft&limit=100&page=2")
  ).json();
  expect(first).toHaveLength(100);
  expect(second).toHaveLength(5);
  expect(second.every((x: any) => !first.some((y: any) => y.id === x.id))).toBe(
    true,
  );
  const c = await t.login("counter");
  expect(
    (await t.request(c, "GET", "/api/sales?status=draft&page=1")).json(),
  ).toEqual([]);
  expect((await request("GET", "/movements?from=2099-01-01")).json()).toEqual(
    [],
  );
  expect((await request("GET", "/audit?q=refund.recorded")).json().length).toBe(
    1,
  );
});

test("substitute links refer to existing parts and never to the same part", async () => {
  const a = (
    await post("/parts", { sku: "SUB-A", name: "Original", price: "2.00" })
  ).json();
  const b = (
    await post("/parts", { sku: "SUB-B", name: "Alternative", price: "3.00" })
  ).json();
  expect(
    (await request("PUT", "/parts/" + a.id, { ...a, substitutes: [a.id] }))
      .statusCode,
  ).toBe(400);
  expect(
    (
      await request("PUT", "/parts/" + a.id, {
        ...a,
        substitutes: [crypto.randomUUID()],
      })
    ).statusCode,
  ).toBe(400);
  expect(
    (await request("PUT", "/parts/" + a.id, { ...a, substitutes: [b.id] }))
      .statusCode,
  ).toBe(200);
  expect(
    (await request("GET", "/parts/" + a.id + "/substitutes")).json()[0].id,
  ).toBe(b.id);
});

test("retiring a sold part still permits its return and a manager stock correction", async () => {
  const part = (
    await post("/parts", {
      sku: "RETIRED",
      name: "Retired after sale",
      price: "2.00",
    })
  ).json();
  await post("/stock", {
    key: crypto.randomUUID(),
    kind: "opening",
    reason: "Initial",
    lines: [{ partId: part.id, qty: 5 }],
  });
  const sale = (
    await post("/carts", { lines: [{ partId: part.id, qty: 1 }] })
  ).json();
  await post("/sales/" + sale.id + "/post", {
    key: crypto.randomUUID(),
    payment: "2.00",
    method: "cash",
  });
  await request("PUT", "/parts/" + part.id, { ...part, active: false });
  expect(
    (
      await post("/sales/" + sale.id + "/return", {
        key: crypto.randomUUID(),
        reason: "Unused",
        refundStatus: "pending",
        lines: [{ partId: part.id, qty: 1, restock: true }],
      })
    ).statusCode,
  ).toBe(200);
  expect(
    (
      await post("/stock", {
        key: crypto.randomUUID(),
        kind: "adjustment",
        reason: "Disposed retired stock",
        lines: [{ partId: part.id, qty: -2 }],
      })
    ).statusCode,
  ).toBe(200);
  expect(
    (await post("/carts", { lines: [{ partId: part.id, qty: 1 }] })).statusCode,
  ).toBe(409);
  expect(
    (await t.pool.query("SELECT stock FROM parts WHERE id=$1", [part.id]))
      .rows[0].stock,
  ).toBe(3);
});

test("posted-sales date filters follow completion date rather than old draft creation date", async () => {
  const actor = (
    await t.pool.query("SELECT id FROM users WHERE username='manager'")
  ).rows[0].id;
  const sale = (
    await t.pool.query(
      "INSERT INTO sales(actor,status,lines,total,created_at,posted_at) VALUES($1,'posted','[]',1,'2026-01-01T12:00:00Z','2026-01-03T12:00:00Z') RETURNING id",
      [actor],
    )
  ).rows[0];
  expect(
    (
      await request("GET", "/sales?from=2026-01-03&to=2026-01-03&q=" + sale.id)
    ).json(),
  ).toHaveLength(1);
  expect(
    (
      await request("GET", "/sales?from=2026-01-01&to=2026-01-01&q=" + sale.id)
    ).json(),
  ).toHaveLength(0);
});
