import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { authorizeRequest } from "./rbac"

const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8")
const integration = readFileSync(new URL("./server/delivery-forge-integration.ts", import.meta.url), "utf8")
const workspace = readFileSync(new URL("../components/delivery/DeliveryProjectWorkspace.tsx", import.meta.url), "utf8")

describe("Forge remains inside the admin trust boundary", () => {
  it("requires an Auth.js admin identity before any Forge route or API authorization", () => {
    expect(middleware).toContain("if (!req.auth)")
    expect(middleware).toContain('pathname.startsWith("/api/")')
    expect(middleware).toContain("findAdminUserById")
    expect(middleware).not.toContain("ss-client-session")
  })
  it("denies Forge mutations to read-only admin roles", () => {
    for (const request of [{ pathname: "/api/forge/projects/1/runs", method: "POST" }, { pathname: "/api/forge/projects/1/deploy", method: "POST" }, { pathname: "/api/forge/runs/1/start", method: "POST" }]) expect(authorizeRequest("viewer", request).allowed).toBe(false)
  })
  it("publishes fixed sanitised language instead of internal event detail", () => {
    expect(integration).toContain("sanitiseInternalDeliveryEvent(event)")
    expect(integration).toContain('visibility: "client_visible"')
    expect(integration).not.toMatch(/forgeAiUsage|forgeArtifacts|promptTokens|providerAttempted|failureMessage/)
  })
  it("keeps manual delivery fully supported without Forge", () => {
    expect(integration).toContain('reason: "unlinked"')
    expect(workspace).toContain("Manual delivery project. No Forge engine is linked or required.")
  })
})
