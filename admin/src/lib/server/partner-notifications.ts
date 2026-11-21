import "server-only"

import { createHash, randomUUID } from "node:crypto"
import { sql } from "drizzle-orm"
import { Resend } from "resend"
import type { AdminDatabaseTransaction } from "@/lib/db"
import { buildPartnerEmail, headerSafe, type PartnerEmailInput } from "@/lib/partner-email"

/*
 * Operation Launch Ready: partner lifecycle email.
 *
 * OFF unless PARTNER_EMAIL_ENABLED=true and Resend is configured. Every attempt is logged in partner_notifications with a unique
 * idempotency key (the same key is passed to Resend), a SHA-256 of the recipient instead of the address, the outcome, and the
 * founder who caused it. Sending never throws and never rolls back the founder decision that triggered it: the decision is the
 * record; email is a courtesy whose outcome founders can see and retry. Nothing here logs addresses or message bodies.
 */
type Executor = Pick<AdminDatabaseTransaction, "execute">
export type NotificationStatus = "sent" | "failed" | "not_configured" | "disabled"
export const recipientSha256 = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex")
export const partnerEmailEnabled = (env: NodeJS.ProcessEnv = process.env) => env.PARTNER_EMAIL_ENABLED === "true"
/** Canonical origin for links in partner email: the admin app's AUTH_URL, which must be a ScaleSmiths HTTPS origin. */
export const partnerPortalOrigin = (env: NodeJS.ProcessEnv = process.env) => (env.AUTH_URL ? new URL(env.AUTH_URL).origin : "https://partners.scalesmiths.co.uk")

type Transport = (message: { from: string; to: string; subject: string; html: string; text: string; replyTo?: string }, idempotencyKey: string) => Promise<{ ok: boolean; reason?: string }>

const resendTransport = (apiKey: string): Transport => async (message, idempotencyKey) => {
  try {
    const result = await new Resend(apiKey).emails.send(message, { idempotencyKey })
    return result.error ? { ok: false, reason: "provider_rejected" } : { ok: true }
  } catch {
    return { ok: false, reason: "provider_unreachable" }
  }
}

export async function deliverPartnerEmail(input: {
  to: string; email: PartnerEmailInput; idempotencyKey: string; applicationId?: number | null; partnerId?: string | null; actorId?: string | null
}, options: { env?: NodeJS.ProcessEnv; transport?: Transport } = {}): Promise<{ status: NotificationStatus }> {
  const env = options.env ?? process.env
  const apiKey = env.RESEND_API_KEY?.trim(), from = env.RESEND_FROM?.trim(), replyTo = env.PARTNER_EMAIL_REPLY_TO?.trim()
  let status: NotificationStatus = "sent", reason: string | null = null
  if (!partnerEmailEnabled(env)) { status = "disabled" }
  else if (!apiKey || !from) { status = "not_configured" }
  else {
    try {
      const built = buildPartnerEmail(input.email)
      const sent = await (options.transport ?? resendTransport(apiKey))({ from, to: headerSafe(input.to), subject: headerSafe(built.subject), html: built.html, text: built.text, ...(replyTo ? { replyTo } : {}) }, input.idempotencyKey)
      if (!sent.ok) { status = "failed"; reason = sent.reason ?? "delivery_failed" }
    } catch { status = "failed"; reason = "message_invalid" }
  }
  // Structured, PII-free operational signal for the log pipeline.
  if (status !== "sent") console.warn(JSON.stringify({ level: "warn", component: "partner-notifications", kind: input.email.kind, status, reason, idempotencyKey: input.idempotencyKey }))
  return { status, ...(reason ? { reason } : {}) } as { status: NotificationStatus }
}

/** Send (or record why not) and log the outcome. A repeat with the same key updates the existing row instead of sending twice. */
export async function notifyPartner(tx: Executor, input: Parameters<typeof deliverPartnerEmail>[0], options: Parameters<typeof deliverPartnerEmail>[1] = {}) {
  const prior = (await tx.execute(sql`select status, attempts from partner_notifications where idempotency_key = ${input.idempotencyKey} for update`)).rows[0] as { status: string; attempts: number } | undefined
  if (prior?.status === "sent") return { status: "sent" as const, duplicate: true }
  if (prior && prior.attempts >= 10) return { status: prior.status as NotificationStatus, duplicate: true }
  const outcome = await deliverPartnerEmail(input, options) as { status: NotificationStatus; reason?: string }
  if (prior) {
    await tx.execute(sql`update partner_notifications set status = ${outcome.status}, failure_reason = ${outcome.reason ?? null}, attempts = attempts + 1 where idempotency_key = ${input.idempotencyKey}`)
  } else {
    await tx.execute(sql`insert into partner_notifications (id, idempotency_key, kind, application_id, partner_id, recipient_sha256, status, failure_reason, actor_id)
      values (${randomUUID()}, ${input.idempotencyKey}, ${input.email.kind}, ${input.applicationId ?? null}, ${input.partnerId ?? null}, ${recipientSha256(input.to)}, ${outcome.status}, ${outcome.reason ?? null}, ${input.actorId ?? null})`)
  }
  return { status: outcome.status, duplicate: false }
}
