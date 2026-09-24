#!/usr/bin/env node
/**
 * Full public-site SEO audit.
 *
 * Renders every indexable URL with Playwright (so client-rendered content and JSON-LD injected
 * by React are both visible), records what a search engine would see, and writes:
 *
 *   docs/seo-audit.json       machine-readable, one record per URL plus a findings list
 *   docs/SEO_FINAL_AUDIT.md   human-readable summary
 *
 * Usage:
 *   node scripts/seo-audit.mjs [--base http://127.0.0.1:3000] [--out ../docs]
 *
 * Findings are severity-tagged. `error` means a search engine or a visitor is materially
 * affected; `warning` means it is worth a look; `info` is context, not a defect.
 */

import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "@playwright/test"

const scriptDir = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(scriptDir, "..")
const repoRoot = resolve(webRoot, "..")

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? fallback : process.argv[index + 1]
}

const BASE = (arg("base", process.env.SEO_AUDIT_BASE ?? "http://127.0.0.1:3000")).replace(/\/+$/, "")
const OUT_DIR = resolve(repoRoot, arg("out", "docs"))
const PRODUCTION_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://scalesmiths.co.uk").replace(/\/+$/, "")

/** Authenticated or machine surfaces: not part of the indexable public site. */
const SKIP_PREFIXES = ["/portal", "/api", "/_next", "/.well-known"]
const SKIP_EXACT = new Set([
  "/openapi.json",
  "/robots.txt",
  "/sitemap.xml",
  "/feed.xml",
  "/llms.txt",
  "/opengraph-image",
  // Rendered through the experience chooser with their own chrome; audited visually instead.
  "/interactive",
  "/traditional",
])

const isSkipped = (path) =>
  SKIP_EXACT.has(path) || SKIP_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))

/**
 * Routes that are short because of what they are, not because the content is unfinished: legal
 * documents say exactly what they need to, and a form, a directory or a contact page is a task
 * surface rather than an article. Flagging these every run trains people to ignore the report.
 */
const EXPECTED_SHORT = [/^\/legal(\/|$)/, /^\/quote(\/|$)/, /^\/contact$/, /^\/locations$/, /\/(start|get-started|thanks)$/]
const isExpectedShort = (path) => EXPECTED_SHORT.some((pattern) => pattern.test(path))

async function fetchSitemap() {
  const response = await fetch(`${BASE}/sitemap.xml`)
  if (!response.ok) throw new Error(`sitemap.xml returned ${response.status}`)
  const xml = await response.text()
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]))
  return { paths: urls.map((url) => url.pathname), origin: urls[0] ? urls[0].origin : PRODUCTION_ORIGIN }
}

/** Everything a search engine would read off the rendered page. */
async function readPage(page) {
  return page.evaluate(() => {
    const attr = (selector, name) => document.querySelector(selector)?.getAttribute(name) ?? null
    const headings = [...document.querySelectorAll("h1, h2, h3, h4, h5, h6")].map((node) => ({
      level: Number(node.tagName.slice(1)),
      text: (node.textContent ?? "").trim().slice(0, 120),
    }))

    const schema = []
    for (const node of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const parsed = JSON.parse(node.textContent ?? "")
        for (const entry of Array.isArray(parsed) ? parsed : [parsed]) {
          if (entry && typeof entry === "object") schema.push(entry["@type"] ?? "unknown")
        }
      } catch {
        schema.push("INVALID_JSON")
      }
    }

    const images = [...document.querySelectorAll("img")].map((img) => ({
      src: img.getAttribute("src") ?? "",
      alt: img.getAttribute("alt"),
      hasDimensions: Boolean(img.getAttribute("width") && img.getAttribute("height")),
      nextImageMode: img.getAttribute("data-nimg"),
      loading: img.getAttribute("loading"),
      sizes: img.getAttribute("sizes"),
      naturalWidth: img.naturalWidth,
      decorative: img.getAttribute("alt") === "",
    }))

    const anchors = [...document.querySelectorAll("a[href]")].map((a) => ({
      href: a.getAttribute("href") ?? "",
      text: (a.textContent ?? "").trim().slice(0, 80),
      rel: a.getAttribute("rel"),
      target: a.getAttribute("target"),
      inMain: Boolean(a.closest("main")),
    }))

    const ids = [...document.querySelectorAll("[id]")].map((node) => node.id).filter(Boolean)
    const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))]

    // A rough content fingerprint for duplicate detection: main text, normalised.
    const mainText = (document.querySelector("main")?.textContent ?? "").replace(/\s+/g, " ").trim()

    return {
      title: document.title,
      description: attr('meta[name="description"]', "content"),
      canonical: attr('link[rel="canonical"]', "href"),
      robots: attr('meta[name="robots"]', "content"),
      ogTitle: attr('meta[property="og:title"]', "content"),
      ogDescription: attr('meta[property="og:description"]', "content"),
      ogImage: attr('meta[property="og:image"]', "content"),
      ogType: attr('meta[property="og:type"]', "content"),
      twitterCard: attr('meta[name="twitter:card"]', "content"),
      h1s: [...document.querySelectorAll("h1")].map((node) => (node.textContent ?? "").trim()),
      headings,
      schema,
      breadcrumb: Boolean(document.querySelector('nav[aria-label="Breadcrumb" i]')),
      images,
      anchors,
      duplicateIds,
      wordCount: mainText.split(/\s+/).filter(Boolean).length,
      fingerprint: mainText.slice(0, 4000).toLowerCase(),
      lang: document.documentElement.getAttribute("lang"),
    }
  })
}

function normaliseHref(href, base) {
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return null
  try {
    const url = new URL(href, base)
    return url.origin === new URL(base).origin ? url.pathname : null
  } catch {
    return null
  }
}

/** Cheap shingled-Jaccard similarity, enough to surface pages saying the same thing. */
function similarity(a, b) {
  const shingles = (text) => {
    const words = text.split(/\s+/).filter(Boolean)
    const set = new Set()
    for (let index = 0; index + 5 <= words.length; index += 1) set.add(words.slice(index, index + 5).join(" "))
    return set
  }
  const left = shingles(a)
  const right = shingles(b)
  if (left.size === 0 || right.size === 0) return 0
  let shared = 0
  for (const value of left) if (right.has(value)) shared += 1
  return shared / (left.size + right.size - shared)
}

async function main() {
  const browser = await chromium.launch()
  // The site serves the experience chooser to ordinary browsers and the full homepage to
  // recognised crawlers (see lib/experience-routing.ts). An SEO audit must see the latter.
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    colorScheme: "dark",
    userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html) ScaleSmithsSeoAudit",
  })
  const page = await context.newPage()

  const findingsPreamble = []
  const consoleErrors = new Map()
  page.on("console", (message) => {
    if (message.type() !== "error") return
    const path = new URL(page.url()).pathname
    consoleErrors.set(path, [...(consoleErrors.get(path) ?? []), message.text().slice(0, 200)])
  })
  page.on("pageerror", (error) => {
    const path = new URL(page.url()).pathname
    consoleErrors.set(path, [...(consoleErrors.get(path) ?? []), error.message.slice(0, 200)])
  })

  const { paths: sitemapPaths, origin: configuredOrigin } = await fetchSitemap()
  // Canonicals, sitemap and OG URLs all derive from NEXT_PUBLIC_SITE_URL, so the sitemap's own
  // origin is what this deployment considers canonical. Comparing against it catches a genuine
  // inconsistency; comparing against the production host would just flag every local run.
  if (configuredOrigin !== PRODUCTION_ORIGIN) {
    findingsPreamble.push({ severity: "warning", code: "non-production-origin", path: "/sitemap.xml", detail: `NEXT_PUBLIC_SITE_URL resolves to ${configuredOrigin}; production must serve ${PRODUCTION_ORIGIN}` })
  }
  const queue = ["/", ...sitemapPaths]
  const seen = new Set()
  const pages = []
  const findings = [...findingsPreamble]
  const externalLinks = new Map()
  const linkedFrom = new Map()

  const add = (severity, code, path, detail) => findings.push({ severity, code, path, detail })

  while (queue.length > 0) {
    const path = queue.shift()
    if (seen.has(path) || isSkipped(path)) continue
    seen.add(path)

    let response
    try {
      response = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 120_000 })
      await page.waitForFunction(() => document.documentElement.dataset.scalesmithsHydrated === "true", undefined, { timeout: 120_000 })
    } catch (error) {
      add("error", "render-failed", path, String(error).split("\n")[0])
      pages.push({ path, status: response?.status() ?? 0, renderFailed: true })
      continue
    }

    const status = response?.status() ?? 0
    const finalPath = new URL(page.url()).pathname
    const data = await readPage(page)

    const record = {
      path,
      status,
      redirectedTo: finalPath === path ? null : finalPath,
      ...data,
      anchors: undefined,
      images: undefined,
      internalLinks: [],
      externalLinks: [],
      imageCount: data.images.length,
      imagesMissingAlt: data.images.filter((image) => image.alt === null).length,
      imagesWithoutDimensions: data.images.filter((image) => !image.hasDimensions && image.nextImageMode !== "fill").length,
      consoleErrors: [],
    }

    for (const anchor of data.anchors) {
      const internal = normaliseHref(anchor.href, BASE)
      if (internal) {
        record.internalLinks.push(internal)
        linkedFrom.set(internal, [...(linkedFrom.get(internal) ?? []), path])
        if (!seen.has(internal) && !isSkipped(internal)) queue.push(internal)
      } else if (/^https?:\/\//.test(anchor.href)) {
        record.externalLinks.push(anchor.href)
        externalLinks.set(anchor.href, [...(externalLinks.get(anchor.href) ?? []), path])
        if (anchor.target === "_blank" && !(anchor.rel ?? "").includes("noopener")) {
          add("warning", "external-link-missing-noopener", path, anchor.href)
        }
      }
    }

    // ---- per-page checks -------------------------------------------------
    const indexable = !(record.robots ?? "").includes("noindex")
    record.indexable = indexable

    if (status >= 400) add("error", "bad-status", path, `HTTP ${status}`)
    if (record.redirectedTo) add("warning", "redirected", path, `→ ${record.redirectedTo}`)
    if (!record.title?.trim()) add("error", "missing-title", path, "empty <title>")
    else if (record.title.length > 65) add("warning", "long-title", path, `${record.title.length} chars`)
    if (!record.description?.trim()) add("error", "missing-description", path, "no meta description")
    else if (record.description.length > 165) add("warning", "long-description", path, `${record.description.length} chars`)
    else if (record.description.length < 70) add("warning", "short-description", path, `${record.description.length} chars`)

    if (indexable) {
      if (!record.canonical) add("error", "missing-canonical", path, "indexable page without canonical")
      else {
        const canonicalPath = new URL(record.canonical, BASE).pathname
        if (canonicalPath !== path) add("error", "canonical-mismatch", path, `canonical → ${canonicalPath}`)
        const canonicalOrigin = new URL(record.canonical, BASE).origin
        if (canonicalOrigin !== configuredOrigin) {
          add("error", "canonical-host", path, `${canonicalOrigin} (sitemap uses ${configuredOrigin})`)
        }
      }
    }

    if (record.h1s.length !== 1) add("error", "h1-count", path, `${record.h1s.length} h1 elements`)
    for (let index = 1; index < record.headings.length; index += 1) {
      const jump = record.headings[index].level - record.headings[index - 1].level
      if (jump > 1) {
        add("warning", "heading-skip", path, `h${record.headings[index - 1].level} → h${record.headings[index].level} ("${record.headings[index].text}")`)
        break
      }
    }

    if (record.duplicateIds.length > 0) add("error", "duplicate-ids", path, record.duplicateIds.join(", "))
    if (record.schema.length === 0) add("warning", "no-schema", path, "no JSON-LD on page")
    if (record.schema.includes("INVALID_JSON")) add("error", "invalid-schema", path, "unparseable JSON-LD")
    // Only indexable pages need a trail; a noindex form step is not a search entry point.
    if (path !== "/" && indexable && !record.breadcrumb && !record.schema.includes("BreadcrumbList")) {
      add("warning", "no-breadcrumb", path, "indexable page without a breadcrumb trail")
    }
    if (!record.ogTitle || !record.ogDescription || !record.ogImage) {
      add("warning", "incomplete-og", path, `og:title=${Boolean(record.ogTitle)} og:description=${Boolean(record.ogDescription)} og:image=${Boolean(record.ogImage)}`)
    }
    if (record.lang !== "en" && record.lang !== "en-GB") add("warning", "lang", path, `lang="${record.lang}"`)

    for (const image of data.images) {
      if (image.alt === null) add("error", "image-missing-alt", path, image.src)
      else if (image.alt.length > 125) add("warning", "image-alt-long", path, `${image.alt.slice(0, 60)}…`)
      // `fill` images take their box from a sized parent, so no intrinsic attributes are expected.
      if (!image.hasDimensions && !image.decorative && image.nextImageMode !== "fill") {
        add("warning", "image-no-dimensions", path, image.src)
      }
    }

    if (indexable && record.wordCount < 250) {
      const severity = isExpectedShort(path) ? "info" : "warning"
      add(severity, "thin-content", path, `${record.wordCount} words in <main>${severity === "info" ? " (expected for this page type)" : ""}`)
    }

    pages.push(record)
  }

  // ---- cross-page checks -------------------------------------------------
  for (const record of pages) {
    record.consoleErrors = consoleErrors.get(record.path) ?? []
    for (const message of record.consoleErrors) add("error", "console-error", record.path, message)
  }

  const byPath = new Map(pages.map((record) => [record.path, record]))
  for (const record of pages) {
    for (const link of new Set(record.internalLinks)) {
      if (isSkipped(link)) continue
      const target = byPath.get(link)
      if (!target) continue
      if (target.status >= 400) add("error", "broken-internal-link", record.path, `→ ${link} (HTTP ${target.status})`)
      if (target.redirectedTo) add("warning", "internal-link-via-redirect", record.path, `→ ${link} → ${target.redirectedTo}`)
      if (!target.indexable) add("warning", "internal-link-to-noindex", record.path, `→ ${link}`)
    }
  }

  const orphans = sitemapPaths.filter((path) => path !== "/" && !isSkipped(path) && !(linkedFrom.get(path)?.length > 0))
  for (const path of orphans) add("error", "orphan", path, "in sitemap, linked from nowhere")

  const missingFromSitemap = pages
    .filter((record) => record.indexable && record.status === 200 && !sitemapPaths.includes(record.path))
    .map((record) => record.path)
  for (const path of missingFromSitemap) add("warning", "not-in-sitemap", path, "indexable but absent from sitemap.xml")

  // Duplicate / cannibalisation candidates.
  const duplicates = []
  const indexablePages = pages.filter((record) => record.indexable && record.fingerprint)
  for (let i = 0; i < indexablePages.length; i += 1) {
    for (let j = i + 1; j < indexablePages.length; j += 1) {
      const score = similarity(indexablePages[i].fingerprint, indexablePages[j].fingerprint)
      if (score >= 0.2) {
        duplicates.push({ a: indexablePages[i].path, b: indexablePages[j].path, similarity: Number(score.toFixed(3)) })
        add(score >= 0.4 ? "error" : "warning", "content-overlap", indexablePages[i].path, `${Math.round(score * 100)}% shingle overlap with ${indexablePages[j].path}`)
      }
    }
  }
  duplicates.sort((a, b) => b.similarity - a.similarity)

  // Titles and descriptions must be unique across indexable pages.
  for (const field of ["title", "description"]) {
    const groups = new Map()
    for (const record of indexablePages) {
      const value = (record[field] ?? "").trim()
      if (!value) continue
      groups.set(value, [...(groups.get(value) ?? []), record.path])
    }
    for (const [value, paths] of groups) {
      if (paths.length > 1) add("error", `duplicate-${field}`, paths[0], `"${value.slice(0, 60)}…" also on ${paths.slice(1).join(", ")}`)
    }
  }

  // External links: one HEAD each, failures reported but never fatal.
  const externalResults = []
  for (const [href, sources] of externalLinks) {
    let status = 0
    try {
      const response = await fetch(href, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(15_000) })
      status = response.status
    } catch {
      status = 0
    }
    externalResults.push({ href, status, sources: [...new Set(sources)] })
    if (status === 0) add("warning", "external-link-unreachable", sources[0], href)
    else if (status >= 400) add("error", "external-link-broken", sources[0], `${href} → HTTP ${status}`)
  }

  await browser.close()

  const bySeverity = (severity) => findings.filter((finding) => finding.severity === severity)
  const counts = { error: bySeverity("error").length, warning: bySeverity("warning").length, info: bySeverity("info").length }
  const byCode = {}
  for (const finding of findings) byCode[finding.code] = (byCode[finding.code] ?? 0) + 1

  const report = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    productionOrigin: PRODUCTION_ORIGIN,
    summary: {
      pagesCrawled: pages.length,
      indexablePages: pages.filter((record) => record.indexable).length,
      sitemapUrls: sitemapPaths.length,
      orphans: orphans.length,
      findings: counts,
      byCode,
    },
    pages: pages.map((record) => ({ ...record, fingerprint: undefined, anchors: undefined, images: undefined })),
    duplicates: duplicates.slice(0, 40),
    externalLinks: externalResults,
    findings,
  }

  await mkdir(OUT_DIR, { recursive: true })
  await writeFile(join(OUT_DIR, "seo-audit.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8")
  await writeFile(join(OUT_DIR, "SEO_FINAL_AUDIT.md"), renderMarkdown(report), "utf8")

  console.log(`Crawled ${pages.length} pages · ${counts.error} errors · ${counts.warning} warnings`)
  for (const [code, count] of Object.entries(byCode).sort((a, b) => b[1] - a[1])) console.log(`  ${String(count).padStart(4)}  ${code}`)
  process.exitCode = counts.error > 0 ? 1 : 0
}

function renderMarkdown(report) {
  const { summary } = report
  const errors = report.findings.filter((finding) => finding.severity === "error")
  const warnings = report.findings.filter((finding) => finding.severity === "warning")

  const group = (findings) => {
    const map = new Map()
    for (const finding of findings) map.set(finding.code, [...(map.get(finding.code) ?? []), finding])
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length)
  }

  const section = (title, findings) => {
    if (findings.length === 0) return `### ${title}\n\nNone.\n`
    return [
      `### ${title}`,
      "",
      ...group(findings).flatMap(([code, entries]) => [
        `**${code}** — ${entries.length}`,
        "",
        ...entries.slice(0, 15).map((entry) => `- \`${entry.path}\` — ${entry.detail}`),
        entries.length > 15 ? `- …and ${entries.length - 15} more (see \`seo-audit.json\`)` : "",
        "",
      ]),
    ].filter(Boolean).join("\n")
  }

  return `# ScaleSmiths final SEO audit

Generated ${report.generatedAt} against \`${report.base}\`.
Regenerate with \`node scripts/seo-audit.mjs --base <url>\` while a server is running.

This file is produced by \`web/scripts/seo-audit.mjs\`. Do not edit it by hand — fix the site and
re-run the audit instead. The machine-readable record of the same crawl is \`docs/seo-audit.json\`.

## Summary

| Metric | Value |
| --- | --- |
| Pages crawled | ${summary.pagesCrawled} |
| Indexable pages | ${summary.indexablePages} |
| URLs in sitemap.xml | ${summary.sitemapUrls} |
| Orphan pages | ${summary.orphans} |
| Errors | ${summary.findings.error} |
| Warnings | ${summary.findings.warning} |

## What each severity means

- **error** — a search engine or a visitor is materially affected. These should be zero.
- **warning** — worth a decision. Some are accepted deliberately; the notes below say which.

## Errors

${section("Errors", errors)}

## Warnings

${section("Warnings", warnings)}

## Accepted (informational)

Recorded, not defects. Legal documents, forms, directories and contact pages are short because of
what they are; the note keeps them visible without training anyone to ignore the report.

${section("Informational", report.findings.filter((finding) => finding.severity === "info"))}

## Closest content pairs

Shingle overlap between indexable pages. Anything above roughly 40% is worth rewriting; lower
figures are usually shared navigation, footer and CTA copy rather than duplicated substance.

${report.duplicates.length === 0
  ? "No page pair exceeded the 20% reporting threshold."
  : ["| A | B | Overlap |", "| --- | --- | --- |", ...report.duplicates.slice(0, 20).map((pair) => `| \`${pair.a}\` | \`${pair.b}\` | ${Math.round(pair.similarity * 100)}% |`)].join("\n")}

## External links

${report.externalLinks.length === 0
  ? "No outbound links found."
  : ["| URL | Status |", "| --- | --- |", ...report.externalLinks.map((link) => `| ${link.href} | ${link.status === 0 ? "unreachable" : link.status} |`)].join("\n")}
`
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
