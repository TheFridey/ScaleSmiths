import { beforeEach, describe, expect, it, vi } from "vitest"

const safeRequest = vi.fn()

vi.mock("@/lib/server/safe-outbound", () => ({
  SafeOutboundError: class SafeOutboundError extends Error { code = "blocked" },
  createSafeOutboundClient: () => safeRequest,
}))

vi.mock("@/lib/server/forge-ai", () => ({
  runForgeAiJson: vi.fn(async (input: { mockData: unknown }) => ({ data: input.mockData })),
}))

describe("Forge URL autofill", () => {
  beforeEach(() => safeRequest.mockReset())

  it("reads public website facts into project and structured intake suggestions", async () => {
    safeRequest.mockResolvedValue({
      status: 200,
      url: "https://roofing.example/",
      headers: new Headers({ "content-type": "text/html" }),
      body: "<html><head><title>Nottingham Commercial Roofing | Acme Roofs</title><meta name=\"description\" content=\"Commercial roofing repairs for businesses in Nottingham\"></head><body><h1>Commercial roofing specialists</h1><p>We provide roof repair and maintenance services for facilities managers and businesses.</p><a href=\"/contact\">Get a quote</a></body></html>",
    })
    const { generateForgeUrlAutofill } = await import("./forge-url-autofill")
    const result = await generateForgeUrlAutofill("roofing.example")
    expect(result.project.businessName).toContain("Nottingham Commercial Roofing")
    expect(result.project.industry).toBe("Trade services")
    expect(result.intake.primaryWebsiteGoal).toContain("quote")
    expect(result.sourcePages).toContain("https://roofing.example/")
  })

  it("returns an actionable failure when no public page can be read", async () => {
    safeRequest.mockResolvedValue({
      status: 503,
      url: "https://offline.example/",
      headers: new Headers({ "content-type": "text/html" }),
      body: "",
    })
    const { generateForgeUrlAutofill } = await import("./forge-url-autofill")
    await expect(generateForgeUrlAutofill("https://offline.example")).rejects.toThrow("No readable public pages")
  })
})
