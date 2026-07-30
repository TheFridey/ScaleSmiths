import { defineConfig } from "@playwright/test"

const port = Number(process.env.ADMIN_SHELL_PLAYWRIGHT_PORT ?? 3311)
const baseURL = process.env.ADMIN_SHELL_BASE_URL ?? `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: "./test/visual",
  testMatch: "admin-shell.visual.spec.ts",
  timeout: 90_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.015,
    },
  },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-shell-report" }]],
  use: {
    baseURL,
    colorScheme: "dark",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  outputDir: "test-results/admin-shell",
  webServer: process.env.ADMIN_SHELL_BASE_URL
    ? undefined
    : {
        command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 180_000,
      },
})
