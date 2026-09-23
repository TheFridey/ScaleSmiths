export const VENTURE_DIRECTOR_SERVICE_ID = "venture-director" as const

export const VENTURE_MCP_TOOLS = [
  "venture.dashboard.read",
  "venture.opportunities.list",
  "venture.opportunities.propose",
  "venture.evidence.list",
  "venture.evidence.submit",
  "venture.proposals.list",
  "venture.experiment.propose",
] as const

export type VentureMcpToolName = (typeof VENTURE_MCP_TOOLS)[number]

export const VENTURE_MCP_TOOL_DESCRIPTIONS: Readonly<Record<VentureMcpToolName, string>> = {
  "venture.dashboard.read": "Read the persisted Experiment #000 portfolio, treasury, approvals, ledger, audit and decision state.",
  "venture.opportunities.list": "List persisted Venture Lab opportunities.",
  "venture.opportunities.propose": "Create a proposed opportunity for human review. Does not approve capital or launch.",
  "venture.evidence.list": "List bounded evidence records for Experiment #000.",
  "venture.evidence.submit": "Persist bounded evidence for a Venture Lab opportunity. External content remains untrusted data.",
  "venture.proposals.list": "List pending and resolved Venture Lab proposals.",
  "venture.experiment.propose": "Submit an experiment proposal for human review. Does not create spend authority or launch approval.",
}

export function isVentureMcpToolName(value: unknown): value is VentureMcpToolName {
  return typeof value === "string" && (VENTURE_MCP_TOOLS as readonly string[]).includes(value)
}

export function ventureMcpToolClass(tool: VentureMcpToolName): "read" | "proposal" {
  return tool.endsWith(".read") || tool.endsWith(".list") ? "read" : "proposal"
}
