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
  outcomes: string[]
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
    solution: "Built a full Node.js/Express site with a custom Canvas API animation system for the hero section (animated sun rays), Salon Tracker booking iframe integration, and an automated review aggregation pipeline that pulls from both Google Places API and Facebook in real time. A Sharp-based WebP image pipeline handles all imagery, with a JWT-secured admin panel for the client to manage content independently.",
    outcomes: [
      "Bookings started coming through the website within the first week of launch",
      "Google + Facebook reviews combined into a single credibility display",
      "Admin panel means zero developer dependency for routine content updates",
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
    headline: "Full custom e-commerce with 120+ products, migrated off Shopify and into a self-hosted powerhouse.",
    challenge: "Pinkys Prints had outgrown Shopify. The templated design couldn\'t showcase their personalised product range effectively, the admin tools were too generic for their workflow, and hosting costs were climbing with Vercel + Supabase.",
    solution: "A fully custom React/Vite e-commerce platform with a mega menu, 120+ product catalogue with variant support, and a bespoke admin panel tailored to their exact product management workflow. The entire stack was then migrated from Supabase/Vercel to a self-hosted Docker Compose setup on a VPS — with zero downtime, switching over at 2am.",
    outcomes: [
      "Zero-downtime migration from cloud to self-hosted — no customer impact",
      "Admin panel designed around their actual workflow, not a generic CMS",
      "Significant monthly saving vs Shopify Plus + Vercel Pro + Supabase",
    ],
    features: [
      "120+ product catalogue with variants",
      "Mega menu navigation",
      "Fully custom admin panel",
      "PostgreSQL with Docker Compose",
      "VPS self-hosted",
      "Zero-downtime Supabase → self-hosted migration",
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
    outcomes: [
      "Immediately distinctive in a commodity market",
      "Quote system eliminates back-and-forth phone/email friction",
      "Admin panel lets the owner manage all enquiries from one interface",
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
    solution: "Built on Next.js 15 with Auth.js v5 for multi-role authentication, Stripe for subscription billing across three tiers (£30/£79/£149), and LiveKit for natively integrated video rooms. PostgreSQL with Drizzle ORM handles the data layer. The entire stack runs on a VPS with Docker Compose.",
    outcomes: [
      "Full production SaaS handling real subscription billing from day one",
      "Video rooms built in natively — members never leave the platform",
      "Multi-tier role system gives granular access control as the community grows",
    ],
    features: [
      "Auth.js v5 with multi-role support",
      "Stripe subscriptions (£30 / £79 / £149 tiers)",
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
    outcomes: [
      "14 specialist AI agents packaged into a coordinated business workspace",
      "Grounded knowledge, workflow orchestration, billing, teams, and admin controls built into one product",
      "Production deployment model using Docker Compose, Nginx SSL proxying, logging, Sentry, and OpenAPI documentation",
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
    outcomes: [
      "Separate web, admin, and API apps organised into a maintainable monorepo",
      "Cookie-based auth model designed for secure browser sessions across member and admin surfaces",
      "Deployment options documented for both PM2 single-server hosting and Docker Compose with GitHub Actions",
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
}

export const services: Service[] = [
  {
    tier: "Foundation",
    range: "£4,500 – £6,500",
    pitch: "A purposeful website built to perform. Fast, clean and engineered to turn visitors into enquiries from day one.",
    features: ["Up to 8 pages", "Custom design", "On-page SEO", "Core Web Vitals optimised", "Mobile-first build"],
    icon: "globe",
  },
  {
    tier: "Growth",
    range: "£8,000 – £15,000",
    pitch: "E-commerce, bookings, integrations. For businesses ready to make digital a real revenue channel — not just a brochure.",
    features: ["E-commerce / bookings", "Custom integrations", "CMS setup", "Analytics + conversion", "Priority support"],
    icon: "trending-up",
    featured: true,
  },
  {
    tier: "Forge",
    range: "£18,000 – £35,000+",
    pitch: "Full-stack infrastructure. SaaS platforms, multi-system architecture, genuinely complex builds.",
    features: ["Complex architecture", "Multi-system builds", "AI integrations", "Real-time features", "Full partnership"],
    icon: "layers",
  },
]

export const retainers = [
  { name: "Maintenance",    price: "£450–£650/mo",     desc: "Hosting, updates, uptime monitoring and minor fixes." },
  { name: "Growth Partner", price: "£950–£1,500/mo",   desc: "Maintenance plus monthly performance reviews and improvements." },
  { name: "Ecosystem",      price: "£2,000–£3,500/mo", desc: "Full ongoing partnership — dev, strategy, advisory and Business Circle access." },
]

export const testimonials = [
  { name: "Tom M.",   biz: "Glow Tanning",   quote: "Completely transformed how we look online. The booking integration alone has paid for itself twice over.",                               stars: 5 },
  { name: "Beth C.", biz: "Pinkys Prints",  quote: "Went from a basic Shopify store to a fully custom site that actually feels like our brand. Outstanding work.",                       stars: 5 },
  { name: "Chris S.", biz: "CSDS",           quote: "Professional, fast, and the admin panel makes everything easy to manage ourselves. Exactly what we needed.",                         stars: 5 },
]

export const faqs = [
  {
    q: "What does ScaleSmiths do?",
    a: "ScaleSmiths is a strategy-led web development and digital infrastructure agency. We build websites, e-commerce platforms, SaaS applications and custom systems for businesses that want to grow. Based in Hucknall, Nottinghamshire, we work with clients across the UK and internationally.",
  },
  {
    q: "How much does a website cost?",
    a: "Our Foundation builds start at £4,500 for up to 8 pages. Growth builds run £8,000–£15,000 for e-commerce and custom integrations. Forge builds start at £18,000 for complex platforms. Every build includes design, development, SEO foundations and deployment.",
  },
  {
    q: "Where is ScaleSmiths based?",
    a: "We\'re based in Hucknall, Nottinghamshire, UK. We deliver projects entirely remotely with structured communication, weekly updates via your client portal, and video calls throughout.",
  },
  {
    q: "How long does a project take?",
    a: "Foundation sites: 4–6 weeks. Growth builds: 8–12 weeks. Forge builds are scoped individually — typically 12–24 weeks. Every project starts with a discovery and strategy phase before a single line of code is written.",
  },
  {
    q: "What happens after launch?",
    a: "Every project is built to convert into a retainer. Maintenance plans start at £450/month. Our Growth Partner retainer (£950–£1,500/mo) adds performance reviews. Ecosystem (£2,000–£3,500/mo) is a full ongoing partnership.",
  },
]
