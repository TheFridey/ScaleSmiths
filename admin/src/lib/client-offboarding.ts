export const CLIENT_OFFBOARDING_STATUSES = ["draft", "in_progress", "ready", "completed", "cancelled", "reactivated"] as const
export const CLIENT_OFFBOARDING_ITEM_STATUSES = ["pending", "in_progress", "blocked", "completed", "not_applicable"] as const
export type ClientOffboardingStatus = (typeof CLIENT_OFFBOARDING_STATUSES)[number]
export type ClientOffboardingItemStatus = (typeof CLIENT_OFFBOARDING_ITEM_STATUSES)[number]

export const CLIENT_OFFBOARDING_CHECKLIST_VERSION = 1
export const CLIENT_OFFBOARDING_CHECKLIST = [
  { key: "commercial_end", category: "commercial", title: "Confirm commercial end date and owner", destructive: false },
  { key: "outstanding_invoices", category: "finance", title: "Review outstanding invoices and collection plan", destructive: false },
  { key: "services_retainers", category: "commercial", title: "End recurring services and retainers", destructive: false },
  { key: "active_requests", category: "delivery", title: "Resolve, transfer or close active client requests", destructive: false },
  { key: "future_tasks", category: "delivery", title: "Cancel or transfer future operational tasks", destructive: false },
  { key: "project_closure", category: "delivery", title: "Close projects and record final delivery state", destructive: false },
  { key: "production_handoff", category: "hosting", title: "Confirm production ownership, handoff and rollback responsibility", destructive: false },
  { key: "hosted_assets", category: "hosting", title: "Inventory hosted assets and agree retention or transfer", destructive: false },
  { key: "client_credentials", category: "security", title: "Return, revoke or securely dispose of client-supplied access", destructive: true },
  { key: "forge_staging", category: "security", title: "Archive Forge and staging access without touching production", destructive: true },
  { key: "portal_access", category: "security", title: "Disable portal access and revoke unused access tokens", destructive: true },
  { key: "data_retention", category: "privacy", title: "Record retention basis, review date and deletion exceptions", destructive: false },
  { key: "archive_review", category: "archive", title: "Review audit evidence and approve client archive", destructive: false },
] as const

export function isOffboardingItemStatus(value: unknown): value is ClientOffboardingItemStatus {
  return typeof value === "string" && CLIENT_OFFBOARDING_ITEM_STATUSES.includes(value as ClientOffboardingItemStatus)
}

export function validateOffboardingCompletion(input: {
  caseStatus: string; clientName: string; confirmation: unknown; productionAction: unknown
  items: Array<{ status: ClientOffboardingItemStatus; destructive: boolean }>
}) {
  if (input.caseStatus !== "ready") return "Complete or mark every checklist item not applicable before archiving."
  if (input.confirmation !== `OFFBOARD ${input.clientName}`) return `Type OFFBOARD ${input.clientName} to confirm client archival.`
  if (input.productionAction !== "leave_untouched") return "Confirm that production systems will be left untouched by this action."
  if (input.items.some((item) => item.destructive && item.status === "not_applicable")) return "Access-removal checklist items cannot be marked not applicable when completing offboarding."
  return null
}
