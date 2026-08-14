import type { FunnelType } from "./quote-security"

export function quoteEmailContent(funnelType: FunnelType, safeName: string) {
  if (funnelType === "business_growth_audit") {
    return { internalLabel: "New Business Growth Audit request", internalSubject: `Business Growth Audit request from ${safeName}`, confirmationSubject: "Your Business Growth Audit request", confirmationHeading: "Your Audit request is in.", confirmationBody: `Thanks, ${safeName}. We&apos;ll review the business context you supplied, confirm the one-time £395 engagement and delivery date, then send the next step. No payment has been taken through this website.` }
  }
  if (funnelType === "business_email") {
    return {
      internalLabel: "New Managed Business Email enquiry",
      internalSubject: `Business email enquiry from ${safeName}`,
      confirmationSubject: "Your Managed Business Email enquiry",
      confirmationHeading: "Your email setup enquiry is in.",
      confirmationBody: `Thanks, ${safeName}. We&apos;ll review the domain and mailbox details, clarify any migration requirements, and reply with the next onboarding step. Do not send domain or registrar passwords by email.`,
    }
  }
  return {
    internalLabel: "New quote request",
    internalSubject: `New quote request from ${safeName}`,
    confirmationSubject: "You're on our radar",
    confirmationHeading: "You're on our radar.",
    confirmationBody: `Thanks for sending your brief, ${safeName}. We&apos;ll review the details and reply about the next step you requested.`,
  }
}
