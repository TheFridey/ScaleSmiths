export const TOOLKIT_STATUSES = ["not_requested", "planned", "awaiting_approval", "in_preparation", "available", "completed", "unavailable"] as const
export type ToolkitStatus = (typeof TOOLKIT_STATUSES)[number]
/**
 * The onboarding toolkit catalogue. `builtIn` items exist in this software today; everything else is MANUAL fulfilment and
 * defaults to "planned" until a founder records real evidence. Nothing is provisioned, purchased or sent from here.
 */
export const TOOLKIT_CATALOGUE = [
  { key: "email", label: "Dedicated ScaleSmiths email address", builtIn: false },
  { key: "circlecard", label: "Personalised CircleCard", builtIn: false },
  { key: "business_card", label: "Digital business card", builtIn: false },
  { key: "referral_identifier", label: "Unique referral identifier", builtIn: false },
  { key: "brochures", label: "Professional branded brochures", builtIn: false },
  { key: "pricing_documents", label: "Pricing documentation", builtIn: false },
  { key: "commission_documents", label: "Commission documentation", builtIn: false },
  { key: "industry_demonstrations", label: "Industry-specific website demonstrations", builtIn: false },
  { key: "researched_prospects", label: "Researched prospects", builtIn: false },
  { key: "academy", label: "Partner Academy access", builtIn: false },
  { key: "founder_training", label: "Optional founder-led training", builtIn: false },
  { key: "technical_assistance", label: "Technical assistance", builtIn: false },
  { key: "joint_meetings", label: "Joint sales meetings", builtIn: false },
  { key: "personal_webpage", label: "Personal webpage", builtIn: false },
] as const
export type ToolkitKey = (typeof TOOLKIT_CATALOGUE)[number]["key"]
export const isToolkitKey = (value: unknown): value is ToolkitKey => TOOLKIT_CATALOGUE.some((item) => item.key === value)

export const MEETING_TYPES = ["joint_sales", "technical_scoping", "bespoke_discovery", "commercial_assistance", "proposal_review", "training", "escalation"] as const
export type MeetingType = (typeof MEETING_TYPES)[number]
export const MEETING_TRANSITIONS: Record<string, readonly string[]> = {
  requested: ["under_review", "info_required", "alternative_proposed", "confirmed", "declined", "cancelled"],
  under_review: ["info_required", "alternative_proposed", "confirmed", "declined", "cancelled"],
  info_required: ["requested", "declined", "cancelled"],
  alternative_proposed: ["confirmed", "requested", "declined", "cancelled"],
  confirmed: ["completed", "cancelled"],
}
/** A valid IANA time zone, using the platform's own database rather than a hand-written list. */
export function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 3 || value.length > 64) return false
  try { new Intl.DateTimeFormat("en-GB", { timeZone: value }); return true } catch { return false }
}
