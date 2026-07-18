import { describe, expect, it } from "vitest"
import { sanitizeExperienceEvent, shouldRespectPrivacyOptOut, summarizeExperienceEvents } from "./experience-analytics"

describe("experience analytics privacy and taxonomy", () => {
  it("accepts stable event names and removes unnecessary personal data", () => {
    const event = sanitizeExperienceEvent({
      eventName: "experience_interactive_selected",
      eventKey: "sess_1:experience_interactive_selected",
      sessionId: "sess_1",
      path: "/?utm_source=newsletter",
      deviceClass: "desktop",
      preference: "interactive",
      referrer: "https://example.com/private/path?email=person@example.com",
      campaign: { source: "newsletter", medium: "email", name: "summer_launch" },
      metadata: { source: "gate", email: "person@example.com", nested: { unsafe: true } },
    })

    expect(event).toMatchObject({
      eventName: "experience_interactive_selected",
      path: "/",
      referrerHost: "example.com",
      campaignSource: "newsletter",
      metadata: { source: "gate" },
    })
  })

  it("rejects unknown event names and unsafe duplicate keys", () => {
    expect(sanitizeExperienceEvent({ eventName: "email_collected", eventKey: "ok", sessionId: "sess_1" })).toBeNull()
    expect(sanitizeExperienceEvent({ eventName: "quote_cta_clicked", eventKey: "bad key with spaces", sessionId: "sess_1" })).toBeNull()
  })

  it("accepts privacy-minimised local growth funnel events", () => {
    const event = sanitizeExperienceEvent({
      eventName: "local_growth_check_form_submitted",
      eventKey: "sess_1:local_growth_check_form_submitted",
      sessionId: "sess_1",
      path: "/local-growth-check",
      metadata: { funnelType: "local_growth_check", email: "private@example.com" },
    })

    expect(event).toMatchObject({
      eventName: "local_growth_check_form_submitted",
      path: "/local-growth-check",
      metadata: { funnelType: "local_growth_check" },
    })
  })

  it("respects browser privacy opt-out headers", () => {
    expect(shouldRespectPrivacyOptOut(new Headers({ "sec-gpc": "1" }))).toBe(true)
    expect(shouldRespectPrivacyOptOut(new Headers({ dnt: "1" }))).toBe(true)
    expect(shouldRespectPrivacyOptOut(new Headers({ cookie: "other=value; ss_analytics_opt_out=1" }))).toBe(true)
    expect(shouldRespectPrivacyOptOut(new Headers())).toBe(false)
  })

  it("summarises normal-versus-interactive comparison metrics", () => {
    const summary = summarizeExperienceEvents([
      { eventName: "experience_choice_displayed", preference: "none", deviceClass: "desktop", returningPreference: false, completionDepth: null, campaignSource: null, campaignMedium: null, campaignName: null },
      { eventName: "experience_normal_selected", preference: "normal", deviceClass: "desktop", returningPreference: false, completionDepth: null, campaignSource: null, campaignMedium: null, campaignName: null },
      { eventName: "quote_form_started", preference: "normal", deviceClass: "desktop", returningPreference: false, completionDepth: null, campaignSource: null, campaignMedium: null, campaignName: null },
      { eventName: "quote_form_submitted", preference: "normal", deviceClass: "desktop", returningPreference: false, completionDepth: null, campaignSource: null, campaignMedium: null, campaignName: null },
      { eventName: "interactive_completion_depth", preference: "interactive", deviceClass: "mobile", returningPreference: false, completionDepth: 80, campaignSource: "paid", campaignMedium: "search", campaignName: "v2", },
    ])

    expect(summary.normalSelected).toBe(1)
    expect(summary.formSubmitted).toBe(1)
    expect(summary.quoteSubmissionRate).toBe(100)
    expect(summary.averageInteractiveDepth).toBe(80)
    expect(summary.byCampaign[0]).toEqual({ label: "direct-or-unattributed", count: 4 })
  })
})
