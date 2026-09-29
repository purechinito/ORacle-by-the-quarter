import { test, expect, type Browser, type Page } from "@playwright/test";
// Browser walkthrough of the supervised-pilot checklist (docs/PILOT.md) against
// a disposable demo database started with `npm run dev`. Opt-in: it needs the
// manager login from .data/dev-credentials.json and creates staff and records.
const manager = {
  username: process.env.ERP_TEST_USERNAME ?? "",
  password: process.env.ERP_TEST_PASSWORD ?? "",
};
const run = Date.now().toString(36);
const staffPassword = "pilot-password-" + run;
const counter = { username: "counter-" + run, password: staffPassword };
const stock = { username: "stock-" + run, password: staffPassword };
const SKU = "DEMO-0006";

test.describe.configure({ mode: "serial" });
test.skip(
  !manager.username || !manager.password,
  "Set ERP_TEST_USERNAME and ERP_TEST_PASSWORD for a disposable demo database.",
);

async function signIn(browser: Browser, who: typeof manager) {
  const page = await browser.newPage();
  page.on("dialog", (d) => d.accept(dialogAnswers.shift() ?? ""));
  await page.goto("/");
  await page.getByLabel("Username", { exact: true }).fill(who.username);
  await page.getByLabel("Password", { exact: true }).fill(who.password);
  await page.getByRole("button", { name: "Sign in →" }).click();
  await expect(
    page.getByRole("heading", { name: "Shop overview" }),
  ).toBeVisible();
  return page;
}
const dialogAnswers: string[] = [];
async function go(page: Page, section: string) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name: section })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: section }),
  ).toBeVisible();
}
async function onHand(page: Page, sku: string) {
  const res = await page.evaluate(
    async (q) => (await fetch("/api/parts?q=" + q + "&limit=8")).json(),
    sku,
  );
  const part = res.items.find((p: any) => p.sku === sku);
  return Number(part.stock);
}
async function sellAll(page: Page, qty: number) {
  await go(page, "Counter sales");
  await page.getByLabel("Find part").fill(SKU);
  await page.getByLabel("Find part").press("Enter");
  await page.getByLabel("Quantity for " + SKU).fill(String(qty));
  await page.getByRole("button", { name: "Save draft & calculate" }).click();
  await expect(page.getByText("Total", { exact: false }).first()).toBeVisible();
}

let managerPage: Page;
test("manager configures the shop and adds counter and stock staff", async ({
  browser,
}) => {
  managerPage = await signIn(browser, manager);
  await go(managerPage, "Settings");
  await managerPage.getByLabel("Shop name").fill("Pilot Auto Supply");
  await managerPage
    .getByLabel("VAT treatment")
    .selectOption({ label: "No VAT charged on these sales" });
  await managerPage.getByLabel("Confirmed VAT rate (%)").fill("0");
  await managerPage.getByRole("button", { name: "Save configuration" }).click();
  await expect(managerPage.getByText("Shop settings saved.")).toBeVisible();
  for (const [who, role] of [
    [counter, "Counter staff"],
    [stock, "Stock clerk"],
  ] as const) {
    await managerPage.getByRole("button", { name: "+ Add staff" }).click();
    await managerPage.getByLabel("Username").fill(who.username);
    await managerPage
      .getByLabel("New password (at least 12 characters)")
      .fill(who.password);
    await managerPage.getByLabel("Role").selectOption({ label: role });
    await managerPage.getByRole("button", { name: "Save account" }).click();
    await expect(managerPage.getByText(who.username).first()).toBeVisible();
  }
});

test("purchase order is received in two deliveries and cannot be over-received", async ({
  browser,
}) => {
  const before = await onHand(managerPage, SKU);
  await go(managerPage, "Purchasing");
  await managerPage.getByRole("button", { name: "+ Purchase order" }).click();
  dialogAnswers.push("Pilot Supplier " + run);
  await managerPage.getByRole("button", { name: "+ Add supplier" }).click();
  await expect(managerPage.getByText("Pilot Supplier " + run)).toBeVisible();
  await managerPage.getByLabel("Find part").fill(SKU);
  await managerPage.getByLabel("Find part").press("Enter");
  await managerPage.getByLabel("Quantity").fill("10");
  await managerPage.getByLabel("Unit cost (₱)").fill("7.50");
  await managerPage.getByRole("button", { name: "Save draft order" }).click();
  const draft = managerPage.getByRole("row").filter({ hasText: "draft" });
  await draft.first().getByRole("button", { name: "Submit order" }).click();
  await expect(
    managerPage.getByRole("row").filter({ hasText: "submitted" }).first(),
  ).toBeVisible();

  const clerk = await signIn(browser, stock);
  await go(clerk, "Purchasing");
  const order = clerk.getByRole("row").filter({ hasText: "submitted" }).first();
  for (const [qty, status] of [
    ["4", "partial"],
    ["6", "received"],
  ]) {
    await clerk
      .getByRole("row")
      .filter({ hasText: /submitted|partial/ })
      .first()
      .getByRole("button", { name: "Receive stock" })
      .click();
    await clerk.getByLabel(/outstanding/).fill(qty);
    await clerk.getByRole("button", { name: "Post receipt" }).click();
    await expect(
      clerk.getByRole("row").filter({ hasText: status }).first(),
    ).toBeVisible();
  }
  const received = clerk.getByRole("row").filter({ hasText: "10 / 10" });
  await expect(received.first()).toBeVisible();
  await expect(
    received.first().getByRole("button", { name: "Receive stock" }),
  ).toHaveCount(0);
  await received.first().getByRole("button", { name: "View order" }).click();
  await expect(
    clerk.getByRole("columnheader", { name: "Unit cost" }),
  ).toHaveCount(0);
  await expect(clerk.getByText("₱7.50")).toHaveCount(0);
  expect(await onHand(clerk, SKU)).toBe(before + 10);
  void order;
  await clerk.close();
});

test("counter staff scan, sell with cash change, and the last units sell only once", async ({
  browser,
}) => {
  const seller = await signIn(browser, counter);
  await go(seller, "Counter sales");
  await seller.getByLabel("Find part").fill(SKU);
  await seller.getByLabel("Find part").press("Enter");
  await expect(seller.getByLabel("Quantity for " + SKU)).toHaveValue("1");
  await seller.getByRole("button", { name: "Save draft & calculate" }).click();
  await seller.getByLabel("Payment received (₱)").fill("100");
  await seller.getByRole("button", { name: "Complete sale →" }).click();
  const receipt = seller.getByRole("dialog");
  await expect(receipt.getByText("Change due")).toBeVisible();
  await expect(receipt.getByText("₱85.75")).toBeVisible();
  await expect(
    receipt.getByRole("button", { name: "Record a return" }),
  ).toHaveCount(0);
  await receipt.getByRole("button", { name: "Close dialog" }).click();

  const remaining = await onHand(seller, SKU);
  const rival = await signIn(browser, manager);
  await sellAll(seller, remaining);
  await sellAll(rival, remaining);
  await seller.getByLabel("Payment received (₱)").fill("10000");
  await rival.getByLabel("Payment received (₱)").fill("10000");
  await Promise.all([
    seller.getByRole("button", { name: "Complete sale →" }).click(),
    rival.getByRole("button", { name: "Complete sale →" }).click(),
  ]);
  for (const p of [seller, rival])
    await expect(p.getByRole("button", { name: "Posting…" })).toHaveCount(0);
  const receipts = (
    await Promise.all(
      [seller, rival].map((p) => p.getByText("Change due").count()),
    )
  ).reduce((a, b) => a + b, 0);
  expect(receipts).toBe(1);
  const loser = (await seller.getByText("Change due").count()) ? rival : seller;
  await expect(loser.getByLabel("Quantity for " + SKU)).toBeVisible();
  const notice = loser.locator(".basket .notice");
  await expect(notice).toContainText(/stock/i);
  await expect(notice).toBeInViewport();
  await loser.screenshot({ path: "test-results/last-unit-loser.png" });
  expect(await onHand(seller, SKU)).toBe(0);
  await seller.close();
  await rival.close();
});

test("manager records a restockable and a damaged return against a sale", async () => {
  // Out of stock now: restock one unit through a count adjustment first.
  await go(managerPage, "Stock movements");
  await managerPage
    .getByRole("button", { name: "+ Record stock change" })
    .click();
  await managerPage.getByLabel("Find part").fill(SKU);
  await managerPage.getByLabel("Find part").press("Enter");
  await managerPage.getByLabel("Quantity change (+ add / − remove)").fill("2");
  await managerPage.getByLabel("Reason").fill("Pilot count correction");
  await managerPage.getByRole("button", { name: "Post stock change" }).click();
  await expect.poll(() => onHand(managerPage, SKU)).toBe(2);

  await sellAll(managerPage, 2);
  await managerPage.getByLabel("Payment received (₱)").fill("100");
  await managerPage.getByRole("button", { name: "Complete sale →" }).click();
  const receipt = managerPage.getByRole("dialog");
  await expect(receipt.getByText("Change due")).toBeVisible();
  for (const restock of [true, false]) {
    await receipt.getByRole("button", { name: "Record a return" }).click();
    await receipt.getByRole("spinbutton").first().fill("1");
    if (!restock)
      await receipt.getByLabel("Return to sellable stock").uncheck();
    await receipt
      .getByLabel("Reason")
      .fill(restock ? "Wrong part" : "Damaged box");
    await receipt.getByRole("button", { name: "Post return" }).click();
    await expect(managerPage.getByRole("dialog")).toHaveCount(0);
    await managerPage
      .getByRole("row")
      .filter({ hasText: "posted" })
      .first()
      .getByRole("button", { name: "View receipt" })
      .click();
  }
  await expect(receipt.getByText("Return history")).toBeVisible();
  expect(await onHand(managerPage, SKU)).toBe(1);
});

test("counter and stock roles are refused privileged API calls directly", async ({
  browser,
}) => {
  for (const who of [counter, stock]) {
    const page = await signIn(browser, who);
    const statuses = await page.evaluate(async () => {
      const { csrf } = await (await fetch("/api/me")).json();
      const get = (u: string) => fetch(u).then((r) => r.status);
      const post = (u: string, body: unknown) =>
        fetch(u, {
          method: "POST",
          headers: { "content-type": "application/json", "x-csrf-token": csrf },
          body: JSON.stringify(body),
        }).then((r) => r.status);
      return {
        users: await get("/api/users"),
        finance: await get("/api/finance/accounts"),
        adjust: await post("/api/stock", {}),
      };
    });
    expect(statuses.users).toBe(403);
    expect(statuses.finance).toBe(403);
    expect([400, 403]).toContain(statuses.adjust);
    await page.close();
  }
});
