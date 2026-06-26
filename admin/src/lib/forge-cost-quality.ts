import type { ForgeQaStatus, ForgeReadinessBand } from "./forge-qa"

// Forge keeps generation cheap, but cheapness must never silently ship low-quality output. This
// module turns raw cost + QA signals into a single decision model: how much has been spent, what an
// improvement pass would cost, the measured quality score, and whether to refine - plus the draft
// rule that a low-cost first pass is fine as long as it is clearly labelled "draft" until QA passes.

// A first-pass draft up to this spend is acceptable, but it must be labelled a draft until QA passes.
export const FORGE_DRAFT_BUDGET_USD = 0.3

// Stages that a refinement pass re-runs; used to estimate the cost of improving the build.
export const FORGE_REFINEMENT_STAGES = ["copy", "design", "frontend", "seo", "qa"] as const

export interface ForgeStageCost {
  stage: string
  costUsd: number
  tokens: number
  calls: number
}

export interface ForgeModelUsed {
  provider: string
  model: string
}

export interface ForgeCostQualityInput {
  stageCosts: ForgeStageCost[]
  retries: number
  models: ForgeModelUsed[]
  qaStatus: ForgeQaStatus
  readinessScore: number | null
  readinessBand: ForgeReadinessBand | null
  clientReady: boolean
  qaFailures: number
  repairPasses: number
  buildDurationMs: number | null
}

export interface ForgeRefinementRecommendation {
  recommended: boolean
  reason: string
  estimatedCostUsd: number | null
}

export interface ForgeDraftLabel {
  isDraft: boolean
  label: string
  withinFirstPassBudget: boolean
  note: string
}

export interface ForgeCostQualitySummary {
  // Tracked metrics.
  totalCostUsd: number
  costPerStage: ForgeStageCost[]
  retries: number
  qaFailures: number
  repairPasses: number
  finalReadinessScore: number | null
  buildDurationMs: number | null
  models: ForgeModelUsed[]
  // Derived decision intelligence.
  costSoFarUsd: number
  estimatedCostToImproveUsd: number | null
  qualityScore: number | null
  refinement: ForgeRefinementRecommendation
  draft: ForgeDraftLabel
}

function roundUsd(value: number) {
  return Math.round(value * 10_000) / 10_000
}

function estimateImprovementCost(stageCosts: ForgeStageCost[], totalCostUsd: number): number | null {
  const refinementSet = new Set<string>(FORGE_REFINEMENT_STAGES)
  const refinementCost = stageCosts
    .filter((stage) => refinementSet.has(stage.stage))
    .reduce((sum, stage) => sum + stage.costUsd, 0)
  if (refinementCost > 0) return roundUsd(refinementCost)
  // No per-stage data yet: a refinement pass roughly re-runs ~60% of the spend so far.
  if (totalCostUsd > 0) return roundUsd(totalCostUsd * 0.6)
  return null
}

function buildRefinement({
  qaStatus,
  clientReady,
  readinessScore,
  estimatedCostUsd,
}: {
  qaStatus: ForgeQaStatus
  clientReady: boolean
  readinessScore: number | null
  estimatedCostUsd: number | null
}): ForgeRefinementRecommendation {
  if (qaStatus === "not_run") {
    return { recommended: false, reason: "Run QA to measure quality before deciding on a refinement pass.", estimatedCostUsd }
  }
  if (clientReady && qaStatus === "passed") {
    return { recommended: false, reason: "QA passed and the build is client-ready; no refinement pass needed.", estimatedCostUsd: null }
  }
  const score = readinessScore ?? 0
  if (score >= 75) {
    return { recommended: true, reason: "Strong draft just below the client-ready threshold; one refinement pass is likely worth it.", estimatedCostUsd }
  }
  if (score >= 60) {
    return { recommended: true, reason: "Quality needs review; a refinement pass is recommended before sending to the client.", estimatedCostUsd }
  }
  return { recommended: true, reason: "Quality is below acceptable; refine or fix the blocking QA checks before this can ship.", estimatedCostUsd }
}

function buildDraftLabel({
  qaStatus,
  totalCostUsd,
}: {
  qaStatus: ForgeQaStatus
  totalCostUsd: number
}): ForgeDraftLabel {
  const withinFirstPassBudget = totalCostUsd <= FORGE_DRAFT_BUDGET_USD

  if (qaStatus === "passed") {
    return { isDraft: false, label: "Client ready", withinFirstPassBudget, note: "QA passed - this build is client-ready, not a draft." }
  }
  if (qaStatus === "not_run") {
    return {
      isDraft: true,
      label: "Draft (QA not run)",
      withinFirstPassBudget,
      note: "No QA has been run yet, so this is a draft. Run QA before treating it as client-ready.",
    }
  }
  // qaStatus === "failed"
  return {
    isDraft: true,
    label: "Draft",
    withinFirstPassBudget,
    note: withinFirstPassBudget
      ? `Acceptable first-pass draft within the $${FORGE_DRAFT_BUDGET_USD.toFixed(2)} budget, but it stays labelled a draft until QA passes.`
      : `Draft has exceeded the $${FORGE_DRAFT_BUDGET_USD.toFixed(2)} first-pass budget without passing QA - refine or fix the blocking checks.`,
  }
}

export function summarizeForgeCostQuality(input: ForgeCostQualityInput): ForgeCostQualitySummary {
  const costPerStage = [...input.stageCosts]
    .map((stage) => ({ ...stage, costUsd: roundUsd(stage.costUsd) }))
    .sort((a, b) => b.costUsd - a.costUsd)
  const totalCostUsd = roundUsd(input.stageCosts.reduce((sum, stage) => sum + stage.costUsd, 0))
  const estimatedCostToImproveUsd = estimateImprovementCost(input.stageCosts, totalCostUsd)

  return {
    totalCostUsd,
    costPerStage,
    retries: input.retries,
    qaFailures: input.qaFailures,
    repairPasses: input.repairPasses,
    finalReadinessScore: input.readinessScore,
    buildDurationMs: input.buildDurationMs,
    models: input.models,
    costSoFarUsd: totalCostUsd,
    estimatedCostToImproveUsd,
    qualityScore: input.readinessScore,
    refinement: buildRefinement({
      qaStatus: input.qaStatus,
      clientReady: input.clientReady,
      readinessScore: input.readinessScore,
      estimatedCostUsd: estimatedCostToImproveUsd,
    }),
    draft: buildDraftLabel({ qaStatus: input.qaStatus, totalCostUsd }),
  }
}
