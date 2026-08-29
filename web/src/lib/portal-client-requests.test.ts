import { describe, expect, it } from "vitest"
import { isTerminalRequestStatus } from "./client-requests"

describe("isTerminalRequestStatus", () => {
  it("treats completed and cancelled as terminal", () => {
    expect(isTerminalRequestStatus("completed")).toBe(true)
    expect(isTerminalRequestStatus("cancelled")).toBe(true)
  })

  it("treats every other status as non-terminal", () => {
    expect(isTerminalRequestStatus("new")).toBe(false)
    expect(isTerminalRequestStatus("triaged")).toBe(false)
    expect(isTerminalRequestStatus("in_progress")).toBe(false)
    expect(isTerminalRequestStatus("waiting_client")).toBe(false)
  })
})
