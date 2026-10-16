import type { Metadata } from "next"
import { buildPageMetadata } from "../page-metadata"
import { organizationReference, websiteId } from "../site-identity"
import { commercialPathways } from "./commercial"
import { allIndustryHubs, getIndustryHub, industryHubs } from "./hubs"
import { getIndustryPage, industryPagesForHub, publishedIndustryPages } from "./pages"
import { industryDemonstrationPath, industryDemonstrations } from "./demonstrations"
import { discoverableIndustryTaxonomy } from "./taxonomy"
import type { IndustryPage, IndustrySearchHit } from "./types"

export {
  allIndustryHubs,
  getIndustryHub,
  industryHubs,
  getIndustryPage,
  industryPagesForHub,
  publishedIndustryPages,
  commercialPathways,
}

export function industryPath(hubSlug: string, industrySlug?: string) {
  return industrySlug ? `/industries/${hubSlug}/${industrySlug}` : `/industries/${hubSlug}`
}

export function metadataForIndustriesIndex(): Metadata {
  return buildPageMetadata({
    title: "Industries We Help",
    absoluteTitle: "Industries We Help | ScaleSmiths",
    description:
      "Find your industry. Sector hubs and specialist pages for trades, clinics, hospitality, retail, manufacturing, SaaS and more — with honest Build and Growth Partnership routes.",
    path: "/industries",
  })
}

export function metadataForIndustryHub(hubSlug: string): Metadata | null {
  const hub = getIndustryHub(hubSlug)
  if (!hub) return null
  return buildPageMetadata({
    title: hub.shortName,
    absoluteTitle: hub.metaTitle,
    description: hub.description,
    path: industryPath(hub.slug),
  })
}

export function metadataForIndustryPage(hubSlug: string, industrySlug: string): Metadata | null {
  const page = getIndustryPage(industrySlug)
  if (!page || page.hubSlug !== hubSlug) return null
  return buildPageMetadata({
    title: page.name,
    absoluteTitle: page.metaTitle,
    description: page.description,
    path: industryPath(page.hubSlug, page.slug),
  })
}

function normaliseSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Lightweight synonym / plural folding for directory search. */
function expandQueryTokens(query: string): string[] {
  const base = normaliseSearch(query)
  if (!base) return []
  const tokens = base.split(" ")
  const extras: string[] = []
  for (const token of tokens) {
    if (token.endsWith("ies") && token.length > 4) extras.push(`${token.slice(0, -3)}y`)
    if (token.endsWith("s") && token.length > 3) extras.push(token.slice(0, -1))
    if (token === "realtor" || token === "realtors") extras.push("estate", "agent")
    if (token === "tradespeople" || token === "tradesperson") extras.push("trades", "contractor")
    if (token === "chiropody" || token === "chiropodist") extras.push("podiatry", "podiatrist")
  }
  return [...new Set([...tokens, ...extras])]
}

export function searchIndustries(query: string, limit = 12): IndustrySearchHit[] {
  const tokens = expandQueryTokens(query)
  if (!tokens.length) return []

  const hubName = (hubSlug: string) => getIndustryHub(hubSlug)?.shortName ?? hubSlug
  const scored: Array<IndustrySearchHit & { score: number }> = []

  for (const hub of allIndustryHubs()) {
    const haystack = normaliseSearch(`${hub.name} ${hub.shortName} ${hub.intro}`)
    const score = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 2 : 0), 0)
    if (score > 0) {
      scored.push({
        kind: "hub",
        id: `hub.${hub.slug}`,
        name: hub.shortName,
        href: industryPath(hub.slug),
        hubSlug: hub.slug,
        hubName: hub.shortName,
        primaryProblem: hub.audience,
        state: "published",
        score,
      })
    }
  }

  for (const page of publishedIndustryPages()) {
    const haystack = normaliseSearch(`${page.name} ${page.pluralName} ${page.synonyms.join(" ")} ${page.primaryProblem} ${page.h1}`)
    let score = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 3 : 0), 0)
    if (normaliseSearch(page.name) === normaliseSearch(query)) score += 10
    if (score > 0) {
      scored.push({
        kind: "published",
        id: page.id,
        name: page.name,
        href: industryPath(page.hubSlug, page.slug),
        hubSlug: page.hubSlug,
        hubName: hubName(page.hubSlug),
        primaryProblem: page.primaryProblem,
        proofLevel: page.proof.level,
        state: page.state,
        score,
      })
    }
  }

  for (const entry of discoverableIndustryTaxonomy()) {
    if (entry.state === "published") continue
    const haystack = normaliseSearch(`${entry.name} ${entry.synonyms.join(" ")} ${entry.primaryProblem}`)
    const score = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 2 : 0), 0)
    if (score > 0) {
      scored.push({
        kind: "candidate",
        id: entry.id,
        name: entry.name,
        href: `/industries/request?hint=${encodeURIComponent(entry.name)}`,
        hubSlug: entry.hubSlug,
        hubName: hubName(entry.hubSlug),
        primaryProblem: entry.primaryProblem,
        proofLevel: entry.proofLevel,
        state: entry.state,
        score,
      })
    }
  }

  return scored
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((entry) => {
      const { score, ...hit } = entry
      void score
      return hit
    })
}

export function industryAzIndex(): Array<{ letter: string; items: IndustrySearchHit[] }> {
  const items: IndustrySearchHit[] = [
    ...publishedIndustryPages().map((page) => ({
      kind: "published" as const,
      id: page.id,
      name: page.name,
      href: industryPath(page.hubSlug, page.slug),
      hubSlug: page.hubSlug,
      hubName: getIndustryHub(page.hubSlug)?.shortName ?? page.hubSlug,
      primaryProblem: page.primaryProblem,
      proofLevel: page.proof.level,
      state: page.state,
    })),
    ...discoverableIndustryTaxonomy()
      .filter((entry) => entry.state !== "published")
      .map((entry) => ({
        kind: "candidate" as const,
        id: entry.id,
        name: entry.name,
        href: `/industries/request?hint=${encodeURIComponent(entry.name)}`,
        hubSlug: entry.hubSlug,
        hubName: getIndustryHub(entry.hubSlug)?.shortName ?? entry.hubSlug,
        primaryProblem: entry.primaryProblem,
        proofLevel: entry.proofLevel,
        state: entry.state,
      })),
  ].sort((a, b) => a.name.localeCompare(b.name))

  const groups = new Map<string, IndustrySearchHit[]>()
  for (const item of items) {
    const letter = item.name.charAt(0).toUpperCase()
    const list = groups.get(letter) ?? []
    list.push(item)
    groups.set(letter, list)
  }
  return [...groups.entries()].map(([letter, group]) => ({ letter, items: group }))
}

export function sitemapIndustryEntries(base: string, lastModified: Date) {
  const entries = [
    { url: `${base}/industries`, lastModified, changeFrequency: "weekly" as const, priority: 0.9 },
    { url: `${base}/industries/request`, lastModified, changeFrequency: "monthly" as const, priority: 0.5 },
    ...allIndustryHubs().map((hub) => ({
      url: `${base}${industryPath(hub.slug)}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.85,
    })),
    ...publishedIndustryPages().map((page) => ({
      url: `${base}${industryPath(page.hubSlug, page.slug)}`,
      lastModified: new Date(`${page.reviewedAt}T00:00:00.000Z`),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...industryDemonstrations().map((demonstration) => ({
      url: `${base}${industryDemonstrationPath(demonstration.hubSlug)}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.75,
    })),
  ]
  return entries
}

export function buildIndustryPageSchemas(page: IndustryPage, base = "https://scalesmiths.co.uk") {
  const url = `${base}${industryPath(page.hubSlug, page.slug)}`
  const hub = getIndustryHub(page.hubSlug)
  const breadcrumbs = [
    { name: "Home", item: `${base}/` },
    { name: "Industries", item: `${base}/industries` },
    ...(hub ? [{ name: hub.shortName, item: `${base}${industryPath(hub.slug)}` }] : []),
    { name: page.name, item: url },
  ]

  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      url,
      name: page.metaTitle,
      description: page.description,
      isPartOf: { "@id": websiteId(base) },
      about: organizationReference(base),
      inLanguage: "en-GB",
      dateModified: page.reviewedAt,
    },
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: `Digital growth for ${page.pluralName}`,
      description: page.intro,
      provider: organizationReference(base),
      areaServed: "Worldwide",
      serviceType: "Digital growth, websites and custom systems",
      url,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbs.map((crumb, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: crumb.name,
        item: crumb.item,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: page.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.q,
        acceptedAnswer: { "@type": "Answer", text: faq.a },
      })),
    },
  ]
}

export function buildIndustriesIndexSchemas(base = "https://scalesmiths.co.uk") {
  const url = `${base}/industries`
  return [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": `${url}#webpage`,
      url,
      name: "Industries We Help",
      description: "Browse ScaleSmiths industry hubs and specialist pages.",
      isPartOf: { "@id": websiteId(base) },
      about: organizationReference(base),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${base}/` },
        { "@type": "ListItem", position: 2, name: "Industries", item: url },
      ],
    },
  ]
}

export function buildIndustryHubSchemas(hubSlug: string, base = "https://scalesmiths.co.uk") {
  const hub = getIndustryHub(hubSlug)
  if (!hub) return []
  const url = `${base}${industryPath(hub.slug)}`
  const pages = industryPagesForHub(hub.slug)
  return [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": `${url}#webpage`,
      url,
      name: hub.metaTitle,
      description: hub.description,
      isPartOf: { "@id": websiteId(base) },
      about: organizationReference(base),
      hasPart: pages.map((page) => ({
        "@type": "WebPage",
        name: page.name,
        url: `${base}${industryPath(page.hubSlug, page.slug)}`,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${base}/` },
        { "@type": "ListItem", position: 2, name: "Industries", item: `${base}/industries` },
        { "@type": "ListItem", position: 3, name: hub.shortName, item: url },
      ],
    },
  ]
}

/** Meaningful-difference guard used in tests: pages must not collapse to interchangeable copy. */
export function industryDifferenceFingerprint(page: IndustryPage): string {
  return [
    page.h1,
    page.primaryProblem,
    ...page.frictions.map((item) => item.title),
    ...page.strategy.map((item) => item.title),
    page.proof.label,
  ].join("|")
}
