import { describe, expect, it } from "vitest"
import { evaluateBudgetReservation, providerBudgetEnvKey, type BudgetScope } from "./forge-budget-reservations"

describe("transactional AI budget reservation policy", () => {
  it("enforces every hard-limit scope and alert threshold", () => {
    const scopes: BudgetScope[] = [{ name:"daily_global", spent:8, reserved:1, limit:10 }, { name:"project", spent:2, reserved:0, limit:25 }, { name:"task", spent:0, reserved:0, limit:1 }, { name:"provider", spent:3, reserved:0, limit:5 }]
    const result = evaluateBudgetReservation(scopes, 1.5)
    expect(result.allowed).toBe(false)
    expect(result.blockers.map((item) => item.name)).toEqual(["daily_global", "task"])
    expect(result.alerts.map((item) => item.name)).toContain("provider")
  })
  it("serializes concurrent decisions so reservations cannot oversubscribe", async () => {
    let reserved = 0
    let lock = Promise.resolve()
    const reserve = () => {
      const operation = lock.then(() => {
        const decision = evaluateBudgetReservation([{ name:"daily_global", spent:0, reserved, limit:1 }], 0.6)
        if (decision.allowed) reserved += 0.6
        return decision.allowed
      })
      lock = operation.then(() => undefined)
      return operation
    }
    expect(await Promise.all([reserve(), reserve()])).toEqual([true, false])
    expect(reserved).toBe(0.6)
  })
  it("normalises provider-specific environment keys", () => expect(providerBudgetEnvKey("openai")).toBe("FORGE_AI_PROVIDER_OPENAI_DAILY_USD_BUDGET"))
})
