import { describe, expect, it } from "vitest"
import {
  adjacentCaseStudies,
  cardImage,
  caseStudiesForSlugs,
  draftPreviewEnabled,
  getCaseStudy,
  primaryImage,
  publishedCaseStudies,
  relatedCaseStudies,
  relatedInsightsForCaseStudy,
  relatedServicesForCaseStudy,
} from "./case-studies"
import { resolveClientQuote, resolveOutcomes, resolveVerifiedMetrics } from "./case-study-metrics"
import { approvedClientLogos } from "./client-proof"
import { projects } from "./data"
import { getInsight } from "./insights"
import { landingPages } from "./landing-pages"
import { serviceRouteCatalogue } from "./service-routes"
import type { PublicClaim } from "./public-claims"
import { serviceJourneys } from "./service-journeys"

function claim(overrides: Partial<PublicClaim>): PublicClaim {
  return {
    id: "claim",
    approvedWording: "wording",
    claimType: "metric",
    attributionName: null,
    attributionBusiness: null,
    permittedRoutes: ["/work/*"],
    permittedComponents: [],
    verifiedAt: new Date("2026-09-01"),
    reviewExpiresAt: new Date("2027-09-01"),
    ...overrides,
  }
}

describe("case study publishing", () => {
  it("publishes every project and no drafts", () => {
    expect(publishedCaseStudies().map((study) => study.slug)).toEqual(projects.map((project) => project.slug))
    expect(publishedCaseStudies().every((study) => study.status === "published")).toBe(true)
  })

  it("publishes the completed Confirm-A-Kill flagship", () => {
    expect(draftPreviewEnabled({ NODE_ENV: "production" })).toBe(false)
    const study = getCaseStudy("confirm-a-kill", { includeDrafts: false })
    expect(study).toMatchObject({ status: "published", websiteUrl: "https://www.confirmakill.co.uk/" })
    expect(caseStudiesForSlugs(["confirm-a-kill"])).toHaveLength(1)
  })

  it("only offers a Visit Website link for a recorded live URL", () => {
    for (const study of publishedCaseStudies()) {
      if (study.websiteUrl) expect(study.websiteUrl).toMatch(/^https:\/\//)
    }
    // Pinkys Prints has no confirmed live URL, so it must not offer the link.
    expect(getCaseStudy("pinkys-prints")?.websiteUrl).toBeUndefined()
  })

  it("prefers a real desktop capture and falls back to cover imagery without one", () => {
    const glow = getCaseStudy("glow-tanning")!
    expect(primaryImage(glow)).toMatchObject({ src: "/images/work/glow-tanning/desktop-home.webp", kind: "screenshot" })

    // Pinkys Prints has no confirmed live URL, so it has no captures yet.
    const pinkys = getCaseStudy("pinkys-prints")!
    expect(primaryImage(pinkys)).toMatchObject({ src: "/images/projects/pinkys-prints/hero.jpg", kind: "cover-card" })
    expect(cardImage(pinkys)).toMatchObject({ src: "/images/projects/pinkys-prints/thumb.jpg" })
  })

  it("describes the scope of every case study with evidenced service labels", () => {
    for (const study of publishedCaseStudies()) {
      expect(study.client?.length).toBeGreaterThan(10)
      expect(study.services.length).toBeGreaterThan(0)
    }
  })
})

describe("case study internal linking", () => {
  it("links each case study only to service pages that cite it as proof", () => {
    for (const study of publishedCaseStudies()) {
      for (const link of relatedServicesForCaseStudy(study.slug, Number.POSITIVE_INFINITY)) {
        const slug = link.href.slice(1)
        const cites = serviceJourneys[slug as keyof typeof serviceJourneys]?.proofSlugs.includes(study.slug)
          || landingPages[slug]?.proofLinks.includes(study.slug)
        expect(cites, `${study.slug} -> ${link.href}`).toBe(true)
      }
    }
    expect(relatedServicesForCaseStudy("glow-tanning").map((link) => link.href)).toContain("/local-growth")
  })

  it("suggests related case studies that share a service page and never the study itself", () => {
    const related = relatedCaseStudies("the-business-circle").map((study) => study.slug)
    expect(related.length).toBeGreaterThan(0)
    expect(related).not.toContain("the-business-circle")
  })

  it("only references logos for published case studies", () => {
    for (const slug of Object.keys(approvedClientLogos)) expect(projects.some((project) => project.slug === slug)).toBe(true)
  })
})

describe("case study results and quotes", () => {
  it("shows a metric only with a verified claim permitted for metrics", () => {
    const metrics = [{ key: "organic-clicks" as const, claimId: "m1" }, { key: "enquiries" as const, claimId: "m2" }]
    const resolved = resolveVerifiedMetrics(metrics, [
      claim({ id: "m1", approvedWording: "Measured value", permittedComponents: ["project_metrics"] }),
      claim({ id: "m2", approvedWording: "Wrong placement", permittedComponents: ["project_outcomes"] }),
    ])
    expect(resolved).toHaveLength(1)
    expect(resolved[0]).toMatchObject({ key: "organic-clicks", label: "Organic clicks", value: "Measured value" })
    expect(resolveVerifiedMetrics(metrics, [])).toEqual([])
  })

  it("never renders an unattributed or unapproved quote", () => {
    const quote = claim({ id: "q", claimType: "testimonial", approvedWording: "Genuine words", attributionName: "Name", attributionBusiness: "Business", permittedComponents: ["client_quote"] })
    expect(resolveClientQuote("q", [quote])).toEqual({ quote: "Genuine words", name: "Name", business: "Business" })
    expect(resolveClientQuote("q", [{ ...quote, attributionName: null }])).toBeUndefined()
    expect(resolveClientQuote("q", [{ ...quote, claimType: "metric" }])).toBeUndefined()
    expect(resolveClientQuote("q", [{ ...quote, permittedComponents: ["testimonials"] }])).toBeUndefined()
    expect(resolveClientQuote(undefined, [quote])).toBeUndefined()
  })

  it("keeps outcome wording in the configured order and drops unverified outcomes", () => {
    const claims = [claim({ id: "b", approvedWording: "B", permittedComponents: ["project_outcomes"] }), claim({ id: "a", approvedWording: "A", permittedComponents: ["project_outcomes"] })]
    expect(resolveOutcomes(["a", "missing", "b"], claims)).toEqual(["A", "B"])
  })
})

describe("case study depth and continuity", () => {
  it("describes how every published project was built", () => {
    for (const study of publishedCaseStudies()) {
      expect(study.technicalImplementation.length, `${study.slug} has no technical implementation`).toBeGreaterThan(2)
      expect(study.strategy.length, `${study.slug} has no stated approach`).toBeGreaterThan(0)
      for (const item of study.technicalImplementation) {
        expect(item.title.length).toBeGreaterThan(3)
        expect(item.detail.length).toBeGreaterThan(40)
      }
    }
  })

  it("keeps curated cluster links pointing at routes and articles that exist", () => {
    const catalogue = serviceRouteCatalogue()
    for (const project of projects) {
      for (const href of project.relatedServiceHrefs ?? []) {
        expect(catalogue.get(href), `${project.slug} -> ${href}`).toBeDefined()
      }
      for (const slug of project.relatedInsightSlugs ?? []) {
        expect(getInsight(slug, { includeDrafts: false }), `${project.slug} -> ${slug}`).toBeDefined()
      }
    }
  })

  it("puts curated articles first in a case study topic cluster", () => {
    const precision = relatedInsightsForCaseStudy("precision-finish-plastering-rendering").map((insight) => insight.slug)
    expect(precision[0]).toBe("local-seo-nottingham-businesses-guide")
    expect(precision).toContain("website-seo-checklist-uk-small-businesses")
  })

  it("gives every case study a previous and next route", () => {
    for (const study of publishedCaseStudies()) {
      const { previous, next } = adjacentCaseStudies(study.slug)
      expect(previous?.slug, `${study.slug} has no previous`).toBeDefined()
      expect(next?.slug, `${study.slug} has no next`).toBeDefined()
      expect(previous?.slug).not.toBe(study.slug)
      expect(next?.slug).not.toBe(study.slug)
    }
    expect(adjacentCaseStudies("not-a-case-study")).toEqual({})
  })
})
