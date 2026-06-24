import type { ClientRequestStatus } from "@/lib/client-requests"

export const CLIENT_TIMELINE_EVENT_TYPES = [
  "request_submitted",
  "request_triaged",
  "request_in_progress",
  "request_waiting_client",
  "request_completed",
  "admin_reply",
  "monthly_report_published",
  "manual_update",
] as const

export type ClientTimelineEventType = (typeof CLIENT_TIMELINE_EVENT_TYPES)[number]
export type ClientTimelineVisibility = "client_visible" | "internal"

type ParseTimelineUpdateResult =
  | { ok: true; data: { title: string; description: string; visibility: ClientTimelineVisibility } }
  | { ok: false; error: string }

export function parseTimelineUpdate(input: Record<string, unknown>): ParseTimelineUpdateResult {
  const title = optionalString(input.title, 180)
  const description = optionalString(input.description, 2000)
  const visibility: ClientTimelineVisibility | null =
    input.visibility === "internal" ? "internal" : input.visibility === "client_visible" ? "client_visible" : null

  if (!title) return { ok: false as const, error: "Timeline title is required." }
  if (!description) return { ok: false as const, error: "Timeline description is required." }
  if (!visibility) return { ok: false as const, error: "Timeline visibility is invalid." }

  return { ok: true as const, data: { title, description, visibility } }
}

export function timelineEventForRequestStatus(status: ClientRequestStatus) {
  if (status === "triaged") {
    return {
      type: "request_triaged" as const,
      title: "Request triaged",
      description: "ScaleSmiths has reviewed your request and assigned the next action.",
    }
  }

  if (status === "in_progress") {
    return {
      type: "request_in_progress" as const,
      title: "Work started",
      description: "Your request is now in progress.",
    }
  }

  if (status === "waiting_client") {
    return {
      type: "request_waiting_client" as const,
      title: "Waiting for your input",
      description: "ScaleSmiths needs a reply or extra information before this can continue.",
    }
  }

  if (status === "completed") {
    return {
      type: "request_completed" as const,
      title: "Request completed",
      description: "This request has been marked complete.",
    }
  }

  return null
}

export function monthlyReportPublishedTimelineEvent(title: string, description: string) {
  return {
    type: "monthly_report_published" as const,
    title,
    description,
  }
}

function optionalString(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : null
}
