import { describe, expect, it } from "vitest"
import { industryAttributionBriefPrefix, parseIndustryAttribution } from "./industries/attribution"
import { quoteInsertValues, validateQuotePayload } from "./quote-security"

describe("industry enquiry handoff", () => {
  it("stores a strategy-call brief, intent and acquisition path without a new column", () => {
    const attribution = parseIndustryAttribution("industry=plumbers&hub=trades-home-services&pathway=growth")
    expect(attribution).not.toBeNull()
    const brief = [
      industryAttributionBriefPrefix(attribution!).trim(),
      "Request a Strategy Call request",
      "What they are trying to solve: Emergency and planned plumbing jobs share one form.",
    ].join("\n")

    const result = validateQuotePayload({
      name: "Alex Local",
      email: "alex@example.com",
      biz: "Alex Plumbing",
      websiteUrl: "https://example.com",
      phone: "0115 000 0000",
      goal: "Emergency and planned plumbing jobs share one form.",
      needs: ["Website not converting"],
      preferredContactMethod: "Phone",
      timeframe: "This month",
      intent: "strategy_call",
      consent: true,
      brief,
      attribution: {
        landingPath: "/industries/trades-home-services/plumbers",
        submissionPath: "/quote?intent=strategy_call&industry=plumbers&hub=trades-home-services&pathway=growth",
        referrerHost: "www.google.com",
        referrerPath: null,
        utmSource: "google",
        utmMedium: "organic",
        utmCampaign: null,
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const record = quoteInsertValues(result.data)
    expect(record.enquiryIntent).toBe("strategy_call")
    expect(record.leadSource).toBe("public_quote")
    expect(record.brief).toContain("industry=plumbers")
    expect(record.brief).toContain("pathway=growth")
    expect(record.acquisitionLandingPath).toBe("/industries/trades-home-services/plumbers")
    expect(record.acquisitionSubmissionPath).toContain("intent=strategy_call")
    expect(record.acquisitionUtmSource).toBe("google")
  })

  it("keeps a full website brief attributed to the industry page that sent it", () => {
    const attribution = parseIndustryAttribution("industry=homeware&hub=retail-ecommerce&pathway=build")
    const result = validateQuotePayload({
      name: "Sam Retail",
      email: "sam@example.com",
      biz: "Sam Home",
      businessType: "Homeware retailer",
      type: "Conversion Website",
      budget: "Website from £2,000",
      timeframe: "This quarter",
      goal: "Lead times are missing from product pages.",
      needs: ["Website not converting"],
      preferredContactMethod: "Email",
      intent: "quote",
      consent: true,
      brief: `${industryAttributionBriefPrefix(attribution!)}Lead times are missing from the product pages and checkout.`,
      attribution: {
        landingPath: "/industries/retail-ecommerce/homeware",
        submissionPath: "/quote?industry=homeware&hub=retail-ecommerce&pathway=build",
        referrerHost: null,
        referrerPath: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const record = quoteInsertValues(result.data)
    expect(record.enquiryIntent).toBe("quote")
    expect(record.leadSource).toBe("public_quote")
    expect(record.brief).toContain("industry=homeware")
    expect(record.acquisitionLandingPath).toBe("/industries/retail-ecommerce/homeware")
  })
})
