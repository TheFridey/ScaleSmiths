import { expect, test } from "@playwright/test"

test.describe("Managed Business Email", () => {
  test("presents the confirmed offer and a credential-safe onboarding route", async ({ page }) => {
    await page.goto("/services/managed-business-email", { waitUntil: "domcontentloaded" })
    await expect(page.getByRole("heading", { level: 1, name: /Professional email/i })).toBeVisible()
    await expect(page.getByText("£15", { exact: true })).toBeVisible()
    await expect(page.getByText("3", { exact: true })).toBeVisible()
    await expect(page.getByText("5GB", { exact: true })).toBeVisible()
    await expect(page.getByText(/Initial setup included/i).first()).toBeVisible()

    await page.getByRole("link", { name: /Set up my email/i }).click()
    await expect(page).toHaveURL(/managed-business-email\/get-started/)
    await expect(page.getByLabel("Business name")).toBeVisible()
    await expect(page.getByText(/Never enter a registrar, DNS or email password/i)).toBeVisible()
    await expect(page.locator('input[type="password"]')).toHaveCount(0)
    await expect(page.locator("body")).not.toContainText(/Mailcow|SOGo/)
  })

  test("keeps the service understandable on mobile with reduced motion", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/services/managed-business-email", { waitUntil: "domcontentloaded" })
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expect(page.getByRole("link", { name: /Get business email/i })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })
})
