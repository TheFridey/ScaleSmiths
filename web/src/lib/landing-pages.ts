import type { Metadata } from "next"
import { libraryFaqs, type FaqId } from "./faq-library"
import { buildPageMetadata } from "./page-metadata"
import { organizationReference, websiteId } from "./site-identity"

/**
 * Commercial landing pages. Each page owns one search intent (see
 * docs/content/seo-architecture.md) and must say something specific to that intent: evidence,
 * local context, and questions a buyer would really ask. Never create a page by swapping a place
 * or service name into another page's copy.
 */
export interface LandingPage {
  slug: string
  /** Short label used in links and breadcrumbs. */
  title: string
  /** Full document title, written to read naturally in search results (≤ 60 characters). */
  metaTitle: string
  /** Meta description (≤ 160 characters). */
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
  /** Case studies that evidence this page (drives case study → service links too). */
  proofLinks: string[]
  buildLogLinks: string[]
  relatedPages: string[]
  /** Specific, verifiable context for local pages. Omit rather than repeat another page's copy. */
  localContext?: { heading: string; paragraphs: string[] }
  /** Questions specific to this page. */
  faqs: Array<{ q: string; a: string }>
  /** Shared, vetted questions relevant to this page's intent. */
  faqLibrary: FaqId[]
}

export const landingPages: Record<string, LandingPage> = {
  "web-design-hucknall": {
    slug: "web-design-hucknall",
    title: "Web Design Hucknall",
    metaTitle: "Web Design in Hucknall, Nottinghamshire | ScaleSmiths",
    description: "Website design and build from a founder-led team based in Hucknall, with published Hucknall work including Glow Tanning and Precision Finish.",
    eyebrow: "Web design · Hucknall",
    h1: "Web design from a Hucknall team, with local work to show for it.",
    intro: "ScaleSmiths designs and builds custom websites for Hucknall businesses that need more than a generic template: clear services, visible proof, a fast mobile experience and a straightforward route to an enquiry or booking.",
    searchIntent: "For Hucknall businesses comparing local web designers because the current site is dated, slow, thin on trust, or not turning visitors into enquiries.",
    location: "Hucknall, Nottinghamshire",
    serviceType: "Web design",
    outcomes: ["Clear local positioning", "Mobile-first enquiry routes", "Search-ready structure", "A site you can keep improving"],
    problems: ["The site looks dated compared with the quality of the service.", "Local buyers cannot quickly see who you help, where you work, or why to trust you.", "Enquiries arrive with too little context or go to the wrong channel.", "The business has outgrown a page builder but does not need a bloated agency process."],
    examples: ["A salon website with an animated hero, an online booking integration and reviews gathered from Google and Facebook — the Glow Tanning build.", "A trades website with separate service pages, area pages, a filterable project gallery and a photo-led quote request — the Precision Finish build.", "A service business site with sharper positioning, FAQs and enquiry tracking ready for analytics."],
    proofLinks: ["precision-finish-plastering-rendering", "glow-tanning", "csds"],
    buildLogLinks: ["seo-aeo-page-architecture", "quote-system-hardening", "scalesmiths-platform-build"],
    relatedPages: ["web-design-nottingham", "web-development-nottingham"],
    localContext: {
      heading: "Local to Hucknall",
      paragraphs: [
        "ScaleSmiths is based in Hucknall. Its first published project was Glow Tanning, a Hucknall salon that had no meaningful web presence and competitors already ahead of it online. Precision Finish Plastering & Rendering, whose website covers Hucknall, Nottingham and surrounding areas, is also a Hucknall business.",
        "For Hucknall businesses that means discovery can happen face to face, and the people you meet are the founders who plan, design and build the site.",
      ],
    },
    faqs: [
      { q: "Do you work with Hucknall businesses in person?", a: "Yes. We are based in Hucknall and can combine local discovery meetings with remote delivery and a review cadence agreed in the project scope." },
      { q: "Can you redesign an existing local business website?", a: "Yes. We review the current site first, identify conversion and search gaps, then rebuild around the outcomes the business needs." },
      { q: "Will the site be built for local search?", a: "Yes. We structure pages, metadata, headings, schema, internal links and buyer FAQs around the services and areas people actually search for, rather than repeating place names." },
    ],
    faqLibrary: ["cost", "seo-rebuild", "timeline", "support"],
  },
  "web-design-nottingham": {
    slug: "web-design-nottingham",
    title: "Web Design Nottingham",
    metaTitle: "Web Design Nottingham for Service Businesses | ScaleSmiths",
    description: "Custom website design for Nottingham service businesses: clear service and area pages, search-ready structure and enquiry routes, from a Hucknall-based team.",
    eyebrow: "Web design · Nottingham",
    h1: "Websites for Nottingham service businesses that need to be found, trusted and contacted.",
    intro: "ScaleSmiths designs and builds custom websites for businesses across Nottingham and Nottinghamshire. The work starts with how customers choose a provider — the services they search for, the areas you cover and the proof they need to see — and the site is structured around that.",
    searchIntent: "For Nottingham businesses replacing a dated or underperforming website, or moving off a template that can no longer describe their services, coverage and proof properly.",
    location: "Nottingham, Nottinghamshire",
    serviceType: "Web design",
    outcomes: ["Service and area page structure", "Enquiry routes designed for mobile", "Metadata and structured data", "Rebuilds planned around existing rankings"],
    problems: ["Every service is squeezed onto one page, so buyers and search engines cannot tell what you actually specialise in.", "The areas you cover are listed in a footer rather than explained where it matters.", "Proof of the work is buried or missing, so visitors leave to compare competitors.", "A previous rebuild lost pages, links or enquiries and nobody is sure why."],
    examples: ["Separate service pages for each specialism: Precision Finish has individual pages for rendering, skimming, ceiling repairs, damp replastering and more, each with its own route to a quote.", "Area pages that describe the work in each location: Precision Finish covers Nottingham, Bulwell, Basford, Sherwood and other areas with their own pages rather than one page repeating place names.", "A photo-led quote request, so the business receives useful context in the first message instead of a bare phone number."],
    proofLinks: ["precision-finish-plastering-rendering", "glow-tanning"],
    buildLogLinks: ["seo-aeo-page-architecture", "quote-system-hardening", "scalesmiths-platform-build"],
    relatedPages: ["web-design-hucknall", "web-development-nottingham", "e-commerce-development-nottingham"],
    localContext: {
      heading: "Working with Nottingham businesses from Hucknall",
      paragraphs: [
        "ScaleSmiths is run by its two founders from Hucknall, on the northern edge of Nottingham. There is no city-centre office: Nottingham clients work directly with Rhys and Trevor, remotely or in person where that helps discovery.",
        "Nottinghamshire work in the portfolio includes Precision Finish Plastering & Rendering, which serves Nottingham and surrounding areas, and Glow Tanning in Hucknall. Both case studies show the pages, enquiry routes and structure that were built.",
      ],
    },
    faqs: [
      { q: "Is web design different from web development?", a: "On our projects the same founders do both, but the emphasis differs. Web design covers structure, content, proof and the route to an enquiry; web development covers integrations, data, admin tools and hosting. If your project is mostly the second, our web development page for Nottingham is the better starting point." },
      { q: "Can you build pages for the areas we cover?", a: "Yes, where each area page can say something specific, such as the work done there, travel coverage or local projects. We avoid pages that only swap the place name, because they rarely help buyers or rankings." },
    ],
    faqLibrary: ["cost", "rebuilds", "seo-rebuild", "wordpress", "outside-nottingham", "timeline"],
  },
  "web-development-nottingham": {
    slug: "web-development-nottingham",
    title: "Web Development Nottingham",
    metaTitle: "Web Development & Integrations in Nottingham | ScaleSmiths",
    description: "Web development for Nottingham businesses: integrations, admin tools, booking and quote workflows, hosting and takeovers of existing sites.",
    eyebrow: "Web development · Nottingham",
    h1: "Web development for Nottingham businesses that need more than a brochure site.",
    intro: "We build the parts of a website that templates struggle with: booking and quote workflows, integrations with the tools you already use, admin areas, databases, and hosting that someone is accountable for.",
    searchIntent: "For Nottingham teams who need a developer for data, integrations, admin workflows or an existing site that has become hard to maintain.",
    location: "Nottingham, Nottinghamshire",
    serviceType: "Web development",
    outcomes: ["Integrations with existing tools", "Admin and workflow tools", "PostgreSQL-backed features", "Hosting and deployment ownership"],
    problems: ["Admin is patched together with spreadsheets, inboxes and duplicate data entry.", "The website needs to connect to real systems instead of acting as a static brochure.", "An existing site has become hard to maintain, deploy or extend.", "The business needs a technical partner who explains trade-offs without hiding behind jargon."],
    examples: ["A multi-step quote form feeding an admin panel where every request can be managed and tracked — the CSDS build.", "Booking and review integrations connected to a self-managed site behind an admin login — the Glow Tanning build.", "An existing site audited, stabilised and moved onto maintainable hosting and deployment before new features are added."],
    proofLinks: ["glow-tanning", "csds", "the-business-circle"],
    buildLogLinks: ["admin-dashboard-foundation", "portal-foundation", "security-hardening-pass"],
    relatedPages: ["web-design-nottingham", "custom-web-app-development-uk", "next-js-agency-uk"],
    faqs: [
      { q: "Can you take over an existing web project?", a: "Usually, yes. We start with a code and infrastructure review so the path forward is based on what is actually there." },
      { q: "Do you handle hosting and deployment?", a: "Yes. Published work runs on self-hosted Docker Compose and Nginx setups as well as platform hosting such as Vercel, chosen around the operational needs and budget." },
      { q: "Can you work with an internal team?", a: "Yes. We can take a defined delivery stream, unblock architecture decisions, or build alongside an existing marketing or operations team." },
    ],
    faqLibrary: ["integrations", "crm", "wordpress", "timeline", "support-included"],
  },
  "e-commerce-development-nottingham": {
    slug: "e-commerce-development-nottingham",
    title: "E-Commerce Development Nottingham",
    metaTitle: "Custom E-Commerce Development in Nottingham | ScaleSmiths",
    description: "Custom e-commerce development for brands that have outgrown their storefront: product variants, admin workflows, payments and platform migrations.",
    eyebrow: "E-commerce",
    h1: "Custom e-commerce for brands that have outgrown their storefront.",
    intro: "When product options, fulfilment or admin work no longer fit an off-the-shelf theme, we build commerce platforms around the real product workflow, and say plainly when Shopify is still the better choice.",
    searchIntent: "For brands whose product experience, fulfilment process or admin workload has become too specific for a generic storefront setup.",
    location: "Nottingham, Nottinghamshire",
    serviceType: "E-commerce development",
    outcomes: ["Custom catalogue UX", "Variant and product management", "Checkout and payment strategy", "Controlled platform migration"],
    problems: ["Product options or personalisation are difficult to sell clearly in an off-the-shelf theme.", "Admin work around orders, variants or fulfilment is taking too much time.", "Platform and hosting costs keep rising while the tools stay generic.", "The business needs ownership of the customer experience without overbuilding phase one."],
    examples: ["A move from Shopify to a custom React platform with catalogue variants, a mega menu and a product admin built around the workflow — the Pinkys Prints build.", "A product management flow for personalised or made-to-order items.", "A commerce rebuild that keeps the public experience fast while improving back-office work."],
    proofLinks: ["pinkys-prints"],
    buildLogLinks: ["quote-system-hardening", "admin-dashboard-foundation", "scalesmiths-platform-build"],
    relatedPages: ["web-development-nottingham", "custom-web-app-development-uk"],
    faqs: [
      { q: "Can you move us away from Shopify?", a: "Yes, where a custom build is justified. Pinkys Prints moved from Shopify to a custom platform; we plan migrations with validation and rollback requirements defined before cutover." },
      { q: "Do you build custom product management tools?", a: "Yes. Admin workflows are often where custom e-commerce delivers the biggest operational gain." },
      { q: "Do we need a fully custom e-commerce platform?", a: "Not always. We will say when Shopify, WooCommerce or another platform is the better commercial move, and reserve custom work for the parts that genuinely need it." },
    ],
    faqLibrary: ["integrations", "seo-rebuild", "support"],
  },
  "next-js-agency-uk": {
    slug: "next-js-agency-uk",
    title: "Next.js Agency UK",
    metaTitle: "Next.js Development Agency in the UK | ScaleSmiths",
    description: "Next.js development for UK businesses: fast, search-ready websites, SaaS platforms and portals with authentication, billing and production deployment.",
    eyebrow: "Next.js development",
    h1: "Next.js development for UK teams building past the template stage.",
    intro: "ScaleSmiths uses Next.js where speed, search visibility, routing and product-grade interfaces matter, paired with practical databases, authentication, billing and deployment.",
    searchIntent: "For UK teams choosing Next.js because the project needs fast pages, reliable routing, structured data, authenticated areas and a route from website to product.",
    location: "United Kingdom",
    serviceType: "Next.js development",
    outcomes: ["App Router architecture", "Search-ready rendering", "Auth and billing integrations", "Production deployment"],
    problems: ["The team needs search performance and app-like workflows in the same codebase.", "A previous build relies on fragile client-side logic or unclear deployment steps.", "Auth, forms, data and admin views need to be designed as one system.", "The project needs careful security headers, cookie handling and build behaviour before it can be trusted in production."],
    examples: ["An editorial Next.js website with a multi-step quote form and a separate admin panel — the CSDS build.", "A membership platform with Auth.js roles, Stripe subscriptions and LiveKit video rooms — The Business Circle.", "A monorepo with public, member and admin Next.js apps backed by a NestJS API — VeteranFinder."],
    proofLinks: ["csds", "the-business-circle", "veteranfinder"],
    buildLogLinks: ["scalesmiths-platform-build", "security-hardening-pass", "seo-aeo-page-architecture"],
    relatedPages: ["custom-web-app-development-uk", "web-development-nottingham"],
    faqs: [
      { q: "Why choose Next.js for a business website?", a: "Next.js gives strong performance, flexible server rendering, clean routing and a path from marketing site to product features in the same codebase. It is not automatically the right choice for every small site." },
      { q: "Do you improve existing Next.js apps?", a: "Yes. We review performance, architecture, search, deployment and security before implementing fixes." },
      { q: "Can you deploy outside Vercel?", a: "Yes. Published Next.js work runs on Docker Compose and VPS infrastructure as well as Vercel, depending on the operational needs and budget." },
    ],
    faqLibrary: ["wordpress", "seo-rebuild", "phases", "support"],
  },
  "custom-web-app-development-uk": {
    slug: "custom-web-app-development-uk",
    title: "Custom Web App Development UK",
    metaTitle: "Custom Web App & Portal Development in the UK | ScaleSmiths",
    description: "Custom web applications for UK businesses: client portals, dashboards, SaaS platforms and internal systems built around the workflow you actually run.",
    eyebrow: "Custom web apps",
    h1: "Custom web applications for UK businesses with moving parts.",
    intro: "When off-the-shelf software bends the business out of shape, we design and build focused web applications that match the workflow: portals, dashboards, SaaS products and internal systems.",
    searchIntent: "For UK businesses where a browser-based system could replace manual operations, disconnected tools, or a workflow that standard SaaS cannot model cleanly.",
    location: "United Kingdom",
    serviceType: "Custom web app development",
    outcomes: ["Workflow-specific UX", "Database-backed features", "Secure user roles", "A phased product roadmap"],
    problems: ["The team is re-entering the same information across several tools.", "Customers, clients or staff need a secure place to complete repeat tasks.", "Reporting is delayed because the data lives in too many places.", "A product idea needs a scoped first release before major investment."],
    examples: ["A multi-agent AI workspace with organisational memory, workflow orchestration, seats and credits — Prymal.", "A veteran community platform with separate member and admin apps, realtime services and deployment runbooks — VeteranFinder.", "A client portal with secure login, account-specific content, requests and messaging — the ScaleSmiths client portal."],
    proofLinks: ["the-business-circle", "prymal", "veteranfinder"],
    buildLogLinks: ["portal-foundation", "admin-dashboard-foundation", "quote-system-hardening"],
    relatedPages: ["next-js-agency-uk", "web-development-nottingham", "e-commerce-development-nottingham"],
    faqs: [
      { q: "What counts as a custom web app?", a: "Client portals, dashboards, SaaS platforms, internal systems, booking tools and any browser-based workflow software built around your process." },
      { q: "How do you scope complex web apps?", a: "We start with discovery, define the core workflows and roles, then split the build into phases that reduce risk." },
      { q: "Can you start with a minimum viable product?", a: "Yes. We define the smallest useful product, prove the core workflow, and avoid committing budget to untested extras too early." },
    ],
    faqLibrary: ["crm", "integrations", "timeline", "support-included"],
  },
}

export function buildLandingPageSchemas(page: LandingPage, baseUrl = "https://scalesmiths.co.uk") {
  const url = `${baseUrl}/${page.slug}`
  // ScaleSmiths itself (address, founders, service area) is published once by the root layout;
  // page schema references that node rather than declaring a second, conflicting business.
  const organization = organizationReference(baseUrl)

  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: page.metaTitle,
      url,
      description: page.description,
      isPartOf: { "@id": websiteId(baseUrl) },
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
    // FAQPage mirrors the questions rendered visibly on the page. Search engines currently show
    // FAQ rich results only for a narrow set of sites, so this is descriptive markup, not a tactic.
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
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
        { "@type": "ListItem", position: 2, name: "Services", item: `${baseUrl}/services` },
        { "@type": "ListItem", position: 3, name: page.title, item: url },
      ],
    },
  ]
}

export function getLandingPageFaqs(page: LandingPage) {
  const seen = new Set<string>()
  return [...page.faqs, ...libraryFaqs(page.faqLibrary)].filter((faq) => {
    if (seen.has(faq.q)) return false
    seen.add(faq.q)
    return true
  })
}

export function metadataForLandingPage(page: LandingPage): Metadata {
  return buildPageMetadata({ title: page.title, absoluteTitle: page.metaTitle, description: page.description, path: `/${page.slug}` })
}
