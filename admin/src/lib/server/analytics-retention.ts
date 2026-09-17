import "server-only"
import { gt, sql } from "drizzle-orm"
import {
  addAnalyticsRetentionCounts,
  analyticsRetentionJobOptions,
  emptyAnalyticsRetentionCounts,
  toPublicAnalyticsRetentionState,
  type AnalyticsRetentionCounts,
  type AnalyticsRetentionErrorCategory,
  type AnalyticsRetentionPublicState,
  type AnalyticsRetentionStatus,
} from "@/lib/analytics-retention"
import { db, withClientTenant, type AdminDatabaseTransaction } from "@/lib/db"
import { analyticsRetentionJobState, clients } from "@/lib/schema"
import { captureMonitoringException } from "./monitoring"
import { requestLogger } from "./request-context"

type RetentionTx = Pick<AdminDatabaseTransaction, "execute">

export interface AnalyticsRetentionJobResult {
  status: AnalyticsRetentionStatus
  skipped: boolean
  publicState: AnalyticsRetentionPublicState
  counts: AnalyticsRetentionCounts
}

export async function loadAnalyticsRetentionPublicState(): Promise<AnalyticsRetentionPublicState> {
  const [row] = await db.select().from(analyticsRetentionJobState).where(sql`${analyticsRetentionJobState.id} = 1`).limit(1)
  return toPublicAnalyticsRetentionState(row ?? {})
}

export async function runAnalyticsRetentionJob(input: {
  owner: string
  force?: boolean
  env?: NodeJS.ProcessEnv
} = { owner: "analytics-retention" }): Promise<AnalyticsRetentionJobResult> {
  const options = analyticsRetentionJobOptions(input.env)
  await db.execute(sql`INSERT INTO analytics_retention_job_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING`)
  const claimed = await claimAnalyticsRetentionLease({
    owner: input.owner,
    force: input.force === true,
    intervalSeconds: options.intervalSeconds,
    retrySeconds: options.retrySeconds,
    leaseSeconds: options.leaseSeconds,
  })
  if (!claimed) {
    const publicState = await loadAnalyticsRetentionPublicState()
    return {
      status: "skipped",
      skipped: true,
      publicState,
      counts: emptyAnalyticsRetentionCounts(),
    }
  }

  const log = requestLogger({ component: "analytics-retention" })
  let counts = emptyAnalyticsRetentionCounts()
  let cursor = claimed.cursorClientId
  let errorCategory: AnalyticsRetentionErrorCategory | null = null

  try {
    const tenantIds = await listAnalyticsRetentionTenantIds(cursor, options.tenantBatch)
    for (const clientId of tenantIds) {
      counts = addAnalyticsRetentionCounts(counts, { tenantsScanned: 1 })
      try {
        const pruned = await pruneClientAnalyticsRetention(clientId, {
          rowBatch: options.rowBatch,
          maxBatchesPerTenant: options.maxBatchesPerTenant,
        })
        counts = addAnalyticsRetentionCounts(counts, pruned)
        cursor = clientId
      } catch (error) {
        counts = addAnalyticsRetentionCounts(counts, { tenantsFailed: 1 })
        errorCategory = retentionErrorCategory(error)
        log.error("Analytics retention prune failed for a tenant", {
          errorCategory,
          tenantFailed: true,
        })
        captureMonitoringException(error, { component: "analytics-retention", errorCategory })
        break
      }
    }
    if (tenantIds.length < options.tenantBatch) cursor = 0
    const status: AnalyticsRetentionStatus = counts.tenantsFailed > 0 ? (counts.tenantsScanned > counts.tenantsFailed ? "partial" : "failure") : "success"
    const publicState = await finishAnalyticsRetentionLease({
      owner: input.owner,
      cursor,
      status,
      errorCategory,
      counts,
    })
    log.info("Analytics retention job finished", { status, ...counts, cursorClientId: cursor })
    return { status, skipped: false, publicState, counts }
  } catch (error) {
    errorCategory = retentionErrorCategory(error)
    const publicState = await finishAnalyticsRetentionLease({
      owner: input.owner,
      cursor,
      status: "failure",
      errorCategory,
      counts,
    })
    log.error("Analytics retention job failed", { errorCategory })
    captureMonitoringException(error, { component: "analytics-retention", errorCategory })
    return { status: "failure", skipped: false, publicState, counts }
  }
}

export async function pruneClientAnalyticsRetention(clientId: number, input: {
  rowBatch?: number
  maxBatchesPerTenant?: number
} = {}): Promise<AnalyticsRetentionCounts> {
  const rowBatch = input.rowBatch ?? analyticsRetentionJobOptions().rowBatch
  const maxBatchesPerTenant = input.maxBatchesPerTenant ?? analyticsRetentionJobOptions().maxBatchesPerTenant
  return withClientTenant(clientId, async (tx) => {
    const counts = emptyAnalyticsRetentionCounts()
    for (let batch = 0; batch < maxBatchesPerTenant; batch += 1) {
      const metricsDeleted = await deleteExpiredAnalyticsRows(tx, expiredMetricsSql(clientId, rowBatch))
      const auditsDeleted = await deleteExpiredAnalyticsRows(tx, expiredAuditsSql(clientId, rowBatch))
      const credentialsCleared = await clearIngestibleAnalyticsCredentials(tx, clientId)
      const proposalsDeleted = await deleteExpiredAnalyticsRows(tx, expiredProposalsSql(clientId, rowBatch))
      counts.metricsDeleted += metricsDeleted
      counts.auditsDeleted += auditsDeleted
      counts.credentialsCleared += credentialsCleared
      counts.proposalsDeleted += proposalsDeleted
      counts.batches += 1
      if (metricsDeleted < rowBatch && auditsDeleted < rowBatch && proposalsDeleted < rowBatch) break
    }
    return counts
  })
}

async function listAnalyticsRetentionTenantIds(cursor: number, limit: number) {
  const rows = await db.select({ id: clients.id }).from(clients).where(gt(clients.id, cursor)).orderBy(clients.id).limit(limit)
  return rows.map((row) => row.id)
}

async function claimAnalyticsRetentionLease(input: {
  owner: string
  force: boolean
  intervalSeconds: number
  retrySeconds: number
  leaseSeconds: number
}) {
  const result = await db.execute(sql`
    UPDATE analytics_retention_job_state SET
      lease_owner = ${input.owner},
      lease_expires_at = now() + ${input.leaseSeconds} * interval '1 second',
      last_started_at = now(),
      last_status = 'running',
      updated_at = now()
    WHERE id = 1
      AND (lease_expires_at IS NULL OR lease_expires_at < now())
      AND (
        ${input.force}
        OR last_success_at IS NULL
        OR (last_status IN ('failure', 'partial') AND (last_finished_at IS NULL OR last_finished_at < now() - ${input.retrySeconds} * interval '1 second'))
        OR last_success_at < now() - ${input.intervalSeconds} * interval '1 second'
      )
    RETURNING cursor_client_id`)
  const row = result.rows[0] as { cursor_client_id?: number } | undefined
  return row ? { cursorClientId: Number(row.cursor_client_id ?? 0) } : null
}

async function finishAnalyticsRetentionLease(input: {
  owner: string
  cursor: number
  status: AnalyticsRetentionStatus
  errorCategory: AnalyticsRetentionErrorCategory | null
  counts: AnalyticsRetentionCounts
}): Promise<AnalyticsRetentionPublicState> {
  const result = await db.execute(sql`
    UPDATE analytics_retention_job_state SET
      lease_owner = NULL,
      lease_expires_at = NULL,
      cursor_client_id = ${input.cursor},
      last_finished_at = now(),
      last_success_at = CASE WHEN ${input.status} IN ('success', 'partial') THEN now() ELSE last_success_at END,
      last_failure_at = CASE WHEN ${input.status} IN ('failure', 'partial') THEN now() ELSE last_failure_at END,
      last_status = ${input.status},
      last_error_category = ${input.errorCategory},
      last_tenants_scanned = ${input.counts.tenantsScanned},
      last_tenants_failed = ${input.counts.tenantsFailed},
      last_metrics_deleted = ${input.counts.metricsDeleted},
      last_audits_deleted = ${input.counts.auditsDeleted},
      last_credentials_cleared = ${input.counts.credentialsCleared},
      last_proposals_deleted = ${input.counts.proposalsDeleted},
      last_batches = ${input.counts.batches},
      updated_at = now()
    WHERE id = 1 AND lease_owner = ${input.owner}
    RETURNING *`)
  return toPublicAnalyticsRetentionState(mapJobStateRow(result.rows[0] as Record<string, unknown> | undefined))
}

async function deleteExpiredAnalyticsRows(tx: RetentionTx, query: ReturnType<typeof sql>) {
  const result = await tx.execute(query)
  return result.rows.length
}

async function clearIngestibleAnalyticsCredentials(tx: RetentionTx, clientId: number) {
  const result = await tx.execute(sql`
    UPDATE client_analytics_configs
    SET credentials_encrypted = NULL
    WHERE client_id = ${clientId}
      AND credentials_encrypted IS NOT NULL
      AND (enabled = false OR consent_granted = false)
    RETURNING id`)
  return result.rows.length
}

function expiredMetricsSql(clientId: number, rowBatch: number) {
  return sql`
    WITH expired AS (
      SELECT m.id
      FROM client_analytics_daily_metrics m
      LEFT JOIN client_analytics_configs c ON c.id = m.config_id AND c.client_id = m.client_id
      WHERE m.client_id = ${clientId}
        AND m.metric_date < (now() - make_interval(days => (
          CASE WHEN c.retention_days BETWEEN 30 AND 730 THEN c.retention_days ELSE 395 END
        )))
      ORDER BY m.id
      LIMIT ${rowBatch}
      FOR UPDATE OF m SKIP LOCKED
    )
    DELETE FROM client_analytics_daily_metrics d
    USING expired
    WHERE d.id = expired.id AND d.client_id = ${clientId}
    RETURNING d.id`
}

function expiredAuditsSql(clientId: number, rowBatch: number) {
  return sql`
    WITH expired AS (
      SELECT a.id
      FROM client_analytics_audit_logs a
      LEFT JOIN client_analytics_configs c ON c.id = a.config_id AND c.client_id = a.client_id
      WHERE a.client_id = ${clientId}
        AND a.created_at < (now() - make_interval(days => (
          CASE WHEN c.retention_days BETWEEN 30 AND 730 THEN c.retention_days ELSE 395 END
        )))
      ORDER BY a.id
      LIMIT ${rowBatch}
      FOR UPDATE OF a SKIP LOCKED
    )
    DELETE FROM client_analytics_audit_logs d
    USING expired
    WHERE d.id = expired.id AND d.client_id = ${clientId}
    RETURNING d.id`
}

function expiredProposalsSql(clientId: number, rowBatch: number) {
  return sql`
    WITH policy AS (
      SELECT COALESCE(
        MAX(CASE WHEN retention_days BETWEEN 30 AND 730 THEN retention_days END),
        395
      ) AS retention_days
      FROM client_analytics_configs
      WHERE client_id = ${clientId}
    ),
    expired AS (
      SELECT p.id
      FROM client_optimisation_proposals p, policy
      WHERE p.client_id = ${clientId}
        AND p.updated_at < (now() - make_interval(days => policy.retention_days))
      ORDER BY p.id
      LIMIT ${rowBatch}
      FOR UPDATE OF p SKIP LOCKED
    )
    DELETE FROM client_optimisation_proposals d
    USING expired
    WHERE d.id = expired.id AND d.client_id = ${clientId}
    RETURNING d.id`
}

function retentionErrorCategory(error: unknown): AnalyticsRetentionErrorCategory {
  const message = error instanceof Error ? error.message : String(error)
  if (/positive client tenant id/i.test(message)) return "invalid_tenant"
  if (/current_client_id|row-level security|42501/i.test(message)) return "tenant_context_failed"
  if (/lease/i.test(message)) return "lease_unavailable"
  return "prune_failed"
}

function mapJobStateRow(row: Record<string, unknown> | undefined) {
  if (!row) return {}
  return {
    lastStatus: row.last_status as string | null,
    lastStartedAt: row.last_started_at as Date | string | null,
    lastFinishedAt: row.last_finished_at as Date | string | null,
    lastSuccessAt: row.last_success_at as Date | string | null,
    lastFailureAt: row.last_failure_at as Date | string | null,
    lastErrorCategory: row.last_error_category as string | null,
    cursorClientId: Number(row.cursor_client_id ?? 0),
    leaseOwner: row.lease_owner as string | null,
    leaseExpiresAt: row.lease_expires_at as Date | string | null,
    lastTenantsScanned: Number(row.last_tenants_scanned ?? 0),
    lastTenantsFailed: Number(row.last_tenants_failed ?? 0),
    lastMetricsDeleted: Number(row.last_metrics_deleted ?? 0),
    lastAuditsDeleted: Number(row.last_audits_deleted ?? 0),
    lastCredentialsCleared: Number(row.last_credentials_cleared ?? 0),
    lastProposalsDeleted: Number(row.last_proposals_deleted ?? 0),
    lastBatches: Number(row.last_batches ?? 0),
  }
}
