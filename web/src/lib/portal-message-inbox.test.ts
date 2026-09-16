import { describe, expect, it } from "vitest"
import {
  collapsePortalMessageInbox,
  includeSelectedInboxThread,
  inboxThreadFromSelectedRequest,
  isPortalThreadUnread,
  parsePortalThreadSearchParam,
  resolvePortalMessagesSelection,
  toPortalMessageInboxThread,
} from "./portal-message-inbox"

const newer = "2026-09-16T12:00:00.000Z"
const older = "2026-09-15T12:00:00.000Z"

describe("isPortalThreadUnread", () => {
  it("treats staff replies after the last read time as unread", () => {
    expect(isPortalThreadUnread("admin", newer, older)).toBe(true)
    expect(isPortalThreadUnread("system", newer, older)).toBe(true)
  })

  it("does not mark the client's own latest message as unread", () => {
    expect(isPortalThreadUnread("client", newer, older)).toBe(false)
    expect(isPortalThreadUnread("client", newer, null)).toBe(false)
  })

  it("treats a never-opened staff reply as unread", () => {
    expect(isPortalThreadUnread("admin", newer, null)).toBe(true)
  })

  it("treats an already-read staff reply as read", () => {
    expect(isPortalThreadUnread("admin", older, newer)).toBe(false)
  })
})

describe("collapsePortalMessageInbox", () => {
  it("keeps the first row per request and reports truncation past the limit", () => {
    const collapsed = collapsePortalMessageInbox([
      row({ requestId: 2, messageId: 20, title: "Newer request", createdAt: newer, senderType: "admin" }),
      row({ requestId: 1, messageId: 11, title: "Older request later message", createdAt: older, senderType: "client" }),
      row({ requestId: 2, messageId: 19, title: "Should be ignored", createdAt: older, senderType: "client" }),
      row({ requestId: 3, messageId: 30, title: "Third", createdAt: older, senderType: "admin" }),
    ], 2)

    expect(collapsed.truncated).toBe(true)
    expect(collapsed.threads.map((thread) => thread.requestId)).toEqual([2, 1])
    expect(collapsed.threads[0]?.unread).toBe(true)
    expect(collapsed.threads[1]?.unread).toBe(false)
    expect(collapsed.threads[0]?.lastMessage.body).toBe("Visible body 20")
  })

  it("does not invent threads from rows that were never supplied", () => {
    const collapsed = collapsePortalMessageInbox([
      row({ requestId: 8, messageId: 1, title: "Owned thread", senderType: "admin", body: "Client A secret" }),
    ])

    expect(collapsed.threads).toHaveLength(1)
    expect(collapsed.threads[0]?.title).toBe("Owned thread")
    expect(collapsed.threads[0]?.lastMessage.body).not.toContain("Client B")
  })
})

describe("resolvePortalMessagesSelection", () => {
  it("selects an owned requested thread and ignores a thread the client does not own", () => {
    expect(resolvePortalMessagesSelection({
      requestedThreadId: 9,
      requestedThreadOwned: true,
      generalThreadId: 3,
      newestThreadId: 4,
    })).toBe(9)

    expect(resolvePortalMessagesSelection({
      requestedThreadId: 99,
      requestedThreadOwned: false,
      generalThreadId: 3,
      newestThreadId: 4,
    })).toBe(3)
  })

  it("falls back to the newest owned thread when there is no general thread", () => {
    expect(resolvePortalMessagesSelection({
      requestedThreadId: null,
      requestedThreadOwned: false,
      generalThreadId: null,
      newestThreadId: 12,
    })).toBe(12)
  })
})

describe("includeSelectedInboxThread", () => {
  it("pins the selected thread first and clears its unread flag", () => {
    const selected = toPortalMessageInboxThread(row({
      requestId: 5,
      messageId: 50,
      title: "Pinned",
      senderType: "admin",
      clientLastReadAt: null,
    }))
    const threads = [
      toPortalMessageInboxThread(row({ requestId: 1, messageId: 1, title: "One" })),
      selected,
    ]

    const next = includeSelectedInboxThread(threads, selected, 2)
    expect(next[0]?.requestId).toBe(5)
    expect(next[0]?.unread).toBe(false)
    expect(next).toHaveLength(2)
  })
})

describe("inboxThreadFromSelectedRequest", () => {
  it("uses the latest client-visible message as the preview", () => {
    const thread = inboxThreadFromSelectedRequest({
      requestId: 4,
      title: "Contact form",
      category: "form_issue",
      status: "in_progress",
      messages: [
        { id: 1, senderType: "client", senderName: "Client", body: "Form is broken", createdAt: older },
        { id: 2, senderType: "admin", senderName: "ScaleSmiths", body: "We are on it", createdAt: newer },
      ],
    })

    expect(thread?.lastMessage.body).toBe("We are on it")
    expect(thread?.unread).toBe(false)
  })
})

describe("parsePortalThreadSearchParam", () => {
  it("accepts only positive integer ids", () => {
    expect(parsePortalThreadSearchParam("12")).toBe(12)
    expect(parsePortalThreadSearchParam("0")).toBeNull()
    expect(parsePortalThreadSearchParam("-3")).toBeNull()
    expect(parsePortalThreadSearchParam("messages")).toBeNull()
    expect(parsePortalThreadSearchParam(undefined)).toBeNull()
  })
})

function row(overrides: Partial<Parameters<typeof toPortalMessageInboxThread>[0]> & { body?: string } = {}) {
  const messageId = overrides.messageId ?? 1
  return {
    requestId: 1,
    title: "Portal messages",
    category: "general_support",
    status: "new",
    clientLastReadAt: older,
    senderType: "client" as const,
    senderName: "Client",
    body: overrides.body ?? `Visible body ${messageId}`,
    createdAt: newer,
    ...overrides,
    messageId,
  }
}
