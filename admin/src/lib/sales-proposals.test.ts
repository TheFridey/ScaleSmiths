import { describe, expect, it } from "vitest"
import {
  formatSalesPrice,
  parseSalesProposalEditPayload,
  parseSalesProposalGeneratePayload,
} from "./sales-proposals"

describe("sales proposal helpers", () => {
  it("parses generate payloads", () => {
    expect(parseSalesProposalGeneratePayload({
      prospectId: "12",
      selectedServices: "Website rebuild, care plan",
      buildPrice: "4500",
      retainerPrice: "350",
    })).toEqual({
      ok: true,
      data: {
        prospectId: 12,
        clientId: null,
        selectedServices: "Website rebuild, care plan",
        buildPrice: 4500,
        retainerPrice: 350,
      },
    })
  })

  it("rejects invalid generate payloads", () => {
    expect(parseSalesProposalGeneratePayload({ prospectId: "", buildPrice: 0, retainerPrice: 0 }))
      .toEqual({ ok: false, error: "Prospect or client is required." })
    expect(parseSalesProposalGeneratePayload({ prospectId: 4, buildPrice: -1, retainerPrice: 0 }))
      .toEqual({ ok: false, error: "Build price must be zero or more." })
  })

  it("validates editable proposal content", () => {
    expect(parseSalesProposalEditPayload({
      title: "Proposal",
      summary: "A clear proposal.",
      htmlContent: "<!doctype html><html><body>Proposal</body></html>",
      status: "draft",
    })).toEqual({
      ok: true,
      data: {
        title: "Proposal",
        summary: "A clear proposal.",
        htmlContent: "<!doctype html><html><body>Proposal</body></html>",
        status: "draft",
      },
    })
    expect(parseSalesProposalEditPayload({ title: "", summary: "Summary", htmlContent: "<html></html>", status: "draft" }))
      .toEqual({ ok: false, error: "Proposal title is required." })
    expect(parseSalesProposalEditPayload({ title: "Proposal", summary: "Summary", htmlContent: "<html></html>", status: "bogus" }))
      .toEqual({ ok: false, error: "Proposal status is invalid." })
  })

  it("formats proposal prices without invented numbers", () => {
    expect(formatSalesPrice(0)).toBe("To be confirmed")
    expect(formatSalesPrice(4500)).toBe("GBP 4,500")
    expect(formatSalesPrice(350, " per month")).toBe("GBP 350 per month")
  })
})
