import { describe, expect, it } from "vitest"
import { normalizePortalEmail, PortalUserError, validateClientId, validatePortalEmail } from "./portal-users"

describe("portal user validation", () => {
  it("normalizes and validates portal emails", () => {
    expect(normalizePortalEmail(" Client@Example.COM ")).toBe("client@example.com")
    expect(validatePortalEmail("client@example.com")).toBe("client@example.com")
    expect(() => validatePortalEmail("invalid")).toThrow(PortalUserError)
  })

  it("requires a positive integer client id", () => {
    expect(validateClientId("42")).toBe(42)
    expect(() => validateClientId("0")).toThrow("valid client")
    expect(() => validateClientId("1.5")).toThrow("valid client")
  })
})
