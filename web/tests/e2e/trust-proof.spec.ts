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

test.describe("homepage proof and trust", () => {
  test("shows published client work before the service offer", async ({ page }) => {
    await gotoReady(page, "/")

    const trust = page.getByRole("region", { name: /trusted to build for businesses/i })
    await expect(trust).toBeVisible()
    await expect(trust.getByRole("link", { name: /precision finish/i })).toHaveAttribute("href", "/work/precision-finish-plastering-rendering")
    await expect(trust.getByRole("link", { name: /glow tanning/i })).toHaveAttribute("href", "/work/glow-tanning")
    // Every named business must resolve to a published case study.
    await expect(trust.getByRole("link", { name: /confirm-a-kill/i })).toHaveAttribute("href", "/work/confirm-a-kill")

    const order = await page.evaluate(() => {
      const top = (selector: string) => document.querySelector(selector)?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY
      return {
        trust: top('[aria-labelledby="client-trust-heading"]'),
        work: top('section[aria-label="Selected work"]'),
        services: top('section[aria-label="Services and pricing"]'),
        founders: top('[aria-labelledby="home-founders-heading"]'),
      }
    })
    expect(order.trust).toBeLessThan(order.work)
    expect(order.work).toBeLessThan(order.services)
    expect(order.services).toBeLessThan(order.founders)
  })

  test("introduces both founders with links to their profiles", async ({ page }) => {
    await gotoReady(page, "/")

    const founders = page.getByRole("region", { name: /the people you speak to are the people doing the work/i })
    await expect(founders).toBeVisible()
    await expect(founders.getByRole("link", { name: /^rhys/i })).toHaveAttribute("href", "/about/rhys")
    await expect(founders.getByRole("link", { name: /trevor newton-bradley/i })).toHaveAttribute("href", "/about/trevor-newton-bradley")
    await expect(founders).toContainText(/outsourced developer/i)
  })

  test("features a case study and publishes the organisation entity once", async ({ page }) => {
    await gotoReady(page, "/")

    await expect(page.getByRole("region", { name: "Confirm-A-Kill" }).getByRole("link", { name: /read the case study/i })).toHaveAttribute("href", "/work/confirm-a-kill")

    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents()
    const organisations = blocks.join(" ").match(/"@type":\["Organization","ProfessionalService"\]/g) ?? []
    expect(organisations).toHaveLength(1)
    expect(blocks.join(" ")).toContain('"@type":"WebSite"')
  })
})

test.describe("trust footer and contact", () => {
  test("lets visitors verify who and where the business is", async ({ page }) => {
    await gotoReady(page, "/work")

    const footer = page.getByRole("contentinfo")
    await expect(footer).toContainText("Hucknall, Nottinghamshire")
    await expect(footer).toContainText("Serving businesses across the UK")
    await expect(footer.getByRole("link", { name: "hello@scalesmiths.co.uk" })).toHaveAttribute("href", "mailto:hello@scalesmiths.co.uk")

    const nav = page.getByRole("navigation", { name: /footer navigation/i })
    for (const [name, href] of [["About", "/about"], ["Work", "/work"], ["Services", "/services"], ["Contact", "/contact"]] as const) {
      await expect(nav.getByRole("link", { name, exact: true })).toHaveAttribute("href", href)
    }
    await expect(footer.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/legal/privacy")
    await expect(footer.getByRole("link", { name: "Cookie Policy" })).toHaveAttribute("href", "/legal/cookies")
  })

  test("publishes an indexable contact page with direct routes to the founders", async ({ page }) => {
    await gotoReady(page, "/contact")

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/speak directly to the founders/i)
    await expect(page.getByRole("link", { name: /start a project brief/i })).toHaveAttribute("href", "/quote")
    await expect(page.getByRole("complementary", { name: /business details/i }).getByRole("link", { name: /trevor newton-bradley/i })).toHaveAttribute("href", "/about/trevor-newton-bradley")
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href")
    expect(new URL(canonical ?? "", "https://scalesmiths.co.uk").pathname).toBe("/contact")
  })

  test("keeps the client portal out of search indexes", async ({ page }) => {
    await page.goto("/portal/login")
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/)
  })
})
