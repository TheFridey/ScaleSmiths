import { describe, expect, it } from "vitest"
import { buildLogs } from "./build-logs"
import { buildPublicSitemap, LOCATIONS_HUB_LAST_MODIFIED_ISO, PUBLIC_CONTENT_LAST_MODIFIED_ISO, QUOTE_PAGE_LAST_MODIFIED_ISO } from "./public-sitemap"

describe("public sitemap", () => {
  it("publishes one canonical normal homepage and excludes the redirect-only legacy route", () => {
    const entries = buildPublicSitemap()
    const urls = entries.map((entry) => entry.url)

    expect(urls.filter((url) => url === "https://scalesmiths.co.uk")).toHaveLength(1)
    expect(urls).not.toContain("https://scalesmiths.co.uk/")
    expect(urls).not.toContain("https://scalesmiths.co.uk/traditional")
    expect(urls).toContain("https://scalesmiths.co.uk/interactive")
    expect(urls).not.toContain("https://scalesmiths.co.uk/industries/request")
    for (const log of buildLogs) expect(urls).not.toContain(`https://scalesmiths.co.uk/work/${log.slug}`)
    expect(urls).toContain("https://scalesmiths.co.uk/local-growth-check")
    expect(urls).toContain("https://scalesmiths.co.uk/local-growth")
    expect(urls).toContain("https://scalesmiths.co.uk/custom-systems")
    expect(urls).toContain("https://scalesmiths.co.uk/enterprise")
    expect(urls).toContain("https://scalesmiths.co.uk/enterprise-websites")
    expect(urls).toContain("https://scalesmiths.co.uk/enterprise/delivery")
    expect(urls).toContain("https://scalesmiths.co.uk/enterprise/contact")
    expect(urls).toContain("https://scalesmiths.co.uk/security")
    expect(urls).toContain("https://scalesmiths.co.uk/about")
    expect(urls).toContain("https://scalesmiths.co.uk/locations")
    expect(urls).toContain("https://scalesmiths.co.uk/locations/nottingham")
    expect(urls).toContain("https://scalesmiths.co.uk/locations/hucknall")
    expect(urls).toContain("https://scalesmiths.co.uk/local-seo-nottingham")
    expect(urls).toContain("https://scalesmiths.co.uk/managed-website-hosting")
    expect(urls).toContain("https://scalesmiths.co.uk/faq")
    expect(new Set(urls).size).toBe(urls.length)
  })

  it("publishes the Insights hub, all topic clusters and the complete initial library", () => {
    const urls = buildPublicSitemap().map((entry) => entry.url)
    expect(urls).toContain("https://scalesmiths.co.uk/insights")
    for (const topic of ["websites", "seo", "development", "infrastructure", "enterprise"]) expect(urls).toContain(`https://scalesmiths.co.uk/insights/${topic}`)
    expect(urls.filter((url) => /\/insights\/[^/]+$/.test(url)).length).toBe(40)
  })

  it("uses stable source-controlled last-modified values", () => {
    const first = buildPublicSitemap().map((entry) => entry.lastModified instanceof Date ? entry.lastModified.toISOString() : entry.lastModified)
    const second = buildPublicSitemap().map((entry) => entry.lastModified instanceof Date ? entry.lastModified.toISOString() : entry.lastModified)

    expect(first).toEqual(second)
    expect(first).toContain(PUBLIC_CONTENT_LAST_MODIFIED_ISO)
    expect(first).toContain(LOCATIONS_HUB_LAST_MODIFIED_ISO)
    expect(first).toContain(QUOTE_PAGE_LAST_MODIFIED_ISO)
    const byUrl = new Map(buildPublicSitemap().map((entry) => [entry.url, entry.lastModified instanceof Date ? entry.lastModified.toISOString() : entry.lastModified]))
    expect(byUrl.get("https://scalesmiths.co.uk/locations")).toBe(LOCATIONS_HUB_LAST_MODIFIED_ISO)
    expect(byUrl.get("https://scalesmiths.co.uk/quote")).toBe(QUOTE_PAGE_LAST_MODIFIED_ISO)
    expect(byUrl.get("https://scalesmiths.co.uk/industries/trades-home-services")).toBe("2026-10-27T00:00:00.000Z")
    expect(byUrl.get("https://scalesmiths.co.uk")).toBe(PUBLIC_CONTENT_LAST_MODIFIED_ISO)
  })
})
