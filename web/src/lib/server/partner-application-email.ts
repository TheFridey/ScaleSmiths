import "server-only"

import { createHash, randomUUID } from "node:crypto"
import { sql } from "drizzle-orm"
import { Resend } from "resend"
import { db } from "@/lib/db"
import { buildPartnerEmail, headerSafe } from "../../../../domain/partner-email"

/*
 * Operation Launch Ready: "application received" confirmation for partner applicants.
 * OFF unless PARTNER_EMAIL_ENABLED=true and Resend is configured. Runs after the application is saved and never affects the
 * response. The outcome is logged in partner_notifications with a SHA-256 of the address only (the web role may insert there
 * and nothing else). No address or message body is written to logs.
 */
type Transport = (message: { from: string; to: string; subject: string; html: string; text: string }, idempotencyKey: string) => Promise<boolean>
const resend = (apiKey: string): Transport => async (message, key) => {
  try { return !(await new Resend(apiKey).emails.send(message, { idempotencyKey: key })).error } catch { return false }
}

export async function sendApplicationReceived(input: { name: string; email: string }, options: { env?: NodeJS.ProcessEnv; transport?: Transport; execute?: (query: ReturnType<typeof sql>) => Promise<unknown> } = {}) {
  const env = options.env ?? process.env
  const key = `application-received-${randomUUID()}`
  const apiKey = env.RESEND_API_KEY?.trim(), from = env.RESEND_FROM?.trim()
  let status: "sent" | "failed" | "not_configured" | "disabled" = "sent"
  if (env.PARTNER_EMAIL_ENABLED !== "true") status = "disabled"
  else if (!apiKey || !from) status = "not_configured"
  else {
    const built = buildPartnerEmail({ kind: "application_received", name: input.name })
    const ok = await (options.transport ?? resend(apiKey))({ from, to: headerSafe(input.email), subject: built.subject, html: built.html, text: built.text }, key)
    if (!ok) status = "failed"
  }
  if (status !== "sent") console.warn(JSON.stringify({ level: "warn", component: "partner-application-email", status, idempotencyKey: key }))
  const recipient = createHash("sha256").update(input.email.trim().toLowerCase()).digest("hex")
  try {
    await (options.execute ?? ((q) => db.execute(q)))(sql`insert into partner_notifications (id, idempotency_key, kind, recipient_sha256, status, failure_reason)
      values (${randomUUID()}, ${key}, 'application_received', ${recipient}, ${status}, ${status === "failed" ? "delivery_failed" : null})`)
  } catch {
    console.warn(JSON.stringify({ level: "warn", component: "partner-application-email", status: "log_failed", idempotencyKey: key }))
  }
  return status
}
