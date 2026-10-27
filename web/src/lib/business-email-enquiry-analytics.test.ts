import { describe, expect, it, vi } from "vitest"
import { sanitizeExperienceEvent } from "./experience-analytics"
import {
  BUSINESS_EMAIL_ENQUIRY_CONTEXT,
  BUSINESS_EMAIL_EXPERIENCE_METADATA,
  createBusinessEmailEnquiryAnalytics,
} from "./business-email-enquiry-analytics"

describe("Managed Business Email enquiry analytics", () => {
  it("emits quote_form_started once per form session alongside GA start", () => {
    const trackEnquiry = vi.fn()
    const trackExperience = vi.fn()
    const analytics = createBusinessEmailEnquiryAnalytics({ trackEnquiry, trackExperience })

    analytics.onInteraction()
    analytics.onInteraction()
    analytics.onInteraction()

    expect(trackEnquiry).toHaveBeenCalledTimes(1)
    expect(trackEnquiry).toHaveBeenCalledWith("start", BUSINESS_EMAIL_ENQUIRY_CONTEXT)
    expect(trackExperience).toHaveBeenCalledTimes(1)
    expect(trackExperience).toHaveBeenCalledWith("quote_form_started", {
      metadata: BUSINESS_EMAIL_EXPERIENCE_METADATA,
    })
  })

  it("emits quote_form_submitted with GA complete after a successful submission", () => {
    const trackEnquiry = vi.fn()
    const trackExperience = vi.fn()
    const analytics = createBusinessEmailEnquiryAnalytics({ trackEnquiry, trackExperience })

    analytics.onSubmitSuccess()

    expect(trackEnquiry).toHaveBeenCalledWith("complete", BUSINESS_EMAIL_ENQUIRY_CONTEXT)
    expect(trackExperience).toHaveBeenCalledWith("quote_form_submitted", {
      metadata: BUSINESS_EMAIL_EXPERIENCE_METADATA,
    })
    expect(trackExperience).not.toHaveBeenCalledWith("experience_error", expect.anything())
  })

  it("emits experience_error without quote_form_submitted when submission fails", () => {
    const trackEnquiry = vi.fn()
    const trackExperience = vi.fn()
    const analytics = createBusinessEmailEnquiryAnalytics({ trackEnquiry, trackExperience })

    analytics.onSubmitFailure()

    expect(trackEnquiry).not.toHaveBeenCalled()
    expect(trackExperience).toHaveBeenCalledWith("experience_error", {
      errorCategory: "quote_submission",
      metadata: BUSINESS_EMAIL_EXPERIENCE_METADATA,
    })
    expect(trackExperience).not.toHaveBeenCalledWith("quote_form_submitted", expect.anything())
  })

  it("keeps only allowlisted metadata and strips contact details from experience events", () => {
    const event = sanitizeExperienceEvent({
      eventName: "quote_form_submitted",
      eventKey: "sess_business_email:quote_form_submitted",
      sessionId: "sess_business_email",
      path: "/services/managed-business-email/get-started",
      metadata: {
        ...BUSINESS_EMAIL_EXPERIENCE_METADATA,
        email: "person@example.com",
        domain: "acme.co.uk",
        mailbox: "hello",
        name: "Alex Example",
      },
    })

    expect(event).toMatchObject({
      eventName: "quote_form_submitted",
      metadata: BUSINESS_EMAIL_EXPERIENCE_METADATA,
    })
    expect(JSON.stringify(event)).not.toContain("person@example.com")
    expect(JSON.stringify(event)).not.toContain("acme.co.uk")
    expect(JSON.stringify(event)).not.toContain("hello")
    expect(JSON.stringify(event)).not.toContain("Alex Example")
  })
})
