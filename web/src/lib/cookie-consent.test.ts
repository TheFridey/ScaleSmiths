import { describe, expect, it } from "vitest"
import { COOKIE_POLICY_VERSION, readCookiePreferences, storageInventory } from "./cookie-consent"

describe("cookie consent", () => {
  it("fails closed without a current explicit choice", () => {
    expect(readCookiePreferences(undefined)).toBeNull()
    expect(readCookiePreferences("ss_cookie_consent=invalid")).toBeNull()
  })

  it("parses a current anonymous category choice", () => {
    const value = encodeURIComponent(JSON.stringify({ version: COOKIE_POLICY_VERSION, functional: true, analytics: false, marketing: false, decidedAt: "2026-08-14T00:00:00.000Z" }))
    expect(readCookiePreferences(`other=1; ss_cookie_consent=${value}`)).toMatchObject({ functional: true, analytics: false, marketing: false })
  })

  it("documents only evidenced storage", () => {
    expect(storageInventory.some((item) => item.name === "ss-client-session")).toBe(true)
    expect(JSON.stringify(storageInventory)).not.toMatch(/google analytics|meta pixel|tiktok/i)
  })
})
