import type { Metadata } from "next"
import { projects, type Project } from "./data"

export type ServiceJourneySlug = "local-growth" | "custom-systems"

export interface ServiceJourney {
  slug: ServiceJourneySlug
  eyebrow: string
  title: string
  description: string
  audience: string[]
  buyerQuestion: string
  outcomesTitle: string
  outcomes: Array<{ title: string; description: string }>
  processTitle: string
  process: Array<{ title: string; description: string }>
  proofSlugs: string[]
  proofIntro: string
  relatedPages: Array<{ href: string; label: string; description: string }>
  primaryCta: { href: string; label: string }
  secondaryCta: { href: string; label: string }
  serviceType: string
  areaServed: string
  accent: "local" | "systems"
}

export const serviceJourneys: Record<ServiceJourneySlug, ServiceJourney> = {
  "local-growth": {
    slug: "local-growth",
    eyebrow: "Local growth",
    title: "Turn local attention into trusted enquiries and bookings.",
    description: "Growth-focused websites, local visibility and ongoing digital improvement for trades, clinics, hospitality businesses and founder-led companies that need to be easier to find, trust and contact.",
    audience: ["Trades and home services", "Clinics and appointment-led teams", "Hospitality and venues", "Founder-led local companies"],
    buyerQuestion: "Do customers quickly understand what you do, where you work, why they should trust you, and how to take the next step?",
    outcomesTitle: "A practical local growth system",
    outcomes: [
      { title: "Trust before contact", description: "Clear services, service areas, proof, business details, and expectations reduce doubt before an enquiry." },
      { title: "Local visibility", description: "Useful service and location architecture gives search engines and buyers clearer context without thin location-page filler." },
      { title: "Enquiries and bookings", description: "Mobile-first calls to action, booking routes, forms, and contact paths make the next step obvious." },
      { title: "Digital Growth Partnership", description: "Where ongoing support makes sense, one roadmap can combine visibility, conversion, content and technical improvement instead of treating maintenance as the finish line." },
    ],
    processTitle: "Find the constraint. Fix the right thing. Keep improving.",
    process: [
      { title: "Find", description: "We examine the customer journey, public pages, local signals, mobile contact routes and the commercial goal before recommending work." },
      { title: "Fix", description: "The answer may be a focused repair, clearer content, a growth website, a better booking route or something more operational." },
      { title: "Measure", description: "Approved work is delivered with analytics foundations and practical post-launch checks so decisions are tied to useful evidence." },
      { title: "Grow", description: "Businesses that want ongoing improvement can move into a Digital Growth Partnership with an agreed roadmap, cadence and scope." },
    ],
    proofSlugs: ["precision-finish-plastering-rendering", "glow-tanning", "csds"],
    proofIntro: "Start with real local proof: a Hucknall trades business and a Hucknall appointment-led business, followed by broader service-sector work. Public outcome claims appear only when separately verified.",
    relatedPages: [
      { href: "/web-design-hucknall", label: "Web design in Hucknall", description: "Local website strategy, design, trust, and enquiry routes." },
      { href: "/web-development-nottingham", label: "Web development in Nottingham", description: "Broader website and workflow development for Nottingham businesses." },
      { href: "/digital-growth-partnership", label: "Digital Growth Partnership", description: "Ongoing search, conversion, content and technical improvement under one accountable roadmap." },
    ],
    primaryCta: { href: "/local-growth-check", label: "Explore the Business Growth Audit" },
    secondaryCta: { href: "/digital-growth-partnership", label: "Explore the Growth Partnership" },
    serviceType: "Local business growth websites and digital growth partnership services",
    areaServed: "Nottinghamshire and the United Kingdom",
    accent: "local",
  },
  "custom-systems": {
    slug: "custom-systems",
    eyebrow: "Custom systems",
    title: "Build the product or operating system your workflow actually needs.",
    description: "Product strategy and engineering for portals, e-commerce, SaaS, AI implementation, automation, integrations, real-time features, and infrastructure with genuine operational complexity.",
    audience: ["SaaS and product founders", "E-commerce operators", "Teams replacing manual workflows", "Organisations connecting complex systems"],
    buyerQuestion: "Where do users, data, permissions, integrations, and operational risk meet—and what is the smallest dependable system that solves it?",
    outcomesTitle: "Engineering around the real constraints",
    outcomes: [
      { title: "Product and portal workflows", description: "Authenticated journeys, role-aware interfaces, billing, admin surfaces, and customer or staff operations." },
      { title: "Commerce and integrations", description: "Product logic, payments, fulfilment, migrations, APIs, and back-office workflows designed as one system." },
      { title: "AI and automation", description: "Controlled AI or deterministic automation with human approval, observability, budgets, and safe failure paths where the risk requires them." },
      { title: "Production infrastructure", description: "Data modelling, real-time services, security boundaries, deployment, monitoring, and rollback planned with the application." },
    ],
    processTitle: "Reduce product risk before expanding scope",
    process: [
      { title: "Model the workflow", description: "We identify actors, permissions, data, integrations, failure states, and the commercial job of the system." },
      { title: "Define the first dependable release", description: "Core workflows are separated from attractive extras so the brief and proposal expose assumptions and delivery risk." },
      { title: "Engineer and validate", description: "Implementation includes the relevant security, accessibility, performance, migration, and operational checks." },
      { title: "Release in controlled stages", description: "Further product work follows evidence, approved priorities, and an explicit roadmap rather than an automatic expansion of scope." },
    ],
    proofSlugs: ["pinkys-prints", "the-business-circle", "prymal", "veteranfinder"],
    proofIntro: "Selected commerce, SaaS, AI, and platform work showing the kinds of systems ScaleSmiths can engineer without inventing customer results.",
    relatedPages: [
      { href: "/custom-web-app-development-uk", label: "Custom web app development", description: "Portals, dashboards, SaaS tools, and operational applications." },
      { href: "/e-commerce-development-nottingham", label: "E-commerce development", description: "Commerce UX, product workflows, payments, admin, and migrations." },
      { href: "/next-js-agency-uk", label: "Next.js engineering", description: "Product-grade Next.js architecture, integrations, and deployment." },
    ],
    primaryCta: { href: "/quote", label: "Start a Project Brief" },
    secondaryCta: { href: "/quote?intent=strategy_call", label: "Request a Strategy Call" },
    serviceType: "Custom software systems and product engineering",
    areaServed: "United Kingdom",
    accent: "systems",
  },
}

export function projectsForJourney(journey: ServiceJourney): Project[] {
  return journey.proofSlugs.map((slug) => {
    const project = projects.find((candidate) => candidate.slug === slug)
    if (!project) throw new Error(`Unknown service-journey proof project: ${slug}`)
    return project
  })
}

export function metadataForServiceJourney(journey: ServiceJourney): Metadata {
  const title = journey.slug === "local-growth"
    ? "Local Business Growth Websites & Support"
    : "Custom Systems, SaaS & AI Engineering"
  return {
    title,
    description: journey.description,
    alternates: { canonical: `/${journey.slug}` },
    openGraph: { title: `${title} | ScaleSmiths`, description: journey.description, url: `/${journey.slug}` },
  }
}

export function buildServiceJourneySchemas(journey: ServiceJourney, siteUrl = "https://scalesmiths.co.uk") {
  const base = siteUrl.replace(/\/$/, "")
  const url = `${base}/${journey.slug}`
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: journey.title,
      description: journey.description,
      url,
      isPartOf: { "@type": "WebSite", name: "ScaleSmiths", url: base },
    },
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: journey.serviceType,
      serviceType: journey.serviceType,
      description: journey.description,
      provider: { "@id": `${base}/#org` },
      areaServed: journey.areaServed,
      url,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: base },
        { "@type": "ListItem", position: 2, name: "Services", item: `${base}/services` },
        { "@type": "ListItem", position: 3, name: journey.eyebrow, item: url },
      ],
    },
  ]
}
