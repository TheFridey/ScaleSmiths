import type { AdminRole } from "./admin-users"

export const FORGE_PROJECT_STATES = ["intake", "research", "strategy", "sitemap", "copy", "design", "build", "qa", "integrations", "preview", "client_review", "ready_to_deploy", "deployed", "archived"] as const
export const FORGE_TASK_STATES = ["queued", "running", "completed", "failed", "cancelled"] as const
export type ForgeProjectState = typeof FORGE_PROJECT_STATES[number]
export type ForgeTaskState = typeof FORGE_TASK_STATES[number]
export type ForgeOverrideRole = Extract<AdminRole, "owner" | "administrator">

const projectTransitions: Record<ForgeProjectState, readonly ForgeProjectState[]> = {
  intake: ["research", "archived"], research: ["strategy", "sitemap", "archived"], strategy: ["sitemap", "archived"],
  sitemap: ["copy", "archived"], copy: ["design", "archived"], design: ["build", "archived"], build: ["qa", "archived"],
  qa: ["build", "integrations", "preview", "archived"], integrations: ["preview", "archived"], preview: ["client_review", "ready_to_deploy", "archived"],
  client_review: ["build", "ready_to_deploy", "archived"], ready_to_deploy: ["deployed", "archived"], deployed: ["archived"], archived: [],
}
const taskTransitions: Record<ForgeTaskState, readonly ForgeTaskState[]> = {
  queued: ["running", "cancelled"], running: ["completed", "failed", "cancelled"], completed: [], failed: ["queued"], cancelled: ["queued"],
}

export interface ForgeWorkflowFacts {
  sitemapApproved?: boolean
  buildExists?: boolean
  qaPassed?: boolean
  artifactCurrent?: boolean
  failedPrerequisite?: boolean
}
export interface TransitionRequest<TState extends string> { from: TState; to: TState; reason?: string; override?: boolean; actorRole?: AdminRole; facts?: ForgeWorkflowFacts }
export type TransitionDecision = { allowed: true; overridden: boolean } | { allowed: false; code: string; message: string }

export function decideProjectTransition(request: TransitionRequest<ForgeProjectState>): TransitionDecision {
  const violation = projectPreconditionViolation(request.to, request.facts ?? {})
  if (request.from === request.to && !violation) return { allowed: true, overridden: false }
  const structural = projectTransitions[request.from].includes(request.to)
  if (structural && !violation) return { allowed: true, overridden: false }
  if (request.override) {
    if (request.actorRole !== "owner" && request.actorRole !== "administrator") return { allowed: false, code: "override_forbidden", message: "Only owners and administrators may override Forge workflow safeguards." }
    if (!request.reason || request.reason.trim().length < 10) return { allowed: false, code: "override_reason_required", message: "A meaningful override reason is required." }
    if (request.from === "archived" || request.from === "deployed") return { allowed: false, code: "terminal_state", message: `${request.from} is a terminal workflow state.` }
    return { allowed: true, overridden: true }
  }
  if (violation) return violation
  return { allowed: false, code: "transition_not_allowed", message: `Forge project cannot move from ${request.from} to ${request.to}.` }
}

export function decideTaskTransition(request: TransitionRequest<ForgeTaskState>): TransitionDecision {
  if (request.from === request.to) return { allowed: true, overridden: false }
  if (taskTransitions[request.from].includes(request.to)) return { allowed: true, overridden: false }
  if (request.override && (request.actorRole === "owner" || request.actorRole === "administrator") && (request.reason?.trim().length ?? 0) >= 10 && request.from !== "completed") return { allowed: true, overridden: true }
  return { allowed: false, code: "task_transition_not_allowed", message: `Forge task cannot move from ${request.from} to ${request.to}.` }
}

export function assertArtifactApproval(facts: ForgeWorkflowFacts) {
  return facts.artifactCurrent === false ? { allowed: false as const, code: "obsolete_artifact", message: "This artifact has been superseded and cannot be approved." } : { allowed: true as const }
}

function projectPreconditionViolation(to: ForgeProjectState, facts: ForgeWorkflowFacts): TransitionDecision | null {
  if (facts.failedPrerequisite) return { allowed: false, code: "failed_prerequisite", message: "A prerequisite failed. Resolve it or use an authorised override with a reason." }
  if (["build", "qa", "integrations", "preview", "client_review", "ready_to_deploy", "deployed"].includes(to) && !facts.sitemapApproved) return { allowed: false, code: "sitemap_not_approved", message: "Approve the current sitemap before building or continuing." }
  if (["qa", "integrations", "preview", "client_review", "ready_to_deploy", "deployed"].includes(to) && !facts.buildExists) return { allowed: false, code: "build_missing", message: "Generate a current build before running QA or repair." }
  if (["ready_to_deploy", "deployed"].includes(to) && !facts.qaPassed) return { allowed: false, code: "qa_not_passed", message: "A passing QA result is required before deployment." }
  return null
}
