import { describe, expect, it } from "vitest"
import { projects } from "./data"
import { faqLibrary } from "./faq-library"
import { buildLandingPageSchemas, getLandingPageFaqs, landingPages, metadataForLandingPage } from "./landing-pages"

const pages = Object.values(landingPages)
const BANNED_CLAIMS = /\b(?:#1|number one|best (?:web|agency|designer|developer)|industry[- ]leading|guaranteed rankings?|award[- ]winning|world[- ]class|cutting[- ]edge)\b/i

describe("landing pages", () => {
  it("prioritises the most relevant Hucknall client proof", () => {
    expect(landingPages["web-design-hucknall"].proofLinks).toEqual([
      "precision-finish-plastering-rendering",
      "glow-tanning",
      "csds",
    ])
  })

  it("builds canonical metadata with a natural, un-duplicated brand title", () => {
    const metadata = metadataForLandingPage(landingPages["web-design-hucknall"])

    expect(metadata.alternates).toEqual({ canonical: "/web-design-hucknall" })
    expect(metadata.title).toEqual({ absolute: "Web Design in Hucknall, Nottinghamshire | ScaleSmiths" })
    expect(metadata.openGraph?.title).toBe("Web Design in Hucknall, Nottinghamshire | ScaleSmiths")
  })

  it("emits WebPage, Service, FAQPage and breadcrumb schema tied to the site-wide organisation", () => {
    const schemas = buildLandingPageSchemas(landingPages["web-development-nottingham"])
    const types = schemas.map((schema) => schema["@type"])

    expect(types).toEqual(expect.arrayContaining(["WebPage", "Service", "FAQPage", "BreadcrumbList"]))
    // The business itself is declared once in the root layout, never re-declared per page.
    expect(types).not.toContain("LocalBusiness")
    const service = schemas.find((schema) => schema["@type"] === "Service") as { provider: Record<string, unknown> }
    expect(service.provider["@id"]).toBe("https://scalesmiths.co.uk/#org")
  })

  it("gives every landing page practical depth for buyers", () => {
    for (const page of pages) {
      expect(page.searchIntent.length).toBeGreaterThan(80)
      expect(page.problems.length).toBeGreaterThanOrEqual(4)
      expect(page.examples.length).toBeGreaterThanOrEqual(3)
      expect(page.buildLogLinks.length).toBeGreaterThanOrEqual(3)
      expect(getLandingPageFaqs(page).length).toBeGreaterThanOrEqual(6)
    }
  })

  it("publishes the complete high-intent commercial set with substantive delivery detail", () => {
    const required = ["web-design-nottingham", "website-redesign-nottingham", "local-seo-nottingham", "website-maintenance-nottingham", "e-commerce-development-nottingham", "web-development-nottingham", "custom-software-development-uk", "business-automation-nottingham", "seo-website-audit", "managed-website-hosting", "next-js-agency-uk"]
    for (const slug of required) {
      const page = landingPages[slug]
      expect(page, slug).toBeDefined()
      expect(page.included?.length, slug).toBeGreaterThanOrEqual(4)
      expect(page.process?.length, slug).toBeGreaterThanOrEqual(4)
      expect(page.considerations?.length, slug).toBeGreaterThanOrEqual(2)
    }
  })
})

describe("landing page search quality", () => {
  it("keeps titles and descriptions within search-result limits and unique", () => {
    for (const page of pages) {
      expect(page.metaTitle.length, page.slug).toBeLessThanOrEqual(60)
      expect(page.metaTitle.match(/ScaleSmiths/g), page.slug).toHaveLength(1)
      expect(page.description.length, page.slug).toBeLessThanOrEqual(160)
    }
    for (const key of ["metaTitle", "description", "h1", "intro", "searchIntent"] as const) {
      expect(new Set(pages.map((page) => page[key])).size, key).toBe(pages.length)
    }
  })

  it("never reuses a sentence of body copy across pages with a place or service name swapped", () => {
    const normalise = (text: string) => text.toLowerCase().replace(/hucknall|nottingham(?:shire)?|uk|united kingdom|web design|web development|e-commerce|next\.js/g, "#")
    const seen = new Map<string, string>()
    for (const page of pages) {
      const copy = [page.intro, page.searchIntent, ...page.problems, ...page.examples, ...(page.localContext?.paragraphs ?? [])]
      for (const sentence of copy) {
        const key = normalise(sentence)
        expect(seen.get(key), `"${sentence}" on ${page.slug} duplicates ${seen.get(key)}`).toBeUndefined()
        seen.set(key, page.slug)
      }
    }
  })

  it("does not repeat a place name in the H1 more than once or make unverifiable claims", () => {
    for (const page of pages) {
      const places = page.h1.match(/Hucknall|Nottingham/g) ?? []
      expect(places.length, page.slug).toBeLessThanOrEqual(1)
      const copy = [page.metaTitle, page.description, page.h1, page.intro, ...page.examples, ...getLandingPageFaqs(page).map((faq) => faq.a)].join(" ")
      expect(copy, page.slug).not.toMatch(BANNED_CLAIMS)
    }
  })

  it("gives location pages specific local context and real nearby proof", () => {
    const localProof = new Set(projects.filter((project) => /Nottingham|Hucknall/.test(project.location)).map((project) => project.slug))
    for (const page of pages.filter((candidate) => candidate.slug.endsWith("-hucknall") || candidate.slug === "web-design-nottingham")) {
      expect(page.localContext?.paragraphs.length, page.slug).toBeGreaterThan(0)
      expect(page.proofLinks.some((slug) => localProof.has(slug)), page.slug).toBe(true)
    }
  })

  it("only links to case studies and pages that exist", () => {
    const projectSlugs = new Set(projects.map((project) => project.slug))
    for (const page of pages) {
      for (const slug of page.proofLinks) expect(projectSlugs.has(slug), `${page.slug} → ${slug}`).toBe(true)
      for (const slug of page.relatedPages) expect(landingPages[slug], `${page.slug} → ${slug}`).toBeDefined()
      expect(page.relatedPages).not.toContain(page.slug)
      for (const id of page.faqLibrary) expect(faqLibrary[id]).toBeDefined()
    }
  })

  it("keeps FAQ questions unique on each page", () => {
    for (const page of pages) {
      const questions = getLandingPageFaqs(page).map((faq) => faq.q)
      expect(new Set(questions).size).toBe(questions.length)
    }
  })
})
