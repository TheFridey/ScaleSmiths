import "server-only"

import { createHash, timingSafeEqual } from "node:crypto"
import { desc, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  ventureAuditEvents,
  ventureExperiments,
  ventureRuntimeState,
  ventureServiceAccounts,
  ventureEvidence,
  ventureOpportunities,
  ventureProposals,
} from "@/lib/schema"
import { getVentureLabDashboardSnapshot } from "@/lib/server/venture-lab-dashboard"
import { authenticateVentureOauthAccessToken } from "@/lib/server/venture-lab-oauth"
import {
  resolveVentureMcpToolName,
  VENTURE_DIRECTOR_SERVICE_ID,
  VENTURE_MCP_PUBLIC_TOOL_MAP,
  VENTURE_MCP_PUBLIC_TOOLS,
  VENTURE_MCP_TOOL_DESCRIPTIONS,
  type VentureMcpToolName,
} from "@/lib/venture-lab/mcp-policy"

const EXPERIMENT_ZERO_CODE = "EXP-000"
const MAX_TEXT = 4000
const MAX_EXCERPT = 1000

export class VentureMcpError extends Error {
  constructor(public safeMessage: string, public status: number, public code: string) {
    super(safeMessage)
    this.name = "VentureMcpError"
  }
}

export function ventureMcpToolDefinitions() {
  return VENTURE_MCP_PUBLIC_TOOLS.map((name) => {
    const canonical = VENTURE_MCP_PUBLIC_TOOL_MAP[name]
    return {
      name,
      description: VENTURE_MCP_TOOL_DESCRIPTIONS[canonical],
      inputSchema: inputSchemaFor(canonical),
    }
  })
}

export async function authenticateVentureDirector(headers: Headers, env: NodeJS.ProcessEnv = process.env) {
  const auth = headers.get("authorization") ?? ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : ""
  if (!token) throw new VentureMcpError("Unauthorized.", 401, "mcp_unauthorized")

  const expected = env.VENTURE_DIRECTOR_MCP_TOKEN
  const staticMatch = Boolean(expected && expected.length >= 32 && constantTimeTextEqual(token, expected))
  const oauth = staticMatch ? null : await authenticateVentureOauthAccessToken(token)
  if (!staticMatch && oauth?.serviceId !== VENTURE_DIRECTOR_SERVICE_ID) {
    throw new VentureMcpError("Unauthorized.", 401, "mcp_unauthorized")
  }

  const [service] = await db.select().from(ventureServiceAccounts)
    .where(eq(ventureServiceAccounts.id, VENTURE_DIRECTOR_SERVICE_ID)).limit(1)
  if (!service?.active || service.revokedAt) throw new VentureMcpError("Venture Director service identity is revoked or unavailable.", 403, "service_revoked")

  const [runtime] = await db.select().from(ventureRuntimeState).where(eq(ventureRuntimeState.id, 1)).limit(1)
  if (!runtime || runtime.paused) throw new VentureMcpError("Venture Lab emergency STOP is active.", 423, "venture_paused")

  return { id: service.id, tokenVersion: service.tokenVersion }
}

export async function executeVentureMcpTool(input: {
  serviceId: string
  tool: unknown
  arguments?: unknown
  requestId?: string | null
}) {
  if (input.serviceId !== VENTURE_DIRECTOR_SERVICE_ID) throw new VentureMcpError("Unknown Venture Lab service identity.", 403, "service_identity_denied")
  const tool = resolveVentureMcpToolName(input.tool)
  if (!tool) throw new VentureMcpError("MCP tool is not allowed.", 403, "tool_not_allowed")

  await assertServiceAndStopState(input.serviceId)
  const args = objectArgs(input.arguments)
  const experiment = await requireExperimentZero()

  assertAllowedKeys(tool, args)

  let result: unknown
  switch (tool) {
    case "venture.dashboard.read":
      result = await getVentureLabDashboardSnapshot()
      break
    case "venture.opportunities.list":
      result = await db.select().from(ventureOpportunities)
        .where(eq(ventureOpportunities.experimentId, experiment.id))
        .orderBy(desc(ventureOpportunities.createdAt)).limit(50)
      break
    case "venture.evidence.list":
      result = await db.select().from(ventureEvidence)
        .where(eq(ventureEvidence.experimentId, experiment.id))
        .orderBy(desc(ventureEvidence.createdAt)).limit(50)
      break
    case "venture.proposals.list":
      result = await db.select().from(ventureProposals)
        .where(eq(ventureProposals.experimentId, experiment.id))
        .orderBy(desc(ventureProposals.createdAt)).limit(50)
      break
    case "venture.opportunities.propose": {
      const title = boundedText(args.title, "title", 200)
      const problem = boundedText(args.problem, "problem", MAX_TEXT)
      result = await db.transaction(async (tx) => {
        const [opportunity] = await tx.insert(ventureOpportunities).values({
          experimentId: experiment.id,
          title,
          problem,
          status: "PROPOSED",
          createdByService: input.serviceId,
        }).returning()
        const [proposal] = await tx.insert(ventureProposals).values({
          experimentId: experiment.id,
          opportunityId: opportunity.id,
          kind: "OPPORTUNITY",
          title,
          rationale: problem,
          payloadJson: { opportunityId: opportunity.id },
          proposedByService: input.serviceId,
        }).returning()
        return { opportunity, proposal }
      })
      break
    }
    case "venture.evidence.submit": {
      const sourceUrl = safeHttpUrl(args.sourceUrl)
      const sourceTitle = boundedText(args.sourceTitle, "sourceTitle", 300)
      const evidenceType = boundedText(args.evidenceType, "evidenceType", 80)
      const claim = boundedText(args.claim, "claim", MAX_TEXT)
      const summary = boundedText(args.summary, "summary", MAX_TEXT)
      const excerpt = boundedText(args.excerpt, "excerpt", MAX_EXCERPT)
      const opportunityId = optionalUuid(args.opportunityId)
      if (opportunityId) await requireOpportunity(experiment.id, opportunityId)
      const observedAt = parseDate(args.observedAt, "observedAt")
      const publishedAt = args.publishedAt ? parseDate(args.publishedAt, "publishedAt") : null
      const contentHash = createHash("sha256").update(JSON.stringify({ sourceUrl, sourceTitle, evidenceType, claim, summary, excerpt, publishedAt: publishedAt?.toISOString() ?? null })).digest("hex")
      const [row] = await db.insert(ventureEvidence).values({
        experimentId: experiment.id,
        opportunityId,
        sourceUrl,
        sourceTitle,
        evidenceType,
        claim,
        summary,
        excerpt,
        publishedAt,
        observedAt,
        contentHash,
        capturedByService: input.serviceId,
      }).onConflictDoNothing().returning()
      result = row ?? { duplicate: true, contentHash }
      break
    }
    case "venture.experiment.propose": {
      const title = boundedText(args.title, "title", 200)
      const rationale = boundedText(args.rationale, "rationale", MAX_TEXT)
      const hypothesis = boundedText(args.hypothesis, "hypothesis", MAX_TEXT)
      const successCriteria = boundedText(args.successCriteria, "successCriteria", MAX_TEXT)
      const requestedCapitalMinor = simulatedCapitalRequest(args.requestedCapitalMinor)
      const [proposal] = await db.insert(ventureProposals).values({
        experimentId: experiment.id,
        kind: "EXPERIMENT",
        title,
        rationale,
        payloadJson: { hypothesis, successCriteria, mode: "SIMULATED", requestedCapitalMinor },
        proposedByService: input.serviceId,
      }).returning()
      result = proposal
      break
    }
  }

  await db.insert(ventureAuditEvents).values({
    experimentId: experiment.id,
    actorType: "service",
    actorKey: input.serviceId,
    action: `mcp:${tool}`,
    reason: "Restricted Venture Director MCP operation.",
    requestId: input.requestId ?? null,
    metadataJson: {
      tool,
      externalTool: typeof input.tool === "string" ? input.tool : null,
    },
  })
  return result
}

async function assertServiceAndStopState(serviceId: string) {
  const rows = await db.execute(sql`
    SELECT s.active, s.revoked_at, r.paused
    FROM venture_service_accounts s
    CROSS JOIN venture_runtime_state r
    WHERE s.id = ${serviceId} AND r.id = 1
  `)
  const row = rows.rows[0] as { active?: boolean; revoked_at?: Date | null; paused?: boolean } | undefined
  if (!row?.active || row.revoked_at) throw new VentureMcpError("Venture Director service identity is revoked or unavailable.", 403, "service_revoked")
  if (row.paused) throw new VentureMcpError("Venture Lab emergency STOP is active.", 423, "venture_paused")
}

async function requireExperimentZero() {
  const [experiment] = await db.select().from(ventureExperiments).where(eq(ventureExperiments.code, EXPERIMENT_ZERO_CODE)).limit(1)
  if (!experiment) throw new VentureMcpError("Experiment #000 is not initialized.", 409, "experiment_missing")
  if (experiment.mode !== "SIMULATED") throw new VentureMcpError("The restricted MCP gateway is simulation-only.", 409, "simulation_boundary")
  return experiment
}

async function requireOpportunity(experimentId: number, opportunityId: string) {
  const [row] = await db.select({ id: ventureOpportunities.id }).from(ventureOpportunities)
    .where(sql`${ventureOpportunities.id} = ${opportunityId}::uuid AND ${ventureOpportunities.experimentId} = ${experimentId}`).limit(1)
  if (!row) throw new VentureMcpError("Opportunity does not exist in Experiment #000.", 404, "opportunity_missing")
}

function assertAllowedKeys(tool: VentureMcpToolName, args: Record<string, unknown>) {
  const allowed: Readonly<Record<VentureMcpToolName, readonly string[]>> = {
    "venture.dashboard.read": [],
    "venture.opportunities.list": [],
    "venture.opportunities.propose": ["title", "problem"],
    "venture.evidence.list": [],
    "venture.evidence.submit": ["opportunityId", "sourceUrl", "sourceTitle", "evidenceType", "claim", "summary", "excerpt", "observedAt", "publishedAt"],
    "venture.proposals.list": [],
    "venture.experiment.propose": ["title", "rationale", "hypothesis", "successCriteria", "requestedCapitalMinor"],
  }
  const unexpected = Object.keys(args).filter((key) => !allowed[tool].includes(key))
  if (unexpected.length) throw new VentureMcpError("Tool arguments contain fields that are not allowed.", 400, "invalid_arguments")
}

function inputSchemaFor(tool: VentureMcpToolName) {
  switch (tool) {
    case "venture.opportunities.propose":
      return { type: "object", additionalProperties: false, required: ["title", "problem"], properties: { title: { type: "string" }, problem: { type: "string" } } }
    case "venture.evidence.submit":
      return { type: "object", additionalProperties: false, required: ["sourceUrl", "sourceTitle", "evidenceType", "claim", "summary", "excerpt", "observedAt"], properties: { opportunityId: { type: "string" }, sourceUrl: { type: "string" }, sourceTitle: { type: "string" }, evidenceType: { type: "string" }, claim: { type: "string" }, summary: { type: "string" }, excerpt: { type: "string" }, observedAt: { type: "string" }, publishedAt: { type: "string" } } }
    case "venture.experiment.propose":
      return {
        type: "object",
        additionalProperties: false,
        required: ["title", "rationale", "hypothesis", "successCriteria"],
        properties: {
          title: { type: "string" },
          rationale: { type: "string" },
          hypothesis: { type: "string" },
          successCriteria: { type: "string" },
          requestedCapitalMinor: { type: "integer", minimum: 0, maximum: 2500 },
        },
      }
    default:
      return { type: "object", additionalProperties: false, properties: {} }
  }
}

function objectArgs(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null) return {}
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new VentureMcpError("Tool arguments must be an object.", 400, "invalid_arguments")
  return value as Record<string, unknown>
}

function boundedText(value: unknown, field: string, max: number) {
  if (typeof value !== "string") throw new VentureMcpError(`${field} is required.`, 400, "invalid_arguments")
  const text = value.trim()
  if (!text || text.length > max) throw new VentureMcpError(`${field} must be between 1 and ${max} characters.`, 400, "invalid_arguments")
  return text
}

function simulatedCapitalRequest(value: unknown) {
  if (value === undefined || value === null) return 0
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 2500) {
    throw new VentureMcpError("requestedCapitalMinor must be a safe integer between 0 and 2500.", 400, "invalid_arguments")
  }
  return value
}

function safeHttpUrl(value: unknown) {
  const raw = boundedText(value, "sourceUrl", 2000)
  let url: URL
  try { url = new URL(raw) } catch { throw new VentureMcpError("sourceUrl must be a valid URL.", 400, "invalid_arguments") }
  if (!["http:", "https:"].includes(url.protocol)) throw new VentureMcpError("sourceUrl must use HTTP or HTTPS.", 400, "invalid_arguments")
  return url.toString()
}

function optionalUuid(value: unknown) {
  if (value === undefined || value === null || value === "") return null
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new VentureMcpError("opportunityId must be a UUID.", 400, "invalid_arguments")
  }
  return value
}

function parseDate(value: unknown, field: string) {
  if (typeof value !== "string") throw new VentureMcpError(`${field} must be an ISO timestamp.`, 400, "invalid_arguments")
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new VentureMcpError(`${field} must be an ISO timestamp.`, 400, "invalid_arguments")
  return date
}

function constantTimeTextEqual(actual: string, expected: string) {
  const a = Buffer.from(actual)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
