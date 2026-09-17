import { FORGE_HEARTBEAT_DEGRADED_MS, FORGE_HEARTBEAT_OFFLINE_MS, FORGE_QUEUE_STALE_MS } from "./forge-operational-health"
import { normalizeForgeOperatorError } from "./forge-operator-error"

export const FORGE_OPS_DETAIL_LIMIT = 50
export const FORGE_OPS_RETRY_STORM_MIN_ATTEMPTS = 2

export const FORGE_OPS_RECOVERY_ACTIONS = ["retry_dead_letter", "reap_expired_leases", "reconcile_abandoned_previews"] as const
export type ForgeOpsRecoveryAction = (typeof FORGE_OPS_RECOVERY_ACTIONS)[number]

export type ForgeOpsAlertSeverity = "warning" | "critical"
export type ForgeOpsWorkerState = "alive" | "degraded" | "offline"
export type ForgeOpsPreviewOwnership = "local" | "remote_healthy" | "inaccessible" | "abandoned" | "idle"

export interface ForgeOpsThresholds {
  queueDepthWarning: number
  queueDepthCritical: number
  oldestQueuedAgeMsWarning: number
  oldestQueuedAgeMsCritical: number
  expiredLeaseCountWarning: number
  retryStormCountWarning: number
  retryStormMinAttempts: number
  deadLetterCountWarning: number
  abandonedPreviewCountWarning: number
  inaccessiblePreviewCountWarning: number
}

export const FORGE_OPS_THRESHOLD_DEFAULTS: ForgeOpsThresholds = {
  queueDepthWarning: 8,
  queueDepthCritical: 20,
  oldestQueuedAgeMsWarning: 5 * 60_000,
  oldestQueuedAgeMsCritical: FORGE_QUEUE_STALE_MS,
  expiredLeaseCountWarning: 1,
  retryStormCountWarning: 3,
  retryStormMinAttempts: FORGE_OPS_RETRY_STORM_MIN_ATTEMPTS,
  deadLetterCountWarning: 1,
  abandonedPreviewCountWarning: 1,
  inaccessiblePreviewCountWarning: 1,
}

export interface ForgeOpsAlert {
  code:
    | "forge_ops_queue_depth"
    | "forge_ops_oldest_queued_age"
    | "forge_ops_expired_leases"
    | "forge_ops_retry_storm"
    | "forge_ops_dead_letters"
    | "forge_ops_abandoned_previews"
    | "forge_ops_inaccessible_previews"
  severity: ForgeOpsAlertSeverity
  summary: string
  count: number
  threshold: number
  errorCategory: string
}

export interface ForgeOpsWorker {
  workerId: string
  hostname: string
  processId: number
  lastHeartbeatAt: string
  activeJobCount: number
  state: ForgeOpsWorkerState
  identity: { hostname: string; pid: number | null }
}

export interface ForgeOpsJobRow {
  id: number
  projectId: number
  projectName: string | null
  kind: string
  status: string
  attempts: number
  maxAttempts: number
  scheduledAt: string
  startedAt: string | null
  heartbeatAt: string | null
  leaseOwner: string | null
  leaseExpiresAt: string | null
  leaseExpired: boolean
  ageMs: number
  failureSummary: string | null
  retryable: boolean
}

export interface ForgeOpsLeaseRow {
  jobId: number
  projectId: number
  projectName: string | null
  kind: string
  workerId: string
  leaseExpiresAt: string
  heartbeatAt: string | null
  expired: boolean
  ageMs: number
}

export interface ForgeOpsPreviewRow {
  projectId: number
  projectName: string | null
  status: string
  owner: string | null
  leaseExpiresAt: string | null
  heartbeatAt: string | null
  method: string | null
  ownership: ForgeOpsPreviewOwnership
  ownerHeartbeatAt: string | null
  error: string | null
}

export interface ForgeOpsRecoverySpec {
  action: ForgeOpsRecoveryAction
  confirmation: string
  description: string
  requiresTarget: boolean
}

export interface ForgeOpsSnapshot {
  generatedAt: string
  currentInstanceId: string
  workerEnabled: boolean
  workers: ForgeOpsWorker[]
  queue: {
    depth: number
    byStatus: Record<string, number>
    oldestQueuedAgeMs: number | null
    oldestQueuedJobId: number | null
    oldestQueued: ForgeOpsJobRow[]
  }
  leases: {
    active: number
    expired: number
    byWorker: Array<{ workerId: string; active: number; expired: number }>
    items: ForgeOpsLeaseRow[]
  }
  retries: {
    stormCount: number
    minAttempts: number
    items: ForgeOpsJobRow[]
  }
  deadLetters: {
    count: number
    items: ForgeOpsJobRow[]
  }
  previews: {
    running: number
    abandoned: number
    inaccessible: number
    items: ForgeOpsPreviewRow[]
  }
  alerts: ForgeOpsAlert[]
  thresholds: ForgeOpsThresholds
  recoveryActions: ForgeOpsRecoverySpec[]
}

export interface ForgeOpsJobInput {
  id: number
  projectId: number
  projectName?: string | null
  kind: string
  status: string
  attempts: number
  maxAttempts: number
  scheduledAt: Date | string
  startedAt?: Date | string | null
  heartbeatAt?: Date | string | null
  leaseOwner?: string | null
  leaseExpiresAt?: Date | string | null
  failureReason?: string | null
  operatorError?: { summary?: string; retryable?: boolean; recommendedAction?: string } | null
  payloadJson?: unknown
  resultJson?: unknown
  error?: string | null
}

export interface ForgeOpsPreviewInput {
  projectId: number
  projectName?: string | null
  status: string
  owner?: string | null
  leaseExpiresAt?: Date | string | null
  heartbeatAt?: Date | string | null
  method?: string | null
  error?: string | null
  workspacePath?: string | null
  url?: string | null
  containerId?: string | null
}

export interface ForgeOpsHeartbeatInput {
  workerId: string
  processId: number
  hostname: string
  lastHeartbeatAt: Date | string
  activeJobCount: number
}

export function resolveForgeOpsThresholds(env: Record<string, string | undefined> = process.env): ForgeOpsThresholds {
  return {
    queueDepthWarning: readPositiveInt(env.FORGE_OPS_QUEUE_DEPTH_WARNING, FORGE_OPS_THRESHOLD_DEFAULTS.queueDepthWarning),
    queueDepthCritical: readPositiveInt(env.FORGE_OPS_QUEUE_DEPTH_CRITICAL, FORGE_OPS_THRESHOLD_DEFAULTS.queueDepthCritical),
    oldestQueuedAgeMsWarning: readPositiveInt(env.FORGE_OPS_OLDEST_QUEUED_AGE_MS_WARNING, FORGE_OPS_THRESHOLD_DEFAULTS.oldestQueuedAgeMsWarning),
    oldestQueuedAgeMsCritical: readPositiveInt(env.FORGE_OPS_OLDEST_QUEUED_AGE_MS_CRITICAL, FORGE_OPS_THRESHOLD_DEFAULTS.oldestQueuedAgeMsCritical),
    expiredLeaseCountWarning: readPositiveInt(env.FORGE_OPS_EXPIRED_LEASE_WARNING, FORGE_OPS_THRESHOLD_DEFAULTS.expiredLeaseCountWarning),
    retryStormCountWarning: readPositiveInt(env.FORGE_OPS_RETRY_STORM_WARNING, FORGE_OPS_THRESHOLD_DEFAULTS.retryStormCountWarning),
    retryStormMinAttempts: readPositiveInt(env.FORGE_OPS_RETRY_STORM_MIN_ATTEMPTS, FORGE_OPS_THRESHOLD_DEFAULTS.retryStormMinAttempts),
    deadLetterCountWarning: readPositiveInt(env.FORGE_OPS_DEAD_LETTER_WARNING, FORGE_OPS_THRESHOLD_DEFAULTS.deadLetterCountWarning),
    abandonedPreviewCountWarning: readPositiveInt(env.FORGE_OPS_ABANDONED_PREVIEW_WARNING, FORGE_OPS_THRESHOLD_DEFAULTS.abandonedPreviewCountWarning),
    inaccessiblePreviewCountWarning: readPositiveInt(env.FORGE_OPS_INACCESSIBLE_PREVIEW_WARNING, FORGE_OPS_THRESHOLD_DEFAULTS.inaccessiblePreviewCountWarning),
  }
}

export function parseForgeOwnerIdentity(owner: string | null | undefined): { hostname: string; pid: number | null } | null {
  if (!owner?.trim()) return null
  const parts = owner.split(":").filter(Boolean)
  if (parts[0] === "worker" && parts.length >= 3) {
    const pid = Number.parseInt(parts[2] ?? "", 10)
    return { hostname: parts[1] ?? owner, pid: Number.isInteger(pid) && pid > 0 ? pid : null }
  }
  if (parts.length >= 2) {
    const pid = Number.parseInt(parts[1] ?? "", 10)
    return { hostname: parts[0] ?? owner, pid: Number.isInteger(pid) && pid > 0 ? pid : null }
  }
  return { hostname: owner, pid: null }
}

export function ownerIdentitiesMatch(left: string | null | undefined, right: string | null | undefined) {
  if (left && right && left === right) return true
  const a = parseForgeOwnerIdentity(left)
  const b = parseForgeOwnerIdentity(right)
  if (!a || !b || !a.hostname || a.hostname !== b.hostname) return false
  return a.pid !== null && b.pid !== null && a.pid === b.pid
}

export function confirmationPhraseFor(action: ForgeOpsRecoveryAction, target?: { jobId?: number }) {
  if (action === "retry_dead_letter") return `RETRY JOB ${target?.jobId ?? "<id>"}`
  if (action === "reap_expired_leases") return "REAP EXPIRED LEASES"
  return "RECONCILE PREVIEWS"
}

export function documentedForgeOpsRecoveryActions(): ForgeOpsRecoverySpec[] {
  return [
    {
      action: "retry_dead_letter",
      confirmation: confirmationPhraseFor("retry_dead_letter"),
      description: "Requeue one dead-lettered job after the cause is corrected. Requires typing RETRY JOB <id>.",
      requiresTarget: true,
    },
    {
      action: "reap_expired_leases",
      confirmation: confirmationPhraseFor("reap_expired_leases"),
      description: "Requeue running jobs whose lease has expired, or dead-letter those with no attempts left. Never clears a live lease.",
      requiresTarget: false,
    },
    {
      action: "reconcile_abandoned_previews",
      confirmation: confirmationPhraseFor("reconcile_abandoned_previews"),
      description: "Stop recorded containers and mark starting/running previews whose ownership lease has expired. Active leases are not taken over.",
      requiresTarget: false,
    },
  ]
}

export function validateForgeOpsRecoveryConfirmation(input: {
  action: unknown
  confirmation: unknown
  jobId?: unknown
}): { ok: true; action: ForgeOpsRecoveryAction; jobId: number | null } | { ok: false; error: string } {
  if (!isRecoveryAction(input.action)) return { ok: false, error: "Unknown recovery action." }
  const jobId = typeof input.jobId === "number" && Number.isInteger(input.jobId) && input.jobId > 0
    ? input.jobId
    : Number.parseInt(String(input.jobId ?? ""), 10)
  const targetId = Number.isInteger(jobId) && jobId > 0 ? jobId : null
  if (input.action === "retry_dead_letter" && !targetId) return { ok: false, error: "A job id is required to retry a dead letter." }
  const expected = confirmationPhraseFor(input.action, { jobId: targetId ?? undefined })
  const provided = typeof input.confirmation === "string" ? input.confirmation.trim() : ""
  if (provided !== expected) return { ok: false, error: `Type ${expected} to confirm this recovery action.` }
  return { ok: true, action: input.action, jobId: targetId }
}

export function sanitizeForgeOpsText(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const error = normalizeForgeOperatorError(value)
  if (/(?:\bprompt\b|generated (?:code|content|source)|completion tokens|providerResponse)/i.test(error.summary)) {
    return `Forge reported a ${error.category.replaceAll("_", " ")} failure.`
  }
  return error.summary
}

export function deriveForgeOpsSnapshot(input: {
  jobs: ForgeOpsJobInput[]
  previews: ForgeOpsPreviewInput[]
  heartbeats: ForgeOpsHeartbeatInput[]
  currentInstanceId: string
  workerEnabled: boolean
  now?: Date
  thresholds?: ForgeOpsThresholds
}): ForgeOpsSnapshot {
  const now = input.now ?? new Date()
  const thresholds = input.thresholds ?? FORGE_OPS_THRESHOLD_DEFAULTS
  const workers = input.heartbeats
    .map((heartbeat) => {
      const age = now.getTime() - toDate(heartbeat.lastHeartbeatAt).getTime()
      const state: ForgeOpsWorkerState = age >= FORGE_HEARTBEAT_OFFLINE_MS ? "offline" : age >= FORGE_HEARTBEAT_DEGRADED_MS ? "degraded" : "alive"
      return {
        workerId: heartbeat.workerId,
        hostname: heartbeat.hostname,
        processId: heartbeat.processId,
        lastHeartbeatAt: toDate(heartbeat.lastHeartbeatAt).toISOString(),
        activeJobCount: heartbeat.activeJobCount,
        state,
        identity: parseForgeOwnerIdentity(heartbeat.workerId) ?? { hostname: heartbeat.hostname, pid: heartbeat.processId },
      }
    })
    .sort((left, right) => right.lastHeartbeatAt.localeCompare(left.lastHeartbeatAt))

  const jobs = input.jobs.map((job) => toJobRow(job, now))
  const queued = jobs.filter((job) => job.status === "queued").sort((left, right) => right.ageMs - left.ageMs)
  const byStatus: Record<string, number> = {}
  for (const job of jobs) byStatus[job.status] = (byStatus[job.status] ?? 0) + 1

  const leases = jobs
    .filter((job) => job.status === "running" && job.leaseOwner && job.leaseExpiresAt)
    .map((job) => ({
      jobId: job.id,
      projectId: job.projectId,
      projectName: job.projectName,
      kind: job.kind,
      workerId: job.leaseOwner!,
      leaseExpiresAt: job.leaseExpiresAt!,
      heartbeatAt: job.heartbeatAt,
      expired: job.leaseExpired,
      ageMs: job.ageMs,
    }))
    .sort((left, right) => Number(right.expired) - Number(left.expired) || right.ageMs - left.ageMs)

  const workerLeaseIds = [...new Set(leases.map((lease) => lease.workerId))]
  const byWorker = workerLeaseIds.map((workerId) => ({
    workerId,
    active: leases.filter((lease) => lease.workerId === workerId && !lease.expired).length,
    expired: leases.filter((lease) => lease.workerId === workerId && lease.expired).length,
  }))

  const retryItems = jobs
    .filter((job) => ["queued", "running"].includes(job.status) && job.attempts >= thresholds.retryStormMinAttempts)
    .sort((left, right) => right.attempts - left.attempts || right.ageMs - left.ageMs)
  const deadLetters = jobs.filter((job) => job.status === "dead_letter").sort((left, right) => right.ageMs - left.ageMs)

  const previews = input.previews
    .map((preview) => toPreviewRow(preview, {
      now,
      currentInstanceId: input.currentInstanceId,
      workers,
    }))
    .sort((left, right) => ownershipRank(left.ownership) - ownershipRank(right.ownership))

  const snapshot: ForgeOpsSnapshot = {
    generatedAt: now.toISOString(),
    currentInstanceId: input.currentInstanceId,
    workerEnabled: input.workerEnabled,
    workers,
    queue: {
      depth: queued.length,
      byStatus,
      oldestQueuedAgeMs: queued[0]?.ageMs ?? null,
      oldestQueuedJobId: queued[0]?.id ?? null,
      oldestQueued: queued.slice(0, FORGE_OPS_DETAIL_LIMIT),
    },
    leases: {
      active: leases.filter((lease) => !lease.expired).length,
      expired: leases.filter((lease) => lease.expired).length,
      byWorker,
      items: leases.slice(0, FORGE_OPS_DETAIL_LIMIT),
    },
    retries: {
      stormCount: retryItems.length,
      minAttempts: thresholds.retryStormMinAttempts,
      items: retryItems.slice(0, FORGE_OPS_DETAIL_LIMIT),
    },
    deadLetters: {
      count: deadLetters.length,
      items: deadLetters.slice(0, FORGE_OPS_DETAIL_LIMIT),
    },
    previews: {
      running: previews.filter((preview) => preview.status === "running" || preview.status === "starting").length,
      abandoned: previews.filter((preview) => preview.ownership === "abandoned").length,
      inaccessible: previews.filter((preview) => preview.ownership === "inaccessible").length,
      items: previews.slice(0, FORGE_OPS_DETAIL_LIMIT),
    },
    alerts: [],
    thresholds,
    recoveryActions: documentedForgeOpsRecoveryActions(),
  }
  snapshot.alerts = evaluateForgeOpsAlerts(snapshot)
  return snapshot
}

export function evaluateForgeOpsAlerts(snapshot: Pick<ForgeOpsSnapshot, "queue" | "leases" | "retries" | "deadLetters" | "previews" | "thresholds">): ForgeOpsAlert[] {
  const alerts: ForgeOpsAlert[] = []
  const { thresholds } = snapshot
  if (snapshot.queue.depth >= thresholds.queueDepthCritical) {
    alerts.push(alert("forge_ops_queue_depth", "critical", `${snapshot.queue.depth} jobs are queued.`, snapshot.queue.depth, thresholds.queueDepthCritical))
  } else if (snapshot.queue.depth >= thresholds.queueDepthWarning) {
    alerts.push(alert("forge_ops_queue_depth", "warning", `${snapshot.queue.depth} jobs are queued.`, snapshot.queue.depth, thresholds.queueDepthWarning))
  }
  const oldest = snapshot.queue.oldestQueuedAgeMs
  if (oldest !== null && oldest >= thresholds.oldestQueuedAgeMsCritical) {
    alerts.push(alert("forge_ops_oldest_queued_age", "critical", "The oldest queued job has exceeded the critical age threshold.", oldest, thresholds.oldestQueuedAgeMsCritical))
  } else if (oldest !== null && oldest >= thresholds.oldestQueuedAgeMsWarning) {
    alerts.push(alert("forge_ops_oldest_queued_age", "warning", "The oldest queued job has exceeded the warning age threshold.", oldest, thresholds.oldestQueuedAgeMsWarning))
  }
  if (snapshot.leases.expired >= thresholds.expiredLeaseCountWarning) {
    alerts.push(alert("forge_ops_expired_leases", snapshot.leases.expired >= 3 ? "critical" : "warning", `${snapshot.leases.expired} running job lease(s) have expired.`, snapshot.leases.expired, thresholds.expiredLeaseCountWarning))
  }
  if (snapshot.retries.stormCount >= thresholds.retryStormCountWarning) {
    alerts.push(alert("forge_ops_retry_storm", snapshot.retries.stormCount >= thresholds.retryStormCountWarning * 2 ? "critical" : "warning", `${snapshot.retries.stormCount} in-flight jobs have retried at least ${snapshot.retries.minAttempts} times.`, snapshot.retries.stormCount, thresholds.retryStormCountWarning))
  }
  if (snapshot.deadLetters.count >= thresholds.deadLetterCountWarning) {
    alerts.push(alert("forge_ops_dead_letters", "critical", `${snapshot.deadLetters.count} job(s) are in dead letter.`, snapshot.deadLetters.count, thresholds.deadLetterCountWarning))
  }
  if (snapshot.previews.abandoned >= thresholds.abandonedPreviewCountWarning) {
    alerts.push(alert("forge_ops_abandoned_previews", "warning", `${snapshot.previews.abandoned} preview(s) have expired ownership leases.`, snapshot.previews.abandoned, thresholds.abandonedPreviewCountWarning))
  }
  if (snapshot.previews.inaccessible >= thresholds.inaccessiblePreviewCountWarning) {
    alerts.push(alert("forge_ops_inaccessible_previews", "warning", `${snapshot.previews.inaccessible} preview(s) are owned by an unreachable instance whose lease is still active.`, snapshot.previews.inaccessible, thresholds.inaccessiblePreviewCountWarning))
  }
  return alerts
}

export function forgeOpsAlertKey(alerts: ForgeOpsAlert[]) {
  return alerts.map((item) => `${item.code}:${item.severity}`).sort().join("|")
}

export function forgeOpsAlertsToMonitoringEvents(alerts: ForgeOpsAlert[]) {
  return alerts.map((item) => ({
    message: item.summary,
    level: item.severity === "critical" ? "error" as const : "warning" as const,
    context: {
      errorCategory: item.errorCategory,
      alertCode: item.code,
      count: item.count,
      threshold: item.threshold,
    },
  }))
}

function toJobRow(job: ForgeOpsJobInput, now: Date): ForgeOpsJobRow {
  const scheduledAt = toDate(job.scheduledAt)
  const leaseExpiresAt = job.leaseExpiresAt ? toDate(job.leaseExpiresAt) : null
  const leaseExpired = job.status === "running" && Boolean(leaseExpiresAt && leaseExpiresAt.getTime() < now.getTime())
  const retryable = job.status === "dead_letter"
    ? job.operatorError?.retryable !== false
    : ["failed", "cancelled"].includes(job.status)
  return {
    id: job.id,
    projectId: job.projectId,
    projectName: job.projectName ?? null,
    kind: job.kind,
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    scheduledAt: scheduledAt.toISOString(),
    startedAt: job.startedAt ? toDate(job.startedAt).toISOString() : null,
    heartbeatAt: job.heartbeatAt ? toDate(job.heartbeatAt).toISOString() : null,
    leaseOwner: job.leaseOwner ?? null,
    leaseExpiresAt: leaseExpiresAt?.toISOString() ?? null,
    leaseExpired,
    ageMs: Math.max(0, now.getTime() - scheduledAt.getTime()),
    failureSummary: sanitizeForgeOpsText(job.operatorError?.summary ?? job.failureReason ?? job.error ?? null),
    retryable,
  }
}

function toPreviewRow(preview: ForgeOpsPreviewInput, input: {
  now: Date
  currentInstanceId: string
  workers: ForgeOpsWorker[]
}): ForgeOpsPreviewRow {
  const leaseExpiresAt = preview.leaseExpiresAt ? toDate(preview.leaseExpiresAt) : null
  const active = preview.status === "running" || preview.status === "starting"
  const local = ownerIdentitiesMatch(preview.owner, input.currentInstanceId)
  const matchingWorker = input.workers.find((worker) => ownerIdentitiesMatch(preview.owner, worker.workerId) || (
    worker.hostname === parseForgeOwnerIdentity(preview.owner)?.hostname
    && worker.processId === parseForgeOwnerIdentity(preview.owner)?.pid
  ))
  const leaseExpired = Boolean(leaseExpiresAt && leaseExpiresAt.getTime() < input.now.getTime())
  let ownership: ForgeOpsPreviewOwnership = "idle"
  if (active && local && !leaseExpired) ownership = "local"
  else if (active && leaseExpired) ownership = "abandoned"
  else if (active && preview.owner && !leaseExpired && matchingWorker?.state === "alive") ownership = "remote_healthy"
  else if (active && preview.owner && !leaseExpired) ownership = "inaccessible"
  return {
    projectId: preview.projectId,
    projectName: preview.projectName ?? null,
    status: preview.status,
    owner: preview.owner ?? null,
    leaseExpiresAt: leaseExpiresAt?.toISOString() ?? null,
    heartbeatAt: preview.heartbeatAt ? toDate(preview.heartbeatAt).toISOString() : null,
    method: preview.method ?? null,
    ownership,
    ownerHeartbeatAt: matchingWorker?.lastHeartbeatAt ?? null,
    error: sanitizeForgeOpsText(preview.error),
  }
}

function ownershipRank(ownership: ForgeOpsPreviewOwnership) {
  return { abandoned: 0, inaccessible: 1, remote_healthy: 2, local: 3, idle: 4 }[ownership]
}

function alert(code: ForgeOpsAlert["code"], severity: ForgeOpsAlertSeverity, summary: string, count: number, threshold: number): ForgeOpsAlert {
  return { code, severity, summary, count, threshold, errorCategory: code }
}

function isRecoveryAction(value: unknown): value is ForgeOpsRecoveryAction {
  return typeof value === "string" && (FORGE_OPS_RECOVERY_ACTIONS as readonly string[]).includes(value)
}

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value)
}

function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}
