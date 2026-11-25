import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto"
import type { AdminRole } from "@/lib/admin-users"

export interface StoredMfaState extends Record<string, unknown> {
  version: 1
  status: "pending" | "active"
  encryptedSecret: string
  recoveryCodeHashes: Array<{ salt: string; hash: string }>
  createdAt: string
  verifiedAt?: string
}

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

export function generateMfaSetup(input: { email: string; issuer?: string; env?: NodeJS.ProcessEnv }) {
  const secret = encodeBase32(randomBytes(20))
  const recoveryCodes = Array.from({ length: 10 }, () => `${randomBytes(4).toString("hex").slice(0, 4)}-${randomBytes(4).toString("hex").slice(0, 4)}`.toUpperCase())
  const state: StoredMfaState = {
    version: 1,
    status: "pending",
    encryptedSecret: encryptMfaSecret(secret, input.env),
    recoveryCodeHashes: recoveryCodes.map(hashRecoveryCode),
    createdAt: new Date().toISOString(),
  }
  const issuer = input.issuer ?? "ScaleSmiths Admin"
  return { secret, recoveryCodes, state, otpauthUri: buildOtpAuthUri({ secret, email: input.email, issuer }) }
}

export function generateTotp(secret: string, time = Date.now(), stepSeconds = 30, digits = 6) {
  const counter = Math.floor(time / 1000 / stepSeconds)
  const buffer = Buffer.alloc(8)
  buffer.writeBigUInt64BE(BigInt(counter))
  const digest = createHmac("sha1", decodeBase32(secret)).update(buffer).digest()
  const offset = digest[digest.length - 1] & 0x0f
  const value = (digest.readUInt32BE(offset) & 0x7fffffff) % (10 ** digits)
  return value.toString().padStart(digits, "0")
}

export function verifyTotp(secret: string, code: string, time = Date.now(), window = 1) {
  const normalized = code.replace(/\s+/g, "")
  if (!/^\d{6}$/.test(normalized)) return false
  for (let offset = -window; offset <= window; offset += 1) {
    const expected = generateTotp(secret, time + offset * 30_000)
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(normalized))) return true
  }
  return false
}

export function encryptMfaSecret(secret: string, env: NodeJS.ProcessEnv = process.env) {
  const key = resolveMfaEncryptionKey(env)
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()])
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".")
}

export function decryptMfaSecret(value: string, env: NodeJS.ProcessEnv = process.env) {
  const [version, iv, tag, ciphertext] = value.split(".")
  if (version !== "v1" || !iv || !tag || !ciphertext) throw new Error("Invalid encrypted MFA secret.")
  const decipher = createDecipheriv("aes-256-gcm", resolveMfaEncryptionKey(env), Buffer.from(iv, "base64url"))
  decipher.setAuthTag(Buffer.from(tag, "base64url"))
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8")
}

export function hashRecoveryCode(code: string) {
  const salt = randomBytes(16)
  return { salt: salt.toString("base64url"), hash: scryptSync(normalizeRecoveryCode(code), salt, 32).toString("base64url") }
}

export function consumeRecoveryCode(code: string, hashes: StoredMfaState["recoveryCodeHashes"]) {
  const normalized = normalizeRecoveryCode(code)
  for (let index = 0; index < hashes.length; index += 1) {
    const candidate = hashes[index]
    const actual = scryptSync(normalized, Buffer.from(candidate.salt, "base64url"), 32)
    const expected = Buffer.from(candidate.hash, "base64url")
    if (actual.length === expected.length && timingSafeEqual(actual, expected)) return { valid: true as const, remaining: hashes.filter((_, itemIndex) => itemIndex !== index) }
  }
  return { valid: false as const, remaining: hashes }
}

/** Roles for which MFA is mandatory in production. */
export const MFA_PRIVILEGED_ROLES: readonly AdminRole[] = ["owner", "administrator", "venture_controller"]
export function isMfaPrivilegedRole(role: AdminRole) { return MFA_PRIVILEGED_ROLES.includes(role) }

export function isMfaRequired(role: AdminRole, env: NodeJS.ProcessEnv = process.env, now = Date.now()) {
  if (env.NODE_ENV !== "production" || !isMfaPrivilegedRole(role)) return false
  const graceUntil = Date.parse(env.ADMIN_MFA_BOOTSTRAP_GRACE_UNTIL ?? "")
  return !Number.isFinite(graceUntil) || graceUntil <= now
}

/*
 * First-login MFA enrolment (B2.11 hotfix).
 * A privileged account without active MFA could not sign in (MFA is mandatory) and could not enrol (enrolment needs a
 * session). An owner now issues a time-boxed enrolment allowance when they create a privileged account or reset its MFA
 * (the reset already requires the owner's own password). Within that window a correct password, still rate limited and
 * audited, yields an enrolment-only session: middleware and the server guards admit only the MFA setup page, the MFA API
 * and sign-out until MFA is active. Activation increments the session version, so the user then signs in with password
 * and authenticator code. Without a current allowance the account stays locked out exactly as before.
 */
export const MFA_ENROLMENT_WINDOW_MS = 72 * 60 * 60 * 1000
export interface MfaEnrolmentAllowance { issuedAt: string; expiresAt: string; issuedBy: string | null }

export function issueMfaEnrolment(issuedBy: string | null, now = new Date()): { enrolment: MfaEnrolmentAllowance } {
  return { enrolment: { issuedAt: now.toISOString(), expiresAt: new Date(now.getTime() + MFA_ENROLMENT_WINDOW_MS).toISOString(), issuedBy } }
}

export function readMfaEnrolment(value: Record<string, unknown> | null | undefined): MfaEnrolmentAllowance | null {
  const enrolment = value?.enrolment
  if (!enrolment || typeof enrolment !== "object") return null
  const { issuedAt, expiresAt, issuedBy } = enrolment as Record<string, unknown>
  if (typeof issuedAt !== "string" || typeof expiresAt !== "string" || !Number.isFinite(Date.parse(expiresAt))) return null
  return { issuedAt, expiresAt, issuedBy: typeof issuedBy === "string" ? issuedBy : null }
}

/** True while a user must not reach anything except MFA enrolment: MFA is mandatory for them and not yet active. */
export function requiresMfaEnrolment(user: { role: AdminRole; mfaEnabled: boolean }, env: NodeJS.ProcessEnv = process.env, now = Date.now()) {
  return !user.mfaEnabled && isMfaRequired(user.role, env, now)
}

export type UnconfiguredMfaSignIn = "not_required" | "enrolment_allowed" | "no_enrolment_allowance" | "enrolment_allowance_expired"
/** Decision for a correct password on an account whose MFA is not active. */
export function decideUnconfiguredMfaSignIn(user: { role: AdminRole; mfaEnabled: boolean; mfaState: Record<string, unknown> | null }, env: NodeJS.ProcessEnv = process.env, now = Date.now()): UnconfiguredMfaSignIn {
  if (!requiresMfaEnrolment(user, env, now)) return "not_required"
  const allowance = readMfaEnrolment(user.mfaState)
  if (!allowance) return "no_enrolment_allowance"
  return Date.parse(allowance.expiresAt) > now ? "enrolment_allowed" : "enrolment_allowance_expired"
}

/** The only routes an enrolment-only session may use. Sign-out is under /api/auth, which middleware admits earlier. */
export function isMfaEnrolmentRoute(pathname: string, method: string) {
  if (pathname === "/security") return method === "GET" || method === "HEAD"
  if (pathname === "/api/security/mfa") return method === "GET" || method === "POST"
  return false
}

export function buildOtpAuthUri({ secret, email, issuer }: { secret: string; email: string; issuer: string }) {
  const label = `${issuer}:${email}`
  return `otpauth://totp/${encodeURIComponent(label)}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`
}

export function readStoredMfaState(value: Record<string, unknown> | null | undefined): StoredMfaState | null {
  if (!value || value.version !== 1 || (value.status !== "pending" && value.status !== "active") || typeof value.encryptedSecret !== "string" || !Array.isArray(value.recoveryCodeHashes)) return null
  const hashes = value.recoveryCodeHashes.filter((item): item is { salt: string; hash: string } => Boolean(item && typeof item === "object" && "salt" in item && "hash" in item && typeof item.salt === "string" && typeof item.hash === "string"))
  return { version: 1, status: value.status, encryptedSecret: value.encryptedSecret, recoveryCodeHashes: hashes, createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString(), verifiedAt: typeof value.verifiedAt === "string" ? value.verifiedAt : undefined }
}

function resolveMfaEncryptionKey(env: NodeJS.ProcessEnv) {
  const configured = env.MFA_ENCRYPTION_KEY?.trim()
  if (configured) {
    const decoded = /^[0-9a-f]{64}$/i.test(configured) ? Buffer.from(configured, "hex") : Buffer.from(configured, "base64")
    if (decoded.length === 32) return decoded
    throw new Error("MFA_ENCRYPTION_KEY must encode exactly 32 bytes.")
  }
  if (env.NODE_ENV === "production") throw new Error("MFA_ENCRYPTION_KEY is required in production.")
  return createHash("sha256").update(env.AUTH_SECRET ?? env.NEXTAUTH_SECRET ?? "scalesmiths-development-mfa-key").digest()
}
function normalizeRecoveryCode(value: string) { return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") }
function encodeBase32(buffer: Buffer) {
  let bits = ""
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0")
  let output = ""
  for (let index = 0; index < bits.length; index += 5) output += BASE32_ALPHABET[Number.parseInt(bits.slice(index, index + 5).padEnd(5, "0"), 2)]
  return output
}
function decodeBase32(value: string) {
  const bits = value.toUpperCase().replace(/=+$/g, "").split("").map((character) => BASE32_ALPHABET.indexOf(character).toString(2).padStart(5, "0")).join("")
  const bytes = []
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2))
  return Buffer.from(bytes)
}
