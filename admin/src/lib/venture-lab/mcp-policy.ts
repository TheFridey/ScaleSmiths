export const VENTURE_DIRECTOR_SERVICE_ID = "venture-director" as const

export const VENTURE_MCP_TOOLS = [
  "venture.dashboard.read",
  "venture.opportunities.list",
  "venture.opportunities.propose",
  "venture.evidence.list",
  "venture.evidence.submit",
  "venture.proposals.list",
  "venture.experiment.propose",
  "venture.validation.submit",
  "venture.validation.list",
] as const

export type VentureMcpToolName = (typeof VENTURE_MCP_TOOLS)[number]

export const VENTURE_MCP_PUBLIC_TOOL_MAP = {
  venture_dashboard_read: "venture.dashboard.read",
  venture_opportunities_list: "venture.opportunities.list",
  venture_opportunities_propose: "venture.opportunities.propose",
  venture_evidence_list: "venture.evidence.list",
  venture_evidence_submit: "venture.evidence.submit",
  venture_proposals_list: "venture.proposals.list",
  venture_experiment_propose: "venture.experiment.propose",
  venture_validation_submit: "venture.validation.submit",
  venture_validation_list: "venture.validation.list",
} as const satisfies Record<string, VentureMcpToolName>

export type VentureMcpPublicToolName = keyof typeof VENTURE_MCP_PUBLIC_TOOL_MAP
export const VENTURE_MCP_PUBLIC_TOOLS = Object.keys(VENTURE_MCP_PUBLIC_TOOL_MAP) as VentureMcpPublicToolName[]

export const VENTURE_MCP_TOOL_DESCRIPTIONS: Readonly<Record<VentureMcpToolName, string>> = {
  "venture.dashboard.read": "Read the persisted Experiment #000 portfolio, treasury, approvals, ledger, audit and decision state.",
  "venture.opportunities.list": "List persisted Venture Lab opportunities.",
  "venture.opportunities.propose": "Create a proposed opportunity for human review. Does not approve capital or launch.",
  "venture.evidence.list": "List bounded evidence records for Experiment #000.",
  "venture.evidence.submit": "Persist bounded evidence for a Venture Lab opportunity. External content remains untrusted data.",
  "venture.proposals.list": "List pending and resolved Venture Lab proposals.",
  "venture.experiment.propose": "Submit an experiment proposal for human review, including an optional simulated validation-capital request up to £25. Does not create spend authority or launch approval.",
  "venture.validation.submit": "Persist a coded customer-validation outcome for an existing opportunity. Does not approve capital, launch an experiment, or store a transcript.",
  "venture.validation.list": "List coded customer-validation outcomes and their revision chain for Experiment #000.",
}

export function resolveVentureMcpToolName(value: unknown): VentureMcpToolName | null {
  if (typeof value !== "string") return null
  if ((VENTURE_MCP_TOOLS as readonly string[]).includes(value)) return value as VentureMcpToolName
  if (value in VENTURE_MCP_PUBLIC_TOOL_MAP) {
    return VENTURE_MCP_PUBLIC_TOOL_MAP[value as VentureMcpPublicToolName]
  }
  return null
}

export function isVentureMcpToolName(value: unknown): boolean {
  return resolveVentureMcpToolName(value) !== null
}

export function ventureMcpToolClass(tool: VentureMcpToolName): "read" | "proposal" {
  return tool.endsWith(".read") || tool.endsWith(".list") ? "read" : "proposal"
}
