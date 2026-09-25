/**
 * Capture desktop + mobile screenshots of key public routes for paper-rhythm review.
 * Usage: node scripts/paper-rhythm-screenshots.mjs <out-dir> [label]
 */
import { chromium, devices } from "@playwright/test"
import { mkdirSync } from "node:fs"
import { join } from "node:path"

const outDir = process.argv[2] || "/opt/cursor/artifacts/paper-before"
const label = process.argv[3] || "before"
const base = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000"

mkdirSync(outDir, { recursive: true })

const routes = [
  { name: "homepage", path: "/" },
  { name: "work", path: "/work" },
  { name: "case_study", path: "/work/confirm-a-kill" },
  { name: "local_growth", path: "/local-growth" },
  { name: "custom_systems", path: "/custom-systems" },
  { name: "audit", path: "/business-growth-audit" },
  { name: "quote", path: "/quote" },
  { name: "about", path: "/about" },
  { name: "insights", path: "/insights" },
]

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", ...devices["iPhone 13"] },
]

async function prep(page) {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.addInitScript(() => {
    window.localStorage.setItem("scalesmiths.experience", "normal")
    window.localStorage.setItem("scalesmiths.e2e.disableCanvas", "true")
  })
}

async function dismissNoise(page) {
  // Cookie banner
  const reject = page.getByRole("button", { name: /reject non-essential/i })
  if (await reject.isVisible().catch(() => false)) {
    await reject.click().catch(() => {})
  }
  // Experience chooser
  const open = page.getByRole("button", { name: /open website/i })
  if (await open.isVisible().catch(() => false)) {
    await open.click().catch(() => {})
  }
  await page.addStyleTag({
    content: `
      canvas, [data-v2-scene-canvas="true"], nextjs-portal,
      [data-nextjs-toast], [aria-label="Open Next.js Dev Tools"] {
        visibility: hidden !important;
      }
    `,
  })
}

async function shot(page, name, suffix) {
  const file = join(outDir, `${name}_${suffix}_${label}.png`)
  await page.screenshot({ path: file, fullPage: false })
  // Also capture a mid-page scroll that typically hits paper bands
  await page.evaluate(() => window.scrollTo(0, Math.min(document.body.scrollHeight * 0.35, 1200)))
  await page.waitForTimeout(200)
  await page.screenshot({ path: join(outDir, `${name}_${suffix}_mid_${label}.png`), fullPage: false })
  await page.evaluate(() => window.scrollTo(0, 0))
  console.log("wrote", file)
}

const browser = await chromium.launch({ headless: true })

for (const vp of viewports) {
  const context = await browser.newContext({
    viewport: vp.width ? { width: vp.width, height: vp.height } : undefined,
    ...("userAgent" in vp ? { userAgent: vp.userAgent, viewport: vp.viewport, deviceScaleFactor: vp.deviceScaleFactor, isMobile: vp.isMobile, hasTouch: vp.hasTouch } : {}),
    reducedMotion: "reduce",
  })
  const page = await context.newPage()
  await prep(page)

  // Seed consent cookie from real constant if possible
  await page.goto(base + "/", { waitUntil: "domcontentloaded" })
  await page.evaluate(() => {
    document.cookie = `scalesmiths.cookie-consent=${encodeURIComponent(JSON.stringify({
      version: 1,
      functional: false,
      analytics: false,
      marketing: false,
      decidedAt: "2026-09-02T00:00:00.000Z",
    }))}; Path=/; SameSite=Lax`
    localStorage.setItem("scalesmiths.experience", "normal")
  })

  for (const route of routes) {
    await page.goto(base + route.path, { waitUntil: "domcontentloaded" })
    await page.waitForFunction(() => document.documentElement.dataset.scalesmithsHydrated === "true").catch(() => {})
    await dismissNoise(page)
    await page.waitForTimeout(400)
    await shot(page, route.name, vp.name)
  }
  await context.close()
}

await browser.close()
console.log("done", outDir)
