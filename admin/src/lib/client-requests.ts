import { CLIENT_REQUEST_STATUSES, type ClientRequestStatus } from "../../../domain/client-requests"
export { CLIENT_REQUEST_STATUSES, type ClientRequestStatus } from "../../../domain/client-requests"

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
export const CLIENT_REQUEST_MESSAGE_VISIBILITIES = ["client_visible", "internal"] as const

export type ClientRequestCategory = (typeof CLIENT_REQUEST_CATEGORIES)[number]
export type ClientRequestPriority = (typeof CLIENT_REQUEST_PRIORITIES)[number]
export type ClientRequestMessageVisibility = (typeof CLIENT_REQUEST_MESSAGE_VISIBILITIES)[number]

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

export function isClientRequestMessageVisibility(value: unknown): value is ClientRequestMessageVisibility {
  return typeof value === "string" && CLIENT_REQUEST_MESSAGE_VISIBILITIES.includes(value as ClientRequestMessageVisibility)
}

export function optionalTrimmedString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

export function parseClientRequestMessageBody(value: unknown) {
  const body = optionalTrimmedString(value)?.slice(0, 6000) ?? null
  return body ? { ok: true as const, data: body } : { ok: false as const, error: "Message body is required." }
}
