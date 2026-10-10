import { defineConfig, devices } from "@playwright/test"

// Browser tests (e2e/) use the production build, as visitors get it:
// `npm run build`, then `npm run test:browser`.

// Not 3000, so a dev server that's already running doesn't get in the way.
const PORT = 3100

export default defineConfig({
  testDir: "e2e",
  // The first PDF downloads the Typst compiler from jsDelivr.
  timeout: 120_000,
  expect: { timeout: 45_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // One retry in CI, recording a trace of the retry, so a failure can be
  // replayed from the run's "browser-test-report-<browser>-<part>" artifact.
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    // The trace is of the retry, which passes when a test is flaky. A picture of the failed try shows what went wrong.
    screenshot: "only-on-failure",
  },
  // Chrome, and WebKit for Safari, which most iPhone visitors use. CI splits
  // each one's tests across jobs (--project, --shard) that run at the same time.
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: `npx next start --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
})
