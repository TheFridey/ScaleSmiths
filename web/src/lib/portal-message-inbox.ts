import type { ClientRequestCategory, ClientRequestMessageSenderType, ClientRequestStatus } from "@/lib/client-requests"

export const PORTAL_MESSAGE_INBOX_LIMIT = 20

export interface PortalMessageInboxRow {
  requestId: number
  title: string
  category: ClientRequestCategory | string
  status: ClientRequestStatus | string
  clientLastReadAt: Date | string | null
  messageId: number
  senderType: ClientRequestMessageSenderType | string
  senderName: string
  body: string
  createdAt: Date | string
}

export interface PortalMessageInboxThread {
  requestId: number
  title: string
  category: string
  status: string
  unread: boolean
  lastMessage: {
    id: number
    senderType: string
    senderName: string
    body: string
    createdAt: string
  }
}

export function isPortalThreadUnread(
  lastSenderType: string,
  lastCreatedAt: Date | string,
  clientLastReadAt: Date | string | null | undefined,
): boolean {
  if (lastSenderType === "client") return false

  const last = toTime(lastCreatedAt)
  if (last === null) return false
  if (clientLastReadAt == null || clientLastReadAt === "") return true

  const read = toTime(clientLastReadAt)
  if (read === null) return true
  return last > read
}

export function toPortalMessageInboxThread(row: PortalMessageInboxRow): PortalMessageInboxThread {
  return {
    requestId: row.requestId,
    title: row.title,
    category: row.category,
    status: row.status,
    unread: isPortalThreadUnread(row.senderType, row.createdAt, row.clientLastReadAt),
    lastMessage: {
      id: row.messageId,
      senderType: row.senderType,
      senderName: row.senderName,
      body: row.body,
      createdAt: toIso(row.createdAt),
    },
  }
}

export function collapsePortalMessageInbox(
  rows: PortalMessageInboxRow[],
  limit = PORTAL_MESSAGE_INBOX_LIMIT,
): { threads: PortalMessageInboxThread[]; truncated: boolean } {
  const seen = new Set<number>()
  const threads: PortalMessageInboxThread[] = []
  let truncated = false

  for (const row of rows) {
    if (seen.has(row.requestId)) continue
    seen.add(row.requestId)
    if (threads.length >= limit) {
      truncated = true
      break
    }
    threads.push(toPortalMessageInboxThread(row))
  }

  return { threads, truncated }
}

export function parsePortalThreadSearchParam(value: string | undefined): number | null {
  if (!value) return null
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

export function resolvePortalMessagesSelection(input: {
  requestedThreadId: number | null
  requestedThreadOwned: boolean
  generalThreadId: number | null
  newestThreadId: number | null
}): number | null {
  if (input.requestedThreadId && input.requestedThreadOwned) return input.requestedThreadId
  if (input.generalThreadId) return input.generalThreadId
  return input.newestThreadId
}

export function includeSelectedInboxThread(
  threads: PortalMessageInboxThread[],
  selected: PortalMessageInboxThread | null,
  limit = PORTAL_MESSAGE_INBOX_LIMIT,
): PortalMessageInboxThread[] {
  if (!selected) return threads
  const rest = threads.filter((thread) => thread.requestId !== selected.requestId)
  return [{ ...selected, unread: false }, ...rest].slice(0, Math.max(limit, 1))
}

export function inboxThreadFromSelectedRequest(input: {
  requestId: number
  title: string
  category: string
  status: string
  messages: Array<{
    id: number
    senderType: string
    senderName: string
    body: string
    createdAt: Date | string
  }>
}): PortalMessageInboxThread | null {
  const lastMessage = input.messages.at(-1)
  if (!lastMessage) return null

  return {
    requestId: input.requestId,
    title: input.title,
    category: input.category,
    status: input.status,
    unread: false,
    lastMessage: {
      id: lastMessage.id,
      senderType: lastMessage.senderType,
      senderName: lastMessage.senderName,
      body: lastMessage.body,
      createdAt: toIso(lastMessage.createdAt),
    },
  }
}

function toTime(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  const time = date.getTime()
  return Number.isNaN(time) ? null : time
}

function toIso(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString()
}
