import "server-only"
import {
  FORGE_SITE_INVENTORY_ARTIFACT_KIND,
  type ForgeSiteInventory,
  type ForgeSiteInventoryPage,
} from "@/lib/forge-site-inventory"
import { createSafeOutboundClient, SafeOutboundError } from "./safe-outbound"
import { isForbiddenAddress } from "./address-safety"

const USER_AGENT = "ScaleSmithsForgeMigrationCrawler/1.0"

// Back-compat re-export: the shared classifier is the single source of truth for
// which addresses a crawl may reach.
export const isBlockedAddress = isForbiddenAddress

export interface ForgeSiteCrawlerOptions {
  maxPages?: number
  maxDepth?: number
  allowedDomains?: string[]
  robotsPolicy?: "respect" | "ignore"
  timeoutMs?: number
  maxResponseBytes?: number
  maxRedirects?: number
}

interface CrawlerDependencies {
  fetch?: typeof fetch
  resolve?: (hostname: string) => Promise<string[]>
  now?: () => Date
}

export async function crawlForgeExistingSite(start: string, options: ForgeSiteCrawlerOptions = {}, dependencies: CrawlerDependencies = {}): Promise<ForgeSiteInventory> {
  const now = dependencies.now ?? (() => new Date())
  // Every request and redirect goes through the shared safe outbound client,
  // which resolves and pins the validated address, revalidates redirects,
  // preserves TLS, and enforces the size/timeout/redirect/port limits. The
  // crawler layers its own domain allowlist on top via assertHop.
  const request = createSafeOutboundClient({ fetchImpl: dependencies.fetch, resolve: dependencies.resolve })
  const startUrl = normalizeUrl(start)
  const allowedDomains = new Set((options.allowedDomains?.length ? options.allowedDomains : [startUrl.hostname]).map(normalizeDomain))
  if (!allowedDomains.has(normalizeDomain(startUrl.hostname))) throw new Error("The starting domain must be explicitly allowed.")
  const config = {
    maxPages: clamp(options.maxPages, 1, 100, 25), maxDepth: clamp(options.maxDepth, 0, 5, 2),
    robots: options.robotsPolicy ?? "respect" as const, timeoutMs: clamp(options.timeoutMs, 1000, 30_000, 10_000),
    maxResponseBytes: clamp(options.maxResponseBytes, 16_384, 2_000_000, 500_000), maxRedirects: clamp(options.maxRedirects, 0, 8, 4),
  }
  const assertHop = (url: URL) => {
    if (!allowedDomains.has(normalizeDomain(url.hostname))) throw new Error("URL is outside the approved domains.")
  }
  const fetchPage = (url: URL) =>
    request(url, {
      headers: { Accept: "text/html,text/plain;q=0.8", "User-Agent": USER_AGENT },
      timeoutMs: config.timeoutMs,
      maxResponseBytes: config.maxResponseBytes,
      maxRedirects: config.maxRedirects,
      assertHop,
    })
  const startedAt = now().toISOString()
  const robotsUrl = new URL("/robots.txt", startUrl.origin)
  let robotsStatus: number | null = null
  let robots = ""
  const failures: ForgeSiteInventory["failures"] = []
  if (config.robots === "respect") {
    try {
      const result = await fetchPage(robotsUrl)
      robotsStatus = result.status
      if (result.status >= 200 && result.status < 300) robots = result.body
    } catch (error) {
      failures.push(failure(robotsUrl.toString(), 0, "robots_fetch", error, now()))
    }
  }
  const queue: Array<{ url: URL; depth: number }> = [{ url: startUrl, depth: 0 }]
  const seen = new Set<string>()
  const discovered = new Set<string>([canonicalKey(startUrl)])
  const pages: ForgeSiteInventoryPage[] = []
  while (queue.length && pages.length < config.maxPages) {
    const item = queue.shift()!
    const key = canonicalKey(item.url)
    if (seen.has(key)) continue
    seen.add(key)
    if (config.robots === "respect" && isRobotsDisallowed(item.url, robots)) {
      failures.push({ url: item.url.toString(), depth: item.depth, category: "robots_disallowed", message: "Blocked by the configured robots policy.", occurredAt: now().toISOString() })
      continue
    }
    try {
      const fetched = await fetchPage(item.url)
      const contentType = fetched.headers.get("content-type") ?? ""
      if (!contentType.toLowerCase().includes("text/html")) throw new Error("Response is not HTML.")
      const page = extractPage(item.url, new URL(fetched.url), item.depth, fetched.status, contentType, fetched.body, fetched.redirects, now())
      pages.push(page)
      for (const href of page.internalLinks) {
        const url = new URL(href)
        const linkKey = canonicalKey(url)
        discovered.add(linkKey)
        if (item.depth < config.maxDepth && !seen.has(linkKey) && allowedDomains.has(normalizeDomain(url.hostname))) queue.push({ url, depth: item.depth + 1 })
      }
    } catch (error) {
      failures.push(failure(item.url.toString(), item.depth, classifyFailure(error), error, now()))
    }
  }
  const completedAt = now().toISOString()
  return {
    kind: FORGE_SITE_INVENTORY_ARTIFACT_KIND, startedAt, completedAt, startUrl: startUrl.toString(), allowedDomains: [...allowedDomains],
    policy: { maxPages: config.maxPages, maxDepth: config.maxDepth, robots: config.robots, scriptsExecuted: false },
    pages, discoveredUrls: [...discovered], failures,
    evidence: { robotsUrl: robotsUrl.toString(), robotsStatus, robotsApplied: config.robots === "respect", userAgent: USER_AGENT },
    summary: { pagesFetched: pages.length, urlsDiscovered: discovered.size, failures: failures.length, redirects: pages.reduce((sum, page) => sum + page.redirects.length, 0), images: pages.reduce((sum, page) => sum + page.images.length, 0), forms: pages.reduce((sum, page) => sum + page.forms.length, 0) },
  }
}

function extractPage(requestedUrl: URL, finalUrl: URL, depth: number, status: number, responseContentType: string, html: string, redirects: ForgeSiteInventoryPage["redirects"], now: Date): ForgeSiteInventoryPage {
  const sanitized = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<!--([\s\S]*?)-->/g, " ")
  const links = matches(sanitized, /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi).flatMap((href) => safeAbsolute(href, finalUrl)).filter((url) => normalizeDomain(url.hostname) === normalizeDomain(finalUrl.hostname)).map(canonicalKey)
  const structuredData = matches(html, /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi).slice(0, 20).flatMap((value) => { try { return [JSON.parse(value) as unknown] } catch { return [] } })
  const main = first(sanitized, /<main\b[^>]*>([\s\S]*?)<\/main>/i) || first(sanitized, /<body\b[^>]*>([\s\S]*?)<\/body>/i) || sanitized
  return {
    requestedUrl: requestedUrl.toString(), finalUrl: finalUrl.toString(), depth, status, redirects,
    title: text(first(sanitized, /<title[^>]*>([\s\S]*?)<\/title>/i)).slice(0, 300),
    metaDescription: text(metaContent(sanitized, "description")).slice(0, 1000),
    canonicalUrl: safeAbsolute(first(sanitized, /<link\b(?=[^>]*rel=["']canonical["'])[^>]*href=["']([^"']+)["'][^>]*>/i), finalUrl)[0]?.toString() ?? null,
    headings: [...sanitized.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].slice(0, 100).map((match) => ({ level: Number(match[1]), text: text(match[2]).slice(0, 500) })).filter((item) => item.text),
    mainContent: text(main).slice(0, 100_000),
    images: [...sanitized.matchAll(/<img\b[^>]*>/gi)].slice(0, 250).flatMap((match) => { const src = attr(match[0], "src"); const resolved = safeAbsolute(src, finalUrl)[0]; return resolved ? [{ src: resolved.toString(), alt: text(attr(match[0], "alt")).slice(0, 500) }] : [] }),
    internalLinks: [...new Set(links)].slice(0, 1000),
    forms: [...sanitized.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/gi)].slice(0, 50).map((match) => ({ action: safeAbsolute(attr(match[0], "action"), finalUrl)[0]?.toString() ?? null, method: (attr(match[0], "method") || "get").toLowerCase(), fields: [...match[1].matchAll(/<(?:input|select|textarea)\b[^>]*>/gi)].map((field) => attr(field[0], "name") || attr(field[0], "type")).filter(Boolean).slice(0, 100) })),
    contactDetails: { emails: unique(matches(sanitized, /mailto:([^"'?#\s>]+)/gi).map(decodeURIComponent)), phones: unique(matches(sanitized, /tel:([^"'?#\s>]+)/gi).map(decodeURIComponent)), addresses: unique(matches(sanitized, /<address\b[^>]*>([\s\S]*?)<\/address>/gi).map(text)) },
    structuredData, contentType: responseContentType, contentBytes: new TextEncoder().encode(html).byteLength, fetchedAt: now.toISOString(),
  }
}

function isRobotsDisallowed(url: URL, robots: string) {
  let applies = false
  const disallowed: string[] = []
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim()
    const [name, ...rest] = line.split(":")
    const value = rest.join(":").trim()
    if (name?.trim().toLowerCase() === "user-agent") applies = value === "*" || value.toLowerCase().includes("scalesmithsforge")
    if (applies && name?.trim().toLowerCase() === "disallow" && value) disallowed.push(value)
  }
  return disallowed.some((path) => url.pathname.startsWith(path))
}
function normalizeUrl(value: string) { const url = new URL(/^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`); url.hash = ""; return url }
function normalizeDomain(value: string) { return value.trim().toLowerCase().replace(/\.$/, "") }
function canonicalKey(url: URL) { const copy = new URL(url); copy.hash = ""; copy.hostname = normalizeDomain(copy.hostname); if (copy.pathname !== "/") copy.pathname = copy.pathname.replace(/\/$/, ""); return copy.toString() }
function clamp(value: number | undefined, min: number, max: number, fallback: number) { return Math.max(min, Math.min(max, Number.isFinite(value) ? Number(value) : fallback)) }
function safeAbsolute(value: string, base: URL): URL[] { if (!value) return []; try { const url = new URL(value, base); return [url] } catch { return [] } }
function first(value: string, pattern: RegExp) { return value.match(pattern)?.[1] ?? "" }
function matches(value: string, pattern: RegExp) { return [...value.matchAll(pattern)].map((match) => match[1] ?? "") }
function attr(tag: string, name: string) { return tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1] ?? "" }
function metaContent(html: string, name: string) { const tags = html.match(/<meta\b[^>]*>/gi) ?? []; return tags.find((tag) => attr(tag, "name").toLowerCase() === name)?.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1] ?? "" }
function text(value: string) { return value.replace(/<[^>]+>/g, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, "\"").replace(/&#39;/gi, "'").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim() }
function unique(values: string[]) { return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, 100) }
function failure(url: string, depth: number, category: string, error: unknown, now: Date) {
  // The recorded message is always generic (SafeOutboundError messages never
  // include a resolved address), so the failure is visible to Forge without
  // leaking internal network detail. Security blocks also get a concise server
  // log keyed by host + stable code for operator visibility — never an IP.
  if (category === "security_block") {
    const code = error instanceof SafeOutboundError ? error.code : "policy"
    console.warn(`[forge-site-crawler] blocked ${safeHost(url)}: ${code}`)
  }
  return { url, depth, category, message: error instanceof Error ? error.message : "Crawl failed.", occurredAt: now.toISOString() }
}

function safeHost(url: string) {
  try {
    return new URL(url).host
  } catch {
    return "unknown-host"
  }
}
function classifyFailure(error: unknown) {
  if (error instanceof SafeOutboundError) {
    switch (error.code) {
      case "blocked_address":
      case "disallowed_scheme":
      case "credentials_in_url":
      case "disallowed_port":
        return "security_block"
      case "response_too_large":
        return "size_limit"
      case "redirect_limit":
      case "redirect_no_location":
        return "redirect"
      case "timeout":
        return "timeout"
      default:
        return "fetch_failure"
    }
  }
  const message = error instanceof Error ? error.message.toLowerCase() : ""
  if (message.includes("blocked") || message.includes("approved domain")) return "security_block"
  if (message.includes("size limit")) return "size_limit"
  if (message.includes("redirect")) return "redirect"
  if (message.includes("abort") || message.includes("timeout")) return "timeout"
  return "fetch_failure"
}
