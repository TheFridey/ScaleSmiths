import { describe, expect, it } from "vitest"
import { resolveDiscoveryCallAction, validBookingUrl, withBookingAttribution } from "./discovery-booking"

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

  it("labels an external scheduler with the ScaleSmiths page that sent the visitor", () => {
    const href = withBookingAttribution("https://scheduler.example.test/discovery?team=scalesmiths", "local growth check")
    const url = new URL(href)
    expect(url.searchParams.get("team")).toBe("scalesmiths")
    expect(url.searchParams.get("utm_source")).toBe("scalesmiths")
    expect(url.searchParams.get("utm_medium")).toBe("referral")
    expect(url.searchParams.get("utm_campaign")).toBe("discovery_call")
    expect(url.searchParams.get("utm_content")).toBe("local-growth-check")
  })

  it("does not replace campaign labels the scheduler already owns", () => {
    const href = withBookingAttribution("https://scheduler.example.test/discovery?utm_source=existing", "homepage")
    expect(new URL(href).searchParams.get("utm_source")).toBe("existing")
    expect(new URL(href).searchParams.get("utm_campaign")).toBe("discovery_call")
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
