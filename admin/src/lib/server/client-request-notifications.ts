import "server-only"
import { Resend } from "resend"

export interface ClientReplyNotificationInput {
  requestId: number
  messageId: number
  portalClientId: string
  requestTitle: string
  messageBody: string
  clientEmail: string | null
}

export interface ClientReplyNotificationResult {
  ok: boolean
  status: "sent" | "failed"
  failureReason?: "configuration" | "delivery" | "no_email"
}

export function sanitizeHeaderValue(value: string) {
  return value.replace(/[\r\n\0]/g, "")
}

function resolveConfig(env: NodeJS.ProcessEnv) {
  return {
    apiKey: env.RESEND_API_KEY?.trim() || null,
    from: env.RESEND_FROM?.trim() || null,
    portalUrl: env.NEXT_PUBLIC_PORTAL_URL?.trim().replace(/\/+$/, "") || null,
  }
}

export async function sendClientReplyNotification(
  input: ClientReplyNotificationInput,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ClientReplyNotificationResult> {
  if (!input.clientEmail) {
    return { ok: false, status: "failed", failureReason: "no_email" }
  }

  const config = resolveConfig(env)
  if (!config.apiKey || !config.from) {
    console.warn(`[client-request-notifications] configuration warning for message ${input.messageId}. Reply was not lost.`)
    return { ok: false, status: "failed", failureReason: "configuration" }
  }

  const resend = new Resend(config.apiKey)
  const portalLink = config.portalUrl ? `${config.portalUrl}/portal/${input.portalClientId}?tab=messages` : null
  const subject = `ScaleSmiths replied: ${sanitizeHeaderValue(input.requestTitle)}`.slice(0, 180)

  try {
    const result = await resend.emails.send({
      from: config.from,
      to: sanitizeHeaderValue(input.clientEmail),
      subject,
      html: buildHtml(input, portalLink),
      text: buildText(input, portalLink),
    }, { idempotencyKey: `client-request-message-${input.messageId}` })

    if (result.error) {
      console.warn(`[client-request-notifications] delivery warning for message ${input.messageId}. Reply was not lost.`)
      return { ok: false, status: "failed", failureReason: "delivery" }
    }
  } catch {
    console.warn(`[client-request-notifications] delivery warning for message ${input.messageId}. Reply was not lost.`)
    return { ok: false, status: "failed", failureReason: "delivery" }
  }

  return { ok: true, status: "sent" }
}

function buildHtml(input: ClientReplyNotificationInput, portalLink: string | null) {
  return `
    <div style="background:#080808;padding:28px;font-family:Arial,sans-serif;color:#f4f4f4;">
      <div style="max-width:620px;margin:0 auto;background:#0f0f0f;border:1px solid #242424;border-radius:16px;padding:30px;">
        <div style="color:#2563eb;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">ScaleSmiths</div>
        <h1 style="font-size:26px;line-height:1.1;margin:12px 0 16px;">New reply on your thread.</h1>
        <p style="color:#b6b6b6;font-size:15px;line-height:1.65;margin:0 0 16px;">${escapeHtml(input.messageBody)}</p>
        ${portalLink ? `<p style="margin:0;"><a href="${escapeHtml(portalLink)}" style="color:#60a5fa;">Open your portal</a></p>` : ""}
      </div>
    </div>
  `
}

function buildText(input: ClientReplyNotificationInput, portalLink: string | null) {
  return [
    "New reply on your thread.",
    input.messageBody,
    portalLink ? `Open your portal: ${portalLink}` : "",
  ].filter(Boolean).join("\n")
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}
