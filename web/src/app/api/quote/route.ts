import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { captureWebException, captureWebMessage } from "@/lib/server-monitoring"
import { eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { quoteRateLimits, quoteRequests } from "@/lib/schema"
import {
  QUOTE_RATE_LIMIT_MAX,
  QUOTE_RATE_LIMIT_WINDOW_MS,
  genericQuoteError,
  getClientIp,
  isHoneypotSubmission,
  parseJsonWithLimit,
  quoteRateLimitKeys,
  quoteInsertValues,
  validateQuotePayload,
  type QuotePayload,
} from "@/lib/quote-security"

export const runtime = "nodejs"

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function field(label: string, value: string) {
  return `
    <tr>
      <td style="padding:10px 14px;color:#8f8f8f;border-bottom:1px solid #202020;width:140px;">${label}</td>
      <td style="padding:10px 14px;color:#f4f4f4;border-bottom:1px solid #202020;">${escapeHtml(value || "Not provided")}</td>
    </tr>
  `
}

async function markQuoteEmailStatus(id: number, status: "sent" | "failed", reason?: string) {
  await db
    .update(quoteRequests)
    .set({
      emailDeliveryStatus: status,
      emailFailureReason: status === "failed" ? reason ?? "delivery" : null,
    })
    .where(eq(quoteRequests.id, id))
}

async function checkQuoteRateLimit(keys: string[]) {
  const now = new Date()
  const resetAt = new Date(now.getTime() + QUOTE_RATE_LIMIT_WINDOW_MS)

  for (const key of keys) {
    const [row] = await db
      .insert(quoteRateLimits)
      .values({ key, count: 1, resetAt, updatedAt: now })
      .onConflictDoUpdate({
        target: quoteRateLimits.key,
        set: {
          count: sql<number>`case when ${quoteRateLimits.resetAt} <= ${now} then 1 else ${quoteRateLimits.count} + 1 end`,
          resetAt: sql<Date>`case when ${quoteRateLimits.resetAt} <= ${now} then ${resetAt} else ${quoteRateLimits.resetAt} end`,
          updatedAt: now,
        },
      })
      .returning({ count: quoteRateLimits.count })

    if ((row?.count ?? QUOTE_RATE_LIMIT_MAX + 1) > QUOTE_RATE_LIMIT_MAX) {
      return false
    }
  }

  return true
}

export async function POST(request: NextRequest) {
  const correlationId = request.headers.get("x-request-id") ?? crypto.randomUUID()
  try {
    const parsed = await parseJsonWithLimit<QuotePayload>(request)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status })
    }

    const validation = validateQuotePayload(parsed.data)
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: validation.status })
    }

    const { name, email, biz, websiteUrl, businessType, type, budget, timeframe, goal, needs, carePlanInterest, preferredContactMethod, intent, brief, website } = validation.data
    if (isHoneypotSubmission({ website })) {
      return NextResponse.json({ ok: true })
    }

    const ip = getClientIp(request)
    const allowed = await checkQuoteRateLimit(quoteRateLimitKeys(ip, email))

    if (!allowed) {
      return NextResponse.json(
        { error: genericQuoteError() },
        { status: 429 },
      )
    }

    const [quote] = await db.insert(quoteRequests).values(quoteInsertValues(validation.data)).returning({ id: quoteRequests.id })

    const apiKey = process.env.RESEND_API_KEY
    const from = process.env.RESEND_FROM

    if (!apiKey || !from) {
      await markQuoteEmailStatus(quote.id, "failed", "configuration").catch(() => undefined)
      captureWebMessage("Quote email configuration is incomplete", "warning", { correlationId, quoteId: quote.id, emailOperation: "quote_notification", errorCategory: "email_configuration" })
      return NextResponse.json({ ok: true })
    }

    const resend = new Resend(apiKey)
    const internalHtml = `
      <div style="background:#080808;padding:28px;font-family:Arial,sans-serif;">
        <div style="max-width:680px;margin:0 auto;background:#0f0f0f;border:1px solid #242424;border-radius:16px;overflow:hidden;">
          <div style="padding:24px 26px;border-bottom:1px solid #242424;">
            <div style="color:#2563eb;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">New quote request</div>
            <h1 style="color:#f4f4f4;margin:8px 0 0;font-size:28px;">${escapeHtml(name)}</h1>
          </div>
          <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;">
            ${field("Name", name)}
            ${field("Email", email)}
            ${field("Business", biz)}
            ${field("Current Website", websiteUrl)}
            ${field("Business Type", businessType)}
            ${field("Project Type", type)}
            ${field("Budget", budget)}
            ${field("Launch Timeframe", timeframe)}
            ${field("Main Goal", goal)}
            ${field("Needs", needs.join(", "))}
            ${field("Care Plan Interest", carePlanInterest)}
            ${field("Preferred Contact", preferredContactMethod)}
            ${field("Requested Next Step", intent.replaceAll("_", " "))}
          </table>
          <div style="padding:24px 26px;">
            <div style="color:#8f8f8f;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:10px;">Brief</div>
            <div style="color:#f4f4f4;line-height:1.65;white-space:pre-wrap;">${escapeHtml(brief)}</div>
          </div>
        </div>
      </div>
    `

    const replyHtml = `
      <div style="background:#080808;padding:28px;font-family:Arial,sans-serif;color:#f4f4f4;">
        <div style="max-width:620px;margin:0 auto;background:#0f0f0f;border:1px solid #242424;border-radius:16px;padding:30px;">
          <div style="color:#2563eb;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">ScaleSmiths</div>
          <h1 style="font-size:32px;line-height:1.1;margin:12px 0 16px;">You're on our radar.</h1>
          <p style="color:#b6b6b6;font-size:16px;line-height:1.65;margin:0 0 16px;">
            Thanks for sending your brief, ${escapeHtml(name)}. We&apos;ll review the details and reply about the next step you requested.
          </p>
          <p style="color:#b6b6b6;font-size:16px;line-height:1.65;margin:0;">
            No pitch. No pressure. Just an honest conversation about what your business actually needs.
          </p>
          <div style="height:1px;background:#242424;margin:26px 0;"></div>
          <p style="color:#777;font-size:13px;line-height:1.6;margin:0;">
            We received your request for: <strong style="color:#f4f4f4;">${escapeHtml(type || "a new project")}</strong>
          </p>
        </div>
      </div>
    `

    try {
      const [internal, reply] = await Promise.all([
        resend.emails.send({
          from,
          to: from,
          replyTo: email,
          subject: `New quote request from ${name}`,
          html: internalHtml,
        }),
        resend.emails.send({
          from,
          to: email,
          subject: "You're on our radar",
          html: replyHtml,
        }),
      ])

      if (internal.error || reply.error) {
        await markQuoteEmailStatus(quote.id, "failed", "delivery").catch(() => undefined)
        captureWebMessage("Quote email provider returned a delivery error", "error", { correlationId, quoteId: quote.id, emailOperation: "quote_notification", errorCategory: "email_delivery" })
        return NextResponse.json({ ok: true })
      }

      await markQuoteEmailStatus(quote.id, "sent").catch(() => undefined)
    } catch (error) {
      await markQuoteEmailStatus(quote.id, "failed", "delivery").catch(() => undefined)
      captureWebException(error, { correlationId, quoteId: quote.id, emailOperation: "quote_notification", errorCategory: "email_delivery" })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    captureWebException(error, { correlationId, routePath: "/api/quote", method: "POST", errorCategory: "quote_request" })
    return NextResponse.json({ error: genericQuoteError() }, { status: 500 })
  }
}
