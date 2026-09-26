import { describe, expect, it } from "vitest"
import {
  enterpriseContactCopy,
  metadataForEnterpriseContactPage,
  metadataForEnterpriseContactThanksPage,
} from "./enterprise-contact-page"
import { ENTERPRISE_CONTACT_PATH, ENTERPRISE_CONTACT_THANKS_PATH } from "./enterprise-enquiry"

describe("enterprise contact page metadata", () => {
  it("positions the discovery route for conversion without aggressive SEO claims", () => {
    expect(enterpriseContactCopy.brand).toBe("ScaleSmiths")
    expect(enterpriseContactCopy.title).toMatch(/enterprise discovery/i)
    expect(enterpriseContactCopy.lede.toLowerCase()).toContain("not the standard quote form")

    const metadata = metadataForEnterpriseContactPage()
    expect(metadata.alternates).toMatchObject({ canonical: ENTERPRISE_CONTACT_PATH })
    expect(metadata.robots).toEqual({ index: true, follow: true })
  })

  it("keeps the thanks route out of search", () => {
    const metadata = metadataForEnterpriseContactThanksPage()
    expect(metadata.robots).toEqual({ index: false, follow: false })
    expect(metadata.alternates).toMatchObject({ canonical: ENTERPRISE_CONTACT_THANKS_PATH })
  })
})
