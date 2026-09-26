import { expect, test } from "@playwright/test"
import { gotoReady, rejectNonEssentialStorage, setExperience } from "./helpers"

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
] as const

const SECTION_HEADINGS = [
  /when the estate no longer matches the operation/i,
  /platforms for how the organisation actually works/i,
  /the engineering surface area behind the platform/i,
  /architecture follows the problem/i,
  /designed for controlled environments/i,
  /connect the estate without fragile bridges/i,
  /one operating model\. many places of work/i,
  /from operating constraint to controlled release/i,
  /senior enough for complexity/i,
  /technical depth already in public view/i,
  /discuss an enterprise system with the people who would build it/i,
] as const

test.describe("enterprise landing page", () => {
  test.describe.configure({ timeout: 300_000 })

  for (const viewport of VIEWPORTS) {
    test(`renders the enterprise route at ${viewport.name} without overflow`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await setExperience(page, "normal")
      await rejectNonEssentialStorage(page)

      const response = await gotoReady(page, "/enterprise")
      expect(response?.status()).toBe(200)

      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1)
      await expect(page.getByRole("heading", { level: 1 })).toContainText(/organisation actually operates/i)

      await expect(page.getByRole("link", { name: /discuss an enterprise system/i }).first()).toHaveAttribute("href", "/enterprise#discuss")
      await expect(page.getByRole("link", { name: /view technical work/i }).first()).toHaveAttribute("href", "/work")
      await expect(page.locator("#discuss")).toBeVisible()
      await expect(page.getByRole("link", { name: /start an enterprise enquiry/i })).toHaveAttribute("href", "/quote?intent=enterprise")

      for (const heading of SECTION_HEADINGS) {
        await expect(page.getByRole("heading", { name: heading })).toBeVisible()
      }

      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/enterprise$/)
      const jsonLd = (await page.locator('script[type="application/ld+json"]').allTextContents()).join(" ")
      expect(jsonLd).toContain("WebPage")
      expect(jsonLd).toContain("Service")
      expect(jsonLd).toContain("FAQPage")
      expect(jsonLd).toContain("BreadcrumbList")
      expect(jsonLd.toLowerCase()).not.toContain("iso 27001 certified")

      const report = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        h1Count: document.querySelectorAll("h1").length,
        hasHeader: Boolean(document.querySelector("header")),
        hasFooter: Boolean(document.querySelector("footer")),
      }))
      expect(report.overflow).toBe(false)
      expect(report.h1Count).toBe(1)
      expect(report.hasHeader).toBe(true)
      expect(report.hasFooter).toBe(true)
    })
  }

  test("exposes Enterprise in main and footer navigation", async ({ page }) => {
    await setExperience(page, "normal")
    await rejectNonEssentialStorage(page)
    await gotoReady(page, "/")

    const mainNavigation = page.getByRole("navigation", { name: /main navigation/i })
    await mainNavigation.getByRole("button", { name: "Services", exact: true }).click()
    await expect(mainNavigation.locator('a[href="/enterprise"]')).toBeVisible()
    await expect(mainNavigation.locator('a[href="/enterprise/delivery"]')).toBeVisible()

    const footer = page.getByRole("navigation", { name: /footer navigation/i })
    await expect(footer.getByRole("link", { name: "Enterprise", exact: true })).toHaveAttribute("href", "/enterprise")
    await expect(footer.getByRole("link", { name: "Enterprise Delivery", exact: true })).toHaveAttribute("href", "/enterprise/delivery")
  })
})
