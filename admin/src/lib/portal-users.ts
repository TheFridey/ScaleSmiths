export class PortalUserError extends Error {
  constructor(public safeMessage: string, public status = 400, public code = "portal_user") {
    super(safeMessage)
    this.name = "PortalUserError"
  }
}

export function normalizePortalEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

export function validatePortalEmail(value: unknown) {
  const email = normalizePortalEmail(value)
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new PortalUserError("A valid portal email is required.")
  return email
}

export function validateClientId(value: unknown) {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) throw new PortalUserError("Select a valid client.")
  return id
}
