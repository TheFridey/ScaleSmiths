import { describe, expect, it } from "vitest"
import {
  QUOTE_RATE_LIMIT_MAX,
  createMemoryQuoteLimiter,
  evaluateQuoteRateLimit,
  genericQuoteError,
  isHoneypotSubmission,
  quoteRateLimitKeys,
  quoteInsertValues,
  resolveQuoteSubmissionResult,
  scoreLeadQuality,
  validateQuotePayload,
} from "./quote-security"

describe("quote security", () => {
  it("rejects invalid quote payloads", () => {
    const result = validateQuotePayload({
      name: "Rhys",
      email: "not-an-email",
      type: "Conversion Website",
      budget: "GBP 4,500-6,500",
      timeframe: "4-6 weeks",
      businessType: "Local service business",
      goal: "More leads",
      preferredContactMethod: "Email",
      consent: true,
      brief: "Build this",
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(400)
    }
  })

  it("requires qualification fields", () => {
    const result = validateQuotePayload({
      name: "Rhys",
      email: "lead@example.com",
      brief: "Build this",
    })

    expect(result.ok).toBe(false)
  })

  it("rejects a complete submission without explicit enquiry consent", () => {
    const result = validateQuotePayload({
      name: "Rhys",
      email: "lead@example.com",
      businessType: "Local service business",
      type: "Conversion Website",
      budget: "GBP 4,500-6,500",
      timeframe: "4-6 weeks",
      goal: "Generate qualified enquiries",
      preferredContactMethod: "Email",
      consent: false,
      brief: "We need a clearer website and enquiry route.",
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(400)
  })

  it("accepts complete quote payloads with selected needs", () => {
    const result = validateQuotePayload({
      name: "Rhys",
      email: "Lead@Example.com",
      biz: "ScaleSmiths",
      websiteUrl: "https://example.com",
      businessType: "SaaS / platform",
      type: "Custom Web App",
      budget: "GBP 18,000-35,000+",
      timeframe: "8-12 weeks",
      goal: "Reduce admin work",
      needs: ["SEO", "Hosting", "Custom Functionality"],
      carePlanInterest: "Maybe",
      preferredContactMethod: "Email",
      intent: "strategy_call",
      consent: true,
      brief: "We need a portal.",
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.email).toBe("lead@example.com")
      expect(result.data.needs).toEqual(["SEO", "Hosting", "Custom Functionality"])
      const record = quoteInsertValues(result.data)
      expect(record.consent).toBe(true)
      expect(record.enquiryIntent).toBe("strategy_call")
      expect(record).not.toHaveProperty("marketingConsent")
    }
  })

  it("defaults unknown enquiry intent instead of persisting arbitrary values", () => {
    const result = validateQuotePayload({
      name: "Rhys",
      email: "lead@example.com",
      businessType: "Local service business",
      type: "Conversion Website",
      budget: "GBP 4,500-6,500",
      timeframe: "4-6 weeks",
      goal: "Generate qualified enquiries",
      preferredContactMethod: "Email",
      consent: true,
      intent: "book_me_without_a_scheduler",
      brief: "We need a clearer website and enquiry route.",
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.intent).toBe("quote")
  })

  it("scores high-intent leads server-side", () => {
    const result = validateQuotePayload({
      name: "Rhys",
      email: "lead@example.com",
      businessType: "SaaS / platform",
      type: "Custom Web App",
      budget: "GBP 18,000-35,000+",
      timeframe: "8-12 weeks",
      goal: "We need to reduce manual admin and turn this workflow into a portal.",
      needs: ["Custom Functionality", "Care Plan"],
      carePlanInterest: "Yes",
      preferredContactMethod: "Video call",
      consent: true,
      brief: "The current workflow is spread across email, spreadsheets, and manual follow-up. We need a proper web app with secure access.",
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(scoreLeadQuality(result.data)).toBe("high")
    }
  })

  it("detects honeypot submissions", () => {
    expect(isHoneypotSubmission({ website: "spam-site" })).toBe(true)
    expect(isHoneypotSubmission({ website: "" })).toBe(false)
  })

  it("blocks rate-limited records before the reset time", () => {
    const now = new Date("2026-06-01T10:00:00.000Z")
    const decision = evaluateQuoteRateLimit({
      count: 3,
      resetAt: new Date("2026-06-01T10:05:00.000Z"),
    }, now)

    expect(decision.allowed).toBe(false)
  })

  it("resets expired rate-limit records", () => {
    const now = new Date("2026-06-01T10:00:00.000Z")
    const decision = evaluateQuoteRateLimit({
      count: 3,
      resetAt: new Date("2026-06-01T09:59:00.000Z"),
    }, now)

    expect(decision).toEqual({ allowed: true, nextCount: 1, reset: true })
  })

  it("keys rate limits by hashed IP and email", () => {
    const [ipKey, emailKey] = quoteRateLimitKeys("203.0.113.10", "Lead@Example.com")

    expect(ipKey).toMatch(/^quote:ip:[a-f0-9]{64}$/)
    expect(emailKey).toMatch(/^quote:email:[a-f0-9]{64}$/)
    expect(emailKey).not.toContain("Lead@Example.com")
    expect(ipKey).not.toContain("203.0.113.10")
  })

  it("allows quote submissions below the rate limit", async () => {
    const limiter = createMemoryQuoteLimiter()
    const keys = quoteRateLimitKeys("203.0.113.10", "lead@example.com")

    expect(await limiter.check(keys, Date.parse("2026-06-01T10:00:00.000Z"))).toBe(true)
  })

  it("blocks quote submissions after the rate limit", async () => {
    const limiter = createMemoryQuoteLimiter(2)
    const keys = quoteRateLimitKeys("203.0.113.10", "lead@example.com")
    const now = Date.parse("2026-06-01T10:00:00.000Z")

    expect(await limiter.check(keys, now)).toBe(true)
    expect(await limiter.check(keys, now)).toBe(true)
    expect(await limiter.check(keys, now)).toBe(false)
  })

  it("keeps a race-like burst to the configured quote limit", async () => {
    const limiter = createMemoryQuoteLimiter()
    const keys = quoteRateLimitKeys("203.0.113.10", "lead@example.com")
    const now = Date.parse("2026-06-01T10:00:00.000Z")
    const results = await Promise.all(
      Array.from({ length: QUOTE_RATE_LIMIT_MAX + 2 }, () => limiter.check(keys, now)),
    )

    expect(results.filter(Boolean)).toHaveLength(QUOTE_RATE_LIMIT_MAX)
    expect(results.filter((result) => !result)).toHaveLength(2)
  })

  it("returns success when persistence works and email sends", () => {
    expect(resolveQuoteSubmissionResult({ persisted: true, emailDelivered: true })).toMatchObject({
      ok: true,
      status: 200,
      emailDeliveryStatus: "sent",
      emailFailureReason: null,
    })
  })

  it("returns success when persistence works and email delivery fails", () => {
    expect(resolveQuoteSubmissionResult({
      persisted: true,
      emailDelivered: false,
      emailFailureReason: "delivery",
    })).toMatchObject({
      ok: true,
      status: 200,
      emailDeliveryStatus: "failed",
      emailFailureReason: "delivery",
    })
  })

  it("returns a generic failure when quote persistence fails", () => {
    const result = resolveQuoteSubmissionResult({ persisted: false })

    expect(result.ok).toBe(false)
    expect(result.status).toBe(500)
    expect(result.publicError).toBe(genericQuoteError())
  })

  it("uses a generic message for email failure handling", () => {
    expect(genericQuoteError()).toBe("Unable to submit your brief right now. Please try again later.")
    expect(genericQuoteError()).not.toContain("RESEND")
    expect(resolveQuoteSubmissionResult({
      persisted: true,
      emailDelivered: false,
      emailFailureReason: "configuration",
    })).not.toMatchObject({ publicError: expect.stringContaining("RESEND") })
  })
})
