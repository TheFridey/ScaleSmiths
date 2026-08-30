import { describe, expect, it } from "vitest"
import {
  ProspectConversionError,
  parseConversionOptions,
  defaultOnboardingTasks,
  deriveTier,
  suggestInvoiceClientCode,
  matchExistingClients,
  buildOpportunitySnapshot,
  buildConversionPlan,
} from "./prospect-conversion"

const createOptions = {
  client: { mode: "create", name: "Acme Ltd", tier: "Retainer", invoiceClientCode: "ACME" },
  mrr: 500, catalogueItemIds: [1, 2],
  createProject: false, onboardingTasks: false, createDraftInvoice: false, preparePortal: false,
} as const

describe("parseConversionOptions", () => {
  it("accepts a valid create payload", () => {
    expect(parseConversionOptions(createOptions).client).toMatchObject({ mode: "create", invoiceClientCode: "ACME" })
  })
  it("rejects createProject without projectName", () => {
    expect(() => parseConversionOptions({ ...createOptions, createProject: true })).toThrow(ProspectConversionError)
  })
  it("rejects createDraftInvoice with no catalogue items", () => {
    expect(() => parseConversionOptions({ ...createOptions, catalogueItemIds: [], createDraftInvoice: true })).toThrow(/service/i)
  })
  it("rejects an unknown tier", () => {
    expect(() => parseConversionOptions({ ...createOptions, client: { ...createOptions.client, tier: "Platinum" } })).toThrow(/tier/i)
  })
  it("rejects a negative mrr", () => {
    expect(() => parseConversionOptions({ ...createOptions, mrr: -1 })).toThrow(ProspectConversionError)
  })
  it("rejects a malformed invoiceClientCode on create", () => {
    expect(() => parseConversionOptions({ ...createOptions, client: { ...createOptions.client, invoiceClientCode: "a" } })).toThrow(/code/i)
  })
  it("rejects link mode without clientId", () => {
    expect(() => parseConversionOptions({ ...createOptions, client: { mode: "link" } })).toThrow(ProspectConversionError)
  })
  it("dedupes and sorts catalogueItemIds, rejects non-integers", () => {
    expect(parseConversionOptions({ ...createOptions, catalogueItemIds: [3, 3, 1] }).catalogueItemIds).toEqual([1, 3])
    expect(() => parseConversionOptions({ ...createOptions, catalogueItemIds: [1.5] })).toThrow(ProspectConversionError)
  })
})

describe("deriveTier / suggestInvoiceClientCode", () => {
  it("uses Retainer when mrr > 0 else Forge Build", () => {
    expect(deriveTier(1)).toBe("Retainer")
    expect(deriveTier(0)).toBe("Forge Build")
  })
  it("produces an uppercase 2-12 char alnum code", () => {
    expect(suggestInvoiceClientCode("Acme & Co. Marketing")).toMatch(/^[A-Z0-9]{2,12}$/)
    expect(suggestInvoiceClientCode("X")).toMatch(/^[A-Z0-9]{2,12}$/)
  })
})

describe("defaultOnboardingTasks", () => {
  it("returns a stable ordered 5-item list", () => {
    expect(defaultOnboardingTasks().map((t) => t.title)).toEqual([
      "Kickoff & welcome",
      "Collect brand assets & access",
      "Confirm scope & timeline",
      "Staging environment",
      "Go-live checklist",
    ])
  })
})

describe("matchExistingClients", () => {
  const clients = [
    { id: 1, name: "Acme Ltd", contactEmail: "hi@acme.com", tier: "Retainer", mrr: 500 },
    { id: 2, name: "Globex", contactEmail: null, tier: null, mrr: 0 },
  ]
  it("matches on normalised name", () => {
    const r = matchExistingClients({ businessName: "ACME  ltd.", contactEmail: null }, clients)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ clientId: 1, matchedOn: ["name"] })
  })
  it("matches on email", () => {
    const r = matchExistingClients({ businessName: "Nope", contactEmail: "HI@ACME.COM" }, clients)
    expect(r[0]).toMatchObject({ clientId: 1, matchedOn: ["email"] })
  })
  it("returns [] on no match", () => {
    expect(matchExistingClients({ businessName: "Zzz", contactEmail: "z@z.z" }, clients)).toEqual([])
  })
})

describe("buildOpportunitySnapshot", () => {
  const prospectRow = { id: 7, businessName: "Acme", stage: "won", source: "referral", priority: "high", estimatedProjectValue: 9000, estimatedMonthlyRetainer: 500, revenueScore: 5, trustScore: 5, conversionScore: 5, seoScore: 5, mobileScore: 5, contactName: null, contactEmail: null, contactPhone: null, websiteUrl: null, location: null, industry: null, auditSummary: null, painPoints: null, opportunityNotes: null, objectionNotes: null, wonAt: new Date("2026-08-01"), createdAt: new Date("2026-07-01") }
  it("caps activities at 50 and resolves an accepted proposal tracking", () => {
    const s = buildOpportunitySnapshot({
      prospect: prospectRow,
      activities: Array.from({ length: 60 }, () => ({ type: "email", direction: "outbound", subject: "s", outcome: null, createdAt: new Date() })),
      proposalTrackings: [{ packageType: "growth", quotedAmount: 9000, monthlyRetainerAmount: 500, status: "accepted", sentAt: new Date(), acceptedAt: new Date() }],
      salesProposals: [],
      leadScore: { id: 3, score: 82 },
    })
    expect(s.outreach.count).toBe(60)
    expect(s.outreach.lastActivities).toHaveLength(50)
    expect(s.acceptedProposal).toMatchObject({ source: "proposal_tracking", packageType: "growth" })
    expect(s.leadScore).toEqual({ snapshotId: 3, score: 82 })
  })
  it("falls back to accepted sales_proposal then null", () => {
    const base = { prospect: prospectRow, activities: [], proposalTrackings: [], leadScore: null }
    expect(buildOpportunitySnapshot({ ...base, salesProposals: [{ status: "accepted", selectedServices: "SEO", buildPrice: 4000, retainerPrice: 250, packageType: null }] }).acceptedProposal).toMatchObject({ source: "sales_proposal", selectedServices: "SEO" })
    expect(buildOpportunitySnapshot({ ...base, salesProposals: [] }).acceptedProposal).toBeNull()
  })
})

describe("buildConversionPlan", () => {
  const prospect = { id: 5, businessName: "Acme Ltd", contactName: "Sam", contactEmail: "sam@acme.com", contactPhone: null, websiteUrl: "https://acme.com", location: null, industry: null, stage: "won", source: "referral", priority: "high", estimatedProjectValue: 9000, estimatedMonthlyRetainer: 500, revenueScore: 5, trustScore: 5, conversionScore: 5, seoScore: 5, mobileScore: 5, auditSummary: null, painPoints: null, opportunityNotes: null, objectionNotes: null, wonAt: new Date(), createdAt: new Date() }
  it("computes defaults, no blocking warnings for a won prospect", () => {
    const plan = buildConversionPlan({ prospect, activities: [], proposalTrackings: [{ packageType: "growth", quotedAmount: 9000, monthlyRetainerAmount: 500, status: "accepted", sentAt: new Date(), acceptedAt: new Date() }], salesProposals: [], leadScore: null, matchCandidates: [], existingConversionId: null })
    expect(plan.defaults.tier).toBe("Retainer")
    expect(plan.defaults.mrr).toBe(500)
    expect(plan.defaults.invoiceClientCode).toMatch(/^[A-Z0-9]{2,12}$/)
    expect(plan.defaults.onboardingTasks).toHaveLength(5)
    expect(plan.warnings.some((w) => w.blocksExecute)).toBe(false)
  })
  it("flags not_won as blocking, dedupe + no_accepted_proposal as non-blocking", () => {
    const plan = buildConversionPlan({ prospect: { ...prospect, stage: "proposal_sent" }, activities: [], proposalTrackings: [], salesProposals: [], leadScore: null, matchCandidates: [{ clientId: 9, name: "Acme Ltd", tier: null, mrr: 0, matchedOn: ["name"] }], existingConversionId: null })
    expect(plan.warnings.find((w) => w.code === "not_won")?.blocksExecute).toBe(true)
    expect(plan.warnings.find((w) => w.code === "dedupe_candidates")?.blocksExecute).toBe(false)
    expect(plan.warnings.find((w) => w.code === "no_accepted_proposal")).toBeTruthy()
  })
})
