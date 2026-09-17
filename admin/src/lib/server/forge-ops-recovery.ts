import "server-only"
import { eq, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { forgeActivityLogs, forgeJobs } from "@/lib/schema"
import {
  validateForgeOpsRecoveryConfirmation,
  type ForgeOpsRecoveryAction,
} from "@/lib/forge-ops-health"
import { reapExpiredForgeJobLeases, retryForgeJob } from "./forge-job-queue"
import { reconcileForgePreviews } from "./forge-preview"
import { captureMonitoringException } from "./monitoring"

export interface ForgeOpsRecoveryResult {
  ok: boolean
  action: ForgeOpsRecoveryAction
  message: string
  retriedJobId?: number
  requeued?: number
  deadLettered?: number
  reconciledPreviews?: number
  previewFailures?: number
}

export async function executeForgeOpsRecovery(input: {
  action: unknown
  confirmation: unknown
  jobId?: unknown
  actor: string
}): Promise<{ status: number; body: { error?: string; result?: ForgeOpsRecoveryResult } }> {
  const parsed = validateForgeOpsRecoveryConfirmation(input)
  if (!parsed.ok) return { status: 400, body: { error: parsed.error } }

  try {
    if (parsed.action === "retry_dead_letter") return await retryDeadLetter(parsed.jobId!, input.actor)
    if (parsed.action === "reap_expired_leases") return await reapLeases(input.actor)
    return await reconcilePreviews(input.actor)
  } catch (error) {
    captureMonitoringException(error, { errorCategory: "forge_ops_recovery", actorId: input.actor })
    return { status: 500, body: { error: "The recovery action failed." } }
  }
}

async function retryDeadLetter(jobId: number, actor: string) {
  const [job] = await db.select({
    id: forgeJobs.id,
    projectId: forgeJobs.projectId,
    status: forgeJobs.status,
    kind: forgeJobs.kind,
  }).from(forgeJobs).where(eq(forgeJobs.id, jobId)).limit(1)
  if (!job) return { status: 404, body: { error: "Job not found." } }
  if (job.status !== "dead_letter") return { status: 409, body: { error: "Only dead-lettered jobs can be retried from this view." } }
  const result = await retryForgeJob(jobId)
  if (!result.retried) return { status: 409, body: { error: result.reason ?? "Retry is unavailable." } }
  await writeAudit({
    projectId: job.projectId,
    actor,
    action: "ops_retry_dead_letter",
    message: `Requeued dead-lettered ${job.kind} job #${job.id} from Forge operations.`,
    metadataJson: { jobId: job.id, kind: job.kind, recoveryAction: "retry_dead_letter" },
  })
  return {
    status: 200,
    body: { result: { ok: true, action: "retry_dead_letter" as const, message: `Job #${job.id} was requeued.`, retriedJobId: job.id } },
  }
}

async function reapLeases(actor: string) {
  const recovered = await reapExpiredForgeJobLeases()
  const ids = [...recovered.requeuedIds, ...recovered.deadLetteredIds]
  if (ids.length) {
    const rows = await db.select({
      id: forgeJobs.id,
      projectId: forgeJobs.projectId,
      kind: forgeJobs.kind,
      status: forgeJobs.status,
    }).from(forgeJobs).where(inArray(forgeJobs.id, ids))
    for (const row of rows) {
      await writeAudit({
        projectId: row.projectId,
        actor,
        action: "ops_reap_expired_lease",
        message: `Recovered expired lease for ${row.kind} job #${row.id} from Forge operations (${row.status}).`,
        metadataJson: { jobId: row.id, kind: row.kind, recoveryAction: "reap_expired_leases", outcome: recovered.requeuedIds.includes(row.id) ? "requeued" : "dead_lettered" },
      })
    }
  }
  return {
    status: 200,
    body: {
      result: {
        ok: true,
        action: "reap_expired_leases" as const,
        message: recovered.requeued + recovered.deadLettered === 0
          ? "No expired job leases were found."
          : `Requeued ${recovered.requeued} job(s) and dead-lettered ${recovered.deadLettered} job(s).`,
        requeued: recovered.requeued,
        deadLettered: recovered.deadLettered,
      },
    },
  }
}

async function reconcilePreviews(actor: string) {
  const result = await reconcileForgePreviews({ actor })
  return {
    status: result.failures.length ? 207 : 200,
    body: {
      result: {
        ok: result.failures.length === 0,
        action: "reconcile_abandoned_previews" as const,
        message: result.reconciled === 0 && result.failures.length === 0
          ? "No abandoned previews required reconciliation. Live leases were left untouched."
          : `Reconciled ${result.reconciled} preview(s). ${result.failures.length} cleanup failure(s) need host attention.`,
        reconciledPreviews: result.reconciled,
        previewFailures: result.failures.length,
      },
    },
  }
}

async function writeAudit(input: { projectId: number; actor: string; action: string; message: string; metadataJson: Record<string, unknown> }) {
  await db.insert(forgeActivityLogs).values(input)
}
