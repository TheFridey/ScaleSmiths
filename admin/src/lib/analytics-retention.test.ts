import { describe, expect, it } from "vitest"
import {
  ANALYTICS_RETENTION_DEFAULT_DAYS,
  ANALYTICS_RETENTION_DELETION_SEMANTICS,
  ANALYTICS_RETENTION_MAX_DAYS,
  ANALYTICS_RETENTION_MIN_DAYS,
  addAnalyticsRetentionCounts,
  analyticsRetentionJobOptions,
  emptyAnalyticsRetentionCounts,
  isAnalyticsConfigIngestible,
  isAnalyticsTimestampExpired,
  resolveAnalyticsRetentionDays,
  toPublicAnalyticsRetentionState,
} from "./analytics-retention"

describe("analytics retention deletion semantics", () => {
  it("defines tenant-isolated deletion ownership for metrics, audits, credentials and proposals", () => {
    expect(ANALYTICS_RETENTION_DELETION_SEMANTICS.owner).toBe("reporting")
    expect(ANALYTICS_RETENTION_DELETION_SEMANTICS.clock).toBe("postgresql_now")
    expect(ANALYTICS_RETENTION_DELETION_SEMANTICS.failClosed).toBe(true)
    expect(ANALYTICS_RETENTION_DELETION_SEMANTICS.metrics.table).toBe("client_analytics_daily_metrics")
    expect(ANALYTICS_RETENTION_DELETION_SEMANTICS.audits.table).toBe("client_analytics_audit_logs")
    expect(ANALYTICS_RETENTION_DELETION_SEMANTICS.credentials.column).toBe("credentials_encrypted")
    expect(ANALYTICS_RETENTION_DELETION_SEMANTICS.proposals.table).toBe("client_optimisation_proposals")
    expect(ANALYTICS_RETENTION_DELETION_SEMANTICS.disabledClients.rule).toMatch(/still pruned/i)
  })

  it("uses the default window when retention is missing or outside 30-730", () => {
    expect(resolveAnalyticsRetentionDays(30)).toBe(ANALYTICS_RETENTION_MIN_DAYS)
    expect(resolveAnalyticsRetentionDays(730)).toBe(ANALYTICS_RETENTION_MAX_DAYS)
    expect(resolveAnalyticsRetentionDays(395)).toBe(ANALYTICS_RETENTION_DEFAULT_DAYS)
    expect(resolveAnalyticsRetentionDays(29)).toBe(ANALYTICS_RETENTION_DEFAULT_DAYS)
    expect(resolveAnalyticsRetentionDays(731)).toBe(ANALYTICS_RETENTION_DEFAULT_DAYS)
    expect(resolveAnalyticsRetentionDays(0)).toBe(ANALYTICS_RETENTION_DEFAULT_DAYS)
    expect(resolveAnalyticsRetentionDays("nope")).toBe(ANALYTICS_RETENTION_DEFAULT_DAYS)
    expect(resolveAnalyticsRetentionDays(null)).toBe(ANALYTICS_RETENTION_DEFAULT_DAYS)
  })

  it("keeps the boundary timestamp and deletes only strictly older values", () => {
    const now = new Date("2026-09-17T12:00:00.000Z")
    const retentionDays = 30
    const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000)
    expect(isAnalyticsTimestampExpired(cutoff, now, retentionDays)).toBe(false)
    expect(isAnalyticsTimestampExpired(new Date(cutoff.getTime() - 1), now, retentionDays)).toBe(true)
    expect(isAnalyticsTimestampExpired(new Date(cutoff.getTime() + 1), now, retentionDays)).toBe(false)
  })

  it("clears credentials only for connections that are no longer ingestible", () => {
    expect(isAnalyticsConfigIngestible({ enabled: true, consentGranted: true })).toBe(true)
    expect(isAnalyticsConfigIngestible({ enabled: false, consentGranted: true })).toBe(false)
    expect(isAnalyticsConfigIngestible({ enabled: true, consentGranted: false })).toBe(false)
  })

  it("exposes last success/failure counts without personal data", () => {
    const publicState = toPublicAnalyticsRetentionState({
      lastStatus: "failure",
      lastStartedAt: "2026-09-17T11:00:00.000Z",
      lastFinishedAt: "2026-09-17T11:01:00.000Z",
      lastFailureAt: "2026-09-17T11:01:00.000Z",
      lastErrorCategory: "prune_failed",
      lastTenantsScanned: 2,
      lastTenantsFailed: 1,
      lastMetricsDeleted: 4,
      leaseOwner: "analytics-retention:worker",
      leaseExpiresAt: new Date(Date.now() + 60_000),
      cursorClientId: 9,
    })
    const serialized = JSON.stringify(publicState)
    expect(publicState.status).toBe("failure")
    expect(publicState.lastErrorCategory).toBe("prune_failed")
    expect(publicState.metricsDeleted).toBe(4)
    expect(publicState.leaseHeld).toBe(true)
    expect(serialized).not.toContain("@")
    expect(serialized).not.toMatch(/secret-|propertyId|userEmail|token=/i)
    expect(toPublicAnalyticsRetentionState({ lastErrorCategory: "drop table clients; --" }).lastErrorCategory).toBeNull()
  })

  it("adds tenant prune counts without inventing deleted rows", () => {
    expect(addAnalyticsRetentionCounts(emptyAnalyticsRetentionCounts(), { metricsDeleted: 3, tenantsScanned: 1 })).toEqual({
      tenantsScanned: 1,
      tenantsFailed: 0,
      metricsDeleted: 3,
      auditsDeleted: 0,
      credentialsCleared: 0,
      proposalsDeleted: 0,
      batches: 0,
    })
  })

  it("reads bounded batch tunables from the environment", () => {
    expect(analyticsRetentionJobOptions({}).rowBatch).toBe(500)
    expect(analyticsRetentionJobOptions({ ANALYTICS_RETENTION_BATCH: "25" }).rowBatch).toBe(25)
    expect(analyticsRetentionJobOptions({ ANALYTICS_RETENTION_BATCH: "0" }).rowBatch).toBe(500)
  })
})
