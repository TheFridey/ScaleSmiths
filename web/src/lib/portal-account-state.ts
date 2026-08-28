export const PORTAL_ACCOUNT_STATES = ["active", "disabled"] as const
export type PortalAccountState = (typeof PORTAL_ACCOUNT_STATES)[number]
export const PORTAL_ACCOUNT_STATE_LABELS: Record<PortalAccountState, string> = { active: "Active", disabled: "Disabled" }
export function portalAccountState(active: boolean): PortalAccountState { return active ? "active" : "disabled" }
export function isPortalAccountState(value: unknown): value is PortalAccountState { return typeof value === "string" && PORTAL_ACCOUNT_STATES.includes(value as PortalAccountState) }
