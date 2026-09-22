#!/usr/bin/env node
// Captures real screenshots of live client websites for the case-study media system.
//
//   node scripts/capture-work-media.mjs <folder> [<folder> ...]
//   node scripts/capture-work-media.mjs --all
//   node scripts/capture-work-media.mjs <folder> --only desktop-home,mobile-home
//
// Files are written to public/images/work/<folder>/<file>.webp using the naming convention in
// docs/content/case-study-media.md. Run `npm run work-media:sync` afterwards.
//
// Only add a site here once its URL has been confirmed as the live client website. Pages behind
// logins (admin, CRM, dashboards) are not captured by this script.
//
// Set PLAYWRIGHT_CHROMIUM_EXECUTABLE to use a locally installed Chromium build.
import { mkdirSync, statSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "@playwright/test"
import sharp from "sharp"

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..")
const outputRoot = join(appDir, "public", "images", "work")

const VIEWPORTS = {
  desktop: { width: 1440, height: 900, isMobile: false, hasTouch: false },
  tablet: { width: 768, height: 1024, isMobile: true, hasTouch: true },
  mobile: { width: 390, height: 844, isMobile: true, hasTouch: true },
}

/**
 * `path` is relative to the site origin. `anchor` scrolls a section to the top of the viewport
 * before capturing (offset leaves room for a sticky header). `hide` lists selectors for capture
 * artefacts that are not part of the visitor experience, such as a custom cursor at 0,0.
 */
export const captureConfig = {
  "precision-finish": {
    origin: "https://precisionplasteringandrendering.co.uk",
    shots: [
      { file: "desktop-home", view: "desktop", path: "/" },
      { file: "mobile-home", view: "mobile", path: "/" },
      { file: "desktop-service", view: "desktop", path: "/services/rendering/" },
      { file: "desktop-service-areas", view: "desktop", path: "/locations/nottingham/" },
      { file: "desktop-gallery", view: "desktop", path: "/", anchor: "#gallery", offset: -40 },
      { file: "mobile-quote", view: "mobile", path: "/", anchor: "#quote", offset: 72 },
    ],
  },
  "confirm-a-kill": {
    origin: "https://www.confirmakill.co.uk",
    shots: [
      { file: "desktop-home", view: "desktop", path: "/" },
      { file: "tablet-home", view: "tablet", path: "/" },
      { file: "mobile-home", view: "mobile", path: "/" },
      { file: "desktop-services", view: "desktop", path: "/", anchor: "#pest-help", offset: 32 },
      { file: "desktop-trust", view: "desktop", path: "/", anchor: ".reviews-section", offset: 32 },
      { file: "desktop-service", view: "desktop", path: "/services/wasp-nest-removal/" },
      { file: "desktop-location", view: "desktop", path: "/services/rat-control/", anchorText: "Serving Nottinghamshire", offset: 32 },
      { file: "desktop-advice", view: "desktop", path: "/news-views/" },
      { file: "desktop-article", view: "desktop", path: "/how-to-ged-rid-of-a-wasp-nest/" },
      { file: "desktop-quote", view: "desktop", path: "/free-local-pest-control-quote/" },
      { file: "mobile-contact", view: "mobile", path: "/free-local-pest-control-quote/" },
      { file: "mobile-service", view: "mobile", path: "/services/wasp-nest-removal/" },
    ],
  },
  "glow-tanning": {
    origin: "https://glowtanninghucknall.co.uk",
    // Custom cursor follower sits at the top-left corner in a headless browser.
    hide: ["#cursor", "#cursor-ring"],
    shots: [
      { file: "desktop-home", view: "desktop", path: "/" },
      { file: "mobile-home", view: "mobile", path: "/" },
      { file: "desktop-booking", view: "desktop", path: "/", anchor: "#booking", offset: 40 },
      { file: "desktop-reviews", view: "desktop", path: "/", anchor: "#reviews", offset: 40 },
    ],
  },
  csds: {
    origin: "https://csdshome.com",
    shots: [
      { file: "desktop-home", view: "desktop", path: "/" },
      // mobile-home omitted: the live CSDS navigation has no mobile toggle yet (links stack above the hero).
      { file: "desktop-quote", view: "desktop", path: "/", anchor: "#quote", offset: 40 },
    ],
  },
  "the-business-circle": {
    origin: "https://thebusinesscircle.net",
    shots: [
      { file: "desktop-home", view: "desktop", path: "/home" },
      { file: "mobile-home", view: "mobile", path: "/home" },
      { file: "desktop-membership", view: "desktop", path: "/membership", anchor: "#choose-membership", offset: 150 },
    ],
  },
  prymal: {
    origin: "https://prymal.io",
    shots: [
      { file: "desktop-home", view: "desktop", path: "/" },
      { file: "mobile-home", view: "mobile", path: "/" },
      { file: "desktop-pricing", view: "desktop", path: "/pricing", anchor: "#pricing-decision-heading", offset: 210 },
    ],
  },
  veteranfinder: {
    origin: "https://veteranfinder.co.uk",
    shots: [
      { file: "desktop-home", view: "desktop", path: "/" },
      { file: "mobile-home", view: "mobile", path: "/" },
    ],
  },
}

/**
 * Cookie banners: prefer a reject/necessary-only choice. Where only "accept" is offered, hide the
 * banner overlay instead of consenting, so captures never create consent or analytics records.
 */
async function dismissConsent(page) {
  await page.evaluate(() => {
    const controls = [...document.querySelectorAll("button, a, [role=button]")]
    const text = (element) => (element.textContent || "").trim()
    const reject = controls.find((element) => /^(reject( all| non-essential)?|decline|necessary only|only necessary|essential only)$/i.test(text(element)))
    if (reject) {
      reject.click()
      return
    }
    const accept = controls.find((element) => /^(accept( all)?|allow all|i agree|agree|got it)$/i.test(text(element)))
    if (!accept) return
    let node = accept
    while (node && node !== document.body) {
      const position = getComputedStyle(node).position
      if (position === "fixed" || position === "sticky") {
        node.style.setProperty("display", "none", "important")
        return
      }
      node = node.parentElement
    }
  })
  await page.waitForTimeout(400)
}

async function settle(page) {
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {})
  // Walk the page once so lazy images and scroll-reveal content load, then return to the top.
  await page.evaluate(async () => {
    const step = Math.max(400, Math.floor(window.innerHeight * 0.8))
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y)
      await new Promise((resolve) => setTimeout(resolve, 120))
    }
    window.scrollTo(0, 0)
  })
  await page.evaluate(() => document.fonts?.ready)
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {})
  await page.waitForTimeout(1200)
}

async function captureShot(browser, config, folder, shot) {
  const { origin } = config
  const viewport = VIEWPORTS[shot.view]
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 2,
    isMobile: viewport.isMobile,
    hasTouch: viewport.hasTouch,
    reducedMotion: "reduce",
    locale: "en-GB",
    colorScheme: "light",
  })
  const page = await context.newPage()
  try {
    const response = await page.goto(new URL(shot.path, origin).toString(), { waitUntil: "domcontentloaded", timeout: 60_000 })
    if (!response || response.status() >= 400) throw new Error(`HTTP ${response?.status()} for ${shot.path}`)
    await dismissConsent(page)
    await settle(page)
    await dismissConsent(page)

    if (shot.anchor || shot.anchorText) {
      const found = await page.evaluate(({ anchor, anchorText, offset }) => {
        const element = anchor
          ? document.querySelector(anchor)
          : [...document.querySelectorAll("h1, h2, h3")].find((candidate) => candidate.textContent?.trim() === anchorText)
        if (!element) return false
        window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - (offset ?? 0))
        return true
      }, { anchor: shot.anchor, anchorText: shot.anchorText, offset: shot.offset })
      if (!found) throw new Error(`Anchor ${shot.anchor ?? shot.anchorText} not found on ${shot.path}`)
      await page.waitForTimeout(1200)
    }

    await dismissConsent(page)
    // Snap carousels and hover effects to their resting state so nothing is captured mid-transition.
    const hidden = (config.hide ?? []).join(", ")
    await page.addStyleTag({ content: `*, *::before, *::after { transition: none !important; caret-color: transparent !important; }${hidden ? ` ${hidden} { visibility: hidden !important; }` : ""}` })
    await page.waitForTimeout(600)
    const png = await page.screenshot({ type: "png" })
    const target = join(outputRoot, folder, `${shot.file}.webp`)
    mkdirSync(dirname(target), { recursive: true })
    await sharp(png).webp({ quality: 82, effort: 6 }).toFile(target)
    const { width, height } = await sharp(target).metadata()
    return `${folder}/${shot.file}.webp  ${width}x${height}  ${Math.round(statSync(target).size / 1024)}KB`
  } finally {
    await context.close()
  }
}

const args = process.argv.slice(2)
const onlyIndex = args.indexOf("--only")
const only = onlyIndex >= 0 ? new Set((args[onlyIndex + 1] ?? "").split(",").filter(Boolean)) : undefined
const positional = args.filter((arg, index) => !arg.startsWith("--") && !(onlyIndex >= 0 && index === onlyIndex + 1))
const folders = args.includes("--all") ? Object.keys(captureConfig) : positional
if (folders.length === 0) {
  console.error(`Usage: node scripts/capture-work-media.mjs <folder...> | --all\nConfigured: ${Object.keys(captureConfig).join(", ")}`)
  process.exit(1)
}

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined })
let failures = 0
try {
  for (const folder of folders) {
    const config = captureConfig[folder]
    if (!config) {
      console.error(`No capture config for "${folder}"`)
      failures += 1
      continue
    }
    for (const shot of config.shots.filter((candidate) => !only || only.has(candidate.file))) {
      try {
        console.log(`captured ${await captureShot(browser, config, folder, shot)}`)
      } catch (error) {
        failures += 1
        console.error(`FAILED ${folder}/${shot.file}: ${error instanceof Error ? error.message : error}`)
      }
    }
  }
} finally {
  await browser.close()
}
process.exit(failures ? 1 : 0)
