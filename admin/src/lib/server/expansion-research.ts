import "server-only"
import { randomUUID } from "node:crypto"
import { sql, type SQL } from "drizzle-orm"
import { db, type AdminDatabaseTransaction } from "@/lib/db"
import { type AdminRole } from "@/lib/admin-users"
import { hasCapability } from "@/lib/rbac"
import { ExpansionError, prospectDomain } from "@/lib/expansion"
import { marketGate, matchExclusivity, normaliseCountry } from "@/lib/expansion-gates"
import { safeDbMessage } from "@/lib/db-errors"
import { requireCapability } from "./rbac"
import { activeExclusivities, areaPathFor, aliasKey, assertSectorExists } from "./expansion"

/*
 * Researched prospect allocation (checkpoint 5).
 *
 * A candidate is founder-held research about a business found from a public source. It is NOT a lead, an enquiry or an interested
 * customer, and nothing in this module contacts anyone. Allocation creates (or revives) the canonical `prospects` row and
 * `expansion_opportunities` row, so the partner continues in the one existing CRM workflow.
 *
 * Lock order (LOCK-HIERARCHY.md): admin_users (share) -> expansion_partners (update, ascending id when two) -> advisory 621908148
 * (prospect admission) -> advisory 7102 (market/exclusivity, shared) -> candidate row -> opportunity row. Every gate is re-evaluated
 * under those locks, so a suppression, market change or exclusivity committed first is always seen.
 */
type Row = Record<string, unknown>
type Executor = Pick<AdminDatabaseTransaction, "execute">
type Actor = Awaited<ReturnType<typeof requireCapability>>
export class ResearchError extends ExpansionError { constructor(message: string, status = 400) { super(message, status); this.name = "ResearchError" } }
const rows = async (tx: Executor, query: SQL): Promise<Row[]> => (await tx.execute(query)).rows as Row[]
const conflict = (message: string): never => { throw new ResearchError(message, 409) }
const uuid = (value: unknown) => { if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new ResearchError("A valid record identifier is required."); return value.toLowerCase() }
const text = (value: unknown, label: string, max = 2000, min = 1) => { if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) throw new ResearchError(`${label} is required (maximum ${max} characters).`); return value.trim() }
const optional = (value: unknown, label: string, max = 2000) => (value === undefined || value === null || value === "" ? null : text(value, label, max))
const dbMessage = (error: unknown, fallback: string) => safeDbMessage(error, fallback)
const audit = (tx: Executor, actorId: string, entity: string, action: string, details: unknown) =>
  tx.execute(sql`insert into expansion_audit(actor_id,entity_id,action,details) values(${actorId},${entity},${action},${JSON.stringify(details)}::jsonb)`)
const event = (tx: Executor, candidateId: string, name: string, actorId: string, extra: { partnerId?: string | null; fromPartnerId?: string | null; opportunityId?: string | null; note?: string | null } = {}) =>
  tx.execute(sql`insert into expansion_candidate_events(id,candidate_id,event,actor_id,partner_id,from_partner_id,opportunity_id,note) values(${randomUUID()},${candidateId},${name},${actorId},${extra.partnerId ?? null},${extra.fromPartnerId ?? null},${extra.opportunityId ?? null},${extra.note ?? null})`)

async function founderGuard(tx: Executor, actor: Actor) {
  const [user] = await rows(tx, sql`select role::text,active,session_version from admin_users where id=${actor.id} for share`)
  if (!user?.active || user.session_version !== actor.sessionVersion || !hasCapability(user.role as AdminRole, "expansion.manage")) throw new ResearchError("Founder authority was revoked.", 403)
}
/** Lock one or two active partners in the hierarchy order: every admin_users row first, then every partner row, ascending id. */
async function lockActivePartners(tx: Executor, ids: string[], inactiveOk: string[] = []) {
  const ordered = [...new Set(ids)].sort()
  const users: Record<string, string> = {}
  for (const id of ordered) {
    const [owner] = await rows(tx, sql`select user_id from expansion_partners where id=${id}`)
    if (!owner) throw new ResearchError("Partner not found.", 404)
    users[id] = String(owner.user_id)
  }
  for (const id of [...ordered].sort((a, b) => users[a].localeCompare(users[b]))) await tx.execute(sql`select id from admin_users where id=${users[id]} for share`)
  for (const id of ordered) {
    const [partner] = inactiveOk.includes(id)
      ? await rows(tx, sql`select id from expansion_partners where id=${id} for update`)
      : await rows(tx, sql`select p.id from expansion_partners p join admin_users u on u.id=p.user_id where p.id=${id} and p.activated_at is not null and u.active=true and u.role::text='independent_partner' for update of p`)
    if (!partner) throw new ResearchError("That partner is not active, so nothing can be allocated to them.", 409)
  }
}

export interface CandidateChecks {
  existingClient: boolean; existingProspect: boolean; suppressed: boolean
  market: "approved" | "not_approved" | "unknown"
  exclusivity: "clear" | "cleared_by_founder" | "review_required" | "restricted"
  unresolvedExclusivityIds: string[]
  screening: string
  blockers: string[]
}
const norm = (v: unknown) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "")
/** Every gate, evaluated in the caller's transaction. The caller holds the locks that make this authoritative. */
async function evaluate(tx: Executor, cand: Row): Promise<CandidateChecks> {
  const id = String(cand.id), name = String(cand.business_name), domain = String(cand.normalized_domain)
  const own = (await rows(tx, sql`select prospect_id from expansion_opportunities where research_candidate_id=${id}`))[0]
  const ownProspect = own ? Number(own.prospect_id) : -1
  const existingClient = (await rows(tx, sql`select id from clients where lower(regexp_replace(name,'[^a-zA-Z0-9]','','g'))=${norm(name)} limit 1`)).length > 0
  const existingProspect = (await rows(tx, sql`select id from prospects where id<>${ownProspect} and id not in (select prospect_id from expansion_opportunities where domain_released_at is not null) and (lower(regexp_replace(business_name,'[^a-zA-Z0-9]','','g'))=${norm(name)} or lower(regexp_replace(regexp_replace(coalesce(website_url,''),'^https?://(www\.)?','','i'),'/.*$',''))=${domain})
    union all select o.prospect_id from expansion_opportunities o where o.normalized_domain=${domain} and o.domain_released_at is null and o.research_candidate_id is distinct from ${id}
    union all select 0 from expansion_research_candidates c where c.id<>${id} and c.status<>'excluded' and (c.normalized_domain=${domain} or lower(regexp_replace(c.business_name,'[^a-zA-Z0-9]','','g'))=${norm(name)}) limit 1`)).length > 0
  const suppressed = (await rows(tx, sql`select 1 from expansion_suppressions where normalized_domain=${domain}`)).length > 0
  const market = (await rows(tx, sql`select status,plan_keys from expansion_markets where country_code=${String(cand.country)} for share`))[0] as { status: string; plan_keys: string[] } | undefined
  const marketResult = marketGate(String(cand.country), market, "*")
  // Exclusivity: canonical sector id, else a founder-approved alias of the industry wording. Never a missing shared word.
  let sectorId = cand.sector_id ? String(cand.sector_id) : null
  if (!sectorId && cand.industry) { const hit = (await rows(tx, sql`select sector_id from expansion_sector_aliases where alias=${aliasKey(cand.industry)}`))[0]; sectorId = hit ? String(hit.sector_id) : null }
  const unresolved: string[] = []; let status: CandidateChecks["exclusivity"] = "clear", clearedAny = false
  for (const ex of await activeExclusivities(tx as AdminDatabaseTransaction)) {
    const match = matchExclusivity({ clientId: null, sector: (cand.industry as string | null) ?? null, area: ((cand.area as string | null) || (cand.region as string | null)) ?? null, sectorId, areaPath: await areaPathFor(tx as AdminDatabaseTransaction, (cand.area as string | null) || (cand.region as string | null)), areaVerified: true }, { clientId: Number(ex.client_id), sector: String(ex.sector), area: String(ex.area), sectorId: (ex.sector_id as string | null) ?? null, areaPath: await areaPathFor(tx as AdminDatabaseTransaction, ex.area) })
    if (match === "none") continue
    const cleared = (await rows(tx, sql`select 1 from expansion_candidate_exclusivity_decisions where candidate_id=${id} and exclusivity_id=${String(ex.id)}`)).length > 0
    if (cleared && match === "review") { clearedAny = true; continue }
    unresolved.push(String(ex.id)); status = match === "restricted" ? "restricted" : status === "restricted" ? "restricted" : "review_required"
  }
  if (status === "clear" && clearedAny) status = "cleared_by_founder"
  const blockers: string[] = []
  if (existingClient) blockers.push("The business matches an existing ScaleSmiths client.")
  if (existingProspect) blockers.push("The business matches an existing prospect, partner registration or other candidate.")
  if (suppressed) blockers.push("The business domain is on the suppression list.")
  if (marketResult !== "approved") blockers.push(marketResult === "unknown" ? "No market country is set." : "The market is not approved for active sales.")
  if (status === "review_required") blockers.push("An exclusivity review is required before this can proceed.")
  if (status === "restricted") blockers.push("A confirmed exclusivity restriction applies.")
  if (cand.screening_status !== "evidenced") blockers.push("Marketing screening evidence has not been recorded.")
  return { existingClient, existingProspect, suppressed, market: marketResult, exclusivity: status, unresolvedExclusivityIds: unresolved, screening: String(cand.screening_status), blockers }
}

type CandidateInput = { businessName?: unknown; website?: unknown; industry?: unknown; sectorId?: unknown; country?: unknown; region?: unknown; area?: unknown; publicSource?: unknown; researchedOn?: unknown; partnerNotes?: unknown; internalNotes?: unknown }
async function parseCandidate(tx: Executor, input: CandidateInput) {
  const name = text(input.businessName, "Business name", 200, 2)
  const domain = prospectDomain(input.website)
  let country: string | null = null
  try { country = normaliseCountry(input.country) } catch { throw new ResearchError("Use a two-letter ISO country code.") }
  if (!country) throw new ResearchError("A country is required.")
  const researchedOn = text(input.researchedOn, "Research date", 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(researchedOn) || new Date(`${researchedOn}T00:00:00Z`).toISOString().slice(0, 10) !== researchedOn) throw new ResearchError("Enter a real research date.")
  if (researchedOn > new Date().toISOString().slice(0, 10)) throw new ResearchError("The research date cannot be in the future.")
  let sectorId: string | null = null
  try { sectorId = (await assertSectorExists(tx as AdminDatabaseTransaction, input.sectorId)) as string | null } catch (e) { throw e instanceof ExpansionError ? new ResearchError(e.message, e.status) : e }
  return { name, domain, country, researchedOn, sectorId,
    industry: optional(input.industry, "Industry", 120), region: optional(input.region, "Region", 120), area: optional(input.area, "Area", 120),
    publicSource: text(input.publicSource, "Public source", 500, 3), partnerNotes: optional(input.partnerNotes, "Notes for the partner", 3000), internalNotes: optional(input.internalNotes, "Internal notes", 3000) }
}

export async function createCandidate(input: CandidateInput) {
  const actor = await requireCapability("expansion.manage")
  return db.transaction(async (tx) => {
    await founderGuard(tx, actor)
    const c = await parseCandidate(tx, input)
    const id = randomUUID()
    await tx.execute(sql`select pg_advisory_xact_lock(621908148)`)
    try {
      await tx.execute(sql`insert into expansion_research_candidates(id,business_name,website_url,normalized_domain,industry,sector_id,country,region,area,public_source,researched_on,partner_notes,internal_notes,created_by)
        values(${id},${c.name},${`https://${c.domain}`},${c.domain},${c.industry},${c.sectorId},${c.country},${c.region},${c.area},${c.publicSource},${c.researchedOn},${c.partnerNotes},${c.internalNotes},${actor.id})`)
    } catch (error) { throw new ResearchError(dbMessage(error, "That candidate could not be recorded."), 409) }
    await event(tx, id, "created", actor.id)
    await audit(tx, actor.id, id, "candidate_created", { domain: c.domain })
    return { id }
  })
}

export async function editCandidate(input: CandidateInput & { candidateId: string }) {
  const actor = await requireCapability("expansion.manage"), id = uuid(input.candidateId)
  return db.transaction(async (tx) => {
    await founderGuard(tx, actor)
    const c = await parseCandidate(tx, input)
    await tx.execute(sql`select pg_advisory_xact_lock(621908148)`)
    const [cand] = await rows(tx, sql`select status from expansion_research_candidates where id=${id} for update`)
    if (!cand) throw new ResearchError("Candidate not found.", 404)
    if (!["draft", "eligible"].includes(String(cand.status))) conflict("Only a draft or eligible candidate can be edited. Release an allocated one first.")
    // Once a prospect exists, or a founder has cleared an exclusivity for these facts, the facts are fixed: exclude and record a new candidate instead.
    if ((await rows(tx, sql`select 1 from expansion_opportunities where research_candidate_id=${id}`))[0] || (await rows(tx, sql`select 1 from expansion_candidate_exclusivity_decisions where candidate_id=${id}`))[0])
      conflict("This candidate has already been allocated or reviewed, so its facts are fixed. Exclude it and record a new candidate if something was wrong.")
    try {
      // Facts changed: every earlier check and screening decision is stale, so the candidate returns to draft.
      await tx.execute(sql`update expansion_research_candidates set business_name=${c.name},website_url=${`https://${c.domain}`},normalized_domain=${c.domain},industry=${c.industry},sector_id=${c.sectorId},country=${c.country},region=${c.region},area=${c.area},public_source=${c.publicSource},researched_on=${c.researchedOn},partner_notes=${c.partnerNotes},internal_notes=${c.internalNotes},
        status='draft',screening_status='pending',screening_evidence=null,screening_by=null,screening_at=null,updated_at=now() where id=${id}`)
    } catch (error) { throw new ResearchError(dbMessage(error, "That change is not permitted."), 409) }
    await event(tx, id, "edited", actor.id)
    return { id }
  })
}

export async function checkCandidate(input: { candidateId: string }) {
  const actor = await requireCapability("expansion.manage"), id = uuid(input.candidateId)
  return db.transaction(async (tx) => {
    await founderGuard(tx, actor)
    await tx.execute(sql`select pg_advisory_xact_lock(621908148)`)
    await tx.execute(sql`select pg_advisory_xact_lock_shared(7102)`)
    const [cand] = await rows(tx, sql`select * from expansion_research_candidates where id=${id}`)
    if (!cand) throw new ResearchError("Candidate not found.", 404)
    const checks = await evaluate(tx, cand)
    await event(tx, id, "checked", actor.id, { note: checks.blockers.join(" ") || "No blockers." })
    return { id, checks }
  })
}

/** Screening is a founder's evidenced judgement. It is never inferred, defaulted or completed automatically. */
export async function recordScreening(input: { candidateId: string; outcome: string; evidence: string }) {
  const actor = await requireCapability("expansion.manage"), id = uuid(input.candidateId)
  if (!["evidenced", "failed"].includes(input.outcome)) throw new ResearchError("Choose evidenced or failed.")
  const evidence = text(input.evidence, "Screening evidence", 3000, 10)
  return db.transaction(async (tx) => {
    await founderGuard(tx, actor)
    const [cand] = await rows(tx, sql`select status from expansion_research_candidates where id=${id} for update`)
    if (!cand) throw new ResearchError("Candidate not found.", 404)
    if (cand.status === "allocated" || cand.status === "excluded") conflict("Screening cannot change once a candidate is allocated or excluded.")
    // A failed screening withdraws eligibility; the stored status check requires evidence for eligible candidates.
    await tx.execute(sql`update expansion_research_candidates set screening_status=${input.outcome},screening_evidence=${evidence},screening_by=${actor.id},screening_at=now(),status=case when ${input.outcome}='failed' then 'draft' else status end,updated_at=now() where id=${id}`)
    await event(tx, id, "screening_recorded", actor.id, { note: input.outcome })
    return { id, outcome: input.outcome }
  })
}

export async function clearCandidateExclusivity(input: { candidateId: string; exclusivityId: string; reference: string }) {
  const actor = await requireCapability("expansion.manage"), id = uuid(input.candidateId), exId = uuid(input.exclusivityId)
  const reference = text(input.reference, "Decision evidence and reference", 1000, 3)
  return db.transaction(async (tx) => {
    await founderGuard(tx, actor)
    await tx.execute(sql`select pg_advisory_xact_lock(7102)`)
    const [cand] = await rows(tx, sql`select * from expansion_research_candidates where id=${id} for update`)
    if (!cand) throw new ResearchError("Candidate not found.", 404)
    if (["allocated", "excluded"].includes(String(cand.status))) conflict("This candidate can no longer be reviewed.")
    const checks = await evaluate(tx, cand)
    if (!checks.unresolvedExclusivityIds.includes(exId)) conflict("There is no unresolved review for that exclusivity.")
    if (checks.exclusivity === "restricted") conflict("A confirmed restriction cannot be cleared for a candidate; exclude the candidate instead.")
    await tx.execute(sql`insert into expansion_candidate_exclusivity_decisions(id,candidate_id,exclusivity_id,reference,decided_by) values(${randomUUID()},${id},${exId},${reference},${actor.id}) on conflict do nothing`)
    await event(tx, id, "exclusivity_cleared", actor.id, { note: "Review-level match cleared by a founder." })
    return { id }
  })
}

export async function markCandidateEligible(input: { candidateId: string }) {
  const actor = await requireCapability("expansion.manage"), id = uuid(input.candidateId)
  return db.transaction(async (tx) => {
    await founderGuard(tx, actor)
    await tx.execute(sql`select pg_advisory_xact_lock(621908148)`)
    await tx.execute(sql`select pg_advisory_xact_lock_shared(7102)`)
    const [cand] = await rows(tx, sql`select * from expansion_research_candidates where id=${id} for update`)
    if (!cand) throw new ResearchError("Candidate not found.", 404)
    if (cand.status === "eligible") return { id, replayed: true }
    if (cand.status !== "draft") conflict("Only a draft candidate can be marked eligible.")
    const checks = await evaluate(tx, cand)
    if (checks.blockers.length) conflict(`Not eligible yet: ${checks.blockers.join(" ")}`)
    try { await tx.execute(sql`update expansion_research_candidates set status='eligible',updated_at=now() where id=${id}`) } catch (error) { throw new ResearchError(dbMessage(error, "That change is not permitted."), 409) }
    await event(tx, id, "marked_eligible", actor.id)
    return { id, replayed: false }
  })
}

export async function excludeCandidate(input: { candidateId: string; reason: string }) {
  const actor = await requireCapability("expansion.manage"), id = uuid(input.candidateId)
  const reason = text(input.reason, "Reason for exclusion", 1000, 3)
  return db.transaction(async (tx) => {
    await founderGuard(tx, actor)
    const [source] = await rows(tx, sql`select allocated_partner_id from expansion_research_candidates where id=${id}`)
    if (!source) throw new ResearchError("Candidate not found.", 404)
    if (source.allocated_partner_id) conflict("Release this candidate from its partner before excluding it.")
    const [cand] = await rows(tx, sql`select status from expansion_research_candidates where id=${id} for update`)
    if (cand.status === "allocated") conflict("Release this candidate from its partner before excluding it.")
    if (cand.status === "excluded") return { id, replayed: true }
    await tx.execute(sql`update expansion_research_candidates set status='excluded',exclusion_reason=${reason},updated_at=now() where id=${id}`)
    await event(tx, id, "excluded", actor.id, { note: reason })
    return { id, replayed: false }
  })
}

type Outcome = { id: string; opportunityId?: string; refused?: string[] }
/** Moves a candidate to a partner. `from` is set for a reassignment. The caller has already read the expected current holder. */
async function place(tx: AdminDatabaseTransaction, actor: Actor, id: string, partnerId: string, from: string | null, note: string | null): Promise<Outcome> {
  await lockActivePartners(tx, from ? [from, partnerId] : [partnerId], from ? [from] : [])
  await tx.execute(sql`select pg_advisory_xact_lock(621908148)`)
  // The opportunity row is taken BEFORE advisory lock 7102, matching every other path (classify, decide, partner progression): row, then 7102.
  const existing = (await rows(tx, sql`select id,prospect_id,status from expansion_opportunities where research_candidate_id=${id} for update`))[0]
  await tx.execute(sql`select pg_advisory_xact_lock_shared(7102)`)
  const [cand] = await rows(tx, sql`select * from expansion_research_candidates where id=${id} for update`)
  if (!cand) throw new ResearchError("Candidate not found.", 404)
  if (from) { if (cand.status !== "allocated" || String(cand.allocated_partner_id) !== from) conflict("This prospect has changed hands or been released. Refresh and try again.") }
  else if (cand.status === "allocated") conflict("This candidate has already been allocated.")
  else if (cand.status !== "eligible") conflict("Only an eligible candidate can be allocated.")
  if (from && from === partnerId) conflict("Choose a different partner.")
  const checks = await evaluate(tx, cand)
  if (checks.blockers.length) {
    // Eligibility has lapsed since it was granted. Withdraw it so nothing proceeds on a stale decision, and report why.
    if (!from) { await tx.execute(sql`update expansion_research_candidates set status='draft',updated_at=now() where id=${id}`); await event(tx, id, "checked", actor.id, { note: `Eligibility withdrawn at allocation: ${checks.blockers.join(" ")}` }) }
    return { id, refused: checks.blockers }
  }
  // The receiving partner's operating market must be approved too, or the prospect would be stuck on arrival.
  const [target] = await rows(tx, sql`select user_id,operating_country from expansion_partners where id=${partnerId}`)
  const targetMarket = (await rows(tx, sql`select status,plan_keys from expansion_markets where country_code=${String(target.operating_country)} for share`))[0] as { status: string; plan_keys: string[] } | undefined
  if (marketGate(String(target.operating_country), targetMarket, "*") !== "approved") return { id, refused: ["The receiving partner's operating market is not approved."] }
  await tx.execute(sql`select set_config('app.opportunity_reassign','verified',true)`)
  const owner = target
  let opportunityId: string
  try {
    if (existing) {
      opportunityId = String(existing.id)
      await tx.execute(sql`update expansion_opportunities set partner_id=${partnerId},status='registered',updated_at=now() where id=${opportunityId}`)
      await tx.execute(sql`update prospects set owner_user_id=${String(owner.user_id)},stage='found',updated_at=now() where id=${Number(existing.prospect_id)}`)
    } else {
      const location = ((cand.area as string | null) || (cand.region as string | null)) ?? null
      const [prospect] = await rows(tx, sql`insert into prospects(business_name,website_url,location,industry,owner_user_id,source) values(${String(cand.business_name)},${String(cand.website_url)},${location},${(cand.industry as string | null) ?? null},${String(owner.user_id)},'other') returning id`)
      opportunityId = randomUUID()
      await tx.execute(sql`insert into expansion_opportunities(id,partner_id,prospect_id,normalized_domain,customer_country,customer_country_confirmed_by,sector_id,sector_classified_by,research_candidate_id)
        values(${opportunityId},${partnerId},${Number(prospect.id)},${String(cand.normalized_domain)},${String(cand.country)},${actor.id},${(cand.sector_id as string | null) ?? null},${cand.sector_id ? actor.id : null},${id})`)
    }
    // Carry the founder's candidate-level exclusivity decisions to the opportunity so acceptance sees the same position.
    await tx.execute(sql`insert into expansion_exclusivity_decisions(id,opportunity_id,exclusivity_id,decision,reference,decided_by)
      select gen_random_uuid(),${opportunityId},d.exclusivity_id,'cleared',d.reference,d.decided_by from expansion_candidate_exclusivity_decisions d where d.candidate_id=${id} on conflict do nothing`)
    await tx.execute(sql`update expansion_research_candidates set status='allocated',allocated_partner_id=${partnerId},allocated_at=now(),updated_at=now() where id=${id}`)
  } catch (error) { if (error instanceof ExpansionError) throw error; throw new ResearchError(dbMessage(error, "This allocation is not permitted."), 409) }
  await event(tx, id, from ? "reassigned" : "allocated", actor.id, { partnerId, fromPartnerId: from, opportunityId, note })
  await audit(tx, actor.id, id, from ? "candidate_reassigned" : "candidate_allocated", { partnerId, from, opportunityId })
  return { id, opportunityId }
}
const refusal = (o: Outcome) => { if (o.refused) throw new ResearchError(`Allocation refused: ${o.refused.join(" ")}`, 409); return o }

export async function allocateCandidate(input: { candidateId: string; partnerId: string }) {
  const actor = await requireCapability("expansion.manage"), id = uuid(input.candidateId), partnerId = uuid(input.partnerId)
  return refusal(await db.transaction(async (tx) => { await founderGuard(tx, actor); return place(tx, actor, id, partnerId, null, null) }))
}

async function holder(tx: Executor, id: string) {
  const [cand] = await rows(tx, sql`select status,allocated_partner_id from expansion_research_candidates where id=${id}`)
  if (!cand) throw new ResearchError("Candidate not found.", 404)
  if (cand.status !== "allocated" || !cand.allocated_partner_id) conflict("This candidate is not allocated to a partner.")
  return String(cand.allocated_partner_id)
}
export async function reassignCandidate(input: { candidateId: string; partnerId: string; note: string }) {
  const actor = await requireCapability("expansion.manage"), id = uuid(input.candidateId), partnerId = uuid(input.partnerId)
  const note = text(input.note, "Reason for reassignment", 1000, 3)
  return refusal(await db.transaction(async (tx) => { await founderGuard(tx, actor); return place(tx, actor, id, partnerId, await holder(tx, id), note) }))
}

export async function releaseCandidate(input: { candidateId: string; note: string }) {
  const actor = await requireCapability("expansion.manage"), id = uuid(input.candidateId)
  const note = text(input.note, "Reason for release", 1000, 3)
  return db.transaction(async (tx) => {
    await founderGuard(tx, actor)
    const from = await holder(tx, id)
    // The holder may be inactive by now; releasing from a revoked partner must still work, so the lock is taken without the active check.
    const [owner] = await rows(tx, sql`select user_id from expansion_partners where id=${from}`)
    await tx.execute(sql`select id from admin_users where id=${String(owner.user_id)} for share`)
    await tx.execute(sql`select id from expansion_partners where id=${from} for update`)
    // Opportunity row before candidate row, the same order as allocation (an independent review found these inverted, a deadlock risk).
    const [opp] = await rows(tx, sql`select id,prospect_id,status from expansion_opportunities where research_candidate_id=${id} for update`)
    const [cand] = await rows(tx, sql`select status,allocated_partner_id from expansion_research_candidates where id=${id} for update`)
    if (cand.status !== "allocated" || String(cand.allocated_partner_id) !== from) conflict("This prospect has changed hands or been released. Refresh and try again.")
    if (!opp || !["registered", "withdrawn"].includes(String(opp.status))) conflict("The partner has already worked on this prospect, so it cannot be released.")
    await tx.execute(sql`select set_config('app.opportunity_reassign','verified',true)`)
    try {
      await tx.execute(sql`update expansion_opportunities set status='withdrawn',updated_at=now() where id=${String(opp.id)}`)
      await tx.execute(sql`update prospects set owner_user_id=${actor.id},stage='found',updated_at=now() where id=${Number(opp.prospect_id)}`)
      await tx.execute(sql`update expansion_research_candidates set status='eligible',allocated_partner_id=null,allocated_at=null,updated_at=now() where id=${id}`)
    } catch (error) { throw new ResearchError(dbMessage(error, "This release is not permitted."), 409) }
    await event(tx, id, "released", actor.id, { fromPartnerId: from, opportunityId: String(opp.id), note })
    await audit(tx, actor.id, id, "candidate_released", { from })
    return { id }
  })
}

/**
 * Founder-only, audited release of a domain still held by the withdrawn prospect of an EXCLUDED candidate. Nothing is deleted: the opportunity,
 * its prospect, the partner history and the candidate history stay. Suppression and existing-client checks are unaffected, and the database
 * refuses the release for anything that was worked, contracted or is not a withdrawn research prospect.
 */
export async function releaseCandidateDomain(input: { candidateId: string; reason: string }) {
  const actor = await requireCapability("expansion.manage"), id = uuid(input.candidateId)
  const reason = text(input.reason, "Reason for releasing the domain", 1000, 5)
  return db.transaction(async (tx) => {
    await founderGuard(tx, actor)
    await tx.execute(sql`select pg_advisory_xact_lock(621908148)`)
    // Opportunity row before candidate row, as everywhere else.
    const [opp] = await rows(tx, sql`select id,domain_released_at from expansion_opportunities where research_candidate_id=${id} for update`)
    const [cand] = await rows(tx, sql`select status from expansion_research_candidates where id=${id} for update`)
    if (!cand) throw new ResearchError("Candidate not found.", 404)
    if (cand.status !== "excluded") conflict("Exclude the candidate first. Only an excluded candidate's held domain can be released.")
    if (!opp) conflict("This candidate holds no domain.")
    if (opp.domain_released_at) return { id, replayed: true }
    try { await tx.execute(sql`update expansion_opportunities set domain_released_at=now(),domain_released_by=${actor.id},domain_release_reason=${reason} where id=${String(opp.id)}`) }
    catch (error) { throw new ResearchError(dbMessage(error, "This domain cannot be released."), 409) }
    await event(tx, id, "domain_released", actor.id, { opportunityId: String(opp.id), note: reason })
    await audit(tx, actor.id, id, "candidate_domain_released", { opportunityId: String(opp.id) })
    return { id, replayed: false }
  })
}

export async function getResearchAdmin() {
  const actor = await requireCapability("expansion.manage")
  return db.transaction(async (tx) => {
    await tx.execute(sql`set transaction isolation level repeatable read`)
    await founderGuard(tx, actor)
    const candidates = await rows(tx, sql`select c.id,c.business_name,c.website_url,c.normalized_domain,c.industry,c.sector_id,s.label sector_label,c.country,c.region,c.area,c.public_source,c.researched_on,c.partner_notes,c.internal_notes,c.status,c.screening_status,c.screening_evidence,
        c.allocated_partner_id,c.allocated_at,u.display_name partner_name,c.exclusion_reason,c.created_at from expansion_research_candidates c left join expansion_sectors s on s.id=c.sector_id
        left join expansion_partners p on p.id=c.allocated_partner_id left join admin_users u on u.id=p.user_id order by c.created_at desc limit 300`)
    const out: Row[] = []
    for (const c of candidates) out.push({ ...c, checks: ["excluded", "allocated"].includes(String(c.status)) ? null : await evaluate(tx, c) })
    const events = await rows(tx, sql`select e.candidate_id,e.event,e.note,e.created_at,a.display_name actor_name,pu.display_name partner_name,fu.display_name from_partner_name from expansion_candidate_events e join admin_users a on a.id=e.actor_id
        left join expansion_partners p on p.id=e.partner_id left join admin_users pu on pu.id=p.user_id left join expansion_partners f on f.id=e.from_partner_id left join admin_users fu on fu.id=f.user_id order by e.created_at desc limit 1000`)
    const partners = await rows(tx, sql`select p.id,u.display_name,(select count(*) from expansion_research_candidates c where c.allocated_partner_id=p.id)::int allocated from expansion_partners p join admin_users u on u.id=p.user_id where p.activated_at is not null and u.active and u.role::text='independent_partner' order by u.display_name`)
    return { candidates: out, events, partners }
  })
}
