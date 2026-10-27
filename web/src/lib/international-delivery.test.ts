import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { internationalDelivery, internationalPriceLines, INTERNATIONAL_PATH } from "./international-delivery"
import { buildPublicSitemap } from "./public-sitemap"

describe("international delivery", () => {
  it("uses the published GBP starting prices and does not invent an office", () => {
    const lines = internationalPriceLines()
    expect(lines.map((line) => line.priceLabel)).toEqual(["£395", "From £15/month"])
    expect(lines.map((line) => line.name)).toEqual(["Business Growth Audit", "Business email"])
    const copy = [
      internationalDelivery.h1,
      internationalDelivery.intro,
      internationalDelivery.description,
      ...internationalDelivery.sections.flatMap((section) => [section.title, section.body]),
      ...internationalDelivery.faqs.flatMap((faq) => [faq.q, faq.a]),
    ].join(" ")
    expect(copy.toLowerCase()).not.toMatch(/\b(?:new york|dubai|singapore|berlin) office\b/)
    expect(copy).toMatch(/No overseas office|no overseas office|There is no overseas office/)
    expect(copy).toContain("GBP")
    expect(copy).toContain("£395")
    expect(copy).toContain("£15/month")
    expect(copy).not.toMatch(/£2,000|£350/)
    const pageSource = readFileSync(new URL("../app/international/page.tsx", import.meta.url), "utf8")
    expect(pageSource).not.toMatch(/[\u2013\u2014]/)
    expect(pageSource).not.toMatch(/£(?!395\b|15\b)/)
    expect(internationalDelivery.metaTitle.length).toBeLessThanOrEqual(60)
    expect(internationalDelivery.description.length).toBeLessThanOrEqual(160)
    expect(buildPublicSitemap().map((entry) => entry.url)).toContain(`https://scalesmiths.co.uk${INTERNATIONAL_PATH}`)
  })
})