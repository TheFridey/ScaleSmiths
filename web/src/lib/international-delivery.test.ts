import { describe, expect, it } from "vitest"
import { internationalDelivery, internationalPriceLines, INTERNATIONAL_PATH } from "./international-delivery"
import { buildPublicSitemap } from "./public-sitemap"
import { publishedStartingPrices } from "./published-starting-prices"

describe("international delivery", () => {
  it("uses the published GBP starting prices and does not invent an office", () => {
    const lines = internationalPriceLines()
    expect(lines.map((line) => line.priceLabel)).toEqual(publishedStartingPrices.map((price) => price.priceLabel))
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
    expect(internationalDelivery.metaTitle.length).toBeLessThanOrEqual(60)
    expect(internationalDelivery.description.length).toBeLessThanOrEqual(160)
    expect(buildPublicSitemap().map((entry) => entry.url)).toContain(`https://scalesmiths.co.uk${INTERNATIONAL_PATH}`)
  })
})