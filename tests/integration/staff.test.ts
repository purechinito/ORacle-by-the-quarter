import { beforeEach, afterEach, test, expect } from "vitest";
import { setup } from "./support";
let t: Awaited<ReturnType<typeof setup>>, m: Record<string, string>;
beforeEach(async () => {
  t = await setup();
  m = await t.login();
});
afterEach(async () => {
  await t?.close();
});
async function staff(name: string, role = "counter") {
  return (
    await t.request(m, "POST", "/api/users", {
      username: name,
      password: t.password,
      role,
    })
  ).json();
}
test("deactivation revokes sessions, denies sign-in and retains auditable record", async () => {
  const u = await staff("inactive-test"),
    h = await t.login(u.username);
  const r = await t.request(m, "PUT", "/api/users/" + u.id, {
    role: "counter",
    active: false,
    version: 1,
    reason: "Staff departure",
  });
  expect(r.statusCode).toBe(200);
  expect(r.json()).toMatchObject({ active: false, version: 2 });
  expect((await t.request(h, "GET", "/api/me")).statusCode).toBe(401);
  expect(
    (
      await t.app.inject({
        method: "POST",
        url: "/api/login",
        payload: { username: u.username, password: t.password },
      })
    ).statusCode,
  ).toBe(401);
  expect(
    (
      await t.pool.query(
        "SELECT count(*)::int n FROM sessions WHERE user_id=$1",
        [u.id],
      )
    ).rows[0].n,
  ).toBe(0);
  expect(
    (
      await t.pool.query(
        "SELECT details FROM audit_events WHERE action='user.updated' AND record_id=$1",
        [u.id],
      )
    ).rows[0].details,
  ).toMatchObject({ reason: "Staff departure", active: false });
});
test("role change invalidates existing access and stale edits are rejected", async () => {
  const u = await staff("role-test"),
    h = await t.login(u.username);
  expect(
    (
      await t.request(m, "PUT", "/api/users/" + u.id, {
        role: "stock",
        active: true,
        version: 1,
        reason: "New assignment",
      })
    ).statusCode,
  ).toBe(200);
  expect((await t.request(h, "GET", "/api/me")).statusCode).toBe(401);
  expect(
    (
      await t.request(m, "PUT", "/api/users/" + u.id, {
        role: "manager",
        active: true,
        version: 1,
        reason: "Stale edit",
      })
    ).statusCode,
  ).toBe(409);
  const current = await t.login(u.username);
  expect((await t.request(current, "GET", "/api/me")).json().user.role).toBe(
    "stock",
  );
});
test("password reset revokes sessions without exposing passwords or hashes", async () => {
  const u = await staff("reset-test"),
    h = await t.login(u.username),
    next = "Changed-test-only-123456";
  const r = await t.request(m, "POST", "/api/users/" + u.id + "/password", {
    password: next,
    reason: "Identity checked in person",
  });
  expect(r.statusCode).toBe(200);
  expect(r.body).not.toContain(next);
  expect((await t.request(h, "GET", "/api/me")).statusCode).toBe(401);
  expect(
    (
      await t.app.inject({
        method: "POST",
        url: "/api/login",
        payload: { username: u.username, password: t.password },
      })
    ).statusCode,
  ).toBe(401);
  expect(
    (
      await t.app.inject({
        method: "POST",
        url: "/api/login",
        payload: { username: u.username, password: next },
      })
    ).statusCode,
  ).toBe(200);
  const audit = JSON.stringify(
    (
      await t.pool.query("SELECT * FROM audit_events WHERE record_id=$1", [
        u.id,
      ])
    ).rows,
  );
  expect(audit).not.toContain(next);
  expect(audit).not.toContain("password_hash");
  const users = await t.request(m, "GET", "/api/users");
  expect(users.body).not.toContain("password_hash");
});
test("only managers administer staff; self-lockout and last manager removal are refused", async () => {
  const manager = (await t.request(m, "GET", "/api/me")).json().user;
  expect(
    (
      await t.request(m, "PUT", "/api/users/" + manager.id, {
        role: "stock",
        active: false,
        version: 1,
        reason: "Must not lock out",
      })
    ).statusCode,
  ).toBe(409);
  const h = await t.login("counter");
  const u = await staff("permission-test");
  for (const [method, path, payload] of [
    [
      "PUT",
      "",
      { role: "manager", active: true, version: 1, reason: "No permission" },
    ],
    [
      "POST",
      "/password",
      { password: "Denied-test-only-123456", reason: "No permission" },
    ],
    ["POST", "/revoke-sessions", { reason: "No permission" }],
  ] as const)
    expect(
      (await t.request(h, method, "/api/users/" + u.id + path, payload))
        .statusCode,
    ).toBe(403);
});
test("explicit session revocation keeps account active but ends existing sessions", async () => {
  const u = await staff("revoke-test"),
    h = await t.login(u.username);
  expect(
    (
      await t.request(m, "POST", "/api/users/" + u.id + "/revoke-sessions", {
        reason: "Shared device signed out",
      })
    ).statusCode,
  ).toBe(200);
  expect((await t.request(h, "GET", "/api/me")).statusCode).toBe(401);
  expect(
    (await t.request(await t.login(u.username), "GET", "/api/me")).statusCode,
  ).toBe(200);
});
test("concurrent managers cannot disable one another and leave no active manager", async () => {
  const original = (await t.request(m, "GET", "/api/me")).json().user;
  const other = await staff("second-manager", "manager"),
    h = await t.login(other.username);
  const results = await Promise.all([
    t.request(m, "PUT", "/api/users/" + other.id, {
      role: "manager",
      active: false,
      version: 1,
      reason: "Concurrent operation A",
    }),
    t.request(h, "PUT", "/api/users/" + original.id, {
      role: "manager",
      active: false,
      version: 1,
      reason: "Concurrent operation B",
    }),
  ]);
  expect(results.filter((r) => r.statusCode === 200)).toHaveLength(1);
  expect(
    (
      await t.pool.query(
        "SELECT count(*)::int n FROM users WHERE active AND role='manager'",
      )
    ).rows[0].n,
  ).toBe(1);
});
