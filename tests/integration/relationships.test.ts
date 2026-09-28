import { beforeAll, afterAll, test, expect } from "vitest";
import { setup } from "./support";
let t: Awaited<ReturnType<typeof setup>>,
  m: Record<string, string>,
  c: Record<string, string>,
  s: Record<string, string>;
beforeAll(async () => {
  t = await setup();
  m = await t.login();
  c = await t.login("counter");
  s = await t.login("stock");
});
afterAll(async () => {
  await t?.close();
});
test("customer search reaches every record with stable pages and resolves a selected ID", async () => {
  await t.pool.query(
    "INSERT INTO customers(name,phone) SELECT 'Customer '||lpad(n::text,4,'0'),'09'||n FROM generate_series(1,650) n",
  );
  const result = await t.request(
    c,
    "GET",
    "/api/parties/customers?q=0650&limit=10",
  );
  expect(result.statusCode).toBe(200);
  expect(result.json().total).toBe(1);
  expect(result.json().items[0].name).toBe("Customer 0650");
  const page = (
    await t.request(c, "GET", "/api/parties/customers?page=26&limit=25")
  ).json();
  expect(page.items).toHaveLength(25);
  expect(page.total).toBe(650);
  expect(
    (
      await t.request(
        c,
        "GET",
        "/api/parties/customers/" + result.json().items[0].id,
      )
    ).json().profile.name,
  ).toBe("Customer 0650");
  const legacy = (await t.request(c, "GET", "/api/customers?q=0650")).json();
  expect(legacy).toHaveLength(1);
});
test("party profiles preserve Philippine address and identifiers, audit changes and reject stale updates", async () => {
  const input = {
    name: "Local Auto Shop",
    partyType: "company",
    phone: "09123456789",
    email: "shop@example.test",
    contactName: "Test contact",
    tin: "001-234-567",
    address: {
      street: "Unit 2",
      barangay: "Sample",
      city: "Manila",
      province: "Metro Manila",
      postalCode: "1000",
    },
    termsDays: 30,
    creditLimit: "20000.00",
    notes: "Test account",
  };
  const made = await t.request(m, "POST", "/api/parties/customers", input);
  expect(made.statusCode).toBe(200);
  const p = made.json();
  expect(p).toMatchObject({
    tin: "001-234-567",
    terms_days: 30,
    credit_limit: "20000.00",
    version: 1,
  });
  expect(p.address.postalCode).toBe("1000");
  const updated = await t.request(m, "PUT", "/api/parties/customers/" + p.id, {
    ...input,
    name: "Updated Shop",
    version: p.version,
  });
  expect(updated.statusCode).toBe(200);
  expect(updated.json().version).toBe(2);
  expect(
    (
      await t.request(m, "PUT", "/api/parties/customers/" + p.id, {
        ...input,
        version: p.version,
      })
    ).statusCode,
  ).toBe(409);
  expect(
    (
      await t.pool.query(
        "SELECT action FROM audit_events WHERE record_id=$1 ORDER BY id",
        [p.id],
      )
    ).rows.map((x) => x.action),
  ).toEqual(["customer.created", "customer.updated"]);
  const read = (
    await t.request(c, "GET", "/api/parties/customers/" + p.id)
  ).json();
  expect(read.profile.tin).toBeUndefined();
  expect(read.profile.notes).toBeUndefined();
  expect((await t.request(s, "GET", "/api/parties/customers")).statusCode).toBe(
    403,
  );
  expect((await t.request(c, "GET", "/api/parties/suppliers")).statusCode).toBe(
    403,
  );
  expect(
    (
      await t.request(c, "PUT", "/api/parties/customers/" + p.id, {
        ...input,
        version: 2,
      })
    ).statusCode,
  ).toBe(403);
});
test("inactive customer cannot enter or post a new cart; linked history remains available to allowed users", async () => {
  const customer = (
    await t.request(m, "POST", "/api/parties/customers", {
      name: "Inactive buyer",
    })
  ).json();
  expect(customer.id).toBeDefined();
  const part = (
    await t.request(m, "POST", "/api/parts", {
      sku: "PARTY-1",
      name: "Part",
      price: "10",
    })
  ).json();
  await t.request(m, "POST", "/api/stock", {
    kind: "opening",
    key: crypto.randomUUID(),
    reason: "Test stock",
    lines: [{ partId: part.id, qty: 4 }],
  });
  await t.request(m, "POST", "/api/settings", {
    shopName: "Test PH",
    taxMode: "none",
    taxRate: "0",
  });
  const cart = (
    await t.request(m, "POST", "/api/carts", {
      customerId: customer.id,
      lines: [{ partId: part.id, qty: 1 }],
    })
  ).json();
  expect(
    (
      await t.request(m, "PUT", "/api/parties/customers/" + customer.id, {
        name: customer.name,
        active: false,
        version: 1,
      })
    ).statusCode,
  ).toBe(200);
  expect(
    (
      await t.request(m, "POST", "/api/carts", {
        customerId: customer.id,
        lines: [{ partId: part.id, qty: 1 }],
      })
    ).statusCode,
  ).toBe(409);
  expect(
    (
      await t.request(m, "POST", "/api/sales/" + cart.id + "/post", {
        key: crypto.randomUUID(),
        method: "cash",
        payment: "10",
      })
    ).statusCode,
  ).toBe(409);
  const history = (
    await t.request(m, "GET", "/api/parties/customers/" + customer.id)
  ).json();
  expect(history.history.items[0].id).toBe(cart.id);
  expect(
    (await t.request(c, "GET", "/api/parties/customers/" + customer.id)).json()
      .history.items,
  ).toEqual([]);
  expect(
    (await t.pool.query("SELECT stock FROM parts WHERE id=$1", [part.id]))
      .rows[0].stock,
  ).toBe(4);
});
test("inactive suppliers cannot be chosen for purchase drafts or submitted; stock role history hides costs", async () => {
  const supplier = (
    await t.request(m, "POST", "/api/parties/suppliers", {
      name: "Supplier profile",
      phone: "123",
    })
  ).json();
  expect(supplier.id).toBeDefined();
  const p = (
    await t.request(m, "POST", "/api/parts", {
      sku: "PARTY-2",
      name: "Part",
      price: "5",
    })
  ).json();
  const input = {
    supplierId: supplier.id,
    lines: [{ partId: p.id, qty: 2, cost: "3" }],
  };
  const po = (await t.request(m, "POST", "/api/purchases", input)).json();
  await t.request(m, "PUT", "/api/parties/suppliers/" + supplier.id, {
    name: supplier.name,
    active: false,
    version: 1,
  });
  expect((await t.request(m, "POST", "/api/purchases", input)).statusCode).toBe(
    409,
  );
  expect(
    (await t.request(m, "POST", "/api/purchases/" + po.id + "/submit"))
      .statusCode,
  ).toBe(409);
  const detail = (
    await t.request(s, "GET", "/api/parties/suppliers/" + supplier.id)
  ).json();
  expect(detail.history.items[0].id).toBe(po.id);
  expect(detail.history.items[0].total).toBeUndefined();
});
