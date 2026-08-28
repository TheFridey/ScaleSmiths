import { describe, expect, it } from "vitest"
import { CLIENT_SERVICE_TIERS, CLIENT_STATUSES, isClientServiceTier, isClientStatus, parseClientDomainFields } from "./clients"

describe("client domain definitions", () => {
  it("retains the persisted client values", () => {
    expect(CLIENT_STATUSES).toEqual(["active", "build", "review", "prospect", "archived"])
    expect(CLIENT_SERVICE_TIERS).toEqual(["Foundation", "Growth Partner", "Ecosystem", "Maintenance", "Forge Build", "Retainer"])
  })

  it("rejects invalid status and tier values", () => {
    expect(isClientStatus("deleted")).toBe(false)
    expect(isClientServiceTier("Enterprise")).toBe(false)
    expect(parseClientDomainFields({ status: "deleted", tier: "Foundation" })).toEqual({ ok: false, error: "Select a valid client status." })
    expect(parseClientDomainFields({ status: "active", tier: "Enterprise" })).toEqual({ ok: false, error: "Select a valid client service tier." })
  })
})
