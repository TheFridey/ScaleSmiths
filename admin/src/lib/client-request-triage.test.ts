import { describe, expect, it } from "vitest"
import {
  buildClientRequestTriagePrompt,
  CLIENT_REQUEST_TRIAGE_SCHEMA,
  createFallbackClientRequestTriage,
  formatClientRequestTriageChecklist,
  formatClientRequestTriageSummary,
} from "./client-request-triage"
import { validateJsonSchemaValue } from "./forge-ai"

describe("admin client request triage", () => {
  it("creates schema-valid fallback triage", () => {
    const triage = createFallbackClientRequestTriage({
      title: "Contact form has stopped working",
      description: "Customers say the enquiry form will not submit.",
      category: "website_issue",
      priority: "medium",
      affectedUrl: "https://example.com/contact",
    })

    expect(triage.suggestedCategory).toBe("form_issue")
    expect(triage.suggestedPriority).toBe("high")
    expect(validateJsonSchemaValue(CLIENT_REQUEST_TRIAGE_SCHEMA, triage)).toEqual([])
  })

  it("builds safe admin-only stored text", () => {
    const triage = createFallbackClientRequestTriage({
      title: "New landing page",
      description: "We need a new landing page for a campaign.",
      category: "new_page",
      priority: "medium",
    })

    expect(formatClientRequestTriageSummary(triage)).toContain("Estimated complexity:")
    expect(formatClientRequestTriageChecklist(triage)).toContain("Confirm page goal")
  })

  it("does not claim live site inspection in the AI prompt", () => {
    const prompt = buildClientRequestTriagePrompt({
      title: "SEO help",
      description: "Please improve rankings.",
      category: "seo_request",
      priority: "medium",
    })

    expect(prompt).toContain("Do not claim to have crawled")
  })
})
