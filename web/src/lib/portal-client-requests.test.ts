import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { isTerminalRequestStatus } from "./client-requests"

describe("isTerminalRequestStatus", () => {
  it("treats completed and cancelled as terminal", () => {
    expect(isTerminalRequestStatus("completed")).toBe(true)
    expect(isTerminalRequestStatus("cancelled")).toBe(true)
  })

  it("treats every other status as non-terminal", () => {
    expect(isTerminalRequestStatus("new")).toBe(false)
    expect(isTerminalRequestStatus("triaged")).toBe(false)
    expect(isTerminalRequestStatus("in_progress")).toBe(false)
    expect(isTerminalRequestStatus("waiting_client")).toBe(false)
  })
})

describe("portal general message thread scoping", () => {
  const source = readFileSync(new URL("./portal-client-requests.ts", import.meta.url), "utf8")

  it("scopes the general message thread by both category and the reserved title, not category alone", () => {
    expect(source.match(/eq\(clientRequests\.title, "Portal messages"\)/g)?.length).toBeGreaterThanOrEqual(2)
  })

  it("scopes getPortalGeneralMessageThread by the authenticated portal client id", () => {
    expect(source).toContain("eq(clientRequests.clientId, portalClientId)")
  })

  it("never selects internal-only fields into the portal projection", () => {
    for (const forbidden of [
      "internalNotes",
      "forgeSummary",
      "forgeSuggestedActions",
      "forgeSuggestedReply",
      "adminLastReadAt",
    ]) {
      expect(source).not.toContain(forbidden)
    }
  })
})
