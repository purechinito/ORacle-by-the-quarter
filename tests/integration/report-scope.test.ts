import { beforeAll, afterAll, test, expect } from "vitest";
import { setup } from "./support";
let t: Awaited<ReturnType<typeof setup>>,
  m: Record<string, string>,
  c: Record<string, string>,
  s: Record<string, string>,
  ownId: string,
  today: string;
beforeAll(async () => {
  t = await setup();
  m = await t.login();
  c = await t.login("counter");
  s = await t.login("stock");
  const users = (await t.pool.query("SELECT id,username FROM users")).rows;
  const manager = users.find((u) => u.username === "manager").id;
  const counter = users.find((u) => u.username === "counter").id;
  today = (
    await t.pool.query(
      "SELECT (now() AT TIME ZONE 'Asia/Manila')::date::text AS today",
    )
  ).rows[0].today;
  for (const [actor, amount, days] of [
    [manager, "100", 0],
    [counter, "30", 0],
    [manager, "20", 1],
  ] as const) {
    const sale = (
      await t.pool.query(
        "INSERT INTO sales(actor,status,lines,total,settings,posted_at) VALUES($1,'posted','[]',$2,'{\"currency\":\"PHP\"}',(($3::date-$4::int)::timestamp AT TIME ZONE 'Asia/Manila')) RETURNING id",
        [actor, amount, today, days],
      )
    ).rows[0];
    if (actor === counter) ownId = sale.id;
    await t.pool.query(
      "INSERT INTO payments(sale_id,amount,method) VALUES($1,$2,'cash')",
      [sale.id, amount],
    );
    await t.pool.query(
      "INSERT INTO returns(sale_id,actor,lines,reason,refund_status) VALUES($1,$2,'[]','Report fixture','pending')",
      [sale.id, manager],
    );
  }
  await t.pool.query(
    "INSERT INTO parts(sku,name,price,active,search_key) VALUES('LIVE','Active',1,true,'liveactive'),('OLD','Inactive',1,false,'oldinactive')",
  );
});
afterAll(async () => {
  await t?.close();
});

test("counter aggregates, payment amounts and return counts match its authorized source sales", async () => {
  const report = (await t.request(c, "GET", "/api/reports")).json();
  expect(report).toMatchObject({
    scope: "own-sales",
    salesCount: 1,
    salesTotal: "30.00",
    paymentTotal: "30.00",
    returns: 1,
    outstanding: null,
  });
  expect(report.recent.map((r: any) => r.id)).toEqual([ownId]);
  const history = (
    await t.request(c, "GET", "/api/sales?status=posted")
  ).json();
  expect(history.map((r: any) => r.id)).toEqual(
    report.recent.map((r: any) => r.id),
  );
  expect((await t.request(c, "GET", "/api/sales/" + ownId)).statusCode).toBe(
    200,
  );
});
test("stock reports contain inventory but no sales, tender, return or transaction references", async () => {
  const report = (await t.request(s, "GET", "/api/reports")).json();
  expect(report).toMatchObject({
    scope: "inventory",
    parts: 1,
    // The active part was created without a reorder point; the inactive one is ignored.
    noReorderPoint: 1,
    salesCount: null,
    salesTotal: null,
    paymentTotal: null,
    returns: null,
    recent: [],
  });
  expect(report.lowStock).toHaveLength(1);
  expect((await t.request(s, "GET", "/api/reports/export")).statusCode).toBe(
    403,
  );
});
test("manager's Philippine-today report equals its explicit date-range drilldown", async () => {
  const daily = (await t.request(m, "GET", "/api/reports?period=today")).json();
  expect(daily).toMatchObject({
    scope: "business",
    range: { from: today, to: today },
    parts: 1,
    salesCount: 2,
    salesTotal: "130.00",
    paymentTotal: "130.00",
  });
  const linked = (
    await t.request(
      m,
      "GET",
      "/api/reports?from=" + daily.range.from + "&to=" + daily.range.to,
    )
  ).json();
  expect(linked.recent).toEqual(daily.recent);
  expect(linked.salesTotal).toBe(daily.salesTotal);
  const all = (await t.request(m, "GET", "/api/reports")).json();
  expect(all.salesCount).toBe(3);
  expect(all.salesTotal).toBe("150.00");
});
