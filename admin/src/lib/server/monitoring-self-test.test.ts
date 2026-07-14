import { describe, expect, it } from "vitest"
import { isValidMonitoringSelfTestToken } from "./monitoring-self-test"

describe("admin monitoring self-test token", () => {
  it("requires an exact operator token of at least 32 characters", () => {
    const expected = "a".repeat(32)
    expect(isValidMonitoringSelfTestToken(expected, expected)).toBe(true)
    expect(isValidMonitoringSelfTestToken("b".repeat(32), expected)).toBe(false)
    expect(isValidMonitoringSelfTestToken("short", "short")).toBe(false)
  })
})
