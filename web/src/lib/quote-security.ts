import { createHash } from "crypto"
import type { NextRequest } from "next/server"
import { parseEnquiryIntent, type EnquiryIntent } from "./enquiry-intents"

export const QUOTE_BODY_LIMIT_BYTES = 16 * 1024
export const QUOTE_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
export const QUOTE_RATE_LIMIT_MAX = 3

export interface QuotePayload {
  name?: unknown
  email?: unknown
  biz?: unknown
  websiteUrl?: unknown
  businessType?: unknown
  type?: unknown
  budget?: unknown
  timeframe?: unknown
  goal?: unknown
  needs?: unknown
  carePlanInterest?: unknown
  preferredContactMethod?: unknown
  intent?: unknown
  consent?: unknown
  brief?: unknown
  website?: unknown
}

export interface ValidQuotePayload {
  name: string
  email: string
  biz: string
  websiteUrl: string
  businessType: string
  type: string
  budget: string
  timeframe: string
  goal: string
  needs: string[]
  carePlanInterest: string
  preferredContactMethod: string
  intent: EnquiryIntent
  consent: boolean
  brief: string
  website: string
}

export function quoteInsertValues(data: ValidQuotePayload) {
  return {
    name: data.name,
    email: data.email,
    business: data.biz || null,
    websiteUrl: data.websiteUrl || null,
    businessType: data.businessType || null,
    projectType: data.type || null,
    budget: data.budget || null,
    launchTimeframe: data.timeframe || null,
    mainGoal: data.goal || null,
    needs: data.needs.length ? data.needs.join(", ") : null,
    carePlanInterest: data.carePlanInterest || null,
    preferredContactMethod: data.preferredContactMethod || null,
    enquiryIntent: data.intent,
    consent: data.consent,
    leadQuality: scoreLeadQuality(data),
    brief: data.brief,
  }
}

export type LeadQuality = "high" | "medium" | "low"

export type QuoteValidationResult =
  | { ok: true; data: ValidQuotePayload }
  | { ok: false; status: number; error: string }

export interface QuoteRateLimitRecord {
  count: number
  resetAt: Date
}

export type QuoteEmailDeliveryStatus = "sent" | "failed"
export type QuoteEmailFailureReason = "configuration" | "delivery"

export function genericQuoteError() {
  return "Unable to submit your brief right now. Please try again later."
}

export function isHoneypotSubmission(payload: Pick<ValidQuotePayload, "website">) {
  return Boolean(payload.website)
}

export function evaluateQuoteRateLimit(
  record: QuoteRateLimitRecord | null,
  now: Date,
  max = QUOTE_RATE_LIMIT_MAX,
) {
  if (!record || record.resetAt <= now) {
    return { allowed: true, nextCount: 1, reset: true }
  }

  if (record.count >= max) {
    return { allowed: false, nextCount: record.count, reset: false }
  }

  return { allowed: true, nextCount: record.count + 1, reset: false }
}

export function cleanString(value: unknown, maxLength = 2000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

export function validateQuotePayload(payload: QuotePayload): QuoteValidationResult {
  const data = {
    name: cleanString(payload.name, 120),
    email: cleanString(payload.email, 254).toLowerCase(),
    biz: cleanString(payload.biz, 160),
    websiteUrl: cleanString(payload.websiteUrl, 240),
    businessType: cleanString(payload.businessType, 120),
    type: cleanString(payload.type, 120),
    budget: cleanString(payload.budget, 80),
    timeframe: cleanString(payload.timeframe, 120),
    goal: cleanString(payload.goal, 240),
    needs: Array.isArray(payload.needs)
      ? payload.needs.map((item) => cleanString(item, 80)).filter(Boolean).slice(0, 8)
      : [],
    carePlanInterest: cleanString(payload.carePlanInterest, 80),
    preferredContactMethod: cleanString(payload.preferredContactMethod, 80),
    intent: parseEnquiryIntent(payload.intent),
    consent: payload.consent === true,
    brief: cleanString(payload.brief, 5000),
    website: cleanString(payload.website, 200),
  }

  if (!data.name || !data.email || !data.brief || !data.type || !data.budget || !data.timeframe || !data.goal || !data.businessType || !data.preferredContactMethod || !data.consent) {
    return { ok: false, status: 400, error: "Please check the required fields and try again." }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return { ok: false, status: 400, error: "Please check the required fields and try again." }
  }

  return { ok: true, data }
}

export function scoreLeadQuality(payload: ValidQuotePayload): LeadQuality {
  let score = 0

  if (payload.budget.includes("18,000") || payload.budget.includes("8,000")) score += 2
  if (!payload.budget.includes("Not sure")) score += 1
  if (payload.timeframe.includes("ASAP") || payload.timeframe.includes("4-6") || payload.timeframe.includes("8-12")) score += 1
  if (payload.needs.includes("Custom Functionality") || payload.needs.includes("Payments") || payload.needs.includes("Care Plan")) score += 1
  if (payload.carePlanInterest === "Yes" || payload.carePlanInterest === "Maybe") score += 1
  if (payload.goal.length > 30 && payload.brief.length > 60) score += 1

  if (score >= 5) return "high"
  if (score >= 3) return "medium"
  return "low"
}

export function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return (
    forwarded ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  )
}

export function quoteRateLimitKeys(ip: string, email: string) {
  const ipHash = createHash("sha256").update(ip).digest("hex")
  const emailHash = createHash("sha256").update(email.toLowerCase()).digest("hex")

  return [`quote:ip:${ipHash}`, `quote:email:${emailHash}`]
}

export function createMemoryQuoteLimiter(max = QUOTE_RATE_LIMIT_MAX, windowMs = QUOTE_RATE_LIMIT_WINDOW_MS) {
  const records = new Map<string, { count: number; resetAt: number }>()

  return {
    async check(keys: string[], now = Date.now()) {
      for (const key of keys) {
        const record = records.get(key)
        const next =
          !record || record.resetAt <= now
            ? { count: 1, resetAt: now + windowMs }
            : { count: record.count + 1, resetAt: record.resetAt }

        records.set(key, next)

        if (next.count > max) {
          return false
        }
      }

      return true
    },
    records,
  }
}

export function resolveQuoteSubmissionResult({
  persisted,
  emailDelivered,
  emailFailureReason = "delivery",
}: {
  persisted: boolean
  emailDelivered?: boolean
  emailFailureReason?: QuoteEmailFailureReason
}) {
  if (!persisted) {
    return {
      ok: false as const,
      status: 500,
      publicError: genericQuoteError(),
      emailDeliveryStatus: null,
      emailFailureReason: null,
    }
  }

  if (emailDelivered) {
    return {
      ok: true as const,
      status: 200,
      publicError: null,
      emailDeliveryStatus: "sent" as const,
      emailFailureReason: null,
    }
  }

  return {
    ok: true as const,
    status: 200,
    publicError: null,
    emailDeliveryStatus: "failed" as const,
    emailFailureReason,
  }
}

export async function parseJsonWithLimit<T>(request: NextRequest, limit = QUOTE_BODY_LIMIT_BYTES) {
  const contentLength = Number.parseInt(request.headers.get("content-length") ?? "0", 10)

  if (Number.isFinite(contentLength) && contentLength > limit) {
    return { ok: false as const, status: 413, error: "Request body is too large." }
  }

  const body = await request.text()

  if (Buffer.byteLength(body, "utf8") > limit) {
    return { ok: false as const, status: 413, error: "Request body is too large." }
  }

  try {
    return { ok: true as const, data: JSON.parse(body) as T }
  } catch {
    return { ok: false as const, status: 400, error: "Invalid request body." }
  }
}
