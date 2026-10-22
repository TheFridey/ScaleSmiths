import { expect, test } from "@playwright/test"
import { gotoReady, rejectNonEssentialStorage, setExperience } from "./helpers"

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
] as const

test.describe("enterprise websites page", () => {
  test.describe.configure({ timeout: 300_000 })

  for (const viewport of VIEWPORTS) {
    test(`renders /enterprise-websites at ${viewport.name} without overflow`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await setExperience(page, "normal")
      await rejectNonEssentialStorage(page)

      const response = await gotoReady(page, "/enterprise-websites")
      expect(response?.status()).toBe(200)

      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1)
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        /Enterprise Websites & Digital Experiences Built Around Your Organisation/i,
      )
      await expect(page.getByRole("link", { name: /Discuss Your Digital Transformation/i }).first()).toHaveAttribute(
        "href",
        "/enterprise/contact",
      )
      await expect(page.getByRole("heading", { name: /improve, integrate or rebuild/i })).toBeVisible()
      await expect(page.getByText(/do not invent wider team sizes/i)).toBeVisible()
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/enterprise-websites$/)

      const jsonLd = (await page.locator('script[type="application/ld+json"]').allTextContents()).join(" ")
      expect(jsonLd).toContain("WebPage")
      expect(jsonLd).toContain("Service")
      expect(jsonLd).toContain("FAQPage")
      expect(jsonLd.toLowerCase()).not.toContain("pick everard")

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
      expect(overflow).toBe(false)
    })
  }

  test("is linked from homepage engagement models and nav", async ({ page }) => {
    await setExperience(page, "normal")
    await rejectNonEssentialStorage(page)
    await gotoReady(page, "/")

    await expect(page.getByRole("link", { name: /enterprise websites/i }).first()).toHaveAttribute(
      "href",
      "/enterprise-websites",
    )

    const mainNavigation = page.getByRole("navigation", { name: /main navigation/i })
    await mainNavigation.getByRole("button", { name: "Services", exact: true }).click()
    await expect(mainNavigation.locator('a[href="/enterprise-websites"]')).toBeVisible()
  })
})
