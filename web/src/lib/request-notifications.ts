import { Resend } from "resend"
import type {
  ClientRequestCategory,
  ClientRequestPriority,
} from "./client-requests"
import { captureWebException, captureWebMessage } from "./server-monitoring"

export interface ClientRequestNotificationInput {
  requestId: number
  correlationId?: string
  actorId?: string
  clientId: string
  clientName: string
  clientEmail?: string | null
  title: string
  category: ClientRequestCategory
  priority: ClientRequestPriority
  affectedUrl?: string | null
}

export interface ClientRequestNotificationResult {
  ok: boolean
  reason?: "configuration" | "delivery"
  status: "sent" | "failed"
  failureReason?: "configuration" | "delivery"
}

const CATEGORY_LABELS: Record<ClientRequestCategory, string> = {
  website_update: "Website update",
  website_issue: "Website issue",
  form_issue: "Contact form problem",
  seo_request: "SEO request",
  new_page: "New page request",
  content_assets: "Content/images/assets",
  urgent_support: "Urgent support",
  general_support: "General support",
}

const PRIORITY_LABELS: Record<ClientRequestPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
}

export function deriveClientDisplayName(clientId: string) {
  const cleaned = clientId
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/.#?]/)[0]
    .replace(/[-_]+/g, " ")
    .trim()

  if (!cleaned) return "Client workspace"
  return cleaned.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function isCriticalClientRequest(category: ClientRequestCategory, priority: ClientRequestPriority) {
  return priority === "critical" || category === "urgent_support"
}

export function resolveRequestNotificationConfig(env: NodeJS.ProcessEnv = process.env) {
  const adminPortalUrl = cleanUrl(env.ADMIN_PORTAL_URL || env.NEXT_PUBLIC_ADMIN_URL)

  return {
    apiKey: cleanString(env.RESEND_API_KEY),
    from: cleanString(env.RESEND_FROM),
    supportEmail: cleanString(env.SUPPORT_EMAIL || env.RESEND_FROM),
    adminPortalUrl,
  }
}

export function buildAdminRequestLink(requestId: number, env: NodeJS.ProcessEnv = process.env) {
  const { adminPortalUrl } = resolveRequestNotificationConfig(env)
  return adminPortalUrl ? `${adminPortalUrl}/requests?request=${requestId}` : null
}

export function buildAdminRequestSubject(input: ClientRequestNotificationInput) {
  const critical = isCriticalClientRequest(input.category, input.priority)
  return `${critical ? "[CRITICAL] " : ""}Client request: ${input.title}`.slice(0, 180)
}

export function buildClientConfirmationSubject(input: ClientRequestNotificationInput) {
  const critical = isCriticalClientRequest(input.category, input.priority)
  return `${critical ? "Urgent request received" : "Request received"} - ${input.title}`.slice(0, 180)
}

export async function sendClientRequestNotifications(
  input: ClientRequestNotificationInput,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ClientRequestNotificationResult> {
  const config = resolveRequestNotificationConfig(env)

  if (!config.apiKey || !config.from || !config.supportEmail) {
    warnRequestNotification("configuration", input.requestId)
    captureWebMessage("Client request email configuration is incomplete", "warning", { correlationId: input.correlationId, actorId: input.actorId, clientRequestId: input.requestId, emailOperation: "client_request_notification", errorCategory: "email_configuration" })
    return { ok: false, reason: "configuration", status: "failed", failureReason: "configuration" }
  }

  const resend = new Resend(config.apiKey)
  const critical = isCriticalClientRequest(input.category, input.priority)
  const adminLink = buildAdminRequestLink(input.requestId, env)

  const messages = [
    resend.emails.send({
      from: config.from,
      to: config.supportEmail,
      replyTo: input.clientEmail ?? undefined,
      subject: buildAdminRequestSubject(input),
      html: buildAdminEmailHtml(input, adminLink),
      text: buildAdminEmailText(input, adminLink),
    }),
  ]

  if (input.clientEmail) {
    messages.push(resend.emails.send({
      from: config.from,
      to: input.clientEmail,
      subject: buildClientConfirmationSubject(input),
      html: buildClientConfirmationHtml(input),
      text: buildClientConfirmationText(input),
    }))
  }

  try {
    const results = await Promise.all(messages)
    if (results.some((result) => result.error)) {
      warnRequestNotification("delivery", input.requestId)
      captureWebMessage("Client request email provider returned a delivery error", "error", { correlationId: input.correlationId, actorId: input.actorId, clientRequestId: input.requestId, emailOperation: "client_request_notification", errorCategory: "email_delivery" })
      return { ok: false, reason: "delivery", status: "failed", failureReason: "delivery" }
    }
  } catch (error) {
    warnRequestNotification("delivery", input.requestId)
    captureWebException(error, { correlationId: input.correlationId, actorId: input.actorId, clientRequestId: input.requestId, emailOperation: "client_request_notification", errorCategory: "email_delivery" })
    return { ok: false, reason: "delivery", status: "failed", failureReason: "delivery" }
  }

  if (critical) {
    console.warn(`[request-notifications] Critical request ${input.requestId} notification sent.`)
  }

  return { ok: true, status: "sent" }
}

function buildAdminEmailHtml(input: ClientRequestNotificationInput, adminLink: string | null) {
  const critical = isCriticalClientRequest(input.category, input.priority)
  return `
    <div style="background:#080808;padding:28px;font-family:Arial,sans-serif;">
      <div style="max-width:680px;margin:0 auto;background:#0f0f0f;border:1px solid ${critical ? "#7f1d1d" : "#242424"};border-radius:16px;overflow:hidden;">
        <div style="padding:24px 26px;border-bottom:1px solid #242424;">
          <div style="color:${critical ? "#ef4444" : "#2563eb"};font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">${critical ? "Critical client request" : "New client request"}</div>
          <h1 style="color:#f4f4f4;margin:8px 0 0;font-size:26px;">${escapeHtml(input.title)}</h1>
        </div>
        <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;">
          ${field("Client", input.clientName)}
          ${field("Client ID", input.clientId)}
          ${field("Category", CATEGORY_LABELS[input.category])}
          ${field("Priority", PRIORITY_LABELS[input.priority])}
          ${field("Affected URL", input.affectedUrl ?? "Not provided")}
          ${field("Admin link", adminLink ?? "Not configured")}
        </table>
      </div>
    </div>
  `
}

function buildAdminEmailText(input: ClientRequestNotificationInput, adminLink: string | null) {
  return [
    isCriticalClientRequest(input.category, input.priority) ? "CRITICAL CLIENT REQUEST" : "New client request",
    `Client: ${input.clientName}`,
    `Client ID: ${input.clientId}`,
    `Title: ${input.title}`,
    `Category: ${CATEGORY_LABELS[input.category]}`,
    `Priority: ${PRIORITY_LABELS[input.priority]}`,
    `Affected URL: ${input.affectedUrl ?? "Not provided"}`,
    `Admin link: ${adminLink ?? "Not configured"}`,
  ].join("\n")
}

function buildClientConfirmationHtml(input: ClientRequestNotificationInput) {
  const critical = isCriticalClientRequest(input.category, input.priority)
  return `
    <div style="background:#080808;padding:28px;font-family:Arial,sans-serif;color:#f4f4f4;">
      <div style="max-width:620px;margin:0 auto;background:#0f0f0f;border:1px solid #242424;border-radius:16px;padding:30px;">
        <div style="color:#2563eb;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">ScaleSmiths</div>
        <h1 style="font-size:30px;line-height:1.1;margin:12px 0 16px;">Request received.</h1>
        <p style="color:#b6b6b6;font-size:16px;line-height:1.65;margin:0 0 16px;">
          Thanks. We received <strong style="color:#f4f4f4;">${escapeHtml(input.title)}</strong> and logged it in your client portal.
        </p>
        <p style="color:#b6b6b6;font-size:15px;line-height:1.65;margin:0 0 16px;">
          Category: <strong style="color:#f4f4f4;">${CATEGORY_LABELS[input.category]}</strong><br/>
          Priority: <strong style="color:#f4f4f4;">${PRIORITY_LABELS[input.priority]}</strong>
        </p>
        <p style="color:#b6b6b6;font-size:15px;line-height:1.65;margin:0;">
          ${critical ? "Because this is marked critical, use your agreed direct line as well if the issue is blocking enquiries, payments, domain, SSL, or site availability." : "We will triage it and update the request status in the portal."}
        </p>
      </div>
    </div>
  `
}

function buildClientConfirmationText(input: ClientRequestNotificationInput) {
  const critical = isCriticalClientRequest(input.category, input.priority)
  return [
    "Request received.",
    `Title: ${input.title}`,
    `Category: ${CATEGORY_LABELS[input.category]}`,
    `Priority: ${PRIORITY_LABELS[input.priority]}`,
    critical
      ? "Because this is marked critical, use your agreed direct line as well if the issue is blocking enquiries, payments, domain, SSL, or site availability."
      : "We will triage it and update the request status in the portal.",
  ].join("\n")
}

function field(label: string, value: string) {
  return `
    <tr>
      <td style="padding:10px 14px;color:#8f8f8f;border-bottom:1px solid #202020;width:140px;">${escapeHtml(label)}</td>
      <td style="padding:10px 14px;color:#f4f4f4;border-bottom:1px solid #202020;">${escapeHtml(value || "Not provided")}</td>
    </tr>
  `
}

function warnRequestNotification(reason: "configuration" | "delivery", requestId: number) {
  console.warn(`[request-notifications] ${reason} warning for request ${requestId}. Request creation was not blocked.`)
}

function cleanString(value: string | undefined) {
  return value?.trim() || null
}

function cleanUrl(value: string | undefined) {
  const clean = value?.trim().replace(/\/+$/, "")
  return clean || null
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}
