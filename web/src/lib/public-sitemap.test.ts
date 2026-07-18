import { describe, expect, it } from "vitest"
import { buildPublicSitemap, PUBLIC_CONTENT_LAST_MODIFIED_ISO } from "./public-sitemap"

describe("public sitemap", () => {
  it("publishes one canonical normal homepage and excludes the redirect-only legacy route", () => {
    const entries = buildPublicSitemap()
    const urls = entries.map((entry) => entry.url)

    expect(urls.filter((url) => url === "https://scalesmiths.co.uk")).toHaveLength(1)
    expect(urls).not.toContain("https://scalesmiths.co.uk/traditional")
    expect(urls).toContain("https://scalesmiths.co.uk/interactive")
    expect(new Set(urls).size).toBe(urls.length)
  })

  it("uses stable source-controlled last-modified values", () => {
    const first = buildPublicSitemap().map((entry) => entry.lastModified instanceof Date ? entry.lastModified.toISOString() : entry.lastModified)
    const second = buildPublicSitemap().map((entry) => entry.lastModified instanceof Date ? entry.lastModified.toISOString() : entry.lastModified)

    expect(first).toEqual(second)
    expect(first).toContain(PUBLIC_CONTENT_LAST_MODIFIED_ISO)
  })
})
