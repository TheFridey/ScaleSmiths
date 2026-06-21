export const FORGE_RESEND_PROVIDER = "resend"

export const FORGE_RESEND_REPLY_TO_BEHAVIOURS = ["submitter", "from_email", "none"] as const
export type ForgeResendReplyToBehaviour = (typeof FORGE_RESEND_REPLY_TO_BEHAVIOURS)[number]

export interface ForgeResendConfig extends Record<string, unknown> {
  fromEmail: string
  toEmail: string
  replyToBehaviour: ForgeResendReplyToBehaviour
  subjectPrefix: string
  testMode: boolean
  enabled: boolean
}

type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string }

export function defaultForgeResendConfig(): ForgeResendConfig {
  return {
    fromEmail: "",
    toEmail: "",
    replyToBehaviour: "submitter",
    subjectPrefix: "Website enquiry",
    testMode: true,
    enabled: false,
  }
}

export function parseForgeResendConfigPayload(input: Record<string, unknown>): ParseResult<ForgeResendConfig> {
  const fromEmail = cleanString(input.fromEmail, 240)
  const toEmail = cleanString(input.toEmail, 240)
  const replyToBehaviour = cleanString(input.replyToBehaviour, 40)
  const subjectPrefix = cleanString(input.subjectPrefix, 120) || "Website enquiry"
  const enabled = input.enabled === true
  const testMode = input.testMode !== false

  if (enabled) {
    if (!fromEmail || !isEmail(fromEmail)) return { ok: false, error: "From email is required when Resend is enabled." }
    if (!toEmail || !isEmail(toEmail)) return { ok: false, error: "To email is required when Resend is enabled." }
  } else {
    if (fromEmail && !isEmail(fromEmail)) return { ok: false, error: "From email must be a valid email address." }
    if (toEmail && !isEmail(toEmail)) return { ok: false, error: "To email must be a valid email address." }
  }

  if (!FORGE_RESEND_REPLY_TO_BEHAVIOURS.includes(replyToBehaviour as ForgeResendReplyToBehaviour)) {
    return { ok: false, error: "Reply-to behaviour is invalid." }
  }

  return {
    ok: true,
    data: {
      fromEmail,
      toEmail,
      replyToBehaviour: replyToBehaviour as ForgeResendReplyToBehaviour,
      subjectPrefix,
      testMode,
      enabled,
    },
  }
}

export function readForgeResendConfig(config: Record<string, unknown> | null | undefined, enabledFallback = false): ForgeResendConfig {
  const parsed = parseForgeResendConfigPayload({
    ...defaultForgeResendConfig(),
    ...(config ?? {}),
    enabled: typeof config?.enabled === "boolean" ? config.enabled : enabledFallback,
  })

  return parsed.ok ? parsed.data : defaultForgeResendConfig()
}

export function redactForgeResendConfig(config: ForgeResendConfig) {
  return {
    fromEmail: config.fromEmail,
    toEmail: config.toEmail,
    replyToBehaviour: config.replyToBehaviour,
    subjectPrefix: config.subjectPrefix,
    testMode: config.testMode,
    enabled: config.enabled,
    apiKey: "[environment: RESEND_API_KEY]",
  }
}

export function buildResendIntegrationPlaceholder(config: ForgeResendConfig) {
  return config.enabled
    ? `Resend enabled: from ${config.fromEmail}, to ${config.toEmail}, reply-to ${config.replyToBehaviour}, subject prefix "${config.subjectPrefix}", test mode ${config.testMode ? "on" : "off"}.`
    : "Resend disabled: generated contact form remains in safe test mode until enabled."
}

export function generatedResendConfigForSite(config: ForgeResendConfig) {
  return {
    enabled: config.enabled,
    testMode: config.testMode,
    fromEmail: config.fromEmail,
    toEmail: config.toEmail,
    replyToBehaviour: config.replyToBehaviour,
    subjectPrefix: config.subjectPrefix,
  }
}

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

function isEmail(value: string) {
  const match = value.match(/<([^>]+)>$/)
  const email = match ? match[1].trim() : value.trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}
