import type { trackEnquiryAnalytics } from "./enquiry-analytics-client"
import type { trackExperienceEvent } from "./experience-analytics-client"

/** Allowlisted first-party metadata for Managed Business Email enquiry analytics. */
export const BUSINESS_EMAIL_EXPERIENCE_METADATA = {
  source: "business_email",
  funnelType: "business_email",
} as const

export const BUSINESS_EMAIL_ENQUIRY_CONTEXT = {
  intent: "business_email",
  funnelType: "business_email",
} as const

type EnquiryTracker = typeof trackEnquiryAnalytics
type ExperienceTracker = typeof trackExperienceEvent

/**
 * Session-scoped analytics for the Managed Business Email enquiry form.
 * Emits Google Analytics enquiry events plus first-party experience events,
 * without form field contents.
 */
export function createBusinessEmailEnquiryAnalytics(deps: {
  trackEnquiry: EnquiryTracker
  trackExperience: ExperienceTracker
}) {
  let started = false

  return {
    onInteraction() {
      if (started) return
      started = true
      deps.trackEnquiry("start", { ...BUSINESS_EMAIL_ENQUIRY_CONTEXT })
      deps.trackExperience("quote_form_started", {
        metadata: { ...BUSINESS_EMAIL_EXPERIENCE_METADATA },
      })
    },
    onSubmitSuccess() {
      deps.trackEnquiry("complete", { ...BUSINESS_EMAIL_ENQUIRY_CONTEXT })
      deps.trackExperience("quote_form_submitted", {
        metadata: { ...BUSINESS_EMAIL_EXPERIENCE_METADATA },
      })
    },
    onSubmitFailure() {
      deps.trackExperience("experience_error", {
        errorCategory: "quote_submission",
        metadata: { ...BUSINESS_EMAIL_EXPERIENCE_METADATA },
      })
    },
  }
}
