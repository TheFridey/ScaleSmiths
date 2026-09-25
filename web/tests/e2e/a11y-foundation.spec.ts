import { expect, test } from "@playwright/test"
import { chooseNormalExperience, rejectNonEssentialStorage, setExperience } from "./helpers"

/**
 * Accessibility smoke for the refined public design system.
 * Complements responsive-qa and visual baselines — checks gold+white CTAs are gone,
 * focus language is present, and sticky-nav scroll padding is applied.
 */
test.describe("public a11y foundation", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await setExperience(page, "normal")
    await rejectNonEssentialStorage(page)
  })

  test("homepage has no gold+white CTAs and keeps focus/scroll foundations", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await page.waitForFunction(() => document.documentElement.dataset.scalesmithsHydrated === "true", undefined, { timeout: 120_000 })
    const chooser = page.getByRole("heading", { name: /what experience would you like today/i })
    if (await chooser.isVisible().catch(() => false)) {
      await chooseNormalExperience(page)
    }

    const badContrast = await page.evaluate(() => {
      const offenders: string[] = []
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("*"))) {
        const cls = el.className?.toString?.() ?? ""
        if (/\bbg-acc\b/.test(cls) && /\btext-white\b/.test(cls)) {
          offenders.push(`${el.tagName.toLowerCase()}.${cls.split(/\s+/).slice(0, 4).join(".")}`)
        }
      }
      return offenders
    })
    expect(badContrast).toEqual([])

    const scrollPadding = await page.evaluate(() => getComputedStyle(document.documentElement).scrollPaddingTop)
    expect(Number.parseFloat(scrollPadding)).toBeGreaterThanOrEqual(40)

    const skip = page.getByRole("link", { name: /skip to content/i })
    await skip.focus()
    await expect(skip).toBeFocused()
    await expect(skip).toHaveClass(/text-acc-ink|focus:text-acc-ink/)

    const primary = page.locator(".btn-primary").first()
    await expect(primary).toBeVisible()
    const ink = await primary.evaluate((el) => getComputedStyle(el).color)
    // rgb(26, 18, 8) = #1a1208 — never white on forge gold
    expect(ink).toMatch(/rgb\(\s*26,\s*18,\s*8\s*\)/)
  })

  test("quote form controls expose identifiable borders and stronger focus", async ({ page }) => {
    await page.goto("/quote", { waitUntil: "domcontentloaded" })
    await page.waitForFunction(() => document.documentElement.dataset.scalesmithsHydrated === "true", undefined, { timeout: 120_000 })

    const input = page.getByLabel(/full name/i)
    await expect(input).toBeVisible()
    const idle = await input.evaluate((el) => {
      const styles = getComputedStyle(el)
      return { border: styles.borderTopColor, width: styles.borderTopWidth, shadow: styles.boxShadow }
    })
    expect(Number.parseFloat(idle.width)).toBeGreaterThanOrEqual(1)
    // Idle control border must be visible (not transparent)
    expect(idle.border).not.toMatch(/rgba?\(0,\s*0,\s*0,\s*0\)|transparent/)

    await input.focus()
    const focused = await input.evaluate((el) => {
      const styles = getComputedStyle(el)
      return { border: styles.borderTopColor, shadow: styles.boxShadow }
    })
    // Stronger focus: forge-gold border and/or gold focus ring
    const stronger =
      focused.border !== idle.border
      || (focused.shadow !== "none" && focused.shadow !== idle.shadow)
    expect(stronger).toBe(true)
  })
})
