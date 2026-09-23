export interface Project {
  id: number
  slug: string
  name: string
  type: string
  location: string
  year: string
  tags: string[]
  headline: string
  challenge: string
  solution: string
  outcomeClaimIds: string[]
  features: string[]
  accentColor: string
  gradient: string
  credit: string
  portfolioGroup: "client-work" | "product-platform"
  heroImage?: string
  thumbImage?: string
  /**
   * What the imagery actually shows. `cover-card` images are branded title cards rather than
   * screenshots of the delivered work; replace them with approved screenshots named per
   * docs/content/founder-profiles.md and update this field.
   */
  imageKind?: "screenshot" | "photograph" | "cover-card"
  /** Natural description of the imagery. Defaults to a description derived from `imageKind`. */
  imageAlt?: string
  blurDataURL?: string
  repoUrl?: string
  /** Only a verified, live URL for the delivered work. */
  websiteUrl?: string
  screenshots?: string[]
  /** Who the client is, restricted to facts already stated in this record. */
  client: string
  /** Scope delivered, as short labels for cards. Must be evidenced by `features`/`solution`. */
  services: string[]
  /** Verified problems with the previous site or systems. Omit rather than infer. */
  startingPoint?: string[]
  /** What ScaleSmiths set out to improve and why. Omit until written from real project records. */
  strategy?: string[]
  /**
   * How the solution was actually built: the notable engineering decisions behind it. Descriptive
   * only — never performance, ranking or commercial claims, which belong in verified public
   * claims (see case-study-metrics.ts).
   */
  technicalImplementation?: Array<{ title: string; detail: string }>
  /**
   * Topic-cluster links curated for this project, in the order they should appear. Service hrefs
   * must exist in serviceRouteCatalogue(); insight slugs must be published. Anything omitted
   * falls back to the links derived from service-page proof lists and article references.
   */
  relatedServiceHrefs?: string[]
  relatedInsightSlugs?: string[]
  /** Measured results, each backed by a verified public claim (see case-study-metrics.ts). */
  metrics?: Array<{ key: import("./case-study-metrics").MetricKey; claimId: string }>
  /** Metrics being measured but not yet verified. Rendered as placeholders in development only. */
  awaitingMetrics?: Array<import("./case-study-metrics").MetricKey>
  /** A client quote, published only through a verified, client-approved public claim. */
  quoteClaimId?: string
}

export const projects: Project[] = [
  {
    id: 8,
    slug: "confirm-a-kill",
    client: "An established Nottinghamshire pest-control business serving domestic and commercial customers.",
    services: ["Custom website", "Local SEO architecture", "CRM & operations", "Analytics", "Growth Partnership"],
    name: "Confirm-A-Kill",
    type: "Pest Control Platform",
    location: "Nottinghamshire",
    year: "2026",
    tags: ["Astro", "PostgreSQL", "Local SEO", "CRM", "Analytics", "Conversion UX"],
    headline: "Rebuilding an established Nottinghamshire pest-control business for search, conversion and long-term growth.",
    challenge: "The previous website no longer reflected the quality or operational maturity of the business. Service journeys were fragmented, advice and review content had aged, local coverage was difficult to understand, and a three-month Search Console baseline showed substantial visibility producing very few organic visits.",
    startingPoint: [
      "An ageing WordPress presentation with fragmented service and enquiry journeys",
      "Outdated advice, reviews and incomplete business or legal information",
      "57.9K organic impressions but 192 clicks across the three-month pre-launch baseline",
      "No integrated operating layer connecting enquiries to ongoing customer work",
    ],
    strategy: [
      "Protect the existing search footprint while replacing the public experience: preserve established URLs, make service intent explicit, and create stronger routes between advice, services, local coverage and enquiry.",
      "Treat the website as the public edge of an operating system, with consent-aware measurement and a private workflow for enquiries, customers, properties, quotes, appointments, jobs and commercial service records.",
    ],
    solution: "ScaleSmiths delivered a full custom Astro rebuild rather than a theme reskin. It combines mobile-first service discovery, Nottinghamshire coverage, a searchable advice archive, clear quote journeys, verified trust content, canonical metadata and structured data with a private PostgreSQL-backed CRM and operational workflow. Measurement is in place from launch so the new site can be judged against the recorded pre-launch baseline.",
    outcomeClaimIds: ["project.confirm-a-kill.outcome.live-platform"],
    features: [
      "Mobile-first pest and service selection",
      "Structured domestic and commercial service journeys",
      "Nottinghamshire coverage and internal-link architecture",
      "Searchable advice hub with preserved article URLs",
      "Consent-aware first-party analytics and GA4 integration",
      "Versioned privacy-aware public enquiry flow",
      "Private CRM for customers, properties, quotes, appointments and jobs",
      "Commercial contracts, monitoring and service records",
    ],
    technicalImplementation: [
      { title: "Astro static-first front end", detail: "The public site is a full custom Astro build rather than a theme reskin, so pages ship as static HTML with interactivity added only where a journey needs it." },
      { title: "Preserved URL architecture", detail: "Established service and advice URLs were carried into the new structure, with canonical metadata and structured data applied deliberately across service, coverage and article routes." },
      { title: "PostgreSQL operating layer", detail: "A private, role-controlled CRM holds customers, properties, quotations, appointments, jobs, visits and commercial service records behind the public site." },
      { title: "Consent-aware measurement", detail: "First-party event capture and GA4 integration run behind consent, so post-launch behaviour can be compared with the recorded pre-launch Search Console baseline." },
      { title: "Versioned enquiry flow", detail: "The public enquiry path records the privacy version in force when a submission is made, so consent evidence stays attached to the record." },
    ],
    relatedServiceHrefs: [
      "/website-redesign-nottingham",
      "/local-seo-nottingham",
      "/website-maintenance-nottingham",
      "/seo-website-audit",
    ],
    relatedInsightSlugs: [
      "signs-your-business-website-needs-rebuilding",
      "website-redesign-vs-website-refresh",
      "local-seo-nottingham-businesses-guide",
      "why-your-website-isnt-showing-on-google",
    ],
    accentColor: "#f4cb38",
    gradient: "from-yellow-400/10 to-cyan-500/5",
    imageKind: "screenshot",
    imageAlt: "Confirm-A-Kill mobile-first pest-control website rebuilt by ScaleSmiths",
    credit: "Built and grown by ScaleSmiths",
    portfolioGroup: "client-work",
    websiteUrl: "https://www.confirmakill.co.uk/",
    awaitingMetrics: ["organic-impressions", "organic-clicks", "enquiries", "conversion-rate"],
  },
  {
    id: 7,
    slug: "precision-finish-plastering-rendering",
    client: "A plastering and rendering business in Hucknall, Nottinghamshire, offering internal plastering, external rendering and specialist services across a wide service area.",
    services: ["Website design & build", "Local SEO architecture", "Quote & lead capture", "Project galleries"],
    name: "Precision Finish Plastering & Rendering",
    type: "Local Trades Website",
    location: "Hucknall, Nottinghamshire",
    year: "2026",
    tags: ["Local SEO", "Service Architecture", "Conversion UX", "Project Galleries", "Lead Capture"],
    headline: "A search-led local trades website that turns a wide service area and specialist offer into clear routes to advice, proof, and a quote.",
    challenge: "Precision Finish needed one credible digital home for a broad plastering and rendering offer. Customers had to be able to understand the right service, see relevant work, check local coverage, and ask for useful first advice without navigating a generic trades template.",
    solution: "ScaleSmiths created a structured local growth site around internal plastering, external rendering, specialist services, property types, service areas, project proof, and practical advice. The enquiry journey supports photo uploads and preferred contact methods so the team can qualify work with better context from the first message.",
    outcomeClaimIds: ["project.precision-finish.outcome.live-site"],
    features: [
      "Service and location content architecture",
      "Photo-led quote request journey",
      "Filterable work gallery and project pages",
      "Property-type and advice content hubs",
      "Local trust and review presentation",
      "Responsive, search-ready website",
    ],
    strategy: [
      "Organise a broad plastering and rendering offer around how customers actually search: the specific service, the property type and the area they are in, with a page for each that says something distinct rather than repeating a place name.",
      "Make the first enquiry useful to both sides. A photo-led quote request captures the job context the team needs to qualify work, instead of leaving a phone number as the only route in.",
    ],
    technicalImplementation: [
      { title: "Service and area route architecture", detail: "Separate pages for internal plastering, external rendering and specialist services, plus property-type and service-area routes, each with its own metadata and its own route to a quote." },
      { title: "Photo-led quote capture", detail: "The enquiry journey accepts image uploads and a preferred contact method, so the team receives job context with the first message." },
      { title: "Filterable project gallery", detail: "Completed work is presented as a filterable gallery with individual project pages, so proof is browsable by service rather than buried in one album." },
      { title: "Responsive, search-ready build", detail: "Mobile-first layouts, local trust and review presentation, and an advice hub supporting the service pages." },
    ],
    relatedServiceHrefs: [
      "/web-design-nottingham",
      "/local-seo-nottingham",
      "/web-design-hucknall",
    ],
    relatedInsightSlugs: [
      "local-seo-nottingham-businesses-guide",
      "website-seo-checklist-uk-small-businesses",
      "what-is-local-seo-and-do-you-need-it",
    ],
    accentColor: "#caa46a",
    gradient: "from-amber-500/10 to-stone-500/5",
    heroImage: "/images/projects/precision-finish/hero.webp",
    thumbImage: "/images/projects/precision-finish/thumb.webp",
    imageKind: "photograph",
    imageAlt: "Plastered interior room with finishing trowels, from the Precision Finish Plastering & Rendering website built by ScaleSmiths",
    credit: "Built by ScaleSmiths",
    portfolioGroup: "client-work",
    websiteUrl: "https://precisionplasteringandrendering.co.uk",
  },
  {
    id: 1,
    slug: "glow-tanning",
    websiteUrl: "https://glowtanninghucknall.co.uk",
    client: "A premium tanning salon in Hucknall, Nottinghamshire.",
    services: ["Website design & build", "Booking integration", "Review aggregation", "Admin panel", "Self-hosting"],
    name: "Glow Tanning",
    type: "Local Business",
    location: "Hucknall, Nottinghamshire",
    year: "2025",
    tags: ["Node.js", "Express", "Canvas API", "Sharp", "Nginx", "JWT"],
    headline: "A complete digital presence for a premium tanning salon — animated, integrated, and self-managed.",
    challenge: "Glow Tanning had no meaningful web presence, no way to capture bookings digitally, and reviews scattered across Google and Facebook with no unified display. Their competitors in the area were already ahead online.",
    solution: "Built a full Node.js/Express site with a custom Canvas API animation system for the hero section (animated sun rays), Salon Tracker booking iframe integration, and a review aggregation pipeline configured for Google Places API and Facebook. A Sharp-based WebP image pipeline handles imagery, with a JWT-secured admin panel for content management.",
    outcomeClaimIds: [
      "project.glow-tanning.outcome.bookings-first-week",
      "project.glow-tanning.outcome.review-display",
      "project.glow-tanning.outcome.self-managed",
    ],
    features: [
      "Canvas API sun-ray hero animation",
      "Salon Tracker booking integration",
      "Google Places + Facebook review aggregation",
      "JWT admin panel",
      "Sharp WebP image pipeline",
      "Self-hosted behind Nginx on VPS",
    ],
    strategy: [
      "Give a salon with no meaningful web presence a credible digital home that could be found, trusted and booked from a phone, at a point where local competitors were already established online.",
      "Remove operational drag rather than adding it: bring scattered Google and Facebook reviews into one display, connect booking to the existing Salon Tracker system, and hand content control to the salon instead of creating a permanent dependency.",
    ],
    technicalImplementation: [
      { title: "Node.js and Express application", detail: "A server-rendered Express application, self-hosted behind Nginx on a VPS." },
      { title: "Canvas API hero animation", detail: "The animated sun-ray hero is drawn with the Canvas API rather than assembled from stock video or a heavyweight animation library." },
      { title: "Salon Tracker booking integration", detail: "Booking is embedded from the salon's existing Salon Tracker system, so the website never becomes a second source of truth for availability." },
      { title: "Review aggregation pipeline", detail: "A pipeline configured for the Google Places API and Facebook brings reviews from both sources into a single display." },
      { title: "Sharp image pipeline and admin panel", detail: "Imagery is processed to WebP with Sharp, and a JWT-secured admin panel lets the salon manage its own content." },
    ],
    relatedServiceHrefs: [
      "/web-design-hucknall",
      "/web-development-nottingham",
      "/local-seo-nottingham",
    ],
    relatedInsightSlugs: [
      "what-is-local-seo-and-do-you-need-it",
      "why-scalesmiths-builds-custom-websites",
      "website-hosting-explained",
    ],
    accentColor: "#f59e0b",
    gradient: "from-amber-500/10 to-orange-600/5",
    heroImage: "/images/projects/glow-tanning/hero.jpg",
    thumbImage: "/images/projects/glow-tanning/thumb.jpg",
    imageKind: "cover-card",
    blurDataURL: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAGCAIAAAB1kpiRAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAxUlEQVR4nAG6AEX/AP7Lg//tn//cktmsbKB9S3pfOFdEJVZBIlxFJE06HgD+yYL/5Jf/x4GZdEV6XzVkTChSPR9kTCl3WzN5XDQAm3lIaE8rb1YxlX9bfmdGcVw/alc9SzkeRDEYXUYnADAkFD0sF1xHJ+rVtMq3nNjGp+TRtlpHLjcnFSUcEQAUDAB4aFF1YklWRjJ4aFJaSThfUkJLRT03LB0NAwAAFAgAQjQccVcznn1LyJ1jxJpgn39RZk80NCcbBAAEvVlDxw0IpsIAAAAASUVORK5CYII=",
    credit: "Made by Rhys · ScaleSmiths co-founder",
    portfolioGroup: "client-work",
  },
  {
    id: 2,
    slug: "pinkys-prints",
    client: "A UK e-commerce business selling a personalised product range, previously trading on Shopify.",
    services: ["Custom e-commerce", "Shopify migration", "Product admin", "Self-hosted infrastructure"],
    name: "Pinkys Prints",
    type: "E-Commerce",
    location: "UK",
    year: "2025",
    tags: ["React", "Vite", "PostgreSQL", "Express", "Docker Compose"],
    headline: "A custom e-commerce platform migrated from Shopify into a self-hosted product and admin system.",
    challenge: "Pinkys Prints had outgrown Shopify. The templated design couldn\'t showcase their personalised product range effectively, the admin tools were too generic for their workflow, and hosting costs were climbing with Vercel + Supabase.",
    solution: "A custom React/Vite e-commerce platform with catalogue variants, a mega menu, and an admin panel tailored to the product-management workflow. The stack was migrated from managed cloud services to a self-hosted Docker Compose setup on a VPS.",
    outcomeClaimIds: [
      "project.pinkys-prints.outcome.zero-downtime",
      "project.pinkys-prints.catalogue-size",
      "project.pinkys-prints.outcome.monthly-saving",
    ],
    features: [
      "Product catalogue with variants",
      "Mega menu navigation",
      "Fully custom admin panel",
      "PostgreSQL with Docker Compose",
      "VPS self-hosted",
      "Supabase to self-hosted migration",
    ],
    strategy: [
      "Replace a templated storefront that could not present a personalised product range properly, and admin tooling too generic for the way the business actually works.",
      "Move off managed cloud services whose costs were climbing, onto infrastructure the business controls, without losing the catalogue or the storefront during the move.",
    ],
    technicalImplementation: [
      { title: "React and Vite storefront", detail: "A custom storefront with a product catalogue supporting variants, and mega-menu navigation built for a wide personalised range." },
      { title: "Purpose-built product admin", detail: "An admin panel shaped around the product-management workflow rather than a generic commerce back office." },
      { title: "PostgreSQL on Docker Compose", detail: "The data layer runs on PostgreSQL, with the whole stack deployed through Docker Compose on a VPS." },
      { title: "Platform migration", detail: "Catalogue and storefront were migrated off Shopify, and hosting moved from managed Vercel and Supabase services to the self-hosted stack." },
    ],
    relatedServiceHrefs: [
      "/e-commerce-development-nottingham",
      "/managed-website-hosting",
    ],
    relatedInsightSlugs: [
      "custom-website-vs-wordpress-vs-wix",
      "website-hosting-explained",
      "why-cheap-websites-often-become-expensive",
    ],
    accentColor: "#ec4899",
    gradient: "from-pink-500/10 to-rose-600/5",
    heroImage: "/images/projects/pinkys-prints/hero.jpg",
    thumbImage: "/images/projects/pinkys-prints/thumb.jpg",
    imageKind: "cover-card",
    blurDataURL: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAGCAIAAAB1kpiRAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAxUlEQVR4nAG6AEX/AP+t1f/S///B7N+RtKZqhoJTaV85S1ozRmM5TFEsPgD/qdL/w+//qM+bYHx+TGRnOlBWL0JrQVV7SmF7R2QAoGeBcERYeEtgp36RkWp8hWRzeFhoTyk9RyQ6YjdUADslL0YoOV43S/bO4v/w//TO5e7G31k0TUEhOCoXKwAZDReHZYN+WXhbPFqDXYZiQmNrTW1WQWA8Iz0WBR4AGAcSSSk8dkdjo2aKy4GsyH+qpmmQb0JlOB48DwIeljBOWPR4kQUAAAAASUVORK5CYII=",
    credit: "Made by Rhys · ScaleSmiths co-founder",
    portfolioGroup: "client-work",
  },
  {
    id: 3,
    slug: "csds",
    websiteUrl: "https://csdshome.com",
    client: "A computer repair firm in Pennsylvania, USA.",
    services: ["Website design & build", "Multi-step quote system", "Quote admin panel"],
    name: "CSDS",
    type: "Service Business",
    location: "Pennsylvania, USA",
    year: "2025",
    tags: ["Next.js", "TypeScript", "Tailwind CSS", "PostgreSQL"],
    headline: "An editorial industrial aesthetic for a US computer repair firm that refuses to look like every other repair shop.",
    challenge: "CSDS needed a professional digital presence that reflected the precision and expertise behind their work. The market is saturated with generic \'we fix computers\' templates.",
    solution: "Built a Next.js site with a deliberately editorial, industrial aesthetic — electric red accents on near-black surfaces, bold typography, and a refined UI system. A custom multi-step quote request form captures enquiries and feeds a dedicated admin panel where the owner can manage, respond to, and track all incoming jobs.",
    outcomeClaimIds: [
      "project.csds.outcome.distinctive",
      "project.csds.outcome.less-friction",
      "project.csds.outcome.self-managed",
    ],
    features: [
      "Custom editorial design system",
      "Multi-step quote request form",
      "Separate admin panel for quote management",
      "PostgreSQL quote tracking",
      "TypeScript throughout",
      "Deployed on Vercel",
    ],
    strategy: [
      "Separate a computer repair firm from a market saturated with generic “we fix computers” templates, using design that reflects the precision behind the work.",
      "Turn enquiries into manageable jobs: capture what a repair actually involves up front, and give the owner one place to track and respond to every request.",
    ],
    technicalImplementation: [
      { title: "Next.js and TypeScript build", detail: "A Next.js application written in TypeScript throughout and deployed on Vercel." },
      { title: "Custom editorial design system", detail: "Electric red accents on near-black surfaces with bold typography, designed for this brand rather than adapted from a theme." },
      { title: "Multi-step quote request", detail: "A staged quote form captures device, fault and contact detail progressively instead of presenting one long form." },
      { title: "Quote management admin panel", detail: "A separate admin panel backed by PostgreSQL lets the owner manage, respond to and track every incoming job." },
    ],
    relatedServiceHrefs: [
      "/web-development-nottingham",
      "/next-js-agency-uk",
      "/business-automation-nottingham",
    ],
    relatedInsightSlugs: [
      "what-is-a-web-application",
      "why-scalesmiths-builds-custom-websites",
      "what-should-a-professional-business-website-include",
    ],
    accentColor: "#ef4444",
    gradient: "from-red-500/10 to-orange-600/5",
    heroImage: "/images/projects/csds/hero.jpg",
    thumbImage: "/images/projects/csds/thumb.jpg",
    imageKind: "cover-card",
    blurDataURL: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAGCAIAAAB1kpiRAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAxUlEQVR4nAG6AEX/AP+jn//Fu/+0rdqGgaRlYn1LSVw1NFYvLl4zME8qKgD/oZv/trH+nZmnZ2V5REVlODVgOTZpPzx3RUN3QEIAnWBdbT8+cEE+Yjc2jGNhg19fRCMjSiAkYDM4ADUgIEMlJlUsLWE0NvvY2v/y81w0OEojKj8eJigSHAAYDg+AXWl9V2FrSVV6VGZbOkhzVWVTPk05HSkRABEAFwUFSCcqcD5CmFhcyXh8xHV5m1piaDpGNRooDQATqidBHlONUuYAAAAASUVORK5CYII=",
    credit: "Made by Rhys · ScaleSmiths co-founder",
    portfolioGroup: "client-work",
  },
  {
    id: 4,
    slug: "the-business-circle",
    websiteUrl: "https://thebusinesscircle.net",
    client: "A UK founder community that needed its own membership platform.",
    services: ["SaaS platform", "Subscription billing", "Video integration", "Member management"],
    name: "The Business Circle",
    type: "SaaS Platform",
    location: "UK",
    year: "2025",
    tags: ["Next.js 15", "Auth.js v5", "Stripe", "LiveKit", "PostgreSQL", "Drizzle ORM"],
    headline: "A full production SaaS platform for a UK founder community — real billing, real video, real infrastructure.",
    challenge: "The Business Circle needed a dedicated platform for its founder community. A Slack group wasn\'t enough — they needed tiered memberships, integrated video rooms, member management, and a billing system that could grow.",
    solution: "Built with Next.js, Auth.js multi-role authentication, Stripe subscription billing, and LiveKit video rooms. PostgreSQL with Drizzle ORM handles the data layer, with the stack deployed through Docker Compose on a VPS.",
    outcomeClaimIds: [
      "project.business-circle.outcome.billing-day-one",
      "project.business-circle.outcome.native-video",
      "project.business-circle.outcome.roles",
    ],
    features: [
      "Auth.js v5 with multi-role support",
      "Stripe subscriptions",
      "LiveKit video rooms",
      "PostgreSQL + Drizzle ORM",
      "Member management system",
      "Docker Compose on VPS",
    ],
    strategy: [
      "Give a founder community its own platform rather than continuing inside a chat group: tiered membership, native video and member management under one roof.",
      "Build billing and access control as production concerns from the start, so the community could charge and grow without needing a rebuild first.",
    ],
    technicalImplementation: [
      { title: "Next.js 15 with Auth.js v5", detail: "Multi-role authentication supports the different membership levels and administrative access." },
      { title: "Stripe subscription billing", detail: "Tiered memberships are billed through Stripe subscriptions rather than handled manually." },
      { title: "LiveKit video rooms", detail: "Video is native to the platform rather than a link out to a third-party meeting tool." },
      { title: "PostgreSQL with Drizzle ORM", detail: "The data layer uses Drizzle ORM over PostgreSQL, deployed through Docker Compose on a VPS." },
    ],
    relatedServiceHrefs: [
      "/custom-web-app-development-uk",
      "/next-js-agency-uk",
      "/custom-software-development-uk",
    ],
    relatedInsightSlugs: [
      "what-is-a-web-application",
      "when-does-a-business-need-custom-software",
      "nextjs-vs-wordpress-for-business-websites",
    ],
    accentColor: "#6366f1",
    gradient: "from-violet-500/10 to-indigo-600/5",
    heroImage: "/images/projects/the-business-circle/hero.jpg",
    thumbImage: "/images/projects/the-business-circle/thumb.jpg",
    imageKind: "cover-card",
    blurDataURL: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAGCAIAAAB1kpiRAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAxUlEQVR4nAG6AEX/ALiz/9jQ/8jA/5iU2HJtolZTfjw7XDY2Vjk3WzExTwC1r/3Nxv+lnutkYJVPTnlAP2QyMlI4N1xOS3ZPTX8AbWqbSUhtg4KoeXidcG6OZGN/XV54Y2OCLC1PPDtoACUlOC8vSsbF5+3s//j5/+7t/87P9svL8S4uUg8UNAARERtoappTVYZBQ3BjZZ9HSXdUV4M1OWImKU8GCSYACgoaLjBPT0x+aWajiYXQhoTPbmyuSUl/HyFLAgQmf55PpzTt9pEAAAAASUVORK5CYII=",
    credit: "Made by Trev",
    portfolioGroup: "product-platform",
  },
  {
    id: 5,
    slug: "prymal",
    websiteUrl: "https://prymal.io",
    client: "A multi-agent AI operating system for business execution.",
    services: ["AI SaaS platform", "Workflow orchestration", "Billing & usage", "Admin controls"],
    name: "Prymal",
    type: "AI SaaS Platform",
    location: "UK",
    year: "2026",
    tags: ["React", "Vite", "Hono", "PostgreSQL", "pgvector", "Stripe"],
    headline: "A multi-agent AI operating system for business execution, with specialist agents, memory, workflows, billing, and operator controls.",
    challenge: "Prymal needed to move beyond a simple AI chat interface. The platform had to coordinate specialist agents, ground answers in organisational knowledge, enforce quality checks, and expose billing, usage, governance, and admin controls as real SaaS surfaces.",
    solution: "Built a full-stack AI workspace with a Vite/React frontend, Hono API, PostgreSQL and pgvector data layer, Clerk authentication, Stripe plans, team seats, execution credits, workflow orchestration, LORE knowledge retrieval, WARDEN input scanning, and SENTINEL QA review before risky output reaches users.",
    outcomeClaimIds: [
      "project.prymal.agent-count",
      "project.prymal.outcome.integrated-platform",
      "project.prymal.outcome.production-model",
    ],
    features: [
      "Multi-agent AI workspace",
      "LORE organisational memory",
      "NEXUS workflow orchestration",
      "WARDEN input firewall",
      "SENTINEL QA gate",
      "Stripe seats and credits",
    ],
    strategy: [
      "Move beyond a single AI chat interface to a system that coordinates specialist agents, grounds answers in organisational knowledge, and enforces quality checks before output reaches a user.",
      "Treat billing, usage, governance and admin as real product surfaces rather than concerns deferred until after launch.",
    ],
    technicalImplementation: [
      { title: "Vite and React workspace over a Hono API", detail: "The front end is a Vite and React application; the API layer is built with Hono." },
      { title: "PostgreSQL with pgvector", detail: "LORE organisational memory is backed by pgvector alongside the relational data." },
      { title: "Orchestration and safeguards", detail: "NEXUS orchestrates multi-agent workflows, WARDEN scans input, and SENTINEL applies a QA review gate before risky output is returned." },
      { title: "Commercial and governance surfaces", detail: "Clerk authentication, Stripe plans, team seats and execution credits are part of the product rather than bolted on afterwards." },
    ],
    relatedServiceHrefs: [
      "/custom-software-development-uk",
      "/custom-web-app-development-uk",
    ],
    relatedInsightSlugs: [
      "when-does-a-business-need-custom-software",
      "what-is-a-web-application",
    ],
    accentColor: "#14b8a6",
    gradient: "from-teal-500/10 to-cyan-600/5",
    heroImage: "/images/projects/prymal/hero.jpg",
    thumbImage: "/images/projects/prymal/thumb.jpg",
    imageKind: "cover-card",
    blurDataURL: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAGCAIAAAB1kpiRAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAxUlEQVR4nAG6AEX/AJXa0Lr//K346nq5r1WIgj1pYiJDQB9CPyNJRBs8OACT1s2x/PGT1s1WiYM4ZF4qU00lRkMuVE81YVw5ZWMAUIF9L1ZSMlpULlRPVXdzSGhjGTY1Fzk3Fjk4Jk1PABMpJhk2NRo/PDBXU7bZ18Hl5SlNTxY5PBAyNQAcJAAADA5Mc3pFbnY4XWVGcH4rT1xEaXQrSlgQMDkABxgAAAoKGTk6NV9gUYKDda6tda+vVYaLNV1mDi05AAAW7Iw/N+zrhtQAAAAASUVORK5CYII=",
    credit: "Made by Rhys · ScaleSmiths co-founder",
    portfolioGroup: "product-platform",
    repoUrl: "https://github.com/TheFridey/Prymal",
  },
  {
    id: 6,
    slug: "veteranfinder",
    websiteUrl: "https://veteranfinder.co.uk",
    client: "A veteran reconnection and community platform.",
    services: ["Community platform", "Member & admin apps", "API & realtime services", "Deployment infrastructure"],
    name: "VeteranFinder",
    type: "Community Platform",
    location: "UK",
    year: "2026",
    tags: ["Next.js 15", "NestJS", "Prisma", "PostgreSQL", "Redis", "Playwright"],
    headline: "A veteran reconnection and community platform with public, member, admin, API, realtime, and deployment infrastructure in one monorepo.",
    challenge: "VeteranFinder needed more than a brochure site. The product required a member-facing experience, a dedicated admin console, secure cookie-based authentication, realtime services, content systems, and a deployment path that could support a live community platform.",
    solution: "Built as a production-focused monorepo with a Next.js public/member app, Next.js admin app, NestJS API, Prisma data model, PostgreSQL, Redis-backed services, realtime gateways, CI workflows, Nginx proxying, PM2 runbooks, and container deployment documentation.",
    outcomeClaimIds: [
      "project.veteranfinder.outcome.monorepo",
      "project.veteranfinder.outcome.auth",
      "project.veteranfinder.outcome.deployment",
    ],
    features: [
      "Public and member Next.js app",
      "Dedicated admin console",
      "NestJS API with Prisma",
      "PostgreSQL and Redis",
      "Realtime gateway foundation",
      "CI and deployment runbooks",
    ],
    strategy: [
      "Build a veteran reconnection service as a real product: a member-facing experience, a dedicated administrative console and the services behind them, rather than a brochure site with a contact form.",
      "Make deployment and operations part of delivery, so a live community platform can actually be run and supported instead of handed over as source code.",
    ],
    technicalImplementation: [
      { title: "Monorepo with separate applications", detail: "A Next.js public and member app, a separate Next.js admin console, a NestJS API and shared services live in one production-focused monorepo." },
      { title: "Prisma over PostgreSQL with Redis", detail: "The data model is defined in Prisma over PostgreSQL, with Redis-backed services and realtime gateway foundations." },
      { title: "Secure cookie-based authentication", detail: "Sessions use secure cookies across the member and admin surfaces rather than tokens held in browser storage." },
      { title: "CI and deployment runbooks", detail: "CI workflows, Nginx proxying, PM2 runbooks and container deployment documentation ship alongside the code." },
    ],
    relatedServiceHrefs: [
      "/custom-web-app-development-uk",
      "/custom-software-development-uk",
      "/next-js-agency-uk",
    ],
    relatedInsightSlugs: [
      "what-is-a-web-application",
      "when-does-a-business-need-custom-software",
    ],
    accentColor: "#22d3ee",
    gradient: "from-cyan-400/10 to-amber-200/5",
    heroImage: "/images/projects/veteranfinder/hero.jpg",
    thumbImage: "/images/projects/veteranfinder/thumb.jpg",
    imageKind: "cover-card",
    blurDataURL: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAGCAIAAAB1kpiRAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAxUlEQVR4nAG6AEX/AJqq9LfH/6S0/3yJzVtpm0JNdi05WCQwUCc1VRwoSACUpvCsvf+RoexKV4s7SHIpNlsgLEsxPWA5R3A5RnYAV2SUMT1gPktxdoKlX2qKZW+LWGF+IixMFSFCKDRfAB0lNxkkQTI9X+/9/+v3/+/9/+Lu/yo3XBAeQQgXNAAKDxxebJlPXI00QW5ZZp8zQW9HVYA7SHAYJUoABSQAAAYYGydHOEVzU1+cbnfCcHjEWmamOER5EiBJAAEjv/BF0IdbfaYAAAAASUVORK5CYII=",
    credit: "Made by Rhys · ScaleSmiths co-founder",
    portfolioGroup: "product-platform",
    repoUrl: "https://github.com/TheFridey/VF",
  },
]

export function projectImageAlt(project: Project): string {
  if (project.imageAlt) return project.imageAlt
  return project.imageKind === "screenshot"
    ? `${project.name} ${project.type.toLowerCase()} designed and developed by ScaleSmiths`
    : `${project.name} case study cover: ${project.type.toLowerCase()} work by ScaleSmiths`
}

export interface Service {
  tier: string
  range: string
  pitch: string
  features: string[]
  icon: "globe" | "trending-up" | "layers"
  featured?: boolean
  priceClaimId: string
}

export const services: Service[] = [
  {
    tier: "Foundation",
    range: "Scoped after discovery",
    pitch: "A purposeful website with a clear route from visitor questions to an enquiry.",
    features: ["Multi-page information architecture", "Custom design", "On-page SEO", "Core Web Vitals optimisation", "Mobile-first build"],
    icon: "globe",
    priceClaimId: "price.foundation",
  },
  {
    tier: "Growth",
    range: "Scoped after discovery",
    pitch: "E-commerce, bookings, integrations. For businesses ready to make digital a real revenue channel — not just a brochure.",
    features: ["E-commerce / bookings", "Custom integrations", "CMS setup", "Analytics + conversion", "Priority support"],
    icon: "trending-up",
    featured: true,
    priceClaimId: "price.growth",
  },
  {
    tier: "Forge",
    range: "Scoped after discovery",
    pitch: "Full-stack infrastructure. SaaS platforms, multi-system architecture, genuinely complex builds.",
    features: ["Complex architecture", "Multi-system builds", "AI integrations", "Real-time features", "Full partnership"],
    icon: "layers",
    priceClaimId: "price.forge",
  },
]

export type ManagedServiceAvailability = "included" | "available" | "optional"

export const digitalGrowthPartnerships: Array<{ name: string; price: string; priceClaimId: string; desc: string; managedEmail: ManagedServiceAvailability }> = [
  { name: "Maintenance", price: "Scoped separately", priceClaimId: "price.maintenance-retainer", desc: "Hosting, updates, uptime monitoring and minor fixes.", managedEmail: "available" },
  { name: "Growth Partner", price: "Scoped separately", priceClaimId: "price.growth-retainer", desc: "Maintenance plus monthly performance reviews and improvements.", managedEmail: "available" },
  { name: "Ecosystem", price: "Scoped separately", priceClaimId: "price.ecosystem-retainer", desc: "Full ongoing partnership — development, strategy and advisory support.", managedEmail: "available" },
]

export const faqs = [
  {
    q: "What does ScaleSmiths do?",
    a: "ScaleSmiths is a founder-led business growth and engineering company. We identify commercial constraints, build websites, e-commerce platforms, SaaS applications, automation and custom systems, and can remain involved through a Digital Growth Partnership. Based in Hucknall, Nottinghamshire, we work with clients across the UK and internationally.",
  },
  {
    q: "How much does a website cost?",
    a: "Project pricing is scoped from the agreed outcome, complexity, integrations, content and delivery risk. Any current verified guidance appears on the pricing page; an enquiry receives a project-specific estimate.",
  },
  {
    q: "Where is ScaleSmiths based?",
    a: "We\'re based in Hucknall, Nottinghamshire, UK. Projects can be delivered remotely with a communication and review cadence agreed in the project scope.",
  },
  {
    q: "How long does a project take?",
    a: "Delivery timing is confirmed after discovery because content readiness, integrations, review cycles and technical risk materially affect the schedule. The agreed proposal records the delivery range and assumptions.",
  },
  {
    q: "What happens after launch?",
    a: "A Digital Growth Partnership can include maintenance, monitoring, SEO, conversion work, content, automation and roadmap delivery. It is scoped around agreed priorities and can begin with an existing digital estate or continue after a ScaleSmiths build.",
  },
  {
    q: "What is ScaleSmiths Managed Business Email?",
    a: "It is professional custom-domain email configured, authenticated and supported by ScaleSmiths. The standalone starting service is £15 for three 5GB mailboxes with initial setup included.",
  },
  {
    q: "Is managed business email included in a ScaleSmiths plan?",
    a: "Managed Business Email can be part of an agreed Digital Growth Partnership or purchased as a standalone service. Partnership inclusion and requirements are defined in the client proposal rather than inferred from the standalone three-mailbox package.",
  },
]
