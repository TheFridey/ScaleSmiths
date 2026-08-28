import { describe, expect, it } from "vitest"
import { FORGE_PROJECT_STATES, FORGE_TASK_STATES, assertArtifactApproval, decideProjectTransition, decideTaskTransition, isForgeProjectState, isForgeTaskState } from "./forge-state-machine"

const facts = { sitemapApproved: true, buildExists: true, qaPassed: true, artifactCurrent: true, failedPrerequisite: false }
describe("Forge project state machine", () => {
  it("rejects unknown persisted project and task states", () => {
    expect(isForgeProjectState("published")).toBe(false)
    expect(isForgeTaskState("paused")).toBe(false)
  })
  it("returns a decision for every possible state pair", () => {
    for (const from of FORGE_PROJECT_STATES) for (const to of FORGE_PROJECT_STATES) expect(decideProjectTransition({ from, to, facts })).toHaveProperty("allowed")
  })
  it("blocks missing prerequisites", () => {
    expect(decideProjectTransition({ from: "design", to: "build", facts: { ...facts, sitemapApproved: false } })).toMatchObject({ allowed: false, code: "sitemap_not_approved" })
    expect(decideProjectTransition({ from: "build", to: "qa", facts: { ...facts, buildExists: false } })).toMatchObject({ allowed: false, code: "build_missing" })
    expect(decideProjectTransition({ from: "preview", to: "ready_to_deploy", facts: { ...facts, qaPassed: false } })).toMatchObject({ allowed: false, code: "qa_not_passed" })
  })
  it("allows only privileged, reasoned, non-terminal overrides", () => {
    expect(decideProjectTransition({ from: "intake", to: "build", facts: {}, override: true, actorRole: "developer", reason: "Urgent reviewed exception" }).allowed).toBe(false)
    expect(decideProjectTransition({ from: "intake", to: "build", facts: {}, override: true, actorRole: "owner", reason: "Approved prototype exception" })).toEqual({ allowed: true, overridden: true })
    expect(decideProjectTransition({ from: "deployed", to: "build", facts, override: true, actorRole: "owner", reason: "Reopen deployed project" }).allowed).toBe(false)
  })
  it("rejects obsolete artifact approval", () => expect(assertArtifactApproval({ artifactCurrent: false })).toMatchObject({ allowed: false, code: "obsolete_artifact" }))
})
describe("Forge task state machine", () => {
  it("exhaustively decides every transition and preserves terminal completion", () => {
    for (const from of FORGE_TASK_STATES) for (const to of FORGE_TASK_STATES) expect(decideTaskTransition({ from, to })).toHaveProperty("allowed")
    expect(decideTaskTransition({ from: "completed", to: "running", override: true, actorRole: "owner", reason: "Try to reopen completion" }).allowed).toBe(false)
    expect(decideTaskTransition({ from: "failed", to: "queued" }).allowed).toBe(true)
  })
})
