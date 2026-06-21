import { describe, expect, it } from "vitest"
import {
  FORGE_KEYWORD_STUFFING_WARNING,
  FORGE_SEO_META_MAX,
  FORGE_SEO_META_MIN,
  FORGE_SEO_TITLE_MAX,
  analyzeForgeKeywordStuffing,
  applyForgeSeoMetadataFixes,
  buildForgeBreadcrumbSchema,
  buildForgeCanonicalUrl,
  buildForgeFaqSchema,
  buildForgeLocalBusinessSchema,
  buildForgeMetaDescription,
  buildForgeOpenGraph,
  buildForgePageJsonLd,
  buildForgePageMetadata,
  buildForgePageTitle,
  buildForgeRobotsTxt,
  buildForgeSeoArtifactContent,
  buildForgeSeoChecklist,
  buildForgeServiceSchema,
  buildForgeSitemapXml,
  buildForgeTwitter,
  buildForgeSeoPack,
  readForgeSeoArtifact,
  resolveForgeSeoSiteUrl,
  scoreForgeSeoChecklist,
  type ForgeSeoBusiness,
  type ForgeSeoPageInput,
  FORGE_SEO_ARTIFACT_KIND,
} from "./forge-seo"
import { buildForgeSeoContextFromIntake } from "./forge-seo-context"
import { buildSeoScoreQaResult } from "./forge-qa"
import { emptyForgeIntakeData } from "./forge"

const business: ForgeSeoBusiness = {
  businessName: "Acme Repairs",
  industry: "Industrial repairs",
  siteUrl: "https://acme-repairs.co.uk",
  primaryLocation: "Nottingham",
  serviceAreas: ["Nottingham", "Derby", "Leicester"],
  telephone: "+44 115 555 0100",
  email: "hello@acme-repairs.co.uk",
  sameAs: ["https://www.google.com/maps/acme"],
}

function page(overrides: Partial<ForgeSeoPageInput> = {}): ForgeSeoPageInput {
  return {
    title: "Emergency Industrial Repairs",
    path: "/emergency-repairs",
    template: "service",
    keyword: "emergency repairs nottingham",
    metaDescription: "Fast emergency industrial repairs across Nottingham, Derby, and Leicester. Acme Repairs restores critical equipment with a rapid, accredited response.",
    h1: "Emergency industrial repairs in Nottingham",
    heroSubheading: "When critical equipment fails, Acme Repairs restores production fast with an accredited team covering Nottingham and the surrounding service area.",
    bodyText: "Acme Repairs handles urgent breakdowns for manufacturers in Nottingham. We diagnose the fault, source parts, and restore production. Compared to a single in-house technician, our team works around the clock to reduce downtime.",
    faqItems: [
      { question: "How fast can you attend an emergency in Nottingham?", answer: "Acme Repairs aims to attend emergency breakdowns across Nottingham within a few hours, depending on the equipment and parts required." },
      { question: "Do you cover Derby and Leicester?", answer: "Yes. Acme Repairs covers Nottingham, Derby, and Leicester for emergency industrial repairs and planned maintenance." },
    ],
    serviceName: "Emergency Industrial Repairs",
    trustElements: ["Accredited engineers", "24/7 response"],
    localSeoCopy: "Acme Repairs supports manufacturers across Nottingham, Derby, and Leicester with emergency industrial repairs.",
    ...overrides,
  }
}

const homePage = page({
  title: "Acme Repairs",
  path: "/",
  template: "home",
  keyword: "industrial repairs nottingham",
  h1: "Acme Repairs",
})

const contactPage = page({ title: "Contact Acme Repairs", path: "/contact", template: "contact", serviceName: null })

describe("forge SEO engine", () => {
  it("resolves canonical site URLs and per-page canonicals", () => {
    expect(resolveForgeSeoSiteUrl("https://acme-repairs.co.uk/", "42-acme")).toBe("https://acme-repairs.co.uk")
    expect(resolveForgeSeoSiteUrl(null, "42 Acme Ltd")).toBe("https://42-acme-ltd.example.com")
    expect(buildForgeCanonicalUrl(business.siteUrl, "/")).toBe("https://acme-repairs.co.uk/")
    expect(buildForgeCanonicalUrl(business.siteUrl, "emergency-repairs")).toBe("https://acme-repairs.co.uk/emergency-repairs")
  })

  it("generates page titles and meta descriptions within budget", () => {
    const title = buildForgePageTitle(page(), business)
    expect(title.length).toBeLessThanOrEqual(FORGE_SEO_TITLE_MAX)
    expect(title).toContain("Acme Repairs")

    const meta = buildForgeMetaDescription(page(), business)
    expect(meta.length).toBeGreaterThanOrEqual(FORGE_SEO_META_MIN)
    expect(meta.length).toBeLessThanOrEqual(FORGE_SEO_META_MAX)

    // Short descriptions get padded into budget, long ones get clamped.
    const padded = buildForgeMetaDescription(page({ metaDescription: "Too short.", heroSubheading: "Too short." }), business)
    expect(padded.length).toBeGreaterThanOrEqual(FORGE_SEO_META_MIN)
    const clamped = buildForgeMetaDescription(page({ metaDescription: "x".repeat(400) }), business)
    expect(clamped.length).toBeLessThanOrEqual(FORGE_SEO_META_MAX)
  })

  it("builds Open Graph and Twitter metadata", () => {
    const canonical = buildForgeCanonicalUrl(business.siteUrl, homePage.path)
    const og = buildForgeOpenGraph(homePage, business, canonical)
    expect(og.type).toBe("website")
    expect(og.url).toBe(canonical)
    expect(og.siteName).toBe("Acme Repairs")

    const twitter = buildForgeTwitter(page(), business)
    expect(twitter.card).toBe("summary_large_image")
    expect(twitter.title).toContain("Acme Repairs")
  })

  it("builds LocalBusiness schema with areaServed and contact data", () => {
    const schema = buildForgeLocalBusinessSchema(business) as Record<string, unknown>
    expect(schema["@type"]).toBe("LocalBusiness")
    expect(schema.telephone).toBe("+44 115 555 0100")
    expect(Array.isArray(schema.areaServed)).toBe(true)
    expect((schema.address as Record<string, unknown>).addressLocality).toBe("Nottingham")
  })

  it("builds Service schema bound to the LocalBusiness provider", () => {
    const schema = buildForgeServiceSchema(page(), business) as Record<string, unknown>
    expect(schema["@type"]).toBe("Service")
    expect(schema.serviceType).toBe("Emergency Industrial Repairs")
    expect((schema.provider as Record<string, unknown>)["@type"]).toBe("LocalBusiness")
  })

  it("builds FAQ schema only when question/answer pairs exist", () => {
    const faq = buildForgeFaqSchema(page().faqItems) as Record<string, unknown>
    expect(faq["@type"]).toBe("FAQPage")
    expect((faq.mainEntity as unknown[]).length).toBe(2)
    expect(buildForgeFaqSchema([])).toBeNull()
    expect(buildForgeFaqSchema([{ question: "", answer: "" }])).toBeNull()
  })

  it("builds breadcrumb schema from the page path", () => {
    const schema = buildForgeBreadcrumbSchema(page(), business) as Record<string, unknown>
    expect(schema["@type"]).toBe("BreadcrumbList")
    const items = schema.itemListElement as { position: number; name: string }[]
    expect(items[0].name).toBe("Home")
    expect(items[items.length - 1].name).toBe("Emergency Industrial Repairs")
    expect(items[items.length - 1].position).toBe(2)
  })

  it("assembles the JSON-LD graph per template", () => {
    const serviceTypes = buildForgePageJsonLd(page(), business).map((entry) => (entry as Record<string, string>)["@type"])
    expect(serviceTypes).toEqual(expect.arrayContaining(["WebPage", "BreadcrumbList", "Service", "FAQPage"]))

    const homeTypes = buildForgePageJsonLd(homePage, business).map((entry) => (entry as Record<string, string>)["@type"])
    expect(homeTypes).toContain("LocalBusiness")

    const contactTypes = buildForgePageJsonLd(contactPage, business).map((entry) => (entry as Record<string, string>)["@type"])
    expect(contactTypes).toContain("ContactPage")
    expect(contactTypes).toContain("LocalBusiness")
  })

  it("captures all metadata types in buildForgePageMetadata", () => {
    const meta = buildForgePageMetadata(page(), business)
    expect(meta.canonical).toBe("https://acme-repairs.co.uk/emergency-repairs")
    expect(meta.jsonLdTypes).toEqual(expect.arrayContaining(["WebPage", "BreadcrumbList", "Service", "FAQPage"]))
    expect(meta.openGraph.url).toBe(meta.canonical)
  })

  it("generates a valid sitemap.xml and robots.txt", () => {
    const xml = buildForgeSitemapXml(business, [homePage, page(), contactPage], "2026-06-21T00:00:00.000Z")
    expect(xml).toContain("<?xml version=\"1.0\" encoding=\"UTF-8\"?>")
    expect(xml).toContain("<loc>https://acme-repairs.co.uk/</loc>")
    expect(xml).toContain("<loc>https://acme-repairs.co.uk/emergency-repairs</loc>")
    expect(xml).toContain("<priority>1.0</priority>")

    const robots = buildForgeRobotsTxt(business)
    expect(robots).toContain("User-agent: *")
    expect(robots).toContain("Sitemap: https://acme-repairs.co.uk/sitemap.xml")
  })

  it("detects and warns about keyword stuffing", () => {
    const natural = analyzeForgeKeywordStuffing(page().bodyText, page().keyword)
    expect(natural.stuffed).toBe(false)

    const stuffedText = "emergency repairs nottingham ".repeat(12)
    const stuffed = analyzeForgeKeywordStuffing(stuffedText, "emergency repairs nottingham")
    expect(stuffed.stuffed).toBe(true)
    expect(stuffed.repeats).toBeGreaterThan(4)
    expect(FORGE_KEYWORD_STUFFING_WARNING).toMatch(/keyword stuffing/i)
  })

  it("scores well-formed content highly and flags keyword stuffing as failing", () => {
    const checklist = buildForgeSeoChecklist(business, [homePage, page(), contactPage])
    const score = scoreForgeSeoChecklist(checklist)
    expect(score.overall).toBeGreaterThanOrEqual(70)
    expect(score.seo).toBeGreaterThan(0)
    expect(score.aeo).toBeGreaterThan(0)
    expect(score.geo).toBeGreaterThan(0)

    const stuffedPage = page({ bodyText: "emergency repairs nottingham ".repeat(15), heroSubheading: "emergency repairs nottingham emergency repairs nottingham" })
    const stuffedChecklist = buildForgeSeoChecklist(business, [stuffedPage])
    expect(stuffedChecklist.find((item) => item.id === "keyword-stuffing")?.status).toBe("fail")
  })

  it("fills missing/oversized metadata with applyForgeSeoMetadataFixes", () => {
    const broken = page({ title: "", metaDescription: "" })
    const { pages, fixes } = applyForgeSeoMetadataFixes(business, [broken])
    expect(fixes.some((fix) => fix.field === "title")).toBe(true)
    expect(fixes.some((fix) => fix.field === "metaDescription")).toBe(true)
    expect(pages[0].title.length).toBeGreaterThan(0)
    expect(pages[0].metaDescription.length).toBeGreaterThanOrEqual(FORGE_SEO_META_MIN)
  })

  it("assembles, reads, and renders the SEO pack artifact", () => {
    const pack = buildForgeSeoPack(business, [homePage, page(), contactPage], "2026-06-21T00:00:00.000Z")
    expect(pack.kind).toBe(FORGE_SEO_ARTIFACT_KIND)
    expect(pack.pages.length).toBe(3)
    expect(pack.sitemapXml).toContain("<urlset")
    expect(pack.robotsTxt).toContain("Sitemap:")

    const state = readForgeSeoArtifact({ kind: FORGE_SEO_ARTIFACT_KIND, pack })
    expect(state.status).toBe("generated")
    expect(state.score?.overall).toBe(pack.score.overall)
    expect(readForgeSeoArtifact(null).status).toBe("empty")
    expect(readForgeSeoArtifact({ kind: "other" }).status).toBe("empty")

    const content = buildForgeSeoArtifactContent(pack)
    expect(content).toContain("# SEO/AEO/GEO Pack")
    expect(content).toContain("## Checklist")
    expect(content).toContain("## Per-page metadata")
  })

  it("builds an SEO QA result from the pack", () => {
    const pack = buildForgeSeoPack(business, [homePage, page(), contactPage])
    expect(buildSeoScoreQaResult(null, { sitemap: true, robots: true, seoLib: true }).status).toBe("skipped")
    expect(buildSeoScoreQaResult(pack, { sitemap: true, robots: true, seoLib: true }).status).toBe("passed")
    expect(buildSeoScoreQaResult(pack, { sitemap: false, robots: true, seoLib: true }).status).toBe("failed")
    expect(buildSeoScoreQaResult(pack, { sitemap: true, robots: true, seoLib: true }, 200).status).toBe("failed")
  })

  it("derives SEO location context from intake data", () => {
    const intake = emptyForgeIntakeData()
    intake.primaryLocation = "Nottingham"
    intake.serviceAreas = "Nottingham, Derby\nLeicester"
    const context = buildForgeSeoContextFromIntake(intake)
    expect(context.primaryLocation).toBe("Nottingham")
    expect(context.serviceAreas).toEqual(["Nottingham", "Derby", "Leicester"])
    expect(buildForgeSeoContextFromIntake(null).serviceAreas).toEqual([])
  })
})
