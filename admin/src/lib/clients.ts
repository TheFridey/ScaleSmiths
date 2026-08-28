export const CLIENT_STATUSES = ["active", "build", "review", "prospect", "archived"] as const
export type ClientStatus = (typeof CLIENT_STATUSES)[number]
export const DEFAULT_CLIENT_STATUS = "active" satisfies ClientStatus

export const CLIENT_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "build", label: "Build" },
  { value: "review", label: "Review" },
  { value: "prospect", label: "Prospect" },
  { value: "archived", label: "Archived" },
] as const satisfies ReadonlyArray<{ value: ClientStatus; label: string }>

// These labels are the values already persisted in clients.tier. Keep them stable
// until a forward data migration introduces separate machine values.
export const CLIENT_SERVICE_TIERS = ["Foundation", "Growth Partner", "Ecosystem", "Maintenance", "Forge Build", "Retainer"] as const
export type ClientServiceTier = (typeof CLIENT_SERVICE_TIERS)[number]
export const DEFAULT_CLIENT_SERVICE_TIER = "Foundation" satisfies ClientServiceTier
export const CLIENT_FORGE_BUILD_TIER = "Forge Build" satisfies ClientServiceTier
export const CLIENT_RETAINER_TIER = "Retainer" satisfies ClientServiceTier
export const CLIENT_SERVICE_TIER_OPTIONS = CLIENT_SERVICE_TIERS.map((value) => ({ value, label: value }))

export function isClientStatus(value: unknown): value is ClientStatus {
  return typeof value === "string" && CLIENT_STATUSES.includes(value as ClientStatus)
}

export function isClientServiceTier(value: unknown): value is ClientServiceTier {
  return typeof value === "string" && CLIENT_SERVICE_TIERS.includes(value as ClientServiceTier)
}

export function parseClientDomainFields(input: Record<string, unknown>) {
  const status = input.status ?? DEFAULT_CLIENT_STATUS
  const tier = typeof input.tier === "string" && input.tier.trim() ? input.tier.trim() : null
  if (!isClientStatus(status)) return { ok: false as const, error: "Select a valid client status." }
  if (tier !== null && !isClientServiceTier(tier)) return { ok: false as const, error: "Select a valid client service tier." }
  return { ok: true as const, status, tier }
}
