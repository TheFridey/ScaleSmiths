import { expect, type Page } from "@playwright/test"

export const EXPERIENCE_KEY = "scalesmiths.experience"
export const INDUSTRY_KEY = "scalesmiths.v2.industry"

export async function installConsoleGuards(page: Page) {
  const messages: string[] = []

  page.on("console", (message) => {
    const text = message.text()
    if (message.type() === "error") messages.push(text)
  })
  page.on("pageerror", (error) => messages.push(error.message))

  return {
    async expectClean() {
      expect(messages.filter(isUnexpectedConsoleError)).toEqual([])
    },
  }
}

export async function setExperience(page: Page, value: "normal" | "interactive" | null) {
  await page.addInitScript(
    ({ key, preference }) => {
      window.localStorage.removeItem(key)
      if (preference) window.localStorage.setItem(key, preference)
    },
    { key: EXPERIENCE_KEY, preference: value },
  )
}

export async function waitForAppReady(page: Page) {
  await page.waitForLoadState("domcontentloaded")
  await page.waitForFunction(() => document.documentElement.dataset.scalesmithsHydrated === "true")
}

export async function gotoReady(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" })
  await waitForAppReady(page)
}

export async function clearV2State(page: Page) {
  await page.addInitScript(
    ({ experienceKey, industryKey }) => {
      window.localStorage.removeItem(experienceKey)
      window.localStorage.removeItem(industryKey)
    },
    { experienceKey: EXPERIENCE_KEY, industryKey: INDUSTRY_KEY },
  )
}

export async function disableVisualNoise(page: Page) {
  await page.addStyleTag({
    content: `
      *,
      *::before,
      *::after {
        animation-delay: 0s !important;
        animation-duration: 0.001s !important;
        animation-iteration-count: 1 !important;
        scroll-behavior: auto !important;
        transition-delay: 0s !important;
        transition-duration: 0.001s !important;
      }

      canvas,
      [data-v2-scene-canvas="true"],
      nextjs-portal,
      [data-nextjs-toast],
      [data-nextjs-dialog-overlay],
      [aria-label="Open Next.js Dev Tools"] {
        visibility: hidden !important;
      }
    `,
  })
}

export async function mockQuoteApi(page: Page, options: { ok: boolean; status?: number; error?: string }) {
  await page.route("**/api/quote", async (route) => {
    await route.fulfill({
      status: options.status ?? (options.ok ? 200 : 500),
      contentType: "application/json",
      body: JSON.stringify(options.ok ? { ok: true } : { ok: false, error: options.error ?? "Unable to submit your brief." }),
    })
  })
}

export async function mockExperienceAnalytics(page: Page) {
  await page.route("**/api/experience-events", async (route) => {
    await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ ok: true }) })
  })
}

export async function chooseNormalExperience(page: Page) {
  await page.getByRole("button", { name: /open website/i }).click()
  await expect(page.getByRole("heading", { name: /forge your digital edge/i })).toBeVisible()
}

export async function openInteractivePlan(page: Page) {
  await gotoReady(page, "/interactive")
  await expect(page.getByRole("link", { name: /exit to normal site/i })).toBeVisible()
  await page.getByRole("button", { name: /begin journey/i }).click()
  await page.getByRole("button", { name: /local trade/i }).click()
  await page.getByRole("button", { name: /forge/i }).click()
  await page.getByRole("button", { name: /reveal your plan/i }).click()
  await expect(page.getByRole("heading", { name: /system summary/i })).toBeVisible()
}

export async function submitQuoteWizard(page: Page) {
  await gotoReady(page, "/quote")
  await page.getByLabel(/full name/i).fill("Pat Test")
  await page.getByLabel(/email address/i).fill("pat@example.com")
  await page.getByLabel(/company name/i).fill("Pat Test Studio")
  await page.getByRole("button", { name: /continue/i }).click()
  await page.getByRole("radio", { name: /local service business/i }).click()
  await page.getByRole("radio", { name: /conversion website/i }).click()
  await page.getByRole("radio", { name: /gbp 8,000-15,000/i }).click()
  await page.getByRole("radio", { name: /4-6 weeks/i }).click()
  await page.getByLabel(/main business goal/i).fill("Book better qualified enquiries from local search.")
  await page.getByRole("button", { name: /continue/i }).click()
  await page.getByRole("radio", { name: /^seo$/i }).click()
  await page.getByRole("button", { name: /continue/i }).click()
  await page.getByRole("radio", { name: /^maybe$/i }).click()
  await page.getByRole("radio", { name: /^email$/i }).click()
  await page.getByLabel(/consent/i).check()
  await page.getByLabel(/project brief/i).fill("We need a clearer site, quote journey, and local growth plan.")
  await page.getByRole("button", { name: /submit brief/i }).click()
}

function isUnexpectedConsoleError(message: string) {
  return ![
    "favicon.ico",
    "ResizeObserver loop",
  ].some((allowed) => message.includes(allowed))
}
