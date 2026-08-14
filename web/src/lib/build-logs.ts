export interface BuildLog {
  slug: string
  title: string
  summary: string
  problem: string
  solution: string
  technicalApproach: string[]
  tags: string[]
  system: string
  status: "Production note" | "System note"
}

export const buildLogs: BuildLog[] = [
  {
    slug: "scalesmiths-platform-build",
    title: "ScaleSmiths Platform Build",
    summary: "The public site, admin panel, quote funnel, portal shell, and deployment foundations brought into one production system.",
    problem: "ScaleSmiths needed its own site to prove the same thing it sells: fast public UX, secure data capture, admin visibility, and credible delivery infrastructure.",
    solution: "Kept the existing Next.js architecture and hardened the surfaces that matter most for lead generation and delivery trust.",
    technicalApproach: ["Next.js App Router", "PostgreSQL with Drizzle", "Docker standalone builds", "Nginx reverse proxy", "Deterministic system fonts"],
    tags: ["Next.js", "PostgreSQL", "Drizzle", "Docker", "CSP"],
    system: "Public site · Admin · Portal · Deployment",
    status: "Production note",
  },
  {
    slug: "quote-system-hardening",
    title: "Quote System Hardening",
    summary: "A safer quote funnel with qualification fields, honeypot protection, body limits, generic errors, and hashed rate limiting.",
    problem: "A public quote endpoint has to capture enough detail for sales without leaking internals or becoming an easy spam target.",
    solution: "Added authoritative backend validation, safe errors, Postgres-backed rate limits, consent capture, and server-side lead quality scoring.",
    technicalApproach: ["Request body size limits", "Honeypot handling", "Hashed IP/email keys", "Lead quality helper", "Resend-safe error handling"],
    tags: ["Security", "Validation", "Rate limits", "Lead quality"],
    system: "Quote funnel",
    status: "System note",
  },
  {
    slug: "portal-foundation",
    title: "Portal Foundation",
    summary: "A credible early-stage portal shell using database-backed auth and safe placeholders instead of fake project data.",
    problem: "The portal needed to demonstrate delivery process without pretending there are live files, messages, or progress where none exists.",
    solution: "Built a protected workspace with JWT cookies, DB-backed client auth, clear dashboard cards, support CTA, and intentional empty states.",
    technicalApproach: ["bcrypt password hashes", "HS256 JWT sessions", "httpOnly cookies", "Protected portal matcher", "Safe empty states"],
    tags: ["Portal", "Auth", "JWT", "bcrypt"],
    system: "Client portal",
    status: "System note",
  },
  {
    slug: "seo-aeo-page-architecture",
    title: "SEO/AEO Page Architecture",
    summary: "Service and location landing pages with canonical metadata, structured data, buyer FAQs, and internal linking.",
    problem: "Thin location pages can damage trust. The site needed service-depth pages that answer buyer questions without keyword stuffing.",
    solution: "Created data-driven landing pages for local and UK-wide services with schema and internal links.",
    technicalApproach: ["Canonical metadata", "FAQPage schema", "Service schema", "LocalBusiness schema", "Sitemap inclusion"],
    tags: ["SEO", "AEO", "Schema", "Sitemap"],
    system: "Public site architecture",
    status: "Production note",
  },
  {
    slug: "admin-dashboard-foundation",
    title: "Admin Dashboard Foundation",
    summary: "A lean admin foundation for clients, roadmap cards, MRR by tier, and quote lead review.",
    problem: "Admin needed enough operational visibility to support real delivery without turning into a half-built CRM.",
    solution: "Kept admin focused: database-backed clients, roadmap cards, lead inbox, and clear empty states.",
    technicalApproach: ["Auth.js credentials", "Drizzle queries", "Lead cards", "MRR by tier", "Standalone output"],
    tags: ["Admin", "Leads", "Clients", "Dashboard"],
    system: "Operations platform",
    status: "System note",
  },
  {
    slug: "security-hardening-pass",
    title: "Security Hardening Pass",
    summary: "CSP, security headers, deterministic builds, auth hardening, and safe public endpoint behavior.",
    problem: "A credible production site needs boring, reliable security defaults across public and admin apps.",
    solution: "Added headers, tightened portal auth, removed Google font build dependency, and avoided leaking provider errors.",
    technicalApproach: ["Content-Security-Policy", "HSTS", "Referrer-Policy", "Permissions-Policy", "No Google-hosted fonts"],
    tags: ["CSP", "Headers", "Cookies", "Production"],
    system: "Public and admin applications",
    status: "Production note",
  },
]

export function getBuildLog(slug: string) {
  return buildLogs.find((log) => log.slug === slug)
}
