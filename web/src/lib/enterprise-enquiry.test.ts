import { describe, expect, it } from "vitest"
import {
  buildEnterpriseEnquiryBrief,
  buildEnterpriseQuotePayload,
  emptyEnterpriseEnquiryDraft,
  validateEnterpriseStage,
  type EnterpriseEnquiryDraft,
} from "./enterprise-enquiry"

function completeDraft(overrides: Partial<EnterpriseEnquiryDraft> = {}): EnterpriseEnquiryDraft {
  return {
    ...emptyEnterpriseEnquiryDraft(),
    name: "Alex Ops",
    email: "alex@example.com",
    phone: "+44 7700 900123",
    company: "Example Holdings",
    jobTitle: "Operations Director",
    companySize: "51–200",
    siteCount: "12",
    currentSystems: "ERP, spreadsheets, a legacy inspection tool",
    problem: "Field checks and compliance evidence are fragmented across sites.",
    overlappingSystems: "Two SaaS tools partially cover the same workflow.",
    manualProcesses: "Weekly spreadsheet reconciliations",
    operationalFriction: "No reliable audit trail for site checks",
    systemAreas: ["Operational platform", "Inspection/check system", "Compliance platform"],
    microsoft365: "Yes",
    requireSso: "Yes",
    cloudProvider: "Microsoft Azure",
    existingApis: "ERP REST API",
    dataMigration: "Yes",
    mobileOffline: "Yes",
    securityProcurement: "Yes",
    approxUsers: "180",
    approxSites: "12",
    timescale: "3–6 months",
    budgetApproved: "Yes",
    budgetRange: "£100k–£250k",
    approvers: "CIO and Finance Director",
    finalMessage: "We want a controlled discovery before committing to rebuild.",
    consent: true,
    ...overrides,
  }
}

describe("enterprise enquiry draft validation", () => {
  it("requires organisation fields on step 1", () => {
    const result = validateEnterpriseStage(0, emptyEnterpriseEnquiryDraft())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.field).toBe("name")
  })

  it("requires a problem statement on step 2", () => {
    const result = validateEnterpriseStage(1, completeDraft({ problem: "" }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.field).toBe("problem")
  })

  it("requires at least one system area on step 3", () => {
    const result = validateEnterpriseStage(2, completeDraft({ systemAreas: [] }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.field).toBe("systemAreas")
  })

  it("allows skipping optional technical environment fields", () => {
    expect(validateEnterpriseStage(3, completeDraft({
      microsoft365: "",
      requireSso: "",
      cloudProvider: "",
      existingApis: "",
      dataMigration: "",
      mobileOffline: "",
      securityProcurement: "",
    }))).toEqual({ ok: true })
  })

  it("requires timescale and budget on step 5", () => {
    const result = validateEnterpriseStage(4, completeDraft({ timescale: "", budgetRange: "" }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.field).toBe("timescale")
  })

  it("requires final message and consent on the last step", () => {
    const result = validateEnterpriseStage(5, completeDraft({ finalMessage: "", consent: false }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.field).toBe("finalMessage")
  })
})

describe("enterprise enquiry payload composition", () => {
  it("builds a structured brief and quote payload without leaking the honeypot into the brief", () => {
    const draft = completeDraft({ website: "spam-trap" })
    const brief = buildEnterpriseEnquiryBrief(draft)
    const payload = buildEnterpriseQuotePayload(draft)

    expect(brief).toContain("Enterprise discovery brief")
    expect(brief).toContain("Field checks and compliance evidence")
    expect(brief).toContain("Inspection/check system")
    expect(brief).not.toContain("spam-trap")
    expect(payload).toMatchObject({
      funnelType: "enterprise",
      intent: "enterprise",
      name: "Alex Ops",
      email: "alex@example.com",
      biz: "Example Holdings",
      phone: "+44 7700 900123",
      budget: "£100k–£250k",
      timeframe: "3–6 months",
      consent: true,
      website: "spam-trap",
    })
    expect(payload.needs).toEqual(expect.arrayContaining(["Operational platform", "Compliance platform"]))
    expect(payload.brief.length).toBeGreaterThan(200)
  })
})
