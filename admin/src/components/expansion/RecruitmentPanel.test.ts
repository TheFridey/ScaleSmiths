import { describe, expect, it } from "vitest"
import { httpsLink } from "./RecruitmentPanel"

describe("applicant links in the founder workspace", () => {
  it("links only absolute HTTPS URLs from the public form", () => {
    expect(httpsLink("https://www.linkedin.com/in/example")).toBe("https://www.linkedin.com/in/example")
    for (const bad of ["javascript:alert(document.cookie)", "JaVaScRiPt:alert(1)", "data:text/html,<script>alert(1)</script>", "http://example.com", "/relative", "www.linkedin.com/in/x", "https://u:p@evil.example", null]) expect(httpsLink(bad)).toBeNull()
  })
})
