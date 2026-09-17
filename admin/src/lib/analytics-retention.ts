export const ANALYTICS_RETENTION_MIN_DAYS = 30
export const ANALYTICS_RETENTION_MAX_DAYS = 730
export const ANALYTICS_RETENTION_DEFAULT_DAYS = 395
export const ANALYTICS_RETENTION_ROW_BATCH = 500
export const ANALYTICS_RETENTION_TENANT_BATCH = 100
export const ANALYTICS_RETENTION_MAX_BATCHES_PER_TENANT = 8
export const ANALYTICS_RETENTION_INTERVAL_SECONDS = 60 * 60
export const ANALYTICS_RETENTION_RETRY_SECONDS = 5 * 60
export const ANALYTICS_RETENTION_LEASE_SECONDS = 15 * 60

export const ANALYTICS_RETENTION_ERROR_CATEGORIES = [
  "invalid_tenant",
  "tenant_context_failed",
  "prune_failed",
  "lease_unavailable",
  "unexpected",
] as const

export type AnalyticsRetentionErrorCategory = (typeof ANALYTICS_RETENTION_ERROR_CATEGORIES)[number]
export type AnalyticsRetentionStatus = "success" | "failure" | "partial" | "running" | "skipped"

/**
 * Deletion ownership for client-site analytics. Reporting owns the schedule.
 * Canonical tenant mapping (#57) is not required: pruning uses the existing
 * integer `clients.id` plus transaction-local `withClientTenant` RLS.
 */
export const ANALYTICS_RETENTION_DELETION_SEMANTICS = {
  owner: "reporting",
  clock: "postgresql_now",
  failClosed: true,
  tenantIsolation: "withClientTenant_and_forced_rls",
  metrics: {
    table: "client_analytics_daily_metrics",
    cutoffColumn: "metric_date",
    rule: "Delete rows whose metric_date is strictly earlier than now() minus the owning connection retentionDays. Boundary timestamps are kept. Orphaned rows (config_id null or invalid retention) use the default 395-day window.",
  },
  audits: {
    table: "client_analytics_audit_logs",
    cutoffColumn: "created_at",
    rule: "Delete operational analytics audit rows whose created_at is strictly earlier than now() minus the owning connection retentionDays. The same default applies to orphaned rows. Prune job state is the durable operator record and is not stored in these audits.",
  },
  credentials: {
    table: "client_analytics_configs",
    column: "credentials_encrypted",
    rule: "Null encrypted provider credentials when a connection is not ingestible (enabled=false or consent_granted=false). Config metadata is retained. Enabled and consented connections keep credentials. Offboarding already wipes credentials immediately; this job covers disabled connections that were not offboarded.",
  },
  proposals: {
    table: "client_optimisation_proposals",
    cutoffColumn: "updated_at",
    rule: "Delete derived optimisation proposals whose updated_at is strictly earlier than now() minus the longest valid retentionDays on that client's analytics connections, defaulting to 395 days when none are valid. All proposal statuses follow this window because the evidence is derived from analytics.",
  },
  configs: {
    table: "client_analytics_configs",
    rule: "Connection rows are not age-deleted. Retention policy and attribution remain as the configuration record.",
  },
  disabledClients: {
    rule: "Archived or inactive clients, and disabled analytics connections, are still pruned. Retention is a storage limit, not an ingestion feature flag.",
  },
} as const

export interface AnalyticsRetentionCounts {
  tenantsScanned: number
  tenantsFailed: number
  metricsDeleted: number
  auditsDeleted: number
  credentialsCleared: number
  proposalsDeleted: number
  batches: number
}

export interface AnalyticsRetentionPublicState extends AnalyticsRetentionCounts {
  status: AnalyticsRetentionStatus | null
  lastStartedAt: string | null
  lastFinishedAt: string | null
  lastSuccessAt: string | null
  lastFailureAt: string | null
  lastErrorCategory: AnalyticsRetentionErrorCategory | null
  cursorClientId: number
  leaseHeld: boolean
}

const EMPTY_COUNTS: AnalyticsRetentionCounts = {
  tenantsScanned: 0,
  tenantsFailed: 0,
  metricsDeleted: 0,
  auditsDeleted: 0,
  credentialsCleared: 0,
  proposalsDeleted: 0,
  batches: 0,
}

export function emptyAnalyticsRetentionCounts(): AnalyticsRetentionCounts {
  return { ...EMPTY_COUNTS }
}

export function addAnalyticsRetentionCounts(left: AnalyticsRetentionCounts, right: Partial<AnalyticsRetentionCounts>): AnalyticsRetentionCounts {
  return {
    tenantsScanned: left.tenantsScanned + (right.tenantsScanned ?? 0),
    tenantsFailed: left.tenantsFailed + (right.tenantsFailed ?? 0),
    metricsDeleted: left.metricsDeleted + (right.metricsDeleted ?? 0),
    auditsDeleted: left.auditsDeleted + (right.auditsDeleted ?? 0),
    credentialsCleared: left.credentialsCleared + (right.credentialsCleared ?? 0),
    proposalsDeleted: left.proposalsDeleted + (right.proposalsDeleted ?? 0),
    batches: left.batches + (right.batches ?? 0),
  }
}

export function resolveAnalyticsRetentionDays(value: unknown): number {
  const days = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10)
  if (!Number.isInteger(days) || days < ANALYTICS_RETENTION_MIN_DAYS || days > ANALYTICS_RETENTION_MAX_DAYS) {
    return ANALYTICS_RETENTION_DEFAULT_DAYS
  }
  return days
}

export function isAnalyticsConfigIngestible(config: { enabled: boolean; consentGranted: boolean }): boolean {
  return config.enabled === true && config.consentGranted === true
}

export function isAnalyticsTimestampExpired(value: Date, now: Date, retentionDays: number): boolean {
  const windowMs = resolveAnalyticsRetentionDays(retentionDays) * 24 * 60 * 60 * 1000
  return value.getTime() < now.getTime() - windowMs
}

export function readPositiveIntEnv(value: string | undefined, fallback: number, maximum = Number.MAX_SAFE_INTEGER): number {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback
}

export function analyticsRetentionJobOptions(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env) {
  return {
    rowBatch: readPositiveIntEnv(env.ANALYTICS_RETENTION_BATCH, ANALYTICS_RETENTION_ROW_BATCH, 5_000),
    tenantBatch: readPositiveIntEnv(env.ANALYTICS_RETENTION_TENANT_BATCH, ANALYTICS_RETENTION_TENANT_BATCH, 500),
    maxBatchesPerTenant: readPositiveIntEnv(env.ANALYTICS_RETENTION_MAX_BATCHES_PER_TENANT, ANALYTICS_RETENTION_MAX_BATCHES_PER_TENANT, 50),
    intervalSeconds: readPositiveIntEnv(env.ANALYTICS_RETENTION_INTERVAL_SECONDS, ANALYTICS_RETENTION_INTERVAL_SECONDS, 24 * 60 * 60),
    retrySeconds: ANALYTICS_RETENTION_RETRY_SECONDS,
    leaseSeconds: ANALYTICS_RETENTION_LEASE_SECONDS,
  }
}

const PUBLIC_ERROR_CATEGORIES = new Set<string>(ANALYTICS_RETENTION_ERROR_CATEGORIES)

export function toPublicAnalyticsRetentionState(input: {
  lastStatus?: string | null
  lastStartedAt?: Date | string | null
  lastFinishedAt?: Date | string | null
  lastSuccessAt?: Date | string | null
  lastFailureAt?: Date | string | null
  lastErrorCategory?: string | null
  cursorClientId?: number | null
  leaseOwner?: string | null
  leaseExpiresAt?: Date | string | null
  lastTenantsScanned?: number | null
  lastTenantsFailed?: number | null
  lastMetricsDeleted?: number | null
  lastAuditsDeleted?: number | null
  lastCredentialsCleared?: number | null
  lastProposalsDeleted?: number | null
  lastBatches?: number | null
}): AnalyticsRetentionPublicState {
  const status = input.lastStatus === "success" || input.lastStatus === "failure" || input.lastStatus === "partial" || input.lastStatus === "running" || input.lastStatus === "skipped"
    ? input.lastStatus
    : null
  const errorCategory = input.lastErrorCategory && PUBLIC_ERROR_CATEGORIES.has(input.lastErrorCategory)
    ? input.lastErrorCategory as AnalyticsRetentionErrorCategory
    : null
  return {
    status,
    lastStartedAt: toIso(input.lastStartedAt),
    lastFinishedAt: toIso(input.lastFinishedAt),
    lastSuccessAt: toIso(input.lastSuccessAt),
    lastFailureAt: toIso(input.lastFailureAt),
    lastErrorCategory: errorCategory,
    cursorClientId: Number.isInteger(input.cursorClientId) ? Number(input.cursorClientId) : 0,
    leaseHeld: Boolean(input.leaseOwner) && isFuture(input.leaseExpiresAt),
    tenantsScanned: nonNegative(input.lastTenantsScanned),
    tenantsFailed: nonNegative(input.lastTenantsFailed),
    metricsDeleted: nonNegative(input.lastMetricsDeleted),
    auditsDeleted: nonNegative(input.lastAuditsDeleted),
    credentialsCleared: nonNegative(input.lastCredentialsCleared),
    proposalsDeleted: nonNegative(input.lastProposalsDeleted),
    batches: nonNegative(input.lastBatches),
  }
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function isFuture(value: Date | string | null | undefined) {
  if (!value) return false
  const date = value instanceof Date ? value : new Date(value)
  return !Number.isNaN(date.getTime()) && date.getTime() > Date.now()
}

function nonNegative(value: number | null | undefined) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0
}
