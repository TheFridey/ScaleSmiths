import type { Metadata } from "next"
import { faqEntries, type FaqId } from "./faq-library"
import { faqAnchor, faqHubHashFor } from "./faq-knowledge-base"
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
  /** Intent-specific delivery detail. Used for substantive commercial pages, never filler. */
  included?: Array<{ title: string; description: string }>
  process?: Array<{ title: string; description: string }>
  considerations?: Array<{ title: string; paragraphs: string[] }>
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
    faqLibrary: ["cost", "timeline", "project-inputs", "self-editing", "website-ownership", "seo-rebuild", "support"],
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
    included: [{ title: "Positioning and page structure", description: "Services, audiences, local coverage and proof are organised around the questions a buyer needs answered." }, { title: "Responsive custom design", description: "A distinctive interface is designed for the ScaleSmiths build rather than assembled from a generic agency theme." }, { title: "Search foundations", description: "Intentional metadata, canonicals, schema, internal links and indexation controls are built into the route architecture." }, { title: "Enquiry journey", description: "Calls, forms, booking links or quote flows are chosen around the context the business needs from a new enquiry." }],
    process: [{ title: "Discover", description: "Understand the offer, customers, evidence and shortcomings of the current site." }, { title: "Structure", description: "Agree pages, content responsibilities and the route from search or referral to enquiry." }, { title: "Design and build", description: "Create and implement the responsive interface with regular review points." }, { title: "Launch and learn", description: "Verify the production site, connect measurement and agree ownership after launch." }],
    considerations: [{ title: "Cost and timescale", paragraphs: ["Cost follows content, integrations, migration risk and review requirements rather than a fixed page-count package.", "Timing is confirmed after discovery and depends heavily on content readiness and stakeholder availability."] }, { title: "SEO, hosting and ownership", paragraphs: ["Search foundations are part of the build, while ongoing SEO and content work are scoped separately.", "The proposal records code, account and content ownership alongside the hosting and support arrangement."] }],
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
    faqLibrary: ["cost", "timeline", "wordpress", "rebuilds", "seo-in-build", "seo-rebuild", "website-ownership", "self-editing", "project-inputs", "hosting-provided", "outside-nottingham"],
  },
  "web-development-nottingham": {
    slug: "web-development-nottingham",
    title: "Custom Web Development Nottingham",
    metaTitle: "Custom Web Development Nottingham | ScaleSmiths",
    description: "Custom web development for Nottingham businesses: integrations, admin tools, quote workflows, hosting and careful takeovers of existing sites.",
    eyebrow: "Custom web development · Nottingham",
    h1: "Custom web development for Nottingham businesses that need more than a brochure site.",
    intro: "We build the parts of a website that templates struggle with: booking and quote workflows, integrations with the tools you already use, admin areas, databases, and hosting that someone is accountable for.",
    searchIntent: "For Nottingham teams who need a developer for data, integrations, admin workflows or an existing site that has become hard to maintain.",
    location: "Nottingham, Nottinghamshire",
    serviceType: "Web development",
    outcomes: ["Integrations with existing tools", "Admin and workflow tools", "PostgreSQL-backed features", "Hosting and deployment ownership"],
    problems: ["Admin is patched together with spreadsheets, inboxes and duplicate data entry.", "The website needs to connect to real systems instead of acting as a static brochure.", "An existing site has become hard to maintain, deploy or extend.", "The business needs a technical partner who explains trade-offs without hiding behind jargon."],
    examples: ["A multi-step quote form feeding an admin panel where every request can be managed and tracked — the CSDS build.", "Booking and review integrations connected to a self-managed site behind an admin login — the Glow Tanning build.", "An existing site audited, stabilised and moved onto maintainable hosting and deployment before new features are added."],
    included: [{ title: "Technical discovery", description: "The current website, systems, data and integration constraints are inspected before architecture is proposed." }, { title: "Custom front and back end", description: "Responsive interfaces, server behaviour, databases and admin tools are built around the agreed workflow." }, { title: "Integration work", description: "Existing booking, payment, CRM or operational services are connected where their APIs and ownership allow it." }, { title: "Deployment and handover", description: "Production configuration, tests, access and ongoing responsibility are documented." }],
    process: [{ title: "Inspect", description: "Review the business workflow and the systems already in use." }, { title: "Specify", description: "Define roles, data, integrations and acceptance evidence." }, { title: "Implement", description: "Build in reviewable increments with critical behaviour tested." }, { title: "Release", description: "Deploy with monitoring, documentation and an agreed support path." }],
    considerations: [{ title: "Custom development or an existing tool?", paragraphs: ["We reserve custom engineering for requirements that cannot be met sensibly through configuration or integration.", "That keeps budgets focused on workflows that genuinely differentiate or constrain the business."] }, { title: "Security and maintainability", paragraphs: ["Permissions and data ownership are enforced on the server, not left to hidden buttons.", "Dependencies, deployment and operational documentation are treated as part of delivery."] }],
    proofLinks: ["glow-tanning", "csds", "the-business-circle"],
    buildLogLinks: ["admin-dashboard-foundation", "portal-foundation", "security-hardening-pass"],
    relatedPages: ["web-design-nottingham", "custom-web-app-development-uk", "next-js-agency-uk"],
    faqs: [
      { q: "Can you take over an existing web project?", a: "Usually, yes. We start with a code and infrastructure review so the path forward is based on what is actually there." },
      { q: "Do you handle hosting and deployment?", a: "Yes. Published work runs on self-hosted Docker Compose and Nginx setups as well as platform hosting such as Vercel, chosen around the operational needs and budget." },
      { q: "Can you work with an internal team?", a: "Yes. We can take a defined delivery stream, unblock architecture decisions, or build alongside an existing marketing or operations team." },
    ],
    faqLibrary: ["custom-web-development", "integrations", "crm", "internal-admin-systems", "stripe", "wordpress", "code-ownership", "timeline", "support-included"],
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
    included: [{ title: "Commerce discovery", description: "Products, variants, fulfilment, payments, customer journeys and admin work are mapped before a platform decision." }, { title: "Storefront experience", description: "Catalogue, product and checkout-adjacent journeys are designed around how buyers compare and configure the offer." }, { title: "Operations and integrations", description: "Product administration, order handling and connected services are included where the scope requires them." }, { title: "Migration planning", description: "Products, URLs, customer-impacting changes and rollback conditions are identified before cutover." }],
    process: [{ title: "Model the catalogue", description: "Understand products, options, content and operational exceptions." }, { title: "Choose the platform", description: "Confirm whether custom development or an established commerce platform is justified." }, { title: "Build and validate", description: "Implement storefront and admin workflows with payment boundaries tested carefully." }, { title: "Migrate and support", description: "Move controlled data, verify public routes and agree ongoing ownership." }],
    considerations: [{ title: "Payments and security", paragraphs: ["Payment details stay with an appropriate hosted provider; ScaleSmiths does not create a reason to handle card data directly.", "Orders and payment state must rely on verified server-side provider events rather than a browser redirect alone."] }, { title: "Search and platform migration", paragraphs: ["Product and category URLs, metadata and internal links are mapped before migration to reduce avoidable search disruption.", "A custom platform is recommended only when its operational value justifies the additional ownership."] }],
    proofLinks: ["pinkys-prints"],
    buildLogLinks: ["quote-system-hardening", "admin-dashboard-foundation", "scalesmiths-platform-build"],
    relatedPages: ["web-development-nottingham", "custom-web-app-development-uk"],
    faqs: [
      { q: "Can you move us away from Shopify?", a: "Yes, where a custom build is justified. Pinkys Prints moved from Shopify to a custom platform; we plan migrations with validation and rollback requirements defined before cutover." },
      { q: "Do you build custom product management tools?", a: "Yes. Admin workflows are often where custom e-commerce delivers the biggest operational gain." },
      { q: "Do we need a fully custom e-commerce platform?", a: "Not always. We will say when Shopify, WooCommerce or another platform is the better commercial move, and reserve custom work for the parts that genuinely need it." },
    ],
    faqLibrary: ["ecommerce-builds", "stripe", "website-migration", "integrations", "cost", "timeline", "seo-rebuild", "support"],
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
    included: [
      { title: "Architecture and rendering", description: "App Router structure, server and client boundaries, caching decisions, metadata and route behaviour planned around the product rather than copied from a starter." },
      { title: "Application foundations", description: "Authentication, permissions, forms, data access and integrations designed as connected parts of one maintainable system." },
      { title: "Production delivery", description: "Build configuration, environment handling, security headers, monitoring and deployment documentation appropriate to the agreed hosting model." },
      { title: "Existing application work", description: "Focused reviews and implementation for Next.js applications that need performance, accessibility, search or architectural improvements." },
    ],
    process: [
      { title: "Inspect the current estate", description: "For existing products we review routes, dependencies, data boundaries, hosting and known operational pain before recommending changes." },
      { title: "Define the release boundary", description: "We agree the users, workflows, integrations and acceptance evidence needed for a useful first release." },
      { title: "Build and verify", description: "Delivery includes focused tests, production builds and browser checks around the behaviours being introduced." },
      { title: "Operate and improve", description: "Handover, managed hosting or a Digital Growth Partnership is scoped explicitly instead of being implied by the build." },
    ],
    considerations: [
      { title: "Next.js is a means, not the brief", paragraphs: ["We use Next.js when its routing, rendering and application model suit the job. A simpler stack can be the better commercial choice for a small static site.", "For product work, technical decisions are tied to user roles, data ownership, deployment constraints and the team expected to maintain the system."] },
      { title: "Performance and search", paragraphs: ["Server-rendered content, intentional metadata and controlled client JavaScript create a sound base, but the framework alone does not create rankings or conversions.", "We verify important routes in production builds and keep measurement separate from unsupported performance promises."] },
    ],
    proofLinks: ["csds", "the-business-circle", "veteranfinder"],
    buildLogLinks: ["scalesmiths-platform-build", "security-hardening-pass", "seo-aeo-page-architecture"],
    relatedPages: ["custom-web-app-development-uk", "web-development-nottingham"],
    faqs: [
      { q: "Why choose Next.js for a business website?", a: "Next.js gives strong performance, flexible server rendering, clean routing and a path from marketing site to product features in the same codebase. It is not automatically the right choice for every small site." },
      { q: "Do you improve existing Next.js apps?", a: "Yes. We review performance, architecture, search, deployment and security before implementing fixes." },
      { q: "Can you deploy outside Vercel?", a: "Yes. Published Next.js work runs on Docker Compose and VPS infrastructure as well as Vercel, depending on the operational needs and budget." },
    ],
    faqLibrary: ["wordpress", "website-speed", "technical-seo", "custom-web-development", "hosting-provided", "seo-rebuild", "phases", "support"],
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
    faqLibrary: ["customer-portals", "crm", "internal-admin-systems", "custom-software", "integrations", "software-scaling", "code-ownership", "timeline", "support-included"],
  },
  "website-redesign-nottingham": {
    slug: "website-redesign-nottingham", title: "Website Redesign Nottingham", metaTitle: "Website Redesign Nottingham | ScaleSmiths",
    description: "Website redesigns for Nottingham businesses, preserving useful search equity while improving content, accessibility, performance and enquiry journeys.",
    eyebrow: "Website redesign · Nottingham", h1: "Website redesigns that keep what works and repair what does not.",
    intro: "A redesign should solve a business problem, not merely replace one set of colours with another. We audit the current website, protect useful URLs and content, then rebuild the experience around clearer decisions and dependable delivery.",
    searchIntent: "For Nottingham and Nottinghamshire organisations whose website feels dated, performs poorly on mobile, is difficult to update, or no longer reflects the services and systems behind the business.",
    location: "Nottingham, Nottinghamshire", serviceType: "Website redesign",
    outcomes: ["Evidence-led redesign scope", "Existing URL and content map", "Accessible responsive interface", "Measured launch and handover"],
    problems: ["The visual presentation no longer matches the quality of the business.", "Important pages receive search traffic but the enquiry journey around them is weak.", "Mobile visitors struggle with navigation, forms or slow media.", "The existing CMS, theme or codebase makes routine changes risky."],
    examples: ["A complete rebuild of Confirm-A-Kill that preserves established public URLs while reorganising services, advice, local coverage and enquiry journeys.", "A custom digital presence for Glow Tanning, replacing the absence of a useful website with booking, review and content-management workflows.", "A redesign discovery phase that separates content worth preserving from pages, plugins and patterns that no longer serve users."],
    included: [
      { title: "Current-site audit", description: "Routes, content, analytics evidence, search visibility, accessibility, performance, integrations and hosting are inspected before the new information architecture is agreed." },
      { title: "Migration planning", description: "Existing URLs are mapped to retained pages or appropriate redirects. Forms, tracking, schema and third-party connections are treated as migration requirements." },
      { title: "Design and build", description: "The interface is rebuilt using the existing brand where it remains useful, with clearer hierarchy, mobile behaviour and reusable content components." },
      { title: "Launch controls", description: "Production builds, route checks, metadata, redirects and important conversion paths are verified before and after release." },
    ],
    process: [
      { title: "Baseline", description: "Record what exists, what receives attention and what the business cannot afford to lose." },
      { title: "Structure", description: "Agree the services, audiences, proof and conversion paths the redesigned site must support." },
      { title: "Rebuild", description: "Implement the design and content system with staged review rather than a single late reveal." },
      { title: "Migrate", description: "Release with redirects, measurement and a practical ownership or support arrangement." },
    ],
    considerations: [
      { title: "Protecting search visibility", paragraphs: ["No agency can guarantee unchanged rankings after a rebuild. We reduce avoidable risk by preserving useful routes, mapping redirects and carrying forward content with evidence of value.", "Canonical metadata, structured data, internal links and sitemap behaviour are checked as part of the release rather than added afterwards."] },
      { title: "Ownership after launch", paragraphs: ["The proposal states who owns the code, content and accounts, and which third-party services remain necessary.", "Ongoing hosting, maintenance, SEO and conversion work can be handled through a separately scoped Digital Growth Partnership."] },
    ],
    proofLinks: ["confirm-a-kill", "precision-finish-plastering-rendering", "glow-tanning"], buildLogLinks: ["seo-aeo-page-architecture", "scalesmiths-platform-build", "security-hardening-pass"],
    relatedPages: ["web-design-nottingham", "local-seo-nottingham", "website-maintenance-nottingham"],
    localContext: { heading: "Redesign support near Nottingham", paragraphs: ["ScaleSmiths is based in Hucknall and works directly with organisations across Nottinghamshire. Discovery can be remote or in person where examining the existing operation together is useful.", "Local redesign work is grounded in the same questions as national projects: what buyers need, what staff must maintain and what should remain stable during migration."] },
    faqs: [
      { q: "Can you redesign without changing every URL?", a: "Yes. Stable, useful URLs are usually retained. Where a route genuinely needs to change, it is mapped to the closest relevant replacement rather than redirected indiscriminately." },
      { q: "Can you retain our existing brand?", a: "Yes. A website redesign can improve hierarchy, layout and usability without replacing a recognisable identity. Brand changes are recommended only where the brief supports them." },
      { q: "Can the redesign be phased?", a: "Yes. Discovery can identify an essential release and later improvements, especially where integrations or a large content estate increase migration risk." },
    ], faqLibrary: ["rebuilds", "seo-rebuild", "website-migration", "not-on-google", "established-businesses", "cost", "timeline", "support"],
  },
  "local-seo-nottingham": {
    slug: "local-seo-nottingham", title: "Local SEO Nottingham", metaTitle: "Local SEO Nottingham for Service Businesses | ScaleSmiths",
    description: "Local SEO for Nottingham service businesses: technical fixes, service and location architecture, useful content, measurement and conversion improvements.",
    eyebrow: "Local SEO · Nottingham", h1: "Local SEO built around how Nottingham customers actually choose.",
    intro: "Local search work should make a business easier to understand and contact. We connect technical SEO, service content, genuine location context, proof and conversion paths instead of publishing copied town pages.",
    searchIntent: "For Nottinghamshire service businesses that appear inconsistently in search, have unclear service coverage, or receive traffic that does not turn into well-qualified calls, bookings or quote requests.",
    location: "Nottingham, Nottinghamshire", serviceType: "Local search engine optimisation",
    outcomes: ["Clear service architecture", "Genuine local relevance", "Technical indexation controls", "Measurement tied to enquiries"],
    problems: ["Several services compete on one generic page.", "Location pages repeat town names without useful local information.", "Search Console, analytics and enquiry data are not being read together.", "Technical faults, weak internal links or an old theme make good content difficult to discover."],
    examples: ["Service, property, advice and location routes for Precision Finish, connected to project proof and a photo-led quote journey.", "A preserved advice archive and Nottinghamshire coverage structure for Confirm-A-Kill, with measurement established from launch.", "A focused local audit that identifies whether the priority is technical repair, service content, trust evidence or conversion work."],
    included: [
      { title: "Technical review", description: "Indexation, canonicals, sitemap, robots, metadata, schema, mobile rendering, speed and internal linking are checked against real public routes." },
      { title: "Service and location structure", description: "We separate genuine service intents and add location pages only where the business can provide distinct coverage, proof or buying information." },
      { title: "Content and proof", description: "Existing expertise, projects, FAQs and customer decision points are organised into useful pages without invented claims or padded copy." },
      { title: "Measurement", description: "Search visibility, landing-page behaviour and meaningful enquiry actions are configured so priorities can follow evidence." },
    ],
    process: [{ title: "Audit", description: "Inspect search, website and conversion evidence." }, { title: "Prioritise", description: "Choose technical, content and conversion work by likely business value and dependency." }, { title: "Implement", description: "Make changes in controlled releases with route and metadata checks." }, { title: "Review", description: "Use Search Console, analytics and enquiry quality to set the next priority." }],
    considerations: [{ title: "Useful local pages", paragraphs: ["A page earns its place by answering something specific about the service, area, travel, proof or process. We do not create dozens of pages by swapping place names.", "Nottingham work can support wider Nottinghamshire and East Midlands visibility where the service area and content genuinely justify it."] }, { title: "SEO without guarantees", paragraphs: ["Search results depend on competition, demand, reputation and search-engine decisions as well as the website. Rankings are never guaranteed.", "The work creates a technically sound, useful platform and a measurable improvement process."] }],
    proofLinks: ["precision-finish-plastering-rendering", "confirm-a-kill", "glow-tanning"], buildLogLinks: ["seo-aeo-page-architecture", "scalesmiths-platform-build", "quote-system-hardening"], relatedPages: ["web-design-nottingham", "website-redesign-nottingham", "seo-website-audit"],
    localContext: { heading: "Nottinghamshire context without doorway pages", paragraphs: ["ScaleSmiths works from Hucknall with businesses serving Nottingham, Nottinghamshire and surrounding East Midlands areas. That local connection informs discovery, but evidence and useful information still determine what gets published.", "The Nottingham hub connects broad regional demand to specific services. Hucknall content can be more direct about nearby work and the founders' base."] },
    faqs: [{ q: "Do you manage Google Business Profile?", a: "We can review how the profile supports the website and local journey. Any account access, posting or profile-management responsibility is agreed explicitly in scope." }, { q: "Will you create pages for every town we cover?", a: "No. We create a location page only where it can offer distinct, useful information. A clear service-area statement is better than a collection of near-identical pages." }, { q: "How is local SEO measured?", a: "Measurement can include relevant impressions and clicks, landing-page engagement and completed enquiry actions. The useful mix depends on the sales journey and available data." }], faqLibrary: ["what-is-local-seo", "what-is-seo", "seo-timeline", "ranking-guarantees", "not-on-google", "technical-seo", "seo-and-google-ads", "seo-in-build", "seo-ongoing", "seo-rebuild", "outside-nottingham"],
  },
  "website-maintenance-nottingham": {
    slug: "website-maintenance-nottingham", title: "Website Maintenance Nottingham", metaTitle: "Website Maintenance Nottingham | ScaleSmiths",
    description: "Website maintenance for Nottingham businesses: updates, monitoring, fixes, deployment support and an agreed technical ownership boundary.",
    eyebrow: "Website maintenance · Nottingham", h1: "Website maintenance with a clear owner and a defined boundary.",
    intro: "Maintenance is more than installing updates. We agree which website, infrastructure and third-party services are covered, then handle routine care and incidents without leaving ownership ambiguous.",
    searchIntent: "For Nottingham businesses with an important website but no dependable technical owner, or teams that need an existing site assessed before maintenance responsibility can be accepted.",
    location: "Nottingham, Nottinghamshire", serviceType: "Website maintenance",
    outcomes: ["Documented responsibility", "Planned updates and checks", "Incident route", "Improvement backlog"],
    problems: ["Nobody knows who is responsible when the website fails.", "Updates are postponed because there is no safe deployment path.", "Domains, hosting and third-party accounts are spread across former suppliers.", "Small fixes accumulate until the site needs an expensive emergency intervention."],
    examples: ["A technical takeover beginning with code, hosting, dependency and access review before support terms are agreed.", "Managed deployment with SSL, backups and monitoring appropriate to the actual stack.", "A Digital Growth Partnership that separates routine maintenance from prioritised SEO, content or conversion improvements."],
    included: [{ title: "Estate review", description: "We identify the codebase, hosting, domains, analytics, integrations, access holders and current operational risks." }, { title: "Routine maintenance", description: "Agreed updates, dependency care, deployment checks and minor fixes are handled within a written service boundary." }, { title: "Monitoring and response", description: "Availability or error monitoring and an incident contact route are configured where included in scope." }, { title: "Change planning", description: "Larger improvements are recorded and prioritised separately so maintenance does not become an undefined development promise." }],
    process: [{ title: "Inspect", description: "Confirm whether the estate can be responsibly supported." }, { title: "Stabilise", description: "Resolve agreed access, backup, deployment or urgent dependency risks." }, { title: "Document", description: "Record responsibilities, exclusions, cadence and escalation route." }, { title: "Maintain", description: "Run planned care and review the improvement backlog." }],
    considerations: [{ title: "Taking over an existing website", paragraphs: ["We cannot accept responsibility for an unknown system without first inspecting it. The review may identify prerequisite repair work or a platform that needs its original specialist.", "Account ownership and administrator access remain explicit; support should not depend on shared personal logins."] }, { title: "Maintenance versus growth", paragraphs: ["Maintenance protects dependable operation. SEO, content, design changes and new integrations are improvement work and are scoped accordingly.", "Both can sit within a Digital Growth Partnership when the priorities and commercial boundary are clear."] }],
    proofLinks: ["glow-tanning", "csds", "confirm-a-kill"], buildLogLinks: ["security-hardening-pass", "scalesmiths-platform-build", "admin-dashboard-foundation"], relatedPages: ["managed-website-hosting", "website-redesign-nottingham", "next-js-agency-uk"],
    localContext: { heading: "Technical support from Hucknall", paragraphs: ["ScaleSmiths is based near Nottingham and can work directly with local owners while supporting national estates remotely.", "The support model is based on the technology and business risk involved, not a generic maintenance checklist."] },
    faqs: [{ q: "Can you maintain a website you did not build?", a: "Often, after an initial review. We need to understand its code, hosting, access and update path before accepting responsibility." }, { q: "Are content changes included?", a: "Only where the agreement says so. Routine edits, new pages and campaign work can be included or scoped separately depending on the working model." }, { q: "Do you offer emergency-only support?", a: "Emergency recovery may be possible, but ongoing clients with known systems and agreed access take priority. We do not promise response times that have not been contracted." }], faqLibrary: ["support-included", "manage-external-site", "something-breaks", "monitoring", "backups", "hosting-included", "content-updates", "request-priority", "new-features"],
  },
  "custom-software-development-uk": {
    slug: "custom-software-development-uk", title: "Custom Software Development UK", metaTitle: "Custom Software Development UK | ScaleSmiths",
    description: "Custom software for UK businesses: workflow systems, portals, dashboards, integrations and phased products designed around real operations.",
    eyebrow: "Custom software · UK", h1: "Custom software for workflows that standard tools cannot model cleanly.",
    intro: "We design browser-based software around the work a business actually performs: roles, decisions, records, integrations and exceptions. The first release is scoped to prove a useful workflow without pretending every idea belongs in version one.",
    searchIntent: "For UK organisations comparing bespoke software with off-the-shelf products because spreadsheets, disconnected SaaS tools or repeated manual handling are creating operational friction.",
    location: "United Kingdom", serviceType: "Custom software development",
    outcomes: ["Workflow and role model", "Phased product scope", "Secure data boundaries", "Documented operational handover"],
    problems: ["Staff re-enter information across systems that do not share context.", "An off-the-shelf product forces the team into a workflow that does not fit.", "Customers or partners need a secure self-service area.", "A product concept needs a dependable first release and evidence before expansion."],
    examples: ["A membership platform with authentication, subscription billing, video rooms and member administration for The Business Circle.", "A veteran community platform with separate public, member and admin applications backed by shared services.", "A private ScaleSmiths operating platform connecting client requests, documents, invoices and delivery history."],
    included: [{ title: "Workflow discovery", description: "Users, roles, decisions, records, exceptions and current workarounds are mapped before features are committed." }, { title: "Product and data design", description: "The release boundary, permissions, data lifecycle, integrations and operational controls are designed together." }, { title: "Application delivery", description: "Responsive interfaces, server-side behaviour, data storage, tests and deployment are implemented as one product." }, { title: "Release and ownership", description: "Acceptance evidence, environments, accounts, support expectations and future roadmap are documented." }],
    process: [{ title: "Discover", description: "Understand the workflow, cost of the problem and existing systems." }, { title: "Model", description: "Define roles, data, permissions and the smallest useful release." }, { title: "Deliver", description: "Build in demonstrable increments with tests around critical boundaries." }, { title: "Learn", description: "Release, observe real use and prioritise further capability from evidence." }],
    considerations: [{ title: "When custom software is justified", paragraphs: ["Custom work makes sense when the workflow differentiates the business, existing tools create material friction, or integration and ownership needs cannot be met sensibly by configuration.", "If a proven product already meets the requirement, buying and integrating it is often the better decision."] }, { title: "Security and ongoing operation", paragraphs: ["Authentication, permissions, tenant boundaries and sensitive operations are enforced server-side. They are not treated as interface options.", "Hosting, monitoring, backups and ongoing engineering are scoped as operational responsibilities rather than assumed to be free after launch."] }],
    proofLinks: ["the-business-circle", "veteranfinder", "prymal"], buildLogLinks: ["portal-foundation", "admin-dashboard-foundation", "security-hardening-pass"], relatedPages: ["custom-web-app-development-uk", "business-automation-nottingham", "next-js-agency-uk"],
    faqs: [{ q: "How is custom software priced?", a: "After discovery, around the workflows, integrations, risk and release boundary. We provide a written proposal rather than estimating from screen count alone." }, { q: "Who owns the software?", a: "Ownership, licences, third-party services and access are stated in the proposal and contract. We do not leave this to assumption." }, { q: "Can you replace spreadsheets gradually?", a: "Yes. A phased system can begin with the highest-friction workflow and leave stable existing processes in place until replacement is justified." }], faqLibrary: ["custom-software", "crm", "replace-spreadsheets", "software-scaling", "internal-admin-systems", "integrations", "code-ownership", "unfinished-project", "phases", "timeline", "support-included"],
  },
  "business-automation-nottingham": {
    slug: "business-automation-nottingham", title: "Business Automation Nottingham", metaTitle: "Business Automation Nottingham | ScaleSmiths",
    description: "Business automation for Nottingham teams: connect systems, reduce repeated administration and keep permissions, exceptions and human review visible.",
    eyebrow: "Business automation · Nottingham", h1: "Business automation that respects the messy parts of real operations.",
    intro: "Useful automation removes repeated handling while preserving the decisions people still need to make. We map the current workflow, its exceptions and data ownership before connecting systems or introducing AI.",
    searchIntent: "For Nottingham and Nottinghamshire organisations losing time to repeated data entry, inbox hand-offs, spreadsheet tracking or disconnected systems that make routine work difficult to follow.",
    location: "Nottingham, Nottinghamshire", serviceType: "Business process automation",
    outcomes: ["Mapped workflow and exceptions", "Controlled system integrations", "Human review points", "Auditable operational state"],
    problems: ["The same customer information is copied into several tools.", "Work is assigned through inboxes and cannot be seen in one place.", "Reports require manual spreadsheet assembly.", "AI experiments produce impressive demos but have no permissions, review or operating boundary."],
    examples: ["A quote workflow that captures structured information and gives the business an admin queue instead of isolated messages.", "A client portal that connects requests and messages to the correct account rather than relying on email matching.", "An operating workflow that keeps consequential actions behind explicit permissions and human decisions."],
    included: [{ title: "Workflow mapping", description: "Triggers, inputs, owners, decisions, exceptions and downstream effects are recorded before automation is designed." }, { title: "Integration design", description: "APIs, data movement, failure handling and source-of-truth responsibilities are agreed for each connected system." }, { title: "Controlled automation", description: "Automated steps include validation, permissions, retry or escalation behaviour appropriate to their consequence." }, { title: "Operational visibility", description: "Status, errors and review queues are made visible so automation does not become an invisible dependency." }],
    process: [{ title: "Observe", description: "Follow the current process and quantify repeated handling where evidence exists." }, { title: "Choose", description: "Select a bounded workflow with clear ownership and useful success criteria." }, { title: "Connect", description: "Implement integrations and controls around the real source systems." }, { title: "Operate", description: "Monitor failures, review exceptions and expand only where the first workflow is dependable." }],
    considerations: [{ title: "Automation is not always AI", paragraphs: ["Deterministic rules, forms and integrations are often safer and cheaper than adding a language model. AI is used where interpretation is genuinely required.", "High-consequence outputs keep a human review step and a record of what the system proposed or changed."] }, { title: "Data and permissions", paragraphs: ["Automation inherits the sensitivity of the systems it touches. Access, retention and tenant ownership must be designed before convenience.", "We do not bypass provider, budget or security controls to make a workflow appear complete."] }],
    proofLinks: ["csds", "the-business-circle", "veteranfinder"], buildLogLinks: ["admin-dashboard-foundation", "portal-foundation", "security-hardening-pass"], relatedPages: ["custom-software-development-uk", "custom-web-app-development-uk", "web-development-nottingham"],
    localContext: { heading: "Automation discovery for Nottingham teams", paragraphs: ["Being based in Hucknall makes in-person workflow discovery practical for businesses around Nottinghamshire, especially where observing the current hand-offs is more useful than discussing them abstractly.", "National delivery remains available when the systems and stakeholders are distributed."] },
    faqs: [{ q: "Can you automate work between our existing tools?", a: "Often, if the tools expose dependable APIs or export mechanisms. We inspect those capabilities before committing to the integration." }, { q: "Do you build AI automation?", a: "Yes, where AI is appropriate and can operate within explicit review, budget, privacy and failure controls. Many workflows are better served by ordinary software rules." }, { q: "Where should an automation project start?", a: "With one repeated workflow whose owner, inputs, exceptions and useful outcome can be defined. Starting with the broad goal of automating everything usually hides the real decision." }], faqLibrary: ["process-automation", "replace-spreadsheets", "integrations", "internal-admin-systems", "crm", "software-scaling", "phases", "timeline"],
  },
  "seo-website-audit": {
    slug: "seo-website-audit", title: "SEO Website Audit", metaTitle: "Technical SEO Website Audit | ScaleSmiths",
    description: "A practical SEO website audit covering indexation, metadata, internal links, structured data, performance, content structure and conversion paths.",
    eyebrow: "SEO website audit", h1: "An SEO website audit that ends with an implementable priority list.",
    intro: "We inspect the public website, its technical controls, content structure and conversion journey, then separate urgent faults from worthwhile improvements. Findings are tied to affected routes and practical next steps.",
    searchIntent: "For UK businesses that need to understand why important pages are not being discovered, indexed or converted effectively before commissioning a redesign, content programme or ongoing SEO work.",
    location: "United Kingdom", serviceType: "Technical SEO audit",
    outcomes: ["Route-level technical findings", "Content and intent gaps", "Internal-link review", "Prioritised implementation roadmap"],
    problems: ["Search traffic changed and the cause is unclear.", "Metadata, canonicals or sitemaps have grown inconsistent across the site.", "Strong pages are isolated from services, case studies or conversion routes.", "A redesign is planned but nobody has recorded what must be protected."],
    examples: ["An indexability crawl checking status, titles, descriptions, canonicals, H1s, robots directives and structured data.", "A service architecture review that identifies overlapping search targets and missing paths between evidence and enquiry.", "A migration baseline that records public URLs, internal links and search-critical content before a rebuild."],
    included: [{ title: "Crawl and indexation", description: "Important public URLs, response behaviour, canonicals, robots directives and sitemap inclusion are checked programmatically." }, { title: "On-page structure", description: "Titles, descriptions, headings, structured data, content depth and intent alignment are reviewed without scoring pages by keyword repetition." }, { title: "Architecture and links", description: "Service, location, article and proof relationships are mapped to expose orphan pages and competing targets." }, { title: "Prioritised findings", description: "Recommendations identify affected routes, likely impact, dependencies and whether ScaleSmiths or the current supplier can implement them." }],
    process: [{ title: "Define scope", description: "Agree the domain, markets, conversion actions and known changes." }, { title: "Collect evidence", description: "Crawl the site and review available search, analytics and platform information." }, { title: "Diagnose", description: "Separate technical faults, content gaps and measurement limitations." }, { title: "Roadmap", description: "Present a sequenced plan with immediate fixes and larger decisions clearly separated." }],
    considerations: [{ title: "What the audit does not promise", paragraphs: ["An audit does not guarantee rankings and it does not replace implementation. It provides evidence and an order of work.", "Competitor and keyword observations are used to understand search intent, not to justify copied pages or invented local relevance."] }, { title: "Audit or Business Growth Audit?", paragraphs: ["This page describes a focused website and SEO review. The Business Growth Audit is broader, covering positioning, customer journey, systems and growth opportunities beyond search.", "If the website is one symptom of a wider operational question, the broader audit may be the better starting point."] }],
    proofLinks: ["confirm-a-kill", "precision-finish-plastering-rendering", "csds"], buildLogLinks: ["seo-aeo-page-architecture", "scalesmiths-platform-build", "quote-system-hardening"], relatedPages: ["local-seo-nottingham", "website-redesign-nottingham", "web-design-nottingham"],
    faqs: [{ q: "Do you need access to Search Console?", a: "An initial public-site audit can proceed without it, but Search Console evidence makes indexation, query and migration analysis more useful where access can be provided safely." }, { q: "Will you implement the findings?", a: "Implementation can be scoped separately or handled through a Digital Growth Partnership. The audit remains useful if an internal team or another supplier performs the work." }, { q: "Is this the same as an automated SEO score?", a: "No. Automated checks support the crawl, but findings are interpreted against the site's actual routes, audience, evidence and conversion journey." }], faqLibrary: ["not-on-google", "seo-existing-site", "technical-seo", "website-speed", "ranking-guarantees", "seo-timeline", "internal-team", "seo-rebuild", "rebuilds"],
  },
  "managed-website-hosting": {
    slug: "managed-website-hosting", title: "Managed Website Hosting", metaTitle: "Managed Website Hosting UK | ScaleSmiths",
    description: "Managed website hosting with deployment, SSL, backups, monitoring and technical support scoped around the website and its operational needs.",
    eyebrow: "Managed website hosting", h1: "Managed hosting with responsibility attached.",
    intro: "Hosting matters when somebody is accountable for deployment, updates, backups and incidents. We choose and manage infrastructure around the website's technology, traffic and operational risk rather than selling an anonymous storage allowance.",
    searchIntent: "For UK businesses that want a technical partner to take defined responsibility for website hosting and deployment, including existing sites that first need an infrastructure review.",
    location: "United Kingdom", serviceType: "Managed website hosting",
    outcomes: ["Documented hosting ownership", "Controlled deployment path", "SSL, backup and monitoring scope", "Technical support route"],
    problems: ["Hosting belongs to a former supplier or an unknown personal account.", "Deployments are manual and nobody is confident a rollback would work.", "Backups exist in theory but restoration has not been considered.", "The website spans hosting, domains and services with no single operational view."],
    examples: ["Docker Compose and Nginx deployment for applications that need a controlled VPS environment.", "Platform hosting such as Vercel where managed build and delivery features suit the project.", "A takeover review that documents domains, DNS, certificates, environment configuration and external dependencies before migration."],
    included: [{ title: "Hosting assessment", description: "Technology, traffic, data, deployment, domains and connected services are reviewed before a hosting model is recommended." }, { title: "Deployment and SSL", description: "The release path and certificate handling are configured and documented for the agreed environment." }, { title: "Backups and monitoring", description: "Availability checks and backup responsibilities are defined according to the application and data involved." }, { title: "Support boundary", description: "Covered incidents, routine maintenance, exclusions and escalation routes are recorded rather than implied." }],
    process: [{ title: "Inventory", description: "Identify the complete public and operational estate." }, { title: "Plan", description: "Choose hosting and migration controls around the actual workload." }, { title: "Move or configure", description: "Establish deployment, DNS, certificates and agreed monitoring." }, { title: "Manage", description: "Operate the defined service and review changes that alter its risk." }],
    considerations: [{ title: "The right hosting model", paragraphs: ["ScaleSmiths uses self-hosted VPS infrastructure and managed platforms where each is appropriate. One platform is not forced onto every project.", "Applications with databases, background work or private admin surfaces need different operational planning from a static marketing site."] }, { title: "Domains, email and ownership", paragraphs: ["Domain registration, DNS, website hosting and business email are separate responsibilities even when one partner helps manage them.", "Managed Business Email is available as its own service; account ownership and access are documented so the business is not trapped by ambiguity."] }],
    proofLinks: ["glow-tanning", "pinkys-prints", "the-business-circle"], buildLogLinks: ["scalesmiths-platform-build", "security-hardening-pass", "admin-dashboard-foundation"], relatedPages: ["website-maintenance-nottingham", "next-js-agency-uk", "custom-web-app-development-uk"],
    faqs: [{ q: "Can you host an existing website?", a: "Often, after a technical review. The current code, licence terms, data, deployment process and connected services must be understood before migration." }, { q: "Do you only use your own servers?", a: "No. Published work uses both VPS-based Docker deployments and managed platforms such as Vercel. The choice follows the workload and support model." }, { q: "Is business email included with hosting?", a: "Not automatically. Managed Business Email is available separately, and any combined arrangement is written into the agreement." }], faqLibrary: ["hosting-provided", "hosting-location", "ssl", "backups", "monitoring", "dns", "domains", "hosting-included", "manage-external-site"],
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

/**
 * The page's own questions first, then the shared knowledge-base answers relevant to its intent.
 * Library answers carry their /faq anchor so a reader can link to, or keep reading, the full set.
 */
export function getLandingPageFaqs(page: LandingPage): Array<{ q: string; a: string; anchor?: string }> {
  const seen = new Set<string>()
  const shared: Array<{ q: string; a: string; anchor?: string }> = page.faqLibrary.map((id) => ({ q: faqEntries[id].q, a: faqEntries[id].a, anchor: faqAnchor(id) }))
  const all: Array<{ q: string; a: string; anchor?: string }> = [...page.faqs, ...shared]
  return all.filter((faq) => {
    if (seen.has(faq.q)) return false
    seen.add(faq.q)
    return true
  }).map(({ q, a, anchor }) => ({ q, a, ...(anchor ? { anchor } : {}) }))
}

/** Which /faq category this page's shared questions mostly belong to. */
export function landingPageFaqHubHash(page: LandingPage): string | undefined {
  return faqHubHashFor(page.faqLibrary)
}

export function metadataForLandingPage(page: LandingPage): Metadata {
  return buildPageMetadata({ title: page.title, absoluteTitle: page.metaTitle, description: page.description, path: `/${page.slug}` })
}
