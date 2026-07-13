import { describe, expect, it } from "vitest"
import { emptyForgeIntakeData } from "./forge"
import { createMockCopyDocument } from "./forge-copy"
import { createMockDesignDirection } from "./forge-design"
import {
  FORGE_DESIGN_SYSTEM_ARTIFACT_KIND,
  FORGE_DESIGN_SYSTEM_ARTIFACT_TITLE,
  FORGE_DESIGN_TOKEN_IDS,
  buildForgeDesignSystemArtifactContent,
  buildForgeDesignSystemPrompt,
  createMockDesignSystemSpecification,
  parseForgeDesignSystemPayload,
  readForgeDesignSystemArtifact,
} from "./forge-design-system"
import { createMockResearchReport } from "./forge-research"
import { createMockSitemapStrategy } from "./forge-sitemap"

function fixture() {
  const intake = emptyForgeIntakeData()
  intake.brandTone = "Premium, direct, reassuring"
  intake.visualStyle = "Clean local professional"
  intake.primaryLocation = "Nottingham"
  intake.serviceAreas = "Nottingham, Mansfield, Derby"
  const project = {
    name: "Nottingham Homecare Repairs",
    businessName: "Nottingham Homecare Repairs",
    industry: "Home repairs",
    websiteUrl: null,
    brandNotes: "Clean, credible and local",
    targetAudience: "Homeowners and landlords",
    primaryGoal: "Increase quote requests",
    budgetRange: null,
  }
  const researchReport = createMockResearchReport(project, intake)
  const approvedSitemap = createMockSitemapStrategy(project, intake, researchReport)
  const approvedCopy = createMockCopyDocument(project, approvedSitemap, intake, researchReport)
  const approvedDesign = createMockDesignDirection({ project, intake, approvedSitemap, approvedCopy })
  return { project, intake, researchReport, approvedSitemap, approvedCopy, approvedDesign }
}

describe("Forge design-system specification", () => {
  it("creates a strict token-governed artifact from approved project facts", () => {
    const context = fixture()
    const spec = createMockDesignSystemSpecification(context)
    const parsed = parseForgeDesignSystemPayload(spec)

    expect(parsed.ok).toBe(true)
    expect(spec.kind).toBe(FORGE_DESIGN_SYSTEM_ARTIFACT_KIND)
    expect(spec.requiredTokenIds).toEqual([...FORGE_DESIGN_TOKEN_IDS])
    expect(spec.implementationReadiness).toMatchObject({
      approvedBeforeImplementation: true,
      arbitraryStyleValuesAllowed: false,
    })
    expect(spec.approvedFactReferences).toContain("primary_location:Nottingham")
    expect(spec.prohibitedStyleValues).toContain("Ad hoc hex colours outside the token set")
  })

  it("rejects missing tokens, duplicate tokens, and arbitrary-style approval", () => {
    const spec = createMockDesignSystemSpecification(fixture())
    expect(parseForgeDesignSystemPayload({ ...spec, requiredTokenIds: spec.requiredTokenIds.slice(1) }).ok).toBe(false)
    expect(parseForgeDesignSystemPayload({ ...spec, tokens: [...spec.tokens, spec.tokens[0]] }).ok).toBe(false)
    expect(parseForgeDesignSystemPayload({
      ...spec,
      implementationReadiness: { ...spec.implementationReadiness, arbitraryStyleValuesAllowed: true },
    }).ok).toBe(false)
  })

  it("reads draft and approved design-system artifact state", () => {
    const spec = createMockDesignSystemSpecification(fixture())
    expect(readForgeDesignSystemArtifact({ kind: FORGE_DESIGN_SYSTEM_ARTIFACT_KIND, status: "draft", specification: spec }).status).toBe("draft")
    expect(readForgeDesignSystemArtifact({
      kind: FORGE_DESIGN_SYSTEM_ARTIFACT_KIND,
      status: "approved",
      specification: spec,
      approvedSpecification: spec,
      approvedAt: "2026-07-12T12:00:00.000Z",
      approvedBy: "owner@example.com",
    })).toMatchObject({ status: "approved", approvedBy: "owner@example.com" })
  })

  it("documents required systems and approved references", () => {
    const spec = createMockDesignSystemSpecification(fixture())
    const content = buildForgeDesignSystemArtifactContent(spec)
    const prompt = buildForgeDesignSystemPrompt(fixture())

    expect(FORGE_DESIGN_SYSTEM_ARTIFACT_TITLE).toBe("Design System Specification")
    expect(content).toContain("## Required Tokens")
    expect(content).toContain("## Prohibited Style Values")
    expect(prompt).toContain("Use the provided token identifiers exactly")
  })
})
