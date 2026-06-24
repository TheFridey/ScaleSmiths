import { describe, expect, it } from "vitest"
import {
  CATEGORY_LABELS,
  CLIENT_REQUEST_CATEGORIES,
  CLIENT_REQUEST_PRIORITIES,
  CLIENT_REQUEST_STATUSES,
  isClientRequestCategory,
  isClientRequestPriority,
  isClientRequestStatus,
  optionalTrimmedString,
} from "./client-requests"

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
  })

  it("keeps labels available for admin display", () => {
    expect(CATEGORY_LABELS.form_issue).toBe("Contact form problem")
  })

  it("normalises optional text input", () => {
    expect(optionalTrimmedString("  note  ")).toBe("note")
    expect(optionalTrimmedString("   ")).toBeNull()
    expect(optionalTrimmedString(null)).toBeNull()
  })
})
