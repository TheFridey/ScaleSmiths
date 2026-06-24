import bcrypt from "bcryptjs"
import { SignJWT, jwtVerify } from "jose"

export interface PortalCredentials {
  email?: unknown
  password?: unknown
}

export interface PortalAccountRecord {
  clientId: string
  email: string
  passwordHash: string
  active: boolean
}

export interface PortalSession {
  clientId: string
}

export const PORTAL_SESSION_COOKIE = "ss-client-session"

export function portalSessionCookieOptions(env: NodeJS.ProcessEnv = process.env) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8,
    path: "/",
  }
}

export function portalLogoutCookieOptions(env: NodeJS.ProcessEnv = process.env) {
  return {
    ...portalSessionCookieOptions(env),
    maxAge: 0,
  }
}

export function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

export function isDemoPortalEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.DEMO_PORTAL_ENABLED === "true"
}

export function authenticateDemoPortal(
  credentials: PortalCredentials,
  env: NodeJS.ProcessEnv = process.env,
): PortalSession | null {
  if (!isDemoPortalEnabled(env)) return null

  const email = normalizeEmail(credentials.email)
  const password = typeof credentials.password === "string" ? credentials.password : ""
  const demoEmail = normalizeEmail(env.DEMO_PORTAL_EMAIL)
  const demoPassword = env.DEMO_PORTAL_PASSWORD ?? ""
  const demoClientId = env.DEMO_PORTAL_CLIENT_ID?.trim() ?? ""

  if (!demoEmail || !demoPassword || !demoClientId) return null
  return email === demoEmail && password === demoPassword ? { clientId: demoClientId } : null
}

export async function authenticatePortalAccount(
  credentials: PortalCredentials,
  findByEmail: (email: string) => Promise<PortalAccountRecord | null>,
  comparePassword: (password: string, hash: string) => Promise<boolean> = bcrypt.compare,
): Promise<PortalSession | null> {
  const email = normalizeEmail(credentials.email)
  const password = typeof credentials.password === "string" ? credentials.password : ""

  if (!email || !password) return null

  const account = await findByEmail(email)
  if (!account?.active) return null

  const valid = await comparePassword(password, account.passwordHash)
  return valid ? { clientId: account.clientId } : null
}

export async function createPortalSessionToken(clientId: string, secretValue: string) {
  const secret = new TextEncoder().encode(secretValue)

  return new SignJWT({ clientId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret)
}

export async function verifyPortalSessionToken(
  token: string | undefined,
  secretValue: string | undefined,
): Promise<PortalSession | null> {
  if (!token || !secretValue) return null

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secretValue))
    return typeof payload.clientId === "string" ? { clientId: payload.clientId } : null
  } catch {
    return null
  }
}

export function isClientPortalAccessAllowed(session: PortalSession | null, clientId: string) {
  return Boolean(session && clientId === session.clientId)
}
