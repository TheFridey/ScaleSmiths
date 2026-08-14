import { expect, test } from "@playwright/test"

test("legal hub exposes every specialist policy", async ({ page }) => {
  await page.goto("/legal", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Clear terms")
  await expect(page.getByRole("link", { name: "Privacy Notice" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Managed Business Email Terms" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Data Processing Addendum" })).toBeVisible()
})

test("cookie choices are equal, persistent and reversible", async ({ page, context }) => {
  await context.clearCookies()
  await page.goto("/", { waitUntil: "domcontentloaded" })
  const panel = page.getByRole("dialog", { name: "Cookies and browser storage" })
  await expect(panel.getByRole("button", { name: "Accept all" })).toBeVisible()
  await expect(panel.getByRole("button", { name: "Reject non-essential" })).toBeVisible()
  await panel.getByRole("button", { name: "Reject non-essential" }).click()
  await expect(panel).toBeHidden()
  const rejected = await context.cookies()
  expect(rejected.find((cookie) => cookie.name === "ss_cookie_consent")?.value).toContain("analytics%22%3Afalse")

  await page.getByRole("button", { name: "Cookie Settings" }).click()
  await panel.getByRole("button", { name: "Accept all" }).click()
  const accepted = await context.cookies()
  expect(accepted.find((cookie) => cookie.name === "ss_cookie_consent")?.value).toContain("analytics%22%3Atrue")
})

test("legal pages remain readable on mobile and expose print metadata", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/legal/email-terms", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Managed Business Email Terms")
  await expect(page.getByText(/£15/).first()).toBeVisible()
  await expect(page.getByText(/3 custom-domain mailboxes/)).toBeVisible()
  await expect(page.getByText(/5GB storage per mailbox/)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
})
