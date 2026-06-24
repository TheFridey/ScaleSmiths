export const CLIENT_REQUEST_CATEGORIES = [
  "website_update",
  "website_issue",
  "form_issue",
  "seo_request",
  "new_page",
  "content_assets",
  "urgent_support",
  "general_support",
] as const

export const CLIENT_REQUEST_PRIORITIES = ["low", "medium", "high", "critical"] as const

export const CLIENT_REQUEST_STATUSES = [
  "new",
  "triaged",
  "in_progress",
  "waiting_client",
  "completed",
  "cancelled",
] as const

export type ClientRequestCategory = (typeof CLIENT_REQUEST_CATEGORIES)[number]
export type ClientRequestPriority = (typeof CLIENT_REQUEST_PRIORITIES)[number]
export type ClientRequestStatus = (typeof CLIENT_REQUEST_STATUSES)[number]

export const CATEGORY_LABELS: Record<ClientRequestCategory, string> = {
  website_update: "Website update",
  website_issue: "Website issue",
  form_issue: "Contact form problem",
  seo_request: "SEO request",
  new_page: "New page request",
  content_assets: "Content/images/assets",
  urgent_support: "Urgent support",
  general_support: "General support",
}

export const PRIORITY_LABELS: Record<ClientRequestPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
}

export const STATUS_LABELS: Record<ClientRequestStatus, string> = {
  new: "New",
  triaged: "Triaged",
  in_progress: "In progress",
  waiting_client: "Waiting client",
  completed: "Completed",
  cancelled: "Cancelled",
}

export function isClientRequestCategory(value: unknown): value is ClientRequestCategory {
  return typeof value === "string" && CLIENT_REQUEST_CATEGORIES.includes(value as ClientRequestCategory)
}

export function isClientRequestPriority(value: unknown): value is ClientRequestPriority {
  return typeof value === "string" && CLIENT_REQUEST_PRIORITIES.includes(value as ClientRequestPriority)
}

export function isClientRequestStatus(value: unknown): value is ClientRequestStatus {
  return typeof value === "string" && CLIENT_REQUEST_STATUSES.includes(value as ClientRequestStatus)
}

export function optionalTrimmedString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}
