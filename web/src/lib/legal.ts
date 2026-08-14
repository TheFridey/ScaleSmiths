import type { Metadata, MetadataRoute } from "next"

export const LEGAL_VERSION = "2.0"
export const LEGAL_EFFECTIVE_DATE = "14 August 2026"
export const LEGAL_LAST_UPDATED = "14 August 2026"
export const LEGAL_LAST_MODIFIED_ISO = "2026-08-14T00:00:00.000Z"

export const legalEntity = {
  tradingName: "ScaleSmiths",
  legalName: null,
  entityType: null,
  companyNumber: null,
  registeredOffice: null,
  registeredIn: null,
  vatRegistered: null,
  vatNumber: null,
  businessLocation: "Hucknall, Nottinghamshire, United Kingdom",
  contactEmail: "hello@scalesmiths.co.uk",
  privacyEmail: "hello@scalesmiths.co.uk",
  complaintsEmail: "hello@scalesmiths.co.uk",
  securityEmail: "hello@scalesmiths.co.uk",
} as const

export const PRIVACY_CONTACT_EMAIL = legalEntity.privacyEmail
export const ENQUIRY_CONSENT_COPY = "I agree that ScaleSmiths may store the information I submit and contact me about my enquiry."

export const legalRoutes = [
  "privacy", "cookies", "website-terms", "service-terms", "hosting-terms", "email-terms", "domain-dns-terms",
  "acceptable-use", "fair-use", "data-processing", "subprocessors", "cancellations", "complaints", "security", "accessibility",
] as const
export type LegalSlug = typeof legalRoutes[number]

export const LEGAL_LINKS = [
  { href: "/legal", label: "Legal" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/cookies", label: "Cookies" },
  { href: "/legal/website-terms", label: "Terms" },
] as const

export function legalMetadata(title: string, slug: LegalSlug): Metadata {
  return { title, description: `${title} for ScaleSmiths services and scalesmiths.co.uk.`, alternates: { canonical: `/legal/${slug}` }, robots: { index: true, follow: true } }
}

export function legalSitemapEntries(base: string): MetadataRoute.Sitemap {
  const modified = new Date(LEGAL_LAST_MODIFIED_ISO)
  return [{ url: `${base}/legal`, lastModified: modified, changeFrequency: "yearly" as const, priority: 0.5 }, ...legalRoutes.map((slug) => ({ url: `${base}/legal/${slug}`, lastModified: modified, changeFrequency: "yearly" as const, priority: 0.35 }))]
}

export const privacyMetadata = legalMetadata("Privacy Notice", "privacy")
export const termsMetadata = legalMetadata("Website Terms", "website-terms")
