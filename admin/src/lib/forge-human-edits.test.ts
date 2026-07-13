import { describe, expect, it } from "vitest"
import { approximateEditDistance, buildForgeHumanEditTracking, inferForgeHumanEditCategories, mergeHumanEditTracking, summarizeForgeHumanEdits } from "./forge-human-edits"

describe("Forge human edit tracking", () => {
  it("tracks meaningful approval edits without keystroke data", () => {
    const tracking = buildForgeHumanEditTracking({
      artifact: {
        type: "copy_doc",
        title: "Copy Document",
        version: 2,
        content: "Generic AI copy. Learn more.",
        metadataJson: { ai: { provider: "openai", model: "gpt-x" } },
        createdAt: "2026-07-12T10:00:00.000Z",
      },
      approvedContent: "Specific damp repair copy for Leeds landlords. Request a repair survey.",
      editor: "editor@example.com",
      reason: "Removed generic output and improved conversion CTA.",
      now: new Date("2026-07-12T10:45:00.000Z"),
    })

    expect(tracking).toMatchObject({
      generatedVersion: 2,
      humanEditedVersion: 2,
      finalApprovedVersion: 2,
      editor: "editor@example.com",
      provider: "openai",
      model: "gpt-x",
      timeFromGenerationToApprovalMinutes: 45,
      correctedQualityProblem: true,
      correctedFactualProblem: false,
    })
    expect(tracking.categories).toEqual(expect.arrayContaining(["generic_output", "conversion"]))
    expect(tracking.approximateEditDistance).toBeGreaterThan(0)
  })

  it("infers factual, compliance, SEO, missing-content and technical categories", () => {
    expect(inferForgeHumanEditCategories("Fixed wrong phone, privacy copy, meta title, missing form field, and build error.", "", "")).toEqual(expect.arrayContaining([
      "factual_correction",
      "compliance",
      "seo",
      "missing_content",
      "technical_issue",
    ]))
  })

  it("merges current tracking with historical entries", () => {
    const first = buildForgeHumanEditTracking({ artifact: { type: "sitemap", title: "Sitemap", version: 1, content: "A", metadataJson: null }, approvedContent: "B", editor: "a", reason: "Client requested missing page." })
    const second = buildForgeHumanEditTracking({ artifact: { type: "sitemap", title: "Sitemap", version: 2, content: "B", metadataJson: null }, approvedContent: "C", editor: "b", reason: "SEO change." })
    const merged = mergeHumanEditTracking(mergeHumanEditTracking({}, first), second)
    expect((merged.humanEditHistory as unknown[])).toHaveLength(2)
    expect(merged.humanEditTracking).toBe(second)
  })

  it("summarises correction-heavy stages by provider and model without raw client content", () => {
    const edit = buildForgeHumanEditTracking({
      artifact: { type: "copy_doc", title: "Copy", version: 1, content: "before", metadataJson: null, provider: "anthropic", model: "claude-x" },
      approvedContent: "after much better CTA",
      editor: "editor",
      reason: "Conversion and generic output correction.",
    })
    const report = summarizeForgeHumanEdits([{ type: "copy_doc", title: "Copy", version: 1, content: null, metadataJson: mergeHumanEditTracking({}, edit), provider: "anthropic", model: "claude-x" }])
    expect(report).toEqual([expect.objectContaining({
      stage: "copy_doc",
      provider: "anthropic",
      model: "claude-x",
      editCount: 1,
      qualityCorrections: 1,
    })])
    expect(JSON.stringify(report)).not.toContain("after much better CTA")
  })

  it("keeps edit distance approximate and deterministic", () => {
    expect(approximateEditDistance("kitten", "sitting")).toBe(3)
  })
})
