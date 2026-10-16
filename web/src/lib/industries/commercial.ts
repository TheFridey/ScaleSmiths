/**
 * Commercial pathways for industry pages.
 *
 * Website builds, Growth Partnerships and custom systems are scoped after discovery.
 * Do not publish “from” prices for those routes on industry pages.
 *
 * Fixed published products (Business Growth Audit £395) may still show their live price.
 * International proposals are quoted for location and scope in GBP as the reference currency.
 */

import type { CommercialPathwayId } from "./types"

export const INDUSTRY_COMMERCIAL_PRICING_STATUS = "scoped_after_discovery" as const

export interface CommercialPathway {
  id: CommercialPathwayId
  label: string
  shortLabel: string
  /** Only for fixed published products. Scoped delivery routes must stay null. */
  startingPriceLabel: string | null
  priceNote: string
  summary: string
  href: (industrySlug: string, hubSlug: string) => string
}

function industryQuoteHref(industrySlug: string, hubSlug: string, pathway: CommercialPathwayId, intent?: "strategy_call") {
  const params = new URLSearchParams({
    industry: industrySlug,
    hub: hubSlug,
    pathway,
  })
  if (intent) params.set("intent", intent)
  return `/quote?${params.toString()}`
}

export const commercialPathways: Record<CommercialPathwayId, CommercialPathway> = {
  build: {
    id: "build",
    label: "Website & digital platform builds",
    shortLabel: "Build a better website",
    startingPriceLabel: null,
    priceNote:
      "Scoped after discovery. Cost follows content, integrations, migration risk and review requirements — not a fixed package price on this page.",
    summary:
      "Bespoke design, customer journeys, SEO foundations, and enquiry or booking routes scoped around how your customers actually choose a provider.",
    href: (industrySlug, hubSlug) => industryQuoteHref(industrySlug, hubSlug, "build"),
  },
  growth: {
    id: "growth",
    label: "Digital Growth Partnership",
    shortLabel: "Grow my existing business",
    startingPriceLabel: null,
    priceNote:
      "Scoped separately after discovery. Deliverables, cadence, maintenance, SEO, CRO, content and support are written into the proposal. You do not need a new ScaleSmiths website first.",
    summary:
      "Ongoing, prioritised improvement around the website and systems you already have — visibility, conversion, content and technical stewardship under one accountable roadmap.",
    href: (industrySlug, hubSlug) => industryQuoteHref(industrySlug, hubSlug, "growth", "strategy_call"),
  },
  systems: {
    id: "systems",
    label: "Custom systems, automation & enterprise",
    shortLabel: "I need a custom system",
    startingPriceLabel: null,
    priceNote: "Individually scoped after discovery. No fixed “from” price is shown because scope varies too widely to advertise honestly.",
    summary:
      "Portals, integrations, automation, e-commerce operations and software that has to fit how the business actually runs.",
    href: (industrySlug, hubSlug) => industryQuoteHref(industrySlug, hubSlug, "systems", "strategy_call"),
  },
  audit: {
    id: "audit",
    label: "Business Growth Audit",
    shortLabel: "Not sure? Start with an audit",
    startingPriceLabel: "£395 one-time",
    priceNote:
      "Optional diagnosis route. Where published terms allow, the full fee may be credited against an eligible ScaleSmiths build.",
    summary:
      "A structured review of the customer journey, website, visibility and systems — then a prioritised roadmap before you commit to the wrong spend.",
    href: () => "/services/business-growth-audit/start",
  },
}

export function pathwayHref(pathway: CommercialPathwayId, industrySlug: string, hubSlug: string) {
  return commercialPathways[pathway].href(industrySlug, hubSlug)
}

export function missingIndustryHref(industryHint?: string) {
  const params = new URLSearchParams({
    intent: "strategy_call",
    pathway: "audit",
    industry: "missing-industry-request",
    hub: "request",
  })
  if (industryHint?.trim()) params.set("hint", industryHint.trim().slice(0, 80))
  return `/quote?${params.toString()}`
}

/** Currency disclosure shown near industry commercial CTAs. */
export const INDUSTRY_CURRENCY_DISCLOSURE =
  "Builds, partnerships and custom systems are scoped after discovery. Published product prices (such as the Business Growth Audit) are in GBP. International proposals are quoted for your location and scope."
