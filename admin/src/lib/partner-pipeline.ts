/**
 * Operation Ascend B2.1: the partner pipeline model. Pure: no database, no network, no logging.
 *
 * Everything here is derived from records that already exist (the opportunity status, the partner's meeting requests, the
 * follow-up date and the audit trail). Nothing here can change a status: a column is a reading of the authoritative
 * expansion_opportunities.status, and the only transitions offered are the ones PARTNER_TRANSITIONS already permits,
 * which the server re-checks (with commercial clearance) on every request.
 */
import { DISCOVERY_FIELDS, PARTNER_TRANSITIONS } from "./expansion"
import { explain, MEETING_STATUS, OPPORTUNITY_STATUS } from "./partner-guidance"

export const PIPELINE_COLUMNS = [
  { key: "new", label: "New", statuses: ["registered", "contacted"], meaning: "Registered and not yet in discovery." },
  { key: "discovery", label: "Discovery", statuses: ["discovery", "qualified", "deferred"], meaning: "Finding out what the business needs." },
  { key: "information", label: "Information required", statuses: ["more_information", "bespoke_required"], meaning: "ScaleSmiths needs more before deciding." },
  { key: "review", label: "With ScaleSmiths", statuses: ["scope_submitted"], meaning: "Scope submitted and under founder review." },
  { key: "approved", label: "Approved", statuses: ["approved"], meaning: "Scope approved; the client has not signed yet." },
  { key: "won", label: "Contract accepted", statuses: ["contract_accepted"], meaning: "The client has signed." },
  { key: "closed", label: "Closed", statuses: ["closed_lost", "withdrawn"], meaning: "No longer going ahead." },
] as const
export type PipelineColumnKey = (typeof PIPELINE_COLUMNS)[number]["key"]

export function columnFor(status: unknown): PipelineColumnKey | null {
  return PIPELINE_COLUMNS.find((c) => (c.statuses as readonly string[]).includes(String(status)))?.key ?? null
}

export const OPEN_MEETING = ["requested", "under_review", "info_required", "alternative_proposed"] as const
export type PipelineMeeting = { id: string; status: string; meetingType: string; confirmedStart: string | null; proposedStart: string | null; createdAt: string }
export type MeetingState = "none" | "pending" | "awaiting_you" | "confirmed"

/** The most relevant meeting signal for one opportunity: a meeting that needs the partner beats a confirmed one beats a pending one. */
export function meetingState(meetings: readonly PipelineMeeting[], now: Date): MeetingState {
  if (meetings.some((m) => m.status === "alternative_proposed" || m.status === "info_required")) return "awaiting_you"
  if (meetings.some((m) => m.status === "confirmed" && m.confirmedStart && new Date(m.confirmedStart).getTime() >= now.getTime())) return "confirmed"
  if (meetings.some((m) => (OPEN_MEETING as readonly string[]).includes(m.status))) return "pending"
  return "none"
}

/** The discovery answers the server requires before a scope can be submitted (mirrors partnerMutation submit_scope). */
export const SCOPE_REQUIRED_FIELDS = ["objectives", "pages", "functionality", "budget", "timescale", "decisionProcess"] as const
export function missingScopeFields(discovery: unknown): string[] {
  const d = discovery && typeof discovery === "object" && !Array.isArray(discovery) ? (discovery as Record<string, unknown>) : {}
  return SCOPE_REQUIRED_FIELDS.filter((k) => typeof d[k] !== "string" || !(d[k] as string).trim())
}
export const discoveryAnswered = (discovery: unknown) => {
  const d = discovery && typeof discovery === "object" && !Array.isArray(discovery) ? (discovery as Record<string, unknown>) : {}
  return DISCOVERY_FIELDS.filter((k) => typeof d[k] === "string" && (d[k] as string).trim()).length
}

export type AttentionReason = { key: string; label: string }
/**
 * Why an opportunity needs the partner's action now. Each reason is a fact about existing records, never a prediction,
 * and none of them is a score or a ranking of the business.
 */
export function attentionFor(input: { status: string; discovery: unknown; followUp: string | null; meetings: readonly PipelineMeeting[] }, now: Date): AttentionReason[] {
  const out: AttentionReason[] = []
  if (["more_information", "bespoke_required"].includes(input.status)) out.push({ key: "information", label: "ScaleSmiths asked for more information" })
  if (meetingState(input.meetings, now) === "awaiting_you") out.push({ key: "meeting", label: "A meeting request is waiting for your reply" })
  if (input.followUp && new Date(input.followUp).getTime() <= now.getTime() && columnFor(input.status) !== "closed") out.push({ key: "follow_up", label: "Your follow-up date has arrived" })
  if (["registered", "contacted"].includes(input.status) && discoveryAnswered(input.discovery) === 0) out.push({ key: "discovery", label: "Discovery has not started" })
  if (["discovery", "qualified"].includes(input.status) && missingScopeFields(input.discovery).length === 0) out.push({ key: "scope_ready", label: "Discovery is complete enough to submit the scope" })
  return out
}

export const TRANSITION_LABELS: Readonly<Record<string, string>> = {
  contacted: "Mark as contacted", discovery: "Move to discovery", qualified: "Mark as qualified", closed_lost: "Mark as declined", withdrawn: "Withdraw",
}
/** Why a target status cannot be chosen by a partner. The server enforces the same rule; this text only explains it. */
export function transitionBlockedReason(from: string, to: string): string | null {
  if (PARTNER_TRANSITIONS[from]?.includes(to)) return null
  if (from === to) return "This is the current stage."
  if (["closed_lost", "withdrawn", "contract_accepted"].includes(from)) return "This opportunity is closed; ask ScaleSmiths if it should be reopened."
  if (from === "scope_submitted") return "ScaleSmiths is reviewing the scope; the next stage is a founder decision."
  if (from === "approved") return "The scope is approved; contract acceptance is recorded by ScaleSmiths."
  if (to === "scope_submitted") return "Submit the scope from the opportunity's discovery form."
  if (["approved", "contract_accepted", "more_information", "bespoke_required", "deferred"].includes(to)) return "Only ScaleSmiths can record this outcome."
  return "This stage requires the approved commercial workflow."
}
export function transitionOptions(from: string) {
  return (PARTNER_TRANSITIONS[from] ?? []).map((to) => ({ to, label: TRANSITION_LABELS[to] ?? explain(OPPORTUNITY_STATUS, to).label }))
}

/**
 * The audit actions a partner may see on their own opportunity's timeline, with partner-safe wording. Anything absent
 * (founder classification, market and exclusivity decisions, review notes, pricing) is never shown, because its outcome
 * could reveal another client's protected sector or ScaleSmiths' internal assessment.
 */
const SCOPE_OUTCOME: Readonly<Record<string, string>> = {
  approved: "ScaleSmiths approved the scope", more_information: "ScaleSmiths asked for more information", bespoke_required: "ScaleSmiths asked for a bespoke review",
  deferred: "ScaleSmiths deferred the opportunity", closed_lost: "ScaleSmiths declined the opportunity",
}
/** Audit actions written by expansion-operations (meeting_<partner action> and meeting_<founder decision>). */
const MEETING_EVENT: Readonly<Record<string, string>> = {
  meeting_requested: "Meeting requested", meeting_review: "Meeting request under review", meeting_request_information: "ScaleSmiths asked for meeting details",
  meeting_propose_alternative: "ScaleSmiths proposed another time", meeting_confirm: "Meeting confirmed", meeting_decline: "Meeting request declined",
  meeting_complete: "Meeting completed", meeting_cancel: "Meeting cancelled", meeting_accept_alternative: "Proposed time accepted",
  meeting_decline_alternative: "Another time requested", meeting_add_information: "Meeting details added",
}
export type TimelineSource = { action: string; details: unknown; createdAt: string; byPartner: boolean }
export type TimelineEntry = { at: string; label: string; actor: "you" | "scalesmiths"; kind: "opportunity" | "meeting" | "payment" | "interaction" | "follow_up" }
export function timelineEntry(row: TimelineSource): TimelineEntry | null {
  const d = (row.details && typeof row.details === "object" ? row.details : {}) as Record<string, unknown>
  const actor = row.byPartner ? "you" : "scalesmiths"
  const status = (v: unknown) => explain(OPPORTUNITY_STATUS, v).label
  switch (row.action) {
    case "prospect_registered": return { at: row.createdAt, label: "Prospect registered", actor, kind: "opportunity" }
    case "stage_changed": return { at: row.createdAt, label: `Stage changed from ${status(d.from)} to ${status(d.to)}`, actor, kind: "opportunity" }
    case "discovery_saved": return { at: row.createdAt, label: "Discovery updated", actor, kind: "opportunity" }
    case "scope_submitted": return { at: row.createdAt, label: "Scope submitted for review", actor, kind: "opportunity" }
    case "scope_reviewed": return Object.hasOwn(SCOPE_OUTCOME, String(d.decision)) ? { at: row.createdAt, label: SCOPE_OUTCOME[String(d.decision)], actor: "scalesmiths", kind: "opportunity" } : null
    case "contract_accepted": return { at: row.createdAt, label: "Contract accepted by the client", actor: "scalesmiths", kind: "opportunity" }
    case "contract_cancelled": return { at: row.createdAt, label: "Contract ended", actor: "scalesmiths", kind: "opportunity" }
    case "interaction_recorded": return { at: row.createdAt, label: `Interaction recorded (${String(d.kind ?? "note")})`, actor, kind: "interaction" }
    case "follow_up_scheduled": return { at: row.createdAt, label: d.cleared ? "Follow-up date cleared" : "Follow-up date set", actor, kind: "follow_up" }
    case "payment_verified": return { at: row.createdAt, label: "Qualifying payment verified", actor: "scalesmiths", kind: "payment" }
    case "payment_reversed": return { at: row.createdAt, label: "Payment adjustment recorded", actor: "scalesmiths", kind: "payment" }
    default: return Object.hasOwn(MEETING_EVENT, row.action) ? { at: row.createdAt, label: MEETING_EVENT[row.action], actor, kind: "meeting" } : null
  }
}

export const INTERACTION_KINDS = ["call", "email", "meeting", "message", "note"] as const
export type InteractionKind = (typeof INTERACTION_KINDS)[number]

export type PipelineCard = {
  id: string; businessName: string; status: string; statusLabel: string; column: PipelineColumnKey | null; createdAt: string; updatedAt: string
  lastActivity: string; followUp: string | null; meeting: MeetingState; meetingLabel: string | null; attention: AttentionReason[]; industry: string | null
  transitions: { to: string; label: string }[]
}
export type PipelineFilter = { q?: string; column?: string; meeting?: string; attention?: boolean; sort?: "activity" | "created" | "name" | "follow_up" }

/** Client-side narrowing over the partner's own cards (the server already limits rows to the partner and to a bounded count). */
export function filterPipeline(cards: readonly PipelineCard[], f: PipelineFilter): PipelineCard[] {
  const q = (f.q ?? "").trim().toLowerCase()
  const out = cards.filter((c) => (!q || c.businessName.toLowerCase().includes(q) || (c.industry ?? "").toLowerCase().includes(q))
    && (!f.column || c.column === f.column) && (!f.meeting || c.meeting === f.meeting) && (!f.attention || c.attention.length > 0))
  const time = (v: string | null) => (v ? new Date(v).getTime() : Number.POSITIVE_INFINITY)
  const sort = f.sort ?? "activity"
  return out.sort((a, b) => sort === "name" ? a.businessName.localeCompare(b.businessName, "en-GB")
    : sort === "created" ? time(b.createdAt) - time(a.createdAt)
    : sort === "follow_up" ? time(a.followUp) - time(b.followUp) || a.businessName.localeCompare(b.businessName, "en-GB")
    : time(b.lastActivity) - time(a.lastActivity))
}

export function meetingLabel(state: MeetingState): string | null {
  return state === "none" ? null : state === "awaiting_you" ? "Meeting needs your reply" : state === "confirmed" ? explain(MEETING_STATUS, "confirmed").label : "Meeting requested"
}
