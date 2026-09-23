import { expect, test } from "@playwright/test"
import { gotoReady, installConsoleGuards, mockExperienceAnalytics, rejectNonEssentialStorage } from "./helpers"

test.describe.configure({ timeout: 600_000 })

const routes = [
  "/web-design-nottingham",
  "/website-redesign-nottingham",
  "/local-seo-nottingham",
  "/website-maintenance-nottingham",
  "/e-commerce-development-nottingham",
  "/web-development-nottingham",
  "/custom-software-development-uk",
  "/business-automation-nottingham",
  "/seo-website-audit",
  "/managed-website-hosting",
  "/next-js-agency-uk",
  "/locations/nottingham",
  "/locations/hucknall",
] as const

for (const viewport of [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 390, height: 844 }] as const) {
  test(`${viewport.name} commercial pages are indexable, usable and error-free`, async ({ page }) => {
    page.setViewportSize({ width: viewport.width, height: viewport.height })
    page.setDefaultNavigationTimeout(60_000)
    await rejectNonEssentialStorage(page)
    await mockExperienceAnalytics(page)
    const consoleGuards = await installConsoleGuards(page)

    for (const route of routes) {
      const response = await gotoReady(page, route)
      expect(response?.status(), route).toBe(200)
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1)
      await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /\S+/)
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`${route.replaceAll("/", "\\/")}$`))
      expect(await page.locator('script[type="application/ld+json"]').count(), route).toBeGreaterThan(0)
      await expect(page.locator("header").first()).toBeVisible()
      await expect(page.locator("footer")).toBeVisible()
      await expect(page.getByRole("link", { name: /discuss this service|discuss a project/i }).first()).toHaveAttribute("href", "/quote")
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, `${route} horizontal overflow`).toBeLessThanOrEqual(1)
    }
    await consoleGuards.expectClean()
  })
}
