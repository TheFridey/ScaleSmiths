import { describe, expect, it } from "vitest"
import { locationPages, metadataForLocation } from "./location-pages"

describe("location pages", () => {
  it("keeps Nottingham and Hucknall useful and distinct", () => {
    expect(locationPages.nottingham.services.length).toBeGreaterThanOrEqual(6)
    expect(locationPages.hucknall.proofLinks).toEqual(["glow-tanning", "precision-finish-plastering-rendering"])
    expect(locationPages.nottingham.intro).not.toBe(locationPages.hucknall.intro)
    expect(locationPages.nottingham.sections.flatMap((section) => section.paragraphs)).not.toEqual(locationPages.hucknall.sections.flatMap((section) => section.paragraphs))
  })

  it("creates canonical, social-ready metadata for each location", () => {
    for (const page of Object.values(locationPages)) {
      const metadata = metadataForLocation(page)
      expect(metadata.alternates).toEqual({ canonical: `/locations/${page.slug}` })
      expect(metadata.openGraph?.title).toBe(page.metaTitle)
      expect(metadata.description).toBe(page.description)
    }
  })
})
