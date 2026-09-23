import { describe, expect, it } from "vitest"
import { initialInsights } from "./insight-library"
import { insightPlainText } from "./insights"

describe("initial Insights library", () => {
  it("publishes the complete commissioned set with substantial, structured copy", () => {
    expect(initialInsights).toHaveLength(25)
    for (const article of initialInsights) {
      expect(article.status, article.slug).toBe("published")
      expect(article.body.filter((block) => block.type === "heading").length, article.slug).toBeGreaterThanOrEqual(5)
      expect(insightPlainText(article).split(/\s+/).length, article.slug).toBeGreaterThanOrEqual(390)
      expect(article.relatedServices.length, article.slug).toBeGreaterThan(0)
      expect(article.relatedInsights?.length, article.slug).toBeGreaterThanOrEqual(3)
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
