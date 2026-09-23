import { describe, expect, it } from "vitest"
import { faqEntries, faqLibrary, type FaqId } from "./faq-library"
import { FAQ_CATEGORY_FOR_INSIGHT_TOPIC, contextualFaqs, faqAnchor, faqCategories, faqsForCategory, knowledgeBaseFaqs } from "./faq-knowledge-base"
import { INSIGHT_TOPIC_CLUSTERS, getInsight } from "./insights"
import { serviceRouteCatalogue } from "./service-routes"

const catalogue = serviceRouteCatalogue()
const allIds = Object.keys(faqLibrary) as FaqId[]

describe("faq knowledge base", () => {
  it("places every published answer in exactly one category", () => {
    const grouped = faqCategories.flatMap((category) => category.questionIds)
    expect(new Set(grouped).size).toBe(grouped.length)
    expect([...grouped].sort()).toEqual([...allIds].sort())
  })

  it("gives every answer a unique, linkable anchor", () => {
    const anchors = knowledgeBaseFaqs().map((faq) => faq.anchor)
    expect(new Set(anchors).size).toBe(anchors.length)
    for (const anchor of anchors) expect(anchor).toMatch(/^faq-[a-z0-9-]+$/)
  })

  it("only links answers to service routes that exist", () => {
    for (const id of allIds) {
      for (const href of faqEntries[id].services ?? []) {
        expect(catalogue.get(href), `${id} links to unknown service route ${href}`).toBeDefined()
      }
    }
    for (const category of faqCategories) {
      for (const href of category.services) {
        expect(catalogue.get(href), `${category.slug} links to unknown service route ${href}`).toBeDefined()
      }
      expect(category.services.length).toBeGreaterThan(0)
    }
  })

  it("only links answers to published insights", () => {
    const slugs = [...allIds.flatMap((id) => faqEntries[id].insights ?? []), ...faqCategories.flatMap((category) => category.insights)]
    for (const slug of slugs) {
      expect(getInsight(slug, { includeDrafts: false }), `unknown or unpublished insight ${slug}`).toBeDefined()
    }
  })

  it("gives every category a next action and a non-empty question set", () => {
    for (const category of faqCategories) {
      expect(category.questionIds.length).toBeGreaterThanOrEqual(8)
      expect(category.cta.href.startsWith("/")).toBe(true)
      expect(category.cta.label.length).toBeGreaterThan(0)
      expect(faqsForCategory(category)).toHaveLength(category.questionIds.length)
    }
  })

  it("writes substantive answers and never duplicates a question", () => {
    const questions = allIds.map((id) => faqEntries[id].q)
    expect(new Set(questions).size).toBe(questions.length)
    for (const id of allIds) {
      expect(faqEntries[id].a.length, `${id} answer is too short to be useful`).toBeGreaterThan(120)
      expect(faqEntries[id].q.endsWith("?")).toBe(true)
    }
  })

  it("never promises a search ranking", () => {
    const guarantee = /guarantee(?!s that|d)[^.]*\b(rank|position|first place|page one|#1)/i
    for (const id of allIds) {
      const sentences = faqEntries[id].a.split(/(?<=\.)\s+/)
      for (const sentence of sentences) {
        if (guarantee.test(sentence)) expect(sentence).toMatch(/\bno\b|cannot|will not|nobody/i)
      }
    }
  })

  it("pairs every insight topic cluster with a real FAQ category", () => {
    const slugs = new Set(faqCategories.map((category) => category.slug))
    expect(Object.keys(FAQ_CATEGORY_FOR_INSIGHT_TOPIC).sort()).toEqual(Object.keys(INSIGHT_TOPIC_CLUSTERS).sort())
    for (const value of Object.values(FAQ_CATEGORY_FOR_INSIGHT_TOPIC)) expect(slugs.has(value)).toBe(true)
  })

  it("exposes contextual subsets that deep-link back to the hub", () => {
    const subset = contextualFaqs(["spf", "dkim"])
    expect(subset.map((faq) => faq.anchor)).toEqual([faqAnchor("spf"), faqAnchor("dkim")])
    expect(subset[0].q).toBe(faqLibrary.spf.q)
  })
})
