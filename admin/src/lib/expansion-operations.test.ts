import { describe, expect, it } from "vitest"
import { isTimeZone, isToolkitKey, MEETING_TRANSITIONS, TOOLKIT_CATALOGUE } from "./expansion-operations"
describe("operations catalogue", () => {
  it("lists every toolkit item once and assumes none is available", () => {
    expect(new Set(TOOLKIT_CATALOGUE.map(i => i.key)).size).toBe(TOOLKIT_CATALOGUE.length)
    expect(TOOLKIT_CATALOGUE.every(i => !i.builtIn)).toBe(true)   // nothing is assumed available
    expect(isToolkitKey("email")).toBe(true); expect(isToolkitKey("sms")).toBe(false)
  })
  it("validates time zones and has no transition out of closed states", () => {
    expect(isTimeZone("Europe/London")).toBe(true); expect(isTimeZone("Mars/Olympus")).toBe(false); expect(isTimeZone(5)).toBe(false)
    for (const closed of ["declined", "cancelled", "completed"]) expect(MEETING_TRANSITIONS[closed]).toBeUndefined()
  })
})
