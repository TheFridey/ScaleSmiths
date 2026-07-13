import { describe, expect, it } from "vitest"
import { estimateProjectEffort, type ProjectEstimateContext } from "./project-estimator"

function context(overrides: Partial<ProjectEstimateContext> = {}): ProjectEstimateContext {
  return {
    project: {
      name: "Oak & Hearth",
      businessName: "Oak & Hearth Property Care",
      industry: "home services",
      websiteUrl: "https://example.com",
      status: "strategy",
      priority: "medium",
      brandNotes: "Trustworthy local service business.",
      targetAudience: "Homeowners",
      primaryGoal: "Grow local SEO enquiries",
      budgetRange: "GBP 5000-9000",
      deadline: null,
    },
    sitemap: { status: "approved", strategy: { sitemap: [{ path: "/" }, { path: "/services" }, { path: "/contact" }] } } as ProjectEstimateContext["sitemap"],
    copy: { status: "approved", approvedCopy: { pages: [{ path: "/" }, { path: "/services" }, { path: "/contact" }] } } as ProjectEstimateContext["copy"],
    componentSpec: { status: "approved", approvedSpec: { pages: [{ path: "/" }, { path: "/services" }, { path: "/contact" }] } } as ProjectEstimateContext["componentSpec"],
    generatedCode: { status: "empty", summary: null } as ProjectEstimateContext["generatedCode"],
    qa: { status: "empty", report: null } as ProjectEstimateContext["qa"],
    visualQa: { status: "empty", report: null } as ProjectEstimateContext["visualQa"],
    integrations: [{ provider: "resend", enabled: true }],
    approvedArtifactCount: 3,
    degradedOrFallbackCount: 0,
    taskCount: 6,
    ...overrides,
  }
}

describe("project estimator", () => {
  it("creates an explainable project estimate from approved Forge data", () => {
    const result = estimateProjectEffort(context())

    expect(result.estimatedHours).toBeGreaterThan(30)
    expect(result.suggestedBuildPrice).toBeGreaterThan(0)
    expect(result.suggestedRetainer).toBeGreaterThan(0)
    expect(result.knownInputs.some((input) => input.key === "pageCount" && input.value === 3)).toBe(true)
    expect(result.assumptions.some((input) => input.key === "ecommerce")).toBe(true)
    expect(result.disclaimer).toContain("not a delivery guarantee")
    expect(result.underpricingRisks.length).toBeGreaterThan(0)
  })

  it("adds technical and approval risk for complex uncertain work", () => {
    const result = estimateProjectEffort(context({
      project: {
        ...context().project,
        primaryGoal: "Build an e-commerce portal with account login, admin dashboard, 3D product animation and migration.",
      },
      degradedOrFallbackCount: 2,
    }))

    expect(result.estimatedHours).toBeGreaterThan(90)
    expect(result.complexityRating === "high" || result.complexityRating === "enterprise").toBe(true)
    expect(result.riskFactors.some((risk) => risk.category === "technical_scope")).toBe(true)
    expect(result.riskFactors.some((risk) => risk.category === "approval_complexity")).toBe(true)
    expect(result.underpricingRisks.some((risk) => risk.includes("High-risk"))).toBe(true)
  })
})
