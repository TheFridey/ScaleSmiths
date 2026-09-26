import { expect, test } from "@playwright/test"
import { gotoReady, rejectNonEssentialStorage, setExperience } from "./helpers"

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
] as const

test.describe("pricing journeys", () => {
  test.describe.configure({ timeout: 300_000 })

  for (const viewport of VIEWPORTS) {
    test(`separates SME and enterprise buying journeys at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await setExperience(page, "normal")
      await rejectNonEssentialStorage(page)

      const response = await gotoReady(page, "/pricing")
      expect(response?.status()).toBe(200)

      await expect(page.getByRole("heading", { level: 1 })).toContainText(/two buying journeys/i)
      await expect(page.getByRole("link", { name: /sme services/i })).toHaveAttribute("href", "#web-growth")
      await expect(page.getByRole("link", { name: /enterprise systems/i }).first()).toHaveAttribute("href", "#enterprise-systems")

      const sme = page.locator("#web-growth")
      await expect(sme.getByRole("heading", { name: /transparent guidance for websites/i })).toBeVisible()
      await expect(sme.getByText("£15/month", { exact: true })).toBeVisible()
      await expect(sme.getByRole("heading", { name: /managed business email/i })).toBeVisible()
      await expect(sme.getByRole("heading", { name: /business growth audit/i })).toBeVisible()
      await expect(sme.getByRole("heading", { name: /custom web app/i })).toHaveCount(0)

      const enterprise = page.locator("#enterprise-systems")
      await expect(enterprise.getByRole("heading", { name: /scoped following discovery/i })).toBeVisible()
      await expect(enterprise.getByRole("heading", { name: /why enterprise software is scoped differently/i })).toBeVisible()
      await expect(enterprise.getByRole("link", { name: /discuss an enterprise system/i })).toHaveAttribute("href", "/quote?intent=enterprise")
      await expect(enterprise.getByRole("link", { name: /^enterprise systems$/i })).toHaveAttribute("href", "/enterprise")
      await expect(enterprise.getByRole("link", { name: /^custom systems$/i })).toHaveAttribute("href", "/custom-systems")

      const bodyText = await page.locator("body").innerText()
      expect(bodyText).not.toMatch(/£\s*100,?000|£\s*200,?000|£100k|£200k/i)

      // Enterprise journey should be reachable from the chooser without scrolling past SME cards first.
      const chooserBottom = await page.getByLabel("Pricing journeys").boundingBox()
      const smeTop = await sme.boundingBox()
      expect(chooserBottom && smeTop ? chooserBottom.y + chooserBottom.height <= smeTop.y + 40 : false).toBe(true)

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
      expect(overflow).toBe(false)
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1)
    })
  }

  test("enterprise and custom-systems pages link into enterprise pricing", async ({ page }) => {
    await setExperience(page, "normal")
    await rejectNonEssentialStorage(page)

    await gotoReady(page, "/enterprise")
    await expect(page.getByRole("link", { name: /how enterprise work is priced/i })).toHaveAttribute("href", "/pricing#enterprise-systems")

    await gotoReady(page, "/custom-systems")
    await expect(page.getByRole("link", { name: /read enterprise pricing guidance/i })).toHaveAttribute("href", "/pricing#enterprise-systems")
  })
})
