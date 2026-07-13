import { describe, expect, it } from "vitest"
import { buildForgeStructuralFingerprint, evaluateForgeStructuralOriginality, readForgeOriginalityReport, type ForgeStructuralFingerprint } from "./forge-originality"

function fp(overrides: Partial<ForgeStructuralFingerprint> = {}): ForgeStructuralFingerprint {
  return {
    projectId: 1,
    artifactId: 10,
    artifactVersion: 1,
    industry: "home repairs",
    routeCount: 5,
    routeShapes: ["home", "service", "service", "trust", "conversion"],
    componentSequence: ["Hero", "TrustBar", "ServicesGrid", "ProcessSection", "ReviewsSection", "FAQSection", "LeadForm"],
    sectionSequence: ["Hero", "TrustBar", "ServicesGrid", "ProcessSection", "ReviewsSection", "FAQSection", "LeadForm"],
    heroComposition: "hero:proof:grid-follow:fade",
    cardGridPattern: "services-grid:standard-routes",
    decorativeDevices: ["rounded-panels", "motion-reveal"],
    animationPattern: "fade > framer-motion",
    testimonialLayout: "single-proof-band",
    ctaPattern: "form:whatsapp:contact-route",
    centeredLayoutRatio: .55,
    rhythmSignature: ["conversion", "proof", "grid", "content", "proof", "proof", "conversion"],
    styleSystemKey: "clean-local",
    ...overrides,
  }
}

describe("Forge structural originality evaluator", () => {
  it("builds privacy-safe fingerprints from generated-code metadata", () => {
    const fingerprint = buildForgeStructuralFingerprint({
      projectId: 7,
      artifactId: 70,
      artifactVersion: 2,
      industry: "Electrician",
      metadataJson: {
        summary: {
          routes: ["/", "/emergency", "/about", "/contact"],
          components: ["Hero", "TrustBar", "ServicesGrid", "LeadForm"],
          animationStack: ["fade", "prefers-reduced-motion support"],
          designSystem: { styleSystemKey: "trade" },
        },
      },
    })

    expect(fingerprint).toMatchObject({ projectId: 7, artifactId: 70, routeShapes: ["home", "service", "trust", "conversion"] })
    expect(JSON.stringify(fingerprint)).not.toContain("emergency electrician copy")
  })

  it("flags high cross-project structural similarity without exposing private content", () => {
    const current = fp()
    const report = evaluateForgeStructuralOriginality(current, [fp({ projectId: 2, artifactId: 20 })], new Date("2026-07-12T12:00:00Z"))

    expect(report.similarityScore).toBeGreaterThanOrEqual(80)
    expect(report.humanReviewRequired).toBe(true)
    expect(report.privacy).toMatchObject({ clientContentCompared: false, privateContentExposed: false })
    expect(report.findings.some((finding) => finding.category === "high_cross_project_similarity")).toBe(true)
    expect(report.findings[0].matchingProjects[0]).toEqual({ projectId: 2, artifactId: 20, artifactVersion: 1 })
    expect(JSON.stringify(report)).not.toContain("businessName")
  })

  it("distinguishes design-system consistency and industry convention from templating", () => {
    const current = fp({ styleSystemKey: "premium-trade", industry: "electrician" })
    const convention = fp({ projectId: 3, artifactId: 30, industry: "electrician", heroComposition: "hero:plain:linear:fade", cardGridPattern: "services-grid:many-routes" })
    const consistency = [4, 5, 6, 7].map((projectId) => fp({ projectId, artifactId: projectId * 10, industry: "podiatry", styleSystemKey: "premium-trade", heroComposition: "hero:plain:linear:fade", cardGridPattern: "no-service-grid:few-routes" }))
    const report = evaluateForgeStructuralOriginality(current, [convention, ...consistency])
    const classifications = report.findings.map((finding) => finding.classification)

    expect(classifications).toContain("legitimate_industry_convention")
    expect(classifications).toContain("appropriate_design_system_consistency")
  })

  it("reads persisted reports from artifact metadata", () => {
    const report = evaluateForgeStructuralOriginality(fp(), [])
    expect(readForgeOriginalityReport({ report })).toMatchObject({ kind: "forge_structural_originality_v1" })
    expect(readForgeOriginalityReport({ report: { kind: "other" } })).toBeNull()
  })
})
