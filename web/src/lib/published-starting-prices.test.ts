import { describe, expect, it } from "vitest"
import {
  STARTING_PRICE_BOUNDARY,
  buildPublishedOfferCatalog,
  publicProjectBudgetOptions,
  publishedStartingPrices,
} from "./published-starting-prices"

describe("published starting prices", () => {
  it("publishes the four founder-stated GBP entry points and no other currency", () => {
    expect(publishedStartingPrices.map((item) => [item.name, item.priceLabel])).toEqual([
      ["Website design and development", "From £2,000"],
      ["Growth Partnership", "From £350/month"],
      ["Business Growth Audit", "£395"],
      ["Business email", "From £15/month"],
    ])
    expect(STARTING_PRICE_BOUNDARY).toMatch(/not unlimited/i)
    expect(STARTING_PRICE_BOUNDARY).toMatch(/GBP/)
    expect(JSON.stringify(publishedStartingPrices)).not.toMatch(/\$|USD|EUR|local-currency/i)
    expect(publicProjectBudgetOptions).toContain("Website from £2,000")
    expect(publicProjectBudgetOptions.join(" ")).not.toMatch(/4,500|8,000-15,000|450\/month/)
  })

  it("describes starting prices as scoped offers in the public catalog", () => {
    const catalog = buildPublishedOfferCatalog()
    expect(catalog["@type"]).toBe("OfferCatalog")
    expect(catalog.itemListElement).toHaveLength(4)
    const website = catalog.itemListElement[0]
    expect("priceSpecification" in website && website.priceSpecification).toMatchObject({ minPrice: 2000, priceCurrency: "GBP" })
    expect("price" in website).toBe(false)
    const audit = catalog.itemListElement[2]
    expect("price" in audit && audit.price).toBe(395)
    expect(JSON.stringify(catalog)).toMatch(/not unlimited/i)
  })
})
