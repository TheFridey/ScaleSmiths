import { describe, expect, it } from "vitest"
import { GET } from "./route"

describe("Insights RSS feed", () => {
  it("publishes all Insights articles as valid feed items", async () => {
    const response = GET()
    const xml = await response.text()
    expect(response.headers.get("content-type")).toContain("application/rss+xml")
    expect(xml).toContain("<title>ScaleSmiths Insights</title>")
    expect(xml.match(/<item>/g)).toHaveLength(35)
    expect(xml).toContain("/insights/how-much-does-a-business-website-cost-uk-2026")
  })
})
