import type { AdminRole } from "./admin-users"
import type { ForgeProjectState } from "./forge-state-machine"

export const FORGE_PLANNER_VERSION = "2026-07-12.1"

export const FORGE_ADAPTIVE_TASKS = [
  "clarify_intake", "targeted_research", "request_trust_evidence", "review_degraded_upstream",
  "tone_recalibration", "compliance_review", "design_repair", "responsive_repair", "continue_stage",
] as const
export type ForgeAdaptiveTask = typeof FORGE_ADAPTIVE_TASKS[number]

export interface ForgePlannerLimits { maxLoopsPerTask: number; maxRecommendations: number; remainingCostUsd: number | null; remainingRuntimeMs: number }
export interface ForgePlannerFacts {
  projectState: ForgeProjectState
  contradictoryIntake?: string[]
  missingClientFacts?: string[]
  researchWeaknesses?: string[]
  missingTrustEvidence?: string[]
  unsupportedClaims?: string[]
  copyRejectionCount?: number
  visualQaFailures?: string[]
  mobileFailures?: string[]
  degradedUpstreamTaskIds?: number[]
  unresolvedRequiredApprovalIds?: number[]
  previousTaskCounts?: Partial<Record<ForgeAdaptiveTask, number>>
  elapsedRuntimeMs?: number
  estimatedNextCostUsd?: number
}
export interface ForgeTaskGraphNode {
  task: ForgeAdaptiveTask; dependencies: ForgeAdaptiveTask[]; approvalPolicy: "none" | "human_before_downstream" | "human_decision"; terminal: boolean
}
export interface ForgeWorkflowRecommendation {
  task: ForgeAdaptiveTask; priority: number; evidence: string[]; reasoning: string; preconditions: string[]
  approvalPolicy: ForgeTaskGraphNode["approvalPolicy"]; mayExecuteAutomatically: false; blocksDownstream: boolean
}
export interface ForgeWorkflowPlan {
  version: string; terminalCondition: "none" | "deployed" | "archived" | "cost_limit" | "runtime_limit" | "loop_limit" | "awaiting_human_facts" | "awaiting_approval"
  recommendations: ForgeWorkflowRecommendation[]; suppressed: Array<{ task: ForgeAdaptiveTask; reason: string }>; deploymentAllowed: false
}

export const FORGE_TASK_GRAPH: Record<ForgeAdaptiveTask, ForgeTaskGraphNode> = {
  clarify_intake: { task: "clarify_intake", dependencies: [], approvalPolicy: "human_decision", terminal: false },
  targeted_research: { task: "targeted_research", dependencies: ["clarify_intake"], approvalPolicy: "human_before_downstream", terminal: false },
  request_trust_evidence: { task: "request_trust_evidence", dependencies: [], approvalPolicy: "human_decision", terminal: false },
  review_degraded_upstream: { task: "review_degraded_upstream", dependencies: [], approvalPolicy: "human_decision", terminal: false },
  tone_recalibration: { task: "tone_recalibration", dependencies: [], approvalPolicy: "human_before_downstream", terminal: false },
  compliance_review: { task: "compliance_review", dependencies: [], approvalPolicy: "human_decision", terminal: false },
  design_repair: { task: "design_repair", dependencies: [], approvalPolicy: "human_before_downstream", terminal: false },
  responsive_repair: { task: "responsive_repair", dependencies: [], approvalPolicy: "human_before_downstream", terminal: false },
  continue_stage: { task: "continue_stage", dependencies: [], approvalPolicy: "none", terminal: false },
}

const DEFAULT_LIMITS: ForgePlannerLimits = { maxLoopsPerTask: 3, maxRecommendations: 5, remainingCostUsd: null, remainingRuntimeMs: 15 * 60_000 }

export function planForgeWorkflow(facts: ForgePlannerFacts, configured: Partial<ForgePlannerLimits> = {}): ForgeWorkflowPlan {
  const limits = { ...DEFAULT_LIMITS, ...configured }
  if (facts.projectState === "deployed" || facts.projectState === "archived") return empty(facts.projectState)
  if ((facts.elapsedRuntimeMs ?? 0) >= limits.remainingRuntimeMs) return empty("runtime_limit")
  if (limits.remainingCostUsd !== null && (facts.estimatedNextCostUsd ?? 0) > limits.remainingCostUsd) return empty("cost_limit")

  const recommendations: ForgeWorkflowRecommendation[] = []
  const suppressed: ForgeWorkflowPlan["suppressed"] = []
  const add = (task: ForgeAdaptiveTask, priority: number, evidence: string[], reasoning: string, blocksDownstream = false) => {
    const count = facts.previousTaskCounts?.[task] ?? 0
    if (count >= limits.maxLoopsPerTask) { suppressed.push({ task, reason: `Loop limit of ${limits.maxLoopsPerTask} reached; human override is required.` }); return }
    recommendations.push({ task, priority, evidence, reasoning, preconditions: FORGE_TASK_GRAPH[task].dependencies, approvalPolicy: FORGE_TASK_GRAPH[task].approvalPolicy, mayExecuteAutomatically: false, blocksDownstream })
  }
  if (facts.contradictoryIntake?.length) add("clarify_intake", 100, facts.contradictoryIntake, "Contradictory approved inputs require a client or authorised human decision; Forge must not choose or invent facts.", true)
  if (facts.missingClientFacts?.length) add("clarify_intake", 98, facts.missingClientFacts, "Required client facts are absent, so execution must pause for clarification.", true)
  if (facts.degradedUpstreamTaskIds?.length) add("review_degraded_upstream", 95, facts.degradedUpstreamTaskIds.map(String), "Downstream work depends on degraded or fallback output and requires explicit review.", true)
  if (facts.unresolvedRequiredApprovalIds?.length) add("review_degraded_upstream", 94, facts.unresolvedRequiredApprovalIds.map(String), "A required approval remains unresolved and cannot be bypassed.", true)
  if (facts.unsupportedClaims?.length) add("compliance_review", 90, facts.unsupportedClaims, "Unsupported claims require evidence or removal by an authorised reviewer.", true)
  if (facts.researchWeaknesses?.length) add("targeted_research", 80, facts.researchWeaknesses, "Research gaps are specific enough for a bounded follow-up research task.")
  if (facts.missingTrustEvidence?.length) add("request_trust_evidence", 78, facts.missingTrustEvidence, "Trust claims need client-supplied evidence and cannot be generated safely.")
  if ((facts.copyRejectionCount ?? 0) >= 2) add("tone_recalibration", 70, [`${facts.copyRejectionCount} copy rejections`], "Repeated rejection indicates that the approved tone constraints should be recalibrated before another copy pass.")
  if (facts.mobileFailures?.length) add("responsive_repair", 68, facts.mobileFailures, "Mobile-specific failures call for a bounded responsive repair and re-test.")
  if (facts.visualQaFailures?.length) add("design_repair", 65, facts.visualQaFailures, "Visual QA evidence supports a proposed design repair followed by re-rendering and human review.")
  if (!recommendations.length && !suppressed.length) add("continue_stage", 10, [`Project state: ${facts.projectState}`], "No adaptive exception is present; the existing state machine determines the next permitted stage.")
  recommendations.sort((a, b) => b.priority - a.priority)
  const selected = recommendations.slice(0, limits.maxRecommendations)
  const terminalCondition = selected.some((item) => item.blocksDownstream)
    ? (facts.missingClientFacts?.length || facts.contradictoryIntake?.length ? "awaiting_human_facts" : "awaiting_approval")
    : (!selected.length && suppressed.length ? "loop_limit" : "none")
  return { version: FORGE_PLANNER_VERSION, terminalCondition, recommendations: selected, suppressed, deploymentAllowed: false }
}

export function canOverridePlannerLimit(role: AdminRole, reason: string) {
  return (role === "owner" || role === "administrator") && reason.trim().length >= 10
}

function empty(terminalCondition: ForgeWorkflowPlan["terminalCondition"]): ForgeWorkflowPlan {
  return { version: FORGE_PLANNER_VERSION, terminalCondition, recommendations: [], suppressed: [], deploymentAllowed: false }
}
