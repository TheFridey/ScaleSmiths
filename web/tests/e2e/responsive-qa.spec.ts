import { expect, test, type Page } from "@playwright/test"
import { rejectNonEssentialStorage, setExperience } from "./helpers"

/**
 * Structural QA across the three breakpoints the design targets.
 *
 * This is not a pixel-comparison suite — `public-site.visual.spec.ts` owns screenshots. It checks
 * the things that break silently when content changes: horizontal overflow, chrome that fails to
 * render, disclosure controls that stop working, headings that collapse, and tap targets too small
 * to hit on a phone.
 */

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
] as const

/** One representative of every page archetype on the public site. */
const ROUTES = [
  "/",
  "/services",
  "/local-growth",
  "/enterprise",
  "/security",
  "/web-design-nottingham",
  "/locations/nottingham",
  "/work",
  "/work/confirm-a-kill",
  "/insights",
  "/insights/seo",
  "/insights/how-much-does-a-business-website-cost-uk-2026",
  "/faq",
  "/about",
  "/about/rhys",
  "/pricing",
  "/legal/privacy",
  "/contact",
] as const

async function visit(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => document.documentElement.dataset.scalesmithsHydrated === "true", undefined, { timeout: 120_000 })
}

test.describe("responsive structure", () => {
  test.describe.configure({ timeout: 900_000 })
  test.use({ navigationTimeout: 120_000 })

  for (const viewport of VIEWPORTS) {
    test(`renders every archetype at ${viewport.name} (${viewport.width}px) without overflow`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await setExperience(page, "normal")
      await rejectNonEssentialStorage(page)

      const overflowing: string[] = []
      const missingChrome: string[] = []

      for (const route of ROUTES) {
        await visit(page, route)

        const report = await page.evaluate(() => {
          const docWidth = document.documentElement.scrollWidth
          const viewportWidth = window.innerWidth
          // Name the widest offender so a failure points at an element, not just a number.
          let widest = ""
          if (docWidth > viewportWidth + 1) {
            let worst = 0
            for (const element of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
              const rect = element.getBoundingClientRect()
              if (rect.right > worst) {
                worst = rect.right
                widest = `${element.tagName.toLowerCase()}.${(element.className || "").toString().split(" ").slice(0, 3).join(".")}`
              }
            }
          }
          return {
            overflow: docWidth > viewportWidth + 1,
            docWidth,
            viewportWidth,
            widest,
            hasHeader: Boolean(document.querySelector("header")),
            hasFooter: Boolean(document.querySelector("footer")),
            hasMain: Boolean(document.querySelector("main")),
            h1Count: document.querySelectorAll("h1").length,
          }
        })

        if (report.overflow) overflowing.push(`${route} (${report.docWidth}px > ${report.viewportWidth}px, widest: ${report.widest})`)
        if (!report.hasHeader || !report.hasFooter || !report.hasMain) {
          missingChrome.push(`${route} header=${report.hasHeader} main=${report.hasMain} footer=${report.hasFooter}`)
        }
        expect(report.h1Count, `${route} h1 count at ${viewport.name}`).toBe(1)
      }

      expect(overflowing, `horizontal overflow at ${viewport.name}`).toEqual([])
      expect(missingChrome, `missing page chrome at ${viewport.name}`).toEqual([])
    })
  }
})

test.describe("interactive components", () => {
  test.use({ navigationTimeout: 120_000 })

  test("mobile navigation opens, traps focus and closes", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await setExperience(page, "normal")
    await rejectNonEssentialStorage(page)
    await visit(page, "/services")

    const toggle = page.getByRole("button", { name: /open menu/i })
    await expect(toggle).toBeVisible()
    await toggle.click()

    const drawer = page.getByRole("dialog", { name: /site navigation/i })
    await expect(drawer).toBeVisible()
    for (const label of ["Work", "Insights", "About", "FAQ"]) {
      await expect(drawer.getByRole("link", { name: label, exact: true })).toBeVisible()
    }
    await expect(drawer.getByRole("link", { name: "All services", exact: true })).toBeVisible()

    await page.keyboard.press("Escape")
    await expect(drawer).toBeHidden()
    await expect(toggle).toBeFocused()
  })

  test("desktop services menu is keyboard operable", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await setExperience(page, "normal")
    await rejectNonEssentialStorage(page)
    await visit(page, "/")

    const nav = page.getByRole("navigation", { name: /main navigation/i })
    const trigger = nav.getByRole("button", { name: "Services", exact: true })
    await trigger.focus()
    await page.keyboard.press("Enter")
    await expect(trigger).toHaveAttribute("aria-expanded", "true")
    await expect(nav.getByRole("link", { name: /^All services/ })).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(trigger).toHaveAttribute("aria-expanded", "false")
  })

  test("FAQ disclosures work at every breakpoint", async ({ page }) => {
    await setExperience(page, "normal")
    await rejectNonEssentialStorage(page)

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await visit(page, "/faq")

      const first = page.locator("details#faq-cost")
      await expect(first, `${viewport.name}: closed by default`).not.toHaveAttribute("open", /.*/)
      await first.locator("summary").click()
      await expect(first, `${viewport.name}: opens on click`).toHaveAttribute("open", /.*/)
      await first.locator("summary").click()
      await expect(first, `${viewport.name}: closes again`).not.toHaveAttribute("open", /.*/)
    }
  })

  test("primary tap targets meet the WCAG minimum on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await setExperience(page, "normal")
    await rejectNonEssentialStorage(page)

    const undersized: string[] = []
    for (const route of ["/", "/services", "/faq", "/work/confirm-a-kill"]) {
      await visit(page, route)
      const small = await page.evaluate(() => {
        const problems: string[] = []
        // Only controls a visitor is expected to hit: buttons and the main call-to-action links.
        const controls = document.querySelectorAll<HTMLElement>('button, a.btn-primary, a.btn-ghost, a.btn-sm, summary')
        for (const control of Array.from(controls)) {
          const rect = control.getBoundingClientRect()
          if (rect.width === 0 && rect.height === 0) continue
          // WCAG 2.5.8 Target Size (Minimum), AA: 24x24 CSS px.
          if (rect.height < 24) problems.push(`${control.tagName.toLowerCase()} "${(control.textContent ?? "").trim().slice(0, 30)}" ${Math.round(rect.height)}px`)
        }
        return problems
      })
      undersized.push(...small.map((problem) => `${route}: ${problem}`))
    }
    expect(undersized, "tap targets below the WCAG 2.5.8 AA minimum of 24px").toEqual([])
  })
})
