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
  it("clears only on positive evidence, never on the absence of a shared word", () => {
    expect(matchExclusivity({ sector: "Dentistry", area: "Nottingham" }, ex)).toBe("review")                    // wording cannot clear
    // Different wording for areas is never proof of a difference: without the founder-approved area tree, it goes to a founder
    expect(matchExclusivity({ sector: "Plumbing & Heating", area: "Leeds" }, ex)).toBe("review")
    expect(matchExclusivity({ sector: "Plumbing & Heating", area: "Leeds" }, { ...ex, area: "UK" })).toBe("review")
    expect(matchExclusivity({ sector: "Plumbing & Heating", area: "UK" }, ex)).toBe("review")
    expect(matchExclusivity({ clientId: 7, sector: "Plumbing & Heating", area: "Nottingham" }, ex)).toBe("none")  // own customer
    expect(matchExclusivity({ sector: "Kitchen retailer", area: "Leeds" }, { clientId: 8, sector: "Kitchen installation", area: "Leeds" })).toBe("review")
    expect(matchExclusivity({ sector: "Pest management", area: "Leeds" }, { clientId: 8, sector: "Exterminator", area: "Leeds" })).toBe("review")
    expect(matchExclusivity({ sector: "Dental", area: "Leeds", sectorId: "a" }, { clientId: 8, sector: "Dentist", area: "Leeds" })).toBe("review")   // classified prospect, unclassified exclusivity
    expect(matchExclusivity({ sector: "Dental", area: "Leeds", sectorId: "a" }, { clientId: 8, sector: "Dental", area: "Leeds" })).toBe("restricted")  // identical wording confirms
  })
})
describe("geography is decided from the founder-approved area tree", () => {
  // tree: north-west > greater-manchester > manchester ; yorkshire > leeds. Paths are most specific first.
  const manchester = ["manchester", "greater-manchester", "north-west"], northWest = ["north-west"], leeds = ["leeds", "yorkshire"]
  const ex = (areaPath: string[] | null, area = "North West England") => ({ clientId: 9, sector: "Dental", area, sectorId: "dental", areaPath })
  it("a city inside a protected region is a match, whichever direction the nesting goes", () => {
    expect(matchExclusivity({ sector: "Dentist", area: "Manchester", sectorId: "dental", areaPath: manchester }, ex(northWest))).toBe("restricted")
    expect(matchExclusivity({ sector: "Dentist", area: "North West England", sectorId: "dental", areaPath: northWest }, ex(manchester, "Manchester"))).toBe("restricted")
    expect(matchExclusivity({ sector: "Dentist", area: "Hucknall", sectorId: "dental", areaPath: ["hucknall", "nottinghamshire"] }, ex(["nottinghamshire"], "Nottinghamshire"))).toBe("restricted")
    expect(matchExclusivity({ sector: "Dentist", area: "Westminster", sectorId: "dental", areaPath: ["westminster", "greater-london"] }, ex(["greater-london"], "Greater London"))).toBe("restricted")
  })
  it("two classified areas, neither containing the other, are positively different; an unclassified one is never proof", () => {
    expect(matchExclusivity({ sector: "Dentist", area: "Leeds", sectorId: "dental", areaPath: leeds, areaVerified: true }, ex(northWest))).toBe("none")
    // a partner-typed area is an unverified assertion: it can match, but it can never clear
    expect(matchExclusivity({ sector: "Dentist", area: "Leeds", sectorId: "dental", areaPath: leeds }, ex(northWest))).toBe("review")
    expect(matchExclusivity({ sector: "Dentist", area: "Manchester", sectorId: "dental", areaPath: manchester }, ex(northWest))).toBe("restricted")
    expect(matchExclusivity({ sector: "Dentist", area: "Manchester", sectorId: "dental", areaPath: manchester }, ex(null))).toBe("review")   // exclusivity area not in the taxonomy
    expect(matchExclusivity({ sector: "Dentist", area: "Manchester", sectorId: "dental", areaPath: null }, ex(northWest))).toBe("review")     // prospect area not in the taxonomy
    expect(matchExclusivity({ sector: "Dentist", area: "Manchester", sectorId: "dental", areaPath: [] }, ex(northWest))).toBe("review")
  })
  it("a different sector is still decided by the sector, and an own customer is never restricted", () => {
    expect(matchExclusivity({ sector: "Plumber", area: "Manchester", sectorId: "plumbing", areaPath: manchester }, ex(northWest))).toBe("none")
    expect(matchExclusivity({ clientId: 9, sector: "Dentist", area: "Manchester", sectorId: "dental", areaPath: manchester }, ex(northWest))).toBe("none")
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
