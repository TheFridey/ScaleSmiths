export const FORGE_ROUTE = "/forge"

export const FORGE_PROJECT_STATUSES = ["intake", "research", "strategy", "sitemap", "copy", "design", "build", "qa", "integrations", "preview", "client_review", "ready_to_deploy", "deployed", "archived"] as const
export const FORGE_PRIORITIES = ["low", "medium", "high"] as const
export const FORGE_TASK_AGENT_TYPES = ["intake", "research", "strategy", "sitemap", "copy", "design", "frontend", "integration", "seo", "qa", "deploy", "repair"] as const
export const FORGE_TASK_STATUSES = ["queued", "running", "completed", "failed", "cancelled"] as const
export const FORGE_ARTIFACT_TYPES = ["research_report", "sitemap", "copy_doc", "design_direction", "component_spec", "generated_code", "visual_critique", "qa_report", "seo_pack", "visual_qa", "proposal", "handover_doc", "deployment_notes", "export_record"] as const
export const FORGE_INTEGRATION_PROVIDERS = ["resend", "whatsapp", "analytics", "calendly", "stripe", "cloudinary", "custom"] as const

export type ForgeProjectStatus = (typeof FORGE_PROJECT_STATUSES)[number]
export type ForgePriority = (typeof FORGE_PRIORITIES)[number]
export type ForgeTaskAgentType = (typeof FORGE_TASK_AGENT_TYPES)[number]
export type ForgeTaskStatus = (typeof FORGE_TASK_STATUSES)[number]
export type ForgeArtifactType = (typeof FORGE_ARTIFACT_TYPES)[number]
export type ForgeIntegrationProvider = (typeof FORGE_INTEGRATION_PROVIDERS)[number]

export const FORGE_DASHBOARD_CARDS = [
  {
    key: "active-projects",
    label: "Active Projects",
    value: "0",
    note: "Client website production runs will appear here.",
  },
  {
    key: "draft-builds",
    label: "Draft Builds",
    value: "0",
    note: "Generated site drafts awaiting internal review.",
  },
  {
    key: "awaiting-qa",
    label: "Awaiting QA",
    value: "0",
    note: "Builds queued for content, design, and technical checks.",
  },
  {
    key: "ready-to-deploy",
    label: "Ready to Deploy",
    value: "0",
    note: "Approved exports and deployment candidates.",
  },
  {
    key: "integrations-health",
    label: "Integrations Health",
    value: "Idle",
    note: "Resend, WhatsApp, storage, and deploy checks are not connected yet.",
  },
  {
    key: "recent-activity",
    label: "Recent Activity",
    value: "None",
    note: "Forge activity logs will populate this feed.",
  },
] as const

export const FORGE_WORKFLOW_STAGES = [
  "Intake",
  "Research",
  "Sitemap",
  "Copy",
  "Design",
  "Build",
  "Visual Critique",
  "QA",
  "Deploy",
] as const

export const FORGE_INTAKE_ARTIFACT_TITLE = "Intake Summary"
export const FORGE_INTAKE_ARTIFACT_KIND = "forge_intake"

export const FORGE_INTAKE_SECTIONS = [
  {
    key: "businessBasics",
    label: "Business basics",
    description: "Who the business is, where it operates, and what makes it commercially useful.",
    fields: [
      { key: "businessOverview", label: "Business overview", required: true, multiline: true },
      { key: "businessLocation", label: "Business location", required: true },
      { key: "yearsTrading", label: "Years trading", required: false },
      { key: "teamSize", label: "Team size", required: false },
    ],
  },
  {
    key: "offerServices",
    label: "Offer/services",
    description: "The services, packages, or products the website needs to sell clearly.",
    fields: [
      { key: "coreServices", label: "Core services", required: true, multiline: true },
      { key: "flagshipOffer", label: "Flagship offer", required: true },
      { key: "pricingNotes", label: "Pricing notes", required: false, multiline: true },
    ],
  },
  {
    key: "targetCustomers",
    label: "Target customers",
    description: "Who the site is for and what those people need to believe before enquiring.",
    fields: [
      { key: "idealCustomers", label: "Ideal customers", required: true, multiline: true },
      { key: "customerProblems", label: "Customer problems", required: true, multiline: true },
      { key: "decisionMakers", label: "Decision makers", required: false },
    ],
  },
  {
    key: "serviceArea",
    label: "Local area/service area",
    description: "The local search footprint and delivery radius the site should support.",
    fields: [
      { key: "primaryLocation", label: "Primary location", required: true },
      { key: "serviceAreas", label: "Service areas", required: true, multiline: true },
    ],
  },
  {
    key: "brandPreferences",
    label: "Brand preferences",
    description: "Tone, look, likes, dislikes, and creative boundaries for the design agent.",
    fields: [
      { key: "brandTone", label: "Brand tone", required: true },
      { key: "visualStyle", label: "Visual style", required: true },
      { key: "brandLikes", label: "Likes", required: false, multiline: true },
      { key: "brandDislikes", label: "Dislikes", required: false, multiline: true },
    ],
  },
  {
    key: "competitors",
    label: "Competitors",
    description: "Reference businesses, market alternatives, and differentiation angles.",
    fields: [
      { key: "competitorUrls", label: "Competitor URLs", required: true, multiline: true },
      { key: "differentiators", label: "Differentiators", required: true, multiline: true },
    ],
  },
  {
    key: "websiteGoals",
    label: "Website goals",
    description: "The business outcomes and conversion actions the website must drive.",
    fields: [
      { key: "primaryWebsiteGoal", label: "Primary website goal", required: true },
      { key: "secondaryGoals", label: "Secondary goals", required: false, multiline: true },
      { key: "conversionActions", label: "Conversion actions", required: true, multiline: true },
    ],
  },
  {
    key: "trustAssets",
    label: "Trust assets",
    description: "Proof that reduces buyer anxiety: testimonials, results, awards, guarantees, and accreditations.",
    fields: [
      { key: "testimonials", label: "Testimonials/reviews", required: true, multiline: true },
      { key: "caseStudies", label: "Case studies/results", required: false, multiline: true },
      { key: "certifications", label: "Certifications/accreditations", required: false, multiline: true },
      { key: "guarantees", label: "Guarantees/process proof", required: false, multiline: true },
    ],
  },
  {
    key: "requiredPages",
    label: "Required pages",
    description: "The pages that must exist before sitemap and copy agents start work.",
    fields: [
      { key: "requiredPages", label: "Required pages", required: true, multiline: true },
      { key: "pageNotes", label: "Page notes", required: false, multiline: true },
    ],
  },
  {
    key: "requiredIntegrations",
    label: "Required integrations",
    description: "Forms, bookings, payments, analytics, CRM, email, WhatsApp, and operational tooling.",
    fields: [
      { key: "requiredIntegrations", label: "Required integrations", required: true, multiline: true },
      { key: "integrationNotes", label: "Integration notes", required: false, multiline: true },
    ],
  },
  {
    key: "existingAssets",
    label: "Existing assets",
    description: "Logos, photos, copy, access, documents, and anything needed for a proper build.",
    fields: [
      { key: "existingAssets", label: "Existing assets", required: true, multiline: true },
      { key: "assetAccessNotes", label: "Asset/access notes", required: false, multiline: true },
    ],
  },
] as const

export type ForgeIntakeFieldKey = (typeof FORGE_INTAKE_SECTIONS)[number]["fields"][number]["key"]
export type ForgeIntakeData = Record<ForgeIntakeFieldKey, string>

export function getForgeDashboardCard(key: string) {
  return FORGE_DASHBOARD_CARDS.find((card) => card.key === key) ?? null
}

type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string }
type JsonRecord = Record<string, unknown>

export interface ForgeProjectWrite {
  name: string
  businessName: string
  industry?: string | null
  websiteUrl?: string | null
  status: ForgeProjectStatus
  priority: ForgePriority
  ownerActor?: string | null
  clientId?: number | null
  prospectId?: number | null
  brandNotes?: string | null
  targetAudience?: string | null
  primaryGoal?: string | null
  budgetRange?: string | null
  deadline?: Date | null
}

export interface ForgeTaskWrite {
  projectId: number
  title: string
  description?: string | null
  agentType: ForgeTaskAgentType
  status: ForgeTaskStatus
  inputJson?: JsonRecord | null
  outputJson?: JsonRecord | null
  error?: string | null
  startedAt?: Date | null
  completedAt?: Date | null
}

export interface ForgeArtifactWrite {
  projectId: number
  type: ForgeArtifactType
  title: string
  content?: string | null
  metadataJson?: JsonRecord | null
}

export interface ForgeIntegrationConfigWrite {
  projectId: number
  provider: ForgeIntegrationProvider
  configJson?: JsonRecord | null
  enabled: boolean
}

export interface ForgeActivityLogWrite {
  projectId: number
  actor?: string | null
  action: string
  message: string
  metadataJson?: JsonRecord | null
}

export interface ForgeMemoryWrite {
  projectId: number
  key: string
  value: string
  source?: string | null
}

export interface ForgeIntakeResult {
  intake: ForgeIntakeData
  completenessScore: number
  missingFields: { key: ForgeIntakeFieldKey; label: string; section: string }[]
  summary: string
}

export function parseForgeProjectPayload(input: Record<string, unknown>, mode: "create" | "patch" = "create"): ParseResult<Partial<ForgeProjectWrite> & { name?: string; businessName?: string }> {
  const name = optionalString(input.name, 160)
  const businessName = optionalString(input.businessName, 160)

  if (mode === "create" && !name) return { ok: false, error: "Project name is required." }
  if (mode === "create" && !businessName) return { ok: false, error: "Business name is required." }
  if (mode === "patch" && "name" in input && !name) return { ok: false, error: "Project name is required." }
  if (mode === "patch" && "businessName" in input && !businessName) return { ok: false, error: "Business name is required." }

  const status = parseEnumField(input.status, FORGE_PROJECT_STATUSES, mode === "create" ? "intake" : null, "Status")
  const priority = parseEnumField(input.priority, FORGE_PRIORITIES, mode === "create" ? "medium" : null, "Priority")
  const websiteUrl = optionalString(input.websiteUrl, 240)
  const deadline = parseOptionalDate(input.deadline, "Deadline")
  const clientId = parseOptionalPositiveInteger(input.clientId, "Client reference")
  const prospectId = parseOptionalPositiveInteger(input.prospectId, "Prospect reference")

  if (!status.ok) return status
  if (!priority.ok) return priority
  if (!deadline.ok) return deadline
  if (!clientId.ok) return clientId
  if (!prospectId.ok) return prospectId
  if (websiteUrl && !isValidUrl(websiteUrl)) return { ok: false, error: "Current website URL must include http:// or https://." }

  const data: Partial<ForgeProjectWrite> & { name?: string; businessName?: string } = {}
  assignProjectField(data, input, "name", name, mode)
  assignProjectField(data, input, "businessName", businessName, mode)
  assignProjectField(data, input, "industry", optionalString(input.industry, 120), mode)
  assignProjectField(data, input, "websiteUrl", websiteUrl, mode)
  assignProjectField(data, input, "ownerActor", optionalString(input.ownerActor, 160), mode)
  assignProjectField(data, input, "brandNotes", optionalString(input.brandNotes, 4000), mode)
  assignProjectField(data, input, "targetAudience", optionalString(input.targetAudience, 1000), mode)
  assignProjectField(data, input, "primaryGoal", optionalString(input.primaryGoal, 1000), mode)
  assignProjectField(data, input, "budgetRange", optionalString(input.budgetRange, 120), mode)
  if (status.data) data.status = status.data
  if (priority.data) data.priority = priority.data
  if (deadline.data !== undefined) data.deadline = deadline.data
  if (clientId.data !== undefined) data.clientId = clientId.data
  if (prospectId.data !== undefined) data.prospectId = prospectId.data

  return { ok: true, data }
}

export function parseForgeTaskPayload(input: Record<string, unknown>): ParseResult<ForgeTaskWrite> {
  const projectId = parseRequiredPositiveInteger(input.projectId, "Project reference")
  const title = optionalString(input.title, 180)
  const agentType = parseEnumField(input.agentType, FORGE_TASK_AGENT_TYPES, null, "Agent type")
  const status = parseEnumField(input.status, FORGE_TASK_STATUSES, "queued", "Task status")
  const inputJson = parseOptionalJsonRecord(input.inputJson, "Input JSON")
  const outputJson = parseOptionalJsonRecord(input.outputJson, "Output JSON")
  const startedAt = parseOptionalDate(input.startedAt, "Started date")
  const completedAt = parseOptionalDate(input.completedAt, "Completed date")

  if (!projectId.ok) return projectId
  if (!title) return { ok: false, error: "Task title is required." }
  if (!agentType.ok) return agentType
  if (!agentType.data) return { ok: false, error: "Agent type is required." }
  if (!status.ok) return status
  if (!inputJson.ok) return inputJson
  if (!outputJson.ok) return outputJson
  if (!startedAt.ok) return startedAt
  if (!completedAt.ok) return completedAt

  return {
    ok: true,
    data: {
      projectId: projectId.data,
      title,
      description: optionalString(input.description, 2000),
      agentType: agentType.data,
      status: status.data,
      inputJson: inputJson.data,
      outputJson: outputJson.data,
      error: optionalString(input.error, 2000),
      startedAt: startedAt.data,
      completedAt: completedAt.data,
    },
  }
}

export function parseForgeArtifactPayload(input: Record<string, unknown>): ParseResult<ForgeArtifactWrite> {
  const projectId = parseRequiredPositiveInteger(input.projectId, "Project reference")
  const type = parseEnumField(input.type, FORGE_ARTIFACT_TYPES, null, "Artifact type")
  const title = optionalString(input.title, 180)
  const metadataJson = parseOptionalJsonRecord(input.metadataJson, "Metadata JSON")

  if (!projectId.ok) return projectId
  if (!type.ok) return type
  if (!type.data) return { ok: false, error: "Artifact type is required." }
  if (!title) return { ok: false, error: "Artifact title is required." }
  if (!metadataJson.ok) return metadataJson

  return {
    ok: true,
    data: {
      projectId: projectId.data,
      type: type.data,
      title,
      content: optionalString(input.content, 200000),
      metadataJson: metadataJson.data,
    },
  }
}

export function parseForgeIntegrationConfigPayload(input: Record<string, unknown>): ParseResult<ForgeIntegrationConfigWrite> {
  const projectId = parseRequiredPositiveInteger(input.projectId, "Project reference")
  const provider = parseEnumField(input.provider, FORGE_INTEGRATION_PROVIDERS, null, "Integration provider")
  const configJson = parseOptionalJsonRecord(input.configJson, "Config JSON")

  if (!projectId.ok) return projectId
  if (!provider.ok) return provider
  if (!provider.data) return { ok: false, error: "Integration provider is required." }
  if (!configJson.ok) return configJson

  return {
    ok: true,
    data: {
      projectId: projectId.data,
      provider: provider.data,
      configJson: configJson.data ?? {},
      enabled: input.enabled === true,
    },
  }
}

export function parseForgeActivityLogPayload(input: Record<string, unknown>): ParseResult<ForgeActivityLogWrite> {
  const projectId = parseRequiredPositiveInteger(input.projectId, "Project reference")
  const action = optionalString(input.action, 120)
  const message = optionalString(input.message, 1000)
  const metadataJson = parseOptionalJsonRecord(input.metadataJson, "Metadata JSON")

  if (!projectId.ok) return projectId
  if (!action) return { ok: false, error: "Activity action is required." }
  if (!message) return { ok: false, error: "Activity message is required." }
  if (!metadataJson.ok) return metadataJson

  return {
    ok: true,
    data: {
      projectId: projectId.data,
      actor: optionalString(input.actor, 160),
      action,
      message,
      metadataJson: metadataJson.data,
    },
  }
}

export function parseForgeMemoryPayload(input: Record<string, unknown>): ParseResult<ForgeMemoryWrite> {
  const projectId = parseRequiredPositiveInteger(input.projectId, "Project reference")
  const key = optionalString(input.key, 160)
  const value = optionalString(input.value, 10000)

  if (!projectId.ok) return projectId
  if (!key) return { ok: false, error: "Memory key is required." }
  if (!value) return { ok: false, error: "Memory value is required." }

  return {
    ok: true,
    data: {
      projectId: projectId.data,
      key,
      value,
      source: optionalString(input.source, 160),
    },
  }
}

export function redactIntegrationConfig(config: JsonRecord | null | undefined): JsonRecord {
  if (!config) return {}

  return Object.fromEntries(
    Object.entries(config).map(([key, value]) => {
      const sensitive = /secret|token|password|api[_-]?key|access[_-]?key|private/i.test(key)
      return [key, sensitive && value ? "[redacted]" : value]
    }),
  )
}

export function emptyForgeIntakeData(): ForgeIntakeData {
  return Object.fromEntries(
    FORGE_INTAKE_SECTIONS.flatMap((section) => section.fields.map((field) => [field.key, ""])),
  ) as ForgeIntakeData
}

export function parseForgeIntakePayload(input: Record<string, unknown>): ParseResult<ForgeIntakeResult> {
  const intake = emptyForgeIntakeData()

  for (const section of FORGE_INTAKE_SECTIONS) {
    for (const field of section.fields) {
      intake[field.key] = cleanIntakeValue(input[field.key], "multiline" in field && field.multiline ? 5000 : 500)
    }
  }

  const missingFields = getForgeIntakeMissingFields(intake)
  const requiredCount = FORGE_INTAKE_SECTIONS.reduce((sum, section) => sum + section.fields.filter((field) => field.required).length, 0)
  const completenessScore = Math.round(((requiredCount - missingFields.length) / requiredCount) * 100)

  return {
    ok: true,
    data: {
      intake,
      completenessScore,
      missingFields,
      summary: buildForgeIntakeSummary(intake, completenessScore, missingFields),
    },
  }
}

export function getForgeIntakeMissingFields(intake: Partial<Record<ForgeIntakeFieldKey, string>>) {
  return FORGE_INTAKE_SECTIONS.flatMap((section) =>
    section.fields
      .filter((field) => field.required && !cleanIntakeValue(intake[field.key], "multiline" in field && field.multiline ? 5000 : 500))
      .map((field) => ({ key: field.key, label: field.label, section: section.label })),
  )
}

export function buildForgeIntakeSummary(intake: ForgeIntakeData, completenessScore: number, missingFields = getForgeIntakeMissingFields(intake)) {
  const lines = [
    "# Intake Summary",
    "",
    `Completeness: ${completenessScore}%`,
    "",
  ]

  for (const section of FORGE_INTAKE_SECTIONS) {
    lines.push(`## ${section.label}`)
    for (const field of section.fields) {
      const value = intake[field.key]?.trim()
      lines.push(`- ${field.label}: ${value || "Not provided"}`)
    }
    lines.push("")
  }

  if (missingFields.length) {
    lines.push("## Missing information")
    for (const field of missingFields) {
      lines.push(`- ${field.section}: ${field.label}`)
    }
    lines.push("")
  }

  return lines.join("\n").trim()
}

export function readForgeIntakeArtifact(metadata: JsonRecord | null | undefined) {
  if (!metadata || metadata.kind !== FORGE_INTAKE_ARTIFACT_KIND || typeof metadata.intake !== "object" || metadata.intake === null || Array.isArray(metadata.intake)) {
    return {
      intake: emptyForgeIntakeData(),
      completenessScore: 0,
      missingFields: getForgeIntakeMissingFields(emptyForgeIntakeData()),
      status: "draft" as const,
    }
  }

  const parsed = parseForgeIntakePayload(metadata.intake as Record<string, unknown>)

  if (!parsed.ok) {
    return {
      intake: emptyForgeIntakeData(),
      completenessScore: 0,
      missingFields: getForgeIntakeMissingFields(emptyForgeIntakeData()),
      status: "draft" as const,
    }
  }

  return {
    intake: parsed.data.intake,
    completenessScore: typeof metadata.completenessScore === "number" ? metadata.completenessScore : parsed.data.completenessScore,
    missingFields: parsed.data.missingFields,
    status: metadata.status === "completed" ? "completed" as const : "draft" as const,
  }
}

function optionalString(value: unknown, maxLength = 2000) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : null
}

function cleanIntakeValue(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

function assignProjectField<T extends Record<string, unknown>>(data: T, input: Record<string, unknown>, key: keyof T & string, value: string | null, mode: "create" | "patch") {
  if (mode === "patch" && key in input) {
    ;(data as Record<string, unknown>)[key] = value
    return
  }

  if (mode === "create" && value !== null) {
    ;(data as Record<string, unknown>)[key] = value
  }
}

function includesValue<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === "string" && values.includes(value as T[number])
}

function parseEnumField<T extends readonly string[], F extends T[number] | null>(value: unknown, values: T, fallback: F, label: string): ParseResult<T[number] | F> {
  if (value === undefined || value === null || value === "") return { ok: true, data: fallback }
  if (includesValue(values, value)) return { ok: true, data: value }
  return { ok: false, error: `${label} is invalid.` }
}

function parseRequiredPositiveInteger(value: unknown, label: string): ParseResult<number> {
  const parsed = Number.parseInt(String(value ?? ""), 10)
  if (!Number.isInteger(parsed) || parsed < 1) return { ok: false, error: `${label} is invalid.` }
  return { ok: true, data: parsed }
}

function parseOptionalPositiveInteger(value: unknown, label: string): ParseResult<number | null | undefined> {
  if (value === undefined) return { ok: true, data: undefined }
  if (value === null || value === "") return { ok: true, data: null }

  const parsed = Number.parseInt(String(value), 10)
  if (!Number.isInteger(parsed) || parsed < 1) return { ok: false, error: `${label} is invalid.` }
  return { ok: true, data: parsed }
}

function parseOptionalDate(value: unknown, label: string): ParseResult<Date | null | undefined> {
  if (value === undefined) return { ok: true, data: undefined }
  if (value === null || value === "") return { ok: true, data: null }

  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return { ok: false, error: `${label} must be a valid date.` }
  return { ok: true, data: date }
}

function parseOptionalJsonRecord(value: unknown, label: string): ParseResult<JsonRecord | null> {
  if (value === undefined || value === null || value === "") return { ok: true, data: null }
  if (typeof value === "object" && !Array.isArray(value)) return { ok: true, data: value as JsonRecord }
  return { ok: false, error: `${label} must be an object.` }
}

function isValidUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}
