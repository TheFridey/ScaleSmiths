import { describe, expect, it } from "vitest"
import { FORGE_AGENT_REGISTRY, getForgeAgentRegistryReference, lookupForgePrompt, lookupForgeSchema } from "./forge-prompt-registry"

const HISTORICAL_REFERENCES = {
  review_council: ["forge.review-council", "1.0.0", "forge.review-council-report", "1.0.0"],
  review_council_synthesis: ["forge.review-council-synthesis", "1.0.0", "forge.review-council-synthesis", "1.0.0"],
  research: ["forge.research", "1.0.0", "forge.research-report", "1.0.0"], sitemap: ["forge.sitemap", "1.0.0", "forge.sitemap-strategy", "1.0.0"], copy: ["forge.copy", "1.0.0", "forge.copy-document", "1.0.0"], design: ["forge.design", "1.0.0", "forge.design-direction", "1.0.0"], design_system: ["forge.design-system", "1.0.0", "forge.design-system-specification", "1.0.0"], component_spec: ["forge.component-spec", "1.0.0", "forge.component-specification", "1.0.0"], accessibility_gate: ["forge.accessibility-gate", "1.0.0", "forge.accessibility-report", "1.0.0"], consistency_evaluator: ["forge.consistency-evaluator", "1.0.0", "forge.consistency-report", "1.0.0"], copy_quality_evaluator: ["forge.copy-quality-evaluator", "1.0.0", "forge.copy-quality-report", "1.0.0"], originality_evaluator: ["forge.originality-evaluator", "1.0.0", "forge.originality-report", "1.0.0"], site_inventory: ["forge.site-inventory", "1.0.0", "forge.site-inventory", "1.0.0"], migration_analysis: ["forge.migration-analysis", "1.0.0", "forge.migration-analysis", "1.0.0"], migration_execution: ["forge.migration-execution", "1.0.0", "forge.migration-candidate", "1.0.0"], screenshot_visual_qa: ["forge.screenshot-visual-qa", "1.0.0", "forge.screenshot-visual-report", "1.0.0"], visual_critique: ["forge.visual-critique", "1.0.0", "forge.visual-critique-report", "1.0.0"], repair: ["forge.repair", "1.0.0", "forge.repair-patch", "1.0.0"], command_classification: ["forge.command-classification", "1.0.0", "forge.command-classification", "1.0.0"], url_autofill: ["forge.url-autofill", "1.0.0", "forge.url-autofill-result", "1.0.0"], provider_test: ["forge.provider-test", "1.0.0", "forge.provider-test-result", "1.0.0"], intake_question: ["forge.intake-question", "1.0.0", "forge.intake-question", "1.0.0"], client_request_triage: ["forge.client-request-triage", "1.0.0", "forge.client-request-triage", "1.0.0"], sales_proposal: ["forge.sales-proposal", "1.0.0", "forge.sales-proposal-sections", "1.0.0"], monthly_report: ["forge.monthly-report", "1.0.0", "forge.monthly-report-sections", "1.0.0"],
} as const

describe("Forge prompt and schema registry", () => {
  it("preserves every historical identifier/version pair", () => {
    expect(Object.keys(FORGE_AGENT_REGISTRY).sort()).toEqual(Object.keys(HISTORICAL_REFERENCES).sort())
    for (const [key, expected] of Object.entries(HISTORICAL_REFERENCES)) {
      const ref = getForgeAgentRegistryReference(key as keyof typeof FORGE_AGENT_REGISTRY)
      expect([ref.promptIdentifier, ref.promptVersion, ref.schemaIdentifier, ref.schemaVersion]).toEqual(expected)
      expect(lookupForgePrompt(ref.promptIdentifier, ref.promptVersion)).toMatchObject({ deprecated: false })
      expect(lookupForgeSchema(ref.schemaIdentifier, ref.schemaVersion)).toHaveProperty("fixture")
    }
  })
})
