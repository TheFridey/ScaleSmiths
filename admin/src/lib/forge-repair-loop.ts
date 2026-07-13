import { createHash } from "node:crypto"

export const FORGE_REPAIR_CATEGORIES = ["typescript", "eslint", "build", "accessibility", "visual_layout", "performance", "broken_links", "missing_metadata", "schema_mismatch", "content_contradiction", "responsive_failure", "dependency_policy_violation"] as const
export type ForgeRepairCategory = (typeof FORGE_REPAIR_CATEGORIES)[number]
export type ForgeRepairStopReason = "success" | "maximum_attempts" | "maximum_cost" | "maximum_runtime" | "insufficient_confidence" | "circular_repair" | "recreated_failure" | "unrelated_change" | "validation_failed" | "escalated"

export interface ForgeRepairLimits { maximumAttempts: number; maximumCost: number; maximumRuntimeMs: number; minimumConfidence: number }
export interface ForgeRepairEvidence { failureIds: string[]; summary: string; output: string; snapshotHash: string }
export interface ForgeRepairAttemptRecord {
  attempt: number; category: ForgeRepairCategory; failureClassification: string; before: ForgeRepairEvidence; after: ForgeRepairEvidence | null
  changedFiles: string[]; validationOutput: string; confidence: number; cost: number; durationMs: number; status: "proposed" | "applied" | "failed" | "rejected"
}
export interface ForgeRepairLoopState {
  originalFailureIds: string[]; allowedFiles: string[]; limits: ForgeRepairLimits; attempts: ForgeRepairAttemptRecord[]
  totalCost: number; totalRuntimeMs: number; status: "running" | "succeeded" | "stopped"; stopReason: ForgeRepairStopReason | null
  escalationRule: string; humanReviewRequired: true
}

export function createForgeRepairLoop(input: { originalFailureIds: string[]; allowedFiles: string[]; limits: ForgeRepairLimits; escalationRule: string }): ForgeRepairLoopState {
  if (!input.originalFailureIds.length) throw new Error("Repair loops require an original failure to revalidate.")
  return { ...input, allowedFiles: [...new Set(input.allowedFiles)], attempts: [], totalCost: 0, totalRuntimeMs: 0, status: "running", stopReason: null, humanReviewRequired: true }
}

export function evaluateForgeRepairAttempt(state: ForgeRepairLoopState, attempt: ForgeRepairAttemptRecord): ForgeRepairLoopState {
  if (state.status !== "running") return state
  const attempts = [...state.attempts, attempt]
  const totalCost = state.totalCost + Math.max(0, attempt.cost)
  const totalRuntimeMs = state.totalRuntimeMs + Math.max(0, attempt.durationMs)
  const stop = (reason: ForgeRepairStopReason): ForgeRepairLoopState => ({ ...state, attempts, totalCost, totalRuntimeMs, status: reason === "success" ? "succeeded" : "stopped", stopReason: reason })
  if (attempt.changedFiles.some((file) => !state.allowedFiles.includes(file))) return stop("unrelated_change")
  if (attempt.confidence < state.limits.minimumConfidence) return stop("insufficient_confidence")
  if (totalCost > state.limits.maximumCost) return stop("maximum_cost")
  if (totalRuntimeMs > state.limits.maximumRuntimeMs) return stop("maximum_runtime")
  const earlier = state.attempts
  if (attempt.after && earlier.some((item) => item.after?.snapshotHash === attempt.after?.snapshotHash)) return stop("circular_repair")
  if (attempt.after && earlier.some((item) => sameSet(item.before.failureIds, attempt.after!.failureIds))) return stop("recreated_failure")
  const originalStillPresent = attempt.after ? state.originalFailureIds.some((id) => attempt.after!.failureIds.includes(id)) : true
  if (attempt.status === "applied" && attempt.after && !originalStillPresent) return stop("success")
  if (attempts.length >= state.limits.maximumAttempts) return stop("maximum_attempts")
  return { ...state, attempts, totalCost, totalRuntimeMs }
}

export function hashForgeRepairSnapshot(value: unknown) { return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex") }
export function classifyForgeRepairFailure(command: string): ForgeRepairCategory {
  if (/typecheck|typescript|tsc/i.test(command)) return "typescript"
  if (/eslint|lint/i.test(command)) return "eslint"
  if (/accessib|axe|wcag/i.test(command)) return "accessibility"
  if (/visual|layout/i.test(command)) return "visual_layout"
  if (/performance|lighthouse/i.test(command)) return "performance"
  if (/link/i.test(command)) return "broken_links"
  if (/metadata|seo/i.test(command)) return "missing_metadata"
  if (/schema/i.test(command)) return "schema_mismatch"
  if (/contradict/i.test(command)) return "content_contradiction"
  if (/responsive|mobile/i.test(command)) return "responsive_failure"
  if (/dependency|package/i.test(command)) return "dependency_policy_violation"
  return "build"
}
function sameSet(a: string[], b: string[]) { return a.length === b.length && [...a].sort().every((value, index) => value === [...b].sort()[index]) }
