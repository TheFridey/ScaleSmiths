/**
 * Operation Ascend B2.2: deterministic, explainable qualification readiness. Pure: no database, no network, no generated text.
 *
 * This is a checklist of facts about what the partner has recorded, not a prediction. It never estimates whether a business
 * will buy, never ranks one business against another, never reads anything about a person (only the business discovery
 * fields below), and never decides anything: scope submission, founder review, ownership and commission keep their own rules.
 */
import { DISCOVERY_FIELDS, technicalReviewFlags } from "./expansion"
import { discoveryGaps, guidancePlanFor } from "./partner-guidance"
import { missingScopeFields } from "./partner-pipeline"

type Discovery = Partial<Record<(typeof DISCOVERY_FIELDS)[number], string>>
export const QUALIFICATION_NOTICE =
  "A readiness checklist of what has been recorded so far. It is not a prediction that the business will buy, it does not rank businesses, and it never rejects a prospect: ScaleSmiths reviews every submitted scope."

const text = (d: Discovery, k: keyof Discovery) => (typeof d[k] === "string" ? d[k]!.trim() : "")
const has = (d: Discovery, k: keyof Discovery, min = 3) => text(d, k).length >= min

export type ReadinessFactor = { id: string; label: string; why: string; how: string; fields: (keyof Discovery)[]; met: (d: Discovery) => boolean }
/** Fixed, equally weighted factors. Founders change them by code review; the fields each factor reads are declared and tested. */
export const READINESS_FACTORS: readonly ReadinessFactor[] = [
  { id: "requirement", label: "Business requirement identified", fields: ["objectives"],
    why: "ScaleSmiths scopes against a stated outcome, not a feature list.", how: "Record what the business wants to achieve.", met: (d) => has(d, "objectives", 15) },
  { id: "service_fit", label: "Relevant service described", fields: ["pages", "functionality"],
    why: "Pages or functionality show which ScaleSmiths service fits.", how: "Record the pages or functionality the business needs.", met: (d) => has(d, "pages") || has(d, "functionality") },
  { id: "decision", label: "Decision-making recorded", fields: ["decisionProcess"],
    why: "Knowing who decides avoids a proposal that nobody can approve.", how: "Record who decides and how.", met: (d) => has(d, "decisionProcess") },
  { id: "timeline", label: "Timescale understood", fields: ["timescale"],
    why: "Delivery capacity is reserved by week, so ScaleSmiths needs a timescale.", how: "Record when the business hopes to start or launch.", met: (d) => has(d, "timescale", 2) },
  { id: "documented", label: "Requirements documented", fields: [...DISCOVERY_FIELDS],
    why: "At least eight discovery answers give ScaleSmiths enough context to scope without a second round.", how: "Answer more of the discovery questions.", met: (d) => DISCOVERY_FIELDS.filter((k) => has(d, k, 2)).length >= 8 },
  { id: "scope_ready", label: "Ready to submit the scope", fields: ["objectives", "pages", "functionality", "budget", "timescale", "decisionProcess"],
    why: "These are the answers ScaleSmiths requires before a scope can be submitted.", how: "Complete the remaining required answers.", met: (d) => missingScopeFields(d).length === 0 },
]

const ESCALATION_LABELS: Record<string, string> = {
  technical_scoping: "Technical scoping", bespoke_discovery: "Bespoke discovery", commercial_assistance: "Commercial assistance",
}
export type Qualification = {
  notice: string
  factors: { id: string; label: string; met: boolean; why: string; how: string }[]
  met: number; total: number
  questions: { field: string; prompt: string }[]
  escalations: { route: string; label: string; reason: string }[]
  technicalFlags: string[]
}

function asDiscovery(value: unknown): Discovery {
  const d: Discovery = {}
  if (value && typeof value === "object" && !Array.isArray(value)) for (const k of DISCOVERY_FIELDS) { const v = (value as Record<string, unknown>)[k]; if (typeof v === "string") d[k] = v.slice(0, 4000) }
  return d
}

/** Same input, same output. Only DISCOVERY_FIELDS and whether a website is recorded are read. */
export function qualificationFor(discovery: unknown, prospect: { website?: unknown }): Qualification {
  const d = asDiscovery(discovery)
  const factors = READINESS_FACTORS.map((f) => ({ id: f.id, label: f.label, met: f.met(d), why: f.why, how: f.how }))
  const plan = guidancePlanFor(d, prospect)
  const flags = technicalReviewFlags(Object.fromEntries(DISCOVERY_FIELDS.map((k) => [k, d[k] ?? ""])))
  const escalations = plan.rules.filter((r) => r.escalation).map((r) => ({ route: r.escalation!, label: ESCALATION_LABELS[r.escalation!] ?? r.escalation!, reason: r.reason }))
  if (flags.length && !escalations.some((e) => e.route === "technical_scoping")) escalations.push({ route: "technical_scoping", label: ESCALATION_LABELS.technical_scoping, reason: `ScaleSmiths reviews these technically before any commitment: ${flags.join(", ")}.` })
  return {
    notice: QUALIFICATION_NOTICE, factors, met: factors.filter((f) => f.met).length, total: factors.length,
    questions: discoveryGaps(d, 8), escalations, technicalFlags: flags,
  }
}
