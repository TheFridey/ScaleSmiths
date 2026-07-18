import type { Metadata } from "next"

export interface LandingPage {
  slug: string
  title: string
  metaTitle: string
  description: string
  eyebrow: string
  h1: string
  intro: string
  searchIntent: string
  location: string
  serviceType: string
  outcomes: string[]
  problems: string[]
  examples: string[]
  proofLinks: string[]
  buildLogLinks: string[]
  relatedPages: string[]
  faqs: Array<{ q: string; a: string }>
}

export const landingPages: Record<string, LandingPage> = {
  "web-design-hucknall": {
    slug: "web-design-hucknall",
    title: "Web Design Hucknall",
    metaTitle: "Web Design Hucknall | ScaleSmiths",
    description: "Purposeful web design in Hucknall for businesses that need a sharp, conversion-focused website.",
    eyebrow: "Local web design",
    h1: "Web design Hucknall businesses can build growth on.",
    intro: "ScaleSmiths designs and builds custom websites for Hucknall businesses that need more than a generic template: credibility, enquiries, speed, and a site they can keep improving.",
    searchIntent: "For Hucknall businesses comparing local web designers because the current site is slow, dated, thin on trust, or not turning visitors into qualified enquiries.",
    location: "Hucknall, Nottinghamshire",
    serviceType: "Web design",
    outcomes: ["Clear local positioning", "Mobile-first UX", "SEO foundations", "Fast launch path"],
    problems: ["The site looks dated compared with the service quality.", "Local buyers cannot quickly see who you help, where you work, or why to trust you.", "Enquiries arrive with too little context or go to the wrong channel.", "The business has outgrown a page builder but does not need a bloated agency process."],
    examples: ["A service business website with local landing pages, quote CTA, project gallery, and trust signals.", "A salon or studio redesign with mobile-first booking routes and before/after proof.", "A professional services site with sharper positioning, FAQs, lead qualification, and analytics-ready events."],
    proofLinks: ["glow-tanning", "csds"],
    buildLogLinks: ["seo-aeo-page-architecture", "quote-system-hardening", "scalesmiths-platform-build"],
    relatedPages: ["web-development-nottingham", "e-commerce-development-nottingham"],
    faqs: [
      { q: "Do you work with Hucknall businesses in person?", a: "Yes. We are based in Hucknall and can combine local discovery with remote delivery and a review cadence agreed in the project scope." },
      { q: "How much does web design in Hucknall cost?", a: "Pricing depends on scope, content, integrations and delivery risk. Current verified guidance is maintained on the pricing page, followed by a project-specific proposal." },
      { q: "Can you redesign an existing local business website?", a: "Yes. We audit the current site, identify conversion and SEO gaps, then rebuild around the outcomes the business needs." },
      { q: "Will the site be built for local SEO?", a: "Yes. We structure pages, metadata, headings, schema, internal links, and buyer FAQs around real local search intent rather than repeating place names." },
    ],
  },
  "web-development-nottingham": {
    slug: "web-development-nottingham",
    title: "Web Development Nottingham",
    metaTitle: "Web Development Nottingham | ScaleSmiths",
    description: "Strategy-led web development in Nottingham for websites, portals, integrations, and custom digital systems.",
    eyebrow: "Nottingham development",
    h1: "Web development Nottingham businesses can trust with the serious parts.",
    intro: "We build fast public sites, admin tools, integrations, and digital infrastructure for Nottinghamshire businesses that need dependable engineering and a commercial eye.",
    searchIntent: "For Nottingham teams who need a developer to build the parts that templates cannot handle: data, auth, integrations, admin workflows, and production deployment.",
    location: "Nottingham, Nottinghamshire",
    serviceType: "Web development",
    outcomes: ["Custom frontend and backend", "PostgreSQL data systems", "Admin workflows", "Deployment and hosting support"],
    problems: ["Manual admin is being patched together with spreadsheets, inboxes, and duplicate data entry.", "The website needs to connect to real systems instead of acting as a static brochure.", "An existing app or site has become hard to maintain, deploy, or extend.", "The business needs a technical partner who can explain tradeoffs without hiding behind jargon."],
    examples: ["A Next.js site with a protected admin area, PostgreSQL records, and clean deployment scripts.", "A quote or booking workflow that captures structured buyer data and routes it to the right team.", "A client portal or dashboard that replaces repeated manual follow-up."],
    proofLinks: ["glow-tanning", "the-business-circle"],
    buildLogLinks: ["admin-dashboard-foundation", "portal-foundation", "security-hardening-pass"],
    relatedPages: ["web-design-hucknall", "custom-web-app-development-uk", "next-js-agency-uk"],
    faqs: [
      { q: "Do you only build marketing websites?", a: "No. We build websites, dashboards, portals, e-commerce systems, and custom web applications." },
      { q: "Can you take over an existing Nottingham web project?", a: "Usually, yes. We start with a code and infrastructure audit so we can give a realistic path forward." },
      { q: "Do you handle hosting and deployment?", a: "Yes. We can deploy to VPS, Docker Compose, Vercel-style platforms, or a setup that fits your operations." },
      { q: "Can you work with an internal team?", a: "Yes. We can handle a defined delivery stream, unblock architecture decisions, or build alongside an existing marketing or operations team." },
    ],
  },
  "e-commerce-development-nottingham": {
    slug: "e-commerce-development-nottingham",
    title: "E-Commerce Development Nottingham",
    metaTitle: "E-Commerce Development Nottingham | ScaleSmiths",
    description: "Custom e-commerce development for Nottingham businesses that need better product UX, admin workflows, and ownership.",
    eyebrow: "E-commerce",
    h1: "E-commerce development Nottingham brands can grow into.",
    intro: "From Shopify alternatives to fully custom catalogues, we build commerce platforms around real product workflows, margins, fulfilment, and customer experience.",
    searchIntent: "For Nottingham brands whose product experience, fulfilment process, or admin workload has become too specific for a generic storefront setup.",
    location: "Nottingham, Nottinghamshire",
    serviceType: "E-commerce development",
    outcomes: ["Custom catalogue UX", "Variant and product management", "Checkout and payment strategy", "Lower platform friction"],
    problems: ["Product options or bundles are difficult to sell clearly in an off-the-shelf theme.", "Admin work around orders, variants, or fulfilment is taking too much time.", "The checkout route needs clearer trust, fewer distractions, or better payment integration.", "The business needs ownership of the customer experience without overbuilding phase one."],
    examples: ["A custom catalogue with clearer product journeys, filters, and conversion-focused product pages.", "A product management admin flow for complex variants, personalised items, or made-to-order products.", "A commerce rebuild that keeps the public experience fast while improving the back-office workflow."],
    proofLinks: ["pinkys-prints", "prymal"],
    buildLogLinks: ["quote-system-hardening", "admin-dashboard-foundation", "scalesmiths-platform-build"],
    relatedPages: ["web-development-nottingham", "custom-web-app-development-uk"],
    faqs: [
      { q: "Can you move us away from Shopify?", a: "Yes. We can assess whether a custom build is justified and plan a controlled migration with rollback and validation requirements defined before cutover." },
      { q: "Do you build custom product management tools?", a: "Yes. Admin workflows are often where custom e-commerce delivers the biggest operational gain." },
      { q: "Can you integrate payments and fulfilment?", a: "Yes. We plan payment, order, email, and fulfilment integrations as part of the commerce architecture." },
      { q: "Do we need a fully custom e-commerce platform?", a: "Not always. We will say when Shopify, WooCommerce, or another platform is the better commercial move, and reserve custom work for the parts that genuinely need it." },
    ],
  },
  "next-js-agency-uk": {
    slug: "next-js-agency-uk",
    title: "Next.js Agency UK",
    metaTitle: "Next.js Agency UK | ScaleSmiths",
    description: "A UK Next.js agency for fast websites, SaaS platforms, portals, and production-ready digital products.",
    eyebrow: "Next.js agency",
    h1: "A Next.js agency for UK teams building past the template stage.",
    intro: "ScaleSmiths uses Next.js where speed, SEO, routing, server rendering, and product-grade interfaces matter. We pair it with practical databases, auth, billing, and deployment.",
    searchIntent: "For UK teams choosing Next.js because the project needs fast pages, reliable routing, structured data, authenticated areas, and a route from website to product.",
    location: "United Kingdom",
    serviceType: "Next.js development",
    outcomes: ["App Router architecture", "SEO-ready rendering", "Auth and billing integrations", "Production deployment"],
    problems: ["The team needs SEO performance and app-like workflows in the same codebase.", "A previous build relies on fragile client-side logic or unclear deployment steps.", "Auth, forms, data, and admin views need to be designed as one system.", "The project needs careful CSP, cookie, and build behavior before it can be trusted in production."],
    examples: ["A Next.js App Router site with service pages, structured data, and a protected client portal.", "A SaaS-style MVP with auth, database models, admin visibility, and staged rollout.", "A production hardening pass for an existing Next.js app covering headers, env hygiene, and deterministic builds."],
    proofLinks: ["csds", "the-business-circle", "veteranfinder"],
    buildLogLinks: ["scalesmiths-platform-build", "security-hardening-pass", "seo-aeo-page-architecture"],
    relatedPages: ["custom-web-app-development-uk", "web-development-nottingham"],
    faqs: [
      { q: "Why choose Next.js for a business website?", a: "Next.js gives strong performance, flexible rendering, clean routing, and a path from marketing site to full product surface." },
      { q: "Can you build SaaS products in Next.js?", a: "Yes. We use Next.js with databases, auth, billing, admin tools, and APIs depending on the product shape." },
      { q: "Do you improve existing Next.js apps?", a: "Yes. We can audit performance, architecture, SEO, deployment, and security before implementing fixes." },
      { q: "Can you deploy outside Vercel?", a: "Yes. We can use Docker, VPS infrastructure, or platform hosting depending on the app's operational needs and budget." },
    ],
  },
  "custom-web-app-development-uk": {
    slug: "custom-web-app-development-uk",
    title: "Custom Web App Development UK",
    metaTitle: "Custom Web App Development UK | ScaleSmiths",
    description: "Custom web app development for UK businesses needing portals, SaaS platforms, dashboards, and operational systems.",
    eyebrow: "Custom web apps",
    h1: "Custom web app development for UK businesses with moving parts.",
    intro: "When off-the-shelf software bends the business out of shape, we design and build focused web apps that match the workflow: portals, dashboards, SaaS tools, and internal systems.",
    searchIntent: "For UK businesses where a browser-based system could replace manual operations, disconnected tools, or a workflow that standard SaaS cannot model cleanly.",
    location: "United Kingdom",
    serviceType: "Custom web app development",
    outcomes: ["Workflow-specific UX", "Database-backed features", "Secure user roles", "Long-term product roadmap"],
    problems: ["The team is re-entering the same information across several tools.", "Customers, clients, or staff need a secure place to complete repeat tasks.", "Reporting is delayed because the data lives in too many places.", "A product idea needs a scoped MVP before major investment."],
    examples: ["A client portal with secure login, account-specific content, and support routes.", "An internal dashboard for leads, clients, statuses, and operational follow-up.", "A phased SaaS MVP with core workflows first and billing, analytics, or automation added when proven."],
    proofLinks: ["the-business-circle", "prymal", "veteranfinder"],
    buildLogLinks: ["portal-foundation", "admin-dashboard-foundation", "quote-system-hardening"],
    relatedPages: ["next-js-agency-uk", "web-development-nottingham", "e-commerce-development-nottingham"],
    faqs: [
      { q: "What counts as a custom web app?", a: "Client portals, dashboards, SaaS platforms, internal systems, booking tools, and any browser-based workflow software built around your process." },
      { q: "How do you scope complex web apps?", a: "We start with discovery, define core workflows and roles, then split the build into phases that reduce risk." },
      { q: "Can you maintain the app after launch?", a: "Yes. Optional post-launch support can cover maintenance, improvements, monitoring and roadmap delivery." },
      { q: "Can you start with an MVP?", a: "Yes. We define the smallest useful product surface, prove the core workflow, and avoid committing budget to untested extras too early." },
    ],
  },
}

export function buildLandingPageSchemas(page: LandingPage, baseUrl = "https://scalesmiths.co.uk") {
  const url = `${baseUrl}/${page.slug}`
  const isLocal = page.location.includes("Nottingham") || page.location.includes("Hucknall")
  const organization = {
    "@type": "Organization",
    name: "ScaleSmiths",
    url: baseUrl,
  }

  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: page.metaTitle,
      url,
      description: page.description,
      isPartOf: { "@type": "WebSite", name: "ScaleSmiths", url: baseUrl },
      about: page.serviceType,
    },
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: page.title,
      serviceType: page.serviceType,
      provider: organization,
      areaServed: page.location,
      url,
      description: page.description,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: getLandingPageFaqs(page).map((faq) => ({
        "@type": "Question",
        name: faq.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.a,
        },
      })),
    },
    ...(isLocal
      ? [{
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          name: "ScaleSmiths",
          url: baseUrl,
          description: "Strategy-led web development and digital infrastructure agency based in Hucknall, Nottinghamshire.",
          areaServed: page.location,
          address: {
            "@type": "PostalAddress",
            addressLocality: "Hucknall",
            addressRegion: "Nottinghamshire",
            addressCountry: "GB",
          },
        }]
      : []),
  ]
}

export function getLandingPageFaqs(page: LandingPage) {
  return [
    ...page.faqs,
    {
      q: `What makes your ${page.serviceType.toLowerCase()} different from a template builder?`,
      a: "We start with the business goal, buyer journey, and technical requirements, then build the page or system around that. Template builders can be useful for simple presence, but they rarely solve workflow, conversion, SEO structure, or long-term ownership properly.",
    },
    {
      q: "Can this be built in phases?",
      a: "Yes. We usually separate the essential launch scope from later improvements so you can move quickly without pretending every idea belongs in phase one.",
    },
    {
      q: "Do you provide ongoing support after launch?",
      a: "Yes. Care plans cover maintenance, monitoring, improvements, and technical support so the site or app keeps working after the initial build.",
    },
  ]
}

export function metadataForLandingPage(page: LandingPage): Metadata {
  return {
    title: page.metaTitle,
    description: page.description,
    alternates: { canonical: `/${page.slug}` },
    openGraph: {
      title: page.metaTitle,
      description: page.description,
      url: `/${page.slug}`,
      type: "website",
    },
  }
}
