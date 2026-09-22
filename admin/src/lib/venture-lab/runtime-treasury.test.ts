import { describe, expect, it } from "vitest"
import { activateEmergencyStop, assertAgentMutationAllowed, resumeVentureLab } from "./runtime"
import { availableExperimentMinor, createExperimentZeroTreasury, reserveSimulatedSpend, settleSimulatedSpend } from "./treasury"

describe("Venture Lab emergency STOP", () => {
  it("lets Rhys-style technical containment block agent mutations immediately", () => {
    const stopped = activateEmergencyStop(
      { paused: false },
      "rhys",
      "Suspicious integration behaviour",
      "2026-09-22T20:00:00.000Z",
    )

    expect(stopped.paused).toBe(true)
    expect(stopped.pausedBy).toBe("rhys")
    expect(() => assertAgentMutationAllowed(stopped)).toThrow(/paused/)
  })

  it("requires an authenticated actor and explicit resume", () => {
    expect(() => activateEmergencyStop({ paused: false }, "", "reason")).toThrow(/authenticated/)
    const stopped = activateEmergencyStop({ paused: false }, "rhys", "Containment")
    expect(resumeVentureLab(stopped, "trev").paused).toBe(false)
  })
})

describe("Experiment 000 treasury", () => {
  it("starts with £25 available and keeps the £75 reserve outside the envelope", () => {
    const treasury = createExperimentZeroTreasury()
    expect(availableExperimentMinor(treasury)).toBe(2_500)
    expect(treasury.protectedReserveMinor).toBe(7_500)
  })

  it("rejects an attempt to spend £25.01", () => {
    const treasury = createExperimentZeroTreasury()
    expect(() =>
      reserveSimulatedSpend(treasury, {
        idempotencyKey: "attack-over-budget",
        amountMinor: 2_501,
        purpose: "Red-team overspend",
      }),
    ).toThrow(/exceeds experiment allocation/)
  })

  it("does not double reserve an idempotent request", () => {
    const first = reserveSimulatedSpend(createExperimentZeroTreasury(), {
      idempotencyKey: "domain-1",
      amountMinor: 999,
      purpose: "Validation domain",
    })

    expect(() =>
      reserveSimulatedSpend(first, {
        idempotencyKey: "domain-1",
        amountMinor: 999,
        purpose: "Replay",
      }),
    ).toThrow(/Duplicate/)
  })

  it("moves committed simulation money into spent without changing protected reserve", () => {
    const reserved = reserveSimulatedSpend(createExperimentZeroTreasury(), {
      idempotencyKey: "domain-2",
      amountMinor: 999,
      purpose: "Validation domain",
    })
    const settled = settleSimulatedSpend(reserved, 999)

    expect(settled.committedMinor).toBe(0)
    expect(settled.spentMinor).toBe(999)
    expect(settled.protectedReserveMinor).toBe(7_500)
    expect(availableExperimentMinor(settled)).toBe(1_501)
  })
})
