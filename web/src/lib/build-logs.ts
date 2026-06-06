export interface BuildLog {
  slug: string
  title: string
  summary: string
  problem: string
  solution: string
  technicalApproach: string[]
  businessValue: string
  outcome: string
  tags: string[]
}

export const buildLogs: BuildLog[] = [
  {
    slug: "scalesmiths-platform-build",
    title: "ScaleSmiths Platform Build",
    summary: "The public site, admin panel, quote funnel, portal shell, and deployment foundations brought into one production system.",
    problem: "ScaleSmiths needed its own site to prove the same thing it sells: fast public UX, secure data capture, admin visibility, and credible delivery infrastructure.",
    solution: "Kept the existing Next.js architecture and hardened the surfaces that matter most for lead generation and delivery trust.",
    technicalApproach: ["Next.js App Router", "PostgreSQL with Drizzle", "Docker standalone builds", "Nginx reverse proxy", "Deterministic system fonts"],
    businessValue: "The site now works as a sales asset and an operations base rather than a static brochure.",
    outcome: "Verified production builds for both public and admin apps, with sitemap, metadata, quote handling, and portal foundations in place.",
    tags: ["Next.js", "PostgreSQL", "Drizzle", "Docker", "CSP"],
  },
  {
    slug: "quote-system-hardening",
    title: "Quote System Hardening",
    summary: "A safer quote funnel with qualification fields, honeypot protection, body limits, generic errors, and hashed rate limiting.",
    problem: "A public quote endpoint has to capture enough detail for sales without leaking internals or becoming an easy spam target.",
    solution: "Added authoritative backend validation, safe errors, Postgres-backed rate limits, consent capture, and server-side lead quality scoring.",
    technicalApproach: ["Request body size limits", "Honeypot handling", "Hashed IP/email keys", "Lead quality helper", "Resend-safe error handling"],
    businessValue: "Sales conversations start with better context while the public endpoint stays production-safe.",
    outcome: "Unit tests cover validation, honeypot behavior, rate limiting, generic errors, and lead scoring.",
    tags: ["Security", "Validation", "Rate limits", "Lead quality"],
  },
  {
    slug: "portal-foundation",
    title: "Portal Foundation",
    summary: "A credible early-stage portal shell using database-backed auth and safe placeholders instead of fake project data.",
    problem: "The portal needed to demonstrate delivery process without pretending there are live files, messages, or progress where none exists.",
    solution: "Built a protected workspace with JWT cookies, DB-backed client auth, clear dashboard cards, support CTA, and intentional empty states.",
    technicalApproach: ["bcrypt password hashes", "HS256 JWT sessions", "httpOnly cookies", "Protected portal matcher", "Safe empty states"],
    businessValue: "Prospects can see delivery discipline without being misled by fake SaaS depth.",
    outcome: "Demo access is env-gated, logout clears the cookie, and portal routes redirect unauthenticated users.",
    tags: ["Portal", "Auth", "JWT", "bcrypt"],
  },
  {
    slug: "seo-aeo-page-architecture",
    title: "SEO/AEO Page Architecture",
    summary: "Service and location landing pages with canonical metadata, structured data, buyer FAQs, and internal linking.",
    problem: "Thin location pages can damage trust. The site needed service-depth pages that answer buyer questions without keyword stuffing.",
    solution: "Created data-driven landing pages for local and UK-wide services with schema and internal links.",
    technicalApproach: ["Canonical metadata", "FAQPage schema", "Service schema", "LocalBusiness schema", "Sitemap inclusion"],
    businessValue: "Search pages now qualify buyers before they reach the quote form.",
    outcome: "Landing metadata/schema helpers are unit-tested and all pages are included in the sitemap.",
    tags: ["SEO", "AEO", "Schema", "Sitemap"],
  },
  {
    slug: "admin-dashboard-foundation",
    title: "Admin Dashboard Foundation",
    summary: "A lean admin foundation for clients, roadmap cards, MRR by tier, and quote lead review.",
    problem: "Admin needed enough operational visibility to support real delivery without turning into a half-built CRM.",
    solution: "Kept admin focused: database-backed clients, roadmap cards, lead inbox, and clear empty states.",
    technicalApproach: ["Auth.js credentials", "Drizzle queries", "Lead cards", "MRR by tier", "Standalone output"],
    businessValue: "The team can review leads and client status from one private surface.",
    outcome: "Admin production build passes with database-backed client and lead pages.",
    tags: ["Admin", "Leads", "Clients", "Dashboard"],
  },
  {
    slug: "security-hardening-pass",
    title: "Security Hardening Pass",
    summary: "CSP, security headers, deterministic builds, auth hardening, and safe public endpoint behavior.",
    problem: "A credible production site needs boring, reliable security defaults across public and admin apps.",
    solution: "Added headers, tightened portal auth, removed Google font build dependency, and avoided leaking provider errors.",
    technicalApproach: ["Content-Security-Policy", "HSTS", "Referrer-Policy", "Permissions-Policy", "No Google-hosted fonts"],
    businessValue: "Security posture becomes part of the sales proof, not just hidden implementation detail.",
    outcome: "Builds and tests verify the current hardened surfaces without weakening CSP.",
    tags: ["CSP", "Headers", "Cookies", "Production"],
  },
]

export function getBuildLog(slug: string) {
  return buildLogs.find((log) => log.slug === slug)
}
