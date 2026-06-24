import { describe, expect, it } from "vitest"
import {
  CATEGORY_LABELS,
  CLIENT_REQUEST_CATEGORIES,
  CLIENT_REQUEST_PRIORITIES,
  CLIENT_REQUEST_STATUSES,
  isClientRequestCategory,
  isClientRequestMessageVisibility,
  isClientRequestPriority,
  isClientRequestStatus,
  optionalTrimmedString,
  parseClientRequestMessageBody,
} from "./client-requests"
import {
  parseTimelineUpdate,
  timelineEventForRequestStatus,
} from "./client-timeline"

describe("client request helpers", () => {
  it("accepts the supported category, priority, and status values", () => {
    expect(CLIENT_REQUEST_CATEGORIES.every(isClientRequestCategory)).toBe(true)
    expect(CLIENT_REQUEST_PRIORITIES.every(isClientRequestPriority)).toBe(true)
    expect(CLIENT_REQUEST_STATUSES.every(isClientRequestStatus)).toBe(true)
  })

  it("rejects unknown request values", () => {
    expect(isClientRequestCategory("billing")).toBe(false)
    expect(isClientRequestPriority("urgent")).toBe(false)
    expect(isClientRequestStatus("blocked")).toBe(false)
    expect(isClientRequestMessageVisibility("public")).toBe(false)
  })

  it("keeps labels available for admin display", () => {
    expect(CATEGORY_LABELS.form_issue).toBe("Contact form problem")
  })

  it("normalises optional text input", () => {
    expect(optionalTrimmedString("  note  ")).toBe("note")
    expect(optionalTrimmedString("   ")).toBeNull()
    expect(optionalTrimmedString(null)).toBeNull()
  })

  it("validates admin request message bodies", () => {
    expect(isClientRequestMessageVisibility("client_visible")).toBe(true)
    expect(isClientRequestMessageVisibility("internal")).toBe(true)
    expect(parseClientRequestMessageBody("  Reply  ")).toEqual({ ok: true, data: "Reply" })
    expect(parseClientRequestMessageBody("   ")).toEqual({ ok: false, error: "Message body is required." })
  })

  it("maps request statuses to timeline events", () => {
    expect(timelineEventForRequestStatus("triaged")?.type).toBe("request_triaged")
    expect(timelineEventForRequestStatus("in_progress")?.type).toBe("request_in_progress")
    expect(timelineEventForRequestStatus("waiting_client")?.type).toBe("request_waiting_client")
    expect(timelineEventForRequestStatus("completed")?.type).toBe("request_completed")
    expect(timelineEventForRequestStatus("new")).toBeNull()
  })

  it("validates manual timeline updates", () => {
    expect(parseTimelineUpdate({
      title: "Launch note",
      description: "Published for the client.",
      visibility: "client_visible",
    })).toEqual({
      ok: true,
      data: {
        title: "Launch note",
        description: "Published for the client.",
        visibility: "client_visible",
      },
    })
    expect(parseTimelineUpdate({ title: "Private", description: "Admin context", visibility: "internal" }).ok).toBe(true)
    expect(parseTimelineUpdate({ title: "Bad", description: "Bad visibility", visibility: "public" }))
      .toEqual({ ok: false, error: "Timeline visibility is invalid." })
  })
})
