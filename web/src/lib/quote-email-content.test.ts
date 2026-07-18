import { describe, expect, it } from "vitest"
import { quoteEmailContent } from "./quote-email-content"

describe("quote confirmation email content", () => {
  it("uses a no-obligation founder-led confirmation without an unsupported response promise", () => {
    const content = quoteEmailContent("local_growth_check", "Alex")
    const copy = Object.values(content).join(" ")

    expect(content.confirmationSubject).toBe("We received your local growth check")
    expect(copy).toContain("ScaleSmiths founder")
    expect(copy).toContain("no obligation")
    expect(copy).not.toMatch(/within \d+|24 hours|same day|guarantee/i)
  })
})
