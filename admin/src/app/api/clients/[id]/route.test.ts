import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

describe("client update route", () => {
  const source = readFileSync(new URL("./route.ts", import.meta.url), "utf8")

  it("requires client write access and cannot change protected identifiers", () => {
    expect(source).toContain('guardApiCapability("clients.write")')
    expect(source).toContain("contactName: optionalString(body.contactName)")
    expect(source).not.toContain("portalClientId:")
    expect(source).not.toContain("invoiceClientCode:")
  })
})
