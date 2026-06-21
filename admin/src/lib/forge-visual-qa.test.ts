import { describe, expect, it } from "vitest"
import {
  FORGE_DEFAULT_MIN_LIGHTHOUSE_ACCESSIBILITY,
  FORGE_DEFAULT_MIN_LIGHTHOUSE_PERFORMANCE,
  FORGE_DEFAULT_MIN_LIGHTHOUSE_SEO,
  FORGE_VISUAL_QA_ARTIFACT_KIND,
  buildForgeQualityBadges,
  buildForgeVisualQaArtifactContent,
  buildForgeVisualQaReport,
  evaluateForgeLighthouse,
  normalizeLighthouseScore,
  readForgeVisualQaArtifact,
  resolveForgeLighthouseThresholds,
  resolveForgeMaxConsoleErrors,
  type ForgeConsoleErrorCheck,
  type ForgeMobileCheck,
  type ForgeSmokeTest,
} from "./forge-visual-qa"

const thresholds = { performance: 50, accessibility: 90, seo: 90 }

function mobile(status: ForgeMobileCheck["status"]): ForgeMobileCheck {
  return { status, viewport: { width: 390, height: 844 }, detail: "mobile" }
}

function consoleErrors(status: ForgeConsoleErrorCheck["status"], count = 0): ForgeConsoleErrorCheck {
  return { status, count, threshold: 0, messages: count ? ["TypeError: boom"] : [] }
}

function smoke(name: string, status: ForgeSmokeTest["status"]): ForgeSmokeTest {
  return { name, status, detail: name, durationMs: 1 }
}

describe("forge visual QA engine", () => {
  it("resolves env-configurable thresholds with safe defaults", () => {
    expect(resolveForgeLighthouseThresholds({})).toEqual({
      performance: FORGE_DEFAULT_MIN_LIGHTHOUSE_PERFORMANCE,
      accessibility: FORGE_DEFAULT_MIN_LIGHTHOUSE_ACCESSIBILITY,
      seo: FORGE_DEFAULT_MIN_LIGHTHOUSE_SEO,
    })
    expect(resolveForgeLighthouseThresholds({
      FORGE_MIN_LIGHTHOUSE_PERFORMANCE: "70",
      FORGE_MIN_LIGHTHOUSE_ACCESSIBILITY: "95",
      FORGE_MIN_LIGHTHOUSE_SEO: "85",
    })).toEqual({ performance: 70, accessibility: 95, seo: 85 })
    expect(resolveForgeLighthouseThresholds({ FORGE_MIN_LIGHTHOUSE_PERFORMANCE: "999" }).performance).toBe(100)
    expect(resolveForgeMaxConsoleErrors({})).toBe(0)
    expect(resolveForgeMaxConsoleErrors({ FORGE_MAX_CONSOLE_ERRORS: "3" })).toBe(3)
    expect(resolveForgeMaxConsoleErrors({ FORGE_MAX_CONSOLE_ERRORS: "-1" })).toBe(0)
  })

  it("normalises Lighthouse scores from 0-1 or 0-100 to integers", () => {
    expect(normalizeLighthouseScore(0.92)).toBe(92)
    expect(normalizeLighthouseScore(1)).toBe(100)
    expect(normalizeLighthouseScore(87)).toBe(87)
    expect(normalizeLighthouseScore(null)).toBeNull()
    expect(normalizeLighthouseScore("bad")).toBeNull()
  })

  it("evaluates Lighthouse against thresholds and skips gracefully when unavailable", () => {
    const passing = evaluateForgeLighthouse({ performance: 80, accessibility: 95, bestPractices: 90, seo: 92 }, thresholds, true)
    expect(passing.status).toBe("passed")
    expect(passing.failing).toEqual([])

    const failing = evaluateForgeLighthouse({ performance: 30, accessibility: 80, bestPractices: 90, seo: 92 }, thresholds, true)
    expect(failing.status).toBe("failed")
    expect(failing.failing.length).toBe(2)

    const skipped = evaluateForgeLighthouse({ performance: null, accessibility: null, bestPractices: null, seo: null }, thresholds, false, "not installed")
    expect(skipped.status).toBe("skipped")
    expect(skipped.available).toBe(false)
    expect(skipped.unavailableReason).toBe("not installed")
  })

  it("builds the six dashboard badges", () => {
    const lighthouse = evaluateForgeLighthouse({ performance: 85, accessibility: 95, bestPractices: 90, seo: 91 }, thresholds, true)
    const badges = buildForgeQualityBadges({
      build: "passed",
      typecheck: "passed",
      seoScore: 80,
      seoThreshold: 70,
      lighthouse,
      mobile: mobile("passed"),
    })
    expect(badges.map((badge) => badge.key)).toEqual(["build", "typecheck", "seo", "accessibility", "performance", "mobile"])
    expect(badges.find((badge) => badge.key === "build")?.status).toBe("pass")
    expect(badges.find((badge) => badge.key === "seo")?.value).toBe("91") // lighthouse SEO preferred
    expect(badges.find((badge) => badge.key === "performance")?.status).toBe("pass")
    expect(badges.find((badge) => badge.key === "mobile")?.status).toBe("pass")
  })

  it("falls back to the SEO pack score and skips lighthouse badges when unavailable", () => {
    const skipped = evaluateForgeLighthouse({ performance: null, accessibility: null, bestPractices: null, seo: null }, thresholds, false)
    const badges = buildForgeQualityBadges({
      build: null,
      typecheck: "skipped",
      seoScore: 78,
      seoThreshold: 70,
      lighthouse: skipped,
      mobile: mobile("skipped"),
    })
    expect(badges.find((badge) => badge.key === "seo")?.status).toBe("pass")
    expect(badges.find((badge) => badge.key === "seo")?.value).toBe("78")
    expect(badges.find((badge) => badge.key === "accessibility")?.status).toBe("skipped")
    expect(badges.find((badge) => badge.key === "build")?.status).toBe("unknown")
  })

  it("assembles a passing report and an artifact", () => {
    const lighthouse = evaluateForgeLighthouse({ performance: 85, accessibility: 95, bestPractices: 90, seo: 91 }, thresholds, true)
    const report = buildForgeVisualQaReport({
      workspacePath: "generated-sites/42-acme",
      previewUrl: "http://127.0.0.1:4350",
      lighthouse,
      smokeTests: [smoke("homepage loads", "passed"), smoke("navigation works", "passed")],
      mobile: mobile("passed"),
      consoleErrors: consoleErrors("passed"),
      build: "passed",
      typecheck: "passed",
      seoScore: 88,
      seoThreshold: 70,
      logs: ["server ready"],
    })

    expect(report.status).toBe("passed")
    expect(report.badges.length).toBe(6)

    const state = readForgeVisualQaArtifact({ kind: FORGE_VISUAL_QA_ARTIFACT_KIND, report })
    expect(state.status).toBe("passed")
    expect(state.badges.length).toBe(6)
    expect(readForgeVisualQaArtifact(null).status).toBe("skipped")

    const content = buildForgeVisualQaArtifactContent(report)
    expect(content).toContain("# Lighthouse & Visual QA")
    expect(content).toContain("## Quality badges")
    expect(content).toContain("## Smoke tests")
  })

  it("fails the report on smoke failures and console errors over threshold", () => {
    const lighthouse = evaluateForgeLighthouse({ performance: 85, accessibility: 95, bestPractices: 90, seo: 91 }, thresholds, true)
    const report = buildForgeVisualQaReport({
      workspacePath: "generated-sites/42-acme",
      previewUrl: "http://127.0.0.1:4350",
      lighthouse,
      smokeTests: [smoke("homepage loads", "failed")],
      mobile: mobile("passed"),
      consoleErrors: consoleErrors("failed", 4),
      build: "passed",
      typecheck: "passed",
      seoScore: 88,
      seoThreshold: 70,
      logs: [],
    })
    expect(report.status).toBe("failed")
    expect(report.recommendations.some((item) => item.includes("homepage loads"))).toBe(true)
    expect(report.recommendations.some((item) => item.toLowerCase().includes("console"))).toBe(true)
  })

  it("marks the report skipped (not failed) when no tooling ran", () => {
    const lighthouse = evaluateForgeLighthouse({ performance: null, accessibility: null, bestPractices: null, seo: null }, thresholds, false, "not installed")
    const report = buildForgeVisualQaReport({
      workspacePath: "generated-sites/42-acme",
      previewUrl: null,
      lighthouse,
      smokeTests: [smoke("homepage loads", "skipped")],
      mobile: mobile("skipped"),
      consoleErrors: consoleErrors("skipped"),
      build: "passed",
      typecheck: "passed",
      seoScore: 88,
      seoThreshold: 70,
      logs: [],
    })
    expect(report.status).toBe("skipped")
    expect(report.recommendations.some((item) => item.includes("Install Lighthouse"))).toBe(true)
    // Build/typecheck/SEO badges still resolve from existing artifacts.
    expect(report.badges.find((badge) => badge.key === "build")?.status).toBe("pass")
    expect(report.badges.find((badge) => badge.key === "seo")?.status).toBe("pass")
  })
})
