import { createHash } from "node:crypto"

export type OperatingBriefCategory =
  | "attention_today"
  | "lead_contact"
  | "blocked_project"
  | "waiting_client"
  | "forge_task"
  | "proposal_follow_up"
  | "deadline_risk"
  | "retainer_disengagement"
  | "highest_value_action"
  | "can_wait"

export type OperatingBriefPriority = "critical" | "high" | "medium" | "low"
export type OperatingBriefConfidence = "high" | "medium" | "low"

export interface OperatingBriefEvidence {
  label: string
  href: string
  recordType: string
  recordId: string
  summary: string
  updatedAt?: string | null
}

export interface OperatingBriefRecommendation {
  key: string
  category: OperatingBriefCategory
  title: string
  summary: string
  recommendedAction: string
  priority: OperatingBriefPriority
  score: number
  confidence: OperatingBriefConfidence
  reasoning: string[]
  evidence: OperatingBriefEvidence[]
  evidenceHash: string
  status?: "dismissed" | "completed" | "snoozed" | null
  snoozedUntil?: string | null
}

export interface OperatingBrief {
  generatedAt: string
  headline: string
  recommendations: OperatingBriefRecommendation[]
  safelyWaiting: OperatingBriefRecommendation[]
  suppressedCount: number
}

export interface BriefActionState {
  recommendationKey: string
  evidenceHash: string
  status: "dismissed" | "completed" | "snoozed"
  snoozedUntil?: string | null
}

export function buildOperatingBrief(input: {
  now?: Date
  candidates: Omit<OperatingBriefRecommendation, "evidenceHash">[]
  actionStates?: BriefActionState[]
}): OperatingBrief {
  const now = input.now ?? new Date()
  const withHashes = input.candidates.map((candidate) => ({
    ...candidate,
    evidenceHash: evidenceHash(candidate.evidence),
  }))
  const active: OperatingBriefRecommendation[] = []
  let suppressedCount = 0

  for (const candidate of withHashes) {
    const state = latestState(input.actionStates ?? [], candidate.key, candidate.evidenceHash)
    if (state?.status === "completed" || state?.status === "dismissed") {
      suppressedCount += 1
      continue
    }
    if (state?.status === "snoozed" && state.snoozedUntil && new Date(state.snoozedUntil) > now) {
      suppressedCount += 1
      continue
    }
    active.push({ ...candidate, status: state?.status ?? null, snoozedUntil: state?.snoozedUntil ?? null })
  }

  const recommendations = active
    .filter((item) => item.category !== "can_wait")
    .sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority) || b.score - a.score)
    .slice(0, 9)
  const safelyWaiting = active
    .filter((item) => item.category === "can_wait")
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  return {
    generatedAt: now.toISOString(),
    headline: recommendations[0]?.title ?? "No urgent operating issues found from current records.",
    recommendations,
    safelyWaiting,
    suppressedCount,
  }
}

export function makeRecommendation(input: Omit<OperatingBriefRecommendation, "evidenceHash">): Omit<OperatingBriefRecommendation, "evidenceHash"> {
  return input
}

export function evidenceHash(evidence: OperatingBriefEvidence[]) {
  return createHash("sha256")
    .update(JSON.stringify(evidence.map((item) => [item.recordType, item.recordId, item.updatedAt ?? null, item.summary])))
    .digest("hex")
    .slice(0, 24)
}

function latestState(states: BriefActionState[], key: string, hash: string) {
  return states.find((state) => state.recommendationKey === key && state.evidenceHash === hash) ?? null
}

function priorityWeight(priority: OperatingBriefPriority) {
  return { critical: 4, high: 3, medium: 2, low: 1 }[priority]
}
