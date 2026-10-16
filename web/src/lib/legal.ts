import type { Metadata, MetadataRoute } from "next"

export const LEGAL_VERSION = "2.3"
export const LEGAL_EFFECTIVE_DATE = "25 August 2026"
export const LEGAL_LAST_UPDATED = "16 October 2026"
export const LEGAL_LAST_MODIFIED_ISO = "2026-10-16T00:00:00.000Z"

export const legalEntity = {
  // Company and ICO identity checked against the public registers on 16 October 2026.
  // VAT registration is still unconfirmed and must stay unpublished.
  tradingName: "ScaleSmiths",
  legalName: "ScaleSmiths Ltd",
  entityType: "Private limited company",
  companyNumber: "17496624",
  registeredOffice: "27 Belle Isle Road, Nottingham, NG15 7JL, United Kingdom",
  registeredIn: "England and Wales",
  vatRegistered: null,
  vatNumber: null,
  icoRegistrationNumber: "ZC265402",
  businessLocation: "Hucknall, Nottinghamshire, United Kingdom",
  contactEmail: "hello@scalesmiths.co.uk",
  privacyEmail: "hello@scalesmiths.co.uk",
  complaintsEmail: "hello@scalesmiths.co.uk",
  securityEmail: "hello@scalesmiths.co.uk",
} as const

/** Customer-facing registration lines. Company number and ICO number are different registers. */
export function publicRegistrationSummary() {
  return `${legalEntity.legalName}, company number ${legalEntity.companyNumber}, registered in ${legalEntity.registeredIn}. Registered office: ${legalEntity.registeredOffice}. ICO registration number ${legalEntity.icoRegistrationNumber}.`
}

// Internal decision register. This is deliberately not rendered by any public route.
export const LEGAL_DECISIONS_REQUIRED = [
  "Confirm VAT registration status. Do not publish a VAT number until it is verified.",
  "Approve any financial liability cap for the Master Service Terms.",
  "Approve default notice, minimum commitment, cancellation and refund terms for recurring services.",
  "Record the production VPS provider, datacentre region and DPA status.",
  "Record Resend processing region and DPA status.",
  "Confirm the Managed Business Email infrastructure and backup subprocessors.",
] as const

// Internal decision register. This is deliberately not rendered by any public route.

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

/**
 * Each policy describes itself. Passing the document's own introduction gives every legal route a
 * distinct, substantive description instead of the same templated sentence with the title swapped
 * in, which reads as boilerplate to a reader and as near-duplicate metadata to a crawler.
 */
export function legalMetadata(title: string, slug: LegalSlug, introduction?: string): Metadata {
  const summary = introduction ? summariseForMeta(introduction) : `${title} for ScaleSmiths services, hosting, managed email and client work.`
  return { title, description: summary, alternates: { canonical: `/legal/${slug}` }, robots: { index: true, follow: true } }
}

/** First whole sentences of a policy introduction, trimmed to a usable meta-description length. */
export function summariseForMeta(text: string, limit = 158): string {
  const clean = text.replace(/\s+/g, " ").trim()
  if (clean.length <= limit) return clean
  const truncated = clean.slice(0, limit)
  const lastStop = truncated.lastIndexOf(". ")
  if (lastStop > limit * 0.5) return truncated.slice(0, lastStop + 1)
  const lastSpace = truncated.lastIndexOf(" ")
  return `${truncated.slice(0, lastSpace > 0 ? lastSpace : limit).replace(/[,;:]$/, "")}…`
}

export function legalSitemapEntries(base: string): MetadataRoute.Sitemap {
  const modified = new Date(LEGAL_LAST_MODIFIED_ISO)
  return [{ url: `${base}/legal`, lastModified: modified, changeFrequency: "yearly" as const, priority: 0.5 }, ...legalRoutes.map((slug) => ({ url: `${base}/legal/${slug}`, lastModified: modified, changeFrequency: "yearly" as const, priority: 0.35 }))]
}

export const privacyMetadata = legalMetadata("Privacy Notice", "privacy")
export const termsMetadata = legalMetadata("Website Terms", "website-terms")
