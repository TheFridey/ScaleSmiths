import { describe, expect, it } from "vitest"
import { applyForgeInterpretationSummary, forgeIntakeSubmissionKey, interpretForgeProjectIntake } from "./forge-project-intake"
import { parseForgeIntakeDraft, serializeForgeIntakeDraft } from "./forge-intake-draft"

describe("unified Forge project intake", () => {
  it("creates a complete prompt-only interpretation without requiring a website", () => {
    const result = interpretForgeProjectIntake({
      request: "Build a premium lead-generation website for a Nottingham commercial roofing company. They want larger contracts and need enquiries by email and WhatsApp.",
    })
    expect(result.project.industry).toBe("Commercial roofing")
    expect(result.summary.projectType).toBe("new_build")
    expect(result.summary.integrations).toContain("Contact form")
    expect(result.summary.requiredFunctionality).toContain("WhatsApp")
    expect(result.missingCritical).toEqual([])
    expect(result.strategyPack.id).toBeTruthy()
  })

  it("merges URL autofill facts with the operator request and marks a redesign", () => {
    const base = interpretForgeProjectIntake({
      websiteUrl: "https://example.test",
      request: "Redesign this site to win larger commercial contracts.",
    }, {
      project: { name: "Acme rebuild", businessName: "Acme Roofing", industry: "Roofing", targetAudience: "Facilities managers", primaryGoal: "Qualified quote requests", brandNotes: "Current public site" },
      intake: {
        ...interpretForgeProjectIntake({ request: "Build a site for Acme Roofing." }).intake,
        businessOverview: "Acme Roofing maintains commercial roofs.",
      },
      confidenceNotes: ["Read from public pages."],
      sourcePages: ["https://example.test/"],
    })
    expect(base.project.businessName).toBe("Acme Roofing")
    expect(base.summary.projectType).toBe("redesign")
    expect(base.summary.business).toContain("commercial roofs")
    expect(base.confirmedFields).toContain("website URL")
  })

  it("reports only genuinely critical missing source information", () => {
    const missing = interpretForgeProjectIntake({})
    expect(missing.missingCritical.map((item) => item.key)).toContain("request")
    expect(missing.missingCritical.map((item) => item.key)).toContain("businessName")
  })

  it("applies inline summary edits back to the structured brief", () => {
    const result = interpretForgeProjectIntake({ request: "Build a website for a Nottingham electrician." })
    const updated = applyForgeInterpretationSummary(result, { ...result.summary, targetAudience: "Commercial property managers", integrations: "Resend\nWhatsApp" })
    expect(updated.intake.idealCustomers).toBe("Commercial property managers")
    expect(updated.intake.requiredIntegrations).toBe("Resend\nWhatsApp")
  })

  it("uses a stable actor-scoped fingerprint for duplicate submission protection", () => {
    const result = interpretForgeProjectIntake({ request: "Build a website for a Nottingham electrician." })
    expect(forgeIntakeSubmissionKey(result, "owner@example.test")).toBe(forgeIntakeSubmissionKey(result, "owner@example.test"))
    expect(forgeIntakeSubmissionKey(result, "owner@example.test")).not.toBe(forgeIntakeSubmissionKey(result, "other@example.test"))
  })

  it("round-trips the complete draft for refresh recovery", () => {
    const interpretation = interpretForgeProjectIntake({ request: "Build a website for a Nottingham electrician." })
    const draft = { step: 2 as const, input: { request: "Build a website for a Nottingham electrician." }, interpretation, summary: interpretation.summary, submissionKey: "stable-submission-key", savedAt: "2026-07-30T10:00:00.000Z" }
    expect(parseForgeIntakeDraft(serializeForgeIntakeDraft(draft))).toEqual(draft)
    expect(parseForgeIntakeDraft("not-json")).toBeNull()
  })
})
