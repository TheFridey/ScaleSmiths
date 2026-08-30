import { describe, expect, it } from "vitest"
import { initialFormState, buildSubmitOptions, blocksConvert, formatMoney, type ConversionPlanView } from "./convert-prospect-options"

const plan: ConversionPlanView = {
  prospectId: 5, alreadyConverted: false,
  warnings: [{ code: "dedupe_candidates", message: "Found 1", blocksExecute: false }],
  defaults: { clientName: "Acme Ltd", tier: "Retainer", mrr: 500, invoiceClientCode: "ACME", projectName: "Acme — growth", onboardingTasks: [{ title: "Kickoff & welcome" }] },
  matchCandidates: [{ clientId: 9, name: "Acme Ltd", tier: null, mrr: 0, matchedOn: ["name"] }],
  catalogue: [{ id: 1, name: "Care Plan", defaultUnitAmount: 5000, category: null }],
  existingConversionId: null,
}

describe("initialFormState", () => {
  it("seeds from plan.defaults with create mode and everything else off", () => {
    const s = initialFormState(plan)
    expect(s).toMatchObject({ mode: "create", name: "Acme Ltd", tier: "Retainer", mrr: 500, code: "ACME", projectName: "Acme — growth", serviceIds: [], createProject: false, onboardingTasks: false, createDraftInvoice: false, preparePortal: false, linkClientId: null })
  })
})

describe("buildSubmitOptions", () => {
  it("builds a create payload with uppercased trimmed code and selected services", () => {
    const s = { ...initialFormState(plan), code: " acme ", serviceIds: [1], createDraftInvoice: true }
    const o = buildSubmitOptions(s)
    expect(o.client).toMatchObject({ mode: "create", name: "Acme Ltd", tier: "Retainer", invoiceClientCode: "ACME" })
    expect(o).toMatchObject({ mrr: 500, catalogueItemIds: [1], createDraftInvoice: true, onboardingTasks: false, preparePortal: false, createProject: false })
    expect(o.projectName).toBeUndefined()
  })
  it("omits projectName unless createProject, and passes it when set", () => {
    expect(buildSubmitOptions({ ...initialFormState(plan), createProject: true, projectName: "P1" }).projectName).toBe("P1")
  })
  it("builds a link payload with optional code", () => {
    const o = buildSubmitOptions({ ...initialFormState(plan), mode: "link", linkClientId: 9, code: "" })
    expect(o.client).toMatchObject({ mode: "link", clientId: 9 })
    expect((o.client as Record<string, unknown>).invoiceClientCode).toBeUndefined()
  })
})

describe("blocksConvert", () => {
  it("false for a clean create plan", () => {
    expect(blocksConvert(plan, initialFormState(plan))).toBe(false)
  })
  it("true when a warning blocks", () => {
    expect(blocksConvert({ ...plan, warnings: [{ code: "not_won", message: "x", blocksExecute: true }] }, initialFormState(plan))).toBe(true)
  })
  it("true for link mode without a chosen client", () => {
    expect(blocksConvert(plan, { ...initialFormState(plan), mode: "link", linkClientId: null })).toBe(true)
  })
  it("true for createDraftInvoice with no services", () => {
    expect(blocksConvert(plan, { ...initialFormState(plan), createDraftInvoice: true, serviceIds: [] })).toBe(true)
  })
})

describe("formatMoney", () => {
  it("formats minor units as GBP", () => {
    expect(formatMoney(5000)).toBe("£50.00")
  })
})
