import { expect, test } from "@playwright/test"
import { mkdir } from "node:fs/promises"

for (const mobile of [false, true]) {
  test(`Venture Controller can use the operational admin and Nova ${mobile ? "on mobile" : "on desktop"}`, async ({ browser }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    })
    const page = await context.newPage()
    try {
      await page.goto("/login")
      await page.getByLabel("Email", { exact: true }).fill("trev-controller@example.test")
      await page.getByLabel("Password", { exact: true }).fill(process.env.ADMIN_E2E_PASSWORD ?? "")
      await page.getByRole("button", { name: "Sign in", exact: true }).click()
      await page.waitForURL(/\/command-centre$/)
      await expect(page.locator("#admin-main-content")).toBeVisible()
      if (mobile) await page.getByRole("button", { name: "Open navigation", exact: true }).click()
      const navigation = mobile ? page.getByRole("dialog", { name: "Navigation", exact: true }).getByRole("navigation") : page.getByRole("navigation", { name: "Main navigation" })
      for (const name of ["Command Centre", "Pipeline", "Forge"]) {
        await expect(navigation.getByRole("link", { name, exact: true })).toBeVisible()
      }
      await navigation.getByRole("button", { name: "Venture Lab", exact: true }).click()
      await expect(navigation.getByRole("link", { name: "Nova Venture Lab", exact: true })).toBeVisible()
      await mkdir("test-results/workspace-review", { recursive: true })
      await page.screenshot({ path: `test-results/workspace-review/trev-controller-${mobile ? "mobile" : "desktop"}.png` })
      await navigation.getByRole("link", { name: "Pipeline", exact: true }).click()
      await expect(page).toHaveURL(/\/prospects$/)
      if (mobile) await expect(page.getByRole("dialog", { name: "Navigation", exact: true })).toBeHidden()
      for (const path of ["/dashboard", "/clients", "/projects", "/forge", "/finance/invoices", "/venture-lab"]) {
        const response = await page.goto(path)
        expect(response?.status(), path).toBe(200)
        await expect(page).toHaveURL(new RegExp(`${path}$`))
      }
      const metadata = await context.request.get("/manifest.webmanifest")
      expect(metadata.status()).toBe(200)
      const manifest = await metadata.json()
      expect(manifest.id).toBe("/command-centre") // Preserve installed-app identity.
      expect(manifest.start_url).toBe("/")
      await page.goto(manifest.start_url)
      await expect(page).toHaveURL(/\/command-centre$/)
      expect(await context.request.get("/api/auth/session").then((response) => response.json()).then((session) => session.user.role)).toBe("venture_controller")
    } finally { await context.close() }
  })
}

test("authenticated owner can open a protected Forge route with RBAC navigation", async ({ page }) => {
  await page.goto("/forge")
  await expect(page).toHaveURL(/\/forge$/)
  await expect(page.locator("#admin-main-content")).toBeVisible()
  await expect(page.getByRole("navigation").getByRole("link", { name: "Forge", exact: true })).toBeVisible()
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Administration", exact: true }).click()
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


test("only named brand assets are public while Forge remains private", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  for (const asset of ["/brand/favicon.png", "/app-icon/192"]) {
    const response = await context.request.get(asset, { maxRedirects: 0 })
    expect(response.status()).toBe(200)
    expect(response.headers()["content-type"]).toMatch(/image/)
  }
  const response = await context.request.get("/forge", { maxRedirects: 0 })
  expect(response.status()).toBe(307)
  expect(response.headers().location).toContain("/login")
  await context.close()
})
