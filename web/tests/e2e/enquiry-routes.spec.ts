import { expect, test } from "@playwright/test"
import { gotoReady, rejectNonEssentialStorage, setExperience, submitStrategyCallForm } from "./helpers"

const ROUTES = [
  { path: "/quote", heading: /about you/i },
  { path: "/quote?intent=strategy_call", heading: /request a strategy call/i },
  { path: "/quote?intent=discovery_call", heading: /request a discovery call/i },
  { path: "/enterprise/contact", heading: /enterprise discovery/i },
  { path: "/services/business-growth-audit/start", heading: /where the business stands/i },
  { path: "/services/managed-business-email/get-started", heading: /set up your business email/i },
] as const

test.describe("enquiry routes", () => {
  test.describe.configure({ timeout: 180_000 })

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await setExperience(page, "normal")
    await rejectNonEssentialStorage(page)
  })

  for (const route of ROUTES) {
    test(`${route.path} renders on a phone without horizontal overflow`, async ({ page }) => {
      const response = await gotoReady(page, route.path)
      expect(response?.status()).toBe(200)
      await expect(page.getByRole("heading", { level: 1 })).toContainText(route.heading)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
      expect(overflow).toBe(false)
    })
  }

  test("strategy, audit and email forms ask for enquiry consent and not marketing consent", async ({ page }) => {
    for (const path of ["/quote?intent=strategy_call", "/services/business-growth-audit/start", "/services/managed-business-email/get-started"]) {
      await gotoReady(page, path)
      await expect(page.getByLabel(/store the information i submit/i)).toBeVisible()
      await expect(page.getByText(/marketing consent is not requested/i)).toBeVisible()
    }
  })

  test("quote intent variants share one canonical path", async ({ page }) => {
    await gotoReady(page, "/quote?intent=strategy_call&utm_source=newsletter")
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/quote$/)
  })

  test("a strategy-call submission records where it came from and does not send contact details to analytics", async ({ page }) => {
    let quoteBody: Record<string, unknown> | null = null
    const analyticsBodies: unknown[] = []
    await page.route("**/api/quote", async (route) => {
      quoteBody = route.request().postDataJSON() as Record<string, unknown>
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) })
    })
    await page.route("**/api/experience-events", async (route) => {
      analyticsBodies.push(route.request().postDataJSON())
      await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ ok: true }) })
    })
    await page.route("**/google-analytics.com/**", (route) => route.abort())
    await page.route("**/googletagmanager.com/**", (route) => route.abort())

    await submitStrategyCallForm(page, "/quote?intent=strategy_call&utm_source=newsletter&utm_medium=email&utm_campaign=october")
    await expect(page).toHaveURL(/\/quote\/thanks\?intent=strategy_call/)

    expect(quoteBody).toMatchObject({
      intent: "strategy_call",
      consent: true,
      email: "pat@example.com",
    })
    const attribution = (quoteBody as unknown as { attribution: Record<string, string | null> }).attribution
    expect(attribution.submissionPath).toContain("/quote")
    expect(attribution.submissionPath).toContain("utm_source=newsletter")
    expect(attribution.utmSource).toBe("newsletter")
    expect(attribution.utmMedium).toBe("email")
    expect(attribution.utmCampaign).toBe("october")
    expect(quoteBody).not.toHaveProperty("marketingConsent")
    expect(JSON.stringify(analyticsBodies)).not.toContain("pat@example.com")
  })

  test("a later enquiry keeps the landing page and campaign after analytics is rejected", async ({ page }) => {
    let quoteBody: Record<string, unknown> | null = null
    await page.route("**/api/quote", async (route) => {
      quoteBody = route.request().postDataJSON() as Record<string, unknown>
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) })
    })
    await page.route("**/google-analytics.com/**", (route) => route.abort())
    await page.route("**/googletagmanager.com/**", (route) => route.abort())

    await gotoReady(page, "/?utm_source=newsletter&utm_medium=email&utm_campaign=october")
    await submitStrategyCallForm(page, "/quote?intent=strategy_call")
    await expect(page).toHaveURL(/\/quote\/thanks\?intent=strategy_call/)

    const attribution = (quoteBody as unknown as { attribution: Record<string, string | null> }).attribution
    expect(attribution.landingPath).toContain("/")
    expect(attribution.landingPath).toContain("utm_source=newsletter")
    expect(attribution.submissionPath).toContain("/quote")
    expect(attribution.submissionPath).not.toContain("utm_source")
    expect(attribution.utmSource).toBe("newsletter")
    expect(attribution.utmMedium).toBe("email")
    expect(attribution.utmCampaign).toBe("october")
  })

  test("GA4 stays installed and denied until analytics consent", async ({ page }) => {
    await gotoReady(page, "/")
    const html = await page.content()
    expect(html).toContain("G-24NM2GTZ0C")
    expect(html).toContain("analytics_storage")
    expect(html).toContain("denied")
    expect(html).not.toContain("analytics_storage': 'granted'")
  })

  test("the public registration line and enquiry acquisition disclosure are on the site", async ({ page }) => {
    await gotoReady(page, "/")
    await expect(page.getByText(/company number 17496624/i)).toBeVisible()
    await expect(page.getByText(/ICO registration number ZC265402/i)).toBeVisible()
    await gotoReady(page, "/legal/privacy")
    await expect(page.getByText(/campaign labels already on the link/i)).toBeVisible()
  })
})
