import { describe, expect, it } from "vitest"
import {
  confirmationPhraseFor,
  deriveForgeOpsSnapshot,
  evaluateForgeOpsAlerts,
  forgeOpsAlertKey,
  forgeOpsAlertsToMonitoringEvents,
  FORGE_OPS_THRESHOLD_DEFAULTS,
  ownerIdentitiesMatch,
  parseForgeOwnerIdentity,
  resolveForgeOpsThresholds,
  sanitizeForgeOpsText,
  validateForgeOpsRecoveryConfirmation,
  type ForgeOpsHeartbeatInput,
  type ForgeOpsJobInput,
  type ForgeOpsPreviewInput,
} from "./forge-ops-health"

const now = new Date("2026-09-17T12:00:00.000Z")

function job(overrides: Partial<ForgeOpsJobInput> = {}): ForgeOpsJobInput {
  return {
    id: 11,
    projectId: 7,
    projectName: "Acme",
    kind: "copy",
    status: "queued",
    attempts: 1,
    maxAttempts: 3,
    scheduledAt: "2026-09-17T11:59:00.000Z",
    ...overrides,
  }
}

function heartbeat(overrides: Partial<ForgeOpsHeartbeatInput> = {}): ForgeOpsHeartbeatInput {
  return {
    workerId: "worker:forge-a:11:aaa11111",
    processId: 11,
    hostname: "forge-a",
    lastHeartbeatAt: "2026-09-17T11:59:50.000Z",
    activeJobCount: 1,
    ...overrides,
  }
}

function preview(overrides: Partial<ForgeOpsPreviewInput> = {}): ForgeOpsPreviewInput {
  return {
    projectId: 7,
    projectName: "Acme",
    status: "running",
    owner: "forge-a:11:aaa11111",
    leaseExpiresAt: "2026-09-17T12:10:00.000Z",
    heartbeatAt: "2026-09-17T11:59:50.000Z",
    method: "docker-next-dev",
    ...overrides,
  }
}

describe("Forge ops owner identity", () => {
  it("matches job lease owners and preview owners on the same hostname and pid", () => {
    expect(parseForgeOwnerIdentity("worker:forge-a:11:aaa11111")).toEqual({ hostname: "forge-a", pid: 11 })
    expect(parseForgeOwnerIdentity("forge-a:11:deadbeef")).toEqual({ hostname: "forge-a", pid: 11 })
    expect(ownerIdentitiesMatch("worker:forge-a:11:aaa11111", "forge-a:11:deadbeef")).toBe(true)
    expect(ownerIdentitiesMatch("worker:forge-a:11:aaa11111", "forge-b:11:deadbeef")).toBe(false)
  })
})

describe("Forge ops read model", () => {
  it("attributes concurrent leases to distinct workers without mixing queue state", () => {
    const snapshot = deriveForgeOpsSnapshot({
      now,
      currentInstanceId: "forge-a:11:aaa11111",
      workerEnabled: true,
      heartbeats: [
        heartbeat(),
        heartbeat({ workerId: "worker:forge-b:22:bbb22222", processId: 22, hostname: "forge-b", activeJobCount: 1 }),
      ],
      jobs: [
        job({ id: 1, status: "running", leaseOwner: "worker:forge-a:11:aaa11111", leaseExpiresAt: "2026-09-17T12:01:00.000Z", heartbeatAt: "2026-09-17T11:59:50.000Z", startedAt: "2026-09-17T11:59:40.000Z" }),
        job({ id: 2, status: "running", kind: "design", leaseOwner: "worker:forge-b:22:bbb22222", leaseExpiresAt: "2026-09-17T12:01:30.000Z", heartbeatAt: "2026-09-17T11:59:55.000Z", startedAt: "2026-09-17T11:59:45.000Z" }),
        job({ id: 3, status: "queued", scheduledAt: "2026-09-17T11:50:00.000Z" }),
      ],
      previews: [],
    })
    expect(snapshot.workers).toHaveLength(2)
    expect(snapshot.queue.depth).toBe(1)
    expect(snapshot.queue.oldestQueuedJobId).toBe(3)
    expect(snapshot.leases.active).toBe(2)
    expect(snapshot.leases.expired).toBe(0)
    expect(snapshot.leases.byWorker).toEqual(expect.arrayContaining([
      { workerId: "worker:forge-a:11:aaa11111", active: 1, expired: 0 },
      { workerId: "worker:forge-b:22:bbb22222", active: 1, expired: 0 },
    ]))
    expect(snapshot.leases.items.map((item) => item.jobId).sort()).toEqual([1, 2])
    expect(JSON.stringify(snapshot)).not.toContain("payloadJson")
  })

  it("separates expired leases from active leases", () => {
    const snapshot = deriveForgeOpsSnapshot({
      now,
      currentInstanceId: "forge-a:11:aaa11111",
      workerEnabled: true,
      heartbeats: [heartbeat({ lastHeartbeatAt: "2026-09-17T11:50:00.000Z" })],
      jobs: [
        job({ id: 4, status: "running", leaseOwner: "worker:forge-a:11:aaa11111", leaseExpiresAt: "2026-09-17T11:58:00.000Z", heartbeatAt: "2026-09-17T11:57:00.000Z" }),
        job({ id: 5, status: "running", leaseOwner: "worker:forge-a:11:aaa11111", leaseExpiresAt: "2026-09-17T12:02:00.000Z", heartbeatAt: "2026-09-17T11:59:50.000Z" }),
      ],
      previews: [],
    })
    expect(snapshot.leases.active).toBe(1)
    expect(snapshot.leases.expired).toBe(1)
    expect(snapshot.leases.items.find((item) => item.jobId === 4)?.expired).toBe(true)
    expect(snapshot.leases.items.find((item) => item.jobId === 5)?.expired).toBe(false)
    expect(snapshot.alerts.map((item) => item.code)).toContain("forge_ops_expired_leases")
  })

  it("marks previews with unreachable owners as inaccessible until the lease expires", () => {
    const snapshot = deriveForgeOpsSnapshot({
      now,
      currentInstanceId: "forge-a:11:aaa11111",
      workerEnabled: true,
      heartbeats: [heartbeat()],
      jobs: [],
      previews: [
        preview({ projectId: 8, projectName: "Beta", owner: "forge-dead:99:cccc3333", leaseExpiresAt: "2026-09-17T12:08:00.000Z" }),
        preview({ projectId: 9, projectName: "Gamma", owner: "forge-dead:99:cccc3333", leaseExpiresAt: "2026-09-17T11:50:00.000Z" }),
        preview({ owner: "forge-a:11:aaa11111" }),
      ],
    })
    expect(snapshot.previews.items.find((item) => item.projectId === 8)?.ownership).toBe("inaccessible")
    expect(snapshot.previews.items.find((item) => item.projectId === 9)?.ownership).toBe("abandoned")
    expect(snapshot.previews.items.find((item) => item.projectId === 7)?.ownership).toBe("local")
    expect(snapshot.previews.inaccessible).toBe(1)
    expect(snapshot.previews.abandoned).toBe(1)
    expect(snapshot.alerts.map((item) => item.code)).toEqual(expect.arrayContaining([
      "forge_ops_inaccessible_previews",
      "forge_ops_abandoned_previews",
    ]))
  })

  it("treats a remote preview as healthy when its owning worker is still alive", () => {
    const snapshot = deriveForgeOpsSnapshot({
      now,
      currentInstanceId: "forge-a:11:aaa11111",
      workerEnabled: true,
      heartbeats: [
        heartbeat(),
        heartbeat({ workerId: "worker:forge-b:22:bbb22222", processId: 22, hostname: "forge-b" }),
      ],
      jobs: [],
      previews: [preview({ owner: "forge-b:22:ffff4444" })],
    })
    expect(snapshot.previews.items[0]?.ownership).toBe("remote_healthy")
    expect(snapshot.previews.inaccessible).toBe(0)
  })

  it("counts retry storms and dead letters without exposing payloads or secrets", () => {
    const snapshot = deriveForgeOpsSnapshot({
      now,
      currentInstanceId: "forge-a:11:aaa11111",
      workerEnabled: true,
      heartbeats: [heartbeat()],
      jobs: [
        job({ id: 21, status: "queued", attempts: 2, scheduledAt: "2026-09-17T11:40:00.000Z" }),
        job({ id: 22, status: "running", attempts: 3, leaseOwner: "worker:forge-a:11:aaa11111", leaseExpiresAt: "2026-09-17T12:01:00.000Z" }),
        job({
          id: 23,
          status: "dead_letter",
          attempts: 3,
          failureReason: "Build failed in /var/www/scalesmiths/ScaleSmiths/private/site with token sk-proj-thisMustNeverAppear",
          payloadJson: { prompt: "Write a landing page", apiKey: "secret-value" },
          resultJson: { generatedSource: "confidential html" },
        }),
      ],
      previews: [preview({ error: "Preview failed for prompt: generate hero copy with Bearer abcdefghijklmnop" })],
    })
    expect(snapshot.retries.stormCount).toBe(2)
    expect(snapshot.deadLetters.count).toBe(1)
    const serialised = JSON.stringify(snapshot)
    expect(serialised).not.toContain("sk-proj-thisMustNeverAppear")
    expect(serialised).not.toContain("secret-value")
    expect(serialised).not.toContain("confidential html")
    expect(serialised).not.toContain("Write a landing page")
    expect(serialised).not.toContain("/var/www/scalesmiths")
    expect(serialised).not.toContain("abcdefghijklmnop")
    expect(snapshot.deadLetters.items[0]?.failureSummary).toBeTruthy()
    expect(snapshot.previews.items[0]?.error).not.toContain("generate hero copy")
  })
})

describe("Forge ops thresholds and monitoring mapping", () => {
  it("reads threshold overrides from env without requiring a Sentry DSN", () => {
    expect(resolveForgeOpsThresholds({
      FORGE_OPS_QUEUE_DEPTH_WARNING: "4",
      FORGE_OPS_QUEUE_DEPTH_CRITICAL: "9",
      ERROR_MONITORING_PROVIDER: "none",
    })).toMatchObject({ queueDepthWarning: 4, queueDepthCritical: 9 })
  })

  it("emits monitoring-compatible alert events from evaluated thresholds", () => {
    const snapshot = deriveForgeOpsSnapshot({
      now,
      currentInstanceId: "forge-a:11:aaa11111",
      workerEnabled: true,
      thresholds: { ...FORGE_OPS_THRESHOLD_DEFAULTS, queueDepthWarning: 1, deadLetterCountWarning: 1 },
      heartbeats: [],
      jobs: [
        job({ scheduledAt: "2026-09-17T11:00:00.000Z" }),
        job({ id: 24, status: "dead_letter" }),
      ],
      previews: [],
    })
    const alerts = evaluateForgeOpsAlerts(snapshot)
    expect(alerts.map((item) => item.code)).toEqual(expect.arrayContaining(["forge_ops_queue_depth", "forge_ops_dead_letters", "forge_ops_oldest_queued_age"]))
    expect(forgeOpsAlertKey(alerts)).toContain("forge_ops_dead_letters:critical")
    expect(forgeOpsAlertsToMonitoringEvents(alerts)[0]).toEqual(expect.objectContaining({
      context: expect.objectContaining({ errorCategory: expect.stringMatching(/^forge_ops_/) }),
    }))
  })
})

describe("Forge ops recovery confirmation", () => {
  it("requires exact documented phrases and a job id for dead-letter retry", () => {
    expect(validateForgeOpsRecoveryConfirmation({ action: "retry_dead_letter", confirmation: "yes", jobId: 23 })).toMatchObject({ ok: false })
    expect(validateForgeOpsRecoveryConfirmation({ action: "retry_dead_letter", confirmation: confirmationPhraseFor("retry_dead_letter", { jobId: 23 }), jobId: 23 })).toEqual({ ok: true, action: "retry_dead_letter", jobId: 23 })
    expect(validateForgeOpsRecoveryConfirmation({ action: "reap_expired_leases", confirmation: "REAP EXPIRED LEASES" })).toEqual({ ok: true, action: "reap_expired_leases", jobId: null })
    expect(validateForgeOpsRecoveryConfirmation({ action: "reconcile_abandoned_previews", confirmation: "RECONCILE PREVIEWS" })).toEqual({ ok: true, action: "reconcile_abandoned_previews", jobId: null })
    expect(validateForgeOpsRecoveryConfirmation({ action: "delete_workspace", confirmation: "DELETE" })).toMatchObject({ ok: false })
  })

  it("redacts secret-shaped operator text", () => {
    expect(sanitizeForgeOpsText("token sk-proj-thisMustNeverAppear leaked")).not.toContain("thisMustNeverAppear")
  })
})
