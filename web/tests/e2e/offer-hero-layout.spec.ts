import { expect, test, type Page } from "@playwright/test"
import { rejectNonEssentialStorage, setExperience } from "./helpers"

/**
 * Layout assertions for split offer / service heroes.
 *
 * Guards the live regression where fluid display type + default grid
 * min-width:auto pushed the price card past the viewport edge while
 * overflow-x:clip hid the scrollbar (clipped "£15/mon").
 */

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "laptop-1366", width: 1366, height: 768 },
  { name: "laptop-1280", width: 1280, height: 800 },
  { name: "laptop-1180", width: 1180, height: 750 },
  { name: "tablet-1024", width: 1024, height: 768 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "mobile-390", width: 390, height: 844 },
] as const

const OFFER_ROUTES = [
  {
    path: "/services/managed-business-email",
    priceText: "£15/month",
  },
  {
    path: "/services/business-growth-audit",
    priceText: "£395",
  },
  {
    path: "/local-growth-check",
    priceText: "£395",
  },
] as const

const JOURNEY_ROUTES = ["/local-growth", "/custom-systems"] as const

async function visit(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => document.documentElement.dataset.scalesmithsHydrated === "true", undefined, {
    timeout: 120_000,
  })
}

async function heroLayoutReport(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement
    const hero = document.querySelector<HTMLElement>("[data-offer-hero]")
    const card = document.querySelector<HTMLElement>("[data-offer-hero] .offer-hero-card, [data-offer-hero-card], .journey-hero-aside")
    const price = document.querySelector<HTMLElement>("[data-offer-hero-price]")
    const h1 = document.querySelector("h1")
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const tolerance = 1

    function withinViewport(el: Element | null) {
      if (!el) return false
      const rect = el.getBoundingClientRect()
      return rect.left >= -tolerance && rect.right <= viewportWidth + tolerance
    }

    const priceFullyVisible = (() => {
      if (!price) return null
      const rect = price.getBoundingClientRect()
      const textFits = price.scrollWidth <= price.clientWidth + tolerance
      return textFits && rect.right <= viewportWidth + tolerance && rect.left >= -tolerance
    })()

    return {
      overflow: doc.scrollWidth - doc.clientWidth,
      heroWithinViewport: withinViewport(hero),
      cardWithinViewport: withinViewport(card),
      missingCard: !card,
      priceFullyVisible,
      priceText: price?.textContent?.trim() ?? null,
      h1FontSize: h1 ? Number.parseFloat(getComputedStyle(h1).fontSize) : null,
      cardRight: card?.getBoundingClientRect().right ?? null,
      viewportWidth,
      viewportHeight,
    }
  })
}

test.describe("offer hero layout", () => {
  test.describe.configure({ timeout: 300_000 })

  for (const viewport of VIEWPORTS) {
    test(`keeps offer heroes inside ${viewport.name} (${viewport.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await setExperience(page, "normal")
      await rejectNonEssentialStorage(page)

      const failures: string[] = []

      for (const route of OFFER_ROUTES) {
        await visit(page, route.path)
        const report = await heroLayoutReport(page)

        if (report.missingCard) {
          failures.push(`${route.path}: missing offer/journey card`)
        }
        if (report.overflow > 1) {
          failures.push(`${route.path}: horizontal overflow ${report.overflow}px`)
        }
        if (!report.cardWithinViewport) {
          failures.push(`${route.path}: card clipped (right=${report.cardRight}, vw=${report.viewportWidth})`)
        }
        if (report.priceFullyVisible === false) {
          failures.push(`${route.path}: price not fully visible (${report.priceText})`)
        }
        if (report.priceText && !report.priceText.includes(route.priceText.replace("£", ""))) {
          // Soft check, exact label may include cadence
          if (report.priceText !== route.priceText && !report.priceText.startsWith(route.priceText)) {
            failures.push(`${route.path}: unexpected price text "${report.priceText}"`)
          }
        }
        // Display type must not hit the old oversized ceiling (88–94px) on laptop widths
        if (viewport.width >= 1024 && report.h1FontSize && report.h1FontSize > 64) {
          failures.push(`${route.path}: h1 still oversized at ${report.h1FontSize}px`)
        }
        // Side-by-side offer grid must remain two columns at lg+
        if (viewport.width >= 1024) {
          const cols = await page.evaluate(() => {
            const hero = document.querySelector("[data-offer-hero]")
            return hero ? getComputedStyle(hero).gridTemplateColumns : ""
          })
          const trackCount = cols.trim().split(/\s+/).filter(Boolean).length
          if (trackCount < 2) {
            failures.push(`${route.path}: expected 2-column hero grid, got "${cols}"`)
          }
        }
      }

      for (const path of JOURNEY_ROUTES) {
        await visit(page, path)
        const report = await heroLayoutReport(page)
        if (report.overflow > 1) {
          failures.push(`${path}: horizontal overflow ${report.overflow}px`)
        }
        if (!report.cardWithinViewport) {
          failures.push(`${path}: aside clipped (right=${report.cardRight}, vw=${report.viewportWidth})`)
        }
        if (viewport.width >= 1024 && report.h1FontSize && report.h1FontSize > 64) {
          failures.push(`${path}: h1 still oversized at ${report.h1FontSize}px`)
        }
      }

      expect(failures, `offer hero layout failures at ${viewport.name}`).toEqual([])
    })
  }

  test("managed email price reads £15/month fully at laptop widths", async ({ page }) => {
    await setExperience(page, "normal")
    await rejectNonEssentialStorage(page)

    for (const width of [1366, 1280, 1180, 1024]) {
      await page.setViewportSize({ width, height: 800 })
      await visit(page, "/services/managed-business-email")

      const price = page.locator("[data-offer-hero-price]")
      await expect(price).toHaveText("£15/month")
      await expect(price).toBeInViewport()

      const box = await price.boundingBox()
      expect(box, `price box missing at ${width}px`).not.toBeNull()
      expect(box!.x + box!.width, `price clipped at ${width}px`).toBeLessThanOrEqual(width + 1)

      const card = page.locator("[data-offer-hero] .offer-hero-card").first()
      await expect(card).toBeVisible()
      const cardBox = await card.boundingBox()
      expect(cardBox, `card box missing at ${width}px`).not.toBeNull()
      expect(cardBox!.x + cardBox!.width, `card clipped at ${width}px`).toBeLessThanOrEqual(width + 1)

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow, `overflow at ${width}px`).toBeLessThanOrEqual(1)
    }
  })
})
