import { expect, test } from "@playwright/test"
import {
  EXPERIENCE_KEY,
  chooseNormalExperience,
  clearV2State,
  installConsoleGuards,
  gotoReady,
  mockQuoteApi,
  openInteractivePlan,
  setExperience,
  submitQuoteWizard,
} from "./helpers"

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("scalesmiths.e2e.disableCanvas", "true")
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
    await expect(page.locator("form").getByRole("button", { name: /book a strategy call/i })).toBeVisible()
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

    await expect(page).toHaveURL(/\/quote\/thanks$/)
    await expect(page.getByRole("heading", { name: /brief received/i })).toBeVisible()
  })

  test("surfaces quote submission failures safely", async ({ page }) => {
    await mockQuoteApi(page, { ok: false, status: 503, error: "Unable to submit your brief." })

    await submitQuoteWizard(page)

    await expect(page.getByText(/unable to submit your brief/i)).toBeVisible()
  })

  test("submits the interactive plan form successfully", async ({ page }) => {
    await mockQuoteApi(page, { ok: true })
    await openInteractivePlan(page)

    await page.getByLabel(/^name/i).fill("Riley Client")
    await page.getByLabel(/business name/i).fill("Riley Builds")
    await page.getByLabel(/^email/i).fill("riley@example.com")
    await page.getByLabel(/what do you want the website to do/i).fill("Win better enquiries and reduce manual follow-up.")
    await page.getByLabel(/budget range/i).selectOption({ label: "GBP 8,000-15,000" })
    await page.getByLabel(/timeline/i).selectOption({ label: "4-6 weeks" })
    await page.locator("form").getByRole("button", { name: /book a strategy call/i }).click()

    await expect(page.getByRole("status")).toContainText(/plan sent/i)
  })

  test("exits the interactive route back to the normal site", async ({ page }) => {
    await gotoReady(page, "/interactive")

    await page.getByRole("link", { name: /exit to normal site/i }).click()

    await page.waitForURL(/\/$/, { timeout: 20_000 })
    await expect(page.getByRole("heading", { name: /forge your digital edge/i })).toBeVisible()
  })
})
