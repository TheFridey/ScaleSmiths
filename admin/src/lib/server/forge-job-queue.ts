import "server-only"
import { hostname } from "node:os"
import { randomUUID } from "node:crypto"
import { and, eq, inArray, lt, or, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { forgeJobs } from "@/lib/schema"
import type { ForgeOperatorError } from "@/lib/forge-operator-error"

/** A unique owner id for a worker/claimer within this process. */
export function buildForgeJobOwner(role: string): string {
  return `${role}:${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`
}

// Durable job-queue mechanics shared by the in-process worker and the cron drain.
// The lease model is what makes execution safe across restarts and replicas:
//   * a job is claimed atomically with FOR UPDATE SKIP LOCKED, so two workers can
//     never claim the same row;
//   * the claimer holds a time-boxed lease and heartbeats to extend it;
//   * a crashed worker's lease simply expires and the reaper requeues the job.
// This module owns no handler logic (see forge-job-runner.ts) so it can be unit /
// integration tested against PostgreSQL in isolation.

export const FORGE_JOB_LEASE_TTL_MS = 60_000
export const FORGE_JOB_BASE_BACKOFF_MS = 5_000
export const FORGE_JOB_MAX_BACKOFF_MS = 5 * 60_000
export const FORGE_JOB_DEFAULT_MAX_ATTEMPTS = 3

export type ForgeJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled" | "dead_letter"

export interface ForgeJobRow {
  id: number
  projectId: number
  taskId: number | null
  kind: string
  status: ForgeJobStatus
  payloadJson: Record<string, unknown>
  resultJson: Record<string, unknown> | null
  error: string | null
  failureReason: string | null
  operatorError?: ForgeOperatorError | null
  actor: string | null
  idempotencyKey: string | null
  attempts: number
  maxAttempts: number
  leaseOwner: string | null
  leaseExpiresAt: Date | null
  heartbeatAt: Date | null
  scheduledAt: Date
  startedAt: Date | null
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface JobRowShape {
  id: number
  project_id: number
  task_id: number | null
  kind: string
  status: string
  payload_json: Record<string, unknown> | null
  result_json: Record<string, unknown> | null
  error: string | null
  failure_reason: string | null
  operator_error_json: ForgeOperatorError | null
  actor: string | null
  idempotency_key: string | null
  attempts: number
  max_attempts: number
  lease_owner: string | null
  lease_expires_at: Date | string | null
  heartbeat_at: Date | string | null
  scheduled_at: Date | string
  started_at: Date | string | null
  completed_at: Date | string | null
  created_at: Date | string
  updated_at: Date | string
}

function mapRow(row: JobRowShape): ForgeJobRow {
  return {
    id: row.id,
    projectId: row.project_id,
    taskId: row.task_id,
    kind: row.kind,
    status: row.status as ForgeJobStatus,
    payloadJson: row.payload_json ?? {},
    resultJson: row.result_json ?? null,
    error: row.error,
    failureReason: row.failure_reason,
    operatorError: row.operator_error_json ?? null,
    actor: row.actor,
    idempotencyKey: row.idempotency_key,
    attempts: Number(row.attempts),
    maxAttempts: Number(row.max_attempts),
    leaseOwner: row.lease_owner,
    leaseExpiresAt: toDate(row.lease_expires_at),
    heartbeatAt: toDate(row.heartbeat_at),
    scheduledAt: toDate(row.scheduled_at) ?? new Date(),
    startedAt: toDate(row.started_at),
    completedAt: toDate(row.completed_at),
    createdAt: toDate(row.created_at) ?? new Date(),
    updatedAt: toDate(row.updated_at) ?? new Date(),
  }
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  return value instanceof Date ? value : new Date(value)
}

export interface InsertForgeJobInput {
  projectId: number
  kind: string
  actor: string
  payload?: Record<string, unknown>
  taskId?: number | null
  idempotencyKey?: string | null
  maxAttempts?: number
  scheduledAt?: Date
}

/**
 * Inserts a queued job. When an idempotency key is supplied and already present,
 * the existing job is returned instead of creating a duplicate (task: idempotency).
 */
export async function insertForgeJob(input: InsertForgeJobInput): Promise<{ job: ForgeJobRow; deduplicated: boolean }> {
  const [inserted] = await db
    .insert(forgeJobs)
    .values({
      projectId: input.projectId,
      taskId: input.taskId ?? null,
      kind: input.kind,
      status: "queued",
      payloadJson: input.payload ?? {},
      actor: input.actor,
      idempotencyKey: input.idempotencyKey ?? null,
      maxAttempts: input.maxAttempts ?? FORGE_JOB_DEFAULT_MAX_ATTEMPTS,
      scheduledAt: input.scheduledAt ?? new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoNothing({ target: forgeJobs.idempotencyKey })
    .returning()

  if (inserted) return { job: mapForgeJobEntity(inserted), deduplicated: false }

  // Conflict on idempotency key: return the winning row.
  const [existing] = await db.select().from(forgeJobs).where(eq(forgeJobs.idempotencyKey, input.idempotencyKey!)).limit(1)
  return { job: mapForgeJobEntity(existing), deduplicated: true }
}

// Drizzle returns camelCase entities already; normalise dates/jsonb defensively.
function mapForgeJobEntity(entity: typeof forgeJobs.$inferSelect): ForgeJobRow {
  return {
    id: entity.id,
    projectId: entity.projectId,
    taskId: entity.taskId ?? null,
    kind: entity.kind,
    status: entity.status as ForgeJobStatus,
    payloadJson: (entity.payloadJson as Record<string, unknown>) ?? {},
    resultJson: (entity.resultJson as Record<string, unknown> | null) ?? null,
    error: entity.error ?? null,
    failureReason: entity.failureReason ?? null,
    operatorError: entity.operatorErrorJson ?? null,
    actor: entity.actor ?? null,
    idempotencyKey: entity.idempotencyKey ?? null,
    attempts: entity.attempts,
    maxAttempts: entity.maxAttempts,
    leaseOwner: entity.leaseOwner ?? null,
    leaseExpiresAt: entity.leaseExpiresAt ?? null,
    heartbeatAt: entity.heartbeatAt ?? null,
    scheduledAt: entity.scheduledAt,
    startedAt: entity.startedAt ?? null,
    completedAt: entity.completedAt ?? null,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  }
}

/**
 * Atomically claims the next due queued job for `owner`. FOR UPDATE SKIP LOCKED
 * plus the status guard mean two concurrent workers can never claim the same job.
 */
export async function claimNextForgeJob(owner: string, leaseTtlMs = FORGE_JOB_LEASE_TTL_MS): Promise<ForgeJobRow | null> {
  const result = await db.execute(sql`
    UPDATE forge_jobs SET
      status = 'running',
      lease_owner = ${owner},
      lease_expires_at = now() + ${leaseTtlMs} * interval '1 millisecond',
      heartbeat_at = now(),
      started_at = COALESCE(started_at, now()),
      attempts = attempts + 1,
      updated_at = now()
    WHERE id = (
      SELECT id FROM forge_jobs
      WHERE status = 'queued' AND scheduled_at <= now()
      ORDER BY scheduled_at ASC, created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *`)
  const row = result.rows[0]
  return row ? mapRow(row as unknown as JobRowShape) : null
}

/**
 * Claims a specific queued job by id (the enqueue→auto-start path). Also uses the
 * status guard so it can never race the worker loop into a double execution.
 */
export async function claimForgeJobById(jobId: number, owner: string, leaseTtlMs = FORGE_JOB_LEASE_TTL_MS): Promise<ForgeJobRow | null> {
  const result = await db.execute(sql`
    UPDATE forge_jobs SET
      status = 'running',
      lease_owner = ${owner},
      lease_expires_at = now() + ${leaseTtlMs} * interval '1 millisecond',
      heartbeat_at = now(),
      started_at = COALESCE(started_at, now()),
      attempts = attempts + 1,
      updated_at = now()
    WHERE id = ${jobId} AND status = 'queued'
    RETURNING *`)
  const row = result.rows[0]
  return row ? mapRow(row as unknown as JobRowShape) : null
}

/** Extends the lease while a handler runs. Returns false if the lease was lost. */
export async function heartbeatForgeJob(jobId: number, owner: string, leaseTtlMs = FORGE_JOB_LEASE_TTL_MS): Promise<boolean> {
  const result = await db.execute(sql`
    UPDATE forge_jobs SET
      heartbeat_at = now(),
      lease_expires_at = now() + ${leaseTtlMs} * interval '1 millisecond',
      updated_at = now()
    WHERE id = ${jobId} AND lease_owner = ${owner} AND status = 'running'
    RETURNING id`)
  return result.rows.length > 0
}

export async function completeForgeJob(jobId: number, owner: string, result: Record<string, unknown>): Promise<void> {
  const now = new Date()
  await db
    .update(forgeJobs)
    .set({ status: "completed", resultJson: result, error: null, failureReason: null, completedAt: now, leaseOwner: null, leaseExpiresAt: null, updatedAt: now })
    .where(and(eq(forgeJobs.id, jobId), eq(forgeJobs.leaseOwner, owner)))
}

/**
 * Fails a job: requeues with exponential backoff while attempts remain, otherwise
 * moves it to the dead-letter state (task: retry policy + dead-letter).
 */
export async function failForgeJob(job: ForgeJobRow, message: string, operatorError?: ForgeOperatorError): Promise<{ retried: boolean }> {
  const now = new Date()
  if (job.attempts >= job.maxAttempts) {
    await db
      .update(forgeJobs)
      .set({ status: "dead_letter", error: message, failureReason: message, operatorErrorJson: operatorError, completedAt: now, leaseOwner: null, leaseExpiresAt: null, updatedAt: now })
      .where(eq(forgeJobs.id, job.id))
    return { retried: false }
  }
  const backoffMs = Math.min(FORGE_JOB_MAX_BACKOFF_MS, FORGE_JOB_BASE_BACKOFF_MS * 2 ** Math.max(0, job.attempts - 1))
  await db
    .update(forgeJobs)
    .set({ status: "queued", error: message, failureReason: message, operatorErrorJson: operatorError, scheduledAt: new Date(now.getTime() + backoffMs), leaseOwner: null, leaseExpiresAt: null, heartbeatAt: null, updatedAt: now })
    .where(eq(forgeJobs.id, job.id))
  return { retried: true }
}

/** Cancels a job that has not finished. */
export async function cancelForgeJob(jobId: number): Promise<boolean> {
  const now = new Date()
  const result = await db
    .update(forgeJobs)
    .set({ status: "cancelled", completedAt: now, leaseOwner: null, leaseExpiresAt: null, updatedAt: now })
    .where(and(eq(forgeJobs.id, jobId), or(eq(forgeJobs.status, "queued"), eq(forgeJobs.status, "running"))))
    .returning({ id: forgeJobs.id })
  return result.length > 0
}

/** Requeues one terminal retryable job. The terminal-state guard prevents duplicate retries. */
export async function retryForgeJob(jobId: number): Promise<{ retried: boolean; reason: string | null }> {
  const [job] = await db.select().from(forgeJobs).where(eq(forgeJobs.id, jobId)).limit(1)
  if (!job) return { retried: false, reason: "Job not found." }
  if (!["failed", "dead_letter", "cancelled"].includes(job.status)) return { retried: false, reason: "The job is not in a retryable terminal state." }
  if (job.operatorErrorJson && !job.operatorErrorJson.retryable) return { retried: false, reason: job.operatorErrorJson.recommendedAction }
  const now = new Date()
  const result = await db.update(forgeJobs).set({
    status: "queued",
    attempts: job.attempts >= job.maxAttempts ? 0 : job.attempts,
    scheduledAt: now,
    startedAt: null,
    completedAt: null,
    leaseOwner: null,
    leaseExpiresAt: null,
    heartbeatAt: null,
    updatedAt: now,
  }).where(and(eq(forgeJobs.id, jobId), eq(forgeJobs.status, job.status))).returning({ id: forgeJobs.id })
  return result.length ? { retried: true, reason: null } : { retried: false, reason: "Another operator already changed this job." }
}

/**
 * Recovers jobs whose lease expired because the worker died: requeues those with
 * attempts remaining, dead-letters the rest. Returns how many of each.
 */
export async function reapExpiredForgeJobLeases(now = new Date()): Promise<{ requeued: number; deadLettered: number; requeuedIds: number[]; deadLetteredIds: number[] }> {
  const requeued = await db
    .update(forgeJobs)
    .set({ status: "queued", leaseOwner: null, leaseExpiresAt: null, heartbeatAt: null, scheduledAt: now, failureReason: "Recovered after worker lease expired.", updatedAt: now })
    .where(and(eq(forgeJobs.status, "running"), lt(forgeJobs.leaseExpiresAt, now), sql`${forgeJobs.attempts} < ${forgeJobs.maxAttempts}`))
    .returning({ id: forgeJobs.id })
  const deadLettered = await db
    .update(forgeJobs)
    .set({ status: "dead_letter", leaseOwner: null, leaseExpiresAt: null, completedAt: now, failureReason: "Dead-lettered after worker lease expired with no attempts left.", updatedAt: now })
    .where(and(eq(forgeJobs.status, "running"), lt(forgeJobs.leaseExpiresAt, now), sql`${forgeJobs.attempts} >= ${forgeJobs.maxAttempts}`))
    .returning({ id: forgeJobs.id })
  return { requeued: requeued.length, deadLettered: deadLettered.length, requeuedIds: requeued.map((row) => row.id), deadLetteredIds: deadLettered.map((row) => row.id) }
}

/**
 * Minimal retention: prunes succeeded/cancelled jobs past the retention window.
 * Failed and dead-lettered jobs are kept for investigation. (A fuller retention
 * policy with configurable per-state windows is a documented follow-up.)
 */
export async function cleanupTerminalForgeJobs(retentionMs = defaultJobRetentionMs()): Promise<number> {
  const cutoff = new Date(Date.now() - retentionMs)
  const deleted = await db
    .delete(forgeJobs)
    .where(and(inArray(forgeJobs.status, ["completed", "cancelled"]), lt(forgeJobs.completedAt, cutoff)))
    .returning({ id: forgeJobs.id })
  return deleted.length
}

function defaultJobRetentionMs(): number {
  const days = Number.parseInt(process.env.FORGE_JOB_RETENTION_DAYS ?? "", 10)
  return (Number.isFinite(days) && days > 0 ? days : 14) * 24 * 60 * 60 * 1000
}
