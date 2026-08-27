import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

describe("portal client profile", () => {
  it("resolves portal identity through the explicit client association", () => {
    const source = readFileSync(new URL("./portal-client-profile.ts", import.meta.url), "utf8")

    expect(source).toContain("eq(invoicePortalClients.portalClientId, portalClientId)")
    expect(source).toContain("companyName: invoicePortalClients.name")
    expect(source).toContain("contactName: invoicePortalClients.contactName")
    expect(source).toContain("portalName: `${companyName} Portal`")
  })
})
