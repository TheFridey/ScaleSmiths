import "server-only"

import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { and, desc, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  ventureAgentProposals,
  ventureApprovalRequests,
  ventureAuditEvents,
  ventureBudgetEnvelopes,
  ventureEvidence,
  ventureExperiments,
  ventureGateState,
  ventureLedgerJournals,
  ventureLedgerPostings,
  ventureOpportunities,
  ventureRuntimeState,
  ventureServiceAccounts,
  ventureServiceCredentials,
} from "@/lib/schema"

export const VENTURE_DIRECTOR_SCOPES = [
  "status:read",
  "opportunities:read",
  "opportunities:propose",
  "evidence:read",
  "evidence:propose",
  "experiments:read",
  "approvals:read",
  "ledger:read",
  "audit:read",
  "proposals:create",
] as const

export type VentureDirectorScope = (typeof VENTURE_DIRECTOR_SCOPES)[number]

export const VENTURE_MCP_TOOLS = [
  { name: "venture.status.get", scope: "status:read", description: "Read runtime, gate and treasury state." },
  { name: "venture.opportunities.list", scope: "opportunities:read", description: "List persisted opportunity records." },
  { name: "venture.opportunities.propose", scope: "opportunities:propose", description: "Submit a new opportunity proposal only." },
  { name: "venture.evidence.list", scope: "evidence:read", description: "List persisted evidence records." },
  { name: "venture.evidence.propose", scope: "evidence:propose", description: "Submit untrusted proposed evidence." },
  { name: "venture.experiments.list", scope: "experiments:read", description: "List experiments and their modes/statuses." },
  { name: "venture.approvals.list", scope: "approvals:read", description: "Read approval requests; cannot approve or mutate them." },
  { name: "venture.ledger.list", scope: "ledger:read", description: "Read sealed ledger journals and postings." },
  { name: "venture.audit.list", scope: "audit:read", description: "Read append-only Venture Lab audit history." },
  { name: "venture.proposals.create", scope: "proposals:create", description: "Create a proposal for human review; never executes it." },
] as const satisfies readonly { name: string; scope: VentureDirectorScope; description: string }[]

export class VentureMcpError extends Error {
  constructor(public code: string, public status = 400, message = code) {
    super(message)
    this.name = "VentureMcpError"
  }
}

export async function provisionVentureDirectorService(input: {
  id?: string
  displayName?: string
  scopes?: readonly VentureDirectorScope[]
}) {
  const id = input.id ?? "venture-director"
  const scopes = [...(input.scopes ?? VENTURE_DIRECTOR_SCOPES)]
  const invalid = scopes.filter((scope) => !VENTURE_DIRECTOR_SCOPES.includes(scope))
  if (invalid.length) throw new VentureMcpError("invalid_scope", 400)

  const [account] = await db.insert(ventureServiceAccounts).values({
    id,
    displayName: input.displayName ?? "Venture Director",
    scopes,
    active: true,
  }).onConflictDoNothing().returning()

  const existing = account ?? (await db.select().from(ventureServiceAccounts).where(eq(ventureServiceAccounts.id, id)).limit(1))[0]
  if (!existing?.active || existing.revokedAt) throw new VentureMcpError("service_revoked", 403)
  return existing
}

export async function issueVentureServiceCredential(serviceAccountId: string) {
  const [service] = await db.select().from(ventureServiceAccounts)
    .where(eq(ventureServiceAccounts.id, serviceAccountId)).limit(1)
  if (!service?.active || service.revokedAt) throw new VentureMcpError("service_revoked", 403)

  const secret = randomBytes(32).toString("base64url")
  const tokenHash = createHash("sha256").update(secret).digest("hex")
  const [credential] = await db.insert(ventureServiceCredentials).values({
    serviceAccountId,
    tokenHash,
    tokenVersion: service.tokenVersion,
    active: true,
  }).returning()

  return {
    credentialId: credential.id,
    token: `vlmcp.${credential.id}.${secret}`,
  }
}

export async function authenticateVentureServiceToken(value: string | null) {
  if (!value?.startsWith("Bearer ")) throw new VentureMcpError("unauthorized", 401)
  const token = value.slice(7).trim()
  const match = /^vlmcp\.([0-9a-f-]{36})\.([A-Za-z0-9_-]{20,})$/.exec(token)
  if (!match) throw new VentureMcpError("unauthorized", 401)

  const [, credentialId, secret] = match
  const [row] = await db.select({
    credential: ventureServiceCredentials,
    service: ventureServiceAccounts,
  }).from(ventureServiceCredentials)
    .innerJoin(ventureServiceAccounts, eq(ventureServiceAccounts.id, ventureServiceCredentials.serviceAccountId))
    .where(eq(ventureServiceCredentials.id, credentialId))
    .limit(1)

  if (!row?.credential.active || row.credential.revokedAt || !row.service.active || row.service.revokedAt) {
    throw new VentureMcpError("service_revoked", 403)
  }
  if (row.credential.tokenVersion !== row.service.tokenVersion) throw new VentureMcpError("credential_stale", 403)

  const expected = Buffer.from(row.credential.tokenHash, "hex")
  const actual = createHash("sha256").update(secret).digest()
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new VentureMcpError("unauthorized", 401)

  return { id: row.service.id, displayName: row.service.displayName, scopes: row.service.scopes as VentureDirectorScope[] }
}

export async function loadVentureLabDashboard() {
  const [runtime, gate, experiments, envelopes, opportunities, evidence, approvals, journals, postings, audit, proposals] = await Promise.all([
    db.select().from(ventureRuntimeState).where(eq(ventureRuntimeState.id, 1)).limit(1),
    db.select().from(ventureGateState).where(eq(ventureGateState.id, 1)).limit(1),
    db.select().from(ventureExperiments).orderBy(desc(ventureExperiments.createdAt)).limit(25),
    db.select().from(ventureBudgetEnvelopes).orderBy(ventureBudgetEnvelopes.id),
    db.select().from(ventureOpportunities).orderBy(desc(ventureOpportunities.createdAt)).limit(50),
    db.select().from(ventureEvidence).orderBy(desc(ventureEvidence.createdAt)).limit(50),
    db.select().from(ventureApprovalRequests).orderBy(desc(ventureApprovalRequests.requestedAt)).limit(50),
    db.select().from(ventureLedgerJournals).orderBy(desc(ventureLedgerJournals.createdAt)).limit(50),
    db.select().from(ventureLedgerPostings).orderBy(desc(ventureLedgerPostings.createdAt)).limit(100),
    db.select().from(ventureAuditEvents).orderBy(desc(ventureAuditEvents.createdAt)).limit(100),
    db.select().from(ventureAgentProposals).orderBy(desc(ventureAgentProposals.createdAt)).limit(50),
  ])
  return { runtime: runtime[0] ?? null, gate: gate[0] ?? null, experiments, envelopes, opportunities, evidence, approvals, journals, postings, audit, proposals }
}

export async function resolveVentureAgentProposal(input: {
  proposalId: string
  actorUserId: string
  decision: "ACCEPTED" | "REJECTED" | "CANCELLED"
  expectedType?: "OPPORTUNITY" | "EXPERIMENT" | "SPEND" | "LAUNCH" | "OTHER"
  reason: string
}) {
  const [proposal] = await db.select().from(ventureAgentProposals)
    .where(eq(ventureAgentProposals.id, input.proposalId)).limit(1)
  if (!proposal || proposal.status !== "PROPOSED") throw new VentureMcpError("proposal_not_resolvable", 409)
  if (input.expectedType && proposal.proposalType !== input.expectedType) throw new VentureMcpError("proposal_type_mismatch", 409)

  const [resolved] = await db.update(ventureAgentProposals).set({
    status: input.decision,
    resolvedBy: input.actorUserId,
    resolvedAt: sql`CURRENT_TIMESTAMP`,
  }).where(and(
    eq(ventureAgentProposals.id, input.proposalId),
    eq(ventureAgentProposals.status, "PROPOSED"),
  )).returning()
  if (!resolved) throw new VentureMcpError("proposal_not_resolvable", 409)

  await db.insert(ventureAuditEvents).values({
    experimentId: proposal.experimentId,
    actorType: "human",
    actorKey: input.actorUserId,
    action: `agent_proposal_${input.decision.toLowerCase()}`,
    reason: input.reason,
    metadataJson: { proposalId: proposal.id, proposalType: proposal.proposalType },
  })
  return resolved
}

export async function updateVentureGateState(input: {
  actorUserId: string
  currentBlocker: string
  nextDecision: string
}) {
  const currentBlocker = requiredTextArg(input.currentBlocker, "currentBlocker")
  const nextDecision = requiredTextArg(input.nextDecision, "nextDecision")
  const [updated] = await db.update(ventureGateState).set({
    currentBlocker,
    nextDecision,
    updatedBy: input.actorUserId,
    updatedAt: sql`CURRENT_TIMESTAMP`,
  }).where(eq(ventureGateState.id, 1)).returning()
  if (!updated) throw new VentureMcpError("gate_state_missing", 404)
  await db.insert(ventureAuditEvents).values({
    actorType: "human",
    actorKey: input.actorUserId,
    action: "gate_state_updated",
    metadataJson: { currentBlocker, nextDecision },
  })
  return updated
}

export async function executeVentureMcpTool(
  actor: { id: string; scopes: VentureDirectorScope[] },
  toolName: string,
  args: Record<string, unknown> = {},
) {
  const tool = VENTURE_MCP_TOOLS.find((candidate) => candidate.name === toolName)
  if (!tool) throw new VentureMcpError("tool_not_found", 404)
  if (!actor.scopes.includes(tool.scope)) throw new VentureMcpError("scope_denied", 403)

  if (toolName === "venture.status.get") {
    const snapshot = await loadVentureLabDashboard()
    return {
      runtime: snapshot.runtime,
      gate: snapshot.gate,
      treasury: snapshot.envelopes,
      experiments: snapshot.experiments,
    }
  }
  if (toolName === "venture.opportunities.list") return db.select().from(ventureOpportunities).orderBy(desc(ventureOpportunities.createdAt)).limit(50)
  if (toolName === "venture.evidence.list") return db.select().from(ventureEvidence).orderBy(desc(ventureEvidence.createdAt)).limit(50)
  if (toolName === "venture.experiments.list") return db.select().from(ventureExperiments).orderBy(desc(ventureExperiments.createdAt)).limit(25)
  if (toolName === "venture.approvals.list") return db.select().from(ventureApprovalRequests).orderBy(desc(ventureApprovalRequests.requestedAt)).limit(50)
  if (toolName === "venture.ledger.list") {
    const [journals, postings] = await Promise.all([
      db.select().from(ventureLedgerJournals).orderBy(desc(ventureLedgerJournals.createdAt)).limit(50),
      db.select().from(ventureLedgerPostings).orderBy(desc(ventureLedgerPostings.createdAt)).limit(100),
    ])
    return { journals, postings }
  }
  if (toolName === "venture.audit.list") return db.select().from(ventureAuditEvents).orderBy(desc(ventureAuditEvents.createdAt)).limit(100)

  const [runtime] = await db.select().from(ventureRuntimeState).where(eq(ventureRuntimeState.id, 1)).limit(1)
  if (!runtime || runtime.paused) throw new VentureMcpError("venture_paused", 409)

  const experimentCode = textArg(args.experimentCode) || "EXP-000"
  const [experiment] = await db.select().from(ventureExperiments).where(eq(ventureExperiments.code, experimentCode)).limit(1)
  if (!experiment) throw new VentureMcpError("experiment_missing", 404)

  if (toolName === "venture.opportunities.propose") {
    const [created] = await db.insert(ventureOpportunities).values({
      experimentId: experiment.id,
      title: requiredTextArg(args.title, "title"),
      summary: requiredTextArg(args.summary, "summary"),
      status: "PROPOSED",
      proposedByService: actor.id,
    }).returning()
    await auditService(actor.id, experiment.id, "opportunity_proposed", { opportunityId: created.id })
    return created
  }

  if (toolName === "venture.evidence.propose") {
    const excerpt = textArg(args.excerpt)
    if (excerpt && excerpt.length > 1000) throw new VentureMcpError("excerpt_too_long", 400)
    const payload = {
      sourceUrl: textArg(args.sourceUrl) || null,
      sourceTitle: textArg(args.sourceTitle) || null,
      evidenceType: requiredTextArg(args.evidenceType, "evidenceType"),
      claim: requiredTextArg(args.claim, "claim"),
      summary: requiredTextArg(args.summary, "summary"),
      excerpt: excerpt || null,
    }
    const contentHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex")
    const [created] = await db.insert(ventureEvidence).values({
      experimentId: experiment.id,
      opportunityId: textArg(args.opportunityId) || null,
      ...payload,
      contentHash,
      status: "PROPOSED",
      submittedByService: actor.id,
    }).returning()
    await auditService(actor.id, experiment.id, "evidence_proposed", { evidenceId: created.id, contentHash })
    return created
  }

  if (toolName === "venture.proposals.create") {
    const proposalType = requiredTextArg(args.proposalType, "proposalType").toUpperCase()
    if (!["OPPORTUNITY", "EXPERIMENT", "SPEND", "LAUNCH", "OTHER"].includes(proposalType)) throw new VentureMcpError("invalid_proposal_type", 400)
    const [created] = await db.insert(ventureAgentProposals).values({
      experimentId: experiment.id,
      proposalType: proposalType as "OPPORTUNITY" | "EXPERIMENT" | "SPEND" | "LAUNCH" | "OTHER",
      title: requiredTextArg(args.title, "title"),
      rationale: requiredTextArg(args.rationale, "rationale"),
      payloadJson: recordArg(args.payload),
      requestedByService: actor.id,
      status: "PROPOSED",
    }).returning()
    await auditService(actor.id, experiment.id, "agent_proposal_created", { proposalId: created.id, proposalType })
    return created
  }

  throw new VentureMcpError("tool_not_implemented", 500)
}

async function auditService(actorId: string, experimentId: number, action: string, metadataJson: Record<string, unknown>) {
  await db.insert(ventureAuditEvents).values({
    experimentId,
    actorType: "service",
    actorKey: actorId,
    action,
    metadataJson,
  })
}

function textArg(value: unknown) { return typeof value === "string" ? value.trim() : "" }
function requiredTextArg(value: unknown, field: string) {
  const text = textArg(value)
  if (!text) throw new VentureMcpError(`invalid_${field}`, 400)
  return text
}
function recordArg(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
