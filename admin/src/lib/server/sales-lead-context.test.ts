import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const service = readFileSync(new URL("./sales-lead-context.ts", import.meta.url), "utf8")
const forgeProposal = readFileSync(new URL("./forge-proposal-agent.ts", import.meta.url), "utf8")

describe("sales lead context boundary", () => {
  it("owns the bounded prospect and outreach query used by Forge", () => {
    expect(service).toContain("Promise.all")
    expect(service).toContain("limit(1)")
    expect(service).toContain("limit(8)")
    expect(service).toContain("getSalesLeadEvidence")
  })

  it("prevents Forge proposal generation from knowing sales tables", () => {
    expect(forgeProposal).toContain("getSalesLeadEvidence(project.prospectId)")
    expect(forgeProposal).not.toMatch(/\b(?:prospects|outreachActivities)\b/)
  })
})
