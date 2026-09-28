import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for frontend/e2e.
 *
 * By default it builds and starts the production app on :3000 (the origin the
 * specs seed cookies for). Set PLAYWRIGHT_BASE_URL to run against an already
 * running server or a preview deployment instead.
 */

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["list"], ["html", { open: "never" }]] : "list",
  outputDir: "test-results",
  use: {
    baseURL: externalBaseURL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: externalBaseURL
    ? undefined
    : {
        command: "npx next build && npx next start -p 3000",
        url: "http://localhost:3000",
        reuseExistingServer: !isCI,
        timeout: 300_000,
      },
});
