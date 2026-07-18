import { describe, expect, it } from "vitest"
import {
  CRAWLER_HOMEPAGE_VARIANT,
  isRecognizedCrawler,
  normalizeExperienceQuery,
  traditionalHomepageRedirectUrl,
} from "./experience-routing"

describe("public experience SEO routing", () => {
  it.each([
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    "DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)",
  ])("recognizes search crawler user agents", (userAgent) => {
    expect(isRecognizedCrawler(userAgent)).toBe(true)
    expect(CRAWLER_HOMEPAGE_VARIANT).toBe("normal_with_interactive_cta")
  })

  it("does not classify an ordinary browser as a crawler", () => {
    expect(isRecognizedCrawler("Mozilla/5.0 Chrome/126.0 Safari/537.36")).toBe(false)
  })

  it("accepts only the explicit normal experience override", () => {
    expect(normalizeExperienceQuery("normal")).toBe("normal")
    expect(normalizeExperienceQuery("interactive")).toBeNull()
    expect(normalizeExperienceQuery("fullscreen_choice")).toBeNull()
  })

  it("builds a same-origin permanent redirect target for the legacy normal route", () => {
    const target = traditionalHomepageRedirectUrl(new URL("https://scalesmiths.co.uk/traditional?utm_source=old#section"))
    expect(target.toString()).toBe("https://scalesmiths.co.uk/?experience=normal")
  })
})
