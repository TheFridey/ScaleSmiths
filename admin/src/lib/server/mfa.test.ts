import { describe, expect, it } from "vitest"
import { buildOtpAuthUri, consumeRecoveryCode, decryptMfaSecret, encryptMfaSecret, generateTotp, hashRecoveryCode, isMfaRequired, verifyTotp } from "./mfa"

const env = { NODE_ENV: "test", AUTH_SECRET: "test-auth-secret" } as NodeJS.ProcessEnv

describe("TOTP MFA", () => {
  it("matches the RFC 6238 SHA-1 test vector", () => {
    expect(generateTotp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 59_000, 30, 8)).toBe("94287082")
  })

  it("accepts current-window codes and rejects malformed values", () => {
    const secret = "JBSWY3DPEHPK3PXP"
    const now = 1_700_000_000_000
    expect(verifyTotp(secret, generateTotp(secret, now), now)).toBe(true)
    expect(verifyTotp(secret, "not-a-code", now)).toBe(false)
  })

  it("encrypts secrets with authenticated encryption", () => {
    const encrypted = encryptMfaSecret("JBSWY3DPEHPK3PXP", env)
    expect(encrypted).not.toContain("JBSWY3DPEHPK3PXP")
    expect(decryptMfaSecret(encrypted, env)).toBe("JBSWY3DPEHPK3PXP")
    const parts = encrypted.split(".")
    const tampered = Buffer.from(parts[3], "base64url")
    tampered[0] ^= 1
    expect(() => decryptMfaSecret([parts[0], parts[1], parts[2], tampered.toString("base64url")].join("."), env)).toThrow()
  })

  it("hashes and consumes each recovery code once", () => {
    const stored = [hashRecoveryCode("ABCD-EF12"), hashRecoveryCode("9876-5432")]
    const consumed = consumeRecoveryCode("abcd ef12", stored)
    expect(consumed.valid).toBe(true)
    expect(consumed.remaining).toHaveLength(1)
    expect(consumeRecoveryCode("ABCD-EF12", consumed.remaining).valid).toBe(false)
  })

  it("requires privileged production MFA after the bootstrap grace period", () => {
    expect(isMfaRequired("owner", { NODE_ENV: "production" } as NodeJS.ProcessEnv, 100)).toBe(true)
    expect(isMfaRequired("administrator", { NODE_ENV: "production", ADMIN_MFA_BOOTSTRAP_GRACE_UNTIL: new Date(200).toISOString() } as NodeJS.ProcessEnv, 100)).toBe(false)
    expect(isMfaRequired("developer", { NODE_ENV: "production" } as NodeJS.ProcessEnv, 100)).toBe(false)
  })

  it("builds a standards-compatible manual authenticator URI", () => {
    expect(buildOtpAuthUri({ secret: "ABC", email: "owner@example.com", issuer: "ScaleSmiths" })).toContain("otpauth://totp/")
  })
})
