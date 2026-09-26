import type { Metadata } from "next"
import { ENTERPRISE_CONTACT_PATH, ENTERPRISE_CONTACT_THANKS_PATH } from "./enterprise-enquiry"
import { buildPageMetadata } from "./page-metadata"

export const enterpriseContactCopy = {
  metaTitle: "Enterprise Discovery Enquiry",
  metaDescription:
    "Start a focused enterprise discovery with ScaleSmiths. Share organisation context, operating constraints and system requirements so we can qualify a serious custom software conversation.",
  eyebrow: "Enterprise discovery",
  brand: "ScaleSmiths",
  title: "Start a focused enterprise discovery.",
  lede:
    "This is not the standard quote form. It captures enough organisational and technical context to qualify a serious custom software opportunity — without a bloated RFP.",
} as const

export function metadataForEnterpriseContactPage(): Metadata {
  return buildPageMetadata({
    title: enterpriseContactCopy.metaTitle,
    absoluteTitle: `${enterpriseContactCopy.metaTitle} | ScaleSmiths`,
    description: enterpriseContactCopy.metaDescription,
    path: ENTERPRISE_CONTACT_PATH,
    robots: { index: true, follow: true },
  })
}

export function metadataForEnterpriseContactThanksPage(): Metadata {
  return {
    title: "Enterprise Discovery Enquiry Received",
    robots: { index: false, follow: false },
    alternates: { canonical: ENTERPRISE_CONTACT_THANKS_PATH },
  }
}
