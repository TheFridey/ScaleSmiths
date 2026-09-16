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
    await expect(cards).toHaveCount(7)

    const precision = cards.filter({ has: page.getByRole("heading", { name: "Precision Finish Plastering & Rendering" }) })
    // Card screenshots sit in an aria-hidden pointer-only link, so they are not exposed as img roles.
    await expect(precision.locator("img").first()).toBeVisible()
    await expect(precision).toContainText("Local SEO architecture")
    await expect(precision.getByRole("link", { name: /view case study/i })).toHaveAttribute("href", "/work/precision-finish-plastering-rendering")
    await expect(precision.getByRole("link", { name: /visit website/i })).toHaveAttribute("href", "https://precisionplasteringandrendering.co.uk")

    // Only projects with a confirmed live URL offer "Visit website" (every project except Pinkys Prints).
    await expect(page.getByRole("link", { name: /visit website/i })).toHaveCount(6)
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

  test("never publishes the unfinished Confirm-A-Kill draft", async ({ page, request }) => {
    const response = await request.get("/work/confirm-a-kill")
    expect(response.status()).toBe(404)

    await gotoReady(page, "/work")
    await expect(page.locator("main")).not.toContainText(/confirm-a-kill/i)

    const sitemap = await (await request.get("/sitemap.xml")).text()
    expect(sitemap).not.toContain("confirm-a-kill")
  })
})
