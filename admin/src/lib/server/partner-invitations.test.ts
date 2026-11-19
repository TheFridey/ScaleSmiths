import { describe, expect, it } from "vitest"
import { invitationHash, validateActivationCredential } from "./partner-invitations"

describe("partner invitation credential boundary", () => {
  const token = "A".repeat(43)
  it("hashes invitation credentials without storing plaintext", () => {
    expect(invitationHash(token)).toMatch(/^[0-9a-f]{64}$/)
    expect(invitationHash(token)).not.toContain(token)
    expect(invitationHash(token)).toBe(invitationHash(token))
    expect(invitationHash("B".repeat(43))).not.toBe(invitationHash(token))
  })
  it("rejects malformed token and short or bcrypt-truncated passwords", () => {
    for (const invalid of [undefined, null, "", "A".repeat(42), "A".repeat(44), "!".repeat(43)]) expect(() => validateActivationCredential(invalid, "long-secure-password")).toThrow("Invitation")
    for (const invalid of [undefined, "short", "a".repeat(73), "£".repeat(37)]) expect(() => validateActivationCredential(token, invalid)).toThrow("password")
    expect(validateActivationCredential(token, "£".repeat(36))).toEqual({ token, password: "£".repeat(36) })
  })
})
