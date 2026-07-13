import { describe, expect, it } from "vitest"
import { approveForgeMigrationCandidate, createForgeMigrationCandidate, validateRedirectMappings } from "./forge-migration-execution"
import type { ForgeMigrationAnalysis } from "./forge-migration-analysis"
import type { ForgeSiteInventory } from "./forge-site-inventory"

function inputs() {
  const analysis = { oldToNewPageMapping: [{ oldUrl: "https://old.test/services.html", newUrl: "/services", disposition: "retain", evidence: [], confidence: "high", sourceUrl: "https://old.test/services.html", proposedAction: "retain", humanReviewRequired: true }], proposedNewSitemap: [{ proposedUrl: "/services", sourceUrl: "https://old.test/services.html" }], contactDataConflicts: [], requiresClientVerification: [], assetInventory: [], highValuePages: [{ sourceUrl: "https://old.test/services.html" }] } as unknown as ForgeMigrationAnalysis
  const inventory = { pages: [{ finalUrl: "https://old.test/services.html", title: "Services", metaDescription: "Service description", canonicalUrl: "https://old.test/services.html", internalLinks: [], images: [], mainContent: "Approved service information without risky claims." }] } as unknown as ForgeSiteInventory
  return { analysis, inventory }
}

describe("controlled migration execution", () => {
  it("freezes mappings, classifies content, and generates draft redirects", () => {
    const candidate = createForgeMigrationCandidate({ ...inputs(), sourceArtifactIds: [10, 11], approvedFactText: "Approved service information", now: new Date("2026-07-12T12:00:00Z") })
    expect(candidate.content[0].origin).toBe("migrated")
    expect(candidate.redirectConfiguration.content).toContain("return 301 /services")
    expect(candidate.mappingHash).toMatch(/^[a-f0-9]{64}$/)
    expect(candidate.safeguards).toMatchObject({ mappingsImmutable: true, automaticRedirectExport: false, automaticDeployment: false })
  })

  it("requires separate ordered redirect and deployment approvals", () => {
    const candidate = createForgeMigrationCandidate({ ...inputs(), sourceArtifactIds: [10, 11], approvedFactText: "Approved service information" })
    expect(() => approveForgeMigrationCandidate(candidate, "deployment", { actor: "owner", reason: "Reviewed", at: "2026-07-12T12:00:00Z" })).toThrow(/Redirect export/)
    const redirectsApproved = approveForgeMigrationCandidate(candidate, "redirect_export", { actor: "manager", reason: "Mappings verified", at: "2026-07-12T12:00:00Z" })
    const deployed = approveForgeMigrationCandidate(redirectsApproved, "deployment", { actor: "owner", reason: "Deployment checklist reviewed", at: "2026-07-12T12:05:00Z" })
    expect(deployed.approvals.redirectExport?.actor).toBe("manager")
    expect(deployed.approvals.deployment?.actor).toBe("owner")
  })

  it("blocks approval for contact conflicts and unsupported claims", () => {
    const base = inputs()
    base.analysis.contactDataConflicts = [{ evidence: ["Two phone numbers"], sourceUrl: "https://old.test/contact" }] as never
    base.inventory.pages[0].mainContent = "We are award-winning and fully insured."
    const candidate = createForgeMigrationCandidate({ ...base, sourceArtifactIds: [1], approvedFactText: "" })
    expect(candidate.finalReport.blockers.length).toBeGreaterThan(1)
    expect(() => approveForgeMigrationCandidate(candidate, "redirect_export", { actor: "owner", reason: "No", at: "now" })).toThrow(/blockers/)
  })

  it("detects redirect chains and loops", () => {
    expect(validateRedirectMappings([{ oldUrl: "/a", newUrl: "/b" }, { oldUrl: "/b", newUrl: "/c" }]).chains).toEqual([["/a", "/b", "/c"]])
    expect(validateRedirectMappings([{ oldUrl: "/a", newUrl: "/b" }, { oldUrl: "/b", newUrl: "/a" }]).loops.length).toBeGreaterThan(0)
  })
})
