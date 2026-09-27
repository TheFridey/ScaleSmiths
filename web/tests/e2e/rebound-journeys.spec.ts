import { expect, test } from "@playwright/test"
import {
  gotoReady,
  installConsoleGuards,
  mockExperienceAnalytics,
  rejectNonEssentialStorage,
} from "./helpers"

/**
 * Brief §53 customer journeys — desktop Chromium (+ mobile project covers width separately).
 * Asserts pathway continuity and CTA hierarchy without redesigning pages.
 */
test.beforeEach(async ({ page }) => {
  await rejectNonEssentialStorage(page)
  await mockExperienceAnalytics(page)
})

async function journey(page: import("@playwright/test").Page, steps: Array<{ path: string; heading?: RegExp; cta?: RegExp }>) {
  const consoleGuard = await installConsoleGuards(page)
  for (const step of steps) {
    await gotoReady(page, step.path)
    expect(page.url()).toContain(step.path.split("?")[0]!)
    if (step.heading) {
      await expect(page.getByRole("heading", { name: step.heading }).first()).toBeVisible()
    }
    if (step.cta) {
      await expect(page.getByRole("link", { name: step.cta }).first()).toBeVisible()
    }
  }
  await consoleGuard.expectClean()
}

test.describe("rebound customer journeys", () => {
  test.describe("mobile width", () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

    test("home primary CTAs remain usable at 390px", async ({ page }) => {
      const consoleGuard = await installConsoleGuards(page)
      await gotoReady(page, "/")
      const start = page.getByRole("link", { name: /start a project/i }).first()
      const strategy = page.getByRole("link", { name: /request a strategy call/i }).first()
      await expect(start).toBeVisible()
      await expect(strategy).toBeVisible()
      const startBox = await start.boundingBox()
      const strategyBox = await strategy.boundingBox()
      expect(startBox?.height ?? 0).toBeGreaterThanOrEqual(40)
      expect(strategyBox?.height ?? 0).toBeGreaterThanOrEqual(40)
      await consoleGuard.expectClean()
    })
  })

  test("local business: Home → Local Growth → Work → Strategy Call", async ({ page }) => {
    await journey(page, [
      { path: "/", heading: /forge your digital edge/i, cta: /request a strategy call/i },
      { path: "/local-growth", heading: /turn local attention/i },
      { path: "/work", heading: /here is what we actually built/i },
      { path: "/quote?intent=strategy_call", heading: /request a strategy call/i },
    ])
    await expect(page.getByLabel(/email/i).first()).toBeVisible()
    await expect(page.getByRole("heading", { name: /about you/i })).toHaveCount(0)
  })

  test("website project: Home → Services → Work → Quote", async ({ page }) => {
    await journey(page, [
      { path: "/", heading: /forge your digital edge/i, cta: /start a project/i },
      { path: "/services", heading: /websites, search visibility/i },
      { path: "/work", heading: /here is what we actually built/i },
      { path: "/quote", heading: /about you|project brief|start/i },
    ])
  })

  test("growth prospect: Home → Growth Partnership → Growth Audit → Contact", async ({ page }) => {
    await journey(page, [
      { path: "/", heading: /forge your digital edge/i },
      { path: "/digital-growth-partnership", heading: /growth partnership/i },
      { path: "/services/business-growth-audit", heading: /know what to fix next/i },
      { path: "/contact", heading: /speak directly to the founders/i },
    ])
  })

  test("enterprise: Home → Enterprise → Delivery → Security → Strategy Call", async ({ page }) => {
    await journey(page, [
      { path: "/", heading: /forge your digital edge/i },
      { path: "/enterprise", heading: /enterprise software built around/i },
      { path: "/enterprise/delivery", heading: /founder-led engineering with structured enterprise delivery/i },
      { path: "/security", heading: /security designed into the architecture/i },
      { path: "/quote?intent=strategy_call", heading: /request a strategy call/i },
    ])
    await gotoReady(page, "/enterprise/delivery")
    await expect(page.getByRole("navigation", { name: /jump to/i }).first()).toBeVisible()
    await expect(page.getByRole("heading", { name: /discovery → prototype → validated scope → mvp → uat → production → expansion/i })).toBeVisible()
    await gotoReady(page, "/enterprise")
    await expect(page.getByRole("navigation", { name: /jump to/i }).first()).toBeVisible()
  })

  test("custom systems: Home → Custom Systems → Work → Enterprise → Contact", async ({ page }) => {
    await journey(page, [
      { path: "/", heading: /forge your digital edge/i },
      { path: "/custom-systems", heading: /build the product or operating system/i },
      { path: "/work", heading: /here is what we actually built/i },
      { path: "/enterprise", heading: /enterprise software built around/i },
      { path: "/contact", heading: /speak directly to the founders/i },
    ])
  })

  test("existing client: Home → Client Portal", async ({ page }) => {
    const consoleGuard = await installConsoleGuards(page)
    await gotoReady(page, "/")
    await expect(page.getByRole("link", { name: /client portal/i }).first()).toBeVisible()
    const response = await page.goto("/portal", { waitUntil: "domcontentloaded" })
    await expect(page).toHaveURL(/\/portal\/login/)
    expect(response?.status()).toBeLessThan(400)
    await consoleGuard.expectClean()
  })

  test("insights knowledge library framing and case-study flagship sections", async ({ page }) => {
    await gotoReady(page, "/insights")
    await expect(page.getByText(/scalesmiths knowledge library/i).first()).toBeVisible()
    await expect(page.getByText(/launched as a coherent body of work/i)).toBeVisible()

    await gotoReady(page, "/work/confirm-a-kill")
    await expect(page.getByText(/^the business$/i).first()).toBeVisible()
    await expect(page.getByText(/^the constraint$/i).first()).toBeVisible()
    await expect(page.getByText(/^what we found$/i).first()).toBeVisible()
    await expect(page.getByRole("navigation", { name: /case study/i })).toBeVisible()
  })
})
