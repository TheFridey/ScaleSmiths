import { describe, expect, it } from "vitest"
import { legalRoutes } from "./legal"
import { legalPolicies } from "./legal-policies"

describe("legal policy set", () => {
  it("provides substantive content for every legal route", () => {
    expect(Object.keys(legalPolicies).sort()).toEqual([...legalRoutes].sort())
    for (const policy of Object.values(legalPolicies)) {
      expect(policy.sections.length).toBeGreaterThanOrEqual(2)
      expect(JSON.stringify(policy).length).toBeGreaterThan(500)
    }
  })

  it("does not invent identity, guarantees, tiers or a liability cap", () => {
    const content = JSON.stringify(legalPolicies)
    expect(content).not.toMatch(/ScaleSmiths Ltd|99\.99%|military grade|GDPR certified|ICO approved|12 months.? fees|limited to £100/i)
    expect(content).not.toMatch(/Mailcow|SOGo/i)
  })

  it("keeps internal drafting language out of customer-facing policies", () => {
    const content = JSON.stringify(legalPolicies)
    expect(content).not.toMatch(/repository|owner (?:input|decision)|awaiting confirmation|do not invent|cannot verify|qualified legal review|until (?:these|the) terms are confirmed|evidence state|implementation note|TODO/i)
  })
})
