import { expect, test } from "@playwright/test"
import { gotoReady, mockExperienceAnalytics, rejectNonEssentialStorage } from "./helpers"

test.beforeEach(async ({ page }) => {
  await rejectNonEssentialStorage(page)
  await mockExperienceAnalytics(page)
})

test.describe("commercial landing pages", () => {
  test("publishes a substantive Nottingham web design page with local evidence", async ({ page }) => {
    await gotoReady(page, "/web-design-nottingham")

    await expect(page).toHaveTitle("Web Design Nottingham for Service Businesses | ScaleSmiths")
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1)
    await expect(page.getByRole("heading", { name: /working with nottingham businesses from hucknall/i })).toBeVisible()
    await expect(page.getByRole("link", { name: /view case study\s*:\s*precision finish/i })).toHaveAttribute("href", "/work/precision-finish-plastering-rendering")
    await expect(page.getByRole("link", { name: "Trevor Newton-Bradley" }).first()).toHaveAttribute("href", "/about/trevor-newton-bradley")
    await expect(page.locator("main")).not.toContainText(/city-centre office in|#1|best web agency|guaranteed rankings/i)

    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href")
    expect(new URL(canonical ?? "", "https://scalesmiths.co.uk").pathname).toBe("/web-design-nottingham")
  })

  test("never repeats the brand in landing page titles", async ({ page }) => {
    for (const path of ["/web-design-hucknall", "/web-development-nottingham", "/next-js-agency-uk", "/custom-web-app-development-uk", "/e-commerce-development-nottingham", "/quote"]) {
      await page.goto(path)
      const title = await page.title()
      expect(title.match(/ScaleSmiths/g), `${path}: ${title}`).toHaveLength(1)
    }
  })

  test("only publishes FAQ structured data for questions visible on the page", async ({ page }) => {
    for (const path of ["/pricing", "/web-design-nottingham"]) {
      await gotoReady(page, path)
      const blocks = await page.locator('script[type="application/ld+json"]').allTextContents()
      const questions = blocks.flatMap((block) => [...block.matchAll(/"@type":"Question","name":"([^"]+)"/g)].map((match) => match[1]))
      expect(questions.length, path).toBeGreaterThan(0)
      for (const question of questions) await expect(page.getByText(question, { exact: true }).first()).toBeVisible()
    }
  })
})

test.describe("insights", () => {
  // The hub is published, so the guard is now the inverse: it must serve real articles while
  // never exposing an unwritten slug or listing one in the sitemap.
  test("serves the published hub and never an unpublished article", async ({ request }) => {
    expect((await request.get("/insights")).status()).toBe(200)
    expect((await request.get("/insights/what-a-website-rebuild-should-preserve-for-seo")).status()).toBe(404)
    const sitemap = await (await request.get("/sitemap.xml")).text()
    expect(sitemap).toContain("/insights")
    expect(sitemap).not.toContain("/insights/what-a-website-rebuild-should-preserve-for-seo")
  })
})
