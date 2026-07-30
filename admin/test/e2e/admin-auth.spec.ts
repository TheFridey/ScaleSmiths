import { expect, test } from "@playwright/test"

test("authenticated owner can open a protected Forge route with RBAC navigation", async ({ page }) => {
  await page.goto("/forge")
  await expect(page).toHaveURL(/\/forge$/)
  await expect(page.locator("#admin-main-content")).toBeVisible()
  await expect(page.getByRole("navigation").getByRole("link", { name: "Forge", exact: true })).toBeVisible()
  await expect(page.getByRole("navigation").getByRole("link", { name: "Admin users", exact: true })).toBeVisible()
})

test("invalid credentials are rejected by the real credentials provider", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const page = await context.newPage()
  await page.goto("/login")
  await page.getByLabel("Email", { exact: true }).fill("forge-owner@example.test")
  await page.getByLabel("Password", { exact: true }).fill("not-the-fixture-password")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await expect(page.getByText("Invalid credentials", { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
  await context.close()
})

test("logout revokes the browser session and returns to login", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const page = await context.newPage()
  await page.goto("/login")
  await page.getByLabel("Email", { exact: true }).fill("forge-logout@example.test")
  await page.getByLabel("Password", { exact: true }).fill(process.env.ADMIN_E2E_PASSWORD ?? "")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.waitForURL(/\/dashboard$/, { timeout: 30_000 })
  const signOut = page.getByRole("button", { name: "Sign out", exact: true })
  await expect(signOut).toBeVisible()
  await signOut.click()
  await page.waitForURL(/\/login$/, { timeout: 30_000 })
  await page.goto("/forge")
  await expect(page).toHaveURL(/\/login/)
  await context.close()
})
