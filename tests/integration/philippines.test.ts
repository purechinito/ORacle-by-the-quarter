import { beforeAll, afterAll, test, expect } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import pg from "pg";
import { setup } from "./support";
import { migrate } from "../../apps/api/src/db";
let t: Awaited<ReturnType<typeof setup>>, m: Record<string, string>;
beforeAll(async () => {
  t = await setup();
  m = await t.login();
});
afterAll(async () => {
  await t?.close();
});
const config = {
  shopName: "PH Auto Supply",
  currency: "PHP",
  timezone: "Asia/Manila",
  taxMode: "none",
  taxRate: "0",
};
test("Philippine defaults leave tax treatment unconfirmed", async () => {
  const settings = (await t.request(m, "GET", "/api/settings")).json();
  expect(settings).toMatchObject({ currency: "PHP", timezone: "Asia/Manila" });
  expect(settings.taxMode).toBeUndefined();
});
test("settings reject another currency and timezone even before any sale", async () => {
  expect(
    (
      await t.request(m, "POST", "/api/settings", {
        ...config,
        currency: "USD",
      })
    ).statusCode,
  ).toBe(400);
  expect(
    (
      await t.request(m, "POST", "/api/settings", {
        ...config,
        timezone: "UTC",
      })
    ).statusCode,
  ).toBe(400);
  expect((await t.request(m, "POST", "/api/settings", config)).statusCode).toBe(
    200,
  );
});
test("database rejects non-peso settings and posted snapshots, including restore writes", async () => {
  await expect(
    t.pool.query("UPDATE settings SET data=$1 WHERE id=1", [
      JSON.stringify({ ...config, currency: "USD" }),
    ]),
  ).rejects.toThrow();
  const actor = (
    await t.pool.query("SELECT id FROM users WHERE username='manager'")
  ).rows[0].id;
  await expect(
    t.pool.query(
      "INSERT INTO sales(actor,status,lines,total,settings,posted_at) VALUES($1,'posted','[]',100,$2,now())",
      [actor, JSON.stringify({ ...config, currency: "USD" })],
    ),
  ).rejects.toThrow();
});
test("a Philippine business day includes local midnight and excludes the next day across reports and histories", async () => {
  const actor = (
    await t.pool.query("SELECT id FROM users WHERE username='manager'")
  ).rows[0].id;
  const part = (
    await t.request(m, "POST", "/api/parts", {
      sku: "PH-DATE",
      name: "Philippine date fixture",
      price: "100.00",
    })
  ).json();
  const supplier = (
    await t.request(m, "POST", "/api/suppliers", { name: "PH supplier" })
  ).json();
  for (const at of [
    "2026-09-27T15:59:59Z",
    "2026-09-27T16:00:00Z",
    "2026-09-28T15:59:59Z",
    "2026-09-28T16:00:00Z",
  ]) {
    const sale = (
      await t.pool.query(
        "INSERT INTO sales(actor,status,lines,total,settings,created_at,posted_at) VALUES($1,'posted','[]',100,$2,$3,$3) RETURNING id",
        [actor, JSON.stringify(config), at],
      )
    ).rows[0];
    await t.pool.query(
      "INSERT INTO purchases(supplier_id,status,created_at) VALUES($1,'draft',$2)",
      [supplier.id, at],
    );
    await t.pool.query(
      "INSERT INTO movements(part_id,qty,kind,reason,document_id,actor,created_at) VALUES($1,1,'opening','PH boundary',$2,$3,$4)",
      [part.id, sale.id, actor, at],
    );
    await t.pool.query(
      "INSERT INTO audit_events(actor,action,record_id,created_at) VALUES($1,'ph.boundary',$2,$3)",
      [actor, sale.id, at],
    );
  }
  const range = "?from=2026-09-28&to=2026-09-28";
  const report = (await t.request(m, "GET", "/api/reports" + range)).json();
  expect(report).toMatchObject({
    currency: "PHP",
    timezone: "Asia/Manila",
    salesCount: 2,
    salesTotal: "200.00",
  });
  for (const path of ["sales", "purchases", "movements", "audit"])
    expect(
      (
        await t.request(
          m,
          "GET",
          "/api/" + path + range + (path === "audit" ? "&q=ph.boundary" : ""),
        )
      ).json(),
    ).toHaveLength(2);
});
test("upgrading a non-peso database refuses to relabel its existing money", async () => {
  await t.pool.query("CREATE DATABASE ph_legacy");
  const legacy = new pg.Pool({
    ...t.pool.options,
    password: t.password,
    database: "ph_legacy",
  });
  try {
    await legacy.query("CREATE TABLE migrations(name text PRIMARY KEY)");
    for (const name of (await readdir("db/migrations"))
      .sort()
      .filter((n) => n < "006")) {
      await legacy.query(await readFile("db/migrations/" + name, "utf8"));
      await legacy.query("INSERT INTO migrations VALUES($1)", [name]);
    }
    await legacy.query("UPDATE settings SET data=$1 WHERE id=1", [
      JSON.stringify({ ...config, currency: "USD" }),
    ]);
    await expect(migrate(legacy)).rejects.toThrow(/PHP|peso/i);
    expect(
      (await legacy.query("SELECT data FROM settings WHERE id=1")).rows[0].data
        .currency,
    ).toBe("USD");
  } finally {
    await legacy.end();
  }
});
