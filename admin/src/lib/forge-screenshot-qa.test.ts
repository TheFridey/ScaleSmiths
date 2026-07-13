import { describe, expect, it } from "vitest"
import { compareVisualRuns, evaluateDeterministicVisualSignals, proposeVisualRepairTasks, type ForgeLayoutSignal } from "./forge-screenshot-qa"
const signal = (overrides: Partial<ForgeLayoutSignal> = {}): ForgeLayoutSignal => ({ route: "/", viewport: "mobile", documentWidth: 390, viewportWidth: 390, hiddenTextCount: 0, clippedCount: 0, lowContrastCount: 0, smallTextCount: 0, weakCtaCount: 0, missingHeader: false, missingFooter: false, layoutShift: 0, animatedHiddenCount: 0, ...overrides })
describe("screenshot visual QA", () => {
  it("returns advisory findings and non-deploying repair proposals", () => { const findings = evaluateDeterministicVisualSignals([signal({ documentWidth: 430, lowContrastCount: 2, layoutShift: .2 })], []); expect(findings.map((f) => f.category)).toEqual(["overflow", "low_contrast", "layout_shift"]); expect(findings.every((f) => f.advisory && f.approvalRequired && !f.blocking)).toBe(true); expect(proposeVisualRepairTasks(findings).every((r) => r.approvalRequired && !r.deployAutomatically && r.status === "proposed")).toBe(true) })
  it("compares before and after deterministic signals", () => { expect(compareVisualRuns([signal({ clippedCount: 3 })], [signal()])).toMatchObject({ outcome: "improved", delta: -3 }) })
})
