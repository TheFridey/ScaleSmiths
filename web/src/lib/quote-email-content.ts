import type { FunnelType } from "./quote-security"

export function quoteEmailContent(funnelType: FunnelType, safeName: string) {
  if (funnelType === "local_growth_check") {
    return {
      internalLabel: "New local growth check",
      internalSubject: `Local growth check from ${safeName}`,
      confirmationSubject: "We received your local growth check",
      confirmationHeading: "Your local growth check is in.",
      confirmationBody: `Thanks, ${safeName}. A ScaleSmiths founder will review the public information you shared and your main goal, then reply with the most useful next step. There is no obligation to commission a full build.`,
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
