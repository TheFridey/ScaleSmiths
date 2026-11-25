import { describe, expect, it } from "vitest"
import { MFA_PRIVILEGED_ROLES as CLIENT_PRIVILEGED_ROLES } from "@/lib/admin-users"
import { MFA_PRIVILEGED_ROLES, decideUnconfiguredMfaSignIn, isMfaEnrolmentRoute, issueMfaEnrolment, MFA_ENROLMENT_WINDOW_MS, readMfaEnrolment, requiresMfaEnrolment } from "./mfa"

// B2.11 hotfix: a privileged account without active MFA could neither sign in (MFA mandatory) nor enrol (enrolment needs a
// session). These pin the first-login enrolment decisions; the browser spec b2-11-admin-mfa-enrolment proves them end to end.
const prod = { NODE_ENV: "production" } as NodeJS.ProcessEnv
const now = Date.parse("2026-11-25T16:00:00Z")
const issued = issueMfaEnrolment("owner-1", new Date(now))

describe("MFA enrolment allowance", () => {
  it("is issued for exactly 72 hours and records who issued it", () => {
    expect(MFA_ENROLMENT_WINDOW_MS).toBe(72 * 60 * 60 * 1000)
    expect(issued.enrolment).toEqual({ issuedAt: "2026-11-25T16:00:00.000Z", expiresAt: "2026-11-28T16:00:00.000Z", issuedBy: "owner-1" })
    expect(readMfaEnrolment(issued)).toEqual(issued.enrolment)
  })

  it("is not read from malformed or absent state", () => {
    expect(readMfaEnrolment(null)).toBeNull()
    expect(readMfaEnrolment({})).toBeNull()
    expect(readMfaEnrolment({ enrolment: { issuedAt: "x", expiresAt: "not a date" } })).toBeNull()
    expect(readMfaEnrolment({ enrolment: "yes" })).toBeNull()
  })
})

describe("first-login sign-in decision (after a correct password)", () => {
  const admin = (mfaState: Record<string, unknown> | null, mfaEnabled = false) => ({ role: "administrator" as const, mfaEnabled, mfaState })

  it("new administrator with a current allowance gets an enrolment-only session", () => {
    expect(decideUnconfiguredMfaSignIn(admin(issued), prod, now)).toBe("enrolment_allowed")
    expect(decideUnconfiguredMfaSignIn({ ...admin(issued), role: "owner" }, prod, now)).toBe("enrolment_allowed")
  })

  it("keeps the allowance through an abandoned pending setup", () => {
    expect(decideUnconfiguredMfaSignIn(admin({ version: 1, status: "pending", encryptedSecret: "x", recoveryCodeHashes: [], ...issued }), prod, now)).toBe("enrolment_allowed")
  })

  it("MFA invalidated by the old code (no allowance) stays locked out until an owner resets MFA again", () => {
    expect(decideUnconfiguredMfaSignIn(admin(null), prod, now)).toBe("no_enrolment_allowance")
  })

  it("rejects an expired allowance", () => {
    expect(decideUnconfiguredMfaSignIn(admin(issued), prod, now + MFA_ENROLMENT_WINDOW_MS)).toBe("enrolment_allowance_expired")
    expect(decideUnconfiguredMfaSignIn(admin(issued), prod, now + MFA_ENROLMENT_WINDOW_MS - 1)).toBe("enrolment_allowed")
  })

  it("does not apply to roles without mandatory MFA or outside production", () => {
    expect(decideUnconfiguredMfaSignIn({ role: "developer", mfaEnabled: false, mfaState: null }, prod, now)).toBe("not_required")
    expect(decideUnconfiguredMfaSignIn(admin(null), { NODE_ENV: "test" } as NodeJS.ProcessEnv, now)).toBe("not_required")
  })
})

describe("enrolment-only session restriction", () => {
  it("applies to privileged users without active MFA and never to a returning administrator with MFA", () => {
    expect(requiresMfaEnrolment({ role: "administrator", mfaEnabled: false }, prod, now)).toBe(true)
    expect(requiresMfaEnrolment({ role: "administrator", mfaEnabled: true }, prod, now)).toBe(false)
    expect(requiresMfaEnrolment({ role: "developer", mfaEnabled: false }, prod, now)).toBe(false)
  })

  it("admits only MFA setup, its API and nothing else", () => {
    expect(isMfaEnrolmentRoute("/security", "GET")).toBe(true)
    expect(isMfaEnrolmentRoute("/api/security/mfa", "GET")).toBe(true)
    expect(isMfaEnrolmentRoute("/api/security/mfa", "POST")).toBe(true)
    for (const [path, method] of [["/security", "POST"], ["/api/security/mfa", "DELETE"], ["/dashboard", "GET"], ["/command-centre", "GET"],
      ["/api/admin-users", "GET"], ["/api/admin-users/x", "PATCH"], ["/expansion", "GET"], ["/security/other", "GET"], ["/api/security/mfa/x", "POST"]] as const) {
      expect(isMfaEnrolmentRoute(path, method), `${method} ${path}`).toBe(false)
    }
  })
})

describe("privileged role list", () => {
  it("is identical on the server and in the client-safe users module", () => {
    expect([...MFA_PRIVILEGED_ROLES].sort()).toEqual([...CLIENT_PRIVILEGED_ROLES].sort())
  })
})

describe("seed-script compatibility", () => {
  // scripts/seed-empower-browser.mjs and seed-expansion-demo.mjs import mfa.ts with plain Node, which cannot resolve "@/" value
  // imports. A value import through the alias broke CI seeding once; this fails fast instead.
  it("loads under plain Node with only built-in value imports", async () => {
    const { spawnSync } = await import("node:child_process")
    const { pathToFileURL } = await import("node:url")
    const { join } = await import("node:path")
    const url = pathToFileURL(join(__dirname, "mfa.ts")).href
    const run = spawnSync(process.execPath, ["--input-type=module", "-e", `const m = await import(${JSON.stringify(url)}); if (typeof m.generateTotp !== "function") process.exit(2)`], { encoding: "utf8" })
    expect(run.status, run.stderr).toBe(0)
  })
})
