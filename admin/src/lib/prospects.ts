export const PROSPECT_SOURCES = ["linkedin", "email", "facebook", "local", "referral", "inbound", "other"] as const
export const PROSPECT_STAGES = ["found", "audited", "contacted", "replied", "discovery_booked", "proposal_sent", "follow_up_due", "won", "lost"] as const
export const PROSPECT_PRIORITIES = ["low", "medium", "high"] as const
export const OUTREACH_ACTIVITY_TYPES = ["linkedin_message", "email", "phone_call", "facebook_message", "in_person", "follow_up", "proposal", "note"] as const
export const OUTREACH_DIRECTIONS = ["outbound", "inbound", "internal"] as const
export const PROPOSAL_PACKAGE_TYPES = ["foundation", "growth", "forge", "retainer", "custom"] as const
export const PROPOSAL_STATUSES = ["draft", "sent", "viewed", "follow_up_due", "accepted", "rejected"] as const

export type ProspectSource = (typeof PROSPECT_SOURCES)[number]
export type ProspectStage = (typeof PROSPECT_STAGES)[number]
export type ProspectPriority = (typeof PROSPECT_PRIORITIES)[number]
export type OutreachActivityType = (typeof OUTREACH_ACTIVITY_TYPES)[number]
export type OutreachDirection = (typeof OUTREACH_DIRECTIONS)[number]
export type ProposalPackageType = (typeof PROPOSAL_PACKAGE_TYPES)[number]
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number]

export const STAGE_LABELS: Record<ProspectStage, string> = {
  found: "Found",
  audited: "Audited",
  contacted: "Contacted",
  replied: "Replied",
  discovery_booked: "Discovery Booked",
  proposal_sent: "Proposal Sent",
  follow_up_due: "Follow-up Due",
  won: "Won",
  lost: "Lost",
}

/**
 * Probability that an open prospect at a given stage converts to a won deal.
 * Used for weighted-pipeline (expected value) forecasting. Lightweight, deterministic.
 */
export const STAGE_WIN_PROBABILITY: Record<ProspectStage, number> = {
  found: 0.05,
  audited: 0.1,
  contacted: 0.15,
  replied: 0.25,
  discovery_booked: 0.4,
  proposal_sent: 0.6,
  follow_up_due: 0.5,
  won: 1,
  lost: 0,
}

type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string }

export interface ProspectWrite {
  businessName: string
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  websiteUrl?: string | null
  location?: string | null
  industry?: string | null
  source: ProspectSource
  stage: ProspectStage
  estimatedProjectValue: number
  estimatedMonthlyRetainer: number
  priority: ProspectPriority
  revenueScore: number
  trustScore: number
  conversionScore: number
  seoScore: number
  mobileScore: number
  auditSummary?: string | null
  painPoints?: string | null
  opportunityNotes?: string | null
  objectionNotes?: string | null
  nextFollowUpAt?: Date | null
  lastContactedAt?: Date | null
  discoveryCallAt?: Date | null
  proposalSentAt?: Date | null
  wonAt?: Date | null
  lostAt?: Date | null
  lostReason?: string | null
}

export interface OutreachActivityWrite {
  type: OutreachActivityType
  direction: OutreachDirection
  subject?: string | null
  body?: string | null
  outcome?: string | null
  createdBy?: string | null
}

export interface ProposalWrite {
  packageType: ProposalPackageType
  quotedAmount: number
  monthlyRetainerAmount: number
  status: ProposalStatus
  sentAt?: Date | null
  acceptedAt?: Date | null
  rejectedAt?: Date | null
  notes?: string | null
}

export interface ProspectMetricRow {
  stage: ProspectStage
  estimatedProjectValue: number
  estimatedMonthlyRetainer: number
  nextFollowUpAt: Date | string | null
  discoveryCallAt?: Date | string | null
  proposalSentAt?: Date | string | null
  wonAt?: Date | string | null
  lostAt?: Date | string | null
}

export interface ActivityMetricRow {
  direction: OutreachDirection
  createdAt: Date | string
}

export interface ProposalMetricRow {
  status: ProposalStatus
  sentAt?: Date | string | null
}

export interface ClientConversionInput {
  businessName: string
  contactName?: string | null
  contactEmail?: string | null
  estimatedMonthlyRetainer: number
}

export function isProspectStage(value: unknown): value is ProspectStage {
  return includesValue(PROSPECT_STAGES, value)
}

export function isClosedStage(stage: ProspectStage) {
  return stage === "won" || stage === "lost"
}

export function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

export function parseProspectPayload(input: Record<string, unknown>, mode: "create" | "patch" = "create"): ParseResult<Partial<ProspectWrite> & { businessName?: string }> {
  const businessName = optionalString(input.businessName)

  if (mode === "create" && !businessName) {
    return { ok: false, error: "Business name is required." }
  }

  const source = parseEnumField(input.source, PROSPECT_SOURCES, mode === "create" ? "other" : null, "Source")
  const stage = parseEnumField(input.stage, PROSPECT_STAGES, mode === "create" ? "found" : null, "Stage")
  const priority = parseEnumField(input.priority, PROSPECT_PRIORITIES, mode === "create" ? "medium" : null, "Priority")
  const contactEmail = optionalString(input.contactEmail)
  const websiteUrl = optionalString(input.websiteUrl)

  if (!source.ok) return source
  if (!stage.ok) return stage
  if (!priority.ok) return priority

  if (contactEmail && !isValidEmail(contactEmail)) {
    return { ok: false, error: "Enter a valid contact email." }
  }

  if (websiteUrl && !isValidUrl(websiteUrl)) {
    return { ok: false, error: "Website URL must include http:// or https://." }
  }

  const moneyFields = ["estimatedProjectValue", "estimatedMonthlyRetainer"] as const
  const scoreFields = ["revenueScore", "trustScore", "conversionScore", "seoScore", "mobileScore"] as const
  const dateFields = ["nextFollowUpAt", "lastContactedAt", "discoveryCallAt", "proposalSentAt", "wonAt", "lostAt"] as const
  const data: Partial<ProspectWrite> & { businessName?: string } = {
    businessName: businessName ?? undefined,
  }

  assignString(data, input, "contactName")
  assignString(data, input, "contactEmail", contactEmail)
  assignString(data, input, "contactPhone")
  assignString(data, input, "websiteUrl", websiteUrl)
  assignString(data, input, "location")
  assignString(data, input, "industry")
  assignString(data, input, "auditSummary")
  assignString(data, input, "painPoints")
  assignString(data, input, "opportunityNotes")
  assignString(data, input, "objectionNotes")
  assignString(data, input, "lostReason")
  if (source.data) data.source = source.data
  if (stage.data) data.stage = stage.data
  if (priority.data) data.priority = priority.data

  for (const field of moneyFields) {
    if (mode === "patch" && !(field in input)) continue
    const parsed = parseNonNegativeInteger(input[field], field === "estimatedProjectValue" ? "Estimated project value" : "Estimated monthly retainer")
    if (!parsed.ok) return parsed
    data[field] = parsed.data
  }

  for (const field of scoreFields) {
    if (mode === "patch" && !(field in input)) continue
    const parsed = parseScore(input[field], toLabel(field))
    if (!parsed.ok) return parsed
    data[field] = parsed.data
  }

  for (const field of dateFields) {
    if (mode === "patch" && !(field in input)) continue
    const parsed = parseOptionalDate(input[field], toLabel(field))
    if (!parsed.ok) return parsed
    data[field] = parsed.data
  }

  if (mode === "patch") {
    return {
      ok: true,
      data: Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)),
    }
  }

  return { ok: true, data }
}

export function parseOutreachActivityPayload(input: Record<string, unknown>): ParseResult<OutreachActivityWrite> {
  const type = parseEnumField(input.type, OUTREACH_ACTIVITY_TYPES, null, "Activity type")
  const direction = parseEnumField(input.direction, OUTREACH_DIRECTIONS, null, "Activity direction")

  if (!type.ok) return type
  if (!direction.ok) return direction
  if (!type.data) return { ok: false, error: "Activity type is required." }
  if (!direction.data) return { ok: false, error: "Activity direction is required." }

  const body = optionalString(input.body)
  const subject = optionalString(input.subject)

  if (!body && !subject) {
    return { ok: false, error: "Add a subject or note body for the activity." }
  }

  return {
    ok: true,
    data: {
      type: type.data,
      direction: direction.data,
      subject,
      body,
      outcome: optionalString(input.outcome),
      createdBy: optionalString(input.createdBy),
    },
  }
}

export function parseProposalPayload(input: Record<string, unknown>): ParseResult<ProposalWrite> {
  const packageType = parseEnumField(input.packageType, PROPOSAL_PACKAGE_TYPES, "custom", "Package type")
  const status = parseEnumField(input.status, PROPOSAL_STATUSES, "sent", "Proposal status")
  const quotedAmount = parseNonNegativeInteger(input.quotedAmount, "Quoted amount")
  const monthlyRetainerAmount = parseNonNegativeInteger(input.monthlyRetainerAmount, "Monthly retainer amount")
  const sentAt = parseOptionalDate(input.sentAt, "Sent date")
  const acceptedAt = parseOptionalDate(input.acceptedAt, "Accepted date")
  const rejectedAt = parseOptionalDate(input.rejectedAt, "Rejected date")

  if (!packageType.ok) return packageType
  if (!status.ok) return status
  if (!quotedAmount.ok) return quotedAmount
  if (!monthlyRetainerAmount.ok) return monthlyRetainerAmount
  if (!sentAt.ok) return sentAt
  if (!acceptedAt.ok) return acceptedAt
  if (!rejectedAt.ok) return rejectedAt

  return {
    ok: true,
    data: {
      packageType: packageType.data,
      status: status.data,
      quotedAmount: quotedAmount.data,
      monthlyRetainerAmount: monthlyRetainerAmount.data,
      sentAt: sentAt.data,
      acceptedAt: acceptedAt.data,
      rejectedAt: rejectedAt.data,
      notes: optionalString(input.notes),
    },
  }
}

export function stageDateUpdates(stage: ProspectStage, now = new Date(), existing?: Partial<ProspectWrite>) {
  const updates: Partial<ProspectWrite> = { stage }

  if (stage === "contacted" && !existing?.lastContactedAt) updates.lastContactedAt = now
  if (stage === "proposal_sent" && !existing?.proposalSentAt) updates.proposalSentAt = now
  if (stage === "won" && !existing?.wonAt) updates.wonAt = now
  if (stage === "lost" && !existing?.lostAt) updates.lostAt = now

  return updates
}

export function getFollowUpBucket(nextFollowUpAt: Date | string | null | undefined, now = new Date()): "today" | "overdue" | "upcoming" | null {
  if (!nextFollowUpAt) return null

  const followUp = toDate(nextFollowUpAt)
  if (!followUp) return null

  const start = startOfDay(now)
  const end = endOfDay(now)

  if (followUp < start) return "overdue"
  if (followUp <= end) return "today"
  return "upcoming"
}

export function computeSalesMetrics(prospects: ProspectMetricRow[], activities: ActivityMetricRow[], proposals: ProposalMetricRow[], now = new Date()) {
  const weekStart = startOfWeek(now)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const activeProspects = prospects.filter((prospect) => !isClosedStage(prospect.stage))
  const proposalsThisWeek = proposals.filter((proposal) => isInRange(proposal.sentAt, weekStart, now)).length
  const proposalSentThisWeekFromProspects = prospects.filter((prospect) => isInRange(prospect.proposalSentAt, weekStart, now)).length
  const byStage = Object.fromEntries(PROSPECT_STAGES.map((stage) => [stage, 0])) as Record<ProspectStage, number>

  for (const prospect of prospects) {
    byStage[prospect.stage] += 1
  }

  const followUpsDueToday = activeProspects.filter((prospect) => getFollowUpBucket(prospect.nextFollowUpAt, now) === "today").length
  const overdueFollowUps = activeProspects.filter((prospect) => getFollowUpBucket(prospect.nextFollowUpAt, now) === "overdue").length
  const wonCount = prospects.filter((prospect) => prospect.stage === "won").length
  const lostCount = prospects.filter((prospect) => prospect.stage === "lost").length
  const repliedCount = prospects.filter((prospect) => stageIndex(prospect.stage) >= stageIndex("replied") && prospect.stage !== "lost").length
  const proposalCount = prospects.filter((prospect) => stageIndex(prospect.stage) >= stageIndex("proposal_sent") && prospect.stage !== "lost").length

  const pipelineValue = activeProspects.reduce((sum, prospect) => sum + prospect.estimatedProjectValue, 0)
  const weightedPipelineValue = Math.round(
    activeProspects.reduce((sum, prospect) => sum + prospect.estimatedProjectValue * (STAGE_WIN_PROBABILITY[prospect.stage] ?? 0), 0),
  )
  // Total proposals ever sent (by tracked proposalSentAt or stage progression past proposal_sent).
  const proposalsSentTotal = prospects.filter(
    (prospect) => Boolean(prospect.proposalSentAt) || stageIndex(prospect.stage) >= stageIndex("proposal_sent"),
  ).length

  return {
    outreachSentThisWeek: activities.filter((activity) => activity.direction === "outbound" && isInRange(activity.createdAt, weekStart, now)).length,
    repliesThisWeek: activities.filter((activity) => activity.direction === "inbound" && isInRange(activity.createdAt, weekStart, now)).length,
    discoveryCallsBooked: activeProspects.filter((prospect) => prospect.stage === "discovery_booked" || Boolean(prospect.discoveryCallAt)).length,
    proposalsSent: Math.max(proposalsThisWeek, proposalSentThisWeekFromProspects),
    dealsWonThisMonth: prospects.filter((prospect) => isInRange(prospect.wonAt, monthStart, now)).length,
    dealsLostThisMonth: prospects.filter((prospect) => isInRange(prospect.lostAt, monthStart, now)).length,
    pipelineValue,
    weightedPipelineValue,
    expectedMonthlyRetainerValue: activeProspects.reduce((sum, prospect) => sum + prospect.estimatedMonthlyRetainer, 0),
    followUpsDueToday,
    overdueFollowUps,
    prospectsByStage: byStage,
    replyRate: percentage(repliedCount, prospects.length),
    proposalRate: percentage(proposalCount, prospects.length),
    winRate: percentage(wonCount, wonCount + lostCount),
    // Derived executive metrics — lightweight, computed in-place.
    closeRate: percentage(wonCount, wonCount + lostCount),
    proposalConversionRate: percentage(wonCount, proposalsSentTotal),
    avgProjectValue: activeProspects.length ? Math.round(pipelineValue / activeProspects.length) : 0,
    avgRetainerValue: activeProspects.length
      ? Math.round(activeProspects.reduce((sum, prospect) => sum + prospect.estimatedMonthlyRetainer, 0) / activeProspects.length)
      : 0,
    openProspects: activeProspects.length,
  }
}

export function buildClientFromWonProspect(prospect: ClientConversionInput) {
  return {
    name: prospect.businessName,
    contactName: prospect.contactName ?? null,
    contactEmail: prospect.contactEmail ?? null,
    tier: prospect.estimatedMonthlyRetainer > 0 ? CLIENT_RETAINER_TIER : CLIENT_FORGE_BUILD_TIER,
    mrr: Math.max(0, prospect.estimatedMonthlyRetainer),
    status: DEFAULT_CLIENT_STATUS,
    progress: 0,
  }
}

function includesValue<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === "string" && values.includes(value as T[number])
}

function parseEnumField<T extends readonly string[], F extends T[number] | null>(value: unknown, values: T, fallback: F, label: string): ParseResult<T[number] | F> {
  if (value === undefined || value === null || value === "") return { ok: true, data: fallback }
  if (includesValue(values, value)) return { ok: true, data: value }
  return { ok: false, error: `${label} is invalid.` }
}

function assignString<T extends Partial<ProspectWrite>, K extends keyof ProspectWrite>(data: T, input: Record<string, unknown>, key: K, parsedValue?: string | null) {
  if (!(key in input)) return
  data[key] = (parsedValue ?? optionalString(input[key])) as T[K]
}

function parseNonNegativeInteger(value: unknown, label: string): ParseResult<number> {
  if (value === undefined || value === null || value === "") return { ok: true, data: 0 }

  const parsed = Number.parseInt(String(value), 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { ok: false, error: `${label} must be zero or more.` }
  }

  return { ok: true, data: parsed }
}

function parseScore(value: unknown, label: string): ParseResult<number> {
  if (value === undefined || value === null || value === "") return { ok: true, data: 0 }

  const parsed = Number.parseInt(String(value), 10)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10) {
    return { ok: false, error: `${label} must be between 0 and 10.` }
  }

  return { ok: true, data: parsed }
}

function parseOptionalDate(value: unknown, label: string): ParseResult<Date | null> {
  if (value === undefined || value === null || value === "") return { ok: true, data: null }

  const parsed = toDate(value)
  if (!parsed) return { ok: false, error: `${label} must be a valid date.` }

  return { ok: true, data: parsed }
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isValidUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function toLabel(value: string) {
  return value.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`).replace(/^./, (letter) => letter.toUpperCase())
}

function toDate(value: Date | string | unknown) {
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date : null
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function endOfDay(value: Date) {
  const date = startOfDay(value)
  date.setDate(date.getDate() + 1)
  date.setMilliseconds(date.getMilliseconds() - 1)
  return date
}

function startOfWeek(value: Date) {
  const date = startOfDay(value)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return date
}

function isInRange(value: Date | string | null | undefined, start: Date, end: Date) {
  const date = value ? toDate(value) : null
  return Boolean(date && date >= start && date <= end)
}

function stageIndex(stage: ProspectStage) {
  return PROSPECT_STAGES.indexOf(stage)
}

function percentage(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0
}
import { CLIENT_FORGE_BUILD_TIER, CLIENT_RETAINER_TIER, DEFAULT_CLIENT_STATUS } from "@/lib/clients"
