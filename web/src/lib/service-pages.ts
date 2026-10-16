import { businessGrowthAudit, formatAuditPrice } from "./business-growth-audit"
import { faqEntries } from "./faq-library"
import { publishedStartingPrice } from "./published-starting-prices"
import { organizationReference } from "./site-identity"

export const serviceHubItems = [
  {
    journey: "local-growth" as const,
    title: "Conversion-focused websites",
    for: "Founder-led businesses that need the website to create qualified enquiries, not just exist.",
    includes: "Messaging, UX, responsive build, analytics foundations, quote CTA paths, and launch support.",
    outcome: "Clearer positioning and a stronger route from visitor to enquiry.",
    links: ["/web-design-nottingham", "/website-redesign-nottingham", "/local-seo-nottingham"],
  },
  {
    journey: "local-growth" as const,
    title: "Local business websites",
    for: "Service businesses in Hucknall, Nottingham, and across the UK that need local trust and visibility.",
    includes: "Local SEO structure, service pages, conversion copy, fast pages, and Google-ready metadata.",
    outcome: "A credible local web presence that supports calls, bookings, and enquiries.",
    links: ["/locations/nottingham", "/locations/hucknall", "/web-design-hucknall"],
  },
  {
    journey: "custom-systems" as const,
    title: "E-commerce builds",
    for: "Brands that have outgrown generic store templates or need custom product workflows.",
    includes: "Product UX, variant strategy, payment planning, admin workflows, and migration support.",
    outcome: "A commerce system that fits how the business sells and operates.",
    links: ["/e-commerce-development-nottingham"],
  },
  {
    journey: "custom-systems" as const,
    title: "Custom web apps",
    for: "Teams with workflows that off-the-shelf tools cannot handle cleanly.",
    includes: "User roles, database-backed features, dashboards, portals, integrations, and deployment.",
    outcome: "Less operational drag and a system shaped around the business.",
    links: ["/custom-web-app-development-uk", "/next-js-agency-uk"],
  },
  {
    journey: "local-growth" as const,
    title: "SEO/AEO landing pages",
    for: "Businesses that need service/location pages that answer buyer questions with depth.",
    includes: "Canonical metadata, FAQ schema, service schema, internal links, and direct buyer FAQs.",
    outcome: "Pages that answer a buyer's real question and give them a clear way to enquire.",
    links: ["/web-design-hucknall", "/next-js-agency-uk"],
  },
  {
    journey: "local-growth" as const,
    title: "Growth Partnership",
    for: "Businesses that want one accountable partner improving search visibility, conversion, content and technology, whether ScaleSmiths built the current site or not.",
    includes: "SEO, content, analytics, conversion improvement, roadmap delivery, monitoring and technical support as agreed.",
    outcome: "A prioritised digital estate that evolves with the business instead of quietly decaying.",
    links: ["/digital-growth-partnership", "/pricing"],
  },
  {
    journey: "custom-systems" as const,
    title: "AI and business automation",
    for: "Teams losing time to repeated admin, disconnected tools, manual hand-offs or poorly governed AI experiments.",
    includes: "Workflow discovery, data and permission design, integrations, human review points, AI implementation and operational safeguards.",
    outcome: "A dependable workflow that reduces avoidable manual effort without hiding risk behind a demo.",
    links: ["/business-automation-nottingham", "/custom-software-development-uk"],
  },
  {
    journey: "local-growth" as const,
    title: "Hosting and maintenance",
    for: "Clients who want production hosting, deployment support, backups, and someone accountable.",
    includes: "VPS or managed deployment, uptime checks, SSL, dependency updates, and incident support.",
    outcome: "Fewer platform surprises and a clear owner for the technical estate.",
    links: ["/managed-website-hosting", "/website-maintenance-nottingham"],
  },
]

export const managedBusinessEmailService = {
  title: "Managed Business Email",
  description: "Professional custom-domain email, configured, authenticated and supported by ScaleSmiths. Available standalone or within an agreed managed relationship.",
  href: "/services/managed-business-email",
}

export const businessGrowthAuditService = { title: businessGrowthAudit.shortName, description: "A business-wide assessment of positioning, customer journey, visibility, systems and growth opportunities with a prioritised roadmap.", href: businessGrowthAudit.slug }

export interface PricingItem {
  name: string
  range: string
  priceClaimId: string | null
  note: string
  href?: string
}

/** Transparent Web & Growth / SME services. Kept separate from enterprise procurement. */
export const webGrowthPricingItems: PricingItem[] = [
  { name: publishedStartingPrice("website").name, range: publishedStartingPrice("website").priceLabel, priceClaimId: null, note: publishedStartingPrice("website").note, href: "/quote" },
  { name: "One-page business site", range: "Scoped after discovery", priceClaimId: "price.one-page", note: "Focused single-page presence for a clear offer or campaign. The £2,000 figure is a starting point, not the price of every one-page site.", href: "/local-growth" },
  { name: "Local business growth site", range: "Scoped after discovery", priceClaimId: "price.foundation", note: "Multi-page local site with conversion and SEO foundations. Final scope still depends on pages, content and integrations.", href: "/local-growth" },
  { name: "E-commerce site", range: "Scoped after discovery", priceClaimId: "price.growth", note: "Commerce UX, product structure, payments, and admin workflows. Not included in the website starting price.", href: "/e-commerce-development-nottingham" },
  { name: "Growth Partnership", range: publishedStartingPrice("partnership").priceLabel, priceClaimId: null, note: publishedStartingPrice("partnership").note, href: "/digital-growth-partnership" },
  { name: "Hosting / maintenance", range: "Scoped to stack", priceClaimId: null, note: "Deployment, SSL, backups, monitoring, and infrastructure support. Not automatically included in a website or partnership.", href: "/managed-website-hosting" },
  { name: "Managed Business Email", range: publishedStartingPrice("email").priceLabel, priceClaimId: null, note: publishedStartingPrice("email").note, href: "/services/managed-business-email" },
  { name: businessGrowthAudit.shortName, range: formatAuditPrice(), priceClaimId: null, note: "One-time business-wide assessment with the full fee credited against an eligible subsequent ScaleSmiths build.", href: businessGrowthAudit.slug },
]

export const enterpriseCommercialComponents = [
  { title: "Discovery", body: "Map users, workflows, systems, risks and constraints before a build commitment is made." },
  { title: "Architecture", body: "Define system boundaries, identity, data, integrations and the first dependable release." },
  { title: "Prototype", body: "Prove the highest-risk technical or workflow assumptions where the engagement needs it." },
  { title: "Implementation", body: "Build the agreed MVP or phased release with environment separation and delivery controls." },
  { title: "Migration", body: "Move data and process cutover in rehearsed stages rather than as an untested go-live step." },
  { title: "Integrations", body: "Connect identity, ERP, CRM, finance and operational platforms under explicit ownership." },
  { title: "Managed support", body: "Ongoing operational ownership scoped separately from project delivery, not unlimited development." },
  { title: "Platform licensing", body: "Third-party or platform licence costs where applicable, identified during scoping rather than buried later." },
] as const

export const enterpriseCostFactors = [
  { title: "User count", body: "More actors, roles and concurrent use change authentication, permissions and operational load." },
  { title: "Sites and teams", body: "Multi-site or multi-team structures add permission, process and reporting complexity." },
  { title: "Integrations", body: "Each interface brings mapping, failure handling, testing and operational ownership." },
  { title: "Data migration", body: "Volume, quality, history and cutover risk materially affect timeline and commercial scope." },
  { title: "Security requirements", body: "SSO, audit trails, residency and client security controls reshape architecture and delivery effort." },
  { title: "Mobile / offline", body: "Field and offline-capable work needs different application design than a connected desktop workflow." },
  { title: "Workflows", body: "Approvals, exceptions and process encoding drive much of the real engineering surface area." },
  { title: "Hosting model", body: "ScaleSmiths-managed, client cloud or approved Azure/AWS estates change operational responsibility." },
  { title: "Support requirements", body: "Response expectations, environments and ongoing ownership are commercial boundaries, not free extras." },
] as const

/**
 * Combined catalogue for tests and legacy consumers.
 * Custom/enterprise software is guided on /pricing#enterprise-systems rather than sold as a retail card beside SME offers.
 */
export const pricingItems: PricingItem[] = [
  ...webGrowthPricingItems,
  { name: "Custom web app / enterprise system", range: "Scoped following discovery", priceClaimId: "price.forge", note: "Operational platforms, portals, SaaS and enterprise systems are commercially scoped after discovery, not published as fixed retail prices." },
]

export function buildServiceHubSchema(baseUrl = "https://scalesmiths.co.uk") {
  const provider = organizationReference(baseUrl.replace(/\/$/, ""))
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "ScaleSmiths Services",
    url: `${baseUrl}/services`,
    hasPart: [...serviceHubItems.map((item) => ({
      "@type": "Service",
      name: item.title,
      description: item.outcome,
      provider,
    })), {
      "@type": "Service",
      name: managedBusinessEmailService.title,
      description: managedBusinessEmailService.description,
      provider,
    }, {
      "@type": "Service",
      name: businessGrowthAuditService.title,
      description: businessGrowthAuditService.description,
      provider,
    }],
  }
}

export const pricingFaqs = [
  { q: faqEntries["project-pricing"].q, a: faqEntries["project-pricing"].a },
  { q: faqEntries["website-included"].q, a: faqEntries["website-included"].a },
  { q: faqEntries.cost.q, a: faqEntries.cost.a },
  { q: "Do you offer a Growth Partnership?", a: `${faqEntries["support-included"].a} The published entry point is ${publishedStartingPrice("partnership").priceLabel}.` },
  { q: faqEntries["manage-external-site"].q, a: faqEntries["manage-external-site"].a },
  { q: faqEntries["website-ownership"].q, a: faqEntries["website-ownership"].a },
  { q: "Can I work with ScaleSmiths outside the UK?", a: faqEntries["outside-nottingham"].a },
  { q: faqEntries["after-enquiry"].q, a: faqEntries["after-enquiry"].a },
  { q: faqEntries["improvement-measurement"].q, a: faqEntries["improvement-measurement"].a },
  { q: "Why are enterprise systems not listed with fixed prices?", a: "User count, sites, integrations, data migration, security, mobile or offline needs, workflows, hosting and support requirements all materially affect cost. Custom software and enterprise systems are scoped following discovery because publishing a single public figure would misrepresent the procurement decision." },
  { q: "Where should enterprise buyers start?", a: "Start with discovery. Review the Enterprise and Custom Systems routes, then discuss the operating constraint so architecture and commercial scope can be defined before implementation expands." },
] as const

/** FAQPage mirrors the questions rendered visibly on /pricing; keep both in this one array. */
export function buildPricingSchema(baseUrl = "https://scalesmiths.co.uk") {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: pricingFaqs.map((faq) => ({ "@type": "Question", name: faq.q, acceptedAnswer: { "@type": "Answer", text: faq.a } })),
    url: `${baseUrl}/pricing`,
  }
}
