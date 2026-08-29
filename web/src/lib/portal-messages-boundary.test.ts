import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

describe("portal messages boundary", () => {
  const route = readFileSync(new URL("../app/portal/api/messages/route.ts", import.meta.url), "utf8")

  it("requires an authenticated portal session before writing anything", () => {
    expect(route).toContain("getClientSessionFromRequest")
    expect(route).toContain("unauthorizedClientPortalResponse")
  })

  it("scopes the thread to the authenticated session's client id, never a request-supplied one", () => {
    expect(route).toContain("resolveGeneralMessageThreadId(session.clientId")
    expect(route).toContain("appendClientMessage(session.clientId")
  })

  it("rate-limits before writing", () => {
    expect(route).toContain("checkWebRateLimit")
    expect(route).toContain("portalRequestMessage")
  })
})
