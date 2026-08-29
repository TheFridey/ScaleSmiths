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

test("sending a portal message stores it and shows it in the thread, with no mailto link on the happy path", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const page = await context.newPage()

  await loginAsDemoClient(page)
  await page.goto(`/portal/${demoClientId}?tab=messages`)

  const uniqueBody = `E2E portal message ${Date.now()}`
  await page.getByLabel("Message", { exact: true }).fill(uniqueBody)
  await page.getByRole("button", { name: /send message/i }).click()

  await expect(page.getByText(uniqueBody)).toBeVisible()
  await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0)

  await context.close()
})

test("reloading the messages tab shows the previously sent message from persisted storage", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const page = await context.newPage()

  await loginAsDemoClient(page)
  await page.goto(`/portal/${demoClientId}?tab=messages`)

  const uniqueBody = `E2E persisted message ${Date.now()}`
  await page.getByLabel("Message", { exact: true }).fill(uniqueBody)
  await page.getByRole("button", { name: /send message/i }).click()
  await expect(page.getByText(uniqueBody)).toBeVisible()

  await page.reload()
  await expect(page.getByText(uniqueBody)).toBeVisible()

  await context.close()
})
