import "server-only"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  isForgeJobInlineOnly,
  resolveForgeJobModeForKind,
  type ForgeJobKind,
  type ForgeJobMode,
} from "@/lib/forge-jobs"
import {
  FORGE_COMMAND_CHAT_MEMORY_KEY,
  readForgeCommandChatMemory,
  type ForgeCommandMessageStatus,
} from "@/lib/forge-command-chat"
import { forgeActivityLogs, forgeMemories, forgeTasks } from "@/lib/schema"
import {
  buildForgeJobOwner,
  claimForgeJobById,
  claimNextForgeJob,
  completeForgeJob,
  failForgeJob,
  heartbeatForgeJob,
  insertForgeJob,
  FORGE_JOB_LEASE_TTL_MS,
  type ForgeJobRow,
} from "./forge-job-queue"
import { normalizeForgeOperatorError } from "@/lib/forge-operator-error"
import { isForgeAnimationPack } from "@/lib/forge-animation"
import { isForgeDesignStylePack } from "@/lib/forge-design"
import type { ForgeExportKind } from "@/lib/forge-export"
import { ForgeAiBudgetExceededError, assertForgeAiBudgetAllowsJob } from "./forge-ai-usage"
import { normalizeUnknownError } from "./logging"
import { requestLogger } from "./request-context"
import { addMonitoringBreadcrumb, captureMonitoringException, captureMonitoringMessage, withMonitoringScope } from "./monitoring"

export class ForgeJobError extends Error {
  safeMessage: string
  status: number

  constructor(safeMessage: string, status = 500) {
    super(safeMessage)
    this.name = "ForgeJobError"
    this.safeMessage = safeMessage
    this.status = status
  }
}

type JobPayload = Record<string, unknown>
type JobResult = Record<string, unknown>
type JobHandler = (projectId: number, actor: string, payload: JobPayload) => Promise<JobResult>
const AI_BACKED_JOB_KINDS = new Set<ForgeJobKind>(["research", "sitemap", "copy", "design", "design_system", "component_spec", "seo", "quality_review", "visual_critique", "repair", "visual_qa"])

/**
 * The job registry maps each long-running Forge action to a handler. Handlers lazily import the
 * agent module so that merely importing this runner (which every Forge action route does) does
 * NOT pull the entire agent dependency graph (pg, node:child_process, zlib, AI, drizzle, ...) into
 * every route bundle. Static imports here previously bundled all agents into every route, which
 * blew up `next build` compile time and stalled "Collecting page data". Agents are still executed
 * exactly as before — they own the detailed forgeTasks/forgeArtifacts/forgeActivityLogs updates.
 */
const JOB_HANDLERS: Record<ForgeJobKind, JobHandler> = {
  research: async (projectId, actor) => (await import("./forge-research-agent")).runForgeResearchAgent(projectId, actor),
  sitemap: async (projectId, actor) => (await import("./forge-sitemap-agent")).runForgeSitemapAgent(projectId, actor),
  copy: async (projectId, actor, payload) =>
    (await import("./forge-copy-agent")).runForgeCopyAgent(projectId, actor, typeof payload.regeneratePagePath === "string" ? payload.regeneratePagePath : null),
  design: async (projectId, actor, payload) =>
    (await import("./forge-design-agent")).runForgeDesignAgent(
      projectId,
      actor,
      isForgeDesignStylePack(payload.preferredStylePack) ? payload.preferredStylePack : null,
      isForgeAnimationPack(payload.preferredAnimationPack) ? payload.preferredAnimationPack : null,
    ),
  design_system: async (projectId, actor) => (await import("./forge-design-system-agent")).runForgeDesignSystemAgent(projectId, actor),
  component_spec: async (projectId, actor) => (await import("./forge-component-spec-agent")).runForgeComponentSpecAgent(projectId, actor),
  accessibility_gate: async (projectId, actor) => (await import("./forge-accessibility-agent")).runForgeAccessibilityAgent(projectId, actor),
  consistency_review: async (projectId, actor) => (await import("./forge-consistency-agent")).runForgeConsistencyEvaluator(projectId, actor),
  copy_quality_review: async (projectId, actor) => (await import("./forge-copy-quality-agent")).runForgeCopyQualityEvaluator(projectId, actor),
  review_council: async (projectId, actor) => (await import("./forge-review-council-agent")).runForgeReviewCouncil(projectId, actor),
  originality_review: async (projectId, actor) => (await import("./forge-originality-agent")).runForgeOriginalityEvaluator(projectId, actor),
  site_inventory: async (projectId, actor, payload) => (await import("./forge-site-inventory-agent")).runForgeSiteInventoryAgent(
    projectId,
    actor,
    typeof payload.startUrl === "string" ? payload.startUrl : "",
    {
      maxPages: typeof payload.maxPages === "number" ? payload.maxPages : undefined,
      maxDepth: typeof payload.maxDepth === "number" ? payload.maxDepth : undefined,
      allowedDomains: Array.isArray(payload.allowedDomains) ? payload.allowedDomains.filter((value): value is string => typeof value === "string") : undefined,
      robotsPolicy: payload.robotsPolicy === "ignore" ? "ignore" : "respect",
    },
  ),
  migration_analysis: async (projectId, actor) => (await import("./forge-migration-analysis-agent")).runForgeMigrationAnalysisAgent(projectId, actor),
  migration_execution: async (projectId, actor) => (await import("./forge-migration-execution-agent")).runForgeMigrationExecutionAgent(projectId, actor),
  // Code generation is deliberately atomic. SEO, critique, QA, repair and preview
  // are scheduled only by the Forge Run orchestration registry.
  generate_site: async (projectId, actor) => (await import("./forge-frontend-code-agent")).runForgeFrontendCodeAgent(projectId, actor),
  seo: async (projectId, actor) => (await import("./forge-seo-agent")).runForgeSeoAgent(projectId, actor),
  quality_review: async () => ({ ok: true, skipped: true, reason: "Legacy aggregate review is superseded by atomic consistency, copy-quality and originality stages." }),
  visual_critique: async (projectId, actor) => (await import("./forge-visual-critique-agent")).runForgeVisualCritiqueAgent(projectId, actor),
  qa: async (projectId, actor) => (await import("./forge-qa-agent")).runForgeQaAgent(projectId, actor),
  repair: async (projectId, actor) => (await import("./forge-qa-agent")).runForgeRepairAgent(projectId, actor),
  visual_qa: async (projectId, actor) => (await import("./forge-visual-qa-agent")).runForgeVisualQaAgent(projectId, actor),
  preview_start: async (projectId, actor) => ({ ok: true, preview: await (await import("./forge-preview")).startForgePreview(projectId, actor) }),
  proposal: async (projectId, actor, payload) =>
    (await import("./forge-proposal-agent")).runForgeProposalAgent(projectId, actor, payload.action === "audit" ? "audit" : "proposal"),
  export: async (projectId, actor, payload) => {
    const kind = isForgeExportKind(payload.kind) ? payload.kind : "proposal"
    const result = await (await import("./forge-export-agent")).runForgeExport(projectId, actor, kind)
    return {
      ok: true,
      filename: result.filename,
      contentType: result.contentType,
      fileCount: result.fileCount,
      excludedCount: result.excludedCount,
      note: "Export was generated and recorded. Download files from the Export panel.",
    }
  },
}

// Re-exported so callers keep importing durable-queue operations from the runner.
export { cancelForgeJob, reapExpiredForgeJobLeases } from "./forge-job-queue"

export interface EnqueueForgeJobInput {
  projectId: number
  kind: ForgeJobKind
  actor: string
  payload?: JobPayload
  mode?: ForgeJobMode
  autoStart?: boolean
  /** When set, a repeat enqueue with the same key returns the existing job. */
  idempotencyKey?: string
  /** Optional Forge task this job belongs to. */
  taskId?: number
  /** Override the default retry ceiling. */
  maxAttempts?: number
}

export type EnqueueForgeJobOutcome =
  | { mode: "inline"; jobId: number; result: JobResult }
  | { mode: "background"; jobId: number }

/**
 * Maps an enqueue outcome to a JSON response body. Inline returns the handler's result verbatim
 * (backwards compatible with the previous synchronous routes); background returns the job id so
 * the client can poll. Use as `NextResponse.json(forgeJobResponseBody(outcome))`.
 */
export function forgeJobResponseBody(outcome: EnqueueForgeJobOutcome): JobResult {
  return outcome.mode === "inline"
    ? outcome.result
    : { ok: true, queued: true, jobId: outcome.jobId }
}

/**
 * Creates a job row and either runs it inline (development fallback / inline-only kinds) or
 * schedules background execution and returns immediately.
 */
export async function enqueueForgeJob(input: EnqueueForgeJobInput): Promise<EnqueueForgeJobOutcome> {
  const log = requestLogger({
    component: "forge-job-runner",
    actorId: input.actor,
    projectId: input.projectId,
    forgeStage: input.kind,
  })
  if (isForgeJobInlineOnly(input.kind)) {
    throw new ForgeJobError(`Job kind "${input.kind}" streams its result and cannot be queued.`, 400)
  }
  if (!(input.kind in JOB_HANDLERS)) {
    throw new ForgeJobError(`Unknown job kind "${input.kind}".`, 400)
  }
  if (AI_BACKED_JOB_KINDS.has(input.kind)) {
    try {
      await assertForgeAiBudgetAllowsJob(input.projectId)
    } catch (error) {
      if (error instanceof ForgeAiBudgetExceededError) {
        captureMonitoringMessage("Forge AI budget exhausted", "warning", {
          projectId: input.projectId,
          forgeStage: input.kind,
          errorCategory: "budget_exceeded",
        })
        throw new ForgeJobError(error.safeMessage, 402)
      }
      throw error
    }
  }

  const mode = input.mode ?? resolveForgeJobModeForKind(input.kind)

  const { job, deduplicated } = await insertForgeJob({
    projectId: input.projectId,
    kind: input.kind,
    actor: input.actor,
    payload: input.payload ?? {},
    taskId: input.taskId ?? (typeof input.payload?.commandTaskId === "number" ? input.payload.commandTaskId : null),
    idempotencyKey: input.idempotencyKey ?? null,
    maxAttempts: input.maxAttempts,
  })

  if (deduplicated) {
    log.info("Forge job deduplicated by idempotency key", { jobId: job.id, executionMode: mode })
    if (mode === "inline") return { mode: "inline", jobId: job.id, result: job.resultJson ?? { ok: true, deduplicated: true } }
    return { mode: "background", jobId: job.id }
  }

  await db.insert(forgeActivityLogs).values({
    projectId: input.projectId,
    actor: input.actor,
    action: "job_queued",
    message: `Queued ${input.kind} job.`,
    metadataJson: { jobId: job.id, kind: input.kind, mode },
  })
  log.info("Forge job queued", { jobId: job.id, executionMode: mode })
  addMonitoringBreadcrumb({ category: "forge.task", message: "Forge job queued", data: { projectId: input.projectId, jobId: job.id, forgeStage: input.kind } })

  if (mode === "inline") {
    const result = await processForgeJob(job.id, { propagate: true })
    return { mode: "inline", jobId: job.id, result: result ?? { ok: true } }
  }

  // Fire-and-forget background execution in the persistent server process. The durable job row
  // is the source of truth, so a restart is recovered by the worker (reaper + queue drain).
  if (input.autoStart !== false) {
    void processForgeJob(job.id, { propagate: false }).catch(() => undefined)
  }
  return { mode: "background", jobId: job.id }
}

/**
 * Claims a specific queued job by id and runs it under a lease. Claiming is atomic and
 * guarded on status='queued', so concurrent in-process execution and the worker loop never run
 * the same job twice.
 */
export async function processForgeJob(jobId: number, options: { propagate?: boolean; owner?: string } = {}): Promise<JobResult | null> {
  const owner = options.owner ?? buildForgeJobOwner("inline")
  const claimed = await claimForgeJobById(jobId, owner)
  if (!claimed) return null
  return runClaimedForgeJob(claimed, owner, options)
}

/**
 * Runs an already-claimed job's handler under its lease: heartbeats to keep the lease alive,
 * then completes, or fails (retry with backoff / dead-letter) on error.
 */
export async function runClaimedForgeJob(claimed: ForgeJobRow, owner: string, options: { propagate?: boolean } = {}): Promise<JobResult | null> {
  const startedAt = new Date()
  const payload = claimed.payloadJson as JobPayload
  const taskId = typeof payload.commandTaskId === "number" ? payload.commandTaskId : undefined
  const log = requestLogger({
    component: "forge-job-runner",
    actorId: claimed.actor ?? "system",
    projectId: claimed.projectId,
    taskId,
    jobId: claimed.id,
    forgeStage: claimed.kind,
    retryCount: claimed.attempts,
  })
  log.info("Forge job started")
  await markCommandJobProgress(claimed.projectId, claimed.actor ?? "system", claimed.id, payload, "running")

  const handler = JOB_HANDLERS[claimed.kind as ForgeJobKind]
  if (!handler) {
    // Unknown kind is permanent: force the dead-letter path rather than retrying.
    const operatorError = normalizeForgeOperatorError(`Unknown job kind "${claimed.kind}".`, {
      stage: claimed.kind,
      category: "internal_error",
      retryable: false,
      jobId: claimed.id,
      runId: typeof payload.forgeRunId === "number" ? payload.forgeRunId : null,
      technicalReference: `forge:job:${claimed.id}:unknown-kind`,
      metadata: { attemptCount: claimed.attempts, maxAttempts: claimed.maxAttempts },
    })
    await failForgeJob({ ...claimed, attempts: claimed.maxAttempts }, operatorError.summary, operatorError)
    if (options.propagate) throw new ForgeJobError(`Unknown job kind "${claimed.kind}".`, 400)
    return null
  }

  const heartbeat = setInterval(() => {
    void heartbeatForgeJob(claimed.id, owner).catch(() => undefined)
  }, Math.max(5_000, Math.floor(FORGE_JOB_LEASE_TTL_MS / 3)))
  if (typeof heartbeat.unref === "function") heartbeat.unref()

  try {
    const result = await withMonitoringScope({ projectId: claimed.projectId, taskId, forgeStage: claimed.kind, jobId: claimed.id }, () => handler(claimed.projectId, claimed.actor ?? "system", payload))
    clearInterval(heartbeat)
    await completeForgeJob(claimed.id, owner, result)
    await import("./forge-run-orchestrator")
      .then(({ handleForgeRunJobOutcome }) => handleForgeRunJobOutcome(claimed.id, "completed"))
      .catch((error) => captureMonitoringException(error, { projectId: claimed.projectId, jobId: claimed.id, errorCategory: "forge_run_callback" }))
    await markCommandJobProgress(claimed.projectId, claimed.actor ?? "system", claimed.id, payload, "completed", result)
    log.info("Forge job completed", { durationMs: Date.now() - startedAt.getTime() })
    return result
  } catch (error) {
    clearInterval(heartbeat)
    const safeMessage = extractSafeMessage(error)
    const normalizedError = normalizeUnknownError(error, { safeMessage, category: "forge_job" })
    const operatorError = normalizeForgeOperatorError(error, {
      stage: typeof payload.forgeRunStage === "string" ? payload.forgeRunStage : claimed.kind,
      jobId: claimed.id,
      runId: typeof payload.forgeRunId === "number" ? payload.forgeRunId : null,
      technicalReference: `forge:job:${claimed.id}:attempt:${claimed.attempts}`,
      affectedArtifactIds: Array.isArray(payload.affectedArtifactIds) ? payload.affectedArtifactIds.filter((id): id is number => typeof id === "number") : [],
      metadata: { attemptCount: claimed.attempts, maxAttempts: claimed.maxAttempts, kind: claimed.kind },
    })
    const { retried } = await failForgeJob(claimed, operatorError.summary, operatorError)
    await import("./forge-run-orchestrator")
      .then(({ handleForgeRunJobOutcome }) => handleForgeRunJobOutcome(claimed.id, "failed", operatorError.summary))
      .catch((callbackError) => captureMonitoringException(callbackError, { projectId: claimed.projectId, jobId: claimed.id, errorCategory: "forge_run_callback" }))
    await markCommandJobProgress(claimed.projectId, claimed.actor ?? "system", claimed.id, payload, "failed", { error: safeMessage })
    log.error("Forge job failed", {
      durationMs: Date.now() - startedAt.getTime(),
      errorCategory: normalizedError.category,
      retried,
      attempts: claimed.attempts,
      error: normalizedError,
    })
    captureMonitoringException(error, { projectId: claimed.projectId, taskId, forgeStage: claimed.kind, jobId: claimed.id, errorCategory: normalizedError.category })
    if (options.propagate) throw error
    return null
  }
}

/**
 * Drains due jobs by claiming them under a lease. Safe to run concurrently across workers and
 * replicas (FOR UPDATE SKIP LOCKED). Used by the worker loop and the cron backstop.
 */
export async function runDueForgeJobs(limit = 5, owner = buildForgeJobOwner("drain")): Promise<{ processed: number; jobIds: number[] }> {
  const max = Math.max(1, Math.min(limit, 25))
  const jobIds: number[] = []
  for (let index = 0; index < max; index += 1) {
    const claimed = await claimNextForgeJob(owner)
    if (!claimed) break
    await runClaimedForgeJob(claimed, owner, { propagate: false })
    jobIds.push(claimed.id)
  }
  return { processed: jobIds.length, jobIds }
}

async function markCommandJobProgress(
  projectId: number,
  actor: string,
  jobId: number,
  payload: JobPayload,
  status: Extract<ForgeCommandMessageStatus, "running" | "completed" | "failed">,
  output?: Record<string, unknown>,
) {
  const commandTaskId = typeof payload.commandTaskId === "number" ? payload.commandTaskId : null
  const commandMessageId = typeof payload.commandMessageId === "string" ? payload.commandMessageId : null
  const commandAction = typeof payload.commandAction === "string" ? payload.commandAction : null

  if (!commandTaskId && !commandMessageId) return

  const now = new Date()
  await db.transaction(async (tx) => {
    if (commandTaskId) {
      await tx.update(forgeTasks).set({
        status,
        outputJson: status === "failed" ? { error: output?.error ?? "Job failed.", jobId, commandAction } : { ...(output ?? {}), jobId, commandAction },
        error: status === "failed" && typeof output?.error === "string" ? output.error : null,
        startedAt: status === "running" ? now : undefined,
        completedAt: status === "completed" || status === "failed" ? now : undefined,
        updatedAt: now,
      }).where(eq(forgeTasks.id, commandTaskId))
    }

    const [memory] = await tx
      .select({ id: forgeMemories.id, value: forgeMemories.value })
      .from(forgeMemories)
      .where(and(eq(forgeMemories.projectId, projectId), eq(forgeMemories.key, FORGE_COMMAND_CHAT_MEMORY_KEY)))
      .limit(1)

    if (memory) {
      const state = readForgeCommandChatMemory(memory.value)
      const nextState = {
        ...state,
        messages: state.messages.map((message) => {
          const sameMessage = commandMessageId ? message.id === commandMessageId : false
          const sameJob = typeof message.jobId === "number" ? message.jobId === jobId : false
          const sameTask = commandTaskId && message.role === "assistant" ? message.taskId === commandTaskId : false
          return sameMessage || sameJob || sameTask ? { ...message, status } : message
        }),
        updatedAt: now.toISOString(),
      }

      await tx.update(forgeMemories).set({
        value: JSON.stringify(nextState),
        updatedAt: now,
      }).where(eq(forgeMemories.id, memory.id))
    }

    await tx.insert(forgeActivityLogs).values({
      projectId,
      actor,
      action: `command_job_${status}`,
      message: `Command job ${jobId} ${status}${commandAction ? ` for ${commandAction}` : ""}.`,
      metadataJson: { jobId, commandTaskId, commandMessageId, commandAction, output },
    })
  }).catch((error) => {
    captureMonitoringException(error, { projectId, taskId: commandTaskId ?? undefined, jobId, errorCategory: "database_transaction" })
    throw error
  })
}

function isForgeExportKind(value: unknown): value is ForgeExportKind {
  return value === "site" || value === "proposal" || value === "audit" || value === "handover"
}

function extractSafeMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const candidate = error as { safeMessage?: unknown; message?: unknown }
    if (typeof candidate.safeMessage === "string" && candidate.safeMessage) return candidate.safeMessage
    if (typeof candidate.message === "string" && candidate.message) return candidate.message
  }
  return "Job failed."
}
