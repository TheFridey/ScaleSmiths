import { legalEntity } from "./legal"
import { resolveConfiguredLinks, type ConfiguredLink, type PublicEnv, type PublicLink } from "./public-links"

/**
 * The single source for how ScaleSmiths identifies itself to people and search engines.
 * Only verified facts belong here. Legal name, company number, telephone and similar
 * identifiers stay out until they are confirmed in `legal.ts` (see LEGAL_DECISIONS_REQUIRED).
 */

export const SITE_NAME = "ScaleSmiths"
export const DEFAULT_SITE_URL = "https://scalesmiths.co.uk"
export const SITE_SLOGAN = "Forge Your Digital Edge"
export const SITE_DESCRIPTION =
  "ScaleSmiths is a founder-led digital growth and engineering company based in Hucknall, Nottinghamshire. We help businesses identify growth constraints, build websites and custom systems, automate workflows and manage ongoing digital improvement."

export const BUSINESS_LOCATION = {
  locality: "Hucknall",
  region: "Nottinghamshire",
  postalCode: "NG15",
  countryCode: "GB",
  country: "United Kingdom",
} as const

export const SERVICE_AREA_STATEMENT = "Serving businesses across the UK"
export const CONTACT_EMAIL = legalEntity.contactEmail
export const LOGO_ASSET = { src: "/brand/scalesmiths-mark.png" } as const

export function siteBaseUrl(siteUrl: string | undefined = process.env.NEXT_PUBLIC_SITE_URL): string {
  return (siteUrl || DEFAULT_SITE_URL).replace(/\/+$/, "")
}

export const organizationId = (base: string) => `${base}/#org`
export const websiteId = (base: string) => `${base}/#website`
export const founderProfilePath = (slug: string) => `/about/${slug}`
export const personId = (base: string, slug: string) => `${base}${founderProfilePath(slug)}#person`

/** A lightweight pointer to the Organization node published site-wide by the root layout. */
export function organizationReference(base: string) {
  return { "@id": organizationId(base), name: SITE_NAME, url: base }
}

/**
 * Business profiles are published only when configured. Do not hard-code a profile URL
 * unless ScaleSmiths controls that profile.
 */
export const organizationProfileLinks: readonly ConfiguredLink[] = [
  { label: "LinkedIn", envVar: "NEXT_PUBLIC_SCALESMITHS_LINKEDIN_URL" },
  { label: "Google Business Profile", envVar: "NEXT_PUBLIC_SCALESMITHS_GOOGLE_BUSINESS_PROFILE_URL" },
  { label: "Instagram", envVar: "NEXT_PUBLIC_SCALESMITHS_INSTAGRAM_URL" },
  { label: "Facebook", envVar: "NEXT_PUBLIC_SCALESMITHS_FACEBOOK_URL" },
  { label: "GitHub", envVar: "NEXT_PUBLIC_SCALESMITHS_GITHUB_URL" },
]

/**
 * Next.js only inlines literal `process.env.NEXT_PUBLIC_*` reads into client bundles, so the
 * footer (rendered inside a client boundary) needs this explicit map rather than a dynamic lookup.
 */
export function organizationProfileEnv(): PublicEnv {
  return {
    NEXT_PUBLIC_SCALESMITHS_LINKEDIN_URL: process.env.NEXT_PUBLIC_SCALESMITHS_LINKEDIN_URL,
    NEXT_PUBLIC_SCALESMITHS_GOOGLE_BUSINESS_PROFILE_URL: process.env.NEXT_PUBLIC_SCALESMITHS_GOOGLE_BUSINESS_PROFILE_URL,
    NEXT_PUBLIC_SCALESMITHS_INSTAGRAM_URL: process.env.NEXT_PUBLIC_SCALESMITHS_INSTAGRAM_URL,
    NEXT_PUBLIC_SCALESMITHS_FACEBOOK_URL: process.env.NEXT_PUBLIC_SCALESMITHS_FACEBOOK_URL,
    NEXT_PUBLIC_SCALESMITHS_GITHUB_URL: process.env.NEXT_PUBLIC_SCALESMITHS_GITHUB_URL,
  }
}

export function organizationProfiles(env: PublicEnv = organizationProfileEnv()): PublicLink[] {
  return resolveConfiguredLinks(organizationProfileLinks, env).filter((link) => link.href.startsWith("https:"))
}
