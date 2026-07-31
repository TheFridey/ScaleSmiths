import { expect, test } from "@playwright/test"
import { gotoReady, installConsoleGuards, mockExperienceAnalytics, setExperience } from "./helpers"

test.beforeEach(async ({ page }) => {
  await mockExperienceAnalytics(page)
  await setExperience(page, "normal")
  await page.addInitScript(() => {
    window.localStorage.setItem("scalesmiths.e2e.disableCanvas", "true")
  })
})

test.describe("about and founders page", () => {
  test("identifies who owns and delivers the work", async ({ page }) => {
    await gotoReady(page, "/about")

    await expect(page.getByRole("heading", { level: 1 })).toContainText(/two founders/i)
    await expect(page.getByRole("heading", { level: 3, name: "Rhys", exact: true })).toBeVisible()
    await expect(page.getByRole("heading", { level: 3, name: "Trevor" })).toBeVisible()

    const rhys = page.locator("#rhys")
    await expect(rhys).toContainText(/co-founder/i)
    await expect(rhys.getByRole("link", { name: /glow tanning/i })).toHaveAttribute("href", "/work/glow-tanning")
    await expect(rhys).toContainText("Next.js")

    const trevor = page.locator("#trevor-newton-bradley")
    await expect(trevor.getByRole("link", { name: /the business circle/i })).toHaveAttribute(
      "href",
      "/work/the-business-circle",
    )
  })

  test("publishes the origin, location and approach without unsupported claims", async ({ page }) => {
    await gotoReady(page, "/about")

    await expect(page.getByRole("heading", { name: /how scalesmiths started/i })).toBeVisible()
    await expect(page.getByText("Hucknall, Nottinghamshire").first()).toBeVisible()
    await expect(page.getByRole("heading", { name: /strategy\. systems\. delivery\./i })).toBeVisible()

    const body = page.locator("body")
    for (const unsupported of [
      /years of experience/i,
      /award[- ]winning/i,
      /\d+\+?\s*clients/i,
      /(?:formerly|previously) at/i,
      /degree/i,
    ]) {
      await expect(body).not.toContainText(unsupported)
    }
  })

  test("marks unevidenced biography detail as awaiting founder confirmation", async ({ page }) => {
    await gotoReady(page, "/about")

    const notices = page.getByText(/awaiting founder confirmation/i)
    await expect(notices).toHaveCount(2)
    await expect(page.locator("#rhys")).toContainText(/a photograph for publication/i)
  })

  test("uses monogram presentation rather than stock portraits", async ({ page }) => {
    await gotoReady(page, "/about")

    await expect(page.locator("#rhys img")).toHaveCount(0)
    await expect(page.locator("#trevor-newton-bradley img")).toHaveCount(0)
  })

  test("publishes canonical metadata and consistent founder structured data", async ({ page }) => {
    await gotoReady(page, "/about")

    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href")
    expect(new URL(canonical ?? "", "https://scalesmiths.co.uk").pathname).toBe("/about")
    await expect(page).toHaveTitle(/about & founders \| scalesmiths/i)

    const structuredData = (await page.locator('script[type="application/ld+json"]').allTextContents()).join(" ")
    expect(structuredData).toContain("AboutPage")
    expect(structuredData).toContain("BreadcrumbList")
    expect(structuredData).toContain("/about#rhys")
    expect(structuredData).toContain("/about#trevor-newton-bradley")
    expect(structuredData).toContain("Trevor Newton-Bradley")
    expect(structuredData).toContain("foundingLocation")
  })

  test("reaches about from the main navigation and the footer", async ({ page }) => {
    await gotoReady(page, "/")

    const footerLink = page.getByRole("navigation", { name: /footer navigation/i }).getByRole("link", { name: "About" })
    await expect(footerLink).toHaveAttribute("href", "/about")

    const navLink = page.getByRole("navigation", { name: /main navigation/i }).getByRole("link", { name: "About", exact: true })
    await expect(navLink).toHaveAttribute("href", "/about")
    await navLink.click({ noWaitAfter: true })

    await page.waitForURL(/\/about$/, { timeout: 20_000, waitUntil: "domcontentloaded" })
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  })

  test("links portfolio work back to the responsible founder", async ({ page }) => {
    await gotoReady(page, "/work/glow-tanning")

    const credit = page.getByRole("link", { name: /made by rhys/i })
    await expect(credit).toHaveAttribute("href", "/about#rhys")
    await credit.click({ noWaitAfter: true })

    await page.waitForURL(/\/about#rhys$/, { timeout: 20_000, waitUntil: "domcontentloaded" })
    await expect(page.locator("#rhys")).toBeVisible()
  })

  test("offers a founder-led call to action", async ({ page }) => {
    await gotoReady(page, "/about")

    await expect(page.getByRole("link", { name: /talk to a founder/i })).toHaveAttribute(
      "href",
      "/quote?intent=strategy_call",
    )
    await expect(page.getByRole("heading", { name: /speak to a founder, not a sales team/i })).toBeVisible()
    await expect(page.getByRole("link", { name: /request a strategy call/i })).toHaveAttribute(
      "href",
      "/quote?intent=strategy_call",
    )
  })

  test("stays usable on mobile without horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await gotoReady(page, "/about")

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expect(page.getByRole("link", { name: /talk to a founder/i })).toBeVisible()

    await page.getByRole("button", { name: /open menu/i }).click()
    await expect(page.getByRole("banner").getByRole("link", { name: "About", exact: true }).last()).toBeVisible()
  })

  test("exposes an accessible heading and landmark structure", async ({ page }) => {
    const consoleGuard = await installConsoleGuards(page)
    await gotoReady(page, "/about")

    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1)
    await expect(page.getByRole("navigation", { name: /breadcrumb/i })).toBeVisible()
    await expect(page.getByRole("article").first()).toHaveAttribute("aria-labelledby", "founder-rhys")

    await page.keyboard.press("Tab")
    await expect(page.getByRole("link", { name: /skip to content/i })).toBeFocused()
    await page.keyboard.press("Enter")
    await expect(page.locator("#main")).toBeFocused()

    await page.keyboard.press("Tab")
    const focused = page.locator(":focus")
    await expect(focused).toBeVisible()
    await expect(focused).toHaveCSS("outline-style", /solid|auto/)

    await consoleGuard.expectClean()
  })
})
