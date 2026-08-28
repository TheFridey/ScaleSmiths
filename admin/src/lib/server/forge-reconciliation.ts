import "server-only"
import { and, eq, lt, or } from "drizzle-orm"
import { db } from "@/lib/db"
import { forgeActivityLogs, forgeAiBudgetReservations, forgeJobs, forgePreviews, forgeRuns } from "@/lib/schema"
import { abandonExpiredForgeAiReservations } from "./forge-budget-reservations"
import { reapExpiredForgeJobLeases } from "./forge-job-queue"
import { reconcileForgePreviews } from "./forge-preview"
import { recoverForgeRuns } from "./forge-run-orchestrator"
import { captureMonitoringException } from "./monitoring"

export type ForgeReconciliationResource = "job_lease" | "preview" | "budget_reservation" | "run"
export interface ForgeReconciliationCandidate { resource: ForgeReconciliationResource; id: number; projectId: number | null; reason: string }
export interface ForgeReconciliationFailure extends ForgeReconciliationCandidate { error: string }
export interface ForgeReconciliationResult {
  dryRun: boolean
  startedAt: string
  completedAt: string
  candidates: ForgeReconciliationCandidate[]
  reconciled: ForgeReconciliationCandidate[]
  failures: ForgeReconciliationFailure[]
}

/**
 * Reconciles only durable resources whose explicit lease/expiry has elapsed.
 * Every mutating helper uses a state-and-time guarded UPDATE, so concurrent
 * reconcilers and repeated runs are safe. Persistent workspaces, artifacts and
 * deployment candidates are deliberately outside destructive reconciliation.
 */
export async function reconcileForgeResources(input: { dryRun?: boolean; actor?: string; now?: Date } = {}): Promise<ForgeReconciliationResult> {
  const dryRun = input.dryRun !== false
  const actor = input.actor ?? "system:forge-reconciler"
  const now = input.now ?? new Date()
  const startedAt = now.toISOString()
  const candidates = await findCandidates(now)
  const reconciled: ForgeReconciliationCandidate[] = []
  const failures: ForgeReconciliationFailure[] = []

  if (!dryRun) {
    await runCategory("job_lease", async () => {
      const result = await reapExpiredForgeJobLeases(now)
      return candidates.filter((item) => item.resource === "job_lease" && [...result.requeuedIds, ...result.deadLetteredIds].includes(item.id))
    }, reconciled, failures)
    await runCategory("preview", async () => {
      const result = await reconcileForgePreviews({ now, actor })
      for (const failure of result.failures) failures.push({ resource: "preview", id: failure.projectId, projectId: failure.projectId, reason: "Expired preview ownership lease.", error: failure.error })
      return candidates.filter((item) => item.resource === "preview" && result.reconciledProjectIds.includes(item.id))
    }, reconciled, failures)
    await runCategory("budget_reservation", async () => {
      const rows = await abandonExpiredForgeAiReservations(now)
      return candidates.filter((item) => item.resource === "budget_reservation" && rows.some((row) => row.id === item.id))
    }, reconciled, failures)
    await runCategory("run", async () => {
      await recoverForgeRuns()
      // Run recovery writes its own fine-grained forge_run_events. Do not claim
      // every stale run was mutated merely because it was safely inspected.
      return []
    }, reconciled, failures)

    for (const item of reconciled) {
      if (!item.projectId) continue
      await db.insert(forgeActivityLogs).values({
        projectId: item.projectId,
        actor,
        action: `resource_reconciled_${item.resource}`,
        message: `Reconciled orphaned Forge ${item.resource.replaceAll("_", " ")} #${item.id}.`,
        metadataJson: { resource: item.resource, resourceId: item.id, reason: item.reason, reconciledAt: now.toISOString() },
      }).catch((error) => {
        failures.push({ ...item, error: "The resource changed state, but its reconciliation audit record could not be written." })
        captureMonitoringException(error, { projectId: item.projectId ?? undefined, errorCategory: "forge_reconciliation_audit" })
      })
    }
  }

  return { dryRun, startedAt, completedAt: new Date().toISOString(), candidates, reconciled, failures }
}

async function findCandidates(now: Date): Promise<ForgeReconciliationCandidate[]> {
  const [jobs, previews, reservations, runs] = await Promise.all([
    db.select({ id: forgeJobs.id, projectId: forgeJobs.projectId }).from(forgeJobs).where(and(eq(forgeJobs.status, "running"), lt(forgeJobs.leaseExpiresAt, now))),
    db.select({ id: forgePreviews.projectId, projectId: forgePreviews.projectId }).from(forgePreviews).where(and(or(eq(forgePreviews.status, "running"), eq(forgePreviews.status, "starting")), lt(forgePreviews.leaseExpiresAt, now))),
    db.select({ id: forgeAiBudgetReservations.id, projectId: forgeAiBudgetReservations.projectId }).from(forgeAiBudgetReservations).where(and(eq(forgeAiBudgetReservations.status, "reserved"), lt(forgeAiBudgetReservations.expiresAt, now))),
    db.select({ id: forgeRuns.id, projectId: forgeRuns.projectId }).from(forgeRuns).where(and(eq(forgeRuns.status, "running"), lt(forgeRuns.updatedAt, new Date(now.getTime() - runReconcileAfterMs())))),
  ])
  return [
    ...jobs.map((row) => ({ resource: "job_lease" as const, ...row, reason: "The running job lease expired without a heartbeat." })),
    ...previews.map((row) => ({ resource: "preview" as const, ...row, reason: "The preview ownership lease expired." })),
    ...reservations.map((row) => ({ resource: "budget_reservation" as const, ...row, reason: "The AI budget reservation passed its explicit expiry." })),
    ...runs.map((row) => ({ resource: "run" as const, ...row, reason: "The running Forge run requires durable job-state reconciliation." })),
  ]
}

async function runCategory(resource: ForgeReconciliationResource, operation: () => Promise<ForgeReconciliationCandidate[]>, reconciled: ForgeReconciliationCandidate[], failures: ForgeReconciliationFailure[]) {
  try {
    reconciled.push(...await operation())
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown reconciliation failure."
    failures.push({ resource, id: 0, projectId: null, reason: "The reconciliation category failed.", error: message })
    captureMonitoringException(error, { errorCategory: "forge_reconciliation", forgeStage: resource })
  }
}

function runReconcileAfterMs() {
  const value = Number.parseInt(process.env.FORGE_RUN_RECONCILE_AFTER_MS ?? "", 10)
  return Number.isFinite(value) && value >= 60_000 ? value : 5 * 60_000
}
