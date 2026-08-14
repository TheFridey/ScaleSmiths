export const ENQUIRY_INTENTS = {
  quote: "Request a Quote",
  discovery_call: "Request a Discovery Call",
  strategy_call: "Request a Strategy Call",
  v2_demo: "Request a V2 Demo",
  email_plan: "Email This Plan",
  local_growth_check: "Request a Local Growth Check",
  business_email: "Set Up Managed Business Email",
  business_growth_audit: "Start a Business Growth Audit",
} as const

export type EnquiryIntent = keyof typeof ENQUIRY_INTENTS

export const DEFAULT_ENQUIRY_INTENT: EnquiryIntent = "quote"

export function parseEnquiryIntent(value: unknown): EnquiryIntent {
  return typeof value === "string" && Object.hasOwn(ENQUIRY_INTENTS, value)
    ? value as EnquiryIntent
    : DEFAULT_ENQUIRY_INTENT
}

export function enquiryIntentLabel(intent: EnquiryIntent) {
  return ENQUIRY_INTENTS[intent]
}

export function enquiryIntentHref(intent: EnquiryIntent) {
  return `/quote?intent=${encodeURIComponent(intent)}`
}

export function enquiryIntentFromLocation(search: string) {
  return parseEnquiryIntent(new URLSearchParams(search).get("intent"))
}
