import { describe, expect, it } from "vitest"
import { buildServiceJourneySchemas, metadataForServiceJourney, projectsForJourney, serviceJourneys } from "./service-journeys"

describe("service buying journeys", () => {
  it("keeps local and systems audiences, proof, and calls to action distinct", () => {
    const local = serviceJourneys["local-growth"]
    const systems = serviceJourneys["custom-systems"]

    expect(local.audience).toContain("Trades and home services")
    expect(systems.audience).toContain("SaaS and product founders")
    expect(local.primaryCta).toEqual({ href: "/local-growth-check", label: "Explore the Business Growth Audit" })
    expect(systems.primaryCta).toEqual({ href: "/quote", label: "Start a Project Brief" })
    expect(systems.secondaryCta.href).toBe("/quote?intent=strategy_call")
    expect(new Set(local.proofSlugs)).not.toContain(systems.proofSlugs[0])
    expect(local.description).not.toBe(systems.description)
  })

  it("maps only existing case studies to each journey", () => {
    expect(projectsForJourney(serviceJourneys["local-growth"]).map((project) => project.slug)).toEqual(["glow-tanning", "csds"])
    expect(projectsForJourney(serviceJourneys["custom-systems"]).map((project) => project.slug)).toEqual(["pinkys-prints", "the-business-circle", "prymal", "veteranfinder"])
  })

  it("builds canonical metadata, service schema, and breadcrumbs", () => {
    for (const journey of Object.values(serviceJourneys)) {
      expect(metadataForServiceJourney(journey).alternates).toEqual({ canonical: `/${journey.slug}` })
      const schemas = buildServiceJourneySchemas(journey)
      expect(schemas.map((schema) => schema["@type"])).toEqual(["WebPage", "Service", "BreadcrumbList"])
      expect(JSON.stringify(schemas)).toContain(`https://scalesmiths.co.uk/${journey.slug}`)
    }
  })

  it("does not introduce unverified price promises", () => {
    const publicCopy = JSON.stringify(serviceJourneys)
    expect(publicCopy).not.toMatch(/£|GBP|starting at|from \d/i)
    expect(serviceJourneys["local-growth"].process.some((step) => /optional|scoped separately/i.test(step.description))).toBe(true)
  })
})
