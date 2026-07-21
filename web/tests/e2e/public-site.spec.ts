import { expect, test } from "@playwright/test"
import {
  EXPERIENCE_KEY,
  chooseNormalExperience,
  clearV2State,
  installConsoleGuards,
  gotoReady,
  mockQuoteApi,
  mockExperienceAnalytics,
  openInteractivePlan,
  setExperience,
  submitQuoteWizard,
} from "./helpers"

test.beforeEach(async ({ page }) => {
  await mockExperienceAnalytics(page)
  await page.addInitScript(() => {
    window.localStorage.setItem("scalesmiths.e2e.disableCanvas", "true")
  })
})

test.describe("public experience SEO routing", () => {
  test("serves the server-rendered normal homepage to Googlebot and Bingbot without the chooser", async ({ request }) => {
    for (const userAgent of [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    ]) {
      const response = await request.get("/", { headers: { "user-agent": userAgent } })
      const html = await response.text()

      expect(response.status()).toBe(200)
      expect(html).toContain('aria-label="FORGE YOUR"')
      expect(html).toContain("Conversion-focused websites")
      expect(html).not.toContain("What experience would you like today?")
      expect(response.headers()["cache-control"]).toMatch(/no-store/i)
      expect(response.headers()["cache-control"]).toMatch(/must-revalidate/i)
    }

    const humanResponse = await request.get("/", {
      headers: { "user-agent": "Mozilla/5.0 Chrome/126.0 Safari/537.36" },
    })
    expect(await humanResponse.text()).toContain("What experience would you like today?")
    expect(humanResponse.headers()["cache-control"]).toMatch(/no-store/i)
  })

  test("permanently redirects the legacy normal route and honours it over an interactive preference", async ({ page, request }) => {
    const redirect = await request.get("/traditional", { maxRedirects: 0 })
    expect(redirect.status()).toBe(308)
    expect(new URL(redirect.headers().location).pathname).toBe("/")
    expect(new URL(redirect.headers().location).searchParams.get("experience")).toBe("normal")

    await setExperience(page, "interactive")
    await gotoReady(page, "/traditional")

    await expect(page).toHaveURL(/\/?experience=normal$/)
    await expect(page.getByRole("heading", { name: /forge your digital edge/i })).toBeVisible()
    await expect(page.getByRole("heading", { name: /what experience would you like today/i })).toBeHidden()
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), EXPERIENCE_KEY)).toBe("normal")
  })

  test("publishes route-specific canonical metadata and intentional interactive indexing", async ({ page }) => {
    for (const [path, canonicalPath] of [
      ["/?experience=normal", "/"],
      ["/interactive", "/interactive"],
      ["/services", "/services"],
      ["/web-design-hucknall", "/web-design-hucknall"],
      ["/work", "/work"],
      ["/work/scalesmiths-platform-build", "/work/scalesmiths-platform-build"],
    ] as const) {
      await gotoReady(page, path)
      const canonical = await page.locator('link[rel="canonical"]').getAttribute("href")
      expect(new URL(canonical ?? "", "https://scalesmiths.co.uk").pathname).toBe(canonicalPath)
    }

    await gotoReady(page, "/interactive")
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /index, follow/i)
  })

  test("excludes the redirect-only route and duplicate URLs from the sitemap", async ({ request }) => {
    const response = await request.get("/sitemap.xml")
    const xml = await response.text()
    const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])

    // The origin comes from NEXT_PUBLIC_SITE_URL, which differs between CI and a developer
    // .env, so assert on paths rather than hard-coding the production host.
    const paths = locations.map((location) => new URL(location).pathname.replace(/\/$/, "") || "/")

    expect(response.status()).toBe(200)
    expect(paths).not.toContain("/traditional")
    expect(paths.filter((path) => path === "/")).toHaveLength(1)
    expect(new Set(locations).size).toBe(locations.length)
    expect(xml).toContain("2026-07-19T00:00:00.000Z")
  })

  test("fails closed when commercial claims have no verified public evidence", async ({ page }) => {
    await setExperience(page, "normal")
    await gotoReady(page, "/")

    for (const unsupported of [
      "12+ Projects Delivered",
      "GBP 300k+ Revenue Generated",
      "100% Retainer Retention Rate",
      "paid for itself twice over",
    ]) {
      await expect(page.getByText(unsupported, { exact: false })).toHaveCount(0)
    }
    await expect(page.locator('section[aria-label="Client testimonials"]')).toHaveCount(0)
    await expect(page.getByText("Conversion websites", { exact: true })).toBeVisible()

    await gotoReady(page, "/pricing")
    await expect(page.getByText("GBP 4,500-6,500", { exact: false })).toHaveCount(0)
    await expect(page.getByText("Scoped after discovery", { exact: true }).first()).toBeVisible()
    await expect(page.locator("body")).not.toContainText("evidence_reference")
    await expect(page.locator("body")).not.toContainText("verified_by")
  })
})

test.describe("public experience preference", () => {
  test("shows the first-time chooser and saves the normal-site selection", async ({ page }) => {
    const consoleGuard = await installConsoleGuards(page)
    await clearV2State(page)

    await gotoReady(page, "/")
    await expect(page.getByRole("heading", { name: /what experience would you like today/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /open website/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /launch interactive/i })).toBeVisible()

    await chooseNormalExperience(page)
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), EXPERIENCE_KEY)).toBe("normal")
    await consoleGuard.expectClean()
  })

  test("launches the interactive experience from the chooser", async ({ page }) => {
    await clearV2State(page)

    await gotoReady(page, "/")
    await page.getByRole("button", { name: /launch interactive/i }).click({ noWaitAfter: true })

    await page.waitForURL(/\/interactive$/, { timeout: 20_000 })
    await expect(page.getByRole("link", { name: /exit to normal site/i })).toBeVisible()
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), EXPERIENCE_KEY)).toBe("interactive")
  })

  test("returns directly to the normal site for a stored normal preference", async ({ page }) => {
    await setExperience(page, "normal")

    await gotoReady(page, "/")

    await expect(page.getByRole("heading", { name: /forge your digital edge/i })).toBeVisible()
    await expect(page.getByRole("heading", { name: /what experience would you like today/i })).toBeHidden()
  })

  test("redirects to interactive for a stored interactive preference without flashing the homepage", async ({ page }) => {
    await page.addInitScript(
      ({ key }) => {
        window.localStorage.setItem(key, "interactive")
        window.sessionStorage.setItem("scalesmiths.homeFlashText", "[]")
        const seen: string[] = []
        const record = () => {
          const text = document.body?.innerText ?? ""
          if (/FORGE YOUR|DIGITAL EDGE|What experience would you like today/i.test(text)) {
            seen.push(text)
            window.sessionStorage.setItem("scalesmiths.homeFlashText", JSON.stringify(seen))
          }
        }
        new MutationObserver(record).observe(document.documentElement, { childList: true, subtree: true })
        window.addEventListener("DOMContentLoaded", record)
      },
      { key: EXPERIENCE_KEY },
    )

    await page.goto("/", { waitUntil: "domcontentloaded" })

    await page.waitForURL(/\/interactive$/, { timeout: 20_000 })
    await expect(page.getByRole("link", { name: /exit to normal site/i })).toBeVisible()
    await expect.poll(() => page.evaluate(() => JSON.parse(window.sessionStorage.getItem("scalesmiths.homeFlashText") ?? "[]"))).toEqual([])
  })

  test("can reset and switch experience preferences", async ({ page }) => {
    await setExperience(page, "normal")

    await gotoReady(page, "/")
    await page.getByRole("button", { name: /reset experience preference/i }).click()
    await expect(page.getByRole("heading", { name: /what experience would you like today/i })).toBeVisible()
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), EXPERIENCE_KEY)).toBeNull()

    await page.getByRole("button", { name: /open website/i }).click()
    await page.getByRole("button", { name: /switch experience/i }).click({ noWaitAfter: true })
    await page.waitForURL(/\/interactive$/, { timeout: 20_000 })
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), EXPERIENCE_KEY)).toBe("interactive")

    await page.getByRole("link", { name: /exit to normal site/i }).click()
    await page.waitForURL(/\/$/, { timeout: 20_000 })
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), EXPERIENCE_KEY)).toBe("normal")
  })
})

test.describe("public navigation and accessibility behaviours", () => {
  test("routes buyers into distinct local-growth and custom-systems journeys", async ({ page }) => {
    await setExperience(page, "normal")
    await gotoReady(page, "/services")

    const mainNavigation = page.getByRole("navigation", { name: /main navigation/i })
    await expect(mainNavigation.getByRole("link", { name: "Local Growth", exact: true })).toHaveAttribute("href", "/local-growth")
    await expect(mainNavigation.getByRole("link", { name: "Custom Systems", exact: true })).toHaveAttribute("href", "/custom-systems")
    await expect(page.getByRole("heading", { name: /different problems need different buying journeys/i })).toBeVisible()

    await gotoReady(page, "/local-growth")
    await expect(page.getByRole("heading", { level: 1, name: /trusted enquiries and bookings/i })).toBeVisible()
    await expect(page.getByText("Trades and home services", { exact: true })).toBeVisible()
    await expect(page.getByRole("link", { name: /request a local growth check/i }).first()).toHaveAttribute("href", "/local-growth-check")
    await expect(page.getByRole("link", { name: /glow tanning/i })).toHaveAttribute("href", "/work/glow-tanning")
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/local-growth$/)
    expect((await page.locator('script[type="application/ld+json"]').allTextContents()).join(" ")).toContain("BreadcrumbList")

    await gotoReady(page, "/custom-systems")
    await expect(page.getByRole("heading", { level: 1, name: /workflow actually needs/i })).toBeVisible()
    await expect(page.getByText("SaaS and product founders", { exact: true })).toBeVisible()
    await expect(page.getByRole("link", { name: /start a project brief/i }).first()).toHaveAttribute("href", "/quote")
    await expect(page.getByRole("link", { name: /request a strategy call/i }).first()).toHaveAttribute("href", "/quote?intent=strategy_call")
    await expect(page.getByRole("link", { name: /the business circle/i })).toHaveAttribute("href", "/work/the-business-circle")
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/custom-systems$/)
  })

  test("keeps both service journeys usable without horizontal overflow on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })

    for (const path of ["/local-growth", "/custom-systems"] as const) {
      await gotoReady(page, path)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
    }

    await page.getByRole("button", { name: /open menu/i }).click()
    const mobileHeader = page.getByRole("banner")
    await expect(mobileHeader.getByRole("link", { name: "Local Growth", exact: true }).last()).toBeVisible()
    await expect(mobileHeader.getByRole("link", { name: "Custom Systems", exact: true }).last()).toBeVisible()
  })

  test("supports keyboard navigation and visible focus states", async ({ page }) => {
    await setExperience(page, "normal")
    await gotoReady(page, "/")

    await page.keyboard.press("Tab")
    await expect(page.getByRole("link", { name: /skip to content/i })).toBeFocused()
    await page.keyboard.press("Enter")
    await expect(page.locator("#main")).toBeFocused()

    await page.keyboard.press("Tab")
    const focused = page.locator(":focus")
    await expect(focused).toBeVisible()
    await expect(focused).toHaveCSS("outline-style", /solid|auto/)
  })

  test("covers main navigation and critical calls to action", async ({ page }) => {
    await setExperience(page, "normal")
    await gotoReady(page, "/")

    await expect(page.getByRole("link", { name: /explore local growth/i })).toHaveAttribute("href", "/local-growth")
    await expect(page.getByRole("link", { name: /explore custom systems/i })).toHaveAttribute("href", "/custom-systems")
    const servicesLink = page.getByRole("navigation", { name: /main navigation/i }).getByRole("link", { name: /services/i })
    await expect(servicesLink).toHaveAttribute("href", "/services")
    await servicesLink.click({ noWaitAfter: true })
    await page.waitForURL(/\/services$/, { timeout: 20_000, waitUntil: "domcontentloaded" })
    await expect(page.getByRole("heading", { name: /commercial web builds/i })).toBeVisible()

    // Each custom-systems service card routes to the full brief; local-growth cards route to
    // the short check instead, so assert both journeys keep a working commercial next step.
    await expect(page.getByRole("link", { name: /request a local growth check/i }).first()).toHaveAttribute("href", "/local-growth-check")
    const projectBriefLink = page.getByRole("link", { name: /start a project brief/i }).first()
    await expect(projectBriefLink).toHaveAttribute("href", "/quote")
    await projectBriefLink.click({ noWaitAfter: true })
    await page.waitForURL(/\/quote$/, { timeout: 20_000, waitUntil: "domcontentloaded" })
    await expect(page.getByRole("heading", { name: /contact/i })).toBeVisible()
  })

  test("honours reduced-motion preferences while keeping the journey usable", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })

    await openInteractivePlan(page)

    await expect(page.getByRole("heading", { name: /system summary/i })).toBeVisible()
    await expect(page.locator("form").getByRole("button", { name: /request a strategy call/i })).toBeVisible()
  })

  test("uses the mobile fallback instead of the desktop canvas layer", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })

    await gotoReady(page, "/interactive")

    await expect(page.getByRole("link", { name: /exit to normal site/i })).toBeVisible()
    await expect(page.locator('[data-v2-scene-canvas="true"]')).toBeHidden()
  })
})

test.describe("quote and contact forms", () => {
  test("offers the short local growth route without changing the full quote wizard", async ({ page }) => {
    await gotoReady(page, "/quote")

    await expect(page.getByText(/not ready to write a full brief/i)).toBeVisible()
    await expect(page.getByRole("link", { name: /request a local growth check/i })).toHaveAttribute("href", "/local-growth-check")
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "10")
  })

  test("submits the accessible local growth check with its source and analytics", async ({ page }) => {
    let submittedPayload: Record<string, unknown> | undefined
    let requestCount = 0
    const analyticsEvents: string[] = []
    await mockQuoteApi(page, { ok: true, onRequest: (payload) => { submittedPayload = payload; requestCount += 1 } })
    await mockExperienceAnalytics(page, (payload) => analyticsEvents.push(String(payload.eventName)))

    await gotoReady(page, "/local-growth-check")
    await expect(page.getByRole("heading", { level: 1, name: /useful first look/i })).toBeVisible()
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/local-growth-check$/)
    const structuredData = await page.locator('script[type="application/ld+json"]').allTextContents()
    expect(structuredData.join(" ")).toContain("Local Growth Check")

    await page.getByLabel(/^name/i).fill("Alex Local")
    await page.getByLabel(/business name/i).fill("Alex Plumbing")
    await page.getByLabel(/website or social-page/i).fill("https://example.com")
    await page.getByLabel(/^email/i).fill("alex@example.com")
    await page.getByLabel(/^phone/i).fill("+44 7700 900123")
    await page.getByLabel(/primary problem or goal/i).fill("People cannot tell which areas we cover or which service to choose.")
    await page.getByRole("button", { name: /request my local growth check/i }).click()

    await expect(page.getByText(/complete the required fields and confirm consent/i)).toBeVisible()
    expect(requestCount).toBe(0)

    await page.getByLabel(/store the information i submit/i).check()
    await page.getByRole("button", { name: /request my local growth check/i }).click()

    await expect(page.getByRole("status")).toContainText(/founder will review/i)
    expect(submittedPayload).toMatchObject({
      funnelType: "local_growth_check",
      leadSource: "local_growth_check",
      intent: "local_growth_check",
      consent: true,
    })
    expect(submittedPayload).not.toHaveProperty("marketingConsent")
    await expect.poll(() => analyticsEvents).toEqual(expect.arrayContaining([
      "local_growth_check_viewed",
      "local_growth_check_form_started",
      "local_growth_check_form_submitted",
    ]))
  })

  test("keeps local growth actions keyboard-accessible and tracks both onward routes", async ({ page }) => {
    const analyticsEvents: string[] = []
    await mockExperienceAnalytics(page, (payload) => analyticsEvents.push(String(payload.eventName)))
    await gotoReady(page, "/local-growth-check")

    const fullQuote = page.getByRole("link", { name: /use the full quote route/i })
    const strategyCall = page.getByRole("link", { name: /request a strategy call/i })
    await expect(fullQuote).toHaveAttribute("href", "/quote")
    await expect(strategyCall).toHaveAttribute("href", "/quote?intent=strategy_call")

    await fullQuote.focus()
    await expect(fullQuote).toBeFocused()
    await fullQuote.click()
    await page.waitForURL(/\/quote$/)
    await gotoReady(page, "/local-growth-check")
    await page.getByRole("link", { name: /request a strategy call/i }).click()
    await page.waitForURL(/\/quote\?intent=strategy_call$/)
    await expect.poll(() => analyticsEvents).toEqual(expect.arrayContaining([
      "local_growth_check_full_quote_selected",
      "local_growth_check_strategy_call_requested",
    ]))
  })

  test("shows validation errors before submission", async ({ page }) => {
    await gotoReady(page, "/quote")

    await page.getByRole("button", { name: /continue/i }).click()

    await expect(page.getByText(/please add your full name/i)).toBeVisible()
  })

  test("submits the quote wizard successfully", async ({ page }) => {
    await mockQuoteApi(page, { ok: true })

    await submitQuoteWizard(page)

    await expect(page).toHaveURL(/\/quote\/thanks\?intent=quote$/)
    await expect(page.getByRole("heading", { name: /brief received/i })).toBeVisible()
  })

  test("retains a discovery-call request intent in the enquiry payload", async ({ page }) => {
    let submittedPayload: Record<string, unknown> | undefined
    await mockQuoteApi(page, { ok: true, onRequest: (payload) => { submittedPayload = payload } })

    await submitQuoteWizard(page, "/quote?intent=discovery_call")

    await expect(page).toHaveURL(/\/quote\/thanks\?intent=discovery_call$/)
    expect(submittedPayload?.intent).toBe("discovery_call")
  })

  test("surfaces quote submission failures safely", async ({ page }) => {
    await mockQuoteApi(page, { ok: false, status: 503, error: "Unable to submit your brief." })

    await submitQuoteWizard(page)

    await expect(page.getByText(/unable to submit your brief/i)).toBeVisible()
  })

  test("submits the interactive plan form successfully", async ({ page }) => {
    let submittedPayload: Record<string, unknown> | undefined
    await mockQuoteApi(page, { ok: true, onRequest: (payload) => { submittedPayload = payload } })
    await openInteractivePlan(page)

    await page.getByLabel(/^name/i).fill("Riley Client")
    await page.getByLabel(/business name/i).fill("Riley Builds")
    await page.getByLabel(/^email/i).fill("riley@example.com")
    await page.getByLabel(/what do you want the website to do/i).fill("Win better enquiries and reduce manual follow-up.")
    await page.getByLabel(/budget range/i).selectOption({ label: "GBP 8,000-15,000" })
    await page.getByLabel(/timeline/i).selectOption({ label: "4-6 weeks" })
    await page.getByLabel(/store the information i submit/i).check()
    await page.locator("form").getByRole("button", { name: /request a strategy call/i }).click()

    await expect(page.getByRole("status")).toContainText(/plan sent/i)
    expect(submittedPayload?.consent).toBe(true)
    expect(submittedPayload?.intent).toBe("strategy_call")
    expect(submittedPayload?.type).toContain("Request a Strategy Call")
    expect(submittedPayload).not.toHaveProperty("marketingConsent")
  })

  test("blocks the interactive enquiry until specific consent is given", async ({ page }) => {
    let requestCount = 0
    await mockQuoteApi(page, { ok: true, onRequest: () => { requestCount += 1 } })
    await openInteractivePlan(page)

    await page.getByLabel(/^name/i).fill("Riley Client")
    await page.getByLabel(/business name/i).fill("Riley Builds")
    await page.getByLabel(/^email/i).fill("riley@example.com")
    await page.getByLabel(/what do you want the website to do/i).fill("Win better enquiries and reduce manual follow-up.")
    await page.getByLabel(/budget range/i).selectOption({ label: "GBP 8,000-15,000" })
    await page.getByLabel(/timeline/i).selectOption({ label: "4-6 weeks" })
    await page.locator("form").getByRole("button", { name: /request a strategy call/i }).click()

    await expect(page.locator("form").getByRole("alert")).toContainText(/confirm that we may store your information/i)
    expect(requestCount).toBe(0)
  })

  test("publishes indexable privacy and terms pages with navigation links", async ({ page }) => {
    await gotoReady(page, "/privacy")
    await expect(page.getByRole("heading", { name: "Privacy notice" })).toBeVisible()
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /index, follow/i)
    await page.getByRole("button", { name: /turn off experience analytics/i }).click()
    await expect(page.getByRole("status")).toContainText(/analytics is now off/i)
    await expect.poll(async () => (await page.context().cookies()).find((cookie) => cookie.name === "ss_analytics_opt_out")?.value).toBe("1")
    await expect(page.getByRole("link", { name: "Terms" }).last()).toHaveAttribute("href", "/terms")

    await page.getByRole("link", { name: "Terms" }).last().click()
    await expect(page.getByRole("heading", { name: "Website terms" })).toBeVisible()
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /index, follow/i)
    await expect(page.getByRole("link", { name: "Privacy" }).last()).toHaveAttribute("href", "/privacy")
  })

  test("exits the interactive route back to the normal site", async ({ page }) => {
    await gotoReady(page, "/interactive")

    await page.getByRole("link", { name: /exit to normal site/i }).click()

    await page.waitForURL(/\/$/, { timeout: 20_000 })
    await expect(page.getByRole("heading", { name: /forge your digital edge/i })).toBeVisible()
  })
})
