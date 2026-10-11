import { expect, test } from "@playwright/test"
import { gotoReady, rejectNonEssentialStorage, setExperience } from "./helpers"

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
] as const

const SECTION_HEADINGS = [
  /controls belong in the design/i,
  /know who is acting/i,
  /defend the software surface/i,
  /protect data according to sensitivity/i,
  /separate environments/i,
  /secrets stay out of source control/i,
  /make important actions reconstructable/i,
  /from design through dependency risk/i,
  /backups, observability and incident handling/i,
  /meet the estate where it already has rules/i,
  /certifications and assurance/i,
  /review security requirements with the people who would build the system/i,
] as const

test.describe("security & trust page", () => {
  test.describe.configure({ timeout: 300_000 })

  for (const viewport of VIEWPORTS) {
    test(`renders /security at ${viewport.name} without overflow or gold+white CTAs`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.emulateMedia({ reducedMotion: "reduce" })
      await setExperience(page, "normal")
      await rejectNonEssentialStorage(page)

      const response = await gotoReady(page, "/security")
      expect(response?.status()).toBe(200)

      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1)
      await expect(page.getByRole("heading", { level: 1 })).toContainText(/security designed into the architecture/i)
      await expect(page.getByRole("link", { name: /discuss security requirements/i }).first()).toHaveAttribute("href", "/security#security-contact")
      await expect(page.locator("#security-contact")).toBeVisible()
      await expect(page.getByRole("link", { name: /start an enterprise enquiry/i })).toHaveAttribute("href", "/enterprise/contact")

      for (const heading of SECTION_HEADINGS) {
        await expect(page.getByRole("heading", { name: heading })).toBeVisible()
      }

      await expect(page.getByText(/does not currently claim/i)).toBeVisible()
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/security$/)

      const jsonLd = (await page.locator('script[type="application/ld+json"]').allTextContents()).join(" ")
      expect(jsonLd).toContain("WebPage")
      expect(jsonLd).toContain("FAQPage")
      expect(jsonLd).toContain("BreadcrumbList")
      expect(jsonLd.toLowerCase()).not.toContain("iso 27001 certified")

      const report = await page.evaluate(() => {
        const offenders: string[] = []
        for (const el of Array.from(document.querySelectorAll<HTMLElement>("*"))) {
          const cls = el.className?.toString?.() ?? ""
          if (/\bbg-acc\b/.test(cls) && /\btext-white\b/.test(cls)) {
            offenders.push(`${el.tagName.toLowerCase()}.${cls.split(/\s+/).slice(0, 4).join(".")}`)
          }
        }
        return {
          overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          h1Count: document.querySelectorAll("h1").length,
          badContrast: offenders,
          skipExists: Boolean(document.querySelector('a[href="#main"], a[href="#content"]')),
        }
      })
      expect(report.overflow).toBe(false)
      expect(report.h1Count).toBe(1)
      expect(report.badContrast).toEqual([])

      const primary = page.locator(".btn-primary").first()
      await expect(primary).toBeVisible()
      const ink = await primary.evaluate((el) => getComputedStyle(el).color)
      expect(ink).toMatch(/rgb\(\s*26,\s*18,\s*8\s*\)/)
    })
  }

  test("is linked from enterprise, custom systems and about", async ({ page }) => {
    await setExperience(page, "normal")
    await rejectNonEssentialStorage(page)

    await gotoReady(page, "/enterprise")
    await expect(page.getByRole("link", { name: /security & trust|security practices|view security/i }).first()).toHaveAttribute("href", "/security")

    await gotoReady(page, "/custom-systems")
    await expect(page.getByRole("link", { name: /^Security/i }).first()).toHaveAttribute("href", "/security")

    await gotoReady(page, "/about")
    await expect(page.getByRole("link", { name: /^Security/i }).first()).toHaveAttribute("href", "/security")
  })
})
