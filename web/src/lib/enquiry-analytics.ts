import type { EnquiryAttribution } from "./enquiry-attribution"

export type EnquiryAnalyticsName = "enquiry_form_start" | "generate_lead"

export interface EnquiryAnalyticsEvent {
  name: EnquiryAnalyticsName
  params: Record<string, string>
}

/**
 * GA4 parameters for an enquiry milestone. Contact details, briefs and query
 * strings stay out of the event. Callers must also check analytics consent.
 */
export function buildEnquiryAnalyticsEvent(input: {
  name: EnquiryAnalyticsName
  intent: string
  funnelType: string
  attribution: EnquiryAttribution
}): EnquiryAnalyticsEvent {
  const pagePath = input.attribution.submissionPath?.split("?")[0] || "/"
  const params: Record<string, string | null> = {
    enquiry_intent: cleanLabel(input.intent),
    funnel_type: cleanLabel(input.funnelType),
    page_path: pagePath.startsWith("/") ? pagePath.slice(0, 120) : "/",
    referrer_host: input.attribution.referrerHost,
    utm_source: input.attribution.utmSource,
    utm_medium: input.attribution.utmMedium,
    utm_campaign: input.attribution.utmCampaign,
  }
  return {
    name: input.name,
    params: Object.fromEntries(Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1]))),
  }
}

function cleanLabel(value: string) {
  const cleaned = value.trim().slice(0, 40)
  return /^[a-z0-9_-]+$/i.test(cleaned) ? cleaned : "quote"
}
