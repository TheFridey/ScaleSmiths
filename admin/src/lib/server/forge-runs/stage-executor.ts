import "server-only"
import { and, asc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { forgeRuns, forgeRunSteps } from "@/lib/schema"
import { evaluateStageOptionality, getForgeRunStage, type ForgeRunMode, type ForgeRunPolicy } from "@/lib/forge-run-stages"
import { insertForgeJob } from "../forge-job-queue"
import { loadForgeAiUsageBudgetSnapshot } from "../forge-ai-usage"
import { ForgeRunError } from "./errors"
import { recordRunEvent } from "./events"
import { loadStageContext, requireRun, validArtifactIds } from "./run-repository"
import { computeInputHash } from "./stage-outcomes"

const TERMINAL_STEP_STATUSES = ["completed", "skipped", "cancelled"]

interface StageExecutorDependencies {
  completeRun(runId: number, projectId: number, actor: string): Promise<void>
  continueRun(runId: number, actor: string): Promise<void>
  ensureWorkspace(projectId: number, runId: number, actor: string): Promise<unknown>
  pauseFor(runId: number, stage: string, reason: string, actor: string, stepId?: number, category?: string): Promise<void>
}

export async function executeForgeRunContinuation(runId: number, actor: string, dependencies: StageExecutorDependencies): Promise<void> {
  const run = await requireRun(runId)
  if (run.status !== "running") return
  const steps = await db.select().from(forgeRunSteps).where(eq(forgeRunSteps.runId, runId)).orderBy(asc(forgeRunSteps.sequence))
  const next = steps.find((step) => !TERMINAL_STEP_STATUSES.includes(step.status))
  if (!next) return dependencies.completeRun(runId, run.projectId, actor)
  if (next.status === "awaiting_approval") return dependencies.pauseFor(runId, next.stage, `Human approval required for ${stageLabel(next.stage)}.`, actor, next.id, "approval_required")
  if (next.status === "failed") {
    await db.update(forgeRuns).set({ status: "failed", currentStage: next.stage, pauseReason: next.failureMessage, updatedAt: new Date() }).where(eq(forgeRuns.id, runId))
    await recordRunEvent(runId, next.id, "run_failed", actor, `Run stopped at failed stage ${stageLabel(next.stage)}.`, { category: next.failureCategory })
    return
  }
  if (["queued", "running", "blocked"].includes(next.status)) return

  const definition = getForgeRunStage(next.stage)
  if (!definition) throw new ForgeRunError(`Unknown Forge run stage "${next.stage}".`, 500, "stage_registry_missing")
  const policy = run.policyJson as ForgeRunPolicy
  const context = await loadStageContext(run.projectId, run.mode as ForgeRunMode, policy)
  const optionalReason = evaluateStageOptionality(definition, context)
  if (optionalReason && !next.required) {
    await db.update(forgeRunSteps).set({ status: "skipped", failureCategory: "optional_stage", failureMessage: optionalReason, completedAt: new Date(), updatedAt: new Date() }).where(eq(forgeRunSteps.id, next.id))
    await recordRunEvent(runId, next.id, "step_skipped", "system", `${definition.label} skipped.`, { reason: optionalReason })
    return dependencies.continueRun(runId, actor)
  }
  const ready = definition.readinessEvaluator(context)
  if (!ready.ready) {
    await db.update(forgeRunSteps).set({ status: "blocked", failureCategory: "missing_input", failureMessage: ready.reason, updatedAt: new Date() }).where(eq(forgeRunSteps.id, next.id))
    return dependencies.pauseFor(runId, next.stage, ready.reason ?? `${definition.label} is not ready.`, actor, next.id)
  }
  const completed = definition.completionEvaluator(context)
  if (completed.ready && definition.producedArtifacts.length > 0) {
    const status = definition.approvalPolicy === "human" ? "awaiting_approval" : "completed"
    const artifactIds = validArtifactIds(context, definition.producedArtifacts)
    const now = new Date()
    await db.update(forgeRunSteps).set({ status, outputArtifactIds: artifactIds, startedAt: next.startedAt ?? now, completedAt: status === "completed" ? now : null, inputHash: computeInputHash(context, definition.requiredInputs), failureCategory: null, failureMessage: null, updatedAt: now }).where(eq(forgeRunSteps.id, next.id))
    await recordRunEvent(runId, next.id, "artifact_reused", actor, `Reused valid existing output for ${definition.label}.`, { artifactIds })
    return dependencies.continueRun(runId, actor)
  }
  if (!definition.jobMapping) {
    if (!completed.ready) {
      await db.update(forgeRunSteps).set({ status: "blocked", failureCategory: "missing_output", failureMessage: completed.reason, updatedAt: new Date() }).where(eq(forgeRunSteps.id, next.id))
      return dependencies.pauseFor(runId, next.stage, completed.reason ?? `${definition.label} output is incomplete.`, actor, next.id, "missing_output")
    }
    const status = definition.approvalPolicy === "human" ? "awaiting_approval" : "completed"
    await db.update(forgeRunSteps).set({ status, startedAt: next.startedAt ?? new Date(), completedAt: status === "completed" ? new Date() : null, inputHash: computeInputHash(context, definition.requiredInputs), updatedAt: new Date() }).where(eq(forgeRunSteps.id, next.id))
    await recordRunEvent(runId, next.id, status === "awaiting_approval" ? "approval_requested" : "step_completed", actor, status === "awaiting_approval" ? `${definition.label} awaits human approval.` : `${definition.label} completed.`, {})
    return dependencies.continueRun(runId, actor)
  }
  const budget = await loadForgeAiUsageBudgetSnapshot(run.projectId, definition.estimatedCostUsd)
  if ((budget.project.blocked || budget.monthly.blocked) && !policy.budgetOverride) return dependencies.pauseFor(runId, next.stage, "AI budget is exhausted. Authorised override or budget adjustment required.", actor, next.id, "budget_exhausted")
  if (budget.project.warning || budget.monthly.warning) await recordRunEvent(runId, next.id, "budget_warning", "system", "Run is approaching an AI budget limit.", { budget })
  if (next.stage === "code_generation") await dependencies.ensureWorkspace(run.projectId, runId, actor)
  const idempotencyKey = `forge-run:${runId}:step:${next.id}:attempt:${next.attemptCount + 1}`
  const { job, deduplicated } = await insertForgeJob({ projectId: run.projectId, kind: definition.jobMapping.kind, actor, payload: { ...(definition.jobMapping.payload ?? {}), forgeRunId: runId, forgeRunStepId: next.id, forgeRunStage: next.stage }, idempotencyKey, maxAttempts: definition.retryPolicy.maxAttempts })
  const now = new Date()
  await db.transaction(async (tx) => {
    await tx.update(forgeRunSteps).set({ status: job.status === "running" ? "running" : "queued", jobId: job.id, attemptCount: next.attemptCount + 1, inputHash: computeInputHash(context, definition.requiredInputs), startedAt: next.startedAt ?? now, failureCategory: null, failureMessage: null, operatorErrorJson: null, updatedAt: now }).where(and(eq(forgeRunSteps.id, next.id), eq(forgeRunSteps.status, "pending")))
    await tx.update(forgeRuns).set({ currentStage: next.stage, updatedAt: now }).where(eq(forgeRuns.id, runId))
  })
  await recordRunEvent(runId, next.id, deduplicated ? "job_reused" : "job_queued", actor, `${definition.label} ${deduplicated ? "reused its idempotent job" : "queued"}.`, { jobId: job.id, idempotencyKey })
}

function stageLabel(stage: string) {
  return getForgeRunStage(stage)?.label ?? stage.replaceAll("_", " ")
}
