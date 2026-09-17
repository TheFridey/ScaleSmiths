import "server-only"
import { desc, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { forgeJobs, forgePreviews, forgeProjects, forgeWorkerHeartbeats } from "@/lib/schema"
import {
  deriveForgeOpsSnapshot,
  forgeOpsAlertKey,
  forgeOpsAlertsToMonitoringEvents,
  resolveForgeOpsThresholds,
  type ForgeOpsSnapshot,
} from "@/lib/forge-ops-health"
import { getAdminInstanceId } from "./instance-id"
import { captureMonitoringMessage } from "./monitoring"
import { requestLogger } from "./request-context"

const OPS_JOB_LIMIT = 500
const OPS_PREVIEW_LIMIT = 200
const lastReportedAlertKeyByOwner = new Map<string, string>()

export async function loadForgeOpsSnapshot(input: {
  now?: Date
  currentInstanceId?: string
  workerEnabled?: boolean
} = {}): Promise<ForgeOpsSnapshot> {
  const now = input.now ?? new Date()
  const currentInstanceId = input.currentInstanceId ?? getAdminInstanceId()
  const workerEnabled = input.workerEnabled ?? process.env.FORGE_WORKER_DISABLED !== "true"
  const [heartbeats, jobs, previews] = await Promise.all([
    db.select({
      workerId: forgeWorkerHeartbeats.workerId,
      processId: forgeWorkerHeartbeats.processId,
      hostname: forgeWorkerHeartbeats.hostname,
      lastHeartbeatAt: forgeWorkerHeartbeats.lastHeartbeatAt,
      activeJobCount: forgeWorkerHeartbeats.activeJobCount,
    }).from(forgeWorkerHeartbeats).orderBy(desc(forgeWorkerHeartbeats.lastHeartbeatAt)).limit(50),
    db.select({
      id: forgeJobs.id,
      projectId: forgeJobs.projectId,
      kind: forgeJobs.kind,
      status: forgeJobs.status,
      attempts: forgeJobs.attempts,
      maxAttempts: forgeJobs.maxAttempts,
      scheduledAt: forgeJobs.scheduledAt,
      startedAt: forgeJobs.startedAt,
      heartbeatAt: forgeJobs.heartbeatAt,
      leaseOwner: forgeJobs.leaseOwner,
      leaseExpiresAt: forgeJobs.leaseExpiresAt,
      failureReason: forgeJobs.failureReason,
      operatorErrorJson: forgeJobs.operatorErrorJson,
      error: forgeJobs.error,
    }).from(forgeJobs).orderBy(desc(forgeJobs.updatedAt)).limit(OPS_JOB_LIMIT),
    db.select({
      projectId: forgePreviews.projectId,
      status: forgePreviews.status,
      owner: forgePreviews.owner,
      leaseExpiresAt: forgePreviews.leaseExpiresAt,
      heartbeatAt: forgePreviews.heartbeatAt,
      method: forgePreviews.method,
      error: forgePreviews.error,
    }).from(forgePreviews).orderBy(desc(forgePreviews.updatedAt)).limit(OPS_PREVIEW_LIMIT),
  ])
  const projectIds = [...new Set([...jobs.map((row) => row.projectId), ...previews.map((row) => row.projectId)])]
  const projects = projectIds.length
    ? await db.select({ id: forgeProjects.id, name: forgeProjects.name }).from(forgeProjects).where(inArray(forgeProjects.id, projectIds))
    : []
  const projectName = new Map(projects.map((project) => [project.id, project.name]))
  return deriveForgeOpsSnapshot({
    now,
    currentInstanceId,
    workerEnabled,
    thresholds: resolveForgeOpsThresholds(),
    heartbeats,
    jobs: jobs.map((row) => ({
      ...row,
      projectName: projectName.get(row.projectId) ?? null,
      operatorError: row.operatorErrorJson,
    })),
    previews: previews.map((row) => ({
      ...row,
      projectName: projectName.get(row.projectId) ?? null,
    })),
  })
}

export async function reportForgeOpsThresholdAlerts(input: { owner?: string } = {}) {
  const snapshot = await loadForgeOpsSnapshot({ workerEnabled: true })
  const key = forgeOpsAlertKey(snapshot.alerts)
  const owner = input.owner ?? "forge-ops"
  if (lastReportedAlertKeyByOwner.get(owner) === key) return snapshot
  lastReportedAlertKeyByOwner.set(owner, key)
  const log = requestLogger({ component: "forge-ops-health" })
  if (!snapshot.alerts.length) {
    log.info("Forge ops thresholds are clear")
    return snapshot
  }
  for (const event of forgeOpsAlertsToMonitoringEvents(snapshot.alerts)) {
    log.warn(event.message, event.context)
    captureMonitoringMessage(event.message, event.level, event.context)
  }
  return snapshot
}
