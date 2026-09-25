/**
 * One-off screenshot capture for UI refinement before/after evidence.
 * Usage: node scripts/capture-ui-screenshots.mjs before|after
 */
import { chromium } from "@playwright/test"
import { mkdirSync } from "node:fs"
import { join } from "node:path"

const phase = process.argv[2] === "after" ? "after" : "before"
const outDir = join("/opt/cursor/artifacts", phase)
mkdirSync(outDir, { recursive: true })

const routes = [
  { name: "homepage", path: "/" },
  { name: "work", path: "/work" },
  { name: "case_confirm_a_kill", path: "/work/confirm-a-kill" },
  { name: "local_growth", path: "/local-growth" },
  { name: "custom_systems", path: "/custom-systems" },
  { name: "business_growth_audit", path: "/services/business-growth-audit" },
  { name: "quote", path: "/quote" },
  { name: "about", path: "/about" },
]

const base = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000"

async function prepare(page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("scalesmiths.experience", "normal")
    window.localStorage.setItem("scalesmiths.e2e.disableCanvas", "true")
    document.cookie = "ss_cookie_consent=" + encodeURIComponent(JSON.stringify({
      version: "3.0",
      decidedAt: new Date().toISOString(),
      functional: true,
      analytics: false,
      marketing: false,
    })) + "; path=/"
  })
  await page.emulateMedia({ reducedMotion: "reduce" })
}

async function shot(browser, viewport, suffix) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()
  await prepare(page)

  for (const route of routes) {
    await page.goto(base + route.path, { waitUntil: "domcontentloaded", timeout: 120_000 })
    await page.waitForFunction(() => document.documentElement.dataset.scalesmithsHydrated === "true", null, { timeout: 120_000 }).catch(() => {})
    // Dismiss experience chooser if present
    const normal = page.getByRole("button", { name: /open website/i })
    if (await normal.isVisible().catch(() => false)) await normal.click()
    await page.waitForTimeout(800)
    const file = join(outDir, `${route.name}_${suffix}.png`)
    await page.screenshot({ path: file, fullPage: false })
    console.log("wrote", file)
  }
  await context.close()
}

const browser = await chromium.launch()
await shot(browser, { width: 1440, height: 900 }, "desktop")
await shot(browser, { width: 390, height: 844 }, "mobile")
await browser.close()
console.log("done", phase)
