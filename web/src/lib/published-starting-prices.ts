/**
 * Founder-published starting prices for the public site.
 *
 * A starting price is the entry point for an agreed scope. It is not unlimited
 * design, development, marketing, support, integrations or a guaranteed outcome.
 * Prices are GBP only. Do not publish fixed conversions into other currencies.
 *
 * These figures are intentionally not wired through the public-claims registry.
 * Older draft rate-card rows still exist in migration history and must not
 * override this published guidance until the founders verify a replacement.
 */

export const STARTING_PRICE_BOUNDARY =
  "A starting price is the entry point for an agreed scope. It is not unlimited development, marketing, support, integrations or a guaranteed result. Every proposal depends on requirements, complexity and the deliverables we write down. Prices are in GBP. We do not bill in other currencies or publish fixed converted prices."

export interface PublishedStartingPrice {
  id: "website" | "partnership" | "audit" | "email"
  name: string
  priceLabel: string
  /** Minimum published amount in major GBP units. Null when the figure is a fixed fee rather than a minimum. */
  minPrice: number | null
  /** Fixed published fee, when the offer is not a "from" price. */
  price: number | null
  unitText: string
  note: string
  href: string
  cta: string
}

export const publishedStartingPrices: readonly PublishedStartingPrice[] = [
  {
    id: "website",
    name: "Website design and development",
    priceLabel: "From £2,000",
    minPrice: 2000,
    price: null,
    unitText: "project",
    note: "A starting point for an agreed website project. Content, pages, integrations, migration and support are set in the proposal.",
    href: "/quote",
    cta: "Get a Website Quote",
  },
  {
    id: "partnership",
    name: "Growth Partnership",
    priceLabel: "From £350/month",
    minPrice: 350,
    price: null,
    unitText: "month",
    note: "An entry point for an agreed service scope. It is not an unlimited marketing package. Priorities and cadence are written down before work starts.",
    href: "/digital-growth-partnership",
    cta: "Explore Growth Partnerships",
  },
  {
    id: "audit",
    name: "Business Growth Audit",
    priceLabel: "£395",
    minPrice: null,
    price: 395,
    unitText: "audit",
    note: "A one-time review and prioritised roadmap. Where the published terms apply, the full fee is credited against an eligible subsequent ScaleSmiths build.",
    href: "/services/business-growth-audit",
    cta: "Request a Business Audit",
  },
  {
    id: "email",
    name: "Business email",
    priceLabel: "From £15/month",
    minPrice: 15,
    price: null,
    unitText: "month",
    note: "Three professional 5GB mailboxes on your domain, with initial setup included. Extra mailboxes are not included unless agreed.",
    href: "/services/managed-business-email",
    cta: "Set up business email",
  },
]

/** Budget choices on the public project brief. These follow the published starting prices. */
export const publicProjectBudgetOptions = [
  "Website from £2,000",
  "Growth Partnership from £350/month",
  "Larger build, scoped after discovery",
  "Not sure yet",
] as const

export function publishedStartingPrice(id: PublishedStartingPrice["id"]) {
  const match = publishedStartingPrices.find((item) => item.id === id)
  if (!match) throw new Error(`Unknown published starting price: ${id}`)
  return match
}

export function buildPublishedOfferCatalog(baseUrl = "https://scalesmiths.co.uk") {
  const base = baseUrl.replace(/\/$/, "")
  return {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    name: "ScaleSmiths published starting prices",
    url: `${base}/pricing#published-prices`,
    itemListElement: publishedStartingPrices.map((item) => ({
      "@type": "Offer",
      name: item.name,
      url: `${base}${item.href}`,
      priceCurrency: "GBP",
      description: `${item.note} ${STARTING_PRICE_BOUNDARY}`,
      ...(item.price != null
        ? { price: item.price }
        : {
            priceSpecification: {
              "@type": "PriceSpecification",
              minPrice: item.minPrice,
              priceCurrency: "GBP",
              unitText: item.unitText,
            },
          }),
    })),
  }
}
