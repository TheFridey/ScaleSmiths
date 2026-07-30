import "server-only"
import { desc, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { forgeJobs, forgeProjects, forgeProviderHealth, forgeRuns, forgeRunSteps, forgeWorkerHeartbeats } from "@/lib/schema"
import { deriveForgeAttentionItems, deriveForgeOperationalHealth, type ForgeHealthJob } from "@/lib/forge-operational-health"
import { normalizeForgeOperatorError } from "@/lib/forge-operator-error"
import { isForgeWorkerEnabled } from "./forge-worker"
import { loadProviderHealthSnapshot } from "./forge-provider-health"

export async function loadForgeOperationalHealth() {
  const [heartbeats, jobs, projects, runSteps, providerSnapshot, providerEvents, duration] = await Promise.all([
    db.select().from(forgeWorkerHeartbeats).orderBy(desc(forgeWorkerHeartbeats.lastHeartbeatAt)).limit(20),
    db.select().from(forgeJobs).orderBy(desc(forgeJobs.updatedAt)).limit(500),
    db.select({ id: forgeProjects.id, name: forgeProjects.name, businessName: forgeProjects.businessName }).from(forgeProjects),
    db.select({ runId: forgeRunSteps.runId, jobId: forgeRunSteps.jobId, stage: forgeRunSteps.stage, operatorErrorJson: forgeRunSteps.operatorErrorJson }).from(forgeRunSteps).orderBy(desc(forgeRunSteps.updatedAt)).limit(500),
    loadProviderHealthSnapshot(),
    db.select({ provider: forgeProviderHealth.provider, projectId: forgeProviderHealth.projectId, createdAt: forgeProviderHealth.createdAt }).from(forgeProviderHealth).orderBy(desc(forgeProviderHealth.createdAt)).limit(100),
    db.select({ average: sql<number | null>`avg(extract(epoch from (${forgeRuns.completedAt} - ${forgeRuns.startedAt})) * 1000)` }).from(forgeRuns),
  ])
  const stepByJob = new Map(runSteps.filter((step) => step.jobId).map((step) => [step.jobId!, step]))
  const healthJobs: ForgeHealthJob[] = jobs.map((job) => {
    const step = stepByJob.get(job.id)
    return {
      id: job.id,
      projectId: job.projectId,
      runId: step?.runId ?? null,
      stage: step?.stage ?? job.kind,
      kind: job.kind,
      status: job.status,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      scheduledAt: job.scheduledAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      heartbeatAt: job.heartbeatAt,
      leaseOwner: job.leaseOwner,
      failureReason: job.failureReason,
      operatorError: job.operatorErrorJson ?? step?.operatorErrorJson ?? null,
    }
  })
  const recoveredLeases = heartbeats.reduce((total, heartbeat) => total + metadataNumber(heartbeat.metadataJson.recoveredLeases), 0)
  const health = deriveForgeOperationalHealth({
    heartbeats,
    jobs: healthJobs,
    workerEnabled: isForgeWorkerEnabled(),
    recoveredLeases,
    averageRunDurationMs: duration[0]?.average ? Number(duration[0].average) : null,
  })
  const outageProviders = providerSnapshot.providers.filter((provider) => provider.state === "open")
  const providerOutages = outageProviders.map((provider) => ({
    provider: provider.provider,
    projectIds: [...new Set(providerEvents.filter((event) => event.provider === provider.provider && event.projectId).map((event) => event.projectId!))],
    occurredAt: providerEvents.find((event) => event.provider === provider.provider)?.createdAt ?? new Date(),
    fallbackAvailable: providerSnapshot.providers.some((candidate) => candidate.provider !== provider.provider && candidate.state !== "open"),
  }))
  const errors = healthJobs.filter((job) => job.operatorError).map((job) => ({ projectId: job.projectId, runId: job.runId, error: job.operatorError! }))
  for (const job of healthJobs.filter((item) => ["failed", "dead_letter"].includes(item.status) && !item.operatorError)) {
    errors.push({
      projectId: job.projectId,
      runId: job.runId,
      error: normalizeForgeOperatorError(job.failureReason ?? "Forge job failed.", {
        stage: job.stage,
        jobId: job.id,
        runId: job.runId,
        retryable: job.status !== "dead_letter",
        technicalReference: `forge:job:${job.id}`,
        metadata: { attemptCount: job.attempts, maxAttempts: job.maxAttempts },
      }),
    })
  }
  const attention = deriveForgeAttentionItems({ projects, jobs: healthJobs, providerOutages, errors })
  return { health, attention, providers: providerSnapshot, jobs: healthJobs }
}

function metadataNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}
