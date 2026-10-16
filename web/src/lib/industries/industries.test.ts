import { describe, expect, it } from "vitest"
import { projects } from "../data"
import { serviceRouteCatalogue } from "../service-routes"
import { buildPublicSitemap } from "../public-sitemap"
import {
  allIndustryHubs,
  commercialPathways,
  industryAzIndex,
  industryDifferenceFingerprint,
  industryPath,
  industryTaxonomy,
  metadataForIndustryPage,
  publishedIndustryPages,
  searchIndustries,
} from "./index"
import { parseIndustryAttribution, industryAttributionBriefPrefix } from "./attribution"

const BANNED_CLAIMS =
  /\b(?:#1|number one|best (?:web|agency|designer|developer)|industry[- ]leading|guaranteed rankings?|award[- ]winning|world[- ]class|cutting[- ]edge|guaranteed (?:leads|roi|results))\b/i

describe("industry growth engine registry", () => {
  it("publishes exactly the first-wave specialist set", () => {
    const slugs = publishedIndustryPages().map((page) => page.slug).sort()
    expect(slugs).toEqual([
      "accountants",
      "b2b-saas",
      "beauty-salons",
      "electricians",
      "independent-retail",
      "pest-control",
      "plastering-rendering",
      "podiatry",
      "precision-engineering",
      "printing-signage",
      "restaurants",
      "roofing",
    ].sort())
  })

  it("keeps every published page under a real hub with valid metadata", () => {
    const hubs = new Set(allIndustryHubs().map((hub) => hub.slug))
    for (const page of publishedIndustryPages()) {
      expect(hubs.has(page.hubSlug), page.slug).toBe(true)
      expect(page.frictions.length, page.slug).toBeGreaterThanOrEqual(3)
      expect(page.strategy.length, page.slug).toBeGreaterThanOrEqual(3)
      expect(page.faqs.length, page.slug).toBeGreaterThanOrEqual(3)
      expect(page.metaTitle.length, page.slug).toBeLessThanOrEqual(60)
      expect(page.description.length, page.slug).toBeLessThanOrEqual(160)
      expect(page.metaTitle).toContain("ScaleSmiths")
      const metadata = metadataForIndustryPage(page.hubSlug, page.slug)
      expect(metadata?.alternates).toEqual({ canonical: industryPath(page.hubSlug, page.slug) })
    }
  })

  it("fails the swap-the-industry-name test: fingerprints stay unique", () => {
    const fingerprints = publishedIndustryPages().map(industryDifferenceFingerprint)
    expect(new Set(fingerprints).size).toBe(fingerprints.length)
    for (const key of ["h1", "intro", "primaryProblem", "searchIntent"] as const) {
      expect(new Set(publishedIndustryPages().map((page) => page[key])).size, key).toBe(publishedIndustryPages().length)
    }
  })

  it("never reuses a friction title or FAQ question across pages", () => {
    const frictionTitles = publishedIndustryPages().flatMap((page) => page.frictions.map((item) => item.title.toLowerCase()))
    expect(new Set(frictionTitles).size).toBe(frictionTitles.length)
    const questions = publishedIndustryPages().flatMap((page) => page.faqs.map((item) => item.q.toLowerCase()))
    expect(new Set(questions).size).toBe(questions.length)
  })

  it("labels proof honestly and only links live case studies", () => {
    const projectSlugs = new Set(projects.map((project) => project.slug))
    for (const page of publishedIndustryPages()) {
      expect(["direct", "adjacent", "illustrative"]).toContain(page.proof.level)
      if (page.proof.workSlug) expect(projectSlugs.has(page.proof.workSlug), page.slug).toBe(true)
      if (page.proof.level === "direct") expect(page.proof.workSlug, page.slug).toBeTruthy()
      if (page.proof.level === "adjacent") {
        expect(page.proof.label.toLowerCase()).toMatch(/adjacent/)
      }
      if (page.proof.level === "illustrative") {
        expect(page.proof.summary.toLowerCase()).toMatch(/illustrative|not .*claimed|no .*case study/)
      }
    }
  })

  it("keeps related solution hrefs inside the service catalogue", () => {
    const catalogue = serviceRouteCatalogue()
    for (const page of publishedIndustryPages()) {
      for (const href of page.relatedSolutionHrefs) {
        expect(catalogue.has(href), `${page.slug} → ${href}`).toBe(true)
      }
    }
  })

  it("avoids banned hype claims", () => {
    for (const page of publishedIndustryPages()) {
      const copy = [page.h1, page.intro, page.searchIntent, ...page.frictions.flatMap((item) => [item.symptom, item.fix]), ...page.faqs.map((item) => item.a)].join(" ")
      expect(copy, page.slug).not.toMatch(BANNED_CLAIMS)
    }
  })

  it("exposes commercial pathways with founder-review pricing status", () => {
    expect(commercialPathways.build.startingPriceLabel).toBe("from £2,000")
    expect(commercialPathways.growth.startingPriceLabel).toBe("from £350/month")
    expect(commercialPathways.audit.startingPriceLabel).toBe("£395 one-time")
    expect(commercialPathways.systems.startingPriceLabel).toBeNull()
    expect(commercialPathways.build.href("pest-control", "trades-home-services")).toContain("pathway=build")
    expect(commercialPathways.growth.href("pest-control", "trades-home-services")).toContain("intent=strategy_call")
  })

  it("searches published pages, hubs and candidates without inventing indexable query routes", () => {
    const pest = searchIndustries("pest control")
    expect(pest.some((hit) => hit.kind === "published" && hit.href === "/industries/trades-home-services/pest-control")).toBe(true)
    const chiropody = searchIndustries("chiropody")
    expect(chiropody.some((hit) => hit.name.toLowerCase().includes("podiatry"))).toBe(true)
    const missing = searchIndustries("underwater basket weaving xyz")
    expect(missing.every((hit) => !hit.href.includes("?"))).toBe(true)
    const candidate = searchIndustries("plumber")
    expect(candidate.some((hit) => hit.kind === "candidate" && hit.href.startsWith("/industries/request"))).toBe(true)
  })

  it("keeps taxonomy discoverable and larger than the published set", () => {
    const taxonomy = industryTaxonomy()
    expect(taxonomy.length).toBeGreaterThan(publishedIndustryPages().length + 20)
    expect(industryAzIndex().length).toBeGreaterThan(5)
  })

  it("includes industry routes in the public sitemap once", () => {
    const urls = buildPublicSitemap().map((entry) => entry.url)
    expect(urls).toContain("https://scalesmiths.co.uk/industries")
    expect(urls).toContain("https://scalesmiths.co.uk/industries/trades-home-services/pest-control")
    expect(urls).toContain("https://scalesmiths.co.uk/industries/healthcare-wellness/podiatry")
    expect(urls.filter((url) => url.includes("/industries")).length).toBe(
      new Set(urls.filter((url) => url.includes("/industries"))).size,
    )
  })

  it("parses industry attribution for quote handoff", () => {
    const parsed = parseIndustryAttribution("industry=pest-control&hub=trades-home-services&pathway=growth")
    expect(parsed).toMatchObject({ industry: "pest-control", hub: "trades-home-services", pathway: "growth" })
    expect(industryAttributionBriefPrefix(parsed!)).toContain("industry=pest-control")
  })
})
