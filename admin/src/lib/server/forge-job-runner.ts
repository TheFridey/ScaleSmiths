import "server-only"
import { and, asc, eq, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  isForgeJobInlineOnly,
  resolveForgeJobModeForKind,
  type ForgeJobKind,
  type ForgeJobMode,
} from "@/lib/forge-jobs"
import { forgeActivityLogs, forgeJobs } from "@/lib/schema"
import { isForgeAnimationPack } from "@/lib/forge-animation"
import { isForgeDesignStylePack } from "@/lib/forge-design"
import { runForgeResearchAgent } from "./forge-research-agent"
import { runForgeSitemapAgent } from "./forge-sitemap-agent"
import { runForgeCopyAgent } from "./forge-copy-agent"
import { runForgeDesignAgent } from "./forge-design-agent"
import { runForgeComponentSpecAgent } from "./forge-component-spec-agent"
import { runForgeFrontendCodeAgent } from "./forge-frontend-code-agent"
import { runForgeQaAgent, runForgeRepairAgent } from "./forge-qa-agent"
import { startForgePreview } from "./forge-preview"
import { runForgeProposalAgent } from "./forge-proposal-agent"

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

/**
 * The job registry maps each long-running Forge action to a handler. Handlers delegate to the
 * existing agents, which own the detailed forgeTasks/forgeArtifacts/forgeActivityLogs updates.
 * Adding a future automatic execution path only means swapping how handlers are invoked.
 */
const JOB_HANDLERS: Record<Exclude<ForgeJobKind, "export">, JobHandler> = {
  research: (projectId, actor) => runForgeResearchAgent(projectId, actor),
  sitemap: (projectId, actor) => runForgeSitemapAgent(projectId, actor),
  copy: (projectId, actor, payload) =>
    runForgeCopyAgent(projectId, actor, typeof payload.regeneratePagePath === "string" ? payload.regeneratePagePath : null),
  design: (projectId, actor, payload) =>
    runForgeDesignAgent(
      projectId,
      actor,
      isForgeDesignStylePack(payload.preferredStylePack) ? payload.preferredStylePack : null,
      isForgeAnimationPack(payload.preferredAnimationPack) ? payload.preferredAnimationPack : null,
    ),
  component_spec: (projectId, actor) => runForgeComponentSpecAgent(projectId, actor),
  generate_site: (projectId, actor) => runForgeFrontendCodeAgent(projectId, actor),
  qa: (projectId, actor) => runForgeQaAgent(projectId, actor),
  repair: (projectId, actor) => runForgeRepairAgent(projectId, actor),
  preview_start: async (projectId, actor) => ({ ok: true, preview: await startForgePreview(projectId, actor) }),
  proposal: (projectId, actor, payload) =>
    runForgeProposalAgent(projectId, actor, payload.action === "audit" ? "audit" : "proposal"),
}

export interface EnqueueForgeJobInput {
  projectId: number
  kind: ForgeJobKind
  actor: string
  payload?: JobPayload
  mode?: ForgeJobMode
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
  if (isForgeJobInlineOnly(input.kind)) {
    throw new ForgeJobError(`Job kind "${input.kind}" streams its result and cannot be queued.`, 400)
  }
  if (!(input.kind in JOB_HANDLERS)) {
    throw new ForgeJobError(`Unknown job kind "${input.kind}".`, 400)
  }

  const mode = input.mode ?? resolveForgeJobModeForKind(input.kind)
  const now = new Date()

  const [job] = await db.insert(forgeJobs).values({
    projectId: input.projectId,
    kind: input.kind,
    status: "queued",
    payloadJson: input.payload ?? {},
    actor: input.actor,
    updatedAt: now,
  }).returning()

  await db.insert(forgeActivityLogs).values({
    projectId: input.projectId,
    actor: input.actor,
    action: "job_queued",
    message: `Queued ${input.kind} job.`,
    metadataJson: { jobId: job.id, kind: input.kind, mode },
  })

  if (mode === "inline") {
    const result = await processForgeJob(job.id, { propagate: true })
    return { mode: "inline", jobId: job.id, result: result ?? { ok: true } }
  }

  // Fire-and-forget background execution in the persistent server process. The job row is the
  // source of truth, so a restart can be recovered by draining the queue (runDueForgeJobs).
  void processForgeJob(job.id, { propagate: false }).catch(() => undefined)
  return { mode: "background", jobId: job.id }
}

/**
 * Claims a queued job and runs its handler. Claiming is atomic (UPDATE ... WHERE status='queued')
 * so concurrent in-process execution and queue draining never run the same job twice.
 */
export async function processForgeJob(jobId: number, options: { propagate?: boolean } = {}): Promise<JobResult | null> {
  const startedAt = new Date()
  const [claimed] = await db
    .update(forgeJobs)
    .set({ status: "running", startedAt, updatedAt: startedAt })
    .where(and(eq(forgeJobs.id, jobId), eq(forgeJobs.status, "queued")))
    .returning()

  if (!claimed) return null

  const handler = JOB_HANDLERS[claimed.kind as Exclude<ForgeJobKind, "export">]
  if (!handler) {
    await failJob(jobId, claimed.attempts, `Unknown job kind "${claimed.kind}".`)
    if (options.propagate) throw new ForgeJobError(`Unknown job kind "${claimed.kind}".`, 400)
    return null
  }

  try {
    const result = await handler(claimed.projectId, claimed.actor ?? "system", (claimed.payloadJson as JobPayload) ?? {})
    const completedAt = new Date()
    await db.update(forgeJobs).set({
      status: "completed",
      resultJson: result,
      error: null,
      completedAt,
      updatedAt: completedAt,
    }).where(eq(forgeJobs.id, jobId))
    return result
  } catch (error) {
    const safeMessage = extractSafeMessage(error)
    await failJob(jobId, claimed.attempts, safeMessage)
    if (options.propagate) throw error
    return null
  }
}

/**
 * Drains queued jobs. Intended for an external trigger (cron/worker) to recover jobs that were
 * enqueued but never started (e.g. the process restarted before background execution ran).
 */
export async function runDueForgeJobs(limit = 5): Promise<{ processed: number; jobIds: number[] }> {
  const due = await db
    .select({ id: forgeJobs.id })
    .from(forgeJobs)
    .where(inArray(forgeJobs.status, ["queued"]))
    .orderBy(asc(forgeJobs.createdAt))
    .limit(Math.max(1, Math.min(limit, 25)))

  const jobIds: number[] = []
  for (const { id } of due) {
    const result = await processForgeJob(id, { propagate: false })
    if (result !== null) jobIds.push(id)
  }
  return { processed: jobIds.length, jobIds }
}

async function failJob(jobId: number, attempts: number, message: string) {
  const completedAt = new Date()
  await db.update(forgeJobs).set({
    status: "failed",
    error: message,
    attempts: attempts + 1,
    completedAt,
    updatedAt: completedAt,
  }).where(eq(forgeJobs.id, jobId))
}

function extractSafeMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const candidate = error as { safeMessage?: unknown; message?: unknown }
    if (typeof candidate.safeMessage === "string" && candidate.safeMessage) return candidate.safeMessage
    if (typeof candidate.message === "string" && candidate.message) return candidate.message
  }
  return "Job failed."
}
