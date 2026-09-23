import { describe, expect, it } from "vitest"
import { projects } from "./data"
import { founderBySlug, UNSUPPORTED_CLAIM_PATTERNS } from "./founders"
import {
  draftPreviewEnabled,
  editorialPipeline,
  getInsight,
  headingId,
  insightAuthor,
  insightPlainText,
  insights,
  insightsByAuthor,
  insightsForCaseStudy,
  insightsForService,
  publishedInsights,
  readingTimeMinutes,
  relatedInsights,
  tableOfContents,
  type Insight,
} from "./insights"
import { buildPublicSitemap } from "./public-sitemap"
import { serviceRouteCatalogue } from "./service-routes"
import { buildInsightSchemas } from "./structured-data"

const base = "https://scalesmiths.co.uk"

function published(overrides: Partial<Insight> = {}): Insight {
  return {
    slug: "example-article",
    title: "Example article",
    description: "An example description for testing the article model.",
    status: "published",
    authorSlug: "rhys",
    category: "technical-seo",
    datePublished: "2026-09-01",
    body: [
      { type: "heading", text: "First section" },
      { type: "paragraph", text: `Words ${"word ".repeat(400)} with a [link](/web-design-nottingham).` },
      { type: "heading", text: "Second section" },
      { type: "heading", text: "Third & final section" },
    ],
    brief: { targetQuery: "q", searchIntent: "i", angle: "a", outline: [], firstHandEvidence: ["evidence"], priority: 1 },
    relatedServices: ["/web-design-nottingham"],
    relatedCaseStudies: ["precision-finish-plastering-rendering"],
    ...overrides,
  }
}

describe("editorial integrity", () => {
  it("attributes every article to a real founder, never a fictional author", () => {
    for (const insight of insights) {
      expect(founderBySlug(insight.authorSlug), insight.slug).toBeDefined()
    }
  })

  it("requires first-hand evidence and a priority for every brief", () => {
    for (const insight of insights) {
      expect(insight.brief.firstHandEvidence.length, insight.slug).toBeGreaterThan(0)
      expect(insight.brief.outline.length, insight.slug).toBeGreaterThan(0)
    }
    expect(new Set(insights.map((insight) => insight.brief.priority)).size).toBe(insights.length)
  })

  it("keeps slugs unique, descriptions within search-result limits and titles distinct", () => {
    expect(new Set(insights.map((insight) => insight.slug)).size).toBe(insights.length)
    expect(new Set(insights.map((insight) => insight.title.toLowerCase())).size).toBe(insights.length)
    expect(new Set(insights.map((insight) => insight.brief.targetQuery.toLowerCase())).size).toBe(insights.length)
    for (const insight of insights) {
      expect(insight.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      expect(insight.description.length, insight.slug).toBeLessThanOrEqual(160)
    }
  })

  it("only links to service routes and case studies that exist", () => {
    const routes = serviceRouteCatalogue()
    const projectSlugs = new Set(projects.map((project) => project.slug))
    const slugs = new Set(insights.map((insight) => insight.slug))
    for (const insight of insights) {
      for (const href of insight.relatedServices) expect(routes.has(href), `${insight.slug} → ${href}`).toBe(true)
      for (const slug of insight.relatedCaseStudies) expect(projectSlugs.has(slug), `${insight.slug} → ${slug}`).toBe(true)
      for (const slug of insight.relatedInsights ?? []) expect(slugs.has(slug), `${insight.slug} → ${slug}`).toBe(true)
    }
  })

  it("holds published articles to the publishing standard", () => {
    for (const insight of publishedInsights()) {
      expect(insight.datePublished, insight.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(insight.body.some((block) => block.type === "authorNote"), `${insight.slug} still contains drafting notes`).toBe(false)
      expect(insightPlainText(insight).split(/\s+/).length, insight.slug).toBeGreaterThanOrEqual(390)
      for (const pattern of UNSUPPORTED_CLAIM_PATTERNS) expect(insightPlainText(insight), insight.slug).not.toMatch(pattern)
    }
  })

  it("publishes the commissioned initial library with no drafting artefacts", () => {
    expect(publishedInsights()).toHaveLength(25)
    expect(editorialPipeline()).toEqual([])
    expect(insights.every((insight) => insight.body.every((block) => block.type !== "authorNote"))).toBe(true)
  })
})

describe("visibility of unpublished articles", () => {
  it("hides planned and draft articles in production", () => {
    expect(draftPreviewEnabled({ NODE_ENV: "production" })).toBe(false)
    for (const insight of insights.filter((candidate) => candidate.status !== "published")) {
      expect(getInsight(insight.slug, { includeDrafts: false })).toBeUndefined()
      expect(getInsight(insight.slug, { includeDrafts: true })?.slug).toBe(insight.slug)
    }
  })

  it("exposes published articles through service, case-study and founder relationships", () => {
    expect(insightsForService("/web-design-nottingham").length).toBeGreaterThan(0)
    expect(insightsForCaseStudy("precision-finish-plastering-rendering").length).toBeGreaterThan(0)
    expect(insightsByAuthor("rhys").length).toBeGreaterThan(0)
    expect(insightsByAuthor("trevor-newton-bradley").length).toBeGreaterThan(0)
  })

  it("includes the hub, topic pages and every published article in the sitemap", () => {
    const urls = buildPublicSitemap().map((entry) => entry.url)
    expect(urls).toContain(`${base}/insights`)
    expect(urls).toContain(`${base}/insights/websites`)
    for (const insight of publishedInsights()) expect(urls).toContain(`${base}/insights/${insight.slug}`)
  })
})

describe("article helpers and schema", () => {
  it("derives reading time, heading anchors and a table of contents", () => {
    const article = published()
    expect(readingTimeMinutes(article)).toBe(2)
    expect(tableOfContents(article).map((item) => item.id)).toEqual(["first-section", "second-section", "third-and-final-section"])
    expect(headingId("Next.js vs WordPress?")).toBe("next-js-vs-wordpress")
    expect(insightPlainText(article)).toContain("with a link.")
  })

  it("prefers hand-picked related published articles", () => {
    const article = insights[0]
    expect(relatedInsights(article).map((item) => item.slug)).toEqual(article.relatedInsights)
  })

  it("publishes BlogPosting schema whose author matches the visible byline and founder profile", () => {
    const article = published({ dateModified: "2026-09-10" })
    const [posting, breadcrumb] = buildInsightSchemas(article, base) as unknown as [
      { "@type": string; author: unknown; publisher: unknown; datePublished: string; dateModified: string; mainEntityOfPage: string },
      { itemListElement: Array<{ item: string }> },
    ]
    const author = insightAuthor(article)

    expect(posting["@type"]).toBe("BlogPosting")
    expect(posting.author).toEqual({
      "@type": "Person",
      "@id": `${base}/about/rhys#person`,
      name: author.name,
      jobTitle: author.authorTitle,
      url: `${base}/about/rhys`,
    })
    expect(posting.publisher).toEqual({ "@id": `${base}/#org` })
    expect(posting.datePublished).toBe("2026-09-01")
    expect(posting.dateModified).toBe("2026-09-10")
    expect(posting.mainEntityOfPage).toBe(`${base}/insights/example-article`)
    expect(breadcrumb.itemListElement.map((item) => item.item)).toEqual([base, `${base}/insights`, `${base}/insights/seo`, `${base}/insights/example-article`])
  })
})
