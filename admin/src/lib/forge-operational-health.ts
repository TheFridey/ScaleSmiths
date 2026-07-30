import type { ForgeOperatorError } from "./forge-operator-error"

export const FORGE_HEARTBEAT_DEGRADED_MS = 30_000
export const FORGE_HEARTBEAT_OFFLINE_MS = 90_000
export const FORGE_QUEUE_STALE_MS = 15 * 60_000

export type ForgeWorkerState = "alive" | "degraded" | "offline"
export type ForgeAttentionSeverity = "critical" | "high" | "medium" | "low"

export interface ForgeHealthHeartbeat {
  workerId: string
  processId: number
  hostname: string
  lastHeartbeatAt: Date | string
  activeJobCount: number
  metadataJson: Record<string, unknown>
}

export interface ForgeHealthJob {
  id: number
  projectId: number
  runId?: number | null
  stage?: string | null
  kind: string
  status: string
  attempts: number
  maxAttempts: number
  scheduledAt: Date | string
  startedAt?: Date | string | null
  completedAt?: Date | string | null
  heartbeatAt?: Date | string | null
  leaseOwner?: string | null
  failureReason?: string | null
  operatorError?: ForgeOperatorError | null
}

export interface ForgeOperationalHealth {
  state: ForgeWorkerState
  workerEnabled: boolean
  lastHeartbeat: string | null
  queueDepth: number
  oldestQueuedJobAgeMs: number | null
  activeJobs: number
  failedJobs: number
  deadLetterJobs: number
  recoveredLeases: number
  currentWorkerIdentity: string | null
  averageQueueWaitMs: number | null
  averageRunDurationMs: number | null
  signals: Array<{ code: string; severity: ForgeAttentionSeverity; summary: string }>
}

export interface ForgeAttentionItem {
  id: string
  severity: ForgeAttentionSeverity
  projectId: number
  projectName: string
  businessName: string
  runId: number | null
  stage: string | null
  explanation: string
  recommendedAction: string
  availableActions: Array<"retry" | "retry_fallback" | "cancel" | "approve" | "configure" | "open">
  ageMs: number
  technicalDetails: { reference: string; category: string; jobId: number | null; attemptCount: number | null; nextRetryAt: string | null }
  deepLink: string
  category: string
  occurredAt: Date
}

export function deriveForgeOperationalHealth(input: {
  heartbeats: ForgeHealthHeartbeat[]
  jobs: ForgeHealthJob[]
  workerEnabled: boolean
  recoveredLeases?: number
  averageRunDurationMs?: number | null
  now?: Date
}): ForgeOperationalHealth {
  const now = input.now ?? new Date()
  const heartbeat = [...input.heartbeats].sort((a, b) => date(b.lastHeartbeatAt).getTime() - date(a.lastHeartbeatAt).getTime())[0] ?? null
  const heartbeatAge = heartbeat ? now.getTime() - date(heartbeat.lastHeartbeatAt).getTime() : Number.POSITIVE_INFINITY
  const state: ForgeWorkerState = !input.workerEnabled || heartbeatAge >= FORGE_HEARTBEAT_OFFLINE_MS
    ? "offline"
    : heartbeatAge >= FORGE_HEARTBEAT_DEGRADED_MS
      ? "degraded"
      : "alive"
  const queued = input.jobs.filter((job) => job.status === "queued")
  const active = input.jobs.filter((job) => job.status === "running")
  const completed = input.jobs.filter((job) => job.startedAt)
  const queueWaits = completed.map((job) => date(job.startedAt!).getTime() - date(job.scheduledAt).getTime()).filter((value) => value >= 0)
  const signals: ForgeOperationalHealth["signals"] = []
  if (!input.workerEnabled) signals.push({ code: "worker_disabled", severity: "critical", summary: "The Forge worker is disabled." })
  else if (!heartbeat) signals.push({ code: "no_heartbeat", severity: "critical", summary: "No Forge worker heartbeat has been recorded." })
  else if (state !== "alive") signals.push({ code: "heartbeat_expired", severity: state === "offline" ? "critical" : "high", summary: `Worker heartbeat is ${state}.` })
  if (queued.some((job) => now.getTime() - date(job.scheduledAt).getTime() >= FORGE_QUEUE_STALE_MS)) signals.push({ code: "queue_stalled", severity: "high", summary: "One or more jobs have exceeded the queue threshold." })
  if (active.some((job) => !job.heartbeatAt || now.getTime() - date(job.heartbeatAt).getTime() >= FORGE_HEARTBEAT_OFFLINE_MS)) signals.push({ code: "running_without_heartbeat", severity: "critical", summary: "A running job has no current heartbeat." })
  if ((input.recoveredLeases ?? 0) >= 3) signals.push({ code: "repeated_lease_loss", severity: "high", summary: "Worker leases have been recovered repeatedly." })
  if (input.jobs.filter((job) => job.operatorError?.category.startsWith("provider_")).length >= 3) signals.push({ code: "repeated_provider_failure", severity: "high", summary: "Providers have failed repeatedly across recent jobs." })
  if (input.jobs.some((job) => job.kind === "repair" && job.status === "dead_letter")) signals.push({ code: "auto_repair_ceiling", severity: "critical", summary: "Automatic repair exhausted its permitted attempts." })
  if (input.jobs.some((job) => job.status === "dead_letter")) signals.push({ code: "dead_letter", severity: "critical", summary: "One or more jobs exhausted all retry attempts." })
  return {
    state,
    workerEnabled: input.workerEnabled,
    lastHeartbeat: heartbeat ? date(heartbeat.lastHeartbeatAt).toISOString() : null,
    queueDepth: queued.length,
    oldestQueuedJobAgeMs: queued.length ? Math.max(...queued.map((job) => now.getTime() - date(job.scheduledAt).getTime())) : null,
    activeJobs: active.length,
    failedJobs: input.jobs.filter((job) => job.status === "failed").length,
    deadLetterJobs: input.jobs.filter((job) => job.status === "dead_letter").length,
    recoveredLeases: input.recoveredLeases ?? 0,
    currentWorkerIdentity: heartbeat ? `${heartbeat.workerId} · ${heartbeat.hostname}:${heartbeat.processId}` : null,
    averageQueueWaitMs: queueWaits.length ? Math.round(queueWaits.reduce((sum, value) => sum + value, 0) / queueWaits.length) : null,
    averageRunDurationMs: input.averageRunDurationMs ?? null,
    signals,
  }
}

export function deriveForgeAttentionItems(input: {
  projects: Array<{ id: number; name: string; businessName: string }>
  jobs: ForgeHealthJob[]
  providerOutages?: Array<{ provider: string; projectIds: number[]; occurredAt: Date | string; fallbackAvailable: boolean }>
  errors?: Array<{ projectId: number; runId?: number | null; error: ForgeOperatorError }>
  now?: Date
}): ForgeAttentionItem[] {
  const now = input.now ?? new Date()
  const projects = new Map(input.projects.map((project) => [project.id, project]))
  const items: ForgeAttentionItem[] = []
  const add = (projectId: number, error: ForgeOperatorError, occurredAt: Date | string, actions: ForgeAttentionItem["availableActions"], nextRetryAt: string | null = null) => {
    const project = projects.get(projectId)
    if (!project) return
    const stage = error.stage || null
    const itemKey = error.jobId ? `job-${error.jobId}` : `${error.category}-${error.runId ?? "project"}`
    items.push({
      id: itemKey,
      severity: severityFor(error),
      projectId,
      projectName: project.name,
      businessName: project.businessName,
      runId: error.runId,
      stage,
      explanation: error.summary,
      recommendedAction: error.recommendedAction,
      availableActions: actions,
      ageMs: Math.max(0, now.getTime() - date(occurredAt).getTime()),
      technicalDetails: { reference: error.technicalReference, category: error.category, jobId: error.jobId, attemptCount: numberMetadata(error.metadata.attemptCount), nextRetryAt },
      deepLink: buildForgeAttentionDeepLink(projectId, error.runId, stage, itemKey),
      category: error.category,
      occurredAt: date(occurredAt),
    })
  }
  for (const item of input.errors ?? []) {
    add(item.projectId, item.error, item.error.timestamp, actionsFor(item.error))
  }
  for (const job of input.jobs) {
    if (job.operatorError) {
      add(job.projectId, job.operatorError, job.operatorError.timestamp, actionsForJob(job), job.status === "queued" ? date(job.scheduledAt).toISOString() : null)
    } else if (job.status === "dead_letter") {
      add(job.projectId, fallbackJobError(job, "internal_error", "The job exhausted all retry attempts.", false), job.completedAt ?? job.scheduledAt, ["open"])
    } else if (job.status === "failed") {
      add(job.projectId, fallbackJobError(job, "internal_error", job.failureReason ?? `${label(job.kind)} failed.`, true), job.completedAt ?? job.scheduledAt, ["retry", "open"])
    } else if (job.status === "queued" && now.getTime() - date(job.scheduledAt).getTime() >= FORGE_QUEUE_STALE_MS) {
      add(job.projectId, fallbackJobError(job, "queue_stalled", `${label(job.kind)} has remained queued beyond the operational threshold.`, true), job.scheduledAt, ["retry", "cancel", "open"], date(job.scheduledAt).toISOString())
    }
  }
  for (const outage of input.providerOutages ?? []) {
    for (const projectId of outage.projectIds) {
      const affected = input.jobs.find((job) => job.projectId === projectId && ["queued", "running"].includes(job.status))
      const error = fallbackJobError(affected ?? syntheticJob(projectId), "provider_unavailable", `${label(outage.provider)} is unavailable${outage.fallbackAvailable ? ", but a healthy fallback is available." : "."}`, outage.fallbackAvailable)
      add(projectId, error, outage.occurredAt, outage.fallbackAvailable ? ["retry_fallback", "open"] : ["open"])
    }
  }
  return dedupe(items).sort(compareAttention)
}

export function buildForgeAttentionDeepLink(projectId: number, runId: number | null, stage: string | null, itemId: string) {
  const params = new URLSearchParams({ view: "attention", item: itemId })
  if (runId) params.set("run", String(runId))
  if (stage) params.set("stage", stage)
  return `/forge/${projectId}?${params.toString()}`
}

export function canRetryForgeJob(job: ForgeHealthJob) {
  if (!["failed", "dead_letter", "cancelled"].includes(job.status)) return { allowed: false, reason: "Only terminal failed or cancelled jobs can be retried." }
  if (job.status === "dead_letter" && !job.operatorError?.retryable) return { allowed: false, reason: "This dead-letter failure is not retryable until its prerequisite is corrected." }
  if (job.attempts >= job.maxAttempts && job.status !== "dead_letter") return { allowed: false, reason: "The job has exhausted its configured attempts." }
  return { allowed: true, reason: null }
}

function fallbackJobError(job: ForgeHealthJob, category: ForgeOperatorError["category"], summary: string, retryable: boolean): ForgeOperatorError {
  return {
    stage: job.stage ?? job.kind,
    category,
    summary,
    technicalReference: `forge:job:${job.id}`,
    retryable,
    recommendedAction: retryable ? "Restore the failed dependency, then retry or cancel the job." : "Open the technical details and correct the blocking prerequisite.",
    affectedArtifactIds: [],
    jobId: job.id,
    runId: job.runId ?? null,
    timestamp: date(job.completedAt ?? job.scheduledAt).toISOString(),
    metadata: { attemptCount: job.attempts, maxAttempts: job.maxAttempts },
  }
}

function syntheticJob(projectId: number): ForgeHealthJob {
  return { id: 0, projectId, kind: "provider", status: "failed", attempts: 0, maxAttempts: 0, scheduledAt: new Date(0) }
}

function actionsFor(error: ForgeOperatorError): ForgeAttentionItem["availableActions"] {
  if (error.category === "approval_required") return ["approve", "open"]
  if (error.category === "integration_missing") return ["configure", "open"]
  return error.retryable ? ["retry", "cancel", "open"] : ["open"]
}

function actionsForJob(job: ForgeHealthJob): ForgeAttentionItem["availableActions"] {
  const retry = canRetryForgeJob(job)
  return [...(retry.allowed ? ["retry" as const] : []), ...(["queued", "running"].includes(job.status) ? ["cancel" as const] : []), "open"]
}

function severityFor(error: ForgeOperatorError): ForgeAttentionSeverity {
  if (["budget_exceeded", "deployment_blocked", "worker_unavailable"].includes(error.category)) return "critical"
  if (["provider_unavailable", "provider_output_invalid", "build_error", "quality_failure", "queue_stalled"].includes(error.category)) return "high"
  if (["approval_required", "integration_missing", "missing_input"].includes(error.category)) return "medium"
  return error.retryable ? "high" : "medium"
}

function dedupe(items: ForgeAttentionItem[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${item.projectId}:${item.category}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function compareAttention(a: ForgeAttentionItem, b: ForgeAttentionItem) {
  const severity = { critical: 0, high: 1, medium: 2, low: 3 }
  return severity[a.severity] - severity[b.severity] || b.ageMs - a.ageMs || a.id.localeCompare(b.id)
}

function numberMetadata(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function date(value: Date | string) {
  return value instanceof Date ? value : new Date(value)
}

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}
