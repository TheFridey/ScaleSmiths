import { describe, expect, it } from "vitest"
import { buildEnquiryAnalyticsEvent } from "./enquiry-analytics"
import { EMPTY_ENQUIRY_ATTRIBUTION } from "./enquiry-attribution"

describe("enquiry analytics events", () => {
  it("names the enquiry without contact details or query strings", () => {
    const event = buildEnquiryAnalyticsEvent({
      name: "generate_lead",
      intent: "strategy_call",
      funnelType: "full_quote",
      attribution: {
        ...EMPTY_ENQUIRY_ATTRIBUTION,
        submissionPath: "/quote?intent=strategy_call&email=person@example.com",
        referrerHost: "www.google.com",
        utmSource: "google",
        utmMedium: "organic",
        utmCampaign: "nottingham",
      },
    })

    expect(event).toEqual({
      name: "generate_lead",
      params: {
        enquiry_intent: "strategy_call",
        funnel_type: "full_quote",
        page_path: "/quote",
        referrer_host: "www.google.com",
        utm_source: "google",
        utm_medium: "organic",
        utm_campaign: "nottingham",
      },
    })
    expect(JSON.stringify(event)).not.toContain("person@example.com")
    expect(JSON.stringify(event)).not.toContain("intent=")
  })

  it("drops labels that are not enquiry identifiers", () => {
    const event = buildEnquiryAnalyticsEvent({
      name: "enquiry_form_start",
      intent: "not a real intent",
      funnelType: "full_quote",
      attribution: EMPTY_ENQUIRY_ATTRIBUTION,
    })
    expect(event.params.enquiry_intent).toBe("quote")
    expect(event.params.page_path).toBe("/")
    expect(event.params).not.toHaveProperty("utm_source")
  })
})
