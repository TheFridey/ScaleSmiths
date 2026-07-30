import type { ForgeArtifactType } from "./forge"
import type { ForgeJobKind } from "./forge-jobs"

export const FORGE_RUN_STAGES = [
  "brief",
  "research",
  "sitemap",
  "copy",
  "design_direction",
  "design_system",
  "component_specification",
  "code_generation",
  "seo_schema",
  "accessibility",
  "consistency_review",
  "copy_quality_review",
  "originality_review",
  "quality_review",
  "visual_critique",
  "functional_qa",
  "repair",
  "visual_qa",
  "preview",
  "client_review",
  "deploy_readiness",
] as const

export type ForgeRunStage = (typeof FORGE_RUN_STAGES)[number]
export type ForgeRunMode = "standard" | "refresh" | "migration"
export type ForgeRunStatus = "draft" | "running" | "paused" | "completed" | "failed" | "cancelled"
export type ForgeRunStepStatus = "pending" | "queued" | "running" | "awaiting_approval" | "completed" | "failed" | "skipped" | "cancelled" | "blocked"
export type ForgeRunApprovalPolicy = "automatic" | "human"

export interface ForgeRunPolicy {
  maxEstimatedCostUsd?: number | null
  budgetOverride?: { actor: string; reason: string; approvedAt: string } | null
  requireClientReview?: boolean
  skipStages?: Partial<Record<ForgeRunStage, string>>
  migrationProject?: boolean
}

export interface ForgeStageEvaluationContext {
  mode: ForgeRunMode
  policy: ForgeRunPolicy
  availableArtifacts: ReadonlySet<ForgeArtifactType>
  latestQaFailed: boolean
  latestQaPassed: boolean
  previewAvailable: boolean
  deploymentReady: boolean
}

export interface ForgeStageEvaluation {
  ready: boolean
  reason: string | null
}

export interface ForgeRunStageDefinition {
  key: ForgeRunStage
  label: string
  order: number
  requiredInputs: readonly ForgeArtifactType[]
  producedArtifacts: readonly ForgeArtifactType[]
  optionalWhen: (context: ForgeStageEvaluationContext) => string | null
  approvalPolicy: ForgeRunApprovalPolicy
  retryPolicy: { maxAttempts: number; retryableCategories: readonly string[] }
  jobMapping: { kind: ForgeJobKind; payload?: Record<string, unknown> } | null
  invalidatedDownstreamStages: readonly ForgeRunStage[]
  readinessEvaluator: (context: ForgeStageEvaluationContext) => ForgeStageEvaluation
  completionEvaluator: (context: ForgeStageEvaluationContext) => ForgeStageEvaluation
  estimatedCostUsd: number
}

const retryable = ["provider", "rate_limit", "worker_restart", "transient", "unknown"] as const
const noneOptional = () => null

function readiness(requiredInputs: readonly ForgeArtifactType[]) {
  return (context: ForgeStageEvaluationContext): ForgeStageEvaluation => {
    const missing = requiredInputs.filter((type) => !context.availableArtifacts.has(type))
    return { ready: missing.length === 0, reason: missing.length ? `Missing required artifact${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.` : null }
  }
}

function completion(producedArtifacts: readonly ForgeArtifactType[]) {
  return (context: ForgeStageEvaluationContext): ForgeStageEvaluation => {
    if (!producedArtifacts.length) return { ready: true, reason: null }
    const missing = producedArtifacts.filter((type) => !context.availableArtifacts.has(type))
    return { ready: missing.length === 0, reason: missing.length ? `Expected output artifact${missing.length === 1 ? "" : "s"} not recorded: ${missing.join(", ")}.` : null }
  }
}

const definitions: Array<Omit<ForgeRunStageDefinition, "invalidatedDownstreamStages">> = [
  stage("brief", "Brief approval", [], ["handover_doc"], null, "human", 0),
  stage("research", "Research", ["handover_doc"], ["research_report"], "research", "automatic", .12),
  stage("sitemap", "Sitemap / site plan", ["handover_doc", "research_report"], ["sitemap"], "sitemap", "automatic", .1),
  stage("copy", "Copy", ["sitemap", "research_report"], ["copy_doc"], "copy", "automatic", .22),
  stage("design_direction", "Design direction", ["copy_doc", "sitemap"], ["design_direction"], "design", "automatic", .16),
  stage("design_system", "Design system / tokens", ["design_direction"], ["design_system"], "design_system", "automatic", .12),
  stage("component_specification", "Component specification", ["design_system", "copy_doc"], ["component_spec"], "component_spec", "automatic", .12),
  stage("code_generation", "Code generation", ["component_spec", "copy_doc"], ["generated_code"], "generate_site", "automatic", .45),
  stage("seo_schema", "SEO / schema", ["generated_code", "copy_doc", "sitemap"], ["seo_pack"], "seo", "automatic", .1),
  stage("accessibility", "Accessibility", ["generated_code"], ["accessibility_report"], "accessibility_gate", "automatic", .05),
  stage("consistency_review", "Consistency review", ["generated_code", "copy_doc"], ["consistency_report"], "consistency_review", "automatic", .05),
  stage("copy_quality_review", "Copy-quality review", ["generated_code", "copy_doc"], ["copy_quality_report"], "copy_quality_review", "automatic", .06),
  stage("originality_review", "Originality review", ["generated_code", "copy_doc"], ["originality_report"], "originality_review", "automatic", .05),
  {
    ...stage("quality_review", "Legacy aggregate quality review", ["generated_code", "copy_doc"], [], "quality_review", "automatic", 0),
    optionalWhen: () => "Superseded by atomic consistency, copy-quality and originality review stages.",
  },
  stage("visual_critique", "Visual critique", ["generated_code", "design_direction"], ["visual_critique"], "visual_critique", "automatic", .12),
  stage("functional_qa", "Functional QA", ["generated_code"], ["qa_report"], "qa", "automatic", .04),
  {
    ...stage("repair", "Repair loop", ["generated_code", "qa_report"], ["qa_report"], "repair", "automatic", .18),
    optionalWhen: (context) => context.latestQaFailed ? null : "Functional QA has no recorded failure.",
  },
  stage("visual_qa", "Visual QA", ["generated_code", "qa_report"], ["visual_qa"], "visual_qa", "automatic", .08),
  {
    ...stage("preview", "Preview", ["generated_code", "qa_report"], [], "preview_start", "automatic", 0),
    completionEvaluator: (context) => ({ ready: context.previewAvailable, reason: context.previewAvailable ? null : "Preview has not started." }),
  },
  {
    ...stage("client_review", "Client review", ["generated_code", "qa_report"], [], null, "human", 0),
    optionalWhen: (context) => context.policy.requireClientReview === false ? "Client review disabled by recorded run policy." : null,
  },
  {
    ...stage("deploy_readiness", "Export / deploy readiness", ["generated_code", "qa_report"], ["export_record"], "export", "human", 0),
    jobMapping: { kind: "export", payload: { kind: "site" } },
    completionEvaluator: (context) => ({ ready: context.deploymentReady || context.availableArtifacts.has("export_record"), reason: context.deploymentReady || context.availableArtifacts.has("export_record") ? null : "Deployment readiness evidence is incomplete." }),
  },
]

export const FORGE_RUN_STAGE_REGISTRY: readonly ForgeRunStageDefinition[] = definitions.map((definition, index) => ({
  ...definition,
  invalidatedDownstreamStages: FORGE_RUN_STAGES.slice(index + 1),
}))

export function getForgeRunStage(stageKey: string): ForgeRunStageDefinition | null {
  return FORGE_RUN_STAGE_REGISTRY.find((stage) => stage.key === stageKey) ?? null
}

export function evaluateStageOptionality(stage: ForgeRunStageDefinition, context: ForgeStageEvaluationContext): string | null {
  return context.policy.skipStages?.[stage.key] ?? stage.optionalWhen(context)
}

export function estimateForgeRunCost(policy: ForgeRunPolicy = {}): number {
  return roundCost(FORGE_RUN_STAGE_REGISTRY.reduce((sum, stage) => sum + (policy.skipStages?.[stage.key] ? 0 : stage.estimatedCostUsd), 0))
}

function stage(
  key: ForgeRunStage,
  label: string,
  requiredInputs: readonly ForgeArtifactType[],
  producedArtifacts: readonly ForgeArtifactType[],
  jobKind: ForgeJobKind | null,
  approvalPolicy: ForgeRunApprovalPolicy,
  estimatedCostUsd: number,
): Omit<ForgeRunStageDefinition, "invalidatedDownstreamStages"> {
  return {
    key,
    label,
    order: FORGE_RUN_STAGES.indexOf(key) + 1,
    requiredInputs,
    producedArtifacts,
    optionalWhen: noneOptional,
    approvalPolicy,
    retryPolicy: { maxAttempts: key === "repair" ? 3 : 2, retryableCategories: retryable },
    jobMapping: jobKind ? { kind: jobKind } : null,
    readinessEvaluator: readiness(requiredInputs),
    completionEvaluator: completion(producedArtifacts),
    estimatedCostUsd,
  }
}

function roundCost(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000
}
