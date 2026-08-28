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
export const CLIENT_REQUEST_MESSAGE_SENDER_TYPES = ["client", "admin", "system"] as const
export const CLIENT_REQUEST_MESSAGE_VISIBILITIES = ["client_visible", "internal"] as const

export type ClientRequestCategory = (typeof CLIENT_REQUEST_CATEGORIES)[number]
export type ClientRequestPriority = (typeof CLIENT_REQUEST_PRIORITIES)[number]
export type ClientRequestMessageSenderType = (typeof CLIENT_REQUEST_MESSAGE_SENDER_TYPES)[number]
export type ClientRequestMessageVisibility = (typeof CLIENT_REQUEST_MESSAGE_VISIBILITIES)[number]

export interface ClientRequestWrite {
  clientId: string
  title: string
  description: string
  category: ClientRequestCategory
  priority: ClientRequestPriority
  status: ClientRequestStatus
  affectedUrl?: string | null
  pageUrl?: string | null
  attachmentMetadata?: Record<string, unknown> | null
  internalNotes?: string | null
  forgeSummary?: string | null
  forgeSuggestedActions?: string | null
  forgeSuggestedReply?: string | null
  completedAt?: Date | null
}

export interface ClientPortalRequest {
  id: number
  title: string
  description: string
  category: ClientRequestCategory
  priority: ClientRequestPriority
  status: ClientRequestStatus
  affectedUrl: string | null
  createdAt: Date
  updatedAt: Date
}

export interface ClientRequestMessage {
  id: number
  requestId: number
  senderType: ClientRequestMessageSenderType
  senderName: string
  body: string
  visibility: ClientRequestMessageVisibility
  createdAt: Date
  updatedAt: Date | null
}

export interface ClientPortalRequestMessage {
  id: number
  requestId: number
  senderType: ClientRequestMessageSenderType
  senderName: string
  body: string
  createdAt: Date
}

type ClientPortalRequestWithPossibleAdminFields = ClientPortalRequest & Partial<{
  attachmentMetadata: unknown
  internalNotes: unknown
  forgeSummary: unknown
  forgeSuggestedActions: unknown
  forgeSuggestedReply: unknown
  pageUrl: unknown
  completedAt: unknown
}>

type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string }

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

export function parseClientRequestPayload(input: Record<string, unknown>): ParseResult<ClientRequestWrite> {
  const clientId = optionalString(input.clientId, 160)
  const title = optionalString(input.title, 180)
  const description = optionalString(input.description, 6000)
  const category = parseEnum(input.category, isClientRequestCategory, "general_support", "Category")
  const priority = parseEnum(input.priority, isClientRequestPriority, "medium", "Priority")
  const status = parseEnum(input.status, isClientRequestStatus, "new", "Status")
  const completedAt = parseOptionalDate(input.completedAt, "Completed date")
  const attachmentMetadata = parseOptionalJsonRecord(input.attachmentMetadata, "Attachment metadata")

  if (!clientId) return { ok: false, error: "Client reference is required." }
  if (!title) return { ok: false, error: "Request title is required." }
  if (!description) return { ok: false, error: "Request description is required." }
  if (!category.ok) return category
  if (!priority.ok) return priority
  if (!status.ok) return status
  if (!completedAt.ok) return completedAt
  if (!attachmentMetadata.ok) return attachmentMetadata

  return {
    ok: true,
    data: {
      clientId,
      title,
      description,
      category: category.data,
      priority: priority.data,
      status: status.data,
      affectedUrl: optionalString(input.affectedUrl, 1000),
      pageUrl: optionalString(input.pageUrl, 1000),
      attachmentMetadata: attachmentMetadata.data,
      internalNotes: optionalString(input.internalNotes, 10000),
      forgeSummary: optionalString(input.forgeSummary, 6000),
      forgeSuggestedActions: optionalString(input.forgeSuggestedActions, 10000),
      forgeSuggestedReply: optionalString(input.forgeSuggestedReply, 6000),
      completedAt: completedAt.data,
    },
  }
}

export function serializeClientPortalRequest(input: ClientPortalRequestWithPossibleAdminFields): ClientPortalRequest {
  return {
    id: input.id,
    title: input.title,
    description: input.description,
    category: input.category,
    priority: input.priority,
    status: input.status,
    affectedUrl: input.affectedUrl,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  }
}

export function parseClientRequestMessageBody(value: unknown): ParseResult<string> {
  const body = optionalString(value, 6000)
  return body ? { ok: true, data: body } : { ok: false, error: "Message body is required." }
}

export function serializeClientPortalMessage(input: ClientRequestMessage): ClientPortalRequestMessage | null {
  if (input.visibility !== "client_visible") return null

  return {
    id: input.id,
    requestId: input.requestId,
    senderType: input.senderType,
    senderName: input.senderName,
    body: input.body,
    createdAt: input.createdAt,
  }
}

function optionalString(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : null
}

function parseEnum<TValue extends string>(
  value: unknown,
  guard: (value: unknown) => value is TValue,
  fallback: TValue,
  label: string,
): ParseResult<TValue> {
  if (value === undefined || value === null || value === "") return { ok: true, data: fallback }
  if (guard(value)) return { ok: true, data: value }
  return { ok: false, error: `${label} is invalid.` }
}

function parseOptionalDate(value: unknown, label: string): ParseResult<Date | null> {
  if (value === undefined || value === null || value === "") return { ok: true, data: null }
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return { ok: false, error: `${label} must be a valid date.` }
  return { ok: true, data: date }
}

function parseOptionalJsonRecord(value: unknown, label: string): ParseResult<Record<string, unknown> | null> {
  if (value === undefined || value === null || value === "") return { ok: true, data: null }
  if (typeof value === "object" && !Array.isArray(value)) return { ok: true, data: value as Record<string, unknown> }
  return { ok: false, error: `${label} must be an object.` }
}
