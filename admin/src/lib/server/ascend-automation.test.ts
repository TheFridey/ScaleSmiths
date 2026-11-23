import { beforeEach, describe, expect, it, vi } from "vitest"
const state = vi.hoisted(() => ({
  authorised: true,
  commandEnabled: true,
  handoffEnabled: true,
  commandCalls: 0,
  handoffCalls: 0,
}))
vi.mock("./rbac", () => ({ requireCapability: async (cap: string) => {
  if (cap !== "expansion.manage" || !state.authorised) throw new Error("Forbidden founder capability")
  return { id: "founder" }
} }))
vi.mock("./sales-command", () => ({
  founderSalesCommandEnabled: () => state.commandEnabled,
  founderCommandCentre: async () => {
    state.commandCalls++
    return { generatedAt: "2026-11-23T12:00:00Z", queue: [
      { id:"notification:1", kind:"notification_failed", title:"Delivery failed", since:"2026-11-22T12:00:00Z", href:"/expansion", ageDays:1 },
    ] }
  },
}))
vi.mock("./delivery-handoff", () => ({
  deliveryHandoffEnabled: () => state.handoffEnabled,
  founderHandoffQueue: async () => {
    state.handoffCalls++
    return { generatedAt:"2026-11-23T12:00:00Z", candidates: [
      { opportunityId:"10000000-0000-4000-8000-000000000001", businessName:"Example Trade", acceptedAt:"2026-11-22T12:00:00Z",
        readiness:{ready:true,blockers:[],alreadyHandedOff:false} },
    ] }
  },
}))
import { founderAutomationSignals } from "./ascend-automation"
describe("B2.7 read-only founder operating projection", () => {
  beforeEach(() => {
    state.authorised = true
    state.commandEnabled = true
    state.handoffEnabled = true
    state.commandCalls = 0
    state.handoffCalls = 0
    vi.stubEnv("ASCEND_AUTOMATION_ENABLED","true")
  })
  it("fails closed before querying any source when the switch is disabled", async () => {
    vi.stubEnv("ASCEND_AUTOMATION_ENABLED","false")
    await expect(founderAutomationSignals()).rejects.toThrow(/unavailable/)
    expect(state.commandCalls + state.handoffCalls).toBe(0)
  })
  it("refuses partial activation of dependent systems", async () => {
    state.handoffEnabled = false
    await expect(founderAutomationSignals()).rejects.toThrow(/must be enabled/)
    expect(state.commandCalls + state.handoffCalls).toBe(0)
  })
  it("denies non-founders before reading sensitive operational queues", async () => {
    state.authorised = false
    await expect(founderAutomationSignals()).rejects.toThrow(/Forbidden/)
    expect(state.commandCalls + state.handoffCalls).toBe(0)
  })
  it("combines existing authoritative queues and makes no automatic changes", async () => {
    const result = await founderAutomationSignals(new Date("2026-11-23T13:00:00Z"))
    expect(result.mode).toBe("read_only")
    expect(result.counts).toEqual({ urgent:1, attention:1, handoff:1 })
    expect(result.signals.map(x=>x.kind)).toEqual(["notification_failed","handoff_ready"])
    expect(state.commandCalls).toBe(1)
    expect(state.handoffCalls).toBe(1)
    expect(result.limitations).toContain("No automatic action")
  })
})
