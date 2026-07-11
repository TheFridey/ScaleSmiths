export const FORGE_AGENT_REGISTRY = {
  research: entry("forge.research", "1.0.0", "forge.research-report", "1.0.0", "Research brief to structured evidence report", { businessName: "Example Ltd", industry: "services" }),
  sitemap: entry("forge.sitemap", "1.0.0", "forge.sitemap-strategy", "1.0.0", "Approved research to sitemap strategy", { pages: ["/"] }),
  copy: entry("forge.copy", "1.0.0", "forge.copy-document", "1.0.0", "Approved sitemap to page copy", { page: "/" }),
  design: entry("forge.design", "1.0.0", "forge.design-direction", "1.0.0", "Brief and copy to design direction", { style: "editorial" }),
  component_spec: entry("forge.component-spec", "1.0.0", "forge.component-specification", "1.0.0", "Approved inputs to component contract", { components: ["Hero"] }),
  visual_critique: entry("forge.visual-critique", "1.0.0", "forge.visual-critique-report", "1.0.0", "Generated build to visual critique", { viewport: "desktop" }),
  repair: entry("forge.repair", "1.0.0", "forge.repair-patch", "1.0.0", "Failed QA evidence to bounded repair patch", { failingChecks: ["build"] }),
  command_classification: entry("forge.command-classification", "1.0.0", "forge.command-classification", "1.0.0", "Admin command to safe routed action", { command: "Run QA" }),
  url_autofill: entry("forge.url-autofill", "1.0.0", "forge.url-autofill-result", "1.0.0", "Public pages to intake suggestions", { url: "https://example.com" }),
  provider_test: entry("forge.provider-test", "1.0.0", "forge.provider-test-result", "1.0.0", "Provider connectivity structured test", { prompt: "Health check" }),
  intake_question: entry("forge.intake-question", "1.0.0", "forge.intake-question", "1.0.0", "Build brief follow-up question", { business: "Example Ltd" }),
  client_request_triage: entry("forge.client-request-triage", "1.0.0", "forge.client-request-triage", "1.0.0", "Client request triage", { request: "Update homepage" }),
  sales_proposal: entry("forge.sales-proposal", "1.0.0", "forge.sales-proposal-sections", "1.0.0", "Sales proposal generation", { prospect: "Example Ltd" }),
  monthly_report: entry("forge.monthly-report", "1.0.0", "forge.monthly-report-sections", "1.0.0", "Monthly client report generation", { month: "2026-01" }),
} as const

export type ForgeAgentRegistryKey = keyof typeof FORGE_AGENT_REGISTRY
export interface ForgeRegistryReference { promptIdentifier: string; promptVersion: string; schemaIdentifier: string; schemaVersion: string }

export function getForgeAgentRegistryReference(key: ForgeAgentRegistryKey): ForgeRegistryReference {
  const value = FORGE_AGENT_REGISTRY[key]
  return { promptIdentifier: value.prompt.id, promptVersion: value.prompt.activeVersion, schemaIdentifier: value.schema.id, schemaVersion: value.schema.activeVersion }
}
export function lookupForgePrompt(id: string, version?: string) { return lookup("prompt", id, version) }
export function lookupForgeSchema(id: string, version?: string) { return lookup("schema", id, version) }

function lookup(kind: "prompt" | "schema", id: string, version?: string) {
  for (const value of Object.values(FORGE_AGENT_REGISTRY)) {
    const item = value[kind]
    if (item.id === id) return item.versions[version ?? item.activeVersion as keyof typeof item.versions] ?? null
  }
  return null
}
function entry(promptId: string, promptVersion: string, schemaId: string, schemaVersion: string, description: string, fixture: Record<string, unknown>) {
  return {
    prompt: { id: promptId, activeVersion: promptVersion, versions: { [promptVersion]: version(description, fixture) } },
    schema: { id: schemaId, activeVersion: schemaVersion, versions: { [schemaVersion]: version(`${description} output contract`, fixture) } },
  }
}
function version(changeDescription: string, fixture: Record<string, unknown>) {
  return { deprecated: false, compatibilityNotes: "Initial version; consumers must use exact structured-output validation.", changeDescription, fixture }
}
