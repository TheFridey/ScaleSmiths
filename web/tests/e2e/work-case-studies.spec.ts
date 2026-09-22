import { expect, test } from "@playwright/test"
import { gotoReady, mockExperienceAnalytics, rejectNonEssentialStorage, setExperience } from "./helpers"

test.beforeEach(async ({ page }) => {
  await rejectNonEssentialStorage(page)
  await mockExperienceAnalytics(page)
  await setExperience(page, "normal")
  await page.addInitScript(() => {
    window.localStorage.setItem("scalesmiths.e2e.disableCanvas", "true")
  })
})

test.describe("work portfolio", () => {
  test("leads each project card with imagery, scope and a case study link", async ({ page }) => {
    await gotoReady(page, "/work")

    const cards = page.getByRole("article")
    await expect(cards).toHaveCount(8)

    const precision = cards.filter({ has: page.getByRole("heading", { name: "Precision Finish Plastering & Rendering" }) })
    // Card screenshots sit in an aria-hidden pointer-only link, so they are not exposed as img roles.
    await expect(precision.locator("img").first()).toBeVisible()
    await expect(precision).toContainText("Local SEO architecture")
    await expect(precision.getByRole("link", { name: /view case study/i })).toHaveAttribute("href", "/work/precision-finish-plastering-rendering")
    await expect(precision.getByRole("link", { name: /visit website/i })).toHaveAttribute("href", "https://precisionplasteringandrendering.co.uk")

    // Only projects with a confirmed live URL offer "Visit website" (every project except Pinkys Prints).
    await expect(page.getByRole("link", { name: /visit website/i })).toHaveCount(7)
    const pinkys = cards.filter({ has: page.getByRole("heading", { name: "Pinkys Prints" }) })
    await expect(pinkys.getByRole("link", { name: /visit website/i })).toHaveCount(0)
    // Screenshot placeholders are a development aid and never ship.
    await expect(page.getByText(/screenshot pending/i)).toHaveCount(0)
  })

  test("presents a case study as client, starting point, build and related services", async ({ page }) => {
    await gotoReady(page, "/work/glow-tanning")

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Glow Tanning")
    await expect(page.getByRole("navigation", { name: /breadcrumb/i }).getByRole("link", { name: "Work" })).toHaveAttribute("href", "/work")
    await expect(page.getByRole("heading", { name: /who glow tanning are/i })).toBeVisible()
    await expect(page.getByRole("heading", { name: /what scalesmiths built/i })).toBeVisible()
    await expect(page.getByRole("region", { name: /services and work behind this project/i }).getByRole("link", { name: /local growth/i })).toHaveAttribute("href", "/local-growth")

    // No invented results, quotes or live links.
    await expect(page.getByText(/awaiting measured results/i)).toHaveCount(0)
    await expect(page.getByRole("region", { name: /client perspective/i })).toHaveCount(0)
    // The hero link comes first; related case-study cards further down may carry their own.
    await expect(page.getByRole("link", { name: /visit website/i }).first()).toHaveAttribute("href", "https://glowtanninghucknall.co.uk")

    const structuredData = (await page.locator('script[type="application/ld+json"]').allTextContents()).join(" ")
    expect(structuredData).toContain('"@type":"Article"')
    expect(structuredData).toContain('"@type":"BreadcrumbList"')
  })

  test("links service pages back to relevant case studies", async ({ page }) => {
    await gotoReady(page, "/local-growth")
    await expect(page.getByRole("link", { name: /view case study\s*:\s*precision finish/i })).toHaveAttribute("href", "/work/precision-finish-plastering-rendering")
  })

  test("publishes the Confirm-A-Kill flagship with baseline and live links", async ({ page, request }) => {
    const response = await request.get("/work/confirm-a-kill")
    expect(response.ok()).toBe(true)
    await gotoReady(page, "/work/confirm-a-kill")
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Confirm-A-Kill")
    await expect(page.getByText("57.9K", { exact: true })).toBeVisible()
    await expect(page.getByText("0.3%", { exact: true })).toBeVisible()
    await expect(page.getByText(/no post-launch uplift is claimed yet/i)).toBeVisible()
    await expect(page.getByRole("link", { name: /visit website/i }).first()).toHaveAttribute("href", "https://www.confirmakill.co.uk/")
    const sitemap = await (await request.get("/sitemap.xml")).text()
    expect(sitemap).toContain("/work/confirm-a-kill")
  })

  test("keeps the Confirm-A-Kill case study responsive and error-free", async ({ page }) => {
    const errors: string[] = []
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()) })
    page.on("pageerror", (error) => errors.push(error.message))

    for (const viewport of [
      { width: 320, height: 720 },
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
      { width: 1440, height: 1000 },
    ]) {
      await page.setViewportSize(viewport)
      await gotoReady(page, "/work/confirm-a-kill")
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, `${viewport.width}px viewport overflow`).toBeLessThanOrEqual(1)
      await expect(page.locator('img[alt*="Confirm-A-Kill"]').first()).toBeVisible()
    }

    await expect(page).toHaveTitle(/Confirm-A-Kill Case Study.*Custom Website.*SEO.*ScaleSmiths/i)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/work\/confirm-a-kill$/)
    expect(errors).toEqual([])
  })
})
