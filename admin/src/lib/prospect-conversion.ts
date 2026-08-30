import { CLIENT_FORGE_BUILD_TIER, CLIENT_RETAINER_TIER, isClientServiceTier, type ClientServiceTier } from "@/lib/clients"

export class ProspectConversionError extends Error {
  constructor(public safeMessage: string, public status = 400, public code = "prospect_conversion") {
    super(safeMessage)
    this.name = "ProspectConversionError"
  }
}

export interface ClientCreateOption { mode: "create"; name: string; tier: ClientServiceTier; invoiceClientCode: string }
export interface ClientLinkOption { mode: "link"; clientId: number; tier?: ClientServiceTier; invoiceClientCode?: string }
export type ClientOption = ClientCreateOption | ClientLinkOption

export interface ConfirmedConversionOptions {
  client: ClientOption
  mrr: number
  catalogueItemIds: number[]
  createProject: boolean
  projectName?: string
  onboardingTasks: boolean
  createDraftInvoice: boolean
  preparePortal: boolean
}

const INVOICE_CODE_RE = /^[A-Z0-9]{2,12}$/

function bool(value: unknown, field: string) {
  if (typeof value !== "boolean") throw new ProspectConversionError(`${field} must be true or false.`)
  return value
}
function nonNegativeInt(value: unknown, field: string) {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isInteger(n) || n < 0) throw new ProspectConversionError(`${field} must be zero or a positive whole number.`)
  return n
}
function catalogueIds(value: unknown) {
  if (!Array.isArray(value)) throw new ProspectConversionError("Service selection must be a list.")
  const ids = value.map((v) => {
    const n = typeof v === "number" ? v : Number(v)
    if (!Number.isInteger(n) || n <= 0) throw new ProspectConversionError("Service ids must be positive whole numbers.")
    return n
  })
  return [...new Set(ids)].sort((a, b) => a - b)
}

export function parseConversionOptions(input: unknown): ConfirmedConversionOptions {
  if (!input || typeof input !== "object") throw new ProspectConversionError("A conversion options object is required.")
  const raw = input as Record<string, unknown>
  const c = raw.client
  if (!c || typeof c !== "object") throw new ProspectConversionError("A client option is required.")
  const cr = c as Record<string, unknown>

  let client: ClientOption
  if (cr.mode === "create") {
    const name = typeof cr.name === "string" ? cr.name.trim() : ""
    if (!name) throw new ProspectConversionError("Client name is required.")
    if (!isClientServiceTier(cr.tier)) throw new ProspectConversionError("Select a valid client service tier.")
    const code = typeof cr.invoiceClientCode === "string" ? cr.invoiceClientCode.trim().toUpperCase() : ""
    if (!INVOICE_CODE_RE.test(code)) throw new ProspectConversionError("Invoice client code must be 2–12 letters or numbers.")
    client = { mode: "create", name, tier: cr.tier, invoiceClientCode: code }
  } else if (cr.mode === "link") {
    const clientId = typeof cr.clientId === "number" ? cr.clientId : Number(cr.clientId)
    if (!Number.isInteger(clientId) || clientId <= 0) throw new ProspectConversionError("Select an existing client to link.")
    const tier = cr.tier == null || cr.tier === "" ? undefined : cr.tier
    if (tier !== undefined && !isClientServiceTier(tier)) throw new ProspectConversionError("Select a valid client service tier.")
    const code = cr.invoiceClientCode == null || cr.invoiceClientCode === "" ? undefined : String(cr.invoiceClientCode).trim().toUpperCase()
    if (code !== undefined && !INVOICE_CODE_RE.test(code)) throw new ProspectConversionError("Invoice client code must be 2–12 letters or numbers.")
    client = { mode: "link", clientId, tier: tier as ClientServiceTier | undefined, invoiceClientCode: code }
  } else {
    throw new ProspectConversionError("Client mode must be 'create' or 'link'.")
  }

  const ids = catalogueIds(raw.catalogueItemIds)
  const createProject = bool(raw.createProject, "Create project")
  const projectName = typeof raw.projectName === "string" ? raw.projectName.trim() : ""
  if (createProject && !projectName) throw new ProspectConversionError("A project name is required to create a project.")
  const createDraftInvoice = bool(raw.createDraftInvoice, "Create draft invoice")
  if (createDraftInvoice && ids.length === 0) throw new ProspectConversionError("Select at least one service before creating a draft invoice.")

  return {
    client,
    mrr: nonNegativeInt(raw.mrr, "MRR"),
    catalogueItemIds: ids,
    createProject,
    projectName: createProject ? projectName : undefined,
    onboardingTasks: bool(raw.onboardingTasks, "Onboarding tasks"),
    createDraftInvoice,
    preparePortal: bool(raw.preparePortal, "Prepare portal"),
  }
}

export function defaultOnboardingTasks() {
  return [
    { title: "Kickoff & welcome" },
    { title: "Collect brand assets & access" },
    { title: "Confirm scope & timeline" },
    { title: "Staging environment" },
    { title: "Go-live checklist" },
  ]
}

export function deriveTier(mrr: number): ClientServiceTier {
  return mrr > 0 ? CLIENT_RETAINER_TIER : CLIENT_FORGE_BUILD_TIER
}

export function suggestInvoiceClientCode(name: string) {
  const cleaned = (name ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "")
  const base = (cleaned || "CLIENT").slice(0, 12)
  return base.length >= 2 ? base : (base + "00").slice(0, 2)
}

export function normaliseName(v: string | null | undefined) {
  return (v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "")
}

export interface ClientMatchCandidate { clientId: number; name: string; tier: string | null; mrr: number; matchedOn: Array<"name" | "email"> }

export function matchExistingClients(
  prospect: { businessName: string; contactEmail: string | null },
  clients: Array<{ id: number; name: string; contactEmail: string | null; tier: string | null; mrr: number }>,
): ClientMatchCandidate[] {
  const name = normaliseName(prospect.businessName)
  const email = (prospect.contactEmail ?? "").trim().toLowerCase()
  const out: ClientMatchCandidate[] = []
  for (const client of clients) {
    const matchedOn: Array<"name" | "email"> = []
    if (name && normaliseName(client.name) === name) matchedOn.push("name")
    if (email && (client.contactEmail ?? "").trim().toLowerCase() === email) matchedOn.push("email")
    if (matchedOn.length) out.push({ clientId: client.id, name: client.name, tier: client.tier, mrr: client.mrr, matchedOn })
  }
  return out.sort((a, b) => b.matchedOn.length - a.matchedOn.length || a.clientId - b.clientId)
}

export interface AcceptedProposalSummary { source: "proposal_tracking" | "sales_proposal"; packageType: string; selectedServices: string | null; buildPrice: number; retainerPrice: number }

interface SnapshotInput {
  prospect: Record<string, unknown> & { id: number }
  activities: Array<{ type: string; direction: string; subject: string | null; outcome: string | null; createdAt: Date }>
  proposalTrackings: Array<{ packageType: string; quotedAmount: number; monthlyRetainerAmount: number; status: string; sentAt: Date | null; acceptedAt: Date | null }>
  salesProposals: Array<{ status: string; selectedServices: string | null; buildPrice: number; retainerPrice: number; packageType?: string | null }>
  leadScore: { id: number; score: number } | null
}

export interface OpportunitySnapshot {
  capturedAt: string
  prospect: Record<string, unknown>
  outreach: { count: number; lastActivities: Array<{ type: string; direction: string; subject: string | null; outcome: string | null; createdAt: string }> }
  proposalTrackings: Array<{ packageType: string; quotedAmount: number; monthlyRetainerAmount: number; status: string; sentAt: string | null; acceptedAt: string | null }>
  acceptedProposal: AcceptedProposalSummary | null
  leadScore: { snapshotId: number; score: number } | null
}

function iso(v: Date | null | undefined) { return v ? new Date(v).toISOString() : null }

function resolveAccepted(input: SnapshotInput): AcceptedProposalSummary | null {
  const t = input.proposalTrackings.find((r) => r.status === "accepted")
  if (t) return { source: "proposal_tracking", packageType: t.packageType, selectedServices: null, buildPrice: t.quotedAmount, retainerPrice: t.monthlyRetainerAmount }
  const p = input.salesProposals.find((r) => r.status === "accepted")
  if (p) return { source: "sales_proposal", packageType: p.packageType ?? "custom", selectedServices: p.selectedServices, buildPrice: p.buildPrice, retainerPrice: p.retainerPrice }
  return null
}

export function buildOpportunitySnapshot(input: SnapshotInput): OpportunitySnapshot {
  return {
    capturedAt: new Date().toISOString(),
    prospect: { ...input.prospect },
    outreach: {
      count: input.activities.length,
      lastActivities: input.activities.slice(0, 50).map((a) => ({ type: a.type, direction: a.direction, subject: a.subject, outcome: a.outcome, createdAt: new Date(a.createdAt).toISOString() })),
    },
    proposalTrackings: input.proposalTrackings.map((r) => ({ packageType: r.packageType, quotedAmount: r.quotedAmount, monthlyRetainerAmount: r.monthlyRetainerAmount, status: r.status, sentAt: iso(r.sentAt), acceptedAt: iso(r.acceptedAt) })),
    acceptedProposal: resolveAccepted(input),
    leadScore: input.leadScore ? { snapshotId: input.leadScore.id, score: input.leadScore.score } : null,
  }
}

export interface ConversionWarning { code: "not_won" | "already_converted" | "dedupe_candidates" | "no_accepted_proposal"; message: string; blocksExecute: boolean }

interface PlanInput extends SnapshotInput {
  matchCandidates: ClientMatchCandidate[]
  existingConversionId: number | null
}

export interface ConversionPlan {
  prospectId: number
  alreadyConverted: boolean
  warnings: ConversionWarning[]
  defaults: { clientName: string; tier: ClientServiceTier; mrr: number; invoiceClientCode: string; projectName: string; onboardingTasks: Array<{ title: string }> }
  matchCandidates: ClientMatchCandidate[]
  acceptedProposal: AcceptedProposalSummary | null
  existingConversionId: number | null
}

export function buildConversionPlan(input: PlanInput): ConversionPlan {
  const p = input.prospect as Record<string, unknown> & { id: number; businessName: string; stage: string; estimatedMonthlyRetainer: number }
  const accepted = resolveAccepted(input)
  const mrr = accepted ? accepted.retainerPrice : p.estimatedMonthlyRetainer
  const packageLabel = accepted ? accepted.packageType : "Engagement"

  const warnings: ConversionWarning[] = []
  if (p.stage !== "won") warnings.push({ code: "not_won", message: "This opportunity is not marked Won. Move it to Won before converting.", blocksExecute: true })
  if (input.existingConversionId) warnings.push({ code: "already_converted", message: "This opportunity has already been converted.", blocksExecute: false })
  if (input.matchCandidates.length) warnings.push({ code: "dedupe_candidates", message: `Found ${input.matchCandidates.length} existing client(s) that may already represent this business.`, blocksExecute: false })
  if (!accepted) warnings.push({ code: "no_accepted_proposal", message: "No accepted proposal found; tier and MRR defaults come from the prospect estimates.", blocksExecute: false })

  return {
    prospectId: p.id,
    alreadyConverted: Boolean(input.existingConversionId),
    warnings,
    defaults: {
      clientName: p.businessName,
      tier: deriveTier(mrr),
      mrr,
      invoiceClientCode: suggestInvoiceClientCode(p.businessName),
      projectName: `${p.businessName} — ${packageLabel}`,
      onboardingTasks: defaultOnboardingTasks(),
    },
    matchCandidates: input.matchCandidates,
    acceptedProposal: accepted,
    existingConversionId: input.existingConversionId,
  }
}
