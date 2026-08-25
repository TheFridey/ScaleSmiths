import type { Metadata } from "next"
import { projects, type Project } from "./data"

export interface EvidencedStatement {
  text: string
  evidence: string
}

export interface FounderLinkConfig {
  label: string
  envVar: string
}

export interface FounderLink {
  label: string
  href: string
}

export interface Founder {
  slug: string
  name: string
  creditName: string
  monogram: string
  role: EvidencedStatement
  responsibilities: EvidencedStatement[]
  involvement: EvidencedStatement[]
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
      text: "Co-Founder — Engineering, Product & Technical Delivery",
      evidence: "ScaleSmiths project credits and current founder responsibilities",
    },
    responsibilities: [
      {
        text: "Leads engineering and technical delivery across websites, e-commerce, custom systems, AI products and platform work.",
        evidence: "web/src/lib/data.ts",
      },
      {
        text: "Builds and operates the production infrastructure behind published platform work, including self-hosted application, database and deployment systems where appropriate.",
        evidence: "web/src/lib/data.ts",
      },
      {
        text: "Works directly from commercial requirements through architecture, implementation, launch and ongoing technical improvement.",
        evidence: "Current ScaleSmiths operating model",
      },
    ],
    involvement: [
      {
        text: "Directly involved in scoping and building the work rather than passing delivery through a subcontracted agency layer.",
        evidence: "web/src/lib/data.ts (per-project credit lines)",
      },
    ],
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
      text: "Co-Founder — Growth Strategy & Client Partnerships",
      evidence: "Current ScaleSmiths founder responsibilities",
    },
    responsibilities: [
      {
        text: "Leads growth strategy, commercial opportunity and client partnerships, helping turn business problems into clear priorities and workable engagements.",
        evidence: "Current ScaleSmiths operating model",
      },
      {
        text: "Works directly with businesses through discovery, relationship development and ongoing growth planning rather than handing clients into an account-management layer.",
        evidence: "Current ScaleSmiths operating model",
      },
      {
        text: "Has direct delivery credit on The Business Circle, a production SaaS platform with subscription billing, multi-role authentication and integrated video.",
        evidence: "web/src/lib/data.ts",
      },
    ],
    involvement: [
      {
        text: "Connects the commercial problem to the work ScaleSmiths recommends, then remains involved as the relationship develops.",
        evidence: "Current ScaleSmiths operating model",
      },
    ],
    projectSlugs: ["the-business-circle"],
    linkConfig: [
      { label: "LinkedIn", envVar: "NEXT_PUBLIC_FOUNDER_TREVOR_LINKEDIN" },
      { label: "Email", envVar: "NEXT_PUBLIC_FOUNDER_TREVOR_EMAIL_URL" },
    ],
  },
]

export const originStatements: EvidencedStatement[] = [
  {
    text: "ScaleSmiths is a founder-led digital growth and systems company built by Rhys and Trevor Newton-Bradley.",
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
    text: "Published work now spans local service businesses, e-commerce, SaaS platforms, AI systems and operational software.",
    evidence: "web/src/lib/data.ts",
  },
]

export const approachPillars: Array<{ title: string; description: string }> = [
  {
    title: "Find",
    description:
      "Start with the commercial problem. Audit the customer journey, visibility, systems and constraints, then identify the work that can make the biggest useful difference.",
  },
  {
    title: "Fix",
    description:
      "Build or improve what the evidence points to — whether that is a website, conversion journey, e-commerce flow, internal system, automation or deeper technical platform.",
  },
  {
    title: "Grow",
    description:
      "Keep the digital estate moving through an ongoing partnership across visibility, conversion, content, analytics, automation and technical delivery when that relationship makes sense.",
  },
]

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
  const tags = founderProjects(founder).flatMap((project) => project.tags)
  const counts = new Map<string, number>()
  for (const tag of tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([tag]) => tag)
}

export function founderForProject(slug: string): Founder | undefined {
  return founders.find((founder) => founder.projectSlugs.includes(slug))
}

export function founderBySlug(slug: string): Founder | undefined {
  return founders.find((founder) => founder.slug === slug)
}

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
    "Meet ScaleSmiths co-founders Rhys and Trevor Newton-Bradley: a founder-led digital growth and systems company based in Hucknall, Nottinghamshire.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About & Founders | ScaleSmiths",
    description:
      "Growth strategy, engineering and direct founder involvement from Hucknall, Nottinghamshire.",
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
