import { businessGrowthAudit, formatAuditPrice } from "./business-growth-audit"

export const serviceHubItems = [
  {
    journey: "local-growth" as const,
    title: "Conversion-focused websites",
    for: "Founder-led businesses that need the website to create qualified enquiries, not just exist.",
    includes: "Messaging, UX, responsive build, analytics foundations, quote CTA paths, and launch support.",
    outcome: "Clearer positioning and a stronger route from visitor to enquiry.",
    links: ["/web-design-hucknall", "/web-development-nottingham"],
  },
  {
    journey: "local-growth" as const,
    title: "Local business websites",
    for: "Service businesses in Hucknall, Nottingham, and across the UK that need local trust and visibility.",
    includes: "Local SEO structure, service pages, conversion copy, fast pages, and Google-ready metadata.",
    outcome: "A credible local web presence that supports calls, bookings, and enquiries.",
    links: ["/web-design-hucknall", "/web-development-nottingham"],
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
    outcome: "Search pages that qualify demand instead of publishing thin filler.",
    links: ["/web-design-hucknall", "/next-js-agency-uk"],
  },
  {
    journey: "local-growth" as const,
    title: "Digital Growth Partnership",
    for: "Businesses that want one accountable partner improving search visibility, conversion, content and technology after launch.",
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
    links: ["/custom-systems", "/custom-web-app-development-uk"],
  },
  {
    journey: "local-growth" as const,
    title: "Hosting and maintenance",
    for: "Clients who want production hosting, deployment support, backups, and someone accountable.",
    includes: "VPS or managed deployment, uptime checks, SSL, dependency updates, and incident support.",
    outcome: "Fewer platform surprises and a clear owner for the technical estate.",
    links: ["/pricing"],
  },
]

export const managedBusinessEmailService = {
  title: "Managed Business Email",
  description: "Professional custom-domain email, configured, authenticated and supported by ScaleSmiths. Available standalone or within an agreed managed relationship.",
  href: "/services/managed-business-email",
}

export const businessGrowthAuditService = { title: businessGrowthAudit.shortName, description: "A business-wide assessment of positioning, customer journey, visibility, systems and growth opportunities with a prioritised roadmap.", href: businessGrowthAudit.slug }

export const pricingItems = [
  { name: "One-page business site", range: "Scoped after discovery", priceClaimId: "price.one-page", note: "Focused single-page presence for a clear offer or campaign." },
  { name: "Local business growth site", range: "Scoped after discovery", priceClaimId: "price.foundation", note: "Multi-page local site with conversion and SEO foundations." },
  { name: "E-commerce site", range: "Scoped after discovery", priceClaimId: "price.growth", note: "Commerce UX, product structure, payments, and admin workflows." },
  { name: "Custom web app", range: "Scoped after discovery", priceClaimId: "price.forge", note: "Database-backed product, portal, dashboard, or SaaS surface." },
  { name: "Ongoing care plans", range: "Scoped separately", priceClaimId: "price.care-plan", note: "Maintenance, monitoring, improvements, and retained technical support." },
  { name: "Hosting / maintenance", range: "Scoped to stack", priceClaimId: null, note: "Deployment, SSL, backups, monitoring, and infrastructure support." },
  { name: "Managed Business Email", range: "From £15", priceClaimId: null, note: "Three professional 5GB mailboxes on your domain, with initial setup included." },
  { name: businessGrowthAudit.shortName, range: formatAuditPrice(), priceClaimId: null, note: "One-time business-wide assessment with the full fee credited against an eligible subsequent ScaleSmiths build." },
]

export function buildServiceHubSchema(baseUrl = "https://scalesmiths.co.uk") {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "ScaleSmiths Services",
    url: `${baseUrl}/services`,
    hasPart: [...serviceHubItems.map((item) => ({
      "@type": "Service",
      name: item.title,
      description: item.outcome,
      provider: { "@type": "Organization", name: "ScaleSmiths", url: baseUrl },
    })), {
      "@type": "Service",
      name: managedBusinessEmailService.title,
      description: managedBusinessEmailService.description,
      provider: { "@type": "Organization", name: "ScaleSmiths", url: baseUrl },
    }, {
      "@type": "Service",
      name: businessGrowthAuditService.title,
      description: businessGrowthAuditService.description,
      provider: { "@type": "Organization", name: "ScaleSmiths", url: baseUrl },
    }],
  }
}

export function buildPricingSchema(baseUrl = "https://scalesmiths.co.uk") {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How much does a ScaleSmiths project cost?",
        acceptedAnswer: { "@type": "Answer", text: "Projects are scoped by business outcome and complexity. Any current verified guidance appears in the pricing cards; the final price follows a project-specific proposal." },
      },
      {
        "@type": "Question",
        name: "Do you offer ongoing care plans?",
        acceptedAnswer: { "@type": "Answer", text: "Yes. Care plans can cover maintenance, monitoring, improvements, and retained technical support. Scope and any current verified guidance appear on this page." },
      },
    ],
    url: `${baseUrl}/pricing`,
  }
}
