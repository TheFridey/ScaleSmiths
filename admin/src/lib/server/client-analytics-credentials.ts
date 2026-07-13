import "server-only"
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

export function encryptAnalyticsCredentials(credentials: Record<string, unknown>, env: NodeJS.ProcessEnv = process.env) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", resolveAnalyticsKey(env), iv)
  const plaintext = JSON.stringify(credentials)
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".")
}

export function decryptAnalyticsCredentials(value: string | null | undefined, env: NodeJS.ProcessEnv = process.env): Record<string, unknown> | null {
  if (!value) return null
  const [version, iv, tag, ciphertext] = value.split(".")
  if (version !== "v1" || !iv || !tag || !ciphertext) throw new Error("Invalid encrypted analytics credentials.")
  const decipher = createDecipheriv("aes-256-gcm", resolveAnalyticsKey(env), Buffer.from(iv, "base64url"))
  decipher.setAuthTag(Buffer.from(tag, "base64url"))
  const decoded = Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8")
  const parsed = JSON.parse(decoded) as unknown
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid analytics credentials payload.")
  return parsed as Record<string, unknown>
}

function resolveAnalyticsKey(env: NodeJS.ProcessEnv) {
  const configured = env.ANALYTICS_CREDENTIAL_ENCRYPTION_KEY?.trim()
  if (configured) {
    const decoded = /^[0-9a-f]{64}$/i.test(configured) ? Buffer.from(configured, "hex") : Buffer.from(configured, "base64")
    if (decoded.length === 32) return decoded
    throw new Error("ANALYTICS_CREDENTIAL_ENCRYPTION_KEY must encode exactly 32 bytes.")
  }
  if (env.NODE_ENV === "production") throw new Error("ANALYTICS_CREDENTIAL_ENCRYPTION_KEY is required in production.")
  return createHash("sha256").update(env.AUTH_SECRET ?? env.NEXTAUTH_SECRET ?? "scalesmiths-development-analytics-key").digest()
}
