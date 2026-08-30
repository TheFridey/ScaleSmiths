import { describe, expect, it } from "vitest"
import { hashPortalActivationToken, isAcceptablePortalPassword } from "./portal-activation"

describe("portal activation credentials", () => {
  it("hashes tokens deterministically without retaining plaintext", () => {
    const hash = hashPortalActivationToken("a".repeat(43))
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
    expect(hash).not.toContain("a".repeat(12))
  })

  it("requires a long mixed-character password", () => {
    expect(isAcceptablePortalPassword("weakpassword")).toBe(false)
    expect(isAcceptablePortalPassword("Strong-portal7!" )).toBe(true)
  })
})
