import { describe, expect, it } from "vitest"
import {
  ENQUIRY_CONSENT_COPY,
  LEGAL_LINKS,
  legalSitemapEntries,
  privacyMetadata,
  termsMetadata,
  legalRoutes,
  legalEntity,
} from "./legal"

describe("public legal surfaces", () => {
  it("keeps privacy and terms indexable and in the sitemap", () => {
    expect(privacyMetadata.robots).toEqual({ index: true, follow: true })
    expect(termsMetadata.robots).toEqual({ index: true, follow: true })
    expect(LEGAL_LINKS).toEqual([
      { href: "/legal", label: "Legal" },
      { href: "/legal/privacy", label: "Privacy" },
      { href: "/legal/cookies", label: "Cookies" },
      { href: "/legal/website-terms", label: "Terms" },
    ])

    const urls = legalSitemapEntries("https://scalesmiths.co.uk").map((entry) => entry.url)
    expect(urls).toContain("https://scalesmiths.co.uk/legal/privacy")
    expect(urls).toContain("https://scalesmiths.co.uk/legal/website-terms")
    expect(legalRoutes).toHaveLength(15)
    expect(legalEntity.companyNumber).toBeNull()
  })

  it("uses specific enquiry permission without inferring marketing consent", () => {
    expect(ENQUIRY_CONSENT_COPY).toContain("store the information I submit")
    expect(ENQUIRY_CONSENT_COPY).toContain("contact me about my enquiry")
    expect(ENQUIRY_CONSENT_COPY.toLowerCase()).not.toContain("marketing")
  })
})
