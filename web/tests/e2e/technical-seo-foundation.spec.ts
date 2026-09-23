import { expect, test, type Page } from "@playwright/test"
import { gotoReady, mockExperienceAnalytics, rejectNonEssentialStorage } from "./helpers"

test.describe.configure({ timeout: 300_000 })

const importantRoutes = [
  "/",
  "/services",
  "/local-growth",
  "/custom-systems",
  "/web-design-hucknall",
  "/web-design-nottingham",
  "/digital-growth-partnership",
  "/work",
  "/work/confirm-a-kill",
  "/about",
  "/about/rhys",
  "/locations",
  "/faq",
  "/contact",
  "/pricing",
] as const

async function assertSeoDocument(page: Page, route: string) {
  await gotoReady(page, route)
  await expect(page).toHaveTitle(/\S+/)
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /\S+/)
  const canonical = await page.locator('link[rel="canonical"]').getAttribute("href")
  expect(new URL(canonical ?? "", "https://scalesmiths.co.uk").pathname).toBe(route)
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1)
  await expect(page.locator('meta[name="robots"]')).not.toHaveAttribute("content", /noindex/i)
  expect(await page.locator('script[type="application/ld+json"]').count()).toBeGreaterThan(0)
}

test.beforeEach(async ({ page }) => {
  page.setDefaultNavigationTimeout(60_000)
  await rejectNonEssentialStorage(page)
  await mockExperienceAnalytics(page)
})

test("important public routes expose complete indexation signals", async ({ page }) => {
  const titles = new Map<string, string>()
  const descriptions = new Map<string, string>()
  for (const route of importantRoutes) {
    await assertSeoDocument(page, route)
    const title = await page.title()
    const description = await page.locator('meta[name="description"]').getAttribute("content") ?? ""
    expect(titles.has(title), `Duplicate title on ${route} and ${titles.get(title)}`).toBe(false)
    expect(descriptions.has(description), `Duplicate description on ${route} and ${descriptions.get(description)}`).toBe(false)
    titles.set(title, route)
    descriptions.set(description, route)
  }
})

test("every sitemap URL responds successfully and stays canonical", async ({ request }) => {
  const sitemapResponse = await request.get("/sitemap.xml")
  expect(sitemapResponse.ok()).toBe(true)
  const sitemap = await sitemapResponse.text()
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
  expect(urls.length).toBeGreaterThan(10)
  expect(new Set(urls).size).toBe(urls.length)
  for (const url of urls) {
    const response = await request.get(new URL(url).pathname, { timeout: 60_000 })
    expect(response.status(), url).toBe(200)
  }
})

test("important pages contain no broken same-site document links", async ({ page, request }) => {
  const checked = new Set<string>()
  for (const route of ["/locations", "/faq", "/services", "/about", "/work"] as const) {
    await gotoReady(page, route)
    const hrefs = await page.locator('main a[href^="/"]').evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""))
    for (const href of hrefs) {
      const path = href.split("#")[0]
      if (!path || checked.has(path) || path.startsWith("/portal/")) continue
      checked.add(path)
      const response = await request.get(path, { timeout: 60_000 })
      expect(response.status(), `${route} -> ${path}`).toBeLessThan(400)
    }
  }
})

test("private and completion routes are excluded from robots and sitemap", async ({ request }) => {
  const [robots, sitemap] = await Promise.all([(await request.get("/robots.txt", { timeout: 60_000 })).text(), (await request.get("/sitemap.xml", { timeout: 60_000 })).text()])
  expect(robots).toContain("Disallow: /portal/")
  expect(robots).toContain("Disallow: /api/")
  for (const path of ["/portal/login", "/quote/thanks", "/services/business-growth-audit/start"]) expect(sitemap).not.toContain(path)
})
