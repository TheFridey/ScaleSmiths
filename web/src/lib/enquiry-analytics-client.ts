"use client"

import { sendConsentedAnalyticsEvent } from "@/components/GoogleAnalytics"
import { buildEnquiryAnalyticsEvent } from "./enquiry-analytics"
import { readEnquiryAttribution } from "./enquiry-attribution-client"

export function trackEnquiryAnalytics(kind: "start" | "complete", context: { intent: string; funnelType: string }) {
  const event = buildEnquiryAnalyticsEvent({
    name: kind === "start" ? "enquiry_form_start" : "generate_lead",
    intent: context.intent,
    funnelType: context.funnelType,
    attribution: readEnquiryAttribution(),
  })
  sendConsentedAnalyticsEvent(event.name, event.params)
}
