import "server-only"
import { normalizeForgeOperatorError } from "@/lib/forge-operator-error"
import { and, desc, eq, gte, inArray, isNull } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  forgeActivityLogs,
  forgeArtifacts,
  forgeJobs,
  forgeProjects,
  forgeRuns,
  forgeRunEvents,
  forgeRunSteps,
  forgeTasks,
} from "@/lib/schema"
import {
  FORGE_RUN_STAGE_REGISTRY,
  estimateForgeRunCost,
  evaluateStageOptionality,
  getForgeRunStage,
  type ForgeRunMode,
  type ForgeRunPolicy,
  type ForgeRunStage,
} from "@/lib/forge-run-stages"
import { cancelForgeJob } from "../forge-job-queue"
import { ForgeRunError } from "./errors"
import type { CreateForgeRunInput } from "./types"
import { recordRunEvent } from "./events"
import { updateRunActualCost, updateRunStepActualCost } from "./accounting"
import { getActiveForgeRun, getCurrentForgeRun, loadForgeRun, loadStageContext, requireRun, requireStep, validArtifactIds } from "./run-repository"
import { computeInputHash } from "./stage-outcomes"
import { executeForgeRunContinuation } from "./stage-executor"
import { ensureRunWorkspace } from "./workspace"
import { approveAutomaticStageOutput, AUTOMATIC_POLICY_ACTOR } from "./approvals"
import { invalidateDownstreamForChangedInput } from "./invalidation"

export { getCurrentForgeRun, loadForgeRun }

const AUTOMATIC_STRUCTURED_OUTPUT_STAGES = new Set<ForgeRunStage>([
  "research",
  "sitemap",
  "copy",
  "design_direction",
  "design_system",
  "component_specification",
  "code_generation",
  "seo_schema",
])

export async function createForgeRun(input: CreateForgeRunInput) {
  const [project] = await db.select({ id: forgeProjects.id }).from(forgeProjects).where(eq(forgeProjects.id, input.projectId)).limit(1)
  if (!project) throw new ForgeRunError("Forge project not found.", 404, "project_not_found")
  const existing = await getActiveForgeRun(input.projectId)
  if (existing) return { ...existing, adopted: true }

  const mode = input.mode ?? "standard"
  const policy = normalizePolicy(input.policy)
  const estimatedCost = estimateForgeRunCost(policy)
  if (policy.maxEstimatedCostUsd != null && estimatedCost > policy.maxEstimatedCostUsd && !policy.budgetOverride) {
    throw new ForgeRunError(`Estimated run cost $${estimatedCost.toFixed(4)} exceeds the run policy limit.`, 402, "estimated_budget_exceeded")
  }
  const context = await loadStageContext(input.projectId, mode, policy)
  const now = new Date()

  const run = await db.transaction(async (tx) => {
    const [created] = await tx.insert(forgeRuns).values({
      projectId: input.projectId,
      mode,
      status: "draft",
      currentStage: FORGE_RUN_STAGE_REGISTRY[0].key,
      policyJson: policy,
      startedBy: input.actor,
      estimatedCostUsd: estimatedCost.toFixed(6),
      updatedAt: now,
    }).returning()

    const steps = FORGE_RUN_STAGE_REGISTRY.map((stage) => {
      const optionalReason = evaluateStageOptionality(stage, context)
      const outputs = validArtifactIds(context, stage.producedArtifacts)
      const reused = outputs.length === stage.producedArtifacts.length && outputs.length > 0
      const status = optionalReason
        ? "skipped"
        : reused
          ? stage.approvalPolicy === "human" ? "awaiting_approval" : "completed"
          : "pending"
      return {
        runId: created.id,
        projectId: input.projectId,
        stage: stage.key,
        status,
        sequence: stage.order,
        required: !optionalReason,
        inputHash: computeInputHash(context, stage.requiredInputs),
        outputArtifactIds: reused ? outputs : [],
        attemptCount: 0,
        maxAttempts: stage.retryPolicy.maxAttempts,
        estimatedCostUsd: stage.estimatedCostUsd.toFixed(6),
        estimatedRetryCostUsd: stage.estimatedCostUsd.toFixed(6),
        remainingEstimatedCostUsd: FORGE_RUN_STAGE_REGISTRY.slice(stage.order - 1).reduce((sum, item) => sum + (policy.skipStages?.[item.key] ? 0 : item.estimatedCostUsd), 0).toFixed(6),
        approvalRequired: stage.approvalPolicy === "human",
        failureCategory: optionalReason ? "optional_stage" : null,
        failureMessage: optionalReason,
        completedAt: status === "completed" || status === "skipped" ? now : null,
        updatedAt: now,
      }
    })
    const insertedSteps = await tx.insert(forgeRunSteps).values(steps).returning()
    await tx.insert(forgeRunEvents).values([
      { runId: created.id, eventType: "run_created", actor: input.actor, message: `Created ${mode} Forge run.`, metadataJson: { estimatedCostUsd: estimatedCost, policy } },
      ...insertedSteps.filter((step) => step.status === "skipped").map((step) => ({ runId: created.id, stepId: step.id, eventType: "step_skipped", actor: "system", message: `${stageLabel(step.stage)} skipped: ${step.failureMessage}`, metadataJson: { reason: step.failureMessage, automatic: true } })),
      ...insertedSteps.filter((step) => step.status === "completed").map((step) => ({ runId: created.id, stepId: step.id, eventType: "artifact_reused", actor: "system", message: `Reused valid existing output for ${stageLabel(step.stage)}.`, metadataJson: { artifactIds: step.outputArtifactIds } })),
    ])
    await tx.insert(forgeActivityLogs).values({ projectId: input.projectId, actor: input.actor, action: "forge_run_created", message: `Created Forge run #${created.id}.`, metadataJson: { runId: created.id, mode, estimatedCostUsd: estimatedCost } })
    return created
  }).catch(async (error: unknown) => {
    if (isUniqueViolation(error)) {
      const current = await getActiveForgeRun(input.projectId)
      if (current) return current
    }
    throw error
  })
  return loadForgeRun(run.id)
}

export async function startForgeRun(runId: number, actor: string, override?: { reason: string }) {
  const run = await requireRun(runId)
  if (!["draft", "paused"].includes(run.status)) throw new ForgeRunError("Only draft or paused runs can start.", 409, "run_not_startable")
  const policy = run.policyJson as ForgeRunPolicy
  if (override) policy.budgetOverride = { actor, reason: requireReason(override.reason), approvedAt: new Date().toISOString() }
  const now = new Date()
  await db.update(forgeRuns).set({ status: "running", startedAt: run.startedAt ?? now, pausedAt: null, pauseReason: null, policyJson: policy, updatedAt: now }).where(eq(forgeRuns.id, runId))
  await db.update(forgeRunSteps).set({ status: "pending", failureCategory: null, failureMessage: null, updatedAt: now }).where(and(eq(forgeRunSteps.runId, runId), eq(forgeRunSteps.status, "blocked")))
  await recordRunEvent(runId, null, "run_started", actor, run.startedAt ? "Resumed run execution." : "Started run execution.", override ? { budgetOverride: override.reason } : {})
  for (const stage of FORGE_RUN_STAGE_REGISTRY) {
    await invalidateDownstreamForChangedInput(runId, run.projectId, stage.key, actor)
  }
  await continueForgeRun(runId, actor)
  return loadForgeRun(runId)
}

export async function pauseForgeRun(runId: number, actor: string, reason: string) {
  const run = await requireRun(runId)
  if (run.status !== "running") throw new ForgeRunError("Only a running Forge run can be paused.", 409, "run_not_running")
  const now = new Date()
  await db.update(forgeRuns).set({ status: "paused", pausedAt: now, pauseReason: requireReason(reason), updatedAt: now }).where(eq(forgeRuns.id, runId))
  await recordRunEvent(runId, null, "run_paused", actor, "Paused Forge run.", { reason })
  return loadForgeRun(runId)
}

export async function resumeForgeRun(runId: number, actor: string, override?: { reason: string }) {
  return startForgeRun(runId, actor, override)
}

export async function cancelForgeRun(runId: number, actor: string, reason: string) {
  const run = await requireRun(runId)
  if (["completed", "cancelled"].includes(run.status)) throw new ForgeRunError("This Forge run is already terminal.", 409, "run_terminal")
  const steps = await db.select().from(forgeRunSteps).where(eq(forgeRunSteps.runId, runId))
  await Promise.all(steps.filter((step) => step.jobId && ["queued", "running"].includes(step.status)).map((step) => cancelForgeJob(step.jobId!)))
  const now = new Date()
  await db.transaction(async (tx) => {
    await tx.update(forgeRuns).set({ status: "cancelled", cancelledAt: now, pauseReason: requireReason(reason), updatedAt: now }).where(eq(forgeRuns.id, runId))
    await tx.update(forgeRunSteps).set({ status: "cancelled", completedAt: now, updatedAt: now }).where(and(eq(forgeRunSteps.runId, runId), inArray(forgeRunSteps.status, ["pending", "queued", "running", "blocked", "awaiting_approval"])))
  })
  await recordRunEvent(runId, null, "run_cancelled", actor, "Cancelled Forge run.", { reason })
  return loadForgeRun(runId)
}

export async function retryForgeRunStep(runId: number, stageKey: ForgeRunStage, actor: string) {
  const step = await requireStep(runId, stageKey)
  const critiqueReviewRetry = stageKey === "visual_critique" && step.status === "awaiting_approval"
  if (!["failed", "blocked"].includes(step.status) && !critiqueReviewRetry) throw new ForgeRunError("Only failed, blocked, or review-paused critique steps can be retried.", 409, "step_not_retryable")
  if (step.attemptCount >= step.maxAttempts) throw new ForgeRunError("This step has exhausted its run retry policy.", 409, "step_attempts_exhausted")
  const now = new Date()
  await db.transaction(async (tx) => {
    await tx.update(forgeRunSteps).set({ status: "pending", jobId: null, failureCategory: null, failureMessage: null, completedAt: null, updatedAt: now }).where(eq(forgeRunSteps.id, step.id))
    await tx.update(forgeRuns).set({ status: "running", currentStage: stageKey, pausedAt: null, pauseReason: null, updatedAt: now }).where(eq(forgeRuns.id, runId))
  })
  await recordRunEvent(runId, step.id, "step_retry_requested", actor, `Retry requested for ${stageLabel(stageKey)}.`, { previousAttempts: step.attemptCount })
  await continueForgeRun(runId, actor)
  return loadForgeRun(runId)
}

export async function skipForgeRunStep(runId: number, stageKey: ForgeRunStage, actor: string, reason: string) {
  const step = await requireStep(runId, stageKey)
  if (step.required) throw new ForgeRunError("Required Forge run steps cannot be skipped.", 409, "step_required")
  if (!["pending", "blocked", "failed"].includes(step.status)) throw new ForgeRunError("This optional step cannot be skipped in its current state.", 409, "step_not_skippable")
  const now = new Date()
  await db.update(forgeRunSteps).set({ status: "skipped", failureCategory: "operator_skip", failureMessage: requireReason(reason), completedAt: now, updatedAt: now }).where(eq(forgeRunSteps.id, step.id))
  await recordRunEvent(runId, step.id, "step_skipped", actor, `Skipped ${stageLabel(stageKey)}.`, { reason })
  await continueForgeRun(runId, actor)
  return loadForgeRun(runId)
}

export async function approveForgeRunStep(runId: number, stageKey: ForgeRunStage, actor: string, reason?: string) {
  const step = await requireStep(runId, stageKey)
  if (!step.approvalRequired || step.status !== "awaiting_approval") throw new ForgeRunError("This step is not awaiting human approval.", 409, "approval_not_expected")
  const now = new Date()
  await db.transaction(async (tx) => {
    await tx.update(forgeRunSteps).set({ status: "completed", approvedBy: actor, approvedAt: now, completedAt: now, failureCategory: null, failureMessage: null, operatorErrorJson: null, updatedAt: now }).where(eq(forgeRunSteps.id, step.id))
    await tx.update(forgeRuns).set({ status: "running", pausedAt: null, pauseReason: null, updatedAt: now }).where(eq(forgeRuns.id, runId))
  })
  await recordRunEvent(runId, step.id, "step_approved", actor, `Approved ${stageLabel(stageKey)}.`, { reason: reason ?? null })
  await invalidateDownstreamForChangedInput(runId, step.projectId, stageKey, actor)
  await continueForgeRun(runId, actor)
  return loadForgeRun(runId)
}

export async function rejectForgeRunStep(runId: number, stageKey: ForgeRunStage, actor: string, reason: string) {
  const step = await requireStep(runId, stageKey)
  if (!step.approvalRequired || step.status !== "awaiting_approval") throw new ForgeRunError("This step is not awaiting human approval.", 409, "approval_not_expected")
  const now = new Date()
  await db.transaction(async (tx) => {
    await tx.update(forgeRunSteps).set({ status: "failed", failureCategory: "human_rejection", failureMessage: requireReason(reason), completedAt: now, updatedAt: now }).where(eq(forgeRunSteps.id, step.id))
    await tx.update(forgeRuns).set({ status: "paused", pausedAt: now, pauseReason: `Rejected ${stageLabel(stageKey)}: ${reason}`, updatedAt: now }).where(eq(forgeRuns.id, runId))
  })
  await recordRunEvent(runId, step.id, "step_rejected", actor, `Rejected ${stageLabel(stageKey)}.`, { reason })
  return loadForgeRun(runId)
}

export async function continueForgeRun(runId: number, actor = "system"): Promise<void> {
  return executeForgeRunContinuation(runId, actor, {
    completeRun,
    continueRun: continueForgeRun,
    ensureWorkspace: ensureRunWorkspace,
    pauseFor,
  })
}
export async function handleForgeRunJobOutcome(jobId: number, outcome: "completed" | "failed", message?: string) {
  const [step] = await db.select().from(forgeRunSteps).where(eq(forgeRunSteps.jobId, jobId)).limit(1)
  if (!step) return
  const run = await requireRun(step.runId)
  if (run.status === "cancelled") return
  const definition = getForgeRunStage(step.stage)
  if (!definition) return
  const [job] = await db.select().from(forgeJobs).where(eq(forgeJobs.id, jobId)).limit(1)
  if (!job) return
  if (outcome === "failed" && job.status === "queued") {
    await updateRunStepActualCost(step.id, job)
    await db.update(forgeRunSteps).set({ status: "queued", failureCategory: job.operatorErrorJson?.category ?? "transient", failureMessage: job.operatorErrorJson?.summary ?? message ?? job.failureReason, operatorErrorJson: job.operatorErrorJson, updatedAt: new Date() }).where(eq(forgeRunSteps.id, step.id))
    await recordRunEvent(step.runId, step.id, "job_retry_scheduled", "system", `${definition.label} job will retry.`, { jobId, attempts: job.attempts })
    return
  }
  if (outcome === "failed") {
    await updateRunStepActualCost(step.id, job)
    const now = new Date()
    await db.transaction(async (tx) => {
      await tx.update(forgeRunSteps).set({ status: "failed", failureCategory: job.operatorErrorJson?.category ?? categorizeFailure(message ?? job.failureReason), failureMessage: job.operatorErrorJson?.summary ?? message ?? job.failureReason ?? "Job failed.", operatorErrorJson: job.operatorErrorJson, completedAt: now, updatedAt: now }).where(eq(forgeRunSteps.id, step.id))
      await tx.update(forgeRuns).set({ status: "failed", currentStage: step.stage, pauseReason: job.operatorErrorJson?.summary ?? message ?? job.failureReason, updatedAt: now }).where(eq(forgeRuns.id, step.runId))
    })
    await recordRunEvent(step.runId, step.id, "step_failed", "system", `${definition.label} failed.`, { jobId, message })
    return
  }

  if (AUTOMATIC_STRUCTURED_OUTPUT_STAGES.has(step.stage as ForgeRunStage) && definition.producedArtifacts.length > 0) {
    const policyApproved = await approveAutomaticStageOutput(
      step.projectId,
      step.stage as ForgeRunStage,
      definition.producedArtifacts,
    )
    await db.update(forgeArtifacts).set({
      qualityState: "validated",
      updatedAt: new Date(),
    }).where(and(
      eq(forgeArtifacts.projectId, step.projectId),
      inArray(forgeArtifacts.type, [...definition.producedArtifacts]),
      isNull(forgeArtifacts.supersededAt),
      gte(forgeArtifacts.updatedAt, step.startedAt ?? job.startedAt ?? job.createdAt),
    ))
    if (policyApproved) {
      await recordRunEvent(
        step.runId,
        step.id,
        "automatic_policy_approval",
        AUTOMATIC_POLICY_ACTOR,
        `${definition.label} output was approved by the run's automatic-stage policy.`,
        { jobId, artifactTypes: definition.producedArtifacts },
      )
    }
  }
  const context = await loadStageContext(step.projectId, run.mode as ForgeRunMode, run.policyJson as ForgeRunPolicy)
  await updateRunStepActualCost(step.id, job)
  const outputIds = validArtifactIds(context, definition.producedArtifacts)
  const completion = definition.completionEvaluator(context)
  if (!completion.ready) {
    if (step.stage === "visual_critique") {
      const now = new Date()
      const operatorError = normalizeForgeOperatorError(completion.reason ?? "Visual critique requires operator review.", {
        stage: step.stage,
        category: "quality_failure",
        retryable: false,
        runId: step.runId,
        jobId,
        affectedArtifactIds: outputIds,
        technicalReference: `forge:run:${step.runId}:step:${step.id}:critique`,
        recommendedAction: "Apply safe fixes and rerun critique, or record an explicit policy override with a reason.",
      })
      await db.transaction(async (tx) => {
        await tx.update(forgeRunSteps).set({ status: "awaiting_approval", approvalRequired: true, failureCategory: operatorError.category, failureMessage: operatorError.summary, operatorErrorJson: operatorError, outputArtifactIds: outputIds, updatedAt: now }).where(eq(forgeRunSteps.id, step.id))
        await tx.update(forgeRuns).set({ status: "paused", currentStage: step.stage, pausedAt: now, pauseReason: operatorError.summary, updatedAt: now }).where(eq(forgeRuns.id, step.runId))
      })
      await recordRunEvent(step.runId, step.id, "critique_review_required", "system", operatorError.summary, { jobId, artifactIds: outputIds })
      return
    }
    await db.update(forgeRunSteps).set({ status: "failed", failureCategory: "missing_output", failureMessage: completion.reason, outputArtifactIds: outputIds, completedAt: new Date(), updatedAt: new Date() }).where(eq(forgeRunSteps.id, step.id))
    await recordRunEvent(step.runId, step.id, "step_failed", "system", `${definition.label} completed without required output.`, { jobId, reason: completion.reason })
    await continueForgeRun(step.runId)
    return
  }
  const [task] = await db.select({ id: forgeTasks.id }).from(forgeTasks).where(eq(forgeTasks.projectId, step.projectId)).orderBy(desc(forgeTasks.createdAt)).limit(1)
  const nextStatus = definition.approvalPolicy === "human" ? "awaiting_approval" : "completed"
  const approvalError = nextStatus === "awaiting_approval" ? normalizeForgeOperatorError(`${definition.label} is waiting for human approval.`, { stage: step.stage, category: "approval_required", retryable: false, runId: step.runId, jobId, affectedArtifactIds: outputIds, technicalReference: `forge:run:${step.runId}:step:${step.id}:approval` }) : null
  await db.update(forgeRunSteps).set({ status: nextStatus, approvalRequired: nextStatus === "awaiting_approval", outputArtifactIds: outputIds, taskId: job.taskId ?? task?.id ?? null, completedAt: nextStatus === "completed" ? new Date() : null, failureCategory: approvalError?.category ?? null, failureMessage: approvalError?.summary ?? null, operatorErrorJson: approvalError, updatedAt: new Date() }).where(eq(forgeRunSteps.id, step.id))
  await updateRunActualCost(step.runId, step.projectId)
  await recordRunEvent(step.runId, step.id, nextStatus === "awaiting_approval" ? "approval_requested" : "step_completed", "system", `${definition.label} ${nextStatus === "awaiting_approval" ? "awaits approval" : "completed"}.`, { jobId, artifactIds: outputIds })
  await invalidateDownstreamForChangedInput(step.runId, step.projectId, step.stage as ForgeRunStage, "system")
  await continueForgeRun(step.runId)
}

export async function recoverForgeRuns() {
  const runs = await db.select({ id: forgeRuns.id }).from(forgeRuns).where(eq(forgeRuns.status, "running"))
  for (const run of runs) {
    const steps = await db.select().from(forgeRunSteps).where(eq(forgeRunSteps.runId, run.id))
    for (const step of steps.filter((item) => item.jobId && ["queued", "running"].includes(item.status))) {
      const [job] = await db.select().from(forgeJobs).where(eq(forgeJobs.id, step.jobId!)).limit(1)
      if (!job) {
        await db.update(forgeRunSteps).set({ status: "pending", jobId: null, failureCategory: "orphaned_job", failureMessage: "Recovered step whose job no longer exists.", updatedAt: new Date() }).where(eq(forgeRunSteps.id, step.id))
      } else if (job.status === "completed") await handleForgeRunJobOutcome(job.id, "completed")
      else if (["failed", "dead_letter"].includes(job.status)) await handleForgeRunJobOutcome(job.id, "failed", job.failureReason ?? job.error ?? undefined)
      else if (job.status === "cancelled") await db.update(forgeRunSteps).set({ status: "pending", jobId: null, updatedAt: new Date() }).where(eq(forgeRunSteps.id, step.id))
    }
    await continueForgeRun(run.id, "recovery")
  }
  return { recovered: runs.length }
}

export async function recordForgeRunCommandEvent(runId: number, actor: string, eventType: string, message: string, metadataJson: Record<string, unknown>) {
  await requireRun(runId)
  await recordRunEvent(runId, null, eventType, actor, message, metadataJson)
}

export async function invalidateForgeRunStages(runId: number, stages: readonly ForgeRunStage[], actor: string, reason: string) {
  await requireRun(runId)
  const uniqueStages = [...new Set(stages)].filter((stage) => Boolean(getForgeRunStage(stage)))
  if (!uniqueStages.length) throw new ForgeRunError("No supported run stages were selected for invalidation.", 400, "invalid_invalidation")
  const steps = await db.select().from(forgeRunSteps).where(and(eq(forgeRunSteps.runId, runId), inArray(forgeRunSteps.stage, uniqueStages)))
  if (!steps.length) throw new ForgeRunError("The selected stages do not belong to this run.", 409, "run_stage_mismatch")
  const artifactIds = steps.flatMap((step) => step.outputArtifactIds)
  const now = new Date()
  await db.transaction(async (tx) => {
    await tx.update(forgeRunSteps).set({
      status: "pending", jobId: null, taskId: null, outputArtifactIds: [], approvedBy: null, approvedAt: null,
      completedAt: null, failureCategory: "command_feedback", failureMessage: reason.slice(0, 2000), updatedAt: now,
    }).where(inArray(forgeRunSteps.id, steps.map((step) => step.id)))
    if (artifactIds.length) await tx.update(forgeArtifacts).set({ supersededAt: now, updatedAt: now }).where(and(inArray(forgeArtifacts.id, artifactIds), isNull(forgeArtifacts.supersededAt)))
    await tx.update(forgeRuns).set({ status: "running", currentStage: uniqueStages[0], completedAt: null, pausedAt: null, pauseReason: null, updatedAt: now }).where(eq(forgeRuns.id, runId))
  })
  await recordRunEvent(runId, null, "command_feedback_invalidated", actor, "Invalidated run stages from approved command feedback.", { stages: uniqueStages, artifactIds, reason })
  await continueForgeRun(runId, actor)
  return loadForgeRun(runId)
}

async function pauseFor(runId: number, stage: string, reason: string, actor: string, stepId?: number, category = "readiness") {
  const now = new Date()
  const operatorError = normalizeForgeOperatorError(reason, {
    stage,
    category: category === "budget_exhausted"
      ? "budget_exceeded"
      : category === "approval_required"
        ? "approval_required"
        : "missing_input",
    retryable: false,
    runId,
    technicalReference: `forge:run:${runId}:stage:${stage}`,
    metadata: { stepId: stepId ?? null, category },
  })
  await db.transaction(async (tx) => {
    await tx.update(forgeRuns).set({ status: "paused", currentStage: stage, pausedAt: now, pauseReason: reason, updatedAt: now }).where(eq(forgeRuns.id, runId))
    if (stepId) await tx.update(forgeRunSteps).set({
      status: category === "budget_exhausted"
        ? "blocked"
        : category === "approval_required"
          ? "awaiting_approval"
          : "pending",
      failureCategory: operatorError.category,
      failureMessage: operatorError.summary,
      operatorErrorJson: operatorError,
      updatedAt: now,
    }).where(eq(forgeRunSteps.id, stepId))
  })
  await recordRunEvent(runId, stepId ?? null, "run_paused", actor, reason, { category, stage })
}

async function completeRun(runId: number, projectId: number, actor: string) {
  const now = new Date()
  await updateRunActualCost(runId, projectId)
  await db.update(forgeRuns).set({ status: "completed", currentStage: null, completedAt: now, pauseReason: null, updatedAt: now }).where(eq(forgeRuns.id, runId))
  await recordRunEvent(runId, null, "run_completed", actor, "Forge run completed.", {})
  await db.insert(forgeActivityLogs).values({ projectId, actor, action: "forge_run_completed", message: `Completed Forge run #${runId}.`, metadataJson: { runId } })
}

function normalizePolicy(policy: ForgeRunPolicy | undefined): ForgeRunPolicy {
  const skipStages = Object.fromEntries(
    Object.entries(policy?.skipStages ?? {}).filter(([stage, reason]) => Boolean(getForgeRunStage(stage)) && typeof reason === "string" && reason.trim().length >= 10),
  ) as Partial<Record<ForgeRunStage, string>>
  return {
    maxEstimatedCostUsd: typeof policy?.maxEstimatedCostUsd === "number" && policy.maxEstimatedCostUsd >= 0 ? policy.maxEstimatedCostUsd : null,
    budgetOverride: null,
    requireClientReview: policy?.requireClientReview !== false,
    skipStages,
    migrationProject: policy?.migrationProject === true,
  }
}

function categorizeFailure(message: string | null | undefined) {
  const value = (message ?? "").toLowerCase()
  if (value.includes("budget")) return "budget"
  if (value.includes("provider") || value.includes("openai") || value.includes("anthropic")) return "provider"
  if (value.includes("timeout") || value.includes("lease")) return "worker_restart"
  if (value.includes("validation") || value.includes("schema")) return "validation"
  return "unknown"
}

function stageLabel(stage: string) {
  return getForgeRunStage(stage)?.label ?? stage.replaceAll("_", " ")
}

function requireReason(reason: string) {
  const value = reason.trim()
  if (value.length < 10) throw new ForgeRunError("A meaningful reason of at least 10 characters is required.", 400, "reason_required")
  return value
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "23505")
}
