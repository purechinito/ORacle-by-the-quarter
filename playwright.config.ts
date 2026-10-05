import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  use: {
    baseURL: process.env.ERP_BASE_URL ?? "http://127.0.0.1:5173",
    trace: "off",
    screenshot: "only-on-failure",
    // Optional: point at a preinstalled Chromium when Playwright's own download is unavailable.
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : {},
  },
  workers: 1,
});
