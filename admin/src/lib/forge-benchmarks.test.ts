import { describe, expect, it } from "vitest"
import {
  FORGE_BENCHMARK_FIXTURE_IDS,
  FORGE_BENCHMARK_FIXTURES,
  createOfflineBenchmarkCandidate,
  evaluateForgeBenchmarkCandidate,
  runOfflineForgeBenchmark,
  type ForgeBenchmarkResult,
} from "./forge-benchmarks"

describe("Forge benchmark suite", () => {
  it("defines every required benchmark fixture with reviewable ground truth", () => {
    expect(FORGE_BENCHMARK_FIXTURES.map((fixture) => fixture.id)).toEqual([...FORGE_BENCHMARK_FIXTURE_IDS])
    expect(FORGE_BENCHMARK_FIXTURES).toHaveLength(10)

    for (const fixture of FORGE_BENCHMARK_FIXTURES) {
      expect(Object.keys(fixture.groundTruthFacts).length, fixture.id).toBeGreaterThan(0)
      expect(fixture.requiredPages.length, fixture.id).toBeGreaterThan(0)
      expect(fixture.requiredServices.length, fixture.id).toBeGreaterThan(0)
      expect(fixture.prohibitedInventedClaims.length, fixture.id).toBeGreaterThan(0)
      expect(fixture.requiredTrustSignals.length, fixture.id).toBeGreaterThan(0)
      expect(fixture.primaryConversionGoal, fixture.id).toBeTruthy()
      expect(fixture.designConstraints.length, fixture.id).toBeGreaterThan(0)
      expect(fixture.qualityRubric.length, fixture.id).toBeGreaterThan(0)
      expect(fixture.expectedClarificationQuestions.length, fixture.id).toBeGreaterThan(0)
    }
  })

  it("runs a deterministic offline report without paid provider usage", () => {
    const report = runOfflineForgeBenchmark(undefined, new Date("2026-07-12T12:00:00.000Z"))

    expect(report.mode).toBe("offline")
    expect(report.generatedAt).toBe("2026-07-12T12:00:00.000Z")
    expect(report.fixtureCount).toBe(10)
    expect(report.schemaPassRate).toBe(1)
    expect(report.totalCostUsd).toBeNull()
    expect(report.retryCount).toBe(0)
    expect(report.fallbackRate).toBe(1)
    expect(report.results.every((result) => result.provider === "mock")).toBe(true)
  })

  it("flags prohibited claims and lowers scores", () => {
    const fixture = FORGE_BENCHMARK_FIXTURES.find((candidate) => candidate.id === "electrician")
    expect(fixture).toBeDefined()
    const candidate = createOfflineBenchmarkCandidate(fixture!)
    candidate.output.claims = [...candidate.output.claims, "We provide guaranteed same-day electrical work."]

    const result = evaluateForgeBenchmarkCandidate(fixture!, candidate)

    expect(result.findings.some((finding) => finding.includes("Invented prohibited claims"))).toBe(true)
    expect(result.consistencyScore).toBeLessThan(100)
    expect(result.contentQuality).toBeLessThan(100)
  })

  it("detects regression against an earlier prompt, schema or model baseline", () => {
    const fixture = FORGE_BENCHMARK_FIXTURES[0]
    const candidate = createOfflineBenchmarkCandidate(fixture)
    candidate.output.services = []
    candidate.promptVersion = "offline-fixture-v2"
    candidate.model = "deterministic-benchmark-v2"
    const baseline: ForgeBenchmarkResult = {
      ...evaluateForgeBenchmarkCandidate(fixture, createOfflineBenchmarkCandidate(fixture)),
      promptVersion: "offline-fixture-v1",
      schemaVersion: "forge.benchmark-output@1.0.0",
      model: "deterministic-benchmark-v1",
      consistencyScore: 100,
      contentQuality: 100,
    }

    const result = evaluateForgeBenchmarkCandidate(fixture, candidate, baseline)

    expect(result.regression.promptChanged).toBe(true)
    expect(result.regression.modelChanged).toBe(true)
    expect(result.regression.scoreDelta).toBeLessThan(0)
    expect(result.regression.regressed).toBe(true)
  })
})
