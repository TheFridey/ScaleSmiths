export const FORGE_WHATSAPP_PROVIDER = "whatsapp"

export const FORGE_WHATSAPP_PLACEMENTS = ["sticky", "inline", "service_pages", "contact_page"] as const
export type ForgeWhatsAppPlacement = (typeof FORGE_WHATSAPP_PLACEMENTS)[number]

export interface ForgeWhatsAppConfig extends Record<string, unknown> {
  businessNumber: string
  defaultMessage: string
  ctaLabel: string
  placements: ForgeWhatsAppPlacement[]
  enabled: boolean
}

type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string }

export function defaultForgeWhatsAppConfig(): ForgeWhatsAppConfig {
  return {
    businessNumber: "",
    defaultMessage: "Hi, I would like to ask about your services.",
    ctaLabel: "WhatsApp us",
    placements: ["sticky", "inline", "contact_page"],
    enabled: false,
  }
}

export function parseForgeWhatsAppConfigPayload(input: Record<string, unknown>): ParseResult<ForgeWhatsAppConfig> {
  const businessNumber = cleanString(input.businessNumber, 40)
  const defaultMessage = cleanString(input.defaultMessage, 240) || "Hi, I would like to ask about your services."
  const ctaLabel = cleanString(input.ctaLabel, 80) || "WhatsApp us"
  const enabled = input.enabled === true
  const placements = parsePlacements(input.placements)

  if (enabled && !isValidWhatsAppNumber(businessNumber)) {
    return { ok: false, error: "Business WhatsApp number must be a valid international number, for example +447700900123." }
  }

  if (!enabled && businessNumber && !isValidWhatsAppNumber(businessNumber)) {
    return { ok: false, error: "Business WhatsApp number must be a valid international number, for example +447700900123." }
  }

  if (enabled && placements.length === 0) {
    return { ok: false, error: "Choose at least one WhatsApp placement when enabled." }
  }

  return {
    ok: true,
    data: {
      businessNumber,
      defaultMessage,
      ctaLabel,
      placements,
      enabled,
    },
  }
}

export function readForgeWhatsAppConfig(config: Record<string, unknown> | null | undefined, enabledFallback = false): ForgeWhatsAppConfig {
  const parsed = parseForgeWhatsAppConfigPayload({
    ...defaultForgeWhatsAppConfig(),
    ...(config ?? {}),
    enabled: typeof config?.enabled === "boolean" ? config.enabled : enabledFallback,
  })

  return parsed.ok ? parsed.data : defaultForgeWhatsAppConfig()
}

export function redactForgeWhatsAppConfig(config: ForgeWhatsAppConfig) {
  return {
    businessNumber: config.businessNumber,
    defaultMessage: config.defaultMessage,
    ctaLabel: config.ctaLabel,
    placements: config.placements,
    enabled: config.enabled,
    cloudApi: {
      accessToken: "[future env: WHATSAPP_ACCESS_TOKEN]",
      phoneNumberId: "[future env: WHATSAPP_PHONE_NUMBER_ID]",
      verifyToken: "[future env: WHATSAPP_VERIFY_TOKEN]",
    },
  }
}

export function normalizeWhatsAppNumber(value: string) {
  return value.replace(/[^\d+]/g, "").replace(/^\+/, "")
}

export function isValidWhatsAppNumber(value: string) {
  const normalized = normalizeWhatsAppNumber(value)
  return /^[1-9]\d{7,14}$/.test(normalized)
}

export function buildWhatsAppUrl(number: string, message: string) {
  const normalized = normalizeWhatsAppNumber(number)
  if (!isValidWhatsAppNumber(normalized)) return null
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
}

export function buildWhatsAppIntegrationPlaceholder(config: ForgeWhatsAppConfig) {
  return config.enabled
    ? `WhatsApp enabled: ${config.businessNumber}, label "${config.ctaLabel}", placements ${config.placements.join(", ")}.`
    : "WhatsApp disabled: generated CTAs stay hidden until enabled."
}

export function generatedWhatsAppConfigForSite(config: ForgeWhatsAppConfig) {
  return {
    enabled: config.enabled,
    businessNumber: normalizeWhatsAppNumber(config.businessNumber),
    defaultMessage: config.defaultMessage,
    ctaLabel: config.ctaLabel,
    placements: config.placements,
  }
}

function parsePlacements(value: unknown) {
  if (!Array.isArray(value)) return defaultForgeWhatsAppConfig().placements
  const placements = value.filter((item): item is ForgeWhatsAppPlacement =>
    typeof item === "string" && FORGE_WHATSAPP_PLACEMENTS.includes(item as ForgeWhatsAppPlacement),
  )
  return [...new Set(placements)]
}

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}
