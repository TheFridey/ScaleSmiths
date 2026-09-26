import { expect, test } from "@playwright/test"
import { gotoReady, rejectNonEssentialStorage, setExperience } from "./helpers"

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
] as const

const SECTION_HEADINGS = [
  /discovery → production → expansion/i,
  /fourteen phases from first conversation/i,
  /understand the estate before proposing the system/i,
  /artifacts that make scope inspectable/i,
  /chosen for the operating environment/i,
  /prove behaviour before asking for acceptance/i,
  /client acceptance before production rollout/i,
  /scope changes are decisions/i,
  /versioned releases with a path back/i,
  /handover materials that match the system that shipped/i,
  /maintenance is not unlimited development/i,
  /begin with the operating problem/i,
] as const

test.describe("enterprise delivery page", () => {
  test.describe.configure({ timeout: 300_000 })

  for (const viewport of VIEWPORTS) {
    test(`renders /enterprise/delivery at ${viewport.name} without overflow`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await setExperience(page, "normal")
      await rejectNonEssentialStorage(page)

      const response = await gotoReady(page, "/enterprise/delivery")
      expect(response?.status()).toBe(200)

      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1)
      await expect(page.getByRole("heading", { level: 1 })).toContainText(/founder-led engineering with structured enterprise delivery/i)
      await expect(page.getByRole("link", { name: /start with discovery/i }).first()).toHaveAttribute("href", "/enterprise/delivery#start-discovery")
      await expect(page.getByRole("link", { name: /discuss your existing systems/i }).first()).toHaveAttribute("href", "/quote?intent=enterprise")
      await expect(page.locator("#start-discovery")).toBeVisible()
      await expect(page.getByRole("list", { name: /enterprise delivery stages/i })).toBeVisible()
      await expect(page.getByRole("list", { name: /enterprise delivery stages/i }).getByRole("listitem")).toHaveCount(7)

      for (const heading of SECTION_HEADINGS) {
        await expect(page.getByRole("heading", { name: heading })).toBeVisible()
      }

      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/enterprise\/delivery$/)
      const jsonLd = (await page.locator('script[type="application/ld+json"]').allTextContents()).join(" ")
      expect(jsonLd).toContain("WebPage")
      expect(jsonLd).toContain("HowTo")
      expect(jsonLd).toContain("FAQPage")
      expect(jsonLd).toContain("BreadcrumbList")

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

  test("is linked from the enterprise landing page", async ({ page }) => {
    await setExperience(page, "normal")
    await rejectNonEssentialStorage(page)
    await gotoReady(page, "/enterprise")
    await expect(page.getByRole("link", { name: /enterprise delivery|delivery process|view delivery/i }).first()).toHaveAttribute("href", "/enterprise/delivery")
  })
})
