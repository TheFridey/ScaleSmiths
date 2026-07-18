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
  heroImage?: string
  thumbImage?: string
  blurDataURL?: string
  repoUrl?: string
  screenshots?: string[]
}

export const projects: Project[] = [
  {
    id: 1,
    slug: "glow-tanning",
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
    accentColor: "#f59e0b",
    gradient: "from-amber-500/10 to-orange-600/5",
    heroImage: "/images/projects/glow-tanning/hero.jpg",
    thumbImage: "/images/projects/glow-tanning/thumb.jpg",
    blurDataURL: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAGCAIAAAB1kpiRAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAxUlEQVR4nAG6AEX/AP7Lg//tn//cktmsbKB9S3pfOFdEJVZBIlxFJE06HgD+yYL/5Jf/x4GZdEV6XzVkTChSPR9kTCl3WzN5XDQAm3lIaE8rb1YxlX9bfmdGcVw/alc9SzkeRDEYXUYnADAkFD0sF1xHJ+rVtMq3nNjGp+TRtlpHLjcnFSUcEQAUDAB4aFF1YklWRjJ4aFJaSThfUkJLRT03LB0NAwAAFAgAQjQccVcznn1LyJ1jxJpgn39RZk80NCcbBAAEvVlDxw0IpsIAAAAASUVORK5CYII=",
    credit: "Made by Rhys · ScaleSmiths co-founder",
  },
  {
    id: 2,
    slug: "pinkys-prints",
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
    accentColor: "#ec4899",
    gradient: "from-pink-500/10 to-rose-600/5",
    heroImage: "/images/projects/pinkys-prints/hero.jpg",
    thumbImage: "/images/projects/pinkys-prints/thumb.jpg",
    blurDataURL: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAGCAIAAAB1kpiRAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAxUlEQVR4nAG6AEX/AP+t1f/S///B7N+RtKZqhoJTaV85S1ozRmM5TFEsPgD/qdL/w+//qM+bYHx+TGRnOlBWL0JrQVV7SmF7R2QAoGeBcERYeEtgp36RkWp8hWRzeFhoTyk9RyQ6YjdUADslL0YoOV43S/bO4v/w//TO5e7G31k0TUEhOCoXKwAZDReHZYN+WXhbPFqDXYZiQmNrTW1WQWA8Iz0WBR4AGAcSSSk8dkdjo2aKy4GsyH+qpmmQb0JlOB48DwIeljBOWPR4kQUAAAAASUVORK5CYII=",
    credit: "Made by Rhys · ScaleSmiths co-founder",
  },
  {
    id: 3,
    slug: "csds",
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
    accentColor: "#ef4444",
    gradient: "from-red-500/10 to-orange-600/5",
    heroImage: "/images/projects/csds/hero.jpg",
    thumbImage: "/images/projects/csds/thumb.jpg",
    blurDataURL: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAGCAIAAAB1kpiRAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAxUlEQVR4nAG6AEX/AP+jn//Fu/+0rdqGgaRlYn1LSVw1NFYvLl4zME8qKgD/oZv/trH+nZmnZ2V5REVlODVgOTZpPzx3RUN3QEIAnWBdbT8+cEE+Yjc2jGNhg19fRCMjSiAkYDM4ADUgIEMlJlUsLWE0NvvY2v/y81w0OEojKj8eJigSHAAYDg+AXWl9V2FrSVV6VGZbOkhzVWVTPk05HSkRABEAFwUFSCcqcD5CmFhcyXh8xHV5m1piaDpGNRooDQATqidBHlONUuYAAAAASUVORK5CYII=",
    credit: "Made by Rhys · ScaleSmiths co-founder",
  },
  {
    id: 4,
    slug: "the-business-circle",
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
    accentColor: "#6366f1",
    gradient: "from-violet-500/10 to-indigo-600/5",
    heroImage: "/images/projects/the-business-circle/hero.jpg",
    thumbImage: "/images/projects/the-business-circle/thumb.jpg",
    blurDataURL: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAGCAIAAAB1kpiRAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAxUlEQVR4nAG6AEX/ALiz/9jQ/8jA/5iU2HJtolZTfjw7XDY2Vjk3WzExTwC1r/3Nxv+lnutkYJVPTnlAP2QyMlI4N1xOS3ZPTX8AbWqbSUhtg4KoeXidcG6OZGN/XV54Y2OCLC1PPDtoACUlOC8vSsbF5+3s//j5/+7t/87P9svL8S4uUg8UNAARERtoappTVYZBQ3BjZZ9HSXdUV4M1OWImKU8GCSYACgoaLjBPT0x+aWajiYXQhoTPbmyuSUl/HyFLAgQmf55PpzTt9pEAAAAASUVORK5CYII=",
    credit: "Made by Trev",
  },
  {
    id: 5,
    slug: "prymal",
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
    accentColor: "#14b8a6",
    gradient: "from-teal-500/10 to-cyan-600/5",
    heroImage: "/images/projects/prymal/hero.jpg",
    thumbImage: "/images/projects/prymal/thumb.jpg",
    blurDataURL: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAGCAIAAAB1kpiRAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAxUlEQVR4nAG6AEX/AJXa0Lr//K346nq5r1WIgj1pYiJDQB9CPyNJRBs8OACT1s2x/PGT1s1WiYM4ZF4qU00lRkMuVE81YVw5ZWMAUIF9L1ZSMlpULlRPVXdzSGhjGTY1Fzk3Fjk4Jk1PABMpJhk2NRo/PDBXU7bZ18Hl5SlNTxY5PBAyNQAcJAAADA5Mc3pFbnY4XWVGcH4rT1xEaXQrSlgQMDkABxgAAAoKGTk6NV9gUYKDda6tda+vVYaLNV1mDi05AAAW7Iw/N+zrhtQAAAAASUVORK5CYII=",
    credit: "Made by Rhys · ScaleSmiths co-founder",
    repoUrl: "https://github.com/TheFridey/Prymal",
  },
  {
    id: 6,
    slug: "veteranfinder",
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
    accentColor: "#22d3ee",
    gradient: "from-cyan-400/10 to-amber-200/5",
    heroImage: "/images/projects/veteranfinder/hero.jpg",
    thumbImage: "/images/projects/veteranfinder/thumb.jpg",
    blurDataURL: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAGCAIAAAB1kpiRAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAxUlEQVR4nAG6AEX/AJqq9LfH/6S0/3yJzVtpm0JNdi05WCQwUCc1VRwoSACUpvCsvf+RoexKV4s7SHIpNlsgLEsxPWA5R3A5RnYAV2SUMT1gPktxdoKlX2qKZW+LWGF+IixMFSFCKDRfAB0lNxkkQTI9X+/9/+v3/+/9/+Lu/yo3XBAeQQgXNAAKDxxebJlPXI00QW5ZZp8zQW9HVYA7SHAYJUoABSQAAAYYGydHOEVzU1+cbnfCcHjEWmamOER5EiBJAAEjv/BF0IdbfaYAAAAASUVORK5CYII=",
    credit: "Made by Rhys · ScaleSmiths co-founder",
    repoUrl: "https://github.com/TheFridey/VF",
  },
]

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

export const retainers = [
  { name: "Maintenance", price: "Scoped separately", priceClaimId: "price.maintenance-retainer", desc: "Hosting, updates, uptime monitoring and minor fixes." },
  { name: "Growth Partner", price: "Scoped separately", priceClaimId: "price.growth-retainer", desc: "Maintenance plus monthly performance reviews and improvements." },
  { name: "Ecosystem", price: "Scoped separately", priceClaimId: "price.ecosystem-retainer", desc: "Full ongoing partnership — development, strategy and advisory support." },
]

export const faqs = [
  {
    q: "What does ScaleSmiths do?",
    a: "ScaleSmiths is a strategy-led web development and digital infrastructure agency. We build websites, e-commerce platforms, SaaS applications and custom systems for businesses that want to grow. Based in Hucknall, Nottinghamshire, we work with clients across the UK and internationally.",
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
    a: "Post-launch support can include maintenance, monitoring, measured improvements and roadmap work. It is optional and scoped separately from the initial build.",
  },
]
