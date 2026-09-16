import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

describe("portal messages boundary", () => {
  const route = readFileSync(new URL("../app/portal/api/messages/route.ts", import.meta.url), "utf8")
  const panel = readFileSync(new URL("../components/portal/PortalMessagesPanel.tsx", import.meta.url), "utf8")
  const portalPage = readFileSync(new URL("../app/portal/[clientId]/page.tsx", import.meta.url), "utf8")

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

  it("never lets a notification failure prevent the success response from reaching the client", () => {
    expect(route).toContain(".catch(() => undefined)")
  })

  it("routes new messages into the request-thread APIs and keeps mailto as a failure fallback only", () => {
    expect(panel).toContain("/portal/api/messages")
    expect(panel).toContain("/portal/api/requests/${thread.id}")
    expect(panel).toContain("showFallback")
    expect(panel).not.toMatch(/no live history/i)
    expect(panel).not.toMatch(/message history will appear/i)
  })

  it("resets the messages panel when the selected thread changes", () => {
    expect(portalPage).toContain('key={selectedId ?? "new"}')
    expect(panel).toContain("selectedRequestId")
  })
})
