import { readFileSync } from "node:fs"
import { NextRequest, NextResponse } from "next/server"
import { describe, expect, it } from "vitest"
import {
  CRAWLER_HOMEPAGE_VARIANT,
  isRecognizedCrawler,
  normalizeExperienceQuery,
  resolvePublicRedirectOrigin,
  traditionalHomepageRedirectLocation,
  traditionalHomepageRedirectUrl,
} from "./experience-routing"

function request(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, { headers })
}

describe("public experience SEO routing", () => {
  it.each([
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    "DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)",
  ])("recognizes search crawler user agents", (userAgent) => {
    expect(isRecognizedCrawler(userAgent)).toBe(true)
    expect(CRAWLER_HOMEPAGE_VARIANT).toBe("normal_with_interactive_cta")
  })

  it("does not classify an ordinary browser as a crawler", () => {
    expect(isRecognizedCrawler("Mozilla/5.0 Chrome/126.0 Safari/537.36")).toBe(false)
  })

  it("accepts only the explicit normal experience override", () => {
    expect(normalizeExperienceQuery("normal")).toBe("normal")
    expect(normalizeExperienceQuery("interactive")).toBeNull()
    expect(normalizeExperienceQuery("fullscreen_choice")).toBeNull()
  })

  it("keeps the legacy destination as a host-independent path", () => {
    expect(traditionalHomepageRedirectLocation()).toBe("/?experience=normal")
  })

  it("does not leak localhost:3100 when Host is the public site and nextUrl is the host-nginx publish origin", () => {
    const incoming = request("https://localhost:3100/traditional?utm_source=old#section", {
      host: "scalesmiths.co.uk",
      "x-forwarded-proto": "https",
      "x-forwarded-host": "evil.example",
    })

    expect(incoming.nextUrl.origin).toBe("https://localhost:3100")
    const leaked = NextResponse.redirect(new URL(traditionalHomepageRedirectLocation(), incoming.nextUrl), 308)
    expect(leaked.headers.get("Location")).toBe("https://localhost:3100/?experience=normal")

    const destination = traditionalHomepageRedirectUrl(incoming)
    const response = NextResponse.redirect(destination, 308)
    const location = response.headers.get("Location") ?? ""

    expect(response.status).toBe(308)
    expect(location).toBe("https://scalesmiths.co.uk/?experience=normal")
    expect(location).not.toMatch(/localhost/i)
    expect(location).not.toMatch(/:3100/)
    expect(location).not.toMatch(/evil\.example/)
  })

  it("uses the default public origin when Host is the host-nginx publish address", () => {
    const incoming = request("https://localhost:3100/traditional", {
      host: "localhost:3100",
      "x-forwarded-proto": "https",
    })

    const location = traditionalHomepageRedirectUrl(incoming, {}).toString()
    expect(location).toBe("https://scalesmiths.co.uk/?experience=normal")
    expect(location).not.toMatch(/localhost/i)
  })

  it("ignores a localhost NEXT_PUBLIC_SITE_URL instead of emitting it", () => {
    const incoming = request("https://localhost:3100/traditional", {
      host: "localhost:3100",
      "x-forwarded-proto": "https",
    })

    const location = traditionalHomepageRedirectUrl(incoming, {
      NEXT_PUBLIC_SITE_URL: "https://localhost:3100",
    }).toString()

    expect(location).toBe("https://scalesmiths.co.uk/?experience=normal")
    expect(location).not.toMatch(/localhost/i)
  })

  it("uses a configured public site URL when Host is the green-slot publish port", () => {
    const incoming = request("https://localhost:3200/traditional", {
      host: "localhost:3200",
      "x-forwarded-proto": "https",
    })

    expect(traditionalHomepageRedirectUrl(incoming, {
      NEXT_PUBLIC_SITE_URL: "https://www.scalesmiths.co.uk/",
    }).toString()).toBe("https://www.scalesmiths.co.uk/?experience=normal")
  })

  it("keeps a genuine local Playwright origin so tests do not bounce to production", () => {
    const incoming = request("http://127.0.0.1:3210/traditional", {
      host: "127.0.0.1:3210",
    })

    expect(traditionalHomepageRedirectUrl(incoming, {
      NEXT_PUBLIC_SITE_URL: "https://scalesmiths.co.uk",
    }).toString()).toBe("http://127.0.0.1:3210/?experience=normal")
  })

  it("keeps next-dev on localhost:3000 on the same origin", () => {
    const incoming = request("http://localhost:3000/traditional", {
      host: "localhost:3000",
    })

    expect(traditionalHomepageRedirectUrl(incoming).toString()).toBe("http://localhost:3000/?experience=normal")
  })

  it("does not take x-forwarded-host over the nginx Host header", () => {
    const incoming = request("https://localhost:3100/traditional", {
      host: "scalesmiths.co.uk",
      "x-forwarded-host": "attacker.example",
      "x-forwarded-proto": "https",
    })

    expect(resolvePublicRedirectOrigin(incoming)).toBe("https://scalesmiths.co.uk")
  })

  it("wires middleware to the public-origin helper instead of cloning nextUrl", () => {
    const source = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8")
    expect(source).toContain("NextResponse.redirect(traditionalHomepageRedirectUrl(request), 308)")
    expect(source).not.toContain("traditionalHomepageRedirectUrl(request.nextUrl)")
  })
})
