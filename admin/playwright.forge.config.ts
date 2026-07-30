import { defineConfig, devices } from "@playwright/test"

const port = Number(process.env.ADMIN_FORGE_PLAYWRIGHT_PORT ?? 3312)
const baseURL = process.env.ADMIN_FORGE_BASE_URL ?? `http://127.0.0.1:${port}`
const serverCommand = process.env.ADMIN_FORGE_SERVER_MODE === "production"
  ? `npm run start -- --hostname 127.0.0.1 --port ${port}`
  : `npm run dev -- --hostname 127.0.0.1 --port ${port}`

export default defineConfig({
  testDir: "./test/e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-forge-report" }]],
  use: {
    baseURL,
    colorScheme: "dark",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "auth-setup",
      testMatch: "auth.setup.ts",
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "test-results/.auth/forge-owner.json",
      },
      dependencies: ["auth-setup"],
      testIgnore: "auth.setup.ts",
    },
  ],
  outputDir: "test-results/forge-e2e",
  webServer: process.env.ADMIN_FORGE_BASE_URL
    ? undefined
    : {
        command: serverCommand,
        url: `${baseURL}/login`,
        reuseExistingServer: true,
        timeout: 180_000,
      },
})
