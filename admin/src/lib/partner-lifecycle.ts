/**
 * Partner application lifecycle. Mirrors partner_application_transition_allowed() in migration 0095, which is the
 * authority; this copy exists so the founder workspace offers only legal moves and the service can explain a refusal.
 */
export const APPLICATION_STATUSES = [
  "submitted", "under_review", "information_requested", "conversation_arranged", "assessment_in_progress",
  "approved_in_principle", "agreement_pending", "onboarding", "activated", "declined", "withdrawn", "archived",
] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

const TERMINAL_EXITS = ["declined", "withdrawn", "archived"] as const

export const APPLICATION_TRANSITIONS: Readonly<Record<ApplicationStatus, readonly ApplicationStatus[]>> = {
  submitted: ["under_review", ...TERMINAL_EXITS],
  under_review: ["information_requested", "conversation_arranged", "assessment_in_progress", "approved_in_principle", ...TERMINAL_EXITS],
  information_requested: ["under_review", "conversation_arranged", "assessment_in_progress", ...TERMINAL_EXITS],
  conversation_arranged: ["under_review", "information_requested", "assessment_in_progress", "approved_in_principle", ...TERMINAL_EXITS],
  assessment_in_progress: ["under_review", "information_requested", "conversation_arranged", "approved_in_principle", ...TERMINAL_EXITS],
  approved_in_principle: ["assessment_in_progress", "agreement_pending", ...TERMINAL_EXITS],
  agreement_pending: ["approved_in_principle", "onboarding", ...TERMINAL_EXITS],
  // 'activated' is reached only by the partner accepting the issued agreement, never by a founder command.
  onboarding: ["agreement_pending", "activated", ...TERMINAL_EXITS],
  declined: ["under_review", "archived"],
  withdrawn: ["under_review", "archived"],
  activated: [],
  archived: [],
}

/** Statuses a founder may set by review. 'submitted' is set only by the public form, 'activated' only by activation. */
export const FOUNDER_REVIEW_STATUSES = APPLICATION_STATUSES.filter((s) => s !== "submitted" && s !== "activated")

export const APPLICATION_STATUS_LABELS: Readonly<Record<ApplicationStatus, string>> = {
  submitted: "Application received",
  under_review: "Under review",
  information_requested: "Information requested",
  conversation_arranged: "Conversation arranged",
  assessment_in_progress: "Assessment in progress",
  approved_in_principle: "Approved in principle",
  agreement_pending: "Agreement pending",
  onboarding: "Ready to invite",
  activated: "Active partner",
  declined: "Declined",
  withdrawn: "Withdrawn",
  archived: "Archived",
}

export function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return typeof value === "string" && (APPLICATION_STATUSES as readonly string[]).includes(value)
}

export function canTransition(from: unknown, to: unknown): boolean {
  if (!isApplicationStatus(from) || !isApplicationStatus(to)) return false
  return from === to || APPLICATION_TRANSITIONS[from].includes(to)
}

/** Founder-facing next moves from a status (excluding the current one and the activation-only step). */
export function founderNextStatuses(from: unknown): ApplicationStatus[] {
  if (!isApplicationStatus(from)) return []
  return APPLICATION_TRANSITIONS[from].filter((s) => s !== "activated")
}
