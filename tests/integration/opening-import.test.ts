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
test("opening stock has a preview, rejects bad rows and posts once", async () => {
  await t.request(m, "POST", "/api/parts", {
    sku: "OPEN-A",
    name: "Opening part",
    price: "2.00",
  });
  const bad = await t.request(m, "POST", "/api/stock-import/preview", {
    csv: "sku,qty\nMISSING,2\nOPEN-A,1.5",
  });
  expect(bad.statusCode).toBe(200);
  expect(bad.json().errors).toHaveLength(2);
  const good = await t.request(m, "POST", "/api/stock-import/preview", {
    csv: "sku,qty\nOPEN-A,12",
  });
  expect(good.json().errors).toEqual([]);
  const a = await t.request(m, "POST", "/api/stock-import/commit", {
    id: good.json().id,
  });
  expect(a.statusCode).toBe(200);
  expect(
    (
      await t.request(m, "POST", "/api/stock-import/commit", {
        id: good.json().id,
      })
    ).json(),
  ).toEqual(a.json());
  expect(
    (await t.request(m, "GET", "/api/parts?q=OPEN-A")).json().items[0].stock,
  ).toBe(12);
  expect(
    (await t.request(m, "POST", "/api/import/commit", { id: good.json().id }))
      .statusCode,
  ).toBe(404);
});
