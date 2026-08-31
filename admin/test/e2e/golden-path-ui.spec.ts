import { expect, test, type Page } from "@playwright/test"

async function browserApi(page: Page, path: string, method: string, data: unknown) {
  return page.evaluate(async ({ path, method, data }) => {
    const response = await fetch(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(data) })
    return { ok: response.ok, status: response.status, body: await response.json() }
  }, { path, method, data })
}

test("operator converts a won opportunity and can open the resulting delivery workspace", async ({ page }) => {
  const businessName = `Golden UI ${Date.now()}`
  await page.goto("/prospects")
  const created = await browserApi(page, "/api/prospects", "POST", { businessName, stage: "won", estimatedMonthlyRetainer: 500 })
  expect(created.ok, `prospect API returned ${created.status}`).toBe(true)

  await page.goto("/prospects")
  await page.getByRole("button", { name: businessName }).first().click()
  await page.getByRole("button", { name: /^Convert to Client$/i }).click()
  await page.getByLabel(/Invoice code/i).fill(`GUI${Date.now().toString().slice(-6)}`)
  await page.getByLabel(/Create delivery project/i).check()
  await page.getByLabel(/Seed onboarding tasks/i).check()
  await page.getByLabel(/Prepare portal access/i).check()

  const services = page.getByRole("group", { name: "Services" }).getByRole("checkbox")
  if (await services.count()) {
    await services.first().check()
    await page.getByLabel(/Create draft invoice/i).check()
  }
  await page.getByRole("button", { name: "Convert to client", exact: true }).click()
  await expect(page.getByText(/Conversion completed/i)).toBeVisible()
  await expect(page.getByText(/Disabled portal account prepared/i)).toBeVisible()

  await page.getByRole("link", { name: /Open delivery project/i }).click()
  await expect(page).toHaveURL(/\/projects\/\d+/)
  await expect(page.getByText(businessName).first()).toBeVisible()
})
