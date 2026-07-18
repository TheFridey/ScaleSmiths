import type { Metadata, MetadataRoute } from "next"

export const LEGAL_LAST_UPDATED = "18 July 2026"
export const LEGAL_VERSION = "1.0"
export const PRIVACY_CONTACT_EMAIL = "hello@scalesmiths.co.uk"

export const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
] as const

export const ENQUIRY_CONSENT_COPY =
  "I agree that ScaleSmiths may store the information I submit and contact me about my enquiry."

export const privacyMetadata: Metadata = {
  title: "Privacy Notice",
  description: "How ScaleSmiths collects, uses, stores and protects personal information.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
}

export const termsMetadata: Metadata = {
  title: "Website Terms",
  description: "Terms for using the ScaleSmiths public website and client portal.",
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
}

export function legalSitemapEntries(base: string): MetadataRoute.Sitemap {
  return [
    { url: `${base}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.4 },
  ]
}
