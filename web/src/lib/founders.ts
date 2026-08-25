import type { Metadata } from "next"
import { projects, type Project } from "./data"

/**
 * Founder content is centrally managed here so no biography copy is scattered through
 * components. Published biographical claims cite an existing source. Details that are
 * not confirmed stay unpublished rather than becoming customer-facing caveats.
 *
 * Never add qualifications, employment history, client counts, revenue figures or awards
 * here without a verified public claim record (see `public-claims.ts`).
 */

export interface EvidencedStatement {
  text: string
  /** Repository path that already evidences this statement. */
  evidence: string
}

export interface FounderLinkConfig {
  label: string
  /** Environment variable supplying the URL. Unset or invalid means the link is not published. */
  envVar: string
}

export interface FounderLink {
  label: string
  href: string
}

export interface Founder {
  slug: string
  name: string
  /** Name as it already appears in project credits. */
  creditName: string
  monogram: string
  role: EvidencedStatement
  responsibilities: EvidencedStatement[]
  involvement: EvidencedStatement[]
  focusAreas: string[]
  /** Project slugs in `data.ts` whose credit line names this founder. */
  projectSlugs: string[]
  linkConfig: FounderLinkConfig[]
  accent: string
}

export const FOUNDER_LOCATION = {
  locality: "Hucknall",
  region: "Nottinghamshire",
  country: "United Kingdom",
  evidence: "web/src/app/layout.tsx",
} as const

export const founders: Founder[] = [
  {
    slug: "rhys",
    name: "Rhys",
    creditName: "Rhys",
    monogram: "R",
    accent: "#22d3ee",
    role: {
      text: "Co-founder — strategy, engineering and delivery",
      evidence: "web/src/lib/data.ts (project credits: \"Made by Rhys · ScaleSmiths co-founder\")",
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
    ],
    focusAreas: ["Strategy", "Engineering", "Systems", "Infrastructure", "Technical architecture", "Delivery"],
    projectSlugs: ["glow-tanning", "pinkys-prints", "csds", "prymal", "veteranfinder"],
    linkConfig: [
      { label: "GitHub", envVar: "NEXT_PUBLIC_FOUNDER_RHYS_GITHUB" },
      { label: "LinkedIn", envVar: "NEXT_PUBLIC_FOUNDER_RHYS_LINKEDIN" },
      { label: "Email", envVar: "NEXT_PUBLIC_FOUNDER_RHYS_EMAIL_URL" },
    ],
  },
  {
    slug: "trevor-newton-bradley",
    name: "Trevor Newton-Bradley",
    creditName: "Trev",
    monogram: "TNB",
    accent: "#6366f1",
    role: {
      text: "Co-founder — commercial growth and client partnerships",
      evidence: "web/src/app/layout.tsx and admin/src/components/ProspectPipeline.tsx",
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
    ],
    focusAreas: ["Commercial growth", "Client relationships", "Business development", "Sales", "Partnerships", "Commercial strategy"],
    projectSlugs: ["the-business-circle"],
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
    evidence: "web/src/lib/data.ts (FAQ) and web/src/app/layout.tsx (postal address)",
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

/**
 * Optional contact links come from configuration only. An unset, blank or non-HTTP(S)
 * value publishes nothing rather than a broken or unsafe link.
 */
export function founderLinks(
  founder: Founder,
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): FounderLink[] {
  return founder.linkConfig
    .map((config) => ({ label: config.label, href: (env[config.envVar] ?? "").trim() }))
    .filter((link): link is FounderLink => isPublishableLink(link.href))
}

function isPublishableLink(value: string): boolean {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "mailto:"
  } catch {
    return false
  }
}

export const aboutMetadata: Metadata = {
  title: "About & Founders",
  description:
    "Meet ScaleSmiths co-founders Rhys and Trevor Newton-Bradley: complementary commercial growth and technical engineering leadership from Hucknall, Nottinghamshire.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About & Founders | ScaleSmiths",
    description:
      "Founder-led business growth and engineering from Hucknall, Nottinghamshire, combining commercial thinking with serious technical execution.",
    url: "/about",
  },
}

export function buildAboutSchemas(
  siteUrl = "https://scalesmiths.co.uk",
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
) {
  const base = siteUrl.replace(/\/$/, "")
  const url = `${base}/about`

  const people = founders.map((founder) => {
    const links = founderLinks(founder, env)
      .map((link) => link.href)
      .filter((href) => href.startsWith("https:"))
    return {
      "@context": "https://schema.org",
      "@type": "Person",
      "@id": `${url}#${founder.slug}`,
      name: founder.name,
      jobTitle: founder.role.text,
      url,
      worksFor: { "@id": `${base}/#org` },
      knowsAbout: founderFocusAreas(founder),
      address: {
        "@type": "PostalAddress",
        addressLocality: FOUNDER_LOCATION.locality,
        addressRegion: FOUNDER_LOCATION.region,
        addressCountry: "GB",
      },
      ...(links.length ? { sameAs: links } : {}),
    }
  })

  return [
    {
      "@context": "https://schema.org",
      "@type": "AboutPage",
      name: "About ScaleSmiths and its founders",
      description: String(aboutMetadata.description),
      url,
      isPartOf: { "@type": "WebSite", name: "ScaleSmiths", url: base },
      about: { "@id": `${base}/#org` },
    },
    {
      "@context": "https://schema.org",
      "@type": ["Organization", "ProfessionalService"],
      "@id": `${base}/#org`,
      name: "ScaleSmiths",
      url: base,
      founder: founders.map((founder) => ({ "@id": `${url}#${founder.slug}` })),
      foundingLocation: {
        "@type": "Place",
        name: `${FOUNDER_LOCATION.locality}, ${FOUNDER_LOCATION.region}`,
        address: {
          "@type": "PostalAddress",
          addressLocality: FOUNDER_LOCATION.locality,
          addressRegion: FOUNDER_LOCATION.region,
          addressCountry: "GB",
        },
      },
    },
    ...people,
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: base },
        { "@type": "ListItem", position: 2, name: "About", item: url },
      ],
    },
  ]
}
