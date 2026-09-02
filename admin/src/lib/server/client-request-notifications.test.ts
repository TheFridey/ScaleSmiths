import { describe, expect, it } from "vitest"
import { sendClientReplyNotification, sanitizeHeaderValue } from "./client-request-notifications"

describe("sanitizeHeaderValue", () => {
  it("strips CR, LF, and NUL but leaves ordinary spaces alone", () => {
    expect(sanitizeHeaderValue("a\r\nb" + String.fromCharCode(0) + "c")).toBe("abc")
    expect(sanitizeHeaderValue("Hello world")).toBe("Hello world")
  })
})

describe("sendClientReplyNotification", () => {
  it("skips sending and reports no_email when the client has no address on file", async () => {
    const result = await sendClientReplyNotification(
      { requestId: 1, messageId: 2, portalClientId: "client-one", requestTitle: "Portal messages", messageBody: "Hi", clientEmail: null },
      { NODE_ENV: "test", RESEND_API_KEY: "key", RESEND_FROM: "noreply@scalesmiths.co.uk" },
    )
    expect(result).toEqual({ ok: false, status: "failed", failureReason: "no_email" })
  })

  it("reports a configuration failure without throwing when Resend env vars are missing", async () => {
    const result = await sendClientReplyNotification(
      { requestId: 1, messageId: 2, portalClientId: "client-one", requestTitle: "Portal messages", messageBody: "Hi", clientEmail: "client@example.com" },
      { NODE_ENV: "test" },
    )
    expect(result).toEqual({ ok: false, status: "failed", failureReason: "configuration" })
  })
})
