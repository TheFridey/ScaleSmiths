import { describe, expect, it } from "vitest"
import { marketGate, matchExclusivity, normaliseCountry } from "./expansion-gates"

const ex = { clientId: 7, sector: "Plumbing & Heating", area: "Nottingham" }
describe("exclusivity matching is conservative", () => {
  it("restricts the same sector in an equal or nested area", () => {
    expect(matchExclusivity({ sector: "plumbing and heating", area: "NOTTINGHAM" }, ex)).toBe("restricted")
    expect(matchExclusivity({ sector: "Plumbing & Heating", area: "Greater Nottingham" }, ex)).toBe("restricted")
    expect(matchExclusivity({ sector: "Plumbing & Heating", area: "Nottingham" }, { ...ex, area: "Nottingham city centre" })).toBe("restricted")
  })
  it("requires review where matching is uncertain", () => {
    expect(matchExclusivity({ sector: "Plumbing & Heating", area: "" }, ex)).toBe("review")
    expect(matchExclusivity({ sector: null, area: "Derby" }, ex)).toBe("review")
  })
  it("treats ampersands and the word and as the same", () => {
    expect(matchExclusivity({ sector: "Plumbing and Heating", area: "Nottingham" }, ex)).toBe("restricted")
  })
  it("sends similar sectors and overlapping areas to review instead of clearing them", () => {
    const dental = { clientId: 9, sector: "Dental", area: "Greater Manchester" }
    expect(matchExclusivity({ sector: "Dental clinic", area: "Manchester, UK" }, dental)).toBe("review")
    expect(matchExclusivity({ sector: "Dentistry", area: "Greater Manchester" }, dental)).toBe("review")
    expect(matchExclusivity({ sector: "Dental", area: "Manchester city" }, dental)).toBe("review")
    expect(matchExclusivity({ sector: "Dental", area: "Salford and Manchester" }, dental)).toBe("review")
    expect(matchExclusivity({ sector: "Dental", area: "Greater Manchester area" }, dental)).toBe("restricted")
  })
  it("sends uncomparable records to review rather than clearing them", () => {
    expect(matchExclusivity({ sector: "Dental", area: "Leeds" }, { clientId: 9, sector: "歯科", area: "Leeds" })).toBe("review")
    expect(matchExclusivity({ sector: "Dental", area: "Leeds" }, { clientId: 9, sector: "Dental", area: "" })).toBe("review")
  })
  it("a founder classification overrides wording on both sides, and unclassified sides stay conservative", () => {
    const a = "sector-dental", b = "sector-orthodontics"
    const ex = { clientId: 9, sector: "Dental", area: "Leeds", sectorId: a }
    expect(matchExclusivity({ sector: "Dentist", area: "Leeds", sectorId: a }, ex)).toBe("restricted")      // synonym with no shared stem, classified
    expect(matchExclusivity({ sector: "Dental clinic", area: "Leeds", sectorId: b }, ex)).toBe("none")        // similar words, but the founder says a different sector
    expect(matchExclusivity({ sector: "Plumber", area: "Leeds" }, ex)).toBe("review")                          // prospect unclassified against a classified restriction: only a founder can clear it
    expect(matchExclusivity({ sector: "Dentist", area: "" , sectorId: a }, ex)).toBe("review")
  })
  it("clears what is positively different, and never restricts a customer by its own exclusivity", () => {
    expect(matchExclusivity({ sector: "Dentistry", area: "Nottingham" }, ex)).toBe("none")
    expect(matchExclusivity({ sector: "Plumbing & Heating", area: "Leeds" }, ex)).toBe("none")
    expect(matchExclusivity({ clientId: 7, sector: "Plumbing & Heating", area: "Nottingham" }, ex)).toBe("none")
  })
})
describe("market gate fails closed", () => {
  const approved = { status: "approved", plan_keys: ["standard-v2"] }
  it("is approved only for an approved market that includes the plan", () => {
    expect(marketGate("GB", approved, "standard-v2")).toBe("approved")
    expect(marketGate("GB", approved, "bespoke-v1")).toBe("not_approved")
    expect(marketGate("GB", { status: "under_review", plan_keys: ["standard-v2"] }, "standard-v2")).toBe("not_approved")
    expect(marketGate("GB", { status: "suspended", plan_keys: ["standard-v2"] }, "standard-v2")).toBe("not_approved")
    expect(marketGate("FR", undefined, "standard-v2")).toBe("not_approved")
    expect(marketGate(null, approved, "standard-v2")).toBe("unknown")
    expect(marketGate("GB", approved, "*")).toBe("approved"); expect(marketGate("GB", { status: "suspended", plan_keys: ["standard-v2"] }, "*")).toBe("not_approved"); expect(marketGate("GB", undefined, "*")).toBe("not_approved")
  })
  it("normalises and validates country codes", () => {
    expect(normaliseCountry(" gb ")).toBe("GB"); expect(normaliseCountry("")).toBeNull()
    expect(() => normaliseCountry("GBR")).toThrow(); expect(() => normaliseCountry("1A")).toThrow()
  })
})
