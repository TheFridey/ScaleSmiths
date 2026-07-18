import { describe, expect, it } from "vitest"
import { resolveDiscoveryCallAction, validBookingUrl } from "./discovery-booking"

describe("discovery booking action", () => {
  it("uses a genuine HTTPS scheduler and Book wording when configured", () => {
    expect(resolveDiscoveryCallAction("https://scheduler.example.test/discovery?team=scalesmiths")).toEqual({
      kind: "booking",
      href: "https://scheduler.example.test/discovery?team=scalesmiths",
      label: "Book a Discovery Call",
      external: true,
      destinationHost: "scheduler.example.test",
    })
  })

  it("uses the enquiry route and Request wording when unconfigured", () => {
    expect(resolveDiscoveryCallAction("")).toEqual({
      kind: "enquiry",
      href: "/quote?intent=discovery_call",
      label: "Request a Discovery Call",
      external: false,
    })
  })

  it.each([
    "javascript:alert(1)",
    "http://scheduler.example.test/discovery",
    "https://user:password@scheduler.example.test/discovery",
    "not a URL",
  ])("fails closed for invalid booking URL %s", (value) => {
    expect(validBookingUrl(value)).toBeNull()
    expect(resolveDiscoveryCallAction(value).kind).toBe("enquiry")
  })
})
