import { defineConfig, devices } from "@playwright/test"

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3210)
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`
const isCI = Boolean(process.env.CI)

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 7_500,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.02,
    },
  },
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1,
  reporter: isCI ? [["list"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    colorScheme: "dark",
  },
  outputDir: "test-results",
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /.*\.cross-browser\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } },
    },
    {
      name: "chromium-tablet",
      testMatch: /.*\.visual\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1024, height: 768 },
        colorScheme: "dark",
      },
    },
    {
      name: "chromium-mobile",
      testMatch: /.*\.visual\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        colorScheme: "dark",
      },
    },
    {
      name: "firefox-smoke",
      testMatch: /.*\.cross-browser\.spec\.ts/,
      use: { ...devices["Desktop Firefox"], viewport: { width: 1280, height: 900 } },
    },
    {
      name: "webkit-smoke",
      testMatch: /.*\.cross-browser\.spec\.ts/,
      use: { ...devices["Desktop Safari"], viewport: { width: 1280, height: 900 } },
    },
  ],
})
