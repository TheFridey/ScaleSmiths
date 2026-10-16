/**
 * Commercial pathways for industry pages.
 *
 * Baselines below match the Global Industry Growth Engine production directive
 * (Trev, 15 Oct 2026) and Megaton offer catalogue. They are intentionally separate
 * from the verified public-claims registry, which still records different historical
 * package figures. Founder sign-off must reconcile claims before irreversible
 * production marketing treats these as the sole published prices.
 *
 * All amounts are GBP reference currency. International proposals are quoted for
 * location and scope — never silently auto-converted into a binding foreign-currency quote.
 */

import type { CommercialPathwayId } from "./types"

export const INDUSTRY_COMMERCIAL_PRICING_STATUS = "founder_review_required" as const

export interface CommercialPathway {
  id: CommercialPathwayId
  label: string
  shortLabel: string
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
    startingPriceLabel: "from £2,000",
    priceNote:
      "Baseline for an eligible, clearly scoped foundation build. Complex work, advanced integrations, e-commerce, hosting and monthly maintenance are quoted individually and are not automatic inclusions.",
    summary:
      "Bespoke design, customer journeys, SEO foundations, and enquiry or booking routes scoped around how your customers actually choose a provider.",
    href: (industrySlug, hubSlug) => industryQuoteHref(industrySlug, hubSlug, "build"),
  },
  growth: {
    id: "growth",
    label: "Digital Growth Partnership",
    shortLabel: "Grow my existing business",
    startingPriceLabel: "from £350/month",
    priceNote:
      "Baseline for an agreed minimum engagement. Deliverables, cadence, maintenance, SEO, CRO, content and support vary with needs and are written into the proposal. You do not need a new ScaleSmiths website first.",
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
  "Prices are shown in GBP as the reference currency. International proposals are quoted for your location and scope."
