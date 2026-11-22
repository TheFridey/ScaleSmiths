import { describe, expect, it } from "vitest"
import { confirmedStatusFrom, displayedStatus, previewDecisionFor } from "./forge-preview-decision"

describe("previewDecisionFor", () => {
  it("offers internal approval from preview and client approval from client review, and nothing elsewhere", () => {
    expect(previewDecisionFor("preview")).toMatchObject({ nextStatus: "client_review", approvalScope: "internal", label: "Internally approve preview" })
    expect(previewDecisionFor("client_review")).toMatchObject({ nextStatus: "ready_to_deploy", approvalScope: "client", label: "Record client approval" })
    for (const status of ["intake", "qa", "ready_to_deploy", "deployed", "archived", ""]) expect(previewDecisionFor(status)).toBeNull()
  })
})

describe("confirmedStatusFrom", () => {
  it("reads only a recognised status from the server's response", () => {
    expect(confirmedStatusFrom({ ok: true, project: { id: 7, status: "client_review" } })).toBe("client_review")
    for (const body of [null, undefined, "client_review", {}, { ok: true }, { project: null }, { project: { status: "approved" } }, { project: { status: 3 } }, { error: "Forge rate limit exceeded." }]) {
      expect(confirmedStatusFrom(body)).toBeNull()
    }
  })
})

describe("displayedStatus", () => {
  it("shows a server confirmation immediately, before the page has re-rendered", () => {
    const props = { id: 7, status: "preview" }
    expect(displayedStatus(props, null)).toBe("preview")
    expect(displayedStatus(props, { basedOn: props, status: "client_review" })).toBe("client_review")
  })
  it("defers to the next server render, including a change someone else made in the meantime", () => {
    const before = { id: 7, status: "preview" }
    const confirmed = { basedOn: before, status: "client_review" as const }
    // Each later server render is a new props object.
    const refreshed = { id: 7, status: "client_review" }, revertedElsewhere = { id: 7, status: "preview" }, archivedElsewhere = { id: 7, status: "archived" }
    expect(displayedStatus(refreshed, confirmed)).toBe("client_review")
    expect(displayedStatus(revertedElsewhere, confirmed)).toBe("preview")
    expect(displayedStatus(archivedElsewhere, confirmed)).toBe("archived")
  })
})
