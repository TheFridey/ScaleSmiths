import { describe, expect, it } from "vitest"
import { buildPublicSitemap, PUBLIC_CONTENT_LAST_MODIFIED_ISO } from "./public-sitemap"

describe("public sitemap", () => {
  it("publishes one canonical normal homepage and excludes the redirect-only legacy route", () => {
    const entries = buildPublicSitemap()
    const urls = entries.map((entry) => entry.url)

    expect(urls.filter((url) => url === "https://scalesmiths.co.uk")).toHaveLength(1)
    expect(urls).not.toContain("https://scalesmiths.co.uk/traditional")
    expect(urls).toContain("https://scalesmiths.co.uk/interactive")
    expect(urls).toContain("https://scalesmiths.co.uk/local-growth-check")
    expect(urls).toContain("https://scalesmiths.co.uk/local-growth")
    expect(urls).toContain("https://scalesmiths.co.uk/custom-systems")
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
    for (const topic of ["websites", "seo", "growth", "development", "automation", "infrastructure"]) expect(urls).toContain(`https://scalesmiths.co.uk/insights/${topic}`)
    expect(urls.filter((url) => /\/insights\/[^/]+$/.test(url)).length).toBe(31)
  })

  it("uses stable source-controlled last-modified values", () => {
    const first = buildPublicSitemap().map((entry) => entry.lastModified instanceof Date ? entry.lastModified.toISOString() : entry.lastModified)
    const second = buildPublicSitemap().map((entry) => entry.lastModified instanceof Date ? entry.lastModified.toISOString() : entry.lastModified)

    expect(first).toEqual(second)
    expect(first).toContain(PUBLIC_CONTENT_LAST_MODIFIED_ISO)
  })
})
