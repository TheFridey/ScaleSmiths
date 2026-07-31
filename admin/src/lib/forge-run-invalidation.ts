import {
  evaluateStageOptionality,
  getForgeRunStage,
  type ForgeRunPolicy,
  type ForgeRunStage,
  type ForgeStageEvaluationContext,
} from "./forge-run-stages"

/**
 * Decides which downstream run steps are genuinely stale after `changedStage` produced
 * new output.
 *
 * Pure and policy-aware on purpose. The orchestrator previously evaluated this against a
 * hardcoded `mode: "standard"` and empty policy, so redesign, refresh and migration runs
 * were judged against a run that was not executing.
 */
export interface InvalidationCandidateStep {
  id: number
  stage: string
  status: string
  inputHash: string | null
  required: boolean
}

// Generic over the caller's row type so the orchestrator keeps its full run-step rows
// (output artifact ids and the rest) rather than being narrowed to the decision fields.
export interface InvalidationDecisionInput<TStep extends InvalidationCandidateStep> {
  changedStage: ForgeRunStage
  steps: readonly TStep[]
  context: ForgeStageEvaluationContext
  policy: ForgeRunPolicy
  /** Hash of a step's current required inputs, computed from the live artifact set. */
  currentInputHash: (requiredInputs: readonly string[]) => string
}

const INVALIDATABLE_STATUSES = new Set(["completed", "awaiting_approval"])

export function selectStagesToInvalidate<TStep extends InvalidationCandidateStep>(input: InvalidationDecisionInput<TStep>): TStep[] {
  const changed = getForgeRunStage(input.changedStage)
  if (!changed?.invalidatedDownstreamStages.length) return []

  const downstream = new Set<string>(changed.invalidatedDownstreamStages)
  // Only output this stage actually produces can make a downstream stage stale.
  const changedArtifacts = new Set<string>(changed.producedArtifacts)

  return input.steps.filter((step) => {
    if (!downstream.has(step.stage)) return false
    if (!INVALIDATABLE_STATUSES.has(step.status)) return false
    if (!step.inputHash) return false

    const definition = getForgeRunStage(step.stage)
    if (!definition) return false

    // A stage the run policy deliberately skipped stays skipped.
    if (input.policy.skipStages?.[step.stage as ForgeRunStage]) return false

    // If this stage's output is not an input to that step, the step cannot be stale
    // because of it. Without this guard a hash difference caused by an absent optional
    // stage would reset work that succeeded.
    if (!definition.requiredInputs.some((required) => changedArtifacts.has(required))) return false

    // An optional stage that is legitimately absent under this run's mode and policy is
    // not a reason to invalidate.
    if (!step.required && evaluateStageOptionality(definition, input.context)) return false

    return step.inputHash !== input.currentInputHash(definition.requiredInputs)
  })
}
