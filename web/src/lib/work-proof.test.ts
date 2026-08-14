import { describe, expect, it } from "vitest"
import { buildLogs } from "./build-logs"
import { projects } from "./data"

describe("public work proof model", () => {
  it("keeps every project in an explicit public work group", () => {
    expect(projects.every((project) => ["client-work", "product-platform"].includes(project.portfolioGroup))).toBe(true)
    expect(projects.filter((project) => project.portfolioGroup === "client-work")).not.toHaveLength(0)
    expect(projects.filter((project) => project.portfolioGroup === "product-platform")).not.toHaveLength(0)
  })

  it("only exposes project outcomes through registered claim identifiers", () => {
    for (const project of projects) {
      expect(project.outcomeClaimIds.length).toBeGreaterThan(0)
      expect(project.outcomeClaimIds.every((id) => id.startsWith("project."))).toBe(true)
      expect(new Set(project.outcomeClaimIds).size).toBe(project.outcomeClaimIds.length)
    }
  })

  it("gives every engineering note a system and publishing status", () => {
    for (const log of buildLogs) {
      expect(log.system.trim()).not.toBe("")
      expect(["Production note", "System note"]).toContain(log.status)
    }
  })
})
