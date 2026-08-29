import { expect, test } from "@playwright/test"

const demoEmail = process.env.DEMO_PORTAL_EMAIL
const demoPassword = process.env.DEMO_PORTAL_PASSWORD
const demoClientId = process.env.DEMO_PORTAL_CLIENT_ID
const demoEnabled = process.env.DEMO_PORTAL_ENABLED === "true" && demoEmail && demoPassword && demoClientId

test.skip(!demoEnabled, "Requires DEMO_PORTAL_ENABLED with DEMO_PORTAL_EMAIL/PASSWORD/CLIENT_ID configured for the e2e environment.")

async function loginAsDemoClient(page: import("@playwright/test").Page) {
  await page.goto("/portal/login")
  await page.getByLabel("Email", { exact: true }).fill(demoEmail!)
  await page.getByLabel("Password", { exact: true }).fill(demoPassword!)
  await page.getByRole("button", { name: /enter portal/i }).click()
  await page.waitForURL(new RegExp(`/portal/${demoClientId}$`), { timeout: 15_000 })
}

test("unauthenticated visitors are redirected to the portal login before seeing project data", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const page = await context.newPage()

  await page.goto(`/portal/${demoClientId}?tab=board`)
  await expect(page).toHaveURL(/\/portal\/login/)

  await context.close()
})

test("a signed-in client cannot open another client's portal by editing the URL", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const page = await context.newPage()

  await loginAsDemoClient(page)
  await page.goto("/portal/some-other-client-id?tab=board")
  await expect(page).toHaveURL(new RegExp(`/portal/${demoClientId}$`))

  await context.close()
})

test("the project board shows the empty state when no client-visible project has been published", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const page = await context.newPage()

  await loginAsDemoClient(page)
  await page.goto(`/portal/${demoClientId}?tab=board`)

  await expect(page.getByRole("heading", { name: "No project published yet" })).toBeVisible()
  for (const placeholder of ["Workspace opened", "Discovery and scope", "Design direction", "Build and review", "Launch and handoff"]) {
    await expect(page.getByText(placeholder, { exact: false })).toHaveCount(0)
  }

  await context.close()
})
