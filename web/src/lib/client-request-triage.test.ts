import { describe, expect, it } from "vitest"
import {
  createFallbackClientRequestTriage,
  formatClientRequestTriageChecklist,
  formatClientRequestTriageSummary,
} from "./client-request-triage"

describe("client request triage fallback", () => {
  it("escalates site-down requests to urgent critical triage", () => {
    const triage = createFallbackClientRequestTriage({
      title: "Website is down",
      description: "The site is offline and customers cannot reach us.",
      category: "general_support",
      priority: "medium",
      affectedUrl: "https://example.com",
    })

    expect(triage.suggestedCategory).toBe("urgent_support")
    expect(triage.suggestedPriority).toBe("critical")
    expect(triage.estimatedComplexity).toBe("complex")
  })

  it("formats stored Forge fields without exposing structured internals", () => {
    const triage = createFallbackClientRequestTriage({
      title: "Change homepage text",
      description: "Small typo on the homepage hero.",
      category: "website_update",
      priority: "low",
    })

    expect(formatClientRequestTriageSummary(triage)).toContain("Suggested category:")
    expect(formatClientRequestTriageChecklist(triage)).toContain("- ")
  })
})
