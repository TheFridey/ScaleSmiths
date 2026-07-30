import { expect, test as setup } from "@playwright/test"
import { mkdir } from "node:fs/promises"

const authFile = "test-results/.auth/forge-owner.json"

setup("authenticate through the real credentials flow", async ({ page }) => {
  setup.setTimeout(150_000)
  const password = process.env.ADMIN_E2E_PASSWORD
  if (!password) throw new Error("ADMIN_E2E_PASSWORD is required.")

  await page.goto("/login")
  await page.getByLabel("Email", { exact: true }).fill("forge-owner@example.test")
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.waitForURL(/\/dashboard$/, { timeout: 90_000 })
  await expect(page.locator("#admin-main-content")).toBeVisible()
  await expect(page.getByRole("navigation")).toBeVisible()

  await mkdir("test-results/.auth", { recursive: true })
  await page.context().storageState({ path: authFile })
})
