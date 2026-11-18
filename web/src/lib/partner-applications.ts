export const PARTNER_APPLICATION_STATUSES = [
  "submitted", "under_review", "conversation_arranged", "assessment_in_progress",
  "approved_in_principle", "agreement_pending", "onboarding", "activated",
  "declined", "withdrawn", "archived",
] as const

export interface PartnerApplicationConfig {
  enabled: boolean
  privacyVersion: string
  retentionDays: number | null
}

export function partnerApplicationConfig(env: Partial<NodeJS.ProcessEnv> = process.env): PartnerApplicationConfig {
  const privacyVersion = env.PARTNER_APPLICATION_PRIVACY_VERSION?.trim() ?? ""
  const rawDays = env.PARTNER_APPLICATION_RETENTION_DAYS ?? ""
  const days = /^\d+$/.test(rawDays) ? Number(rawDays) : NaN
  const retentionDays = Number.isInteger(days) && days >= 1 && days <= 730 ? days : null
  return {
    enabled: env.PARTNER_APPLICATIONS_ENABLED === "true" && /^[A-Za-z0-9._-]{1,80}$/.test(privacyVersion) && retentionDays !== null,
    privacyVersion,
    retentionDays,
  }
}

export function illustrativeCommissionMinor(sales: number): bigint {
  if (!Number.isInteger(sales) || sales < 0 || sales > 100) throw new Error("Choose between 0 and 100 qualifying sales.")
  return BigInt(sales) * BigInt(70500)
}

export function formatPartnerMoney(minor: bigint): string {
  const pounds = (minor / BigInt(100)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  const pence = (minor % BigInt(100)).toString().padStart(2, "0")
  return `£${pounds}${pence === "00" ? "" : `.${pence}`}`
}

export interface PartnerApplicationInput {
  name: string
  email: string
  phone: string
  region: string
  experience: string
  businessActivity: string
  networks: string
  industries: string
  motivation: string
  linkedin: string | null
  privacyVersion: string
}

export function validatePartnerApplication(value: unknown):
  | { ok: true; data: PartnerApplicationInput; honeypot: boolean }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, error: "Check the application fields and try again." }
  const raw = value as Record<string, unknown>
  const limits = { name: 120, email: 254, phone: 40, region: 120, experience: 2000, businessActivity: 1000, networks: 1000, industries: 500, motivation: 2000, linkedin: 300, website: 200, privacyVersion: 80 }
  for (const [key, max] of Object.entries(limits)) {
    if (raw[key] !== undefined && (typeof raw[key] !== "string" || (raw[key] as string).length > max)) {
      return { ok: false, error: "An application field is invalid or too long." }
    }
  }
  const field = (name: string) => typeof raw[name] === "string" ? raw[name].trim() : ""
  const name = field("name"), email = field("email").toLowerCase(), region = field("region")
  const experience = field("experience"), motivation = field("motivation")
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || region.length < 2 || experience.length < 10 || motivation.length < 10 || raw.privacyAcknowledged !== true || !/^[A-Za-z0-9._-]{1,80}$/.test(field("privacyVersion"))) {
    return { ok: false, error: "Please complete your name, email, region, experience, motivation and privacy acknowledgement." }
  }
  let linkedin: string | null = field("linkedin") || null
  if (linkedin) {
    try {
      const url = new URL(linkedin)
      if (url.protocol !== "https:" || !["linkedin.com", "www.linkedin.com"].includes(url.hostname) || url.username || url.password || url.port) throw new Error("invalid")
      linkedin = url.toString()
    } catch { return { ok: false, error: "Use a complete HTTPS LinkedIn profile link, or leave it blank." } }
  }
  return { ok: true, honeypot: Boolean(field("website")), data: { name, email, phone: field("phone"), region, experience, businessActivity: field("businessActivity"), networks: field("networks"), industries: field("industries"), motivation, linkedin, privacyVersion: field("privacyVersion") } }
}

export function isPartnerApplicationOriginAllowed(origin: string | null, expectedOrigin: string): boolean {
  if (!origin) return false
  try { return new URL(origin).origin === new URL(expectedOrigin).origin && origin === new URL(origin).origin }
  catch { return false }
}

/** Enforce the byte limit while streaming, including chunked requests. */
export async function readPartnerApplicationJson(request: Request, limit = 16 * 1024) {
  const declared = Number(request.headers.get("content-length"))
  if (Number.isFinite(declared) && declared > limit) return { ok: false as const, status: 413, error: "Request body is too large." }
  const reader = request.body?.getReader()
  if (!reader) return { ok: false as const, status: 400, error: "Invalid request body." }
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > limit) { await reader.cancel(); return { ok: false as const, status: 413, error: "Request body is too large." } }
      chunks.push(chunk.value)
    }
    const body = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength }
    return { ok: true as const, data: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)) as unknown }
  } catch { return { ok: false as const, status: 400, error: "Invalid request body." } }
  finally { reader.releaseLock() }
}
