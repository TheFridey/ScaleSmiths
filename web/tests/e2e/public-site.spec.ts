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

    expect(response.status()).toBe(200)
    expect(locations).not.toContain("https://scalesmiths.co.uk/traditional")
    expect(locations.filter((location) => location === "https://scalesmiths.co.uk")).toHaveLength(1)
    expect(new Set(locations).size).toBe(locations.length)
    expect(xml).toContain("2026-07-18T00:00:00.000Z")
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

    const servicesLink = page.getByRole("navigation", { name: /main navigation/i }).getByRole("link", { name: /services/i })
    await expect(servicesLink).toHaveAttribute("href", "/services")
    await servicesLink.click({ noWaitAfter: true })
    await page.waitForURL(/\/services$/, { timeout: 20_000, waitUntil: "domcontentloaded" })
    await expect(page.getByRole("heading", { name: /commercial web builds/i })).toBeVisible()

    const requestQuoteLink = page.getByRole("link", { name: /request a quote/i }).first()
    await expect(requestQuoteLink).toHaveAttribute("href", "/quote")
    await requestQuoteLink.click({ noWaitAfter: true })
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
