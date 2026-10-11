export const COMMERCIAL_ACTIVITIES = [
  "company_researched",
  "contact_identified",
  "phone_call",
  "email",
  "whatsapp",
  "follow_up",
  "meeting_booked",
  "meeting_held",
  "proposal",
  "contract_signed",
] as const
export const COMMERCIAL_STAGES = [
  "found",
  "audited",
  "contact_identified",
  "contacted",
  "replied",
  "qualified",
  "discovery_booked",
  "proposal_required",
  "proposal_sent",
  "negotiation",
  "won",
  "lost",
] as const
export const COMMERCIAL_STAGE_LABELS: Record<string, string> = {
  found: "Research needed",
  audited: "Researched",
  contact_identified: "Contact identified",
  contacted: "Contact attempted",
  replied: "Conversation started",
  qualified: "Qualified opportunity",
  discovery_booked: "Discovery booked",
  proposal_required: "Proposal required",
  proposal_sent: "Proposal sent",
  negotiation: "Negotiation",
  follow_up_due: "Follow-up due",
  won: "Won",
  lost: "Lost",
}
export const DEFAULT_COMPANY_TARGETS: Record<string, number> = {
  company_researched: 40,
  contact_identified: 10,
  phone_call: 20,
  email: 20,
  follow_up: 10,
  meeting_held: 4,
  proposal: 2,
  contract_signed: 1,
  connections: 2,
  connectionStretch: 4,
}
export const DEFAULT_COMMERCIAL_CONFIG = {
  clientTarget: 28,
  mrrTarget: 980000,
  websitePrice: 200000,
  auditPrice: 39500,
  partnershipPrice: 35000,
  stretchRetainers: 2,
  contactWarningHours: 24,
}
export const CALL_OUTCOMES = [
  "No answer",
  "Voicemail",
  "Receptionist",
  "Decision-maker",
  "Interested",
  "Not interested",
  "Callback requested",
  "Meeting booked",
  "Other",
]
export const REVENUE_CATEGORIES = [
  "retainer",
  "premium_partnership",
  "website_build",
  "growth_audit",
  "performance",
] as const
export type RevenueCategory = (typeof REVENUE_CATEGORIES)[number]
export class CommercialError extends Error {
  constructor(
    message: string,
    public status = 400,
    public details?: unknown,
  ) {
    super(message)
  }
}
export function requiredText(
  value: unknown,
  label: string,
  max = 2000,
): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new CommercialError(
      `${label} is required (maximum ${max} characters).`,
    )
  return value.trim()
}
export function minorUnits(value: unknown) {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > 2147483647
  )
    throw new CommercialError("Amount must be a non-negative integer in pence.")
  return value
}
export function positiveId(value: unknown) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1)
    throw new CommercialError("Invalid record ID.")
  return value
}
export function validDate(value: unknown): Date {
  if (typeof value !== "string" || !/(Z|[+-]\d{2}:\d{2})$/.test(value))
    throw new CommercialError("Date requires an explicit timezone.")
  const date = new Date(value)
  if (!Number.isFinite(date.getTime()))
    throw new CommercialError("Invalid date.")
  return date
}
export function normalizedCompany(name: string) {
  return name
    .toLowerCase()
    .replace(/\b(limited|ltd)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
}
export function companyDomain(value: unknown) {
  if (!value) return null
  let url: URL
  try {
    url = new URL(requiredText(value, "Website", 500))
  } catch {
    throw new CommercialError("Website must be a valid HTTP or HTTPS URL.")
  }
  if (!["https:", "http:"].includes(url.protocol))
    throw new CommercialError("Website must use HTTP or HTTPS.")
  return url.hostname.toLowerCase().replace(/^www\./, "")
}
export function londonDay(value: Date | string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value))
}
export function londonWeek(value: Date | string) {
  const day = londonDay(value)
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
  return date.toISOString().slice(0, 10)
}
export function londonInputToISO(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new CommercialError("Enter a date and time in Europe/London.")
  const naive = new Date(`${value}:00Z`)
  const matches = [naive, new Date(naive.getTime() - 3600000)].filter(
    (date) => {
      const parts = Object.fromEntries(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Europe/London",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        })
          .formatToParts(date)
          .map((p) => [p.type, p.value]),
      )
      return (
        `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}` ===
        value
      )
    },
  )
  if (matches.length !== 1)
    throw new CommercialError(
      "This time is ambiguous or skipped by the UK clock change. Choose a different time.",
    )
  return matches[0].toISOString()
}
export function csvCell(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return `"${value}"`
  let text = String(value ?? "")
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}
export function nextLondonOccurrence(value: Date | string, days: number) {
  const date = new Date(value)
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  )
  const day = new Date(`${londonDay(date)}T12:00:00Z`)
  day.setUTCDate(day.getUTCDate() + days)
  return new Date(
    londonInputToISO(
      `${day.toISOString().slice(0, 10)}T${parts.hour}:${parts.minute}`,
    ),
  )
}
export function firstDecisionMakerConnections<
  T extends {
    contactId: number | null
    actorUserId: string | null
    outcome: string | null
    occurredAt: Date | string | null
    createdAt: Date | string
  },
>(activities: T[]): T[] {
  const seen = new Set<number>()
  return [...activities]
    .sort(
      (a, b) =>
        new Date(a.occurredAt ?? a.createdAt).getTime() -
        new Date(b.occurredAt ?? b.createdAt).getTime(),
    )
    .filter((activity) => {
      if (
        !activity.actorUserId ||
        !activity.contactId ||
        !activity.outcome?.startsWith("Decision-maker connection: ") ||
        seen.has(activity.contactId)
      )
        return false
      seen.add(activity.contactId)
      return true
    })
}
export function suggestCommercialActivity(
  note: string,
  leads: Array<{ id: number; businessName: string }>,
  now = new Date(),
) {
  const matches = leads.filter((l) =>
    note.toLowerCase().includes(l.businessName.toLowerCase()),
  )
  const type = /\b(called|phoned)\b/i.test(note)
    ? "phone_call"
    : /\bemailed\b/i.test(note)
      ? "email"
      : /\bwhatsapp\b/i.test(note)
        ? "whatsapp"
        : null
  let followUpAt: string | null = null
  const day = new Date(`${londonDay(now)}T12:00:00Z`)
  if (/\btomorrow\b/i.test(note)) {
    day.setUTCDate(day.getUTCDate() + 1)
    followUpAt = londonInputToISO(`${day.toISOString().slice(0, 10)}T09:00`)
  } else {
    const weekdays = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ]
    const index = weekdays.findIndex((name) =>
      new RegExp(`\\b${name}\\b`, "i").test(note),
    )
    if (index >= 0) {
      day.setUTCDate(
        day.getUTCDate() + ((index - day.getUTCDay() + 7) % 7 || 7),
      )
      followUpAt = londonInputToISO(`${day.toISOString().slice(0, 10)}T09:00`)
    }
  }
  return {
    type,
    matches,
    prospectId: matches.length === 1 ? matches[0].id : null,
    notes: note,
    followUpAt,
  }
}
export function contractMetrics(
  rows: Array<{
    clientId: number
    category: string
    status: string
    monthlyAmount: number
    startsAt: string | Date
    endsAt: string | Date | null
  }>,
  now = new Date(),
) {
  const active = rows.filter(
    (r) =>
      (r.status === "confirmed" ||
        (r.status === "ended" && r.endsAt !== null)) &&
      ["retainer", "premium_partnership"].includes(r.category) &&
      r.monthlyAmount > 0 &&
      new Date(r.startsAt) <= now &&
      (!r.endsAt || new Date(r.endsAt) > now),
  )
  return {
    retainedClients: new Set(active.map((r) => r.clientId)).size,
    mrr: active.reduce((sum, r) => sum + r.monthlyAmount, 0),
  }
}
