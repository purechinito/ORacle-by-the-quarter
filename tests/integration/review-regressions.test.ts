import { beforeAll, afterAll, test, expect } from "vitest";
import { setup } from "./support";
import { createPosting } from "../../apps/web/src/posting";
import { addPartToCart } from "../../apps/web/src/cart";
let t: Awaited<ReturnType<typeof setup>>, m: Record<string, string>;
beforeAll(async () => {
  t = await setup();
  m = await t.login();
});
afterAll(async () => {
  await t?.close();
});
const post = (path: string, body: any) => t.request(m, "POST", path, body);
test("two clean previews cannot commit ownership of the same exact alias", async () => {
  const a = await post("/api/import/preview", {
      csv: "sku,name,price,aliases\nR-A,First,1.00,EXACT-ONE",
    }),
    b = await post("/api/import/preview", {
      csv: "sku,name,price,aliases\nR-B,Second,1.00,EXACT-ONE",
    });
  expect(a.json().errors).toEqual([]);
  expect(b.json().errors).toEqual([]);
  const commits = await Promise.all(
    [a, b].map((p) => post("/api/import/commit", { id: p.json().id })),
  );
  expect(commits.map((r) => r.statusCode).sort()).toEqual([200, 409]);
  expect(
    (
      await post("/api/parts", {
        sku: "R-C",
        name: "Manual conflict",
        price: "1.00",
        aliases: [" exact-one "],
      })
    ).statusCode,
  ).toBe(409);
  expect(
    (
      await post("/api/parts", {
        sku: "R-D",
        name: "Distinct punctuation",
        price: "1.00",
        aliases: ["EXACTONE"],
      })
    ).statusCode,
  ).toBe(200);
});
test("a lost receipt response can be recovered after modal reopen without receiving twice", async () => {
  const p = await post("/api/parts", {
      sku: "RECEIPT-R",
      name: "Receipt part",
      price: "1.00",
    }),
    s = await post("/api/suppliers", { name: "Retry supplier" }),
    po = await post("/api/purchases", {
      supplierId: s.json().id,
      lines: [{ partId: p.json().id, qty: 10, cost: "0.50" }],
    });
  await post("/api/purchases/" + po.json().id + "/submit", {});
  let saved: string | null = null;
  const store = {
    get: () => saved,
    set: (x: string) => {
      saved = x;
    },
    clear: () => {
      saved = null;
    },
  };
  let lose = true;
  const request = async (path: string, method: string, body: any) => {
    const r = await t.request(m, method, path, body);
    if (r.statusCode >= 400)
      throw Object.assign(Error(r.body), { status: r.statusCode });
    if (lose) {
      lose = false;
      throw Error("Response lost");
    }
    return r.json();
  };
  const url = "/purchases/" + po.json().id + "/receive";
  const adapted = async (path: string, method: string, body: any) =>
    request("/api" + path, method, body);
  const original = createPosting(adapted, store);
  await expect(
    original.submit(url, {
      key: crypto.randomUUID(),
      lines: [{ partId: p.json().id, qty: 4 }],
    }),
  ).rejects.toThrow("Response lost");
  const reopened = createPosting(adapted, store);
  expect(reopened.pending).toBe(true);
  await reopened.submit(url, {
    key: crypto.randomUUID(),
    lines: [{ partId: p.json().id, qty: 4 }],
  });
  expect(
    (await t.pool.query("SELECT stock FROM parts WHERE id=$1", [p.json().id]))
      .rows[0].stock,
  ).toBe(4);
  expect(saved).toBe(null);
});
test("a lost partial return response recovers once after reopen", async () => {
  const p = await post("/api/parts", {
    sku: "RETURN-R",
    name: "Return part",
    price: "1.00",
  });
  await post("/api/stock", {
    key: crypto.randomUUID(),
    kind: "opening",
    reason: "Start",
    lines: [{ partId: p.json().id, qty: 10 }],
  });
  await post("/api/settings", {
    shopName: "Test",
    currency: "USD",
    taxMode: "none",
    taxRate: "0",
    timezone: "UTC",
  });
  const sale = await post("/api/carts", {
    lines: [{ partId: p.json().id, qty: 4 }],
  });
  await post("/api/sales/" + sale.json().id + "/post", {
    key: crypto.randomUUID(),
    payment: "4.00",
    method: "cash",
  });
  let saved: string | null = null,
    lose = true;
  const store = {
    get: () => saved,
    set: (x: string) => {
      saved = x;
    },
    clear: () => {
      saved = null;
    },
  };
  const request = async (path: string, method: string, body: any) => {
    const r = await t.request(m, method, "/api" + path, body);
    if (r.statusCode >= 400)
      throw Object.assign(Error(r.body), { status: r.statusCode });
    if (lose) {
      lose = false;
      throw Error("Lost");
    }
    return r.json();
  };
  const url = "/sales/" + sale.json().id + "/return",
    body = {
      key: crypto.randomUUID(),
      reason: "Test return",
      refundStatus: "pending",
      lines: [{ partId: p.json().id, qty: 2, restock: true }],
    };
  await expect(createPosting(request, store).submit(url, body)).rejects.toThrow(
    "Lost",
  );
  await createPosting(request, store).submit(url, {
    ...body,
    key: crypto.randomUUID(),
  });
  expect(
    (await t.pool.query("SELECT stock FROM parts WHERE id=$1", [p.json().id]))
      .rows[0].stock,
  ).toBe(8);
  expect(
    (
      await t.pool.query(
        "SELECT count(*)::int AS n FROM returns WHERE sale_id=$1",
        [sale.json().id],
      )
    ).rows[0].n,
  ).toBe(1);
});
test("resuming then adding and saving updates the existing cart", async () => {
  const p = await post("/api/parts", {
    sku: "CART-R",
    name: "Cart part",
    price: "2.00",
  });
  const a = await post("/api/carts", {
    lines: [{ partId: p.json().id, qty: 1 }],
  });
  const edited = addPartToCart(a.json(), a.json().lines, p.json());
  expect(edited.cart?.id).toBe(a.json().id);
  const b = await post("/api/carts", {
    id: edited.cart.id,
    lines: edited.lines.map(({ partId, qty }: any) => ({ partId, qty })),
  });
  expect(b.json().id).toBe(a.json().id);
  expect(b.json().lines[0].qty).toBe(2);
  expect(edited.cart.total).toBe(null);
});
