import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"
import { middleware } from "../middleware"
import { CANONICAL_PUBLIC_ORIGIN, canonicalWwwRedirectUrl } from "./canonical-host"

describe("www canonical host", () => {
  it("redirects the www alias to the apex and keeps the path and query", () => {
    const destination = canonicalWwwRedirectUrl(
      "www.scalesmiths.co.uk",
      new URL("https://www.scalesmiths.co.uk/pricing?plan=partnership#published-prices"),
    )
    expect(destination?.toString()).toBe(`${CANONICAL_PUBLIC_ORIGIN}/pricing?plan=partnership`)
  })

  it("ignores the apex host, admin host and local development", () => {
    const pricing = new URL("https://scalesmiths.co.uk/pricing")
    expect(canonicalWwwRedirectUrl("scalesmiths.co.uk", pricing)).toBeNull()
    expect(canonicalWwwRedirectUrl("admin.scalesmiths.co.uk", new URL("https://admin.scalesmiths.co.uk/"))).toBeNull()
    expect(canonicalWwwRedirectUrl("localhost:3000", new URL("http://localhost:3000/"))).toBeNull()
  })

  it("redirects in middleware before an experience cookie can be set on www", () => {
    const request = new NextRequest("https://localhost:3100/industries/trades-home-services/pest-control?utm_source=google", {
      headers: { host: "www.scalesmiths.co.uk", "x-forwarded-proto": "https" },
    })
    const response = middleware(request)
    expect(response.status).toBe(308)
    expect(response.headers.get("location")).toBe(
      `${CANONICAL_PUBLIC_ORIGIN}/industries/trades-home-services/pest-control?utm_source=google`,
    )
    expect(response.headers.get("set-cookie") ?? "").not.toMatch(/experience/i)
  })
})
