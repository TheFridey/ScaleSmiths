import type { Metadata } from "next"
import { projects, type Project } from "./data"
import { buildPageMetadata } from "./page-metadata"
import { resolveConfiguredLinks, type ConfiguredLink, type PublicEnv, type PublicLink } from "./public-links"
import { BUSINESS_LOCATION, founderProfilePath } from "./site-identity"
import type { TeamImageKey } from "./team-images"

/**
 * Founder content is centrally managed here so no biography copy is scattered through
 * components. Published biographical claims cite an existing source. Details that are
 * not confirmed stay unpublished rather than becoming customer-facing caveats.
 *
 * Never add qualifications, employment history, client counts, revenue figures or awards
 * here without a verified public claim record (see `public-claims.ts`).
 *
 * TODO(founders): each founder can supply a first-person biography (background, why they
 * started ScaleSmiths, how they work). Record the approval in docs/content/founder-profiles.md
 * and add it to `biography` with that document as evidence. Until then the profile pages
 * publish only the evidenced statements below.
 */

export interface EvidencedStatement {
  text: string
  /** Repository path that already evidences this statement. */
  evidence: string
}

export type FounderLinkConfig = ConfiguredLink
export type FounderLink = PublicLink

export interface Founder {
  slug: string
  name: string
  firstName: string
  /** Name as it already appears in project credits. */
  creditName: string
  monogram: string
  photo: TeamImageKey
  role: EvidencedStatement
  /** Short title used in article bylines and Person structured data. */
  authorTitle: string
  /** Short introduction used on the homepage and at the top of the profile page. */
  summary: EvidencedStatement
  responsibilities: EvidencedStatement[]
  involvement: EvidencedStatement[]
  focusAreas: string[]
  /** Project slugs in `data.ts` whose credit line names this founder. */
  projectSlugs: string[]
  relatedServices: Array<{ href: string; label: string }>
  linkConfig: FounderLinkConfig[]
  accent: string
}

const OWNER_BRIEF = "docs/content/founder-profiles.md (owner-supplied role brief, 15 September 2026)"

export const FOUNDER_LOCATION = {
  locality: BUSINESS_LOCATION.locality,
  region: BUSINESS_LOCATION.region,
  country: BUSINESS_LOCATION.country,
  evidence: "web/src/lib/site-identity.ts",
} as const

export const founders: Founder[] = [
  {
    slug: "rhys",
    // TODO(owner): confirm whether Rhys's surname should be published. A full name strengthens
    // the Person entity; until confirmed, the credited first name is used everywhere.
    name: "Rhys",
    firstName: "Rhys",
    creditName: "Rhys",
    monogram: "R",
    photo: "rhys",
    // Owner-supplied title (founder profile card, 15 September 2026).
    authorTitle: "Co-founder & Technical Lead",
    accent: "#22d3ee",
    role: {
      text: "Co-founder — technical leadership, engineering and delivery",
      evidence: `${OWNER_BRIEF} and web/src/lib/data.ts (project credits: "Made by Rhys · ScaleSmiths co-founder")`,
    },
    summary: {
      text: "Rhys co-founded ScaleSmiths and leads its technical direction: strategy, software engineering, web systems, architecture, technical SEO implementation and delivery. Clients discuss the technical approach with the founder accountable for building it.",
      evidence: OWNER_BRIEF,
    },
    responsibilities: [
      {
        text: "Named delivery credit on five of the six published ScaleSmiths projects, across local business, e-commerce, AI SaaS and community platform work.",
        evidence: "web/src/lib/data.ts",
      },
      {
        text: "Builds and operates the production infrastructure the published work runs on — self-hosted Docker Compose, PostgreSQL and Nginx rather than managed defaults.",
        evidence: "web/src/lib/data.ts (project solutions and feature lists)",
      },
      {
        text: "Publishes source repositories for platform work where the client relationship allows it.",
        evidence: "web/src/lib/data.ts (repoUrl on Prymal and VeteranFinder)",
      },
    ],
    involvement: [
      {
        text: "Leads technical discovery, architecture and hands-on delivery across websites, custom applications, automation and production infrastructure.",
        evidence: "web/src/lib/data.ts (per-project credit lines)",
      },
      {
        text: "Owns technical SEO implementation — site architecture, structured data, performance and indexing — as part of the build rather than as a separate hand-off.",
        evidence: OWNER_BRIEF,
      },
    ],
    focusAreas: [
      "Technical leadership",
      "Strategy",
      "Software engineering",
      "Web systems",
      "Architecture",
      "Technical SEO",
      "Infrastructure",
      "Delivery",
    ],
    projectSlugs: ["glow-tanning", "pinkys-prints", "csds", "prymal", "veteranfinder"],
    relatedServices: [
      { href: "/custom-systems", label: "Custom Systems" },
      { href: "/custom-web-app-development-uk", label: "Custom web app development" },
      { href: "/next-js-agency-uk", label: "Next.js development" },
    ],
    linkConfig: [
      { label: "GitHub", envVar: "NEXT_PUBLIC_FOUNDER_RHYS_GITHUB" },
      { label: "LinkedIn", envVar: "NEXT_PUBLIC_FOUNDER_RHYS_LINKEDIN" },
      { label: "Email", envVar: "NEXT_PUBLIC_FOUNDER_RHYS_EMAIL_URL" },
    ],
  },
  {
    slug: "trevor-newton-bradley",
    name: "Trevor Newton-Bradley",
    firstName: "Trevor",
    creditName: "Trev",
    monogram: "TNB",
    photo: "trevor",
    // Owner-supplied title (founder profile card, 15 September 2026).
    authorTitle: "Co-founder & Commercial Lead",
    accent: "#6366f1",
    role: {
      text: "Co-founder — commercial growth and client relationships",
      evidence: `${OWNER_BRIEF}, web/src/app/layout.tsx and admin/src/components/ProspectPipeline.tsx`,
    },
    summary: {
      text: "Trevor Newton-Bradley co-founded ScaleSmiths and leads its commercial side: growth, client relationships, sales, business development and account relationships. Clients discuss commercial priorities with a founder rather than a sales team working to someone else's brief.",
      evidence: OWNER_BRIEF,
    },
    responsibilities: [
      {
        text: "Brings the commercial lens to growth priorities, client relationships, business development and partnership opportunities.",
        evidence: "admin/src/components/ProspectPipeline.tsx and admin/src/lib/prospects.ts",
      },
      {
        text: "Named delivery credit on The Business Circle, a production SaaS platform with subscription billing, multi-role authentication and integrated video.",
        evidence: "web/src/lib/data.ts (credit: \"Made by Trev\")",
      },
    ],
    involvement: [
      {
        text: "Connects commercial priorities and client context to the work ScaleSmiths diagnoses, proposes and delivers.",
        evidence: "admin/src/components/ProspectPipeline.tsx and web/src/lib/business-growth-audit.ts",
      },
      {
        text: "Looks after account relationships once work is under way, so clients keep a founder as their commercial point of contact.",
        evidence: OWNER_BRIEF,
      },
    ],
    focusAreas: [
      "Commercial growth",
      "Client relationships",
      "Sales",
      "Business development",
      "Account relationships",
      "Partnerships",
    ],
    projectSlugs: ["the-business-circle"],
    relatedServices: [
      { href: "/services/business-growth-audit", label: "Business Growth Audit" },
      { href: "/digital-growth-partnership", label: "Digital Growth Partnership" },
      { href: "/local-growth", label: "Local Growth" },
    ],
    linkConfig: [
      { label: "LinkedIn", envVar: "NEXT_PUBLIC_FOUNDER_TREVOR_LINKEDIN" },
      { label: "Email", envVar: "NEXT_PUBLIC_FOUNDER_TREVOR_EMAIL_URL" },
    ],
  },
]

/** The origin narrative, restricted to facts already present in the repository. */
export const originStatements: EvidencedStatement[] = [
  {
    text: "ScaleSmiths is a founder-led business growth and engineering company founded by Rhys and Trevor Newton-Bradley.",
    evidence: "web/src/app/layout.tsx (Organization founders)",
  },
  {
    text: "It is based in Hucknall, Nottinghamshire, and works with clients across the UK and internationally.",
    evidence: "web/src/lib/data.ts (FAQ) and web/src/lib/site-identity.ts (business location)",
  },
  {
    text: "The first published project was Glow Tanning — a Hucknall salon with no meaningful web presence and competitors already ahead of it online.",
    evidence: "web/src/lib/data.ts (project 1, Hucknall, 2025)",
  },
  {
    text: "Published work since has run from local service businesses through to e-commerce migrations, SaaS platforms and multi-agent AI systems.",
    evidence: "web/src/lib/data.ts (project types across 2025 and 2026)",
  },
]

export const approachPillars: Array<{ title: string; description: string }> = [
  {
    title: "Find",
    description:
      "Diagnose the commercial constraint before prescribing technology. The answer may be clearer positioning, a focused repair, a workflow change or a new system—not automatically another website.",
  },
  {
    title: "Fix",
    description:
      "Build the right intervention with serious engineering underneath it: data, permissions, integrations, infrastructure, migrations, deployment and failure states designed as one operational system.",
  },
  {
    title: "Grow",
    description:
      "Keep improving through a scoped Digital Growth Partnership, with agreed priorities across SEO, conversion, content, automation, technical stewardship and roadmap delivery.",
  },
]

/** Public claims we deliberately do not make. Kept here so the exclusion is testable. */
export const UNSUPPORTED_CLAIM_PATTERNS = [
  /\byears of experience\b/i,
  /\b\d+\+?\s*(?:clients?|projects delivered|businesses served)\b/i,
  /\baward[- ]winning\b/i,
  /\bcertified\b/i,
  /\bdegree\b/i,
  /\b(?:formerly|previously) at\b/i,
] as const

export function founderProjects(founder: Founder): Project[] {
  return founder.projectSlugs.map((slug) => {
    const project = projects.find((candidate) => candidate.slug === slug)
    if (!project) throw new Error(`Unknown founder project slug: ${slug}`)
    return project
  })
}

export function founderFocusAreas(founder: Founder, limit = 10): string[] {
  return founder.focusAreas.slice(0, limit)
}

/** Resolve the founder responsible for a project from its credit line. */
export function founderForProject(slug: string): Founder | undefined {
  return founders.find((founder) => founder.projectSlugs.includes(slug))
}

export function founderBySlug(slug: string): Founder | undefined {
  return founders.find((founder) => founder.slug === slug)
}

export function founderProfileHref(founder: Founder): string {
  return founderProfilePath(founder.slug)
}

export function founderLinks(
  founder: Founder,
  env: PublicEnv = process.env as PublicEnv,
): FounderLink[] {
  return resolveConfiguredLinks(founder.linkConfig, env)
}

export const aboutMetadata: Metadata = buildPageMetadata({
  title: "About & Founders",
  description:
    "Meet ScaleSmiths co-founders Rhys and Trevor Newton-Bradley, who lead engineering and commercial growth from Hucknall, Nottinghamshire.",
  path: "/about",
})

export function founderProfileMetadata(founder: Founder): Metadata {
  return buildPageMetadata({
    title: `${founder.name}, Co-founder`,
    description: `${founder.name}, ${founder.authorTitle} of ScaleSmiths in Hucknall, Nottinghamshire: focus areas, credited projects and approach.`,
    path: founderProfilePath(founder.slug),
    type: "profile",
  })
}
