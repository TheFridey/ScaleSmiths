import { describe, expect, it } from "vitest"
import {
  FORGE_PROPOSAL_ARTIFACT_KIND,
  FORGE_PROPOSAL_BANNED_PHRASES,
  buildForgeAuditMarkdown,
  buildForgeProposalArtifactContent,
  buildForgeProposalBundle,
  buildForgeProposalMarkdown,
  findForgeProposalOverpromises,
  forgeProposalDocuments,
  readForgeProposalArtifact,
  type ForgeProposalInputs,
} from "./forge-proposal"
import { emptyForgeIntakeData } from "./forge"
import { createMockResearchReport } from "./forge-research"
import { createMockSitemapStrategy } from "./forge-sitemap"
import { buildForgeSeoPack, type ForgeSeoBusiness, type ForgeSeoPageInput } from "./forge-seo"

function baseInputs(overrides: Partial<ForgeProposalInputs> = {}): ForgeProposalInputs {
  const intake = emptyForgeIntakeData()
  intake.businessOverview = "Industrial repairs for manufacturers."
  intake.businessLocation = "Nottingham"
  intake.primaryLocation = "Nottingham"
  intake.serviceAreas = "Nottingham, Derby, Leicester"
  intake.coreServices = "Emergency repairs\nMaintenance plans"
  intake.idealCustomers = "Operations managers at industrial sites"
  intake.customerProblems = "unplanned downtime and slow suppliers"
  intake.primaryWebsiteGoal = "win more qualified repair enquiries"
  intake.conversionActions = "Request a quote"
  intake.testimonials = "Strong Google reviews"
  intake.requiredIntegrations = "Resend, WhatsApp"

  const project = {
    name: "Acme rebuild",
    businessName: "Acme Repairs",
    industry: "Industrial repairs",
    websiteUrl: null,
    targetAudience: "Operations leaders",
    primaryGoal: "Increase qualified enquiries",
    budgetRange: "5k-10k",
    brandNotes: "Direct and practical",
  }

  const research = createMockResearchReport({ ...project, websiteUrl: null }, intake)
  const sitemap = createMockSitemapStrategy({
    name: project.name,
    businessName: project.businessName,
    industry: project.industry,
    websiteUrl: null,
    targetAudience: project.targetAudience,
    primaryGoal: project.primaryGoal,
  }, intake, research)

  return {
    project,
    intake,
    intakeCompleteness: 100,
    research,
    sitemap,
    seo: null,
    generatedSite: null,
    qa: null,
    integrations: [{ provider: "resend", enabled: true }, { provider: "whatsapp", enabled: true }],
    ...overrides,
  }
}

function seoPack() {
  const business: ForgeSeoBusiness = {
    businessName: "Acme Repairs",
    industry: "Industrial repairs",
    siteUrl: "https://acme.example",
    primaryLocation: "Nottingham",
    serviceAreas: ["Nottingham", "Derby"],
    telephone: null,
    email: null,
    sameAs: [],
  }
  const page: ForgeSeoPageInput = {
    title: "Emergency Repairs",
    path: "/emergency-repairs",
    template: "service",
    keyword: "emergency repairs nottingham",
    metaDescription: "Fast emergency industrial repairs across Nottingham, Derby, and Leicester from Acme Repairs with an accredited team.",
    h1: "Emergency industrial repairs in Nottingham",
    heroSubheading: "When equipment fails, Acme Repairs restores production fast across Nottingham and the surrounding area with an accredited team.",
    bodyText: "Acme Repairs handles urgent breakdowns for manufacturers in Nottingham, diagnosing and restoring production quickly.",
    faqItems: [
      { question: "How fast can you attend?", answer: "Acme Repairs aims to attend emergencies across Nottingham within hours depending on the equipment." },
      { question: "Do you cover Derby?", answer: "Yes, Acme Repairs covers Nottingham and Derby for emergency repairs and maintenance." },
    ],
    serviceName: "Emergency Repairs",
    trustElements: ["Accredited engineers"],
    localSeoCopy: "Acme Repairs supports manufacturers across Nottingham and Derby.",
  }
  return buildForgeSeoPack(business, [page])
}

describe("forge proposal & audit generator", () => {
  it("builds a complete proposal bundle with all required proposal fields", () => {
    const bundle = buildForgeProposalBundle(baseInputs(), "2026-06-21T00:00:00.000Z")

    expect(bundle.kind).toBe(FORGE_PROPOSAL_ARTIFACT_KIND)
    expect(bundle.proposal.businessProblem).toContain("Acme Repairs")
    expect(bundle.proposal.currentWebsiteGaps.length).toBeGreaterThan(0)
    expect(bundle.proposal.recommendedSolution).toContain("Acme Repairs")
    expect(bundle.proposal.pagesIncluded.length).toBeGreaterThan(0)
    expect(bundle.proposal.integrationsIncluded.join(" ")).toMatch(/Resend|WhatsApp/i)
    expect(bundle.proposal.seoAeoGeoBenefits.join(" ")).toMatch(/AEO/)
    expect(bundle.proposal.buildPricePlaceholder).toContain("£[BUILD]")
    expect(bundle.proposal.monthlyRetainerRecommendation).toContain(bundle.retainer.recommendedTier)
    expect(bundle.proposal.goodBetterBest.map((option) => option.tier)).toEqual(["good", "better", "best"])
    expect(bundle.proposal.supportingRecords.some((record) => record.section === "Business problem")).toBe(true)
    expect(bundle.approval.state).toBe("draft")
    expect(bundle.clientResponse).toBeNull()
    expect(bundle.proposal.nextSteps.length).toBeGreaterThanOrEqual(3)
  })

  it("produces all five sales documents", () => {
    const bundle = buildForgeProposalBundle(baseInputs())
    const docs = forgeProposalDocuments(bundle)
    expect(docs.map((doc) => doc.key)).toEqual(["proposal", "audit", "retainer", "roadmap", "handover"])
    expect(bundle.roadmap.phases.length).toBeGreaterThanOrEqual(4)
    expect(bundle.handover.maintenanceNotes.length).toBeGreaterThan(0)
    expect(bundle.audit.gaps.length).toBeGreaterThan(0)
  })

  it("personalises pricing and assumptions from the internal estimator and lead evidence", () => {
    const bundle = buildForgeProposalBundle(baseInputs({
      estimate: {
        modelVersion: "test-estimator",
        estimatedHours: 72,
        confidenceRange: { low: 60, high: 88 },
        confidence: "medium",
        complexityRating: "high",
        riskFactors: [{ category: "approval", severity: "high", impactHours: 8, explanation: "Client approvals are complex." }],
        suggestedBuildPrice: 8500,
        suggestedRetainer: 650,
        minimumViableScope: ["Core pages"],
        optionalEnhancements: ["Photography", "Content programme"],
        estimatedDeliveryRange: { minWeeks: 3, maxWeeks: 5 },
        marginEstimate: { revenue: 8500, labourCost: 3000, grossMargin: 5500, grossMarginPercent: 65, assumedHourlyCost: 38 },
        knownInputs: [],
        assumptions: [{ key: "photography", label: "Photography", value: false, status: "assumed", evidence: "Not approved yet." }],
        underpricingRisks: ["Do not absorb unapproved work."],
        disclaimer: "Internal estimate only.",
      },
      leadEvidence: {
        painPoints: ["Slow suppliers and missed enquiries"],
        discoveryNotes: ["Client wants better proof near quote CTA"],
        sourceRecords: [{ label: "Discovery call note", recordType: "outreach_activity", recordId: 7 }],
      },
    }))

    expect(bundle.proposal.buildPricePlaceholder).toContain("8,500")
    expect(bundle.proposal.monthlyRetainerRecommendation).toContain("650")
    expect(bundle.proposal.assumptionsRequiringConfirmation.join(" ")).toContain("Photography")
    expect(bundle.proposal.risks.join(" ")).toContain("Client approvals are complex")
    expect(bundle.proposal.supportingRecords.some((record) => record.recordType === "outreach_activity")).toBe(true)
    expect(buildForgeProposalMarkdown(bundle)).toContain("Good / better / best")
  })

  it("flags a missing website as a gap and recommends a tier", () => {
    const bundle = buildForgeProposalBundle(baseInputs({ project: { ...baseInputs().project, websiteUrl: null } }))
    expect(bundle.audit.gaps.join(" ")).toMatch(/no effective current website/i)
    expect(["Essential Care", "Growth", "Performance"]).toContain(bundle.retainer.recommendedTier)
  })

  it("recommends Performance tier for larger builds with multiple integrations", () => {
    const seo = seoPack()
    const generatedSite = {
      kind: "forge_generated_site_code" as const,
      workspacePath: "generated-sites/42-acme",
      fileCount: 40,
      routeCount: 9,
      routes: ["/", "/emergency-repairs", "/maintenance", "/inspections", "/service-area", "/about", "/contact", "/sectors", "/case-studies"],
      components: [],
      integrationPlaceholders: [],
      animationStack: [],
      safetyChecks: [],
      warnings: [],
      generatedAt: "2026-06-21T00:00:00.000Z",
    }
    const bundle = buildForgeProposalBundle(baseInputs({
      seo,
      generatedSite,
      integrations: [
        { provider: "resend", enabled: true },
        { provider: "whatsapp", enabled: true },
        { provider: "analytics", enabled: true },
      ],
    }))
    expect(bundle.retainer.recommendedTier).toBe("Performance")
    expect(bundle.proposal.seoAeoGeoBenefits.join(" ")).toContain(String(seo.score.overall))
  })

  it("never includes overpromising guaranteed-outcome language", () => {
    const bundle = buildForgeProposalBundle(baseInputs({ seo: seoPack() }))
    expect(findForgeProposalOverpromises(bundle)).toEqual([])

    const markdown = buildForgeProposalMarkdown(bundle).toLowerCase()
    for (const phrase of FORGE_PROPOSAL_BANNED_PHRASES) {
      expect(markdown).not.toContain(phrase)
    }
    expect(bundle.complianceNote).toMatch(/do not guarantee/i)
  })

  it("renders markdown documents and round-trips the artifact", () => {
    const bundle = buildForgeProposalBundle(baseInputs())
    const proposalMd = buildForgeProposalMarkdown(bundle)
    const auditMd = buildForgeAuditMarkdown(bundle)

    expect(proposalMd).toContain("# Website Proposal — Acme Repairs")
    expect(proposalMd).toContain("## Next steps")
    expect(auditMd).toContain("# Website Audit — Acme Repairs")

    const content = buildForgeProposalArtifactContent(bundle)
    const state = readForgeProposalArtifact({ kind: FORGE_PROPOSAL_ARTIFACT_KIND, bundle })
    expect(content).toContain("Website Proposal")
    expect(state.status).toBe("generated")
    expect(state.bundle?.businessName).toBe("Acme Repairs")
    expect(readForgeProposalArtifact(null).status).toBe("empty")
    expect(readForgeProposalArtifact({ kind: "other" }).status).toBe("empty")
  })
})
