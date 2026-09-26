import { describe, expect, it } from "vitest"
import { quoteEmailContent } from "./quote-email-content"

describe("quote confirmation email content", () => {
  it("uses an accurate paid Audit confirmation without an unsupported response promise", () => {
    const content = quoteEmailContent("business_growth_audit", "Alex")
    const copy = Object.values(content).join(" ")

    expect(content.confirmationSubject).toBe("Your Business Growth Audit request")
    expect(copy).toContain("£395")
    expect(copy).toContain("No payment has been taken")
    expect(copy).not.toMatch(/within \d+|24 hours|same day|guarantee/i)
  })

  it("uses enterprise discovery confirmation copy without unsupported response promises", () => {
    const content = quoteEmailContent("enterprise", "Alex")
    const copy = Object.values(content).join(" ")

    expect(content.internalLabel).toMatch(/enterprise discovery/i)
    expect(content.confirmationSubject).toBe("Your enterprise discovery enquiry")
    expect(copy).toContain("discovery")
    expect(copy).toContain("No payment has been taken")
    expect(copy).not.toMatch(/within \d+|24 hours|same day|guarantee/i)
  })
})
