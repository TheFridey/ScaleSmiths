import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/db", () => ({ db: { execute: vi.fn() } }))
import { sendApplicationReceived } from "./partner-application-email"

const ENABLED = { PARTNER_EMAIL_ENABLED: "true", RESEND_API_KEY: "re_test_only", RESEND_FROM: "partners@example.invalid" } as unknown as NodeJS.ProcessEnv

describe("application received confirmation", () => {
  it("sends nothing while the switch is off, and logs that outcome without the address", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const transport = vi.fn(), execute = vi.fn().mockResolvedValue(undefined)
    expect(await sendApplicationReceived({ name: "Applicant", email: "Applicant@Example.invalid" }, { env: {} as NodeJS.ProcessEnv, transport, execute })).toBe("disabled")
    expect(transport).not.toHaveBeenCalled()
    const logged = JSON.stringify(execute.mock.calls[0][0])
    expect(logged).not.toMatch(/example\.invalid/i)
    expect(JSON.stringify((console.warn as unknown as { mock: { calls: unknown[][] } }).mock.calls)).not.toMatch(/example\.invalid/i)
  })
  it("sends one branded confirmation when enabled and records a delivery failure without throwing", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const transport = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const execute = vi.fn().mockResolvedValue(undefined)
    expect(await sendApplicationReceived({ name: "Alex Applicant", email: "a@example.invalid" }, { env: ENABLED, transport, execute })).toBe("sent")
    expect(transport.mock.calls[0][0]).toMatchObject({ to: "a@example.invalid", subject: "We have received your ScaleSmiths partner application" })
    expect(transport.mock.calls[0][1]).toMatch(/^application-received-/)
    expect(await sendApplicationReceived({ name: "Alex Applicant", email: "a@example.invalid" }, { env: ENABLED, transport, execute: vi.fn().mockRejectedValue(new Error("db down")) })).toBe("failed")
  })
})
