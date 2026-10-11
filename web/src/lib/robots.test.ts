import { describe, expect, it } from "vitest"
import robots from "../app/robots"

describe("robots policy", () => {
  it("allows public rendering assets while excluding private and completion routes", () => {
    const result = robots()
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules
    expect(rules.allow).toContain("/_next/image/")
    expect(rules.disallow).toContain("/api/")
    expect(rules.disallow).toContain("/portal/")
    expect(rules.disallow).toContain("/quote/thanks")
    expect(rules.disallow).toContain("/enterprise/contact/thanks")
    expect(result.sitemap).toBe("https://scalesmiths.co.uk/sitemap.xml")
  })
})
