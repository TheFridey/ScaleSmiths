import { describe, expect, it } from "vitest"
import { nextLondonOccurrence } from "./command-centre"
import { firstDecisionMakerConnections } from "./command-centre"
import {
  contractMetrics,
  csvCell,
  londonDay,
  londonInputToISO,
  londonWeek,
  minorUnits,
  normalizedCompany,
  companyDomain,
  suggestCommercialActivity,
} from "./command-centre"
describe("Command Centre commercial boundaries", () => {
  it("counts a decision-maker connection once under the first actual actor", () => {
    const first = {
      contactId: 3,
      actorUserId: "trev",
      outcome: "Decision-maker connection: Interested",
      occurredAt: "2026-10-12T10:00:00Z",
      createdAt: "2026-10-12T10:00:00Z",
    }
    expect(
      firstDecisionMakerConnections([
        { ...first, actorUserId: "rhys", occurredAt: "2026-10-13T10:00:00Z" },
        first,
        { ...first, contactId: 4, outcome: "Voicemail" },
        { ...first, contactId: null },
      ]),
    ).toEqual([first])
  })
  it("keeps recurring tasks at the same London time across clock changes", () => {
    expect(nextLondonOccurrence("2026-10-24T08:00:00Z", 2).toISOString()).toBe(
      "2026-10-26T09:00:00.000Z",
    )
    expect(nextLondonOccurrence("2026-03-28T09:00:00Z", 2).toISOString()).toBe(
      "2026-03-30T08:00:00.000Z",
    )
  })
  it("suggests dates without choosing ambiguous business or inventing contacts", () => {
    const now = new Date("2026-10-11T12:00:00Z")
    const leads = [
      { id: 1, businessName: "ABC Roofing" },
      { id: 2, businessName: "ABC Roofing" },
    ]
    const suggestion = suggestCommercialActivity(
      "Called John at ABC Roofing. Call Thursday.",
      leads,
      now,
    )
    expect(suggestion.prospectId).toBeNull()
    expect(suggestion.type).toBe("phone_call")
    expect(londonDay(suggestion.followUpAt!)).toBe("2026-10-15")
    expect(suggestion).not.toHaveProperty("contactId")
  })
  it("counts distinct confirmed active retained clients and actual recurring amounts", () => {
    const base = {
      clientId: 1,
      category: "retainer",
      status: "confirmed",
      monthlyAmount: 35000,
      startsAt: "2026-01-01T00:00:00Z",
      endsAt: null,
    }
    expect(
      contractMetrics(
        [
          base,
          { ...base, monthlyAmount: 90000 },
          { ...base, clientId: 2, monthlyAmount: 200000 },
          { ...base, clientId: 3, status: "draft" },
          { ...base, clientId: 4, category: "performance" },
          { ...base, clientId: 5, endsAt: "2026-10-01T00:00:00Z" },
        ],
        new Date("2026-10-11T12:00:00Z"),
      ),
    ).toEqual({ retainedClients: 2, mrr: 325000 })
  })
  it("excludes future contracts", () => {
    expect(
      contractMetrics(
        [
          {
            clientId: 1,
            category: "retainer",
            status: "confirmed",
            monthlyAmount: 35000,
            startsAt: "2027-01-01T00:00:00Z",
            endsAt: null,
          },
        ],
        new Date("2026-10-11T12:00:00Z"),
      ).mrr,
    ).toBe(0)
  })
  it("resolves London dates and rejects ambiguous or skipped clock times", () => {
    expect(londonInputToISO("2026-07-01T09:00")).toBe(
      "2026-07-01T08:00:00.000Z",
    )
    expect(londonInputToISO("2026-12-01T09:00")).toBe(
      "2026-12-01T09:00:00.000Z",
    )
    expect(() => londonInputToISO("2026-10-25T01:30")).toThrow("ambiguous")
    expect(() => londonInputToISO("2026-03-29T01:30")).toThrow("skipped")
    expect(londonDay("2026-07-01T23:30:00Z")).toBe("2026-07-02")
    expect(londonWeek("2026-07-05T23:30:00Z")).toBe("2026-07-06")
  })
  it("rejects fractional, negative and unsafe amounts", () => {
    for (const amount of [-1, 0.1, NaN, Infinity, "35000", 2147483648])
      expect(() => minorUnits(amount)).toThrow()
    expect(minorUnits(35000)).toBe(35000)
  })
  it("normalizes identifiers and makes CSV formula-safe", () => {
    expect(normalizedCompany("ABC Roofing Ltd.")).toBe(
      normalizedCompany("ABC Roofing Limited"),
    )
    expect(companyDomain("https://www.example.com/about")).toBe("example.com")
    expect(() => companyDomain("not a URL")).toThrow("valid HTTP")
    expect(csvCell("=SUM(A1)")).toBe('"\'=SUM(A1)"')
    expect(csvCell(-200000)).toBe('"-200000"')
    expect(csvCell("Company, Ltd")).toBe('"Company, Ltd"')
  })
})
