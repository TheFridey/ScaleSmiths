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

test("a portal session cookie cannot open Forge pages or APIs", async ({ browser, request }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  await context.addCookies([{ name: "ss-client-session", value: "compromised-portal-session", domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }])
  const page = await context.newPage()
  await page.goto("/forge")
  await expect(page).toHaveURL(/\/login/)

  for (const target of ["/api/forge/health", "/api/forge/projects/1", "/api/forge/runs/1"]) {
    const response = await request.get(target, { headers: { Cookie: "ss-client-session=compromised-portal-session" } })
    expect(response.status()).toBe(401)
    expect(await response.json()).toEqual({ error: "Unauthorized." })
  }
  const mutation = await request.post("/api/forge/runs/1/start", { headers: { Cookie: "ss-client-session=compromised-portal-session" } })
  expect(mutation.status()).toBe(401)
  expect(await mutation.json()).toEqual({ error: "Unauthorized." })
  await context.close()
})
