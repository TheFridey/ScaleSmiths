import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

describe("portal request message boundary", () => {
  const route = readFileSync(new URL("../app/portal/api/requests/[id]/route.ts", import.meta.url), "utf8")

  it("requires an authenticated portal session before writing anything", () => {
    expect(route).toContain("getClientSessionFromRequest")
    expect(route).toContain("unauthorizedClientPortalResponse")
  })

  it("rate-limits before writing", () => {
    expect(route).toContain("checkWebRateLimit")
    expect(route).toContain("\"portalRequestMessage\"")
  })

  it("sends a notification for the newly created message", () => {
    expect(route).toContain("sendClientRequestMessageNotification")
  })

  it("never lets a notification failure prevent the success response from reaching the client", () => {
    expect(route).toContain(".catch(() => undefined)")
  })
})
