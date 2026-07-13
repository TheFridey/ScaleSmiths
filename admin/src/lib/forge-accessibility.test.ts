import { describe, expect, it } from "vitest"
import { buildForgeAccessibilityReport, evaluateAccessibilitySnapshot, readForgeAccessibilityArtifact, type ForgeAccessibilitySnapshot } from "./forge-accessibility"

function snapshot(overrides: Partial<ForgeAccessibilitySnapshot> = {}): ForgeAccessibilitySnapshot {
  return {
    page: "/",
    title: "Home",
    language: "en",
    landmarks: { main: 1, nav: 1, header: 1, footer: 1 },
    headings: [{ level: 1, text: "Home", selector: "h1" }, { level: 2, text: "Services", selector: "h2" }],
    focusable: [{ selector: "a", text: "Request a quote", hasVisibleFocus: true, width: 44, height: 44 }],
    forms: [{ selector: "input#email", label: "Email", required: true, hasErrorMessage: true }],
    images: [{ selector: "img", alt: "Completed plaster repair", decorative: false }],
    links: [{ selector: "a", text: "Request a quote", href: "/contact" }],
    buttons: [{ selector: "button", text: "Open menu", width: 44, height: 44 }],
    modals: [],
    mobileMenus: [{ selector: "button.menu", labelled: true, expanded: "false", controls: "site-menu" }],
    ariaMisuse: [],
    skipLinks: [{ selector: "a.skip", href: "#main", visibleOnFocus: true }],
    contrastIssues: [],
    reducedMotionIssues: [],
    ...overrides,
  }
}

describe("Forge accessibility gate", () => {
  it("passes a semantically complete snapshot", () => {
    const report = buildForgeAccessibilityReport({ previewUrl: "http://127.0.0.1:4000", routes: ["/"], snapshots: [snapshot()], toolingAvailable: true })
    expect(report.status).toBe("passed")
    expect(report.blocking).toBe(false)
    expect(report.findings).toEqual([])
  })

  it("flags critical deployment blockers with WCAG references", () => {
    const findings = evaluateAccessibilitySnapshot(snapshot({
      title: "",
      language: null,
      landmarks: { main: 0, nav: 0 },
      headings: [{ level: 2, text: "Skipped", selector: "h2" }],
      focusable: [{ selector: "button.bad", text: "Menu", hasVisibleFocus: false, width: 16, height: 18 }],
      forms: [{ selector: "input#name", label: null, required: true, hasErrorMessage: false }],
      images: [{ selector: "img.hero", alt: null, decorative: false }],
      links: [{ selector: "a.more", text: "Learn more", href: "/services" }],
      contrastIssues: [{ selector: "p", ratio: 2.1, text: "Low contrast body text" }],
      skipLinks: [],
    }))
    expect(findings.filter((finding) => finding.blocking).map((finding) => finding.wcag)).toEqual(expect.arrayContaining(["2.4.2", "1.3.1", "2.4.7", "3.3.2", "1.4.3"]))
    expect(findings.find((finding) => finding.selector === "input#name")?.recommendedCorrection).toContain("aria-label")
  })

  it("fails closed when browser tooling is unavailable", () => {
    const report = buildForgeAccessibilityReport({ previewUrl: null, routes: ["/"], snapshots: [], toolingAvailable: false, unavailableReason: "Playwright missing" })
    expect(report.status).toBe("skipped")
    expect(report.blocking).toBe(true)
    expect(report.findings[0]).toMatchObject({ severity: "critical", evidence: "Playwright missing" })
    expect(report.overrideRequiredRole).toBe("owner")
  })

  it("reads persisted metadata reports", () => {
    const report = buildForgeAccessibilityReport({ previewUrl: "http://127.0.0.1:4000", routes: ["/"], snapshots: [snapshot()], toolingAvailable: true })
    expect(readForgeAccessibilityArtifact({ kind: "forge_accessibility_report_v1", report })).toBe(report)
    expect(readForgeAccessibilityArtifact({ kind: "other", report })).toBeNull()
  })
})
