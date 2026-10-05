import { test, expect } from "@playwright/test";
// Manual/CI opt-in only; not run while authoring browser access is blocked.
test("manager can inspect the catalog and save a sales draft", async ({
  page,
}) => {
  if (!process.env.ERP_TEST_USERNAME || !process.env.ERP_TEST_PASSWORD)
    throw Error(
      "Set ERP_TEST_USERNAME and ERP_TEST_PASSWORD for a disposable demo database.",
    );
  await page.goto("/");
  await page
    .getByLabel("Username", { exact: true })
    .fill(process.env.ERP_TEST_USERNAME);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.ERP_TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in →" }).click();
  await expect(
    page.getByRole("heading", { name: "Shop overview" }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Parts", exact: false })
    .click();
  await page.getByLabel("Search parts").fill("DEMO-0002");
  await expect(page.getByRole("table")).toContainText("DEMO-0002");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Counter sales" })
    .click();
  await page.getByLabel("Find part").fill("DEMO-0002");
  await page
    .getByRole("button", { name: /Front brake pads.*DEMO-0002/ })
    .click();
  await page.getByRole("button", { name: "Save draft & calculate" }).click();
  await expect(page.getByRole("table")).toContainText("draft");
});
