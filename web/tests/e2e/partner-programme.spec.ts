import { expect, test } from "@playwright/test"

// Regression coverage for the public Scale Your Future entry points (checkpoint 1/2).
// These use the real header, footer, calculator and page; no applications are submitted.
const viewports = [[320, 800], [390, 844], [768, 1024], [1024, 768], [1440, 900]] as const

test.describe("partner programme public entry points", () => {
  for (const [width, height] of viewports) {
    test(`header, calculator and layout at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      await page.goto("/partners")
      // Decline optional storage so the banner never covers controls.
      await page.getByRole("button", { name: /reject non-essential/i }).click({ timeout: 3000 }).catch(() => undefined)
      const cta = page.locator('header a[href="/partners"]:visible').first()
      await expect(cta).toBeVisible()
      await expect(cta).toHaveAccessibleName(/become a partner|partner/i)
      const box = await cta.boundingBox()
      expect(box!.height).toBeGreaterThanOrEqual(36)
      const overflow = await page.evaluate(() => ({ document: document.documentElement.scrollWidth - document.documentElement.clientWidth, nav: (document.querySelector("header nav") as HTMLElement).scrollWidth - (document.querySelector("header nav") as HTMLElement).clientWidth }))
      expect(overflow).toEqual({ document: 0, nav: 0 })
    })
  }

  test("mobile drawer offers Become a Partner first and keeps client enquiry routes", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/partners")
    await page.getByRole("button", { name: /reject non-essential/i }).click({ timeout: 3000 }).catch(() => undefined)
    await page.getByRole("button", { name: "Open menu" }).click()
    const drawer = page.locator("#mobile-navigation")
    await expect(drawer.getByRole("link", { name: /become a partner/i })).toBeVisible()
    await expect(drawer.getByRole("link", { name: /start a project/i })).toBeVisible()
    await expect(drawer.getByRole("link", { name: /client portal/i })).toBeVisible()
  })

  test("desktop keeps existing navigation and routes Become a Partner to /partners", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/about")
    await page.getByRole("button", { name: /reject non-essential/i }).click({ timeout: 3000 }).catch(() => undefined)
    for (const name of ["Industries", "Work", "Insights", "About", "FAQ"]) await expect(page.locator("header nav").getByRole("link", { name, exact: true })).toBeVisible()
    await expect(page.locator("header nav").getByRole("link", { name: /start a project/i })).toBeVisible()
    await page.locator("header nav").getByRole("link", { name: /become a partner/i }).click()
    await expect(page).toHaveURL(/\/partners$/)
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Scale Your Future")
  })

  test("partner login links target the existing admin origin on the page and in the footer", async ({ page }) => {
    await page.goto("/partners")
    const hrefs = await page.locator('a:has-text("Partner Login")').evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href))
    expect(hrefs.length).toBeGreaterThanOrEqual(2)
    for (const href of hrefs) expect(new URL(href).pathname).toBe("/login")
    expect(new Set(hrefs.map((href) => new URL(href).origin)).size).toBe(1)
    await expect(page.locator("footer").getByRole("link", { name: /become a partner/i })).toHaveAttribute("href", "/partners")
  })

  test("legacy /scale-your-future path permanently redirects to /partners", async ({ request, page }) => {
    const response = await request.get("/scale-your-future", { maxRedirects: 0 })
    expect(response.status()).toBe(308)
    expect(new URL(response.headers().location, "http://localhost").pathname).toBe("/partners")
    await page.goto("/scale-your-future")
    await expect(page).toHaveURL(/\/partners$/)
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Scale Your Future")
  })

  test("earnings calculator reproduces the programme examples", async ({ page }) => {
    await page.goto("/partners")
    const out = page.locator("output")
    for (const [count, value] of [["1", "£705"], ["2", "£1,410"], ["5", "£3,525"], ["10", "£7,050"], ["20", "£14,100"]] as const) {
      await page.locator("button[aria-pressed]", { hasText: new RegExp(`^${count}$`) }).click()
      await expect(out).toHaveText(value)
    }
    await page.getByRole("button", { name: "Growth Partnership only" }).click()
    await page.locator("button[aria-pressed]", { hasText: /^1$/ }).click()
    await expect(out).toHaveText("£105")
    await page.getByRole("button", { name: "Bespoke project" }).click()
    await page.getByRole("button", { name: "£25,000", exact: true }).click()
    await expect(out).toHaveText("£7,500")
    await expect(page.getByText(/no guaranteed earnings/i).first()).toBeVisible()
  })

  test("page states twelve-month terms, keeps intake closed and labels planned benefits", async ({ page }) => {
    await page.goto("/partners")
    await expect(page.getByText(/twelve-month minimum commitment/i).first()).toBeVisible()
    await expect(page.getByText("£6,200", { exact: false }).first()).toBeVisible()
    await expect(page.getByRole("heading", { name: "Applications are not open yet." })).toBeVisible()
    await expect(page.getByText(/six-month/i)).toHaveCount(0)
    await expect(page.getByRole("cell", { name: "PLANNED" }).first()).toBeVisible()
  })
})
