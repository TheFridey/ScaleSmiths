import { describe, expect, it } from "vitest"
import { normalizeRequestId } from "./request-correlation"

describe("web request correlation", () => {
  it("propagates a safe incoming request ID", () => {
    expect(normalizeRequestId(" request-123 ", () => "generated")).toBe("request-123")
  })

  it("replaces missing, oversized or unsafe IDs", () => {
    expect(normalizeRequestId(null, () => "generated-1")).toBe("generated-1")
    expect(normalizeRequestId("contains spaces", () => "generated-2")).toBe("generated-2")
    expect(normalizeRequestId("a".repeat(129), () => "generated-3")).toBe("generated-3")
  })
})
