import { describe, expect, it } from "vitest"
import { evaluateForgeMigrationInventory, readForgeMigrationAnalysis } from "./forge-migration-analysis"
import type { ForgeSiteInventory, ForgeSiteInventoryPage } from "./forge-site-inventory"

function page(overrides: Partial<ForgeSiteInventoryPage> & Pick<ForgeSiteInventoryPage, "finalUrl">): ForgeSiteInventoryPage {
  return { requestedUrl: overrides.finalUrl, depth: 0, status: 200, redirects: [], title: "Service", metaDescription: "", canonicalUrl: null, headings: [{ level: 1, text: "Service in Bristol" }], mainContent: "Professional repair service in Bristol. Call today. 2022 service information.", images: [], internalLinks: [], forms: [], contactDetails: { emails: [], phones: [], addresses: [] }, structuredData: [], contentType: "text/html", contentBytes: 1000, fetchedAt: "2026-07-12T10:00:00Z", ...overrides }
}
function inventory(pages: ForgeSiteInventoryPage[]): ForgeSiteInventory { return { kind: "forge_site_inventory_v1", startedAt: "2026-07-12T09:00:00Z", completedAt: "2026-07-12T10:00:00Z", startUrl: "https://example.test/", allowedDomains: ["example.test"], policy: { maxPages: 25, maxDepth: 2, robots: "respect", scriptsExecuted: false }, pages, discoveredUrls: pages.map((item) => item.finalUrl), failures: [], evidence: { robotsUrl: "https://example.test/robots.txt", robotsStatus: 200, robotsApplied: true, userAgent: "test" }, summary: { pagesFetched: pages.length, urlsDiscovered: pages.length, failures: 0, redirects: 0, images: 0, forms: 0 } } }

describe("Forge migration analysis", () => {
  it("creates complete review-only recommendations from crawl evidence", () => {
    const shared = "A ".repeat(180)
    const report = evaluateForgeMigrationInventory(inventory([
      page({ finalUrl: "https://example.test/services.html", title: "Repair services", mainContent: shared, internalLinks: ["https://example.test/missing"], images: [{ src: "https://example.test/team.jpg", alt: "Team" }], contactDetails: { emails: ["one@example.test"], phones: ["0111"], addresses: [] } }),
      page({ finalUrl: "https://example.test/services-copy", title: "Repair services copy", mainContent: shared, contactDetails: { emails: ["two@example.test"], phones: ["0222"], addresses: [] } }),
      page({ finalUrl: "https://example.test/missing", status: 404, title: "Missing" }),
    ]), new Date("2026-07-12T12:00:00Z"))
    expect(report.duplicateContent.length).toBeGreaterThan(0)
    expect(report.brokenLinks[0].evidence[0]).toContain("HTTP 404")
    expect(report.contactDataConflicts).toHaveLength(2)
    expect(report.assetInventory[0]).toMatchObject({ assetUrl: "https://example.test/team.jpg" })
    expect(report.redirectPlan[0]).toMatchObject({ oldUrl: "https://example.test/services.html", newUrl: "/services", redirectType: 301, status: "proposed" })
    expect(report.proposedNewSitemap.every((item) => item.humanReviewRequired && item.evidence.length && item.sourceUrl && item.proposedAction && item.confidence)).toBe(true)
    expect(report.safeguards).toEqual({ automaticChangesApplied: false, destructiveActionsApplied: false, requiresHumanApproval: true })
    expect(readForgeMigrationAnalysis(report)).toEqual(report)
  })

  it("does not call an uncrawled link broken when there is no failure evidence", () => {
    const source = page({ finalUrl: "https://example.test/", internalLinks: ["https://example.test/not-fetched"] })
    expect(evaluateForgeMigrationInventory(inventory([source])).brokenLinks).toEqual([])
  })

  it("flags likely commercial pages and ranking evidence gaps", () => {
    const report = evaluateForgeMigrationInventory(inventory([page({ finalUrl: "https://example.test/services/repair", title: "Repair service" })]))
    expect(report.highValuePages).toHaveLength(1)
    expect(report.rankingRisks.some((item) => item.severity === "critical")).toBe(true)
    expect(report.requiresClientVerification.some((item) => item.category === "client_verification")).toBe(true)
  })
})
