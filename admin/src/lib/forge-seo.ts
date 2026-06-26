import type { JsonValue } from "./forge-ai"

export const FORGE_SEO_ARTIFACT_TITLE = "SEO/AEO/GEO Pack"
export const FORGE_SEO_ARTIFACT_KIND = "forge_seo_pack"

// Length budgets used when generating and checking metadata.
export const FORGE_SEO_TITLE_MIN = 15
export const FORGE_SEO_TITLE_MAX = 60
export const FORGE_SEO_META_MIN = 70
export const FORGE_SEO_META_MAX = 160

// Minimum overall score the QA gate expects before a generated site is considered SEO-ready.
export const FORGE_SEO_MIN_PASS_SCORE = 70

// Keyword stuffing guardrails. AEO/GEO answer engines penalise repetitive, low-entropy copy,
// so the engine actively warns instead of optimising for raw keyword frequency.
export const FORGE_KEYWORD_STUFFING_MAX_DENSITY = 0.045
export const FORGE_KEYWORD_STUFFING_MAX_REPEATS = 4
export const FORGE_KEYWORD_STUFFING_WARNING =
  "Avoid keyword stuffing: write for humans and answer engines, not repetition. Use entity-rich, self-contained language and natural variants instead of repeating the exact keyword. Google and AI answer engines demote pages with unnatural keyword density."

export type ForgeSeoPageTemplate = "home" | "service" | "about" | "contact" | "local"
export type ForgeSeoCategory = "seo" | "aeo" | "geo"
export type ForgeSeoCheckStatus = "pass" | "warn" | "fail"

export interface ForgeSeoFaq {
  question: string
  answer: string
}

export interface ForgeSeoBusiness {
  businessName: string
  industry: string | null
  siteUrl: string
  primaryLocation: string | null
  serviceAreas: string[]
  telephone: string | null
  email: string | null
  sameAs: string[]
}

export interface ForgeSeoPageInput {
  title: string
  path: string
  template: ForgeSeoPageTemplate
  keyword: string
  metaDescription: string
  h1: string
  heroSubheading: string
  bodyText: string
  faqItems: ForgeSeoFaq[]
  serviceName: string | null
  trustElements: string[]
  localSeoCopy: string
}

export interface ForgeSeoOpenGraph extends Record<string, JsonValue> {
  type: string
  title: string
  description: string
  url: string
  siteName: string
  locale: string
}

export interface ForgeSeoTwitter extends Record<string, JsonValue> {
  card: string
  title: string
  description: string
}

export interface ForgeSeoPageMetadata extends Record<string, JsonValue> {
  path: string
  template: ForgeSeoPageTemplate
  title: string
  metaDescription: string
  canonical: string
  keyword: string
  openGraph: ForgeSeoOpenGraph
  twitter: ForgeSeoTwitter
  jsonLdTypes: string[]
  jsonLd: JsonValue[]
}

export interface ForgeSeoChecklistItem extends Record<string, JsonValue> {
  id: string
  category: ForgeSeoCategory
  label: string
  status: ForgeSeoCheckStatus
  detail: string
  recommendation: string | null
}

export interface ForgeSeoScore extends Record<string, JsonValue> {
  seo: number
  aeo: number
  geo: number
  overall: number
}

export interface ForgeSeoPack extends Record<string, JsonValue> {
  kind: typeof FORGE_SEO_ARTIFACT_KIND
  business: ForgeSeoBusiness & Record<string, JsonValue>
  pages: ForgeSeoPageMetadata[]
  checklist: ForgeSeoChecklistItem[]
  score: ForgeSeoScore
  warnings: string[]
  sitemapXml: string
  robotsTxt: string
  generatedAt: string
}

export interface ForgeSeoArtifactState {
  pack: ForgeSeoPack | null
  status: "generated" | "empty"
  score: ForgeSeoScore | null
  generatedAt: string | null
}

/* ── URL + base helpers ─────────────────────────────────────────────── */

export function resolveForgeSeoSiteUrl(websiteUrl: string | null | undefined, slug: string): string {
  if (websiteUrl && isHttpUrl(websiteUrl)) {
    return websiteUrl.trim().replace(/\/+$/, "")
  }
  const safeSlug = slugify(slug) || "site"
  return `https://${safeSlug}.example.com`
}

export function buildForgeCanonicalUrl(siteUrl: string, path: string): string {
  const base = siteUrl.replace(/\/+$/, "")
  const normalized = normalizePath(path)
  return normalized === "/" ? `${base}/` : `${base}${normalized}`
}

/* ── Metadata generation ────────────────────────────────────────────── */

export function buildForgePageTitle(page: ForgeSeoPageInput, business: ForgeSeoBusiness): string {
  const business_name = business.businessName.trim()
  const raw = page.title?.trim() || page.h1?.trim() || business_name
  if (page.template === "home") {
    const suffix = business.industry ? ` | ${truncateWords(business.industry, 40)}` : ""
    return clampTitle(`${business_name}${suffix}`, business_name)
  }
  const withBusiness = raw.toLowerCase().includes(business_name.toLowerCase())
    ? raw
    : `${raw} | ${business_name}`
  return clampTitle(withBusiness, business_name)
}

export function buildForgeMetaDescription(page: ForgeSeoPageInput, business: ForgeSeoBusiness): string {
  const provided = page.metaDescription?.trim()
  if (provided && provided.length >= FORGE_SEO_META_MIN && provided.length <= FORGE_SEO_META_MAX) {
    return provided
  }

  const location = business.primaryLocation?.trim()
  const base = provided || page.heroSubheading?.trim() || page.localSeoCopy?.trim() || `${business.businessName} ${page.title}`.trim()
  const locationClause = location && !base.toLowerCase().includes(location.toLowerCase()) ? ` Serving ${location}.` : ""
  let description = `${base}${locationClause}`.replace(/\s+/g, " ").trim()

  if (description.length < FORGE_SEO_META_MIN) {
    const filler = ` Contact ${business.businessName} for clear, practical help and a fast response.`
    description = `${description}${filler}`.replace(/\s+/g, " ").trim()
  }
  return description.length > FORGE_SEO_META_MAX ? `${description.slice(0, FORGE_SEO_META_MAX - 1).trimEnd()}…` : description
}

export function buildForgeOpenGraph(page: ForgeSeoPageInput, business: ForgeSeoBusiness, canonical: string): ForgeSeoOpenGraph {
  return {
    type: page.template === "home" ? "website" : "article",
    title: buildForgePageTitle(page, business),
    description: buildForgeMetaDescription(page, business),
    url: canonical,
    siteName: business.businessName,
    locale: "en_GB",
  }
}

export function buildForgeTwitter(page: ForgeSeoPageInput, business: ForgeSeoBusiness): ForgeSeoTwitter {
  return {
    card: "summary_large_image",
    title: buildForgePageTitle(page, business),
    description: buildForgeMetaDescription(page, business),
  }
}

/* ── JSON-LD schema builders ────────────────────────────────────────── */

export function buildForgeLocalBusinessSchema(business: ForgeSeoBusiness): JsonValue {
  const schema: Record<string, JsonValue> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: business.businessName,
    url: business.siteUrl,
  }
  if (business.industry) schema.description = `${business.businessName} — ${business.industry}.`
  if (business.telephone) schema.telephone = business.telephone
  if (business.email) schema.email = business.email
  if (business.primaryLocation) {
    schema.address = { "@type": "PostalAddress", addressLocality: business.primaryLocation }
  }
  if (business.serviceAreas.length) {
    schema.areaServed = business.serviceAreas.map((area) => ({ "@type": "Place", name: area }))
  }
  if (business.sameAs.length) schema.sameAs = business.sameAs
  return schema
}

export function buildForgeServiceSchema(page: ForgeSeoPageInput, business: ForgeSeoBusiness): JsonValue {
  const schema: Record<string, JsonValue> = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: page.serviceName || page.title,
    description: buildForgeMetaDescription(page, business),
    serviceType: page.serviceName || page.title,
    provider: {
      "@type": "LocalBusiness",
      name: business.businessName,
      url: business.siteUrl,
    },
    url: buildForgeCanonicalUrl(business.siteUrl, page.path),
  }
  if (business.serviceAreas.length) {
    schema.areaServed = business.serviceAreas.map((area) => ({ "@type": "Place", name: area }))
  } else if (business.primaryLocation) {
    schema.areaServed = { "@type": "Place", name: business.primaryLocation }
  }
  return schema
}

export function buildForgeFaqSchema(faqItems: ForgeSeoFaq[]): JsonValue | null {
  const items = faqItems.filter((item) => item.question.trim() && item.answer.trim())
  if (!items.length) return null
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question.trim(),
      acceptedAnswer: { "@type": "Answer", text: item.answer.trim() },
    })),
  }
}

export function buildForgeBreadcrumbSchema(page: ForgeSeoPageInput, business: ForgeSeoBusiness): JsonValue {
  const segments = normalizePath(page.path).split("/").filter(Boolean)
  const crumbs: { name: string; url: string }[] = [{ name: "Home", url: buildForgeCanonicalUrl(business.siteUrl, "/") }]
  let acc = ""
  for (const segment of segments) {
    acc += `/${segment}`
    crumbs.push({ name: titleizeSegment(segment), url: buildForgeCanonicalUrl(business.siteUrl, acc) })
  }
  if (segments.length) {
    crumbs[crumbs.length - 1].name = page.title || crumbs[crumbs.length - 1].name
  }
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  }
}

export function buildForgeWebPageSchema(page: ForgeSeoPageInput, business: ForgeSeoBusiness): JsonValue {
  return {
    "@context": "https://schema.org",
    "@type": page.template === "contact" ? "ContactPage" : page.template === "about" ? "AboutPage" : "WebPage",
    name: buildForgePageTitle(page, business),
    description: buildForgeMetaDescription(page, business),
    url: buildForgeCanonicalUrl(business.siteUrl, page.path),
    isPartOf: { "@type": "WebSite", name: business.businessName, url: business.siteUrl },
  }
}

export function buildForgePageJsonLd(page: ForgeSeoPageInput, business: ForgeSeoBusiness): JsonValue[] {
  const graph: JsonValue[] = [buildForgeWebPageSchema(page, business), buildForgeBreadcrumbSchema(page, business)]
  const localRelevant = Boolean(business.primaryLocation) || business.serviceAreas.length > 0
  const gamingCommunity = isGamingCommunitySeoPage(page)
  if ((page.template === "home" || page.template === "contact" || page.template === "local") && localRelevant && !gamingCommunity) {
    graph.push(buildForgeLocalBusinessSchema(business))
  }
  if (page.template === "service" && !gamingCommunity) {
    graph.push(buildForgeServiceSchema(page, business))
  }
  const faq = buildForgeFaqSchema(page.faqItems)
  if (faq) graph.push(faq)
  return graph
}

function isGamingCommunitySeoPage(page: ForgeSeoPageInput) {
  return /minecraft|gaming|server ip|discord|game mode|players|vote for server|join server|login|register/i.test([
    page.keyword,
    page.h1,
    page.heroSubheading,
    page.bodyText,
    page.localSeoCopy,
    page.serviceName ?? "",
    ...page.trustElements,
  ].join(" "))
}

export function buildForgePageMetadata(page: ForgeSeoPageInput, business: ForgeSeoBusiness): ForgeSeoPageMetadata {
  const canonical = buildForgeCanonicalUrl(business.siteUrl, page.path)
  const jsonLd = buildForgePageJsonLd(page, business)
  return {
    path: normalizePath(page.path),
    template: page.template,
    title: buildForgePageTitle(page, business),
    metaDescription: buildForgeMetaDescription(page, business),
    canonical,
    keyword: page.keyword,
    openGraph: buildForgeOpenGraph(page, business, canonical),
    twitter: buildForgeTwitter(page, business),
    jsonLdTypes: jsonLd.map((entry) => schemaType(entry)).filter((value): value is string => Boolean(value)),
    jsonLd,
  }
}

/* ── sitemap.xml + robots.txt ───────────────────────────────────────── */

export function buildForgeSitemapXml(business: ForgeSeoBusiness, pages: ForgeSeoPageInput[], lastModified = new Date().toISOString()): string {
  const seen = new Set<string>()
  const urls = pages
    .map((page) => buildForgeCanonicalUrl(business.siteUrl, page.path))
    .filter((url) => (seen.has(url) ? false : (seen.add(url), true)))
  const entries = urls.map((url, index) => [
    "  <url>",
    `    <loc>${escapeXml(url)}</loc>`,
    `    <lastmod>${escapeXml(lastModified)}</lastmod>`,
    `    <changefreq>${index === 0 ? "weekly" : "monthly"}</changefreq>`,
    `    <priority>${index === 0 ? "1.0" : "0.7"}</priority>`,
    "  </url>",
  ].join("\n"))
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    "</urlset>",
    "",
  ].join("\n")
}

export function buildForgeRobotsTxt(business: ForgeSeoBusiness): string {
  return [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${buildForgeCanonicalUrl(business.siteUrl, "/")}sitemap.xml`,
    "",
  ].join("\n")
}

/* ── AEO/GEO analysis: keyword stuffing + checklist + score ─────────── */

export function analyzeForgeKeywordStuffing(text: string, keyword: string) {
  const cleanKeyword = keyword.trim().toLowerCase()
  const words = (text.toLowerCase().match(/[a-z0-9']+/g) ?? [])
  const wordCount = words.length
  if (!cleanKeyword || wordCount === 0) {
    return { density: 0, repeats: 0, stuffed: false }
  }
  const keywordWordCount = cleanKeyword.split(/\s+/).filter(Boolean).length || 1
  const haystack = ` ${words.join(" ")} `
  const needle = ` ${cleanKeyword} `
  let repeats = 0
  let index = haystack.indexOf(needle)
  while (index !== -1) {
    repeats += 1
    index = haystack.indexOf(needle, index + 1)
  }
  const density = (repeats * keywordWordCount) / wordCount
  const stuffed = density > FORGE_KEYWORD_STUFFING_MAX_DENSITY || repeats > FORGE_KEYWORD_STUFFING_MAX_REPEATS
  return { density: Math.round(density * 1000) / 1000, repeats, stuffed }
}

export function buildForgeSeoChecklist(business: ForgeSeoBusiness, pages: ForgeSeoPageInput[]): ForgeSeoChecklistItem[] {
  const items: ForgeSeoChecklistItem[] = []
  const metadata = pages.map((page) => buildForgePageMetadata(page, business))
  const pageCount = Math.max(pages.length, 1)

  const titleIssues = metadata.filter((meta) => meta.title.length < FORGE_SEO_TITLE_MIN || meta.title.length > FORGE_SEO_TITLE_MAX)
  items.push(check("seo", "page-titles", "Page titles within length budget", titleIssues.length === 0 ? "pass" : "warn",
    titleIssues.length === 0 ? "All page titles are present and within 15–60 characters." : `${titleIssues.length} title(s) fall outside the 15–60 character budget.`,
    titleIssues.length === 0 ? null : `Tighten titles for: ${titleIssues.map((meta) => meta.path).join(", ")}.`))

  const metaIssues = metadata.filter((meta) => meta.metaDescription.length < FORGE_SEO_META_MIN || meta.metaDescription.length > FORGE_SEO_META_MAX)
  items.push(check("seo", "meta-descriptions", "Meta descriptions within length budget", metaIssues.length === 0 ? "pass" : "warn",
    metaIssues.length === 0 ? "All meta descriptions are present and within 70–160 characters." : `${metaIssues.length} meta description(s) fall outside 70–160 characters.`,
    metaIssues.length === 0 ? null : `Rewrite meta descriptions for: ${metaIssues.map((meta) => meta.path).join(", ")}.`))

  items.push(check("seo", "canonical-urls", "Canonical URLs generated", "pass",
    `Canonical URLs are derived from ${business.siteUrl} for all ${pageCount} page(s).`, null))

  items.push(check("seo", "open-graph", "Open Graph metadata", "pass",
    "Open Graph type, title, description, url, and site name are generated per page.", null))

  items.push(check("seo", "twitter", "Twitter metadata", "pass",
    "Twitter summary_large_image cards are generated per page.", null))

  const jsonLdMissing = metadata.filter((meta) => meta.jsonLd.length === 0)
  items.push(check("seo", "json-ld", "JSON-LD structured data", jsonLdMissing.length === 0 ? "pass" : "fail",
    jsonLdMissing.length === 0 ? "Every page emits a JSON-LD graph (WebPage + breadcrumbs and contextual schema)." : `${jsonLdMissing.length} page(s) are missing JSON-LD.`,
    jsonLdMissing.length === 0 ? null : "Generate JSON-LD for every page."))

  const hasBreadcrumb = metadata.every((meta) => meta.jsonLdTypes.includes("BreadcrumbList"))
  items.push(check("seo", "breadcrumb-schema", "Breadcrumb schema", hasBreadcrumb ? "pass" : "warn",
    hasBreadcrumb ? "BreadcrumbList schema is present on every page." : "Some pages are missing BreadcrumbList schema.", hasBreadcrumb ? null : "Add breadcrumbs to all pages."))

  const hasLocalBusiness = metadata.some((meta) => meta.jsonLdTypes.includes("LocalBusiness"))
  const localRelevant = Boolean(business.primaryLocation) || business.serviceAreas.length > 0
  items.push(check("seo", "localbusiness-schema", "LocalBusiness schema where relevant", hasLocalBusiness ? "pass" : localRelevant ? "warn" : "pass",
    hasLocalBusiness ? "LocalBusiness schema is emitted on the home/contact/area pages." : localRelevant ? "Business has location data but no LocalBusiness schema was emitted." : "No local footprint provided, so LocalBusiness schema is optional.",
    hasLocalBusiness || !localRelevant ? null : "Emit LocalBusiness schema on the home and contact pages."))

  const hasService = metadata.some((meta) => meta.jsonLdTypes.includes("Service"))
  const serviceRelevant = pages.some((page) => page.template === "service")
  items.push(check("seo", "service-schema", "Service schema", hasService ? "pass" : serviceRelevant ? "warn" : "pass",
    hasService ? "Service schema is emitted on service pages." : serviceRelevant ? "Service pages exist but no Service schema was emitted." : "No service pages, so Service schema is optional.",
    hasService || !serviceRelevant ? null : "Emit Service schema on service pages."))

  items.push(check("seo", "sitemap", "sitemap.xml", "pass", "A sitemap.xml is generated covering every canonical page URL.", null))
  items.push(check("seo", "robots", "robots.txt", "pass", "A robots.txt is generated and references the sitemap.", null))

  // Keyword stuffing guardrail (SEO + AEO sensitive).
  const stuffedPages = pages
    .map((page) => ({ page, analysis: analyzeForgeKeywordStuffing(`${page.h1} ${page.heroSubheading} ${page.bodyText} ${page.metaDescription}`, page.keyword) }))
    .filter((entry) => entry.analysis.stuffed)
  items.push(check("seo", "keyword-stuffing", "No keyword stuffing", stuffedPages.length === 0 ? "pass" : "fail",
    stuffedPages.length === 0 ? "No unnatural keyword density detected." : `${stuffedPages.length} page(s) repeat the target keyword unnaturally.`,
    stuffedPages.length === 0 ? null : FORGE_KEYWORD_STUFFING_WARNING))

  /* AEO */
  const faqPages = pages.filter((page) => page.faqItems.filter((item) => item.question.trim() && item.answer.trim()).length >= 2)
  items.push(check("aeo", "faq-sections", "FAQ sections", faqPages.length >= Math.ceil(pageCount / 2) ? "pass" : faqPages.length > 0 ? "warn" : "fail",
    `${faqPages.length} of ${pageCount} page(s) have at least two structured FAQ entries.`,
    faqPages.length >= Math.ceil(pageCount / 2) ? null : "Add at least two question/answer pairs to more pages to win AI answer placements."))

  const directAnswerPages = pages.filter((page) => isSelfContainedAnswer(page.heroSubheading) || page.faqItems.some((item) => isSelfContainedAnswer(item.answer)))
  items.push(check("aeo", "direct-answer-blocks", "Direct answer blocks", directAnswerPages.length >= Math.ceil(pageCount / 2) ? "pass" : directAnswerPages.length > 0 ? "warn" : "fail",
    `${directAnswerPages.length} of ${pageCount} page(s) lead with a concise, self-contained answer block.`,
    directAnswerPages.length >= Math.ceil(pageCount / 2) ? null : "Open key pages with a 1–2 sentence direct answer that stands alone without surrounding context."))

  const selfContained = pages.filter((page) => hasSelfContainedParagraphs(page.bodyText))
  items.push(check("aeo", "self-contained-paragraphs", "Self-contained paragraphs", selfContained.length >= Math.ceil(pageCount / 2) ? "pass" : selfContained.length > 0 ? "warn" : "fail",
    `${selfContained.length} of ${pageCount} page(s) use self-contained paragraphs that read well when quoted out of context.`,
    selfContained.length >= Math.ceil(pageCount / 2) ? null : "Break copy into standalone paragraphs that each make sense when extracted by an answer engine."))

  const entityRich = metadata.filter((meta) => isEntityRich(meta.metaDescription, business))
  items.push(check("aeo", "entity-rich-descriptions", "Entity-rich descriptions", entityRich.length >= Math.ceil(pageCount / 2) ? "pass" : entityRich.length > 0 ? "warn" : "fail",
    `${entityRich.length} of ${pageCount} description(s) name the business, service, or location entities.`,
    entityRich.length >= Math.ceil(pageCount / 2) ? null : "Reference concrete entities (business name, service, location) in descriptions so answer engines can ground the page."))

  const comparisonPages = pages.filter((page) => hasComparisonSignal(page.bodyText))
  items.push(check("aeo", "comparison-sections", "Comparison sections where useful", comparisonPages.length > 0 ? "pass" : "warn",
    comparisonPages.length > 0 ? `${comparisonPages.length} page(s) include comparison or decision-support content.` : "No comparison content detected.",
    comparisonPages.length > 0 ? null : "Where buyers compare options, add a comparison section — answer engines surface these for evaluative queries."))

  /* GEO */
  const serviceLocationPages = pages.filter((page) => mentionsLocation(page.localSeoCopy, business) || mentionsLocation(page.bodyText, business))
  items.push(check("geo", "service-location", "Clear service/location relationships", serviceLocationPages.length >= Math.ceil(pageCount / 2) ? "pass" : serviceLocationPages.length > 0 ? "warn" : "fail",
    `${serviceLocationPages.length} of ${pageCount} page(s) connect services to a named location or service area.`,
    serviceLocationPages.length >= Math.ceil(pageCount / 2) ? null : "Tie each service to a named location/service area so geo answer engines can match local intent."))

  items.push(check("geo", "service-areas", "Service areas defined", business.serviceAreas.length > 0 || Boolean(business.primaryLocation) ? "pass" : "fail",
    business.serviceAreas.length > 0 ? `Service areas defined: ${business.serviceAreas.join(", ")}.` : business.primaryLocation ? `Primary location defined: ${business.primaryLocation}.` : "No location or service areas defined.",
    business.serviceAreas.length > 0 || business.primaryLocation ? null : "Define a primary location and service areas to anchor local/geo relevance."))

  items.push(check("geo", "local-business-entity", "LocalBusiness entity completeness", localRelevant ? "pass" : "warn",
    localRelevant ? "Business entity has location data for LocalBusiness grounding." : "Business entity has no location data.",
    localRelevant ? null : "Add a primary location, telephone, and service areas to complete the LocalBusiness entity."))

  items.push(check("geo", "freshness-signals", "Freshness/update signals", "pass",
    "Generated sitemap.xml carries lastmod values and the SEO pack records a generated/updated timestamp.", null))

  return items
}

export function scoreForgeSeoChecklist(checklist: ForgeSeoChecklistItem[]): ForgeSeoScore {
  return {
    seo: categoryScore(checklist, "seo"),
    aeo: categoryScore(checklist, "aeo"),
    geo: categoryScore(checklist, "geo"),
    overall: categoryScore(checklist, null),
  }
}

/* ── Pack assembly + fixes ──────────────────────────────────────────── */

export function buildForgeSeoPack(business: ForgeSeoBusiness, pages: ForgeSeoPageInput[], generatedAt = new Date().toISOString()): ForgeSeoPack {
  const checklist = buildForgeSeoChecklist(business, pages)
  const score = scoreForgeSeoChecklist(checklist)
  const warnings: string[] = []
  for (const page of pages) {
    const analysis = analyzeForgeKeywordStuffing(`${page.h1} ${page.heroSubheading} ${page.bodyText} ${page.metaDescription}`, page.keyword)
    if (analysis.stuffed) warnings.push(`Keyword stuffing risk on ${normalizePath(page.path)} (keyword "${page.keyword}" density ${analysis.density}). ${FORGE_KEYWORD_STUFFING_WARNING}`)
  }
  for (const item of checklist) {
    if (item.status === "fail" && item.recommendation) warnings.push(`${item.label}: ${item.recommendation}`)
  }

  return {
    kind: FORGE_SEO_ARTIFACT_KIND,
    business: { ...business },
    pages: pages.map((page) => buildForgePageMetadata(page, business)),
    checklist,
    score,
    warnings: [...new Set(warnings)],
    sitemapXml: buildForgeSitemapXml(business, pages, generatedAt),
    robotsTxt: buildForgeRobotsTxt(business),
    generatedAt,
  }
}

export interface ForgeSeoFix {
  path: string
  field: "title" | "metaDescription"
  before: string
  after: string
}

export function applyForgeSeoMetadataFixes(business: ForgeSeoBusiness, pages: ForgeSeoPageInput[]): { pages: ForgeSeoPageInput[]; fixes: ForgeSeoFix[] } {
  const fixes: ForgeSeoFix[] = []
  const fixed = pages.map((page) => {
    const next = { ...page }
    const titleMeta = buildForgePageTitle(page, business)
    if (!page.title?.trim() || page.title.length > FORGE_SEO_TITLE_MAX || page.title.length < FORGE_SEO_TITLE_MIN) {
      if (titleMeta !== page.title) {
        fixes.push({ path: normalizePath(page.path), field: "title", before: page.title ?? "", after: titleMeta })
        next.title = titleMeta
      }
    }
    const metaValue = buildForgeMetaDescription(page, business)
    const metaLen = page.metaDescription?.trim().length ?? 0
    if (!page.metaDescription?.trim() || metaLen < FORGE_SEO_META_MIN || metaLen > FORGE_SEO_META_MAX) {
      if (metaValue !== page.metaDescription) {
        fixes.push({ path: normalizePath(page.path), field: "metaDescription", before: page.metaDescription ?? "", after: metaValue })
        next.metaDescription = metaValue
      }
    }
    return next
  })
  return { pages: fixed, fixes }
}

/* ── Artifact read + render ─────────────────────────────────────────── */

export function readForgeSeoArtifact(metadata: Record<string, unknown> | null | undefined): ForgeSeoArtifactState {
  if (!metadata || metadata.kind !== FORGE_SEO_ARTIFACT_KIND || typeof metadata.pack !== "object" || metadata.pack === null) {
    return { pack: null, status: "empty", score: null, generatedAt: null }
  }
  const pack = metadata.pack as Partial<ForgeSeoPack>
  if (pack.kind !== FORGE_SEO_ARTIFACT_KIND || !Array.isArray(pack.pages) || !Array.isArray(pack.checklist) || typeof pack.score !== "object" || pack.score === null) {
    return { pack: null, status: "empty", score: null, generatedAt: null }
  }
  return {
    pack: pack as ForgeSeoPack,
    status: "generated",
    score: pack.score as ForgeSeoScore,
    generatedAt: typeof pack.generatedAt === "string" ? pack.generatedAt : null,
  }
}

export function buildForgeSeoArtifactContent(pack: ForgeSeoPack): string {
  const lines = [
    "# SEO/AEO/GEO Pack",
    "",
    `Overall score: ${pack.score.overall}/100 (SEO ${pack.score.seo} · AEO ${pack.score.aeo} · GEO ${pack.score.geo})`,
    `Canonical base: ${pack.business.siteUrl}`,
    `Generated: ${pack.generatedAt}`,
    "",
    "## Checklist",
    ...pack.checklist.map((item) => `- [${item.status.toUpperCase()}] (${item.category.toUpperCase()}) ${item.label} — ${item.detail}`),
    "",
    "## Per-page metadata",
    ...pack.pages.flatMap((page) => [
      `### ${page.path}`,
      `- Title: ${page.title}`,
      `- Meta: ${page.metaDescription}`,
      `- Canonical: ${page.canonical}`,
      `- JSON-LD: ${page.jsonLdTypes.join(", ") || "none"}`,
      "",
    ]),
    "## Keyword stuffing guardrail",
    FORGE_KEYWORD_STUFFING_WARNING,
    "",
    "## Warnings",
    ...(pack.warnings.length ? pack.warnings.map((warning) => `- ${warning}`) : ["- No SEO/AEO/GEO warnings."]),
  ]
  return lines.join("\n").trim()
}

/* ── internal helpers ───────────────────────────────────────────────── */

function check(category: ForgeSeoCategory, id: string, label: string, status: ForgeSeoCheckStatus, detail: string, recommendation: string | null): ForgeSeoChecklistItem {
  return { id, category, label, status, detail, recommendation }
}

function categoryScore(checklist: ForgeSeoChecklistItem[], category: ForgeSeoCategory | null): number {
  const items = category ? checklist.filter((item) => item.category === category) : checklist
  if (!items.length) return 0
  const total = items.reduce((sum, item) => sum + (item.status === "pass" ? 1 : item.status === "warn" ? 0.5 : 0), 0)
  return Math.round((total / items.length) * 100)
}

function clampTitle(value: string, businessName: string): string {
  const trimmed = value.replace(/\s+/g, " ").trim()
  if (trimmed.length <= FORGE_SEO_TITLE_MAX) return trimmed
  const withoutSuffix = trimmed.replace(` | ${businessName}`, "")
  if (withoutSuffix.length <= FORGE_SEO_TITLE_MAX && withoutSuffix.length >= FORGE_SEO_TITLE_MIN) return withoutSuffix
  return `${trimmed.slice(0, FORGE_SEO_TITLE_MAX - 1).trimEnd()}…`
}

function isSelfContainedAnswer(value: string): boolean {
  const text = value?.trim() ?? ""
  if (text.length < 40 || text.length > 320) return false
  return /[.!?]/.test(text) && !/^(it|this|that|they|these|those)\b/i.test(text)
}

function hasSelfContainedParagraphs(body: string): boolean {
  const paragraphs = body.split(/\n{2,}|(?<=[.!?])\s{2,}/).map((p) => p.trim()).filter(Boolean)
  const usable = paragraphs.filter((p) => p.length >= 40 && p.length <= 600 && /[.!?]/.test(p))
  return usable.length >= 1 && body.trim().length >= 60
}

function isEntityRich(description: string, business: ForgeSeoBusiness): boolean {
  const text = description.toLowerCase()
  const entities = [business.businessName, business.industry ?? "", business.primaryLocation ?? "", ...business.serviceAreas]
    .map((entity) => entity.trim().toLowerCase())
    .filter(Boolean)
  return entities.some((entity) => text.includes(entity))
}

function hasComparisonSignal(body: string): boolean {
  return /\b(vs\.?|versus|compared to|comparison|alternative|which is better|pros and cons|cheaper than|better than)\b/i.test(body)
}

function mentionsLocation(text: string, business: ForgeSeoBusiness): boolean {
  const haystack = (text ?? "").toLowerCase()
  const locations = [business.primaryLocation ?? "", ...business.serviceAreas].map((value) => value.trim().toLowerCase()).filter(Boolean)
  if (!locations.length) return false
  return locations.some((location) => haystack.includes(location))
}

function schemaType(entry: JsonValue): string | null {
  if (entry && typeof entry === "object" && !Array.isArray(entry)) {
    const type = (entry as Record<string, JsonValue>)["@type"]
    return typeof type === "string" ? type : null
  }
  return null
}

function titleizeSegment(segment: string): string {
  return segment.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function normalizePath(input: string): string {
  const trimmed = (input ?? "").trim() || "/"
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`
  const clean = withSlash.replace(/\/+/g, "/").replace(/\/$/g, "")
  return clean || "/"
}

function truncateWords(value: string, maxLength: number): string {
  const trimmed = value.trim()
  return trimmed.length <= maxLength ? trimmed : `${trimmed.slice(0, maxLength).trimEnd()}`
}

function escapeXml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&apos;", '"': "&quot;" }[char] ?? char))
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}
