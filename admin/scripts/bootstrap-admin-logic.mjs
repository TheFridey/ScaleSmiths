export function decideBootstrapAction(hasExistingUser, recovery) {
  if (hasExistingUser && !recovery) return "unchanged"
  return hasExistingUser ? "recover" : "create"
}

export async function prepareBootstrapPasswordHash(password, recovery, bcrypt) {
  if (!password) throw new Error(`${recovery ? "ADMIN_RECOVERY_PASSWORD" : "ADMIN_PASSWORD"} is required.`)
  if (password.startsWith("$2")) return { hash: password, legacyWarning: false }
  if (recovery && password.length < 12) throw new Error("ADMIN_RECOVERY_PASSWORD must be a bcrypt hash or at least 12 characters.")
  return { hash: await bcrypt.hash(password, 12), legacyWarning: !recovery && password.length < 12 }
}
