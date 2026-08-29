import { describe, expect, it } from "vitest"
import {
  isClientRequestCategory,
  isClientRequestPriority,
  isClientRequestStatus,
  parseClientRequestMessageBody,
  parseClientRequestPayload,
  serializeClientPortalMessage,
  serializeClientPortalRequest,
} from "./client-requests"
import {
  parseTimelineUpdate,
  serializeClientPortalTimelineEvent,
  timelineEventForRequestStatus,
} from "./client-timeline"

describe("client request helpers", () => {
  it("validates allowed enum values", () => {
    expect(isClientRequestCategory("website_issue")).toBe(true)
    expect(isClientRequestCategory("billing")).toBe(false)
    expect(isClientRequestPriority("critical")).toBe(true)
    expect(isClientRequestPriority("urgent")).toBe(false)
    expect(isClientRequestStatus("waiting_client")).toBe(true)
    expect(isClientRequestStatus("blocked")).toBe(false)
  })

  it("parses a minimal client request with defaults", () => {
    const parsed = parseClientRequestPayload({
      clientId: "acme",
      title: "Update homepage copy",
      description: "Please update the hero paragraph.",
    })

    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.data.category).toBe("general_support")
    expect(parsed.data.priority).toBe("medium")
    expect(parsed.data.status).toBe("new")
    expect(parsed.data.completedAt).toBeNull()
  })

  it("rejects invalid optional metadata and enum values", () => {
    expect(parseClientRequestPayload({
      clientId: "acme",
      title: "Broken form",
      description: "The contact form errors.",
      category: "form_issue",
      priority: "urgent",
    })).toEqual({ ok: false, error: "Priority is invalid." })

    expect(parseClientRequestPayload({
      clientId: "acme",
      title: "Assets",
      description: "Adding files.",
      attachmentMetadata: "file.jpg",
    })).toEqual({ ok: false, error: "Attachment metadata must be an object." })
  })

  it("serializes only fields that are safe for the client portal", () => {
    const createdAt = new Date("2026-06-01T10:00:00Z")
    const updatedAt = new Date("2026-06-02T10:00:00Z")
    const serialized = serializeClientPortalRequest({
      id: 12,
      title: "Broken form",
      description: "The enquiry form is failing.",
      category: "form_issue",
      priority: "high",
      status: "triaged",
      affectedUrl: "https://example.com/contact",
      createdAt,
      updatedAt,
      internalNotes: "Do not show this.",
      forgeSummary: "Internal triage summary.",
      forgeSuggestedActions: "Internal checklist.",
      forgeSuggestedReply: "Draft reply for admin review.",
      attachmentMetadata: { privateUploadId: "asset-1" },
    })

    expect(serialized).toEqual({
      id: 12,
      title: "Broken form",
      description: "The enquiry form is failing.",
      category: "form_issue",
      priority: "high",
      status: "triaged",
      affectedUrl: "https://example.com/contact",
      createdAt,
      updatedAt,
      clientLastReadAt: null,
    })
    expect(serialized).not.toHaveProperty("internalNotes")
    expect(serialized).not.toHaveProperty("forgeSummary")
    expect(serialized).not.toHaveProperty("forgeSuggestedActions")
    expect(serialized).not.toHaveProperty("forgeSuggestedReply")
    expect(serialized).not.toHaveProperty("attachmentMetadata")
  })

  it("serializes only client-visible request messages for the portal", () => {
    const createdAt = new Date("2026-06-03T10:00:00Z")

    expect(serializeClientPortalMessage({
      id: 1,
      requestId: 12,
      senderType: "admin",
      senderName: "ScaleSmiths",
      body: "We are checking this now.",
      visibility: "client_visible",
      createdAt,
      updatedAt: null,
    })).toEqual({
      id: 1,
      requestId: 12,
      senderType: "admin",
      senderName: "ScaleSmiths",
      body: "We are checking this now.",
      createdAt,
    })

    expect(serializeClientPortalMessage({
      id: 2,
      requestId: 12,
      senderType: "admin",
      senderName: "ScaleSmiths",
      body: "Private triage note.",
      visibility: "internal",
      createdAt,
      updatedAt: null,
    })).toBeNull()
  })

  it("validates client reply bodies", () => {
    expect(parseClientRequestMessageBody("  Thanks for the update.  ")).toEqual({ ok: true, data: "Thanks for the update." })
    expect(parseClientRequestMessageBody("   ")).toEqual({ ok: false, error: "Message body is required." })
  })

  it("serializes only client-visible timeline events for the portal", () => {
    const createdAt = new Date("2026-06-04T10:00:00Z")

    expect(serializeClientPortalTimelineEvent({
      id: 1,
      clientId: "acme",
      requestId: 12,
      projectId: null,
      type: "request_in_progress",
      title: "Work started",
      description: "Your request is now in progress.",
      visibility: "client_visible",
      createdBy: "ScaleSmiths",
      createdAt,
    })).toEqual({
      id: 1,
      requestId: 12,
      projectId: null,
      type: "request_in_progress",
      title: "Work started",
      description: "Your request is now in progress.",
      createdBy: "ScaleSmiths",
      createdAt,
    })

    expect(serializeClientPortalTimelineEvent({
      id: 2,
      clientId: "acme",
      requestId: 12,
      projectId: null,
      type: "manual_update",
      title: "Private update",
      description: "Admin-only context.",
      visibility: "internal",
      createdBy: "ScaleSmiths",
      createdAt,
    })).toBeNull()
  })

  it("maps request statuses to client timeline events", () => {
    expect(timelineEventForRequestStatus("triaged")?.type).toBe("request_triaged")
    expect(timelineEventForRequestStatus("in_progress")?.type).toBe("request_in_progress")
    expect(timelineEventForRequestStatus("waiting_client")?.type).toBe("request_waiting_client")
    expect(timelineEventForRequestStatus("completed")?.type).toBe("request_completed")
    expect(timelineEventForRequestStatus("cancelled")).toBeNull()
  })

  it("validates manual timeline updates", () => {
    expect(parseTimelineUpdate({
      title: "Report published",
      description: "Your monthly report is ready.",
      visibility: "client_visible",
    })).toEqual({
      ok: true,
      data: {
        title: "Report published",
        description: "Your monthly report is ready.",
        visibility: "client_visible",
      },
    })
    expect(parseTimelineUpdate({ title: "", description: "Missing title", visibility: "client_visible" }))
      .toEqual({ ok: false, error: "Timeline title is required." })
    expect(parseTimelineUpdate({ title: "Title", description: "Body", visibility: "public" }))
      .toEqual({ ok: false, error: "Timeline visibility is invalid." })
  })
})
