import { describe, expect, it } from "vitest"
import { buildLogs } from "./build-logs"
import { approvedClientLogos, trustEntries } from "./client-proof"
import { projectImageAlt, projects } from "./data"

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

  it("describes project imagery honestly and without keyword stuffing", () => {
    for (const project of projects.filter((candidate) => candidate.heroImage)) {
      const alt = projectImageAlt(project)
      expect(project.imageKind, `${project.slug} must declare what its imagery shows`).toBeDefined()
      expect(alt).toContain(project.name)
      expect(alt.length).toBeLessThanOrEqual(140)
      expect(alt).not.toMatch(/\b(?:seo|agency|best|near me|nottingham web design)\b/i)
      if (project.imageKind === "cover-card") expect(alt).not.toMatch(/screenshot/i)
    }
  })

  it("only names businesses in the trust strip that have a published case study", () => {
    const slugs = new Set(projects.map((project) => `/work/${project.slug}`))
    const entries = trustEntries()
    expect(entries.length).toBe(projects.length)
    for (const entry of entries) expect(slugs.has(entry.href)).toBe(true)
    for (const [slug, logo] of Object.entries(approvedClientLogos)) {
      expect(slugs.has(`/work/${slug}`)).toBe(true)
      expect(logo?.src).toMatch(/^\/images\/clients\//)
    }
  })

  it("gives every engineering note a system and publishing status", () => {
    for (const log of buildLogs) {
      expect(log.system.trim()).not.toBe("")
      expect(["Production note", "System note"]).toContain(log.status)
    }
  })
})
