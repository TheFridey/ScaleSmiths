import { createHash } from "node:crypto"

export function hashPortalActivationToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export function isAcceptablePortalPassword(password: string) {
  return password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password)
}
