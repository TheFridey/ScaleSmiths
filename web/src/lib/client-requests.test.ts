import { describe, expect, it } from "vitest"
import {
  isClientRequestCategory,
  isClientRequestPriority,
  isClientRequestStatus,
  parseClientRequestPayload,
} from "./client-requests"

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
})
