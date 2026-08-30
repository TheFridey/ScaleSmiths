import { expect, test, type Page } from "@playwright/test"

async function browserApi(page: Page, path: string, method = "GET", data?: unknown) {
  return page.evaluate(async ({ path: requestPath, method: requestMethod, data: requestData }) => {
    const response = await fetch(requestPath, {
      method: requestMethod,
      cache: "no-store",
      headers: requestData === undefined ? undefined : { "content-type": "application/json" },
      body: requestData === undefined ? undefined : JSON.stringify(requestData),
    })
    return { ok: response.ok, status: response.status, body: await response.json() }
  }, { path, method, data })
}

test("won prospect converts to a client with a delivery project and onboarding tasks", async ({ page }) => {
  const businessName = `E2E Convert ${Date.now()}`

  await page.goto("/prospects")
  const created = await browserApi(page, "/api/prospects", "POST", {
    businessName,
    stage: "won",
    estimatedMonthlyRetainer: 400,
  })
  expect(created.ok, `POST /api/prospects returned ${created.status}`).toBe(true)
  const prospect = (created.body as { prospect: { id: number; businessName: string } }).prospect
  expect(prospect.id).toBeGreaterThan(0)

  await page.goto("/prospects")
  await page.getByRole("button", { name: prospect.businessName }).first().click()

  await page.getByRole("button", { name: /^Convert to Client$/i }).click()
  await expect(page.getByText(/Convert opportunity to client/i)).toBeVisible()

  await page.getByLabel(/Invoice code/i).fill("E2ECONV")
  await page.getByLabel(/Create delivery project/i).check()
  await page.getByLabel(/Seed onboarding tasks/i).check()

  await page.getByRole("button", { name: "Convert to client", exact: true }).click()
  await expect(page.getByText(/Conversion completed/i)).toBeVisible()

  await page.getByRole("link", { name: /Open client/i }).click()
  await expect(page).toHaveURL(/\/clients\/\d+/)

  await page.goto("/prospects")
  await page.getByRole("button", { name: prospect.businessName }).first().click()
  await expect(page.getByRole("button", { name: /^Converted$/ })).toBeVisible()
})
