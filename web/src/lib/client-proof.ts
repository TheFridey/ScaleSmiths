import { projects, type Project } from "./data"

/**
 * Names shown in the homepage trust strip. Every entry is derived from a published case
 * study in `data.ts`, so the strip can never name a business the site cannot back up.
 *
 * - Client names are shown as typographic wordmarks. A real logo is only shown once the
 *   business has approved its use: add the asset under `public/images/clients/` and
 *   register it in `approvedClientLogos`.
 * - Confirm-A-Kill is now a published case study and therefore appears automatically
 *   through the same project-derived trust-entry path as the rest of the portfolio.
 */

export interface ClientLogo {
  /** Under /images/clients/, e.g. /images/clients/glow-tanning.svg. */
  src: string
  /** Intrinsic dimensions of the supplied file, so the aspect ratio is preserved. */
  width: number
  height: number
  /**
   * `original` keeps the approved colours (use a version that reads on dark backgrounds);
   * `monochrome` renders it as a single light tone for trust rows.
   */
  treatment?: "original" | "monochrome"
}

export function logoForProject(slug: string): ClientLogo | undefined {
  return approvedClientLogos[slug]
}

/** Only logos a client has approved for use. Keys are project slugs. */
export const approvedClientLogos: Partial<Record<string, ClientLogo>> = {}

export interface TrustEntry {
  name: string
  href: string
  sector: string
  location: string
  group: Project["portfolioGroup"]
  logo?: ClientLogo
}

export function trustEntries(): TrustEntry[] {
  return projects.map((project) => ({
    name: project.name,
    href: `/work/${project.slug}`,
    sector: project.type,
    location: project.location,
    group: project.portfolioGroup,
    logo: approvedClientLogos[project.slug],
  }))
}
