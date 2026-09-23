import { expect, test, type Page } from "@playwright/test"
import { buildPublicSitemap } from "../../src/lib/public-sitemap"
import { gotoReady, rejectNonEssentialStorage, setExperience } from "./helpers"

/**
 * One crawl of the public site, used as the site-wide audit: it follows every internal link from
 * the homepage and checks the pages it finds for the failures that are cheap to introduce and
 * expensive to notice — dead links, orphaned routes, duplicate element ids, missing or duplicated
 * metadata, broken heading order and mobile overflow.
 *
 * Portal and API routes are excluded: they are authenticated surfaces, not part of the public
 * information architecture.
 */

const sitemapPaths = buildPublicSitemap("https://scalesmiths.co.uk").map((entry) => new URL(entry.url).pathname)

/**
 * The experience-chooser routes. They are reached through the chooser rather than a standing
 * link, render their own chrome, and are covered by public-site.spec.ts, so the crawl neither
 * visits them nor counts them as orphans.
 */
const EXPERIENCE_ROUTES = new Set<string>(["/interactive", "/traditional"])

const SKIP_PREFIXES = ["/portal", "/api", "/_next", "/.well-known"]
const SKIP_EXACT = new Set(["/openapi.json", "/robots.txt", "/sitemap.xml", "/feed.xml", "/opengraph-image"])

function crawlable(pathname: string) {
  if (SKIP_EXACT.has(pathname) || EXPERIENCE_ROUTES.has(pathname)) return false
  return !SKIP_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

/**
 * Like `gotoReady`, but with a hydration budget sized for a crawl: the first visit to a route on
 * a dev server includes its compile, which exceeds the shared helper's fixed 10s wait.
 */
async function visit(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => document.documentElement.dataset.scalesmithsHydrated === "true", undefined, { timeout: 120_000 })
  return response
}

async function internalLinks(page: Page, origin: string): Promise<string[]> {
  return page.evaluate((base) => {
    const seen = new Set<string>()
    for (const anchor of Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))) {
      const href = anchor.getAttribute("href") ?? ""
      if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) continue
      let url: URL
      try {
        url = new URL(href, base)
      } catch {
        continue
      }
      if (url.origin !== base) continue
      seen.add(url.pathname)
    }
    return Array.from(seen)
  }, origin)
}

test.describe("public internal link graph", () => {
  test.describe.configure({ timeout: 900_000 })
  // The crawl visits every public route once. Against a dev server that means a first-hit
  // compile per route, which comfortably exceeds the default navigation timeout.
  test.use({ navigationTimeout: 120_000 })

  test("has no orphan pages, dead internal links or page-level defects", async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin
    await setExperience(page, "normal")
    await rejectNonEssentialStorage(page)

    const consoleErrors: string[] = []
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(`${page.url()} :: ${message.text()}`)
    })
    page.on("pageerror", (error) => consoleErrors.push(`${page.url()} :: ${error.message}`))

    const queue = ["/"]
    const visited = new Set<string>()
    const linkedTo = new Set<string>()
    const notFound: string[] = []
    const duplicateIds: string[] = []
    const metadataProblems: string[] = []
    const headingProblems: string[] = []

    while (queue.length > 0) {
      const path = queue.shift()!
      if (visited.has(path) || !crawlable(path)) continue
      visited.add(path)

      const response = await visit(page, path)
      const status = response?.status() ?? 0
      if (status >= 400) {
        notFound.push(`${path} -> ${status}`)
        continue
      }

      const audit = await page.evaluate(() => {
        const counts = new Map<string, number>()
        for (const element of Array.from(document.querySelectorAll("[id]"))) {
          const id = element.id
          if (id) counts.set(id, (counts.get(id) ?? 0) + 1)
        }
        const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).map((heading) =>
          Number(heading.tagName.slice(1)),
        )
        return {
          duplicates: Array.from(counts.entries()).filter(([, count]) => count > 1).map(([id]) => id),
          title: document.title,
          description: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "",
          canonicalCount: document.querySelectorAll('link[rel="canonical"]').length,
          noindex: (document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? "").includes("noindex"),
          h1Count: document.querySelectorAll("h1").length,
          headings,
        }
      })

      if (audit.duplicates.length > 0) duplicateIds.push(`${path}: ${audit.duplicates.join(", ")}`)
      if (!audit.title.trim()) metadataProblems.push(`${path}: empty title`)
      if (audit.description.trim().length < 50) metadataProblems.push(`${path}: description too short`)
      // A deliberately noindex route (form steps, thank-you pages) needs no canonical; an
      // indexable one needs exactly one.
      if (!audit.noindex && audit.canonicalCount !== 1) metadataProblems.push(`${path}: ${audit.canonicalCount} canonical tags`)
      if (audit.h1Count !== 1) headingProblems.push(`${path}: ${audit.h1Count} h1 elements`)

      // A heading may only go one level deeper than the one before it.
      for (let index = 1; index < audit.headings.length; index += 1) {
        const jump = audit.headings[index] - audit.headings[index - 1]
        if (jump > 1) {
          headingProblems.push(`${path}: h${audit.headings[index - 1]} followed by h${audit.headings[index]}`)
          break
        }
      }

      for (const link of await internalLinks(page, origin)) {
        linkedTo.add(link)
        if (!visited.has(link) && crawlable(link)) queue.push(link)
      }
    }

    const orphans = sitemapPaths.filter((path) => !linkedTo.has(path) && !EXPERIENCE_ROUTES.has(path) && path !== "/")
    const unreachable = sitemapPaths.filter((path) => !visited.has(path) && !EXPERIENCE_ROUTES.has(path))

    expect(notFound, "internal links that do not resolve").toEqual([])
    expect(orphans, "sitemap routes nothing links to").toEqual([])
    expect(unreachable, "sitemap routes the crawl never reached").toEqual([])
    expect(duplicateIds, "duplicate element ids").toEqual([])
    expect(metadataProblems, "metadata problems").toEqual([])
    expect(headingProblems, "heading hierarchy problems").toEqual([])
    expect(consoleErrors, "console errors during the crawl").toEqual([])
    expect(visited.size).toBeGreaterThan(50)
  })
})

test.describe("search entry points on mobile", () => {
  test.use({ navigationTimeout: 120_000 })

  const entryPoints = [
    "/",
    "/services",
    "/work",
    "/work/confirm-a-kill",
    "/work/precision-finish-plastering-rendering",
    "/web-design-nottingham",
    "/local-seo-nottingham",
    "/website-maintenance-nottingham",
    "/locations/nottingham",
    "/faq",
    "/insights",
    "/insights/seo",
    "/services/managed-business-email",
    "/digital-growth-partnership",
  ]

  for (const path of entryPoints) {
    test(`${path} has no horizontal overflow and offers a next action`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await setExperience(page, "normal")
      await rejectNonEssentialStorage(page)
      await gotoReady(page, path)

      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
        `${path} overflows horizontally`,
      ).toBe(true)

      // Every page a visitor can land on from search offers a commercial next step in its own
      // content — the standing header and footer links do not count.
      const inContentConversionRoutes = await page.evaluate(() => {
        const selector = [
          'a[href="/quote"]',
          'a[href^="/quote?"]',
          'a[href="/contact"]',
          'a[href="/services/business-growth-audit"]',
          'a[href="/seo-website-audit"]',
          'a[href="/local-growth-check"]',
          'a[href="/services/managed-business-email/get-started"]',
        ].join(", ")
        return Array.from(document.querySelectorAll<HTMLAnchorElement>(selector))
          .filter((anchor) => {
            // A page's own <header>/<footer> inside <main> is content; the site chrome is not.
            const banner = anchor.closest("header, footer")
            return !banner || Boolean(banner.closest("main"))
          })
          .map((anchor) => anchor.getAttribute("href") ?? "")
      })
      expect(inContentConversionRoutes, `${path} offers no conversion route outside the chrome`).not.toEqual([])
    })
  }
})

test.describe("FAQ knowledge base behaviour", () => {
  test("searches, deep-links and opens answers without JavaScript errors", async ({ page }) => {
    await setExperience(page, "normal")
    await rejectNonEssentialStorage(page)
    await gotoReady(page, "/faq")

    // Native disclosure: operable, and closed by default.
    const spf = page.locator("#faq-spf")
    await expect(spf).toHaveCount(1)
    await expect(spf).not.toHaveAttribute("open", /.*/)
    await spf.locator("summary").click()
    await expect(spf).toHaveAttribute("open", /.*/)

    // Search filters the library down.
    await page.getByLabel(/search the answers/i).fill("dmarc")
    await expect(page.locator("details#faq-dmarc")).toBeVisible()
    await expect(page.locator("details#faq-cost")).toHaveCount(0)
    await page.getByRole("button", { name: /clear search/i }).click()
    await expect(page.locator("details#faq-cost")).toBeVisible()

    // Category navigation anchors exist for every group.
    for (const slug of ["web-design", "seo", "ongoing-support", "custom-development", "infrastructure", "commercial"]) {
      await expect(page.locator(`#${slug}`)).toHaveCount(1)
    }
  })

  test("opens the answer named by the URL fragment", async ({ page }) => {
    await setExperience(page, "normal")
    await rejectNonEssentialStorage(page)
    await gotoReady(page, "/faq#faq-backups")
    await expect(page.locator("#faq-backups")).toHaveAttribute("open", /.*/)
  })
})
