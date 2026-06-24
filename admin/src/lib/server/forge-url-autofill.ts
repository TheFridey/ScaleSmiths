import "server-only"
import { lookup } from "node:dns/promises"
import { isIP } from "node:net"
import { runForgeAiJson } from "@/lib/server/forge-ai"
import { FORGE_INTAKE_SECTIONS, emptyForgeIntakeData, type ForgeIntakeData } from "@/lib/forge"
import type { ForgeJsonSchema, JsonValue } from "@/lib/forge-ai"

const MAX_PAGES = 4
const MAX_PAGE_CHARS = 18000
const REQUEST_TIMEOUT_MS = 12000

export interface ForgeUrlAutofillResult extends Record<string, JsonValue> {
  project: {
    name: string
    businessName: string
    industry: string
    targetAudience: string
    primaryGoal: string
    brandNotes: string
  }
  intake: ForgeIntakeData
  confidenceNotes: string[]
  sourcePages: string[]
}

interface CrawledPage {
  url: string
  title: string
  description: string
  headings: string[]
  text: string
  links: Array<{ href: string; label: string }>
}

const INTAKE_FIELD_KEYS = FORGE_INTAKE_SECTIONS.flatMap((section) => section.fields.map((field) => field.key))

const FORGE_URL_AUTOFILL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["project", "intake", "confidenceNotes", "sourcePages"],
  properties: {
    project: {
      type: "object",
      additionalProperties: false,
      required: ["name", "businessName", "industry", "targetAudience", "primaryGoal", "brandNotes"],
      properties: {
        name: { type: "string" },
        businessName: { type: "string" },
        industry: { type: "string" },
        targetAudience: { type: "string" },
        primaryGoal: { type: "string" },
        brandNotes: { type: "string" },
      },
    },
    intake: {
      type: "object",
      additionalProperties: false,
      required: INTAKE_FIELD_KEYS,
      properties: Object.fromEntries(INTAKE_FIELD_KEYS.map((key) => [key, { type: "string" }])),
    },
    confidenceNotes: { type: "array", items: { type: "string" } },
    sourcePages: { type: "array", items: { type: "string" } },
  },
} as const satisfies ForgeJsonSchema

export async function generateForgeUrlAutofill(url: string): Promise<ForgeUrlAutofillResult> {
  const rootUrl = normalizePublicWebsiteUrl(url)
  const pages = await crawlWebsite(rootUrl)

  if (pages.length === 0) {
    throw new Error("No readable public pages were found at that URL.")
  }

  const mockData = createHeuristicAutofill(rootUrl, pages)
  const result = await runForgeAiJson<ForgeUrlAutofillResult>({
    taskType: "planning",
    schemaName: "forge_url_autofill",
    schema: FORGE_URL_AUTOFILL_SCHEMA,
    systemPrompt: [
      "You are ScaleSmiths Forge URL Autofill.",
      "Use only the crawled website text supplied by the server.",
      "Return concise field values for a website rebuild or improvement brief.",
      "If a field is not supported by the crawled text, return an empty string for that field.",
      "Do not invent budgets, deadlines, testimonials, credentials, certifications, or case studies.",
      "Project name should be a short internal project label, usually business name plus website rebuild.",
    ].join(" "),
    prompt: buildAutofillPrompt(rootUrl, pages),
    maxTokens: 2200,
    timeoutMs: 90_000,
    maxRetries: 1,
    fallbackOnSchemaMismatch: true,
    mockData,
  })

  return normalizeAutofillResult(result.data, pages)
}

async function crawlWebsite(rootUrl: URL) {
  const root = await fetchCrawlPage(rootUrl)
  if (!root) return []

  const candidates = chooseUsefulLinks(root)
  const pages = [root]

  for (const url of candidates) {
    if (pages.length >= MAX_PAGES) break
    const page = await fetchCrawlPage(url)
    if (page) pages.push(page)
  }

  return pages
}

async function fetchCrawlPage(url: URL): Promise<CrawledPage | null> {
  await assertPublicUrl(url)

  const response = await fetchWithRedirects(url)
  const contentType = response.headers.get("content-type") ?? ""
  if (!response.ok || (!contentType.includes("text/html") && !contentType.includes("text/plain"))) return null

  const html = (await response.text()).slice(0, 450000)
  const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i)
  const description = firstMatch(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || firstMatch(html, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i)
  const headings = Array.from(html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi))
    .map((match) => cleanText(match[1]))
    .filter(Boolean)
    .slice(0, 24)
  const links = extractLinks(html, response.url)
  const text = cleanText(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " "),
  ).slice(0, MAX_PAGE_CHARS)

  return {
    url: response.url,
    title: cleanText(title),
    description: cleanText(description),
    headings,
    text,
    links,
  }
}

async function fetchWithRedirects(url: URL, remaining = 3): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: {
        "Accept": "text/html,text/plain;q=0.9,*/*;q=0.4",
        "User-Agent": "ScaleSmiths Forge URL Autofill",
      },
      redirect: "manual",
      signal: controller.signal,
    })

    if ([301, 302, 303, 307, 308].includes(response.status) && remaining > 0) {
      const location = response.headers.get("location")
      if (!location) return response
      const next = new URL(location, url)
      await assertPublicUrl(next)
      return fetchWithRedirects(next, remaining - 1)
    }

    return response
  } finally {
    clearTimeout(timeout)
  }
}

function normalizePublicWebsiteUrl(value: string) {
  const trimmed = value.trim()
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  const url = new URL(withProtocol)
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Website URL must use http or https.")
  }
  return url
}

async function assertPublicUrl(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Website URL must use http or https.")
  if (!url.hostname || url.username || url.password) throw new Error("Website URL is not valid for crawling.")
  if (["localhost", "127.0.0.1", "::1"].includes(url.hostname.toLowerCase())) throw new Error("Local URLs cannot be crawled.")

  const directIp = isIP(url.hostname)
  if (directIp && isPrivateIp(url.hostname)) throw new Error("Private network URLs cannot be crawled.")

  if (!directIp) {
    const records = await lookup(url.hostname, { all: true, verbatim: true })
    if (records.length === 0 || records.some((record) => isPrivateIp(record.address))) {
      throw new Error("That URL resolves to a private or unavailable network address.")
    }
  }
}

function isPrivateIp(address: string) {
  if (address.startsWith("::ffff:")) return isPrivateIp(address.slice(7))
  const version = isIP(address)
  if (version === 4) {
    const parts = address.split(".").map((part) => Number.parseInt(part, 10))
    const [a, b] = parts
    return a === 0 || a === 10 || a === 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a === 100 && b >= 64 && b <= 127
  }
  if (version === 6) {
    const normalized = address.toLowerCase()
    return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:")
  }
  return false
}

function extractLinks(html: string, baseUrl: string) {
  return Array.from(html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi))
    .map((match) => {
      try {
        return { href: new URL(match[1], baseUrl).toString(), label: cleanText(match[2]) }
      } catch {
        return null
      }
    })
    .filter((link): link is { href: string; label: string } => Boolean(link))
    .filter((link) => {
      const url = new URL(link.href)
      const base = new URL(baseUrl)
      return url.origin === base.origin && !url.hash && !/\.(pdf|jpg|jpeg|png|gif|webp|svg|zip)$/i.test(url.pathname)
    })
    .slice(0, 80)
}

function chooseUsefulLinks(root: CrawledPage) {
  const seen = new Set<string>([root.url])
  const priority = /about|service|what-we-do|solutions|work|case|contact|pricing|quote|areas|locations/i
  const avoid = /privacy|terms|cookie|login|account|cart|checkout|tag|category|author/i

  return root.links
    .filter((link) => priority.test(`${link.href} ${link.label}`) && !avoid.test(link.href))
    .map((link) => new URL(link.href))
    .filter((url) => {
      const key = url.toString()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, MAX_PAGES - 1)
}

function buildAutofillPrompt(rootUrl: URL, pages: CrawledPage[]) {
  return [
    `Website URL: ${rootUrl.toString()}`,
    "",
    "Crawled pages:",
    ...pages.flatMap((page, index) => [
      "",
      `## Page ${index + 1}: ${page.url}`,
      `Title: ${page.title || "Not found"}`,
      `Description: ${page.description || "Not found"}`,
      `Headings: ${page.headings.join(" | ") || "Not found"}`,
      "Text:",
      page.text,
    ]),
  ].join("\n")
}

function createHeuristicAutofill(rootUrl: URL, pages: CrawledPage[]): ForgeUrlAutofillResult {
  const home = pages[0]
  const text = pages.map((page) => `${page.title}\n${page.description}\n${page.headings.join("\n")}\n${page.text}`).join("\n").slice(0, 24000)
  const businessName = extractBusinessName(home, rootUrl)
  const industry = inferIndustry(text)
  const services = extractServiceHints(text)
  const goal = inferPrimaryGoal(text)
  const audience = inferAudience(text, industry)
  const intake = emptyForgeIntakeData()

  intake.businessOverview = home.description || `${businessName} presents its services through ${rootUrl.hostname}.`
  intake.coreServices = services
  intake.flagshipOffer = firstLine(services)
  intake.idealCustomers = audience
  intake.customerProblems = inferProblems(text)
  intake.primaryWebsiteGoal = goal
  intake.conversionActions = inferConversionActions(text)
  intake.requiredPages = pages.map((page) => page.title || new URL(page.url).pathname || "Page").join("\n")
  intake.existingAssets = "Existing website content and public brand assets from the supplied URL."
  intake.visualStyle = inferVisualStyle(text)
  intake.brandTone = inferBrandTone(text)

  return {
    project: {
      name: `${businessName} website rebuild`,
      businessName,
      industry,
      targetAudience: audience,
      primaryGoal: goal,
      brandNotes: [home.description, `Public site: ${rootUrl.toString()}`].filter(Boolean).join("\n"),
    },
    intake,
    confidenceNotes: ["Generated from crawled page titles, metadata, headings, and visible text."],
    sourcePages: pages.map((page) => page.url),
  }
}

function normalizeAutofillResult(result: ForgeUrlAutofillResult, pages: CrawledPage[]): ForgeUrlAutofillResult {
  return {
    project: {
      name: trimLimit(result.project.name, 160),
      businessName: trimLimit(result.project.businessName, 160),
      industry: trimLimit(result.project.industry, 120),
      targetAudience: trimLimit(result.project.targetAudience, 1000),
      primaryGoal: trimLimit(result.project.primaryGoal, 1000),
      brandNotes: trimLimit(result.project.brandNotes, 4000),
    },
    intake: Object.fromEntries(
      INTAKE_FIELD_KEYS.map((key) => [key, trimLimit(result.intake[key] ?? "", isMultilineIntakeField(key) ? 5000 : 500)]),
    ) as ForgeIntakeData,
    confidenceNotes: result.confidenceNotes.map((note) => trimLimit(note, 240)).filter(Boolean).slice(0, 6),
    sourcePages: (result.sourcePages.length ? result.sourcePages : pages.map((page) => page.url)).slice(0, MAX_PAGES),
  }
}

function isMultilineIntakeField(key: string) {
  return FORGE_INTAKE_SECTIONS.some((section) => section.fields.some((field) => field.key === key && "multiline" in field && field.multiline))
}

function extractBusinessName(page: CrawledPage, rootUrl: URL) {
  const title = page.title || page.headings[0] || rootUrl.hostname.replace(/^www\./, "")
  return cleanText(title.split(/\s[|:–-]\s/)[0]).slice(0, 80) || rootUrl.hostname.replace(/^www\./, "")
}

function inferIndustry(text: string) {
  const checks: Array<[RegExp, string]> = [
    [/dentist|orthodont|dental/i, "Dental healthcare"],
    [/solicitor|law firm|legal/i, "Legal services"],
    [/restaurant|menu|dining|cafe/i, "Hospitality"],
    [/builder|construction|renovation|roofing|plumbing|electrician/i, "Trade services"],
    [/accountant|bookkeeping|tax/i, "Accounting and finance"],
    [/fitness|gym|personal training/i, "Health and fitness"],
    [/web design|software|app development|technology/i, "Technology services"],
  ]
  return checks.find(([pattern]) => pattern.test(text))?.[1] ?? ""
}

function extractServiceHints(text: string) {
  const lines = text.split(/\n|\. /).map((line) => cleanText(line)).filter((line) => line.length > 24 && line.length < 180)
  const serviceLines = lines.filter((line) => /service|solutions|we offer|we provide|specialist|repair|design|install|support|consult/i.test(line))
  return serviceLines.slice(0, 5).join("\n")
}

function inferPrimaryGoal(text: string) {
  if (/book|appointment|schedule/i.test(text)) return "Increase bookings and enquiries from qualified website visitors."
  if (/quote|estimate/i.test(text)) return "Increase qualified quote requests from the website."
  if (/shop|buy|order/i.test(text)) return "Increase online sales and product enquiries."
  if (/contact|get in touch|call/i.test(text)) return "Increase direct enquiries through clear calls to action."
  return "Make the offer clear, build trust quickly, and convert more visitors into enquiries."
}

function inferAudience(text: string, industry: string) {
  if (/homeowner|landlord|property/i.test(text)) return "Homeowners, landlords, and property decision makers comparing local providers."
  if (/business|commercial|companies|teams/i.test(text)) return "Business owners and operational decision makers looking for a reliable provider."
  if (industry) return `People actively comparing ${industry.toLowerCase()} providers.`
  return "Prospective customers who need to understand the offer, trust the business, and take the next step."
}

function inferProblems(text: string) {
  if (/emergency|urgent|same day/i.test(text)) return "Visitors may need fast reassurance, availability, and a clear contact route."
  if (/bespoke|custom|tailored/i.test(text)) return "Visitors need to understand options, process, fit, and expected outcomes before enquiring."
  return "Visitors need clarity on services, proof of credibility, pricing or process expectations, and a low-friction next step."
}

function inferConversionActions(text: string) {
  const actions = []
  if (/quote|estimate/i.test(text)) actions.push("Request a quote")
  if (/book|appointment|schedule/i.test(text)) actions.push("Book a consultation")
  if (/call|phone/i.test(text)) actions.push("Call the business")
  if (/contact|get in touch/i.test(text)) actions.push("Send an enquiry")
  return (actions.length ? actions : ["Send an enquiry"]).join("\n")
}

function inferVisualStyle(text: string) {
  if (/luxury|premium|bespoke/i.test(text)) return "Premium, confident, polished, and proof-led."
  if (/friendly|family|local/i.test(text)) return "Approachable, local, warm, and trustworthy."
  return "Professional, clear, modern, and conversion-focused."
}

function inferBrandTone(text: string) {
  if (/expert|specialist|certified|accredited/i.test(text)) return "Expert, reassuring, and authoritative."
  if (/friendly|family|local/i.test(text)) return "Friendly, clear, and community-minded."
  return "Clear, confident, helpful, and commercially focused."
}

function firstLine(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? ""
}

function firstMatch(value: string, pattern: RegExp) {
  return value.match(pattern)?.[1] ?? ""
}

function cleanText(value: string) {
  return decodeEntities(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
}

function trimLimit(value: string, max: number) {
  return (value ?? "").trim().slice(0, max)
}
