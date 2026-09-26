import { describe, expect, it } from "vitest"
import { enterpriseInsights } from "./enterprise-insight-library"
import { initialInsights } from "./insight-library"
import { insightPlainText } from "./insights"

describe("initial Insights library", () => {
  it("publishes the complete commissioned set with substantial, structured copy", () => {
    expect(initialInsights).toHaveLength(35)
    for (const article of initialInsights) {
      expect(article.status, article.slug).toBe("published")
      expect(article.body.filter((block) => block.type === "heading").length, article.slug).toBeGreaterThanOrEqual(5)
      expect(insightPlainText(article).split(/\s+/).length, article.slug).toBeGreaterThanOrEqual(390)
      expect(article.relatedServices.length, article.slug).toBeGreaterThan(0)
      expect(article.relatedInsights?.length, article.slug).toBeGreaterThanOrEqual(3)
    }
  })

  it("keeps enterprise articles technical and long-form", () => {
    expect(enterpriseInsights).toHaveLength(10)
    for (const article of enterpriseInsights) {
      expect(article.category, article.slug).toBe("enterprise")
      expect(insightPlainText(article).split(/\s+/).length, article.slug).toBeGreaterThanOrEqual(1100)
      expect(article.body.some((block) => block.type === "list"), article.slug).toBe(true)
      expect(article.body.some((block) => block.type === "callout"), article.slug).toBe(true)
      expect(article.body.some((block) => block.type === "code" || block.type === "diagram"), article.slug).toBe(true)
      const blob = insightPlainText(article).toLowerCase()
      expect(blob).not.toContain("cencora")
      expect(blob).not.toContain("alloga")
      expect(blob).toMatch(/enterprise|permission|migration|architecture|offline|audit|saas/)
    }
  })

  it("contains no duplicated article paragraphs", () => {
    const seen = new Map<string, string>()
    for (const article of initialInsights) for (const block of article.body) if (block.type === "paragraph") {
      expect(seen.get(block.text), `${article.slug} duplicates ${seen.get(block.text)}`).toBeUndefined()
      seen.set(block.text, article.slug)
    }
  })
})
