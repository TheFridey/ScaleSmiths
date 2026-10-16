import { describe, expect, it } from "vitest"
import {
  attributionFromLocation,
  mergeEnquiryAttribution,
  sanitizeEnquiryAttribution,
  sanitizePublicPath,
} from "./enquiry-attribution"

describe("enquiry attribution", () => {
  it("keeps the form page, same-site referrer and campaign labels", () => {
    const attribution = attributionFromLocation(
      "https://scalesmiths.co.uk/quote?intent=strategy_call&utm_source=google&utm_medium=organic&utm_campaign=nottingham",
      "https://scalesmiths.co.uk/pricing?section=published",
      "scalesmiths.co.uk",
    )
    expect(attribution).toMatchObject({
      submissionPath: "/quote?intent=strategy_call&utm_source=google&utm_medium=organic&utm_campaign=nottingham",
      referrerHost: "scalesmiths.co.uk",
      referrerPath: "/pricing?section=published",
      utmSource: "google",
      utmMedium: "organic",
      utmCampaign: "nottingham",
    })
  })

  it("stores an external referrer as a hostname and drops its path", () => {
    const attribution = attributionFromLocation(
      "https://scalesmiths.co.uk/services/business-growth-audit/start",
      "https://www.google.com/search?q=private+email@example.com",
      "scalesmiths.co.uk",
    )
    expect(attribution.referrerHost).toBe("www.google.com")
    expect(attribution.referrerPath).toBeNull()
    expect(JSON.stringify(attribution)).not.toContain("email@example.com")
  })

  it("strips contact details and secrets from stored paths", () => {
    expect(sanitizePublicPath("/quote?intent=quote&email=person@example.com&token=secret")).toBe("/quote?intent=quote")
    expect(sanitizePublicPath("https://evil.example/quote")).toBeNull()
    expect(sanitizePublicPath("//evil.example/quote")).toBeNull()
  })

  it("rejects campaign values that could carry an address or script", () => {
    const attribution = sanitizeEnquiryAttribution({
      submissionPath: "/quote",
      utmSource: "person@example.com",
      utmMedium: "organic",
      utmCampaign: "<script>",
      referrerHost: "news.example",
      referrerPath: "/private/person@example.com",
    }, "scalesmiths.co.uk")
    expect(attribution.utmSource).toBeNull()
    expect(attribution.utmCampaign).toBeNull()
    expect(attribution.utmMedium).toBe("organic")
    expect(attribution.referrerPath).toBeNull()
  })

  it("keeps the first landing page when the form itself has no campaign", () => {
    const merged = mergeEnquiryAttribution(
      {
        landingPath: "/web-design-nottingham",
        submissionPath: "/web-design-nottingham?utm_source=newsletter&utm_medium=email&utm_campaign=october",
        referrerHost: "mail.example",
        referrerPath: null,
        utmSource: "newsletter",
        utmMedium: "email",
        utmCampaign: "october",
      },
      {
        landingPath: null,
        submissionPath: "/quote",
        referrerHost: "scalesmiths.co.uk",
        referrerPath: "/web-design-nottingham",
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
      },
      "scalesmiths.co.uk",
    )
    expect(merged).toMatchObject({
      landingPath: "/web-design-nottingham",
      submissionPath: "/quote",
      referrerHost: "mail.example",
      referrerPath: null,
      utmSource: "newsletter",
      utmCampaign: "october",
    })
  })
})
