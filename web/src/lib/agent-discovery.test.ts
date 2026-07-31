import { readFile } from "node:fs/promises"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { HOMEPAGE_LINK_HEADER, SITE_ORIGIN, buildApiCatalog, buildOpenApiDocument } from "./agent-discovery"

describe("agent discovery metadata", () => {
  it("emits a well-formed RFC 8288 Link header", () => {
    const entries = HOMEPAGE_LINK_HEADER.split(", ")
    expect(entries.length).toBeGreaterThan(0)
    for (const entry of entries) {
      // <target-uri>; rel="registered-relation"[; param="value"]
      expect(entry).toMatch(/^<https?:\/\/[^>]+>; rel="[a-z-]+"(; [a-z-]+="[^"]+")*$/)
    }
    expect(HOMEPAGE_LINK_HEADER).toContain('rel="api-catalog"')
    expect(HOMEPAGE_LINK_HEADER).toContain('rel="service-desc"')
    expect(HOMEPAGE_LINK_HEADER).toContain('rel="status"')
  })

  it("keeps the Next config copy of the Link header in step with the library", async () => {
    // next.config.mjs cannot import the TypeScript module, so the value is duplicated.
    // This test is what stops the two drifting apart.
    const config = await readFile(path.resolve(process.cwd(), "next.config.mjs"), "utf8")
    for (const relation of ["api-catalog", "service-desc", "status", "sitemap", "describedby", "canonical"]) {
      expect(config, `next.config.mjs is missing rel="${relation}"`).toContain(`rel="${relation}"`)
    }
    const configRelations = [...config.matchAll(/rel="([a-z-]+)"/g)].map((match) => match[1]).sort()
    const libraryRelations = [...HOMEPAGE_LINK_HEADER.matchAll(/rel="([a-z-]+)"/g)].map((match) => match[1]).sort()
    expect(configRelations).toEqual(libraryRelations)
  })

  it("only advertises targets this application actually serves", () => {
    const targets = [...HOMEPAGE_LINK_HEADER.matchAll(/<([^>]+)>/g)].map((match) => match[1])
    const served = new Set([
      `${SITE_ORIGIN}/.well-known/api-catalog`,
      `${SITE_ORIGIN}/openapi.json`,
      `${SITE_ORIGIN}/api/health`,
      `${SITE_ORIGIN}/sitemap.xml`,
      `${SITE_ORIGIN}/llms.txt`,
      `${SITE_ORIGIN}/`,
    ])
    for (const target of targets) expect(served.has(target), `${target} is advertised but not served`).toBe(true)
  })

  it("describes only the genuinely public endpoints in OpenAPI", () => {
    const document = buildOpenApiDocument()
    expect(document.openapi).toBe("3.1.0")
    expect(Object.keys(document.paths).sort()).toEqual(["/api/health", "/api/quote"])
    // The private admin and Forge surfaces must never be advertised publicly.
    const serialised = JSON.stringify(document)
    for (const forbidden of ["/api/forge", "/api/admin", "/dashboard", "openid", "oauth"]) {
      expect(serialised.toLowerCase()).not.toContain(forbidden)
    }
  })

  it("publishes an RFC 9264 linkset whose targets resolve to the OpenAPI document and health check", () => {
    const catalog = buildApiCatalog()
    expect(Array.isArray(catalog.linkset)).toBe(true)
    const [entry] = catalog.linkset
    expect(entry.anchor).toBe(`${SITE_ORIGIN}/api`)
    expect(entry["service-desc"][0].href).toBe(`${SITE_ORIGIN}/openapi.json`)
    expect(entry.status[0].href).toBe(`${SITE_ORIGIN}/api/health`)
    for (const relation of ["service-desc", "service-doc", "status"]) {
      expect(entry[relation as "service-desc"][0].href.startsWith("https://")).toBe(true)
    }
  })

  it("declares no authentication or payment scheme, because the site implements neither", () => {
    const serialised = JSON.stringify(buildOpenApiDocument())
    expect(serialised).not.toContain("securitySchemes")
    expect(serialised).not.toContain("x-payment-info")
    expect(buildOpenApiDocument().paths["/api/quote"].post.description).toContain("no payment is required")
  })
})
