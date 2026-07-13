import { describe, expect, it } from "vitest"
import { createForgeRepairLoop, evaluateForgeRepairAttempt, hashForgeRepairSnapshot, type ForgeRepairAttemptRecord } from "./forge-repair-loop"

const state = () => createForgeRepairLoop({ originalFailureIds: ["typecheck"], allowedFiles: ["src/a.ts"], limits: { maximumAttempts: 3, maximumCost: 2, maximumRuntimeMs: 1000, minimumConfidence: .7 }, escalationRule: "Escalate to a developer." })
const attempt = (overrides: Partial<ForgeRepairAttemptRecord> = {}): ForgeRepairAttemptRecord => ({ attempt: 1, category: "typescript", failureClassification: "compiler", before: { failureIds: ["typecheck"], summary: "failed", output: "TS1", snapshotHash: "before" }, after: { failureIds: [], summary: "passed", output: "ok", snapshotHash: "after" }, changedFiles: ["src/a.ts"], validationOutput: "ok", confidence: .9, cost: .1, durationMs: 100, status: "applied", ...overrides })

describe("Forge repair-loop engine", () => {
  it("only succeeds after the original failure is revalidated", () => expect(evaluateForgeRepairAttempt(state(), attempt()).stopReason).toBe("success"))
  it("rejects unrelated changes", () => expect(evaluateForgeRepairAttempt(state(), attempt({ changedFiles: ["src/unrelated.ts"] })).stopReason).toBe("unrelated_change"))
  it("stops on insufficient confidence and limits", () => {
    expect(evaluateForgeRepairAttempt(state(), attempt({ confidence: .2 })).stopReason).toBe("insufficient_confidence")
    expect(evaluateForgeRepairAttempt(state(), attempt({ cost: 3 })).stopReason).toBe("maximum_cost")
    expect(evaluateForgeRepairAttempt(state(), attempt({ durationMs: 1001 })).stopReason).toBe("maximum_runtime")
  })
  it("detects circular snapshots", () => {
    const first = evaluateForgeRepairAttempt(state(), attempt({ after: { failureIds: ["typecheck"], summary: "still failing", output: "x", snapshotHash: "cycle" }, status: "failed" }))
    expect(evaluateForgeRepairAttempt(first, attempt({ attempt: 2, after: { failureIds: ["typecheck-2"], summary: "different failure", output: "y", snapshotHash: "cycle" } })).stopReason).toBe("circular_repair")
  })
  it("detects recreated earlier failures", () => {
    const first = evaluateForgeRepairAttempt(state(), attempt({ after: { failureIds: ["eslint"], summary: "new", output: "x", snapshotHash: "one" }, status: "failed" }))
    expect(evaluateForgeRepairAttempt(first, attempt({ attempt: 2, after: { failureIds: ["typecheck"], summary: "original returned", output: "y", snapshotHash: "two" } })).stopReason).toBe("recreated_failure")
  })
  it("produces stable snapshot hashes", () => expect(hashForgeRepairSnapshot("same")).toBe(hashForgeRepairSnapshot("same")))
})
