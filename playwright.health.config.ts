import { defineConfig, devices } from "@playwright/test";

const SITE_URL =
  process.env.HEALTH_CHECK_URL ?? "https://d30kh3s27dfwbs.cloudfront.net";

export default defineConfig({
  testDir: "./tests/health",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: SITE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
