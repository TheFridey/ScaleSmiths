import { describe, expect, it } from "vitest"
import { healthPayload, isValidHealthToken } from "./health"

describe("admin health checks", () => {
  const token = "a-secure-health-token-with-at-least-32-characters"

  it("requires an exact sufficiently long configured token", () => {
    expect(isValidHealthToken(token, token)).toBe(true)
    expect(isValidHealthToken(`${token}x`, token)).toBe(false)
    expect(isValidHealthToken(null, token)).toBe(false)
    expect(isValidHealthToken("short", "short")).toBe(false)
  })

  it("does not expose secrets or dependency details", () => {
    expect(healthPayload()).toMatchObject({ status: "ok", service: "scalesmiths-admin" })
    expect(JSON.stringify(healthPayload())).not.toMatch(/token|password|database/i)
  })
})
