import { beforeAll, afterAll, expect, test } from "vitest";
import { setup } from "./support";
let t: Awaited<ReturnType<typeof setup>>;
beforeAll(async () => {
  t = await setup();
});
afterAll(async () => {
  await t?.close();
});
test("unauthenticated requests cannot read parts", async () => {
  expect((await t.app.inject("/api/parts")).statusCode).toBe(401);
});
test("login creates a session, mutations require CSRF, logout revokes it", async () => {
  const login = await t.app.inject({
    method: "POST",
    url: "/api/login",
    payload: { username: "manager", password: t.password },
  });
  expect(login.statusCode).toBe(200);
  const cookie = login.headers["set-cookie"]!.toString().split(";")[0];
  expect(login.headers["set-cookie"]).toContain("HttpOnly");
  expect(
    (await t.app.inject({ url: "/api/me", headers: { cookie } })).json().user
      .role,
  ).toBe("manager");
  expect(
    (
      await t.app.inject({
        method: "POST",
        url: "/api/logout",
        headers: { cookie },
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (
      await t.app.inject({
        method: "POST",
        url: "/api/logout",
        headers: { cookie, "x-csrf-token": login.json().csrf },
      })
    ).statusCode,
  ).toBe(200);
  expect(
    (await t.app.inject({ url: "/api/me", headers: { cookie } })).statusCode,
  ).toBe(401);
});
test("counter cannot create users and expired sessions are denied", async () => {
  const c = await t.login("counter");
  expect(
    (
      await t.request(c, "POST", "/api/users", {
        username: "evil",
        password: "A-long-passphrase123",
        role: "manager",
      })
    ).statusCode,
  ).toBe(403);
  await t.pool.query(
    "UPDATE sessions SET expires_at=now()-interval '1 minute'",
  );
  expect((await t.request(c, "GET", "/api/me")).statusCode).toBe(401);
});
test("failed login attempts are throttled", async () => {
  let status = 0;
  for (let i = 0; i < 12; i++)
    status = (
      await t.app.inject({
        method: "POST",
        url: "/api/login",
        payload: { username: "missing", password: "wrong" },
      })
    ).statusCode;
  expect(status).toBe(429);
});
