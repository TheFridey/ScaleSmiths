import { describe, expect, it } from "vitest"
import { normalizeForgeOperatorError } from "./forge-operator-error"
import {
  buildForgeAttentionDeepLink,
  canRetryForgeJob,
  deriveForgeAttentionItems,
  deriveForgeOperationalHealth,
  groupForgeAttentionItems,
  type ForgeHealthJob,
} from "./forge-operational-health"

const now = new Date("2026-07-30T12:00:00.000Z")

function job(overrides: Partial<ForgeHealthJob> = {}): ForgeHealthJob {
  return {
    id: 11,
    projectId: 7,
    runId: 3,
    stage: "copy",
    kind: "copy",
    status: "queued",
    attempts: 1,
    maxAttempts: 3,
    scheduledAt: "2026-07-30T11:59:00.000Z",
    ...overrides,
  }
}

describe("Forge operational health", () => {
  it("expires worker heartbeats into degraded and offline states", () => {
    const base = { workerId: "worker-1", processId: 42, hostname: "forge", activeJobCount: 0, metadataJson: {} }
    expect(deriveForgeOperationalHealth({ heartbeats: [{ ...base, lastHeartbeatAt: "2026-07-30T11:59:45.000Z" }], jobs: [], workerEnabled: true, now }).state).toBe("alive")
    expect(deriveForgeOperationalHealth({ heartbeats: [{ ...base, lastHeartbeatAt: "2026-07-30T11:59:20.000Z" }], jobs: [], workerEnabled: true, now }).state).toBe("degraded")
    expect(deriveForgeOperationalHealth({ heartbeats: [{ ...base, lastHeartbeatAt: "2026-07-30T11:58:00.000Z" }], jobs: [], workerEnabled: true, now }).state).toBe("offline")
  })

  it("detects stale queues, running jobs without heartbeat and dead letters", () => {
    const health = deriveForgeOperationalHealth({
      heartbeats: [],
      jobs: [
        job({ scheduledAt: "2026-07-30T11:40:00.000Z" }),
        job({ id: 12, status: "running", heartbeatAt: null }),
        job({ id: 13, status: "dead_letter" }),
      ],
      workerEnabled: true,
      now,
    })
    expect(health.signals.map((signal) => signal.code)).toEqual(expect.arrayContaining([
      "no_heartbeat", "queue_stalled", "running_without_heartbeat", "dead_letter",
    ]))
  })

  it("correlates a provider outage to affected project work and fallback action", () => {
    const items = deriveForgeAttentionItems({
      projects: [{ id: 7, name: "Acme", businessName: "Acme Ltd" }],
      jobs: [job({ status: "running" })],
      providerOutages: [{ provider: "anthropic", projectIds: [7], occurredAt: now, fallbackAvailable: true }],
      now,
    })
    expect(items[0]).toMatchObject({ projectId: 7, category: "provider_unavailable" })
    expect(items[0].explanation).toContain("fallback")
    expect(items[0].availableActions).toContain("retry_fallback")
  })

  it("distinguishes retryable and non-retryable errors", () => {
    expect(canRetryForgeJob(job({
      status: "dead_letter",
      operatorError: normalizeForgeOperatorError("Provider unavailable", { retryable: true }),
    })).allowed).toBe(true)
    expect(canRetryForgeJob(job({
      status: "dead_letter",
      operatorError: normalizeForgeOperatorError("Approval required", { category: "approval_required", retryable: false }),
    }))).toMatchObject({ allowed: false, reason: expect.stringContaining("not retryable") })
  })

  it("prioritises critical failures before older lower-severity items", () => {
    const errors = [
      { projectId: 7, error: normalizeForgeOperatorError("Queued too long", { category: "queue_stalled", timestamp: new Date("2026-07-30T10:00:00Z") }) },
      { projectId: 7, error: normalizeForgeOperatorError("Budget exhausted", { category: "budget_exceeded", retryable: false, timestamp: new Date("2026-07-30T11:55:00Z") }) },
    ]
    const items = deriveForgeAttentionItems({ projects: [{ id: 7, name: "Acme", businessName: "Acme Ltd" }], jobs: [], errors, now })
    expect(items.map((item) => item.category)).toEqual(["budget_exceeded", "queue_stalled"])
  })

  it("generates stable project attention deep links", () => {
    expect(buildForgeAttentionDeepLink(7, 3, "copy", "incident-11")).toBe("/forge/7?view=attention&item=incident-11&run=3&stage=copy")
  })

  it("keeps separate stage failures in the same project visible and grouped", () => {
    const items = deriveForgeAttentionItems({ projects: [{ id: 7, name: "Acme", businessName: "Acme Ltd" }], jobs: [job({ id: 11, stage: "copy", status: "failed" }), job({ id: 12, stage: "design", kind: "design", status: "failed" })], now })
    expect(items.map((item) => item.stage)).toEqual(expect.arrayContaining(["copy", "design"]))
    expect(groupForgeAttentionItems(items)[0]).toMatchObject({ incidentCount: 2, runs: [{ runId: 3, incidentCount: 2 }] })
  })

  it("collapses mirrored job and run-step errors into one incident with history", () => {
    const error = normalizeForgeOperatorError("Copy provider failed", { runId: 3, stage: "copy", jobId: 11, category: "provider_unavailable", technicalReference: "forge:run:3:step:2" })
    const items = deriveForgeAttentionItems({ projects: [{ id: 7, name: "Acme", businessName: "Acme Ltd" }], jobs: [job({ status: "failed", operatorError: error })], errors: [{ projectId: 7, runId: 3, error: { ...error, technicalReference: "forge:job:11" } }], now })
    expect(items).toHaveLength(1)
    expect(items[0].history).toHaveLength(2)
    expect(items[0].technicalDetails.jobId).toBe(11)
  })

  it("removes resolved job incidents from active attention", () => {
    const error = normalizeForgeOperatorError("Copy provider failed", { runId: 3, stage: "copy", jobId: 11, category: "provider_unavailable" })
    const items = deriveForgeAttentionItems({ projects: [{ id: 7, name: "Acme", businessName: "Acme Ltd" }], jobs: [job({ status: "completed", operatorError: error })], errors: [{ projectId: 7, runId: 3, error }], now })
    expect(items).toEqual([])
  })

  it("shows the latest retry attempt and prior attempt count", () => {
    const error = normalizeForgeOperatorError("Retry queued", { runId: 3, stage: "copy", jobId: 11, category: "provider_unavailable", metadata: { attemptCount: 3 } })
    const [item] = deriveForgeAttentionItems({ projects: [{ id: 7, name: "Acme", businessName: "Acme Ltd" }], jobs: [job({ status: "queued", attempts: 3, operatorError: error })], now })
    expect(item.retryState).toEqual({ status: "queued", latestAttempt: 3, priorAttemptCount: 2, maxAttempts: 3 })
    expect(item.deepLink).toContain("run=3&stage=copy")
  })
})

describe("Forge operator error redaction", () => {
  it("redacts secrets, raw provider responses and sensitive paths", () => {
    const error = normalizeForgeOperatorError(
      "Build failed in /var/www/scalesmiths/ScaleSmiths/private/site with token sk-proj-thisMustNeverAppear",
      {
        jobId: 11,
        metadata: {
          apiKey: "secret-value",
          providerResponse: { content: "raw confidential output" },
          workspacePath: "C:\\private\\generated-site",
          safeCount: 2,
        },
      },
    )
    const serialised = JSON.stringify(error)
    expect(serialised).not.toContain("secret-value")
    expect(serialised).not.toContain("raw confidential output")
    expect(serialised).not.toContain("thisMustNeverAppear")
    expect(serialised).not.toContain("C:\\\\private")
    expect(error.metadata.safeCount).toBe(2)
  })
})
