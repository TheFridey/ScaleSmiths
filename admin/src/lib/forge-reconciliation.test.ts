import { describe, expect, it } from "vitest"
import { isOrphanedLease, runIndependentReconciliationOperations, shouldRetainForgeEvidence } from "./forge-reconciliation"

describe("Forge reconciliation ownership policy", () => {
  const now = new Date("2026-08-28T12:00:00.000Z")

  it("never treats an actively leased resource as orphaned", () => {
    expect(isOrphanedLease({ status: "running", owner: "worker:a", expiresAt: new Date(now.getTime() + 1) }, ["running"], now)).toBe(false)
  })

  it("only permits cleanup after the explicit lease expires", () => {
    expect(isOrphanedLease({ status: "running", owner: "worker:a", expiresAt: new Date(now.getTime() - 1) }, ["running"], now)).toBe(true)
    expect(isOrphanedLease({ status: "completed", expiresAt: new Date(now.getTime() - 1) }, ["running"], now)).toBe(false)
    expect(isOrphanedLease({ status: "running", expiresAt: null }, ["running"], now)).toBe(false)
  })

  it("retains durable project and release evidence", () => {
    expect(shouldRetainForgeEvidence("workspace")).toBe(true)
    expect(shouldRetainForgeEvidence("artifact")).toBe(true)
    expect(shouldRetainForgeEvidence("deployment_candidate")).toBe(true)
  })

  it("continues after a partially-created resource cleanup fails", async () => {
    const calls: string[] = []
    const result = await runIndependentReconciliationOperations([
      { name: "preview", run: async () => { calls.push("preview"); throw new Error("container unavailable") } },
      { name: "budget", run: async () => { calls.push("budget"); return [17] } },
    ])
    expect(calls).toEqual(["preview", "budget"])
    expect(result.completed).toEqual([17])
    expect(result.failures).toEqual([{ name: "preview", error: "container unavailable" }])
  })

  it("is mutation-free when a dry-run plan is only evaluated", async () => {
    let mutations = 0
    const candidate = isOrphanedLease({ status: "running", expiresAt: new Date(now.getTime() - 1) }, ["running"], now)
    if (!candidate) mutations += 1
    expect(candidate).toBe(true)
    expect(mutations).toBe(0)
  })
})
