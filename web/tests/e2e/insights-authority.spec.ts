import { expect, test } from "@playwright/test"
import { gotoReady, installConsoleGuards, mockExperienceAnalytics, rejectNonEssentialStorage } from "./helpers"

test.describe.configure({ timeout: 600_000 })

// The four topic clusters. `growth` and `automation` were retired because they listed almost the
// same articles as `websites` and `development`; both now 301 to their successor.
const categories = ["websites", "seo", "development", "infrastructure"] as const
const retiredCategories = [
  { from: "/insights/growth", to: "/insights/websites" },
  { from: "/insights/automation", to: "/insights/development" },
] as const
const samples = [
  "how-much-does-a-business-website-cost-uk-2026",
  "local-seo-nottingham-businesses-guide",
  "spf-dkim-dmarc-explained",
] as const

for (const viewport of [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 390, height: 844 }] as const) {
  test(`${viewport.name} Insights hub, categories and articles render cleanly`, async ({ page, request }) => {
    page.setViewportSize({ width: viewport.width, height: viewport.height })
    page.setDefaultNavigationTimeout(60_000)
    page.setDefaultTimeout(60_000)
    await rejectNonEssentialStorage(page)
    await mockExperienceAnalytics(page)
    const consoleGuards = await installConsoleGuards(page)

    for (const route of ["/insights", ...categories.map((category) => `/insights/${category}`)]) {
      const response = await gotoReady(page, route)
      expect(response?.status(), route).toBe(200)
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1)
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`${route.replaceAll("/", "\\/")}$`))
      expect(await page.locator('script[type="application/ld+json"]').count(), route).toBeGreaterThan(0)
      expect(await page.locator("article").count(), route).toBeGreaterThan(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${route} overflow`).toBeLessThanOrEqual(1)
    }

    for (const slug of samples) {
      const route = `/insights/${slug}`
      const response = await gotoReady(page, route)
      expect(response?.status(), route).toBe(200)
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1)
      await expect(page.locator('meta[property="article:published_time"]')).toHaveAttribute("content", /2026-09-23/)
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`${route.replaceAll("/", "\\/")}$`))
      await expect(page.getByRole("link", { name: /Rhys|Trevor/ }).first()).toHaveAttribute("rel", "author")
      expect(await page.locator('script[type="application/ld+json"]').allTextContents()).toEqual(expect.arrayContaining([expect.stringContaining("BlogPosting")]))
      await expect(page.getByRole("navigation", { name: "On this page" })).toHaveCount(viewport.name === "desktop" ? 1 : 0)
      expect(await page.locator('a[href^="/insights/"]').count(), route).toBeGreaterThan(3)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${route} overflow`).toBeLessThanOrEqual(1)
    }

    const feed = await request.get("/feed.xml", { timeout: 60_000 })
    expect(feed.status()).toBe(200)
    expect(feed.headers()["content-type"]).toContain("application/rss+xml")
    await consoleGuards.expectClean()
  })
}

test("redirects retired insight hubs to the cluster that absorbed them", async ({ request }) => {
  for (const { from, to } of retiredCategories) {
    const response = await request.get(from, { maxRedirects: 0 })
    expect(response.status(), from).toBe(308)
    expect(response.headers().location, from).toContain(to)
  }
})
