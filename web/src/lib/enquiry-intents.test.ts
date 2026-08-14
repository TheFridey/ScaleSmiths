import { describe, expect, it } from "vitest"
import { ENQUIRY_INTENTS, enquiryIntentFromLocation, enquiryIntentHref, parseEnquiryIntent } from "./enquiry-intents"

describe("enquiry intents", () => {
  it("keeps the three V2 options semantically distinct", () => {
    expect(ENQUIRY_INTENTS.strategy_call).toBe("Request a Strategy Call")
    expect(ENQUIRY_INTENTS.v2_demo).toBe("Request a V2 Demo")
    expect(ENQUIRY_INTENTS.email_plan).toBe("Email This Plan")
    expect(new Set(["strategy_call", "v2_demo", "email_plan"]).size).toBe(3)
  })

  it("round-trips a selected intent through the enquiry URL", () => {
    const href = enquiryIntentHref("discovery_call")
    expect(href).toBe("/quote?intent=discovery_call")
    expect(enquiryIntentFromLocation(href.slice(href.indexOf("?")))).toBe("discovery_call")
  })

  it("fails closed to a general quote for unknown values", () => {
    expect(parseEnquiryIntent("book_now")).toBe("quote")
    expect(parseEnquiryIntent(undefined)).toBe("quote")
  })

  it("supports the standalone business email journey", () => {
    expect(ENQUIRY_INTENTS.business_email).toBe("Set Up Managed Business Email")
    expect(enquiryIntentHref("business_email")).toBe("/quote?intent=business_email")
  })
})
