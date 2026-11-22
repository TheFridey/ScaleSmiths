/**
 * Operation Ascend B2.3: the founder sales command centre model. Pure: no database, no network.
 *
 * Every queue item and count is a reading of an existing record. The order is a fixed, published rule (the kind's place in
 * QUEUE_KINDS, then oldest first), never a hidden score, and partners are never ranked against each other.
 */
export const STALLED_AFTER_DAYS = 21
export const PROPOSAL_FOLLOW_UP_AFTER_DAYS = 7

export const QUEUE_KINDS = [
  { kind: "assistance", label: "Partner asked for help", rule: "An open meeting request for commercial help, technical scoping, bespoke discovery or escalation." },
  { kind: "meeting", label: "Meeting request", rule: "An open joint-sales, proposal-review or training meeting request awaiting a founder decision." },
  { kind: "scope_review", label: "Scope to review", rule: "A partner submitted a scope; nothing is committed until a founder decides." },
  { kind: "notification_failed", label: "Partner email failed", rule: "A partner lifecycle email was not delivered." },
  { kind: "application", label: "Partner application", rule: "A partner application is submitted or under review." },
  { kind: "proposal_follow_up", label: "Proposal follow-up", rule: `A scope was approved more than ${PROPOSAL_FOLLOW_UP_AFTER_DAYS} days ago and no contract is recorded.` },
  { kind: "stalled", label: "Stalled opportunity", rule: `An open opportunity with no recorded activity for ${STALLED_AFTER_DAYS} days.` },
] as const
export type QueueKind = (typeof QUEUE_KINDS)[number]["kind"]
export const ASSISTANCE_MEETING_TYPES = ["commercial_assistance", "technical_scoping", "bespoke_discovery", "escalation"] as const

export type QueueItem = {
  kind: QueueKind; id: string; title: string; partnerName: string | null; since: string; detail: string | null; href: string
  opportunityId: string | null; tags: string[]
}
const order = (k: QueueKind) => QUEUE_KINDS.findIndex((q) => q.kind === k)
/** Fixed priority: kind first, then the oldest item first, then id for a stable tie-break. */
export function sortQueue(items: readonly QueueItem[]): QueueItem[] {
  return [...items].sort((a, b) => order(a.kind) - order(b.kind) || a.since.localeCompare(b.since) || a.id.localeCompare(b.id))
}
export const ageInDays = (since: string, now: Date) => Math.max(0, Math.floor((now.getTime() - new Date(since).getTime()) / 86400000))

/** Destinations inside the existing founder workspace; every item opens a real record or the tab where it is decided. */
export const hrefFor = {
  opportunity: (id: string) => `/expansion?tab=pipeline&opportunity=${encodeURIComponent(id)}`,
  meetings: () => "/expansion?tab=operations",
  recruitment: () => "/expansion?tab=recruitment",
}
export const OPEN_STATUSES = ["registered", "contacted", "discovery", "qualified", "more_information", "bespoke_required", "deferred"] as const

export type AssignmentInput = { opportunityId: unknown; assigneeId: unknown; reason: unknown; expectedCurrentId: unknown }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Validates a founder assignment request; returns a message for the first problem, or null. */
export function assignmentProblem(input: AssignmentInput): string | null {
  if (typeof input.opportunityId !== "string" || !UUID.test(input.opportunityId)) return "Opportunity not found."
  if (input.assigneeId !== null && (typeof input.assigneeId !== "string" || !UUID.test(input.assigneeId))) return "Choose a founder, or release the assignment."
  if (input.expectedCurrentId !== null && (typeof input.expectedCurrentId !== "string" || !UUID.test(input.expectedCurrentId))) return "Reload to see the current assignment."
  if (typeof input.reason !== "string" || input.reason.trim().length < 3 || input.reason.trim().length > 500) return "Give a reason (3 to 500 characters)."
  return null
}
