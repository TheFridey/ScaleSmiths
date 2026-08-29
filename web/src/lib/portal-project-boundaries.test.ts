import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

describe("portal delivery boundary", () => {
  it("scopes projects through the explicit portal client association", () => {
    const source = readFileSync(new URL("./portal-projects.ts", import.meta.url), "utf8")
    expect(source).toContain("invoicePortalClients.portalClientId")
    expect(source).toContain("portalDeliveryProjects.clientId")
    expect(source).toContain("portalDeliveryProjects.clientVisible")
    expect(source).not.toContain("internalNotes")
    expect(source).not.toContain("ownerUserId")
  })
})
