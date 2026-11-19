import 'server-only'
import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { db, type AdminDatabaseTransaction } from '@/lib/db'
import { requireCapability } from './rbac'
import { issueInvitation } from './partner-invitations'
import { runApplicantRetention } from './expansion-retention'
import { ExpansionError, expansionText, expansionId, expansionInteger, prospectDomain, parseDiscovery, technicalReviewFlags, assertPartnerTransition, capacityPeriod } from '@/lib/expansion'
import { buildAcceptedTerms, COMMERCIAL_PLAN_KEYS, parseCommissionTerms, type CommercialPlanKey, type PlanRequest } from '@/lib/expansion-finance'
import { marketGate, matchExclusivity, normaliseCountry } from '@/lib/expansion-gates'
import { hasCapability, type Capability } from '@/lib/rbac'
import type { AdminRole } from '@/lib/admin-users'

type Input = Record<string, unknown>
type Row = Record<string, unknown>
async function audit(tx: AdminDatabaseTransaction, actor: string, entity: unknown, action: string, details: unknown = {}) {
  await tx.execute(sql`insert into expansion_audit(actor_id,entity_id,action,details) values(${actor},${String(entity)},${action},${JSON.stringify(details)}::jsonb)`)
}
type Actor = Awaited<ReturnType<typeof requireCapability>>
async function currentActor(tx: AdminDatabaseTransaction, actor: Actor, capability: Capability) {
  const result = await tx.execute(sql`select role,active,session_version from admin_users where id=${actor.id} for share`)
  const user = result.rows[0]
  if (!user?.active || user.session_version !== actor.sessionVersion || !hasCapability(user.role as AdminRole,capability)) throw new ExpansionError('Workspace authority was revoked.',403)
}
async function partner(tx: AdminDatabaseTransaction, actor: Actor) {
  await currentActor(tx,actor,'expansion.partner')
  const result = await tx.execute(sql`select p.id from expansion_partners p join admin_users u on u.id=p.user_id where p.user_id=${actor.id} and p.activated_at is not null and u.active=true and u.role='independent_partner'`)
  if (!result.rows[0]) throw new ExpansionError('An active partner account is required.',403)
  return String(result.rows[0].id)
}
async function opportunity(tx: AdminDatabaseTransaction, id: string, partnerId?: string) {
  const result = await tx.execute(sql`select * from expansion_opportunities where id=${id} ${partnerId ? sql`and partner_id=${partnerId}` : sql``} for update`)
  if (!result.rows[0]) throw new ExpansionError('Opportunity not found.',404)
  return result.rows[0] as Row
}
export const aliasKey = (value: unknown) => String(value ?? '').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim()
/** The prospect's canonical sector: the founder's classification, else a founder-approved alias of the industry the partner wrote. */
export async function effectiveSectorId(tx: AdminDatabaseTransaction, row: Row, industry: unknown): Promise<string | null> {
  if (row.sector_id) return String(row.sector_id)
  const key = aliasKey(industry)
  if (!key) return null
  const hit = (await tx.execute(sql`select sector_id from expansion_sector_aliases where alias=${key}`)).rows[0] as Row | undefined
  return hit ? String(hit.sector_id) : null
}
export async function assertSectorExists(tx: AdminDatabaseTransaction, sectorId: unknown) {
  if (sectorId === undefined || sectorId === null || sectorId === '') return null
  const id = expansionId(sectorId)
  if (!(await tx.execute(sql`select id from expansion_sectors where id=${id}`)).rows[0]) throw new ExpansionError('Choose a sector that has been defined.')
  return id
}
export async function activeExclusivities(tx: AdminDatabaseTransaction) {
  return (await tx.execute(sql`select id,client_id,sector,area,sector_id from expansion_exclusivities where status='active' and effective_from<=(now() at time zone 'Europe/London')::date and (effective_to is null or effective_to>(now() at time zone 'Europe/London')::date)`)).rows as Row[]
}
/** Conservative exclusivity outcome for one opportunity. Never discloses which customer or agreement is involved. */
async function exclusivityOutcome(tx: AdminDatabaseTransaction, row: Row, clientId?: number | null) {
  const facts = (await tx.execute(sql`select industry,location from prospects where id=${row.prospect_id}`)).rows[0] as Row | undefined
  const unresolved: string[] = []
  let status: 'clear'|'review_required'|'restricted'|'exception_approved' = 'clear', sawException = false
  for (const ex of await activeExclusivities(tx)) {
    const match = matchExclusivity({clientId: clientId ?? (row.client_id as number|null), sector: facts?.industry as string|null, area: facts?.location as string|null, sectorId: await effectiveSectorId(tx,row,facts?.industry)}, {clientId:Number(ex.client_id),sector:String(ex.sector),area:String(ex.area),sectorId:(ex.sector_id as string|null) ?? null})
    if (match === 'none') continue
    const decision = (await tx.execute(sql`select decision from expansion_exclusivity_decisions where opportunity_id=${String(row.id)} and exclusivity_id=${String(ex.id)}`)).rows[0] as Row | undefined
    if (decision && (decision.decision === 'exception_approved' || (match === 'review' && decision.decision === 'cleared'))) { sawException = sawException || decision.decision === 'exception_approved'; continue }
    unresolved.push(String(ex.id)); if (match === 'restricted') status = 'restricted'; else if (status !== 'restricted') status = 'review_required'
  }
  if (status === 'clear' && sawException) status = 'exception_approved'
  return { status, unresolved }
}
async function assertAcceptanceGates(tx: AdminDatabaseTransaction, row: Row, planKey: string, clientId: number) {
  // Shared with acceptance, exclusive for exclusivity changes: a restriction committed first is always seen.
  await tx.execute(sql`select pg_advisory_xact_lock_shared(7102)`)
  // A partner-supplied country counts only once a founder has confirmed it.
  const country = row.customer_country_confirmed_by ? ((row.customer_country as string | null) ?? null) : null
  const market = country ? (await tx.execute(sql`select status,plan_keys from expansion_markets where country_code=${country} for share`)).rows[0] as { status: string; plan_keys: string[] } | undefined : undefined
  if (marketGate(country, market, planKey) !== 'approved') throw new ExpansionError("This opportunity's customer market is not approved for this plan. Confirm the customer country and market eligibility first.",409)
  if ((await exclusivityOutcome(tx,row,clientId)).unresolved.length) throw new ExpansionError('An unresolved customer exclusivity review prevents acceptance. A founder must record a decision.',409)
}

/**
 * Commercial clearance for partner progression and founder scope approval. Fails closed on an unknown or unapproved customer market,
 * on an unapproved partner operating market, and on any unresolved exclusivity. For partners every failure is the SAME sentence, so the
 * response can never be used to probe which sectors, areas or customers are protected.
 */
const PENDING_CLEARANCE = 'This opportunity is awaiting commercial approval from a founder. You will be told when it can progress.'
async function assertCommercialClearance(tx: AdminDatabaseTransaction, row: Row, partnerId: string, audience: 'partner'|'founder') {
  await tx.execute(sql`select pg_advisory_xact_lock_shared(7102)`)
  const marketOf = async (country: string | null) => country ? (await tx.execute(sql`select status,plan_keys from expansion_markets where country_code=${country} for share`)).rows[0] as { status: string; plan_keys: string[] } | undefined : undefined
  const customerCountry = (row.customer_country as string | null) ?? null
  const operating = (await tx.execute(sql`select operating_country from expansion_partners where id=${partnerId}`)).rows[0]?.operating_country as string | undefined
  const customerOk = marketGate(customerCountry, await marketOf(customerCountry), '*') === 'approved'
  const operatingOk = marketGate(operating ?? null, await marketOf(operating ?? null), '*') === 'approved'
  const exclusivity = await exclusivityOutcome(tx,row)
  if (customerOk && operatingOk && exclusivity.unresolved.length === 0) return
  if (audience === 'partner') throw new ExpansionError(PENDING_CLEARANCE,409)
  const reasons = [!customerOk && "the customer market is unknown or not approved", !operatingOk && "the partner's operating market is not approved", exclusivity.unresolved.length > 0 && "an exclusivity review is unresolved"].filter(Boolean)
  throw new ExpansionError(`Scope cannot be approved: ${reasons.join(', ')}. Set the customer market and record the decisions first.`,409)
}
export async function partnerSnapshot() {
  const actor = await requireCapability('expansion.partner')
  return db.transaction(async tx => {
    const id = await partner(tx,actor)
    const opportunities = await tx.execute(sql`select o.id,o.status,o.discovery,o.scope,o.scope_version,o.created_at,p.business_name,p.website_url,p.contact_name,p.contact_email,p.next_follow_up_at,c.id contract_id,
        (rc.id is not null) allocated,rc.public_source research_source,rc.researched_on research_date,rc.partner_notes research_notes,rc.industry research_industry,rc.country research_country,rc.region research_region,rc.area research_area,rs.label research_sector
      from expansion_opportunities o join prospects p on p.id=o.prospect_id left join expansion_contracts c on c.opportunity_id=o.id
      left join expansion_research_candidates rc on rc.id=o.research_candidate_id left join expansion_sectors rs on rs.id=rc.sector_id
      where o.partner_id=${id} and (o.research_candidate_id is null or (rc.status='allocated' and rc.allocated_partner_id=o.partner_id)) order by o.created_at desc`)
    const resources = await tx.execute(sql`select id,title,category,version,audience,content,status,created_at from expansion_resources where status='published' and audience='partner' order by created_at desc`)
    const capacity = await tx.execute(sql`select c.period,greatest(0,c.available_hours-coalesce(sum(r.hours) filter(where r.status<>'released'),0))::integer remaining_hours from expansion_capacity c left join expansion_reservations r on r.period=c.period where c.period>=current_date-7 group by c.period order by c.period`)
    // Partners see only their own allowance and claim status; never customer identity or reviewer notes.
    const allowances = await tx.execute(sql`select p.period_start,p.period_end,p.allowance_count,p.permitted_fees_pence,
      (select count(*) from expansion_discount_reservations r where r.policy_id=p.id and r.status in ('reserved','consumed'))::integer used
      from expansion_discount_policies p where p.partner_id=${id} and p.period_end>current_date order by p.period_start`)
    const claims = await tx.execute(sql`select id,business_name,project_label,status,created_at from expansion_additional_claims where partner_id=${id} order by created_at desc`)
    return { partnerId:id, displayName:actor.displayName, opportunities:opportunities.rows, resources:resources.rows, capacity:capacity.rows, discountAllowances:allowances.rows, additionalClaims:claims.rows }
  })
}
export async function founderSnapshot() {
  const actor = await requireCapability('expansion.manage')
  return db.transaction(async tx=>{
  await currentActor(tx,actor,'expansion.manage')
  const [applications,partners,opportunities,capacity,resources,clients,planSettings,discountPolicies,claims,markets,exclusivities,sectors] = await Promise.all([
    tx.execute(sql`select * from partner_applications order by submitted_at desc limit 200`),
    tx.execute(sql`select p.id,p.user_id,p.agreement_version,p.activated_at,p.operating_country,u.display_name,u.email,u.active from expansion_partners p join admin_users u on u.id=p.user_id order by p.created_at desc`),
    tx.execute(sql`select o.*,p.business_name,u.display_name partner_name,c.id contract_id from expansion_opportunities o join prospects p on p.id=o.prospect_id join expansion_partners ep on ep.id=o.partner_id join admin_users u on u.id=ep.user_id left join expansion_contracts c on c.opportunity_id=o.id order by o.created_at desc limit 500`),
    tx.execute(sql`select c.*,coalesce(sum(r.hours) filter(where r.status<>'released'),0)::integer reserved_hours from expansion_capacity c left join expansion_reservations r on r.period=c.period group by c.period order by c.period`),
    tx.execute(sql`select * from expansion_resources order by created_at desc`),
    tx.execute(sql`select id,name from clients order by name`),
    tx.execute(sql`select plan_key,enabled,updated_at from expansion_plan_settings order by plan_key`),
    tx.execute(sql`select p.id,p.partner_id,u.display_name partner_name,p.period_start,p.period_end,p.allowance_count,p.permitted_fees_pence,p.approval_reference,(select count(*) from expansion_discount_reservations r where r.policy_id=p.id and r.status in ('reserved','consumed'))::integer used from expansion_discount_policies p join expansion_partners ep on ep.id=p.partner_id join admin_users u on u.id=ep.user_id order by p.period_end desc limit 100`),
    tx.execute(sql`select c.id,c.business_name,c.normalized_domain,c.project_label,c.contribution,c.status,c.created_at,u.display_name partner_name from expansion_additional_claims c join expansion_partners ep on ep.id=c.partner_id join admin_users u on u.id=ep.user_id order by (c.status='pending') desc,c.created_at desc limit 100`),
    tx.execute(sql`select country_code,country_name,status,plan_keys,legal_reviewed,accounting_reviewed,privacy_reviewed,operations_reviewed,approval_reference from expansion_markets order by country_code`),
    tx.execute(sql`select e.id,e.sector,e.area,e.contractual_reference,e.effective_from,e.effective_to,e.status,c.name client_name from expansion_exclusivities e join clients c on c.id=e.client_id order by e.status,e.created_at desc limit 200`),
    tx.execute(sql`select s.id,s.key,s.label,coalesce((select array_agg(a.alias order by a.alias) from expansion_sector_aliases a where a.sector_id=s.id),'{}') aliases from expansion_sectors s order by s.label`),
  ])
  const gates: Row = {}
  for (const o of opportunities.rows as Row[]) if (!['closed_lost','withdrawn','contract_accepted'].includes(String(o.status))) gates[String(o.id)] = (await exclusivityOutcome(tx,o)).status
  return { sectors:sectors.rows,markets:markets.rows,exclusivities:exclusivities.rows,exclusivityStatus:gates,discountPolicies:discountPolicies.rows,additionalClaims:claims.rows,planSettings:planSettings.rows,applications:applications.rows,partners:partners.rows,opportunities:opportunities.rows,capacity:capacity.rows,resources:resources.rows,clients:clients.rows }
  })
}
export async function partnerMutation(input: Input) {
  const actor = await requireCapability('expansion.partner')
  return db.transaction(async tx => {
    const partnerId = await partner(tx,actor)
    if (input.action === 'register') {
      const name = expansionText(input.businessName,'Business name',200)
      const domain = prospectDomain(input.website)
      const companyNumber = input.companyNumber ? expansionText(input.companyNumber,'Company number',20).replace(/\s/g,'').toUpperCase() : null
      if (companyNumber && !/^[A-Z0-9]{6,12}$/.test(companyNumber)) throw new ExpansionError('Invalid company registration number.')
      // Same lock used by this admission boundary, with canonical CRM checked in the transaction.
      await tx.execute(sql`select pg_advisory_xact_lock(621908148)`)
      const duplicate = await tx.execute(sql`select id from prospects where lower(regexp_replace(business_name,'[^a-zA-Z0-9]','','g'))=lower(regexp_replace(${name},'[^a-zA-Z0-9]','','g')) or lower(regexp_replace(regexp_replace(coalesce(website_url,''),'^https?://(www\.)?','','i'),'/.*$',''))=${domain} union all select id from clients where lower(regexp_replace(name,'[^a-zA-Z0-9]','','g'))=lower(regexp_replace(${name},'[^a-zA-Z0-9]','','g')) limit 1`)
      const suppressed = await tx.execute(sql`select normalized_domain from expansion_suppressions where normalized_domain=${domain}`)
      const contactEmail = input.contactEmail ? expansionText(input.contactEmail,'Contact email',254).toLowerCase() : null
      if (contactEmail && !/^\S+@\S+\.\S+$/.test(contactEmail)) throw new ExpansionError('Invalid contact email.')
      const contactSuppression = contactEmail ? await tx.execute(sql`select id from commercial_contacts where lower(email)=${contactEmail} and suppressed=true limit 1`) : {rows:[]}
      if (duplicate.rows.length || suppressed.rows.length || contactSuppression.rows.length) throw new ExpansionError('This business already has an existing ScaleSmiths relationship. Please contact commercial support if you believe this is incorrect.',409)
      const created = await tx.execute(sql`insert into prospects(business_name,website_url,contact_name,contact_email,location,industry,owner_user_id,source) values(${name},${`https://${domain}`},${input.contactName ? expansionText(input.contactName,'Contact name',120) : null},${contactEmail},${input.region ? expansionText(input.region,'Region',120) : null},${input.industry ? expansionText(input.industry,'Industry',120) : null},${actor.id},'referral') returning id`)
      const id = randomUUID()
      let country: string | null = null
      try { country = normaliseCountry(input.country) } catch { throw new ExpansionError('Use a two-letter ISO country code for the customer market.') }
      await tx.execute(sql`insert into expansion_opportunities(id,partner_id,prospect_id,normalized_domain,company_number,customer_country) values(${id},${partnerId},${created.rows[0].id},${domain},${companyNumber},${country})`)
      await audit(tx,actor.id,id,'prospect_registered',{domain})
      return {id}
    }
    if (input.action === 'request_additional') {
      const name = expansionText(input.businessName,'Business name',200)
      const domain = prospectDomain(input.website)
      const label = expansionText(input.projectLabel,'Project description',120)
      const contribution = expansionText(input.contribution,'Your documented contribution to this new opportunity',2000)
      const receipt = randomUUID()
      // The same acknowledgement is returned whether or not the business is an existing customer or already claimed.
      await tx.execute(sql`insert into expansion_additional_claims(id,partner_id,business_name,normalized_domain,project_label,contribution) values(${receipt},${partnerId},${name},${domain},${label},${contribution}) on conflict do nothing`)
      await audit(tx,actor.id,domain,'additional_business_requested',{label})
      return {id:receipt,received:true}
    }
    const id = expansionId(input.id)
    const row = await opportunity(tx,id,partnerId)
    if (input.action === 'stage') {
      const stage = assertPartnerTransition(String(row.status),input.status)
      // Leaving the pipeline is always allowed; anything that advances active selling needs commercial clearance.
      if (!['closed_lost','withdrawn'].includes(stage)) await assertCommercialClearance(tx,row,partnerId,'partner')
      await tx.execute(sql`update expansion_opportunities set status=${stage},updated_at=now() where id=${id}`)
      const canonicalStage = stage==='qualified' ? 'qualified' : stage==='contacted' ? 'contacted' : ['closed_lost','withdrawn'].includes(stage) ? 'lost' : null
      if (canonicalStage) await tx.execute(sql`update prospects set stage=${canonicalStage}::prospect_stage,updated_at=now() where id=${row.prospect_id}`)
      await audit(tx,actor.id,id,'stage_changed',{from:row.status,to:stage})
    } else if (input.action === 'discovery') {
      if (!['registered','contacted','discovery','qualified','more_information','bespoke_required','deferred'].includes(String(row.status))) throw new ExpansionError('This discovery is locked. Request a new review.',409)
      await assertCommercialClearance(tx,row,partnerId,'partner')
      const discovery = parseDiscovery(input.discovery)
      await tx.execute(sql`update expansion_opportunities set discovery=${JSON.stringify(discovery)}::jsonb,status='discovery',updated_at=now() where id=${id}`)
      await audit(tx,actor.id,id,'discovery_saved')
    } else if (input.action === 'submit_scope') {
      if (!['discovery','qualified','more_information','bespoke_required','deferred'].includes(String(row.status))) throw new ExpansionError('Complete discovery before submitting scope.',409)
      await assertCommercialClearance(tx,row,partnerId,'partner')
      const discovery = parseDiscovery(row.discovery)
      if (!discovery.objectives || !discovery.pages || !discovery.functionality || !discovery.budget || !discovery.timescale || !discovery.decisionProcess) throw new ExpansionError('Complete objectives, pages, functionality, budget, timescale and decision process.')
      const scope = {summary:expansionText(input.summary,'Scope summary',6000),technicalFlags:technicalReviewFlags(discovery)}
      await tx.execute(sql`update expansion_opportunities set scope=${JSON.stringify(scope)}::jsonb,scope_version=scope_version+1,status='scope_submitted',review_notes=null,updated_at=now() where id=${id}`)
      await tx.execute(sql`update prospects set stage='proposal_required',updated_at=now() where id=${row.prospect_id}`)
      await audit(tx,actor.id,id,'scope_submitted',scope)
    } else throw new ExpansionError('Unknown partner action.')
    return {id}
  })
}
export async function founderMutation(input: Input) {
  const actor = await requireCapability('expansion.manage')
  return db.transaction(async tx => {
    await currentActor(tx,actor,'expansion.manage')
    if (input.action === 'preview_applicant_retention' || input.action === 'purge_applicants' ||
        input.action === 'set_applicant_retention_hold' || input.action === 'release_applicant_retention_hold') {
      return runApplicantRetention(tx, actor.id, input)
    }
    if (input.action === 'review_application') {
      const id = expansionInteger(input.id,'application',1,2147483647)
      const statuses = ['under_review','conversation_arranged','assessment_in_progress','approved_in_principle','agreement_pending','onboarding','declined','withdrawn','archived']
      if (!statuses.includes(String(input.status))) throw new ExpansionError('Invalid recruitment state.')
      const current = await tx.execute(sql`select * from partner_applications where id=${id} for update`)
      if (!current.rows[0] || ['activated','archived'].includes(String(current.rows[0].status))) throw new ExpansionError('Application cannot be reviewed.',409)
      const confirmations = {legal:input.legal===true,agreement:input.agreement===true,independentStatus:input.independentStatus===true,operations:input.operations===true,confirmedBy:actor.id,confirmedAt:new Date().toISOString()}
      let residence: string | null = null
      try { residence = normaliseCountry(input.residenceCountry) } catch { throw new ExpansionError('Use a two-letter ISO country code for the applicant residence.') }
      // Residence is recorded for review only. International applicants may be considered; nothing here authorises operating or activation.
      await tx.execute(sql`update partner_applications set status=${String(input.status)},review_notes=${expansionText(input.notes,'Review notes',6000)},onboarding_confirmations=${JSON.stringify(confirmations)}::jsonb,residence_country=coalesce(${residence},residence_country) where id=${id}`)
      await audit(tx,actor.id,id,'application_reviewed',{status:input.status,confirmations})
      return {id}
    }
    if (input.action === 'invite') {
      let operatingCountry: string | null = null
      try { operatingCountry = input.operatingCountry === undefined || input.operatingCountry === '' ? 'GB' : normaliseCountry(input.operatingCountry) } catch { throw new ExpansionError('Use a two-letter ISO country code for the operating market.') }
      const result = await issueInvitation(tx,expansionInteger(input.id,'application',1,2147483647),actor.id,expansionText(input.agreementVersion,'Agreement version',100),operatingCountry as string)
      await audit(tx,actor.id,result.partnerId,'invitation_issued')
      return result
    }
    if (input.action === 'set_partner_operating_market') {
      const id = expansionId(input.id)
      let code: string | null = null
      try { code = normaliseCountry(input.countryCode) } catch { throw new ExpansionError('Use a two-letter ISO country code.') }
      if (!code) throw new ExpansionError('A country code is required.')
      if (!(await tx.execute(sql`select id from expansion_partners where id=${id} for update`)).rows[0]) throw new ExpansionError('Partner not found.',404)
      await tx.execute(sql`update expansion_partners set operating_country=${code} where id=${id}`)
      await audit(tx,actor.id,id,'partner_operating_market_set',{country:code})
      return {id,countryCode:code}
    }
    if (input.action === 'revoke_partner') {
      const id = expansionId(input.id)
      await tx.execute(sql`update admin_users set active=false,session_version=session_version+1 where id=(select user_id from expansion_partners where id=${id}) and role='independent_partner'`)
      await tx.execute(sql`update expansion_partners set invitation_hash=null,invitation_expires_at=null where id=${id}`)
      await audit(tx,actor.id,id,'partner_revoked')
      return {id}
    }
    if (input.action === 'capacity') {
      const period = capacityPeriod(input.period)
      const hours = expansionInteger(input.hours,'hours',0)
      const rationale = expansionText(input.rationale,'Capacity assessment',3000)
      if (input.commitmentsReviewed !== true) throw new ExpansionError('Confirm existing projects, retainers and founder commitments were assessed.')
      await tx.execute(sql`select pg_advisory_xact_lock(621908149)`)
      const reserved = await tx.execute(sql`select coalesce(sum(hours),0)::integer hours from expansion_reservations where period=${period} and status<>'released'`)
      if (hours < Number(reserved.rows[0].hours)) throw new ExpansionError('Available allocation cannot be less than existing reservations.',409)
      await tx.execute(sql`insert into expansion_capacity(period,available_hours,rationale,configured_by) values(${period},${hours},${rationale},${actor.id}) on conflict(period) do update set available_hours=excluded.available_hours,rationale=excluded.rationale,configured_by=excluded.configured_by,configured_at=now()`)
      await audit(tx,actor.id,period,'capacity_configured',{hours,rationale})
      return {period}
    }
    if (input.action === 'resource') {
      const id = randomUUID()
      if (!['partner','client'].includes(String(input.audience)) || !['draft','published'].includes(String(input.status))) throw new ExpansionError('Invalid resource audience or status.')
      await tx.execute(sql`insert into expansion_resources(id,title,category,version,audience,content,status,created_by) values(${id},${expansionText(input.title,'Title',200)},${expansionText(input.category,'Category',100)},${expansionInteger(input.version,'version')},${String(input.audience)},${expansionText(input.content,'Resource content',30000)},${String(input.status)},${actor.id})`)
      await audit(tx,actor.id,id,'resource_created',{status:input.status})
      return {id}
    }
    if (input.action === 'resource_status') {
      const id = expansionId(input.id)
      if (!['published','archived'].includes(String(input.status))) throw new ExpansionError('Invalid publication status.')
      const resource = await tx.execute(sql`select status from expansion_resources where id=${id} for update`)
      if (!resource.rows[0] || !(resource.rows[0].status==='draft' || (resource.rows[0].status==='published' && input.status==='archived'))) throw new ExpansionError('This publication transition is unavailable.',409)
      await tx.execute(sql`update expansion_resources set status=${String(input.status)} where id=${id}`)
      await audit(tx,actor.id,id,'resource_publication_changed',{status:input.status})
      return {id}
    }
    if (input.action === 'suppress') {
      const domain = prospectDomain(input.domain)
      const reason = expansionText(input.reason,'Reason',3000)
      // Serialize suppression with this service's prospect-admission check.
      await tx.execute(sql`select pg_advisory_xact_lock(621908148)`)
      await tx.execute(sql`insert into expansion_suppressions(normalized_domain,reason,created_by) values(${domain},${reason},${actor.id}) on conflict(normalized_domain) do nothing`)
      await audit(tx,actor.id,domain,'business_suppressed')
      return {domain}
    }
    if (input.action === 'set_plan_enabled') {
      const planKey = String(input.planKey)
      if (!(COMMERCIAL_PLAN_KEYS as readonly string[]).includes(planKey) || typeof input.enabled !== 'boolean') throw new ExpansionError('Choose a known commercial plan and state.')
      const reason = expansionText(input.reason,'Reason for the change',1000)
      await tx.execute(sql`update expansion_plan_settings set enabled=${input.enabled},updated_by=${actor.id},updated_at=now() where plan_key=${planKey}`)
      await audit(tx,actor.id,planKey,'plan_availability_changed',{enabled:input.enabled,reason})
      return {planKey,enabled:input.enabled}
    }
    if (input.action === 'set_discount_policy') {
      const partnerId = expansionId(input.partnerId)
      const start = expansionText(input.periodStart,'Period start',10), end = expansionText(input.periodEnd,'Period end',10)
      if (!/^\d{4}-\d\d-\d\d$/.test(start) || !/^\d{4}-\d\d-\d\d$/.test(end) || end <= start) throw new ExpansionError('Choose a valid allowance period.')
      const count = expansionInteger(input.allowanceCount,'allowance count',0,50)
      const fees = Array.isArray(input.permittedFeesPence) ? input.permittedFeesPence : []
      if (!fees.length || fees.length > 12 || fees.some(f => !Number.isSafeInteger(f) || (f as number) < 0 || (f as number) >= 200000)) throw new ExpansionError('Permitted build fees must be integer pence below the standard £2,000.')
      const approval = expansionText(input.approvalReference,'Allowance approval reference',500)
      await tx.execute(sql`select id from expansion_partners where id=${partnerId} for update`)
      const overlap = await tx.execute(sql`select id from expansion_discount_policies where partner_id=${partnerId} and period_start<>${start}::date and period_start<${end}::date and period_end>${start}::date`)
      if (overlap.rows[0]) throw new ExpansionError('Allowance periods for one partner cannot overlap.',409)
      const existing = await tx.execute(sql`select id from expansion_discount_policies where partner_id=${partnerId} and period_start=${start}::date for update`)
      const arrayValue = sql`array[${sql.join((fees as number[]).map(f => sql`${f}::integer`), sql`, `)}]::integer[]`
      if (existing.rows[0]) {
        const used = await tx.execute(sql`select count(*)::integer c from expansion_discount_reservations where policy_id=${String(existing.rows[0].id)} and status in ('reserved','consumed')`)
        if (count < Number(used.rows[0].c)) throw new ExpansionError('The allowance cannot be lowered below discounts already reserved or consumed.',409)
        await tx.execute(sql`update expansion_discount_policies set period_end=${end}::date,allowance_count=${count},permitted_fees_pence=${arrayValue},approval_reference=${approval},approved_by=${actor.id},updated_at=now() where id=${String(existing.rows[0].id)}`)
      } else await tx.execute(sql`insert into expansion_discount_policies(id,partner_id,period_start,period_end,allowance_count,permitted_fees_pence,approval_reference,approved_by) values(${randomUUID()},${partnerId},${start}::date,${end}::date,${count},${arrayValue},${approval},${actor.id})`)
      await audit(tx,actor.id,partnerId,'discount_policy_set',{start,end,count,fees,approval})
      return {partnerId}
    }
    if (input.action === 'review_additional') {
      const claimId = expansionId(input.claimId)
      const decision = String(input.decision)
      if (!['approved','rejected'].includes(decision)) throw new ExpansionError('Choose approve or reject.')
      const notes = expansionText(input.notes,'Attribution review decision and evidence',3000)
      const claim = (await tx.execute(sql`select * from expansion_additional_claims where id=${claimId} for update`)).rows[0] as Row | undefined
      if (!claim || claim.status !== 'pending') throw new ExpansionError('Choose a pending additional-business claim.',409)
      if (decision === 'rejected') {
        await tx.execute(sql`update expansion_additional_claims set status='rejected',reviewed_by=${actor.id},review_notes=${notes},reviewed_at=now() where id=${claimId}`)
        await audit(tx,actor.id,claimId,'additional_claim_rejected',{notes})
        return {claimId,status:'rejected'}
      }
      if (input.attributionConfirmed !== true) throw new ExpansionError('Confirm documented partner attribution for this new, separately scoped business.')
      const clientId = expansionInteger(input.clientId,'client',1,2147483647)
      if (!(await tx.execute(sql`select id from clients where id=${clientId}`)).rows[0]) throw new ExpansionError('Select an existing canonical client; customers are never duplicated.')
      const owner = (await tx.execute(sql`select user_id from expansion_partners where id=${String(claim.partner_id)}`)).rows[0]
      const prospect = await tx.execute(sql`insert into prospects(business_name,website_url,owner_user_id,source) values(${String(claim.business_name)+' - '+String(claim.project_label)},${`https://${String(claim.normalized_domain)}`},${String(owner.user_id)},'referral') returning id`)
      const opportunityId = randomUUID()
      await tx.execute(sql`insert into expansion_opportunities(id,partner_id,prospect_id,client_id,normalized_domain,additional_claim_id) values(${opportunityId},${String(claim.partner_id)},${prospect.rows[0].id},${clientId},${String(claim.normalized_domain)},${claimId})`)
      await tx.execute(sql`update expansion_additional_claims set status='approved',client_id=${clientId},opportunity_id=${opportunityId},reviewed_by=${actor.id},review_notes=${notes},reviewed_at=now() where id=${claimId}`)
      await audit(tx,actor.id,claimId,'additional_claim_approved',{clientId,opportunityId,notes})
      return {claimId,status:'approved',opportunityId}
    }
    if (input.action === 'set_market') {
      let code: string | null = null
      try { code = normaliseCountry(input.countryCode) } catch { throw new ExpansionError('Use a two-letter ISO country code.') }
      if (!code) throw new ExpansionError('A country code is required.')
      const status = String(input.status)
      if (!['under_review','approved','suspended'].includes(status)) throw new ExpansionError('Choose a market status.')
      const planKeys = Array.isArray(input.planKeys) ? [...new Set(input.planKeys.map(String))].filter(k => (COMMERCIAL_PLAN_KEYS as readonly string[]).includes(k)) : []
      const flags = { legal: input.legalReviewed === true, accounting: input.accountingReviewed === true, privacy: input.privacyReviewed === true, operations: input.operationsReviewed === true }
      const approval = input.approvalReference ? expansionText(input.approvalReference,'Approval reference',500) : null
      if (status === 'approved' && (!Object.values(flags).every(Boolean) || !approval || !planKeys.length)) throw new ExpansionError('Approving a market needs legal, accounting, privacy and operational review, an approval reference and at least one plan.')
      const planArray = planKeys.length ? sql`array[${sql.join(planKeys.map(k => sql`${k}`), sql`, `)}]::text[]` : sql`'{}'::text[]`
      await tx.execute(sql`select pg_advisory_xact_lock(7102)`)
      await tx.execute(sql`insert into expansion_markets(country_code,country_name,status,plan_keys,legal_reviewed,accounting_reviewed,privacy_reviewed,operations_reviewed,approval_reference,approved_by,updated_at)
        values(${code},${expansionText(input.countryName,'Country name',120)},${status},${planArray},${flags.legal},${flags.accounting},${flags.privacy},${flags.operations},${approval},${status === 'approved' ? actor.id : null},now())
        on conflict(country_code) do update set country_name=excluded.country_name,status=excluded.status,plan_keys=excluded.plan_keys,legal_reviewed=excluded.legal_reviewed,accounting_reviewed=excluded.accounting_reviewed,privacy_reviewed=excluded.privacy_reviewed,operations_reviewed=excluded.operations_reviewed,approval_reference=excluded.approval_reference,approved_by=excluded.approved_by,updated_at=now()`)
      await audit(tx,actor.id,code,'market_set',{status,planKeys,flags,approval})
      return {countryCode:code,status}
    }
    if (input.action === 'create_exclusivity') {
      const clientId = expansionInteger(input.clientId,'client',1,2147483647)
      if (!(await tx.execute(sql`select id from clients where id=${clientId}`)).rows[0]) throw new ExpansionError('Select an existing canonical client.')
      const from = expansionText(input.effectiveFrom,'Effective date',10), to = input.effectiveTo ? expansionText(input.effectiveTo,'Expiry date',10) : null
      const realDate = (v: string) => /^\d{4}-\d\d-\d\d$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0,10) === v
      if (!realDate(from) || (to && (!realDate(to) || to <= from))) throw new ExpansionError('Choose valid effective dates. The expiry date is the first unprotected day.')
      const validSector = await assertSectorExists(tx,input.sectorId)
      await tx.execute(sql`select pg_advisory_xact_lock(7102)`)
      const exclusivityId = randomUUID()
      await tx.execute(sql`insert into expansion_exclusivities(id,client_id,sector_id,sector,area,contractual_reference,effective_from,effective_to,created_by) values(${exclusivityId},${clientId},${validSector},${expansionText(input.sector,'Sector',120)},${expansionText(input.area,'Geographic area',120)},${expansionText(input.contractualReference,'Accepted contractual reference',500)},${from}::date,${to}::date,${actor.id})`)
      await audit(tx,actor.id,exclusivityId,'exclusivity_created',{clientId,sector:input.sector,area:input.area})
      return {exclusivityId}
    }
    if (input.action === 'create_sector') {
      const key = expansionText(input.key,'Sector key',60).toLowerCase()
      if (!/^[a-z0-9-]{2,60}$/.test(key)) throw new ExpansionError('Use lower-case letters, digits and hyphens for the sector key.')
      const sectorId = randomUUID()
      const created = await tx.execute(sql`insert into expansion_sectors(id,key,label,created_by) values(${sectorId},${key},${expansionText(input.label,'Sector label',120)},${actor.id}) on conflict(key) do nothing returning id`)
      if (!created.rows[0]) throw new ExpansionError('That sector key already exists.',409)
      await audit(tx,actor.id,sectorId,'sector_created',{key})
      return {sectorId}
    }
    if (input.action === 'add_sector_alias') {
      const alias = aliasKey(expansionText(input.alias,'Alias',80))
      if (alias.length < 2) throw new ExpansionError('Enter a meaningful alias.')
      const sectorId = (await assertSectorExists(tx,input.sectorId)) as string
      if (!sectorId) throw new ExpansionError('Choose a sector for the alias.')
      const added = await tx.execute(sql`insert into expansion_sector_aliases(alias,sector_id,created_by) values(${alias},${sectorId},${actor.id}) on conflict(alias) do nothing returning alias`)
      if (!added.rows[0]) throw new ExpansionError('That alias is already assigned.',409)
      await audit(tx,actor.id,sectorId,'sector_alias_added',{alias})
      return {alias}
    }
    if (input.action === 'correct_exclusivity') {
      // Accepted terms are never edited: a correction is a new record that supersedes (and ends) the old one.
      const oldId = expansionId(input.exclusivityId)
      await tx.execute(sql`select pg_advisory_xact_lock(7102)`)
      const old = (await tx.execute(sql`select client_id from expansion_exclusivities where id=${oldId} and status='active' for update`)).rows[0] as Row | undefined
      if (!old) throw new ExpansionError('Choose an active exclusivity to correct.',409)
      const from = expansionText(input.effectiveFrom,'Effective date',10), to = input.effectiveTo ? expansionText(input.effectiveTo,'Expiry date',10) : null
      const realDate = (v: string) => /^\d{4}-\d\d-\d\d$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0,10) === v
      if (!realDate(from) || (to && (!realDate(to) || to <= from))) throw new ExpansionError('Choose valid effective dates.')
      const reason = expansionText(input.reason,'Reason for the correction',1000)
      // A correction takes effect at once: a later start would open an unprotected gap.
      if ((await tx.execute(sql`select ${from}::date > (now() at time zone 'Europe/London')::date late`)).rows[0]?.late) throw new ExpansionError('A correction must take effect from today or earlier so protection has no gap.')
      const validSector = await assertSectorExists(tx,input.sectorId)
      const newId = randomUUID()
      await tx.execute(sql`insert into expansion_exclusivities(id,client_id,sector_id,sector,area,contractual_reference,effective_from,effective_to,created_by) values(${newId},${Number(old.client_id)},${validSector},${expansionText(input.sector,'Sector',120)},${expansionText(input.area,'Geographic area',120)},${expansionText(input.contractualReference,'Accepted contractual reference',500)},${from}::date,${to}::date,${actor.id})`)
      await tx.execute(sql`update expansion_exclusivities set status='ended',ended_at=now(),superseded_by=${newId} where id=${oldId}`)
      await audit(tx,actor.id,newId,'exclusivity_corrected',{supersedes:oldId,reason})
      return {exclusivityId:newId,supersedes:oldId}
    }
    if (input.action === 'end_exclusivity') {
      const exclusivityId = expansionId(input.exclusivityId)
      await tx.execute(sql`select pg_advisory_xact_lock(7102)`)
      const ended = await tx.execute(sql`update expansion_exclusivities set status='ended',ended_at=now() where id=${exclusivityId} and status='active' returning id`)
      if (!ended.rows[0]) throw new ExpansionError('Choose an active exclusivity to end.',409)
      await audit(tx,actor.id,exclusivityId,'exclusivity_ended',{reason:expansionText(input.reason,'Reason',1000)})
      return {exclusivityId}
    }
    const id = expansionId(input.id)
    const row = await opportunity(tx,id)
    if (input.action === 'classify_opportunity') {
      if (row.status === 'contract_accepted') throw new ExpansionError('An accepted contract cannot be reclassified.',409)
      const sectorId = input.sectorId ? expansionId(input.sectorId) : null
      if (sectorId && !(await tx.execute(sql`select id from expansion_sectors where id=${sectorId}`)).rows[0]) throw new ExpansionError('Choose a defined sector.')
      await tx.execute(sql`select pg_advisory_xact_lock(7102)`)
      await tx.execute(sql`update expansion_opportunities set sector_id=${sectorId},sector_classified_by=${sectorId ? actor.id : null},updated_at=now() where id=${id}`)
      await audit(tx,actor.id,id,'opportunity_sector_classified',{sectorId})
      return {id}
    }
    if (input.action === 'set_opportunity_market') {
      let code: string | null = null
      try { code = normaliseCountry(input.countryCode) } catch { throw new ExpansionError('Use a two-letter ISO country code.') }
      if (row.status === 'contract_accepted') throw new ExpansionError('An accepted contract cannot change market.',409)
      await tx.execute(sql`update expansion_opportunities set customer_country=${code},customer_country_confirmed_by=${code ? actor.id : null},updated_at=now() where id=${id}`)
      await audit(tx,actor.id,id,'opportunity_market_set',{country:code})
      return {id}
    }
    if (input.action === 'decide_exclusivity') {
      const exclusivityId = expansionId(input.exclusivityId)
      const decision = String(input.decision)
      if (!['cleared','exception_approved'].includes(decision)) throw new ExpansionError('Choose cleared or exception approved.')
      await tx.execute(sql`select pg_advisory_xact_lock(7102)`)
      const ex = (await tx.execute(sql`select id,client_id,sector,area,sector_id from expansion_exclusivities where id=${exclusivityId} and status='active'`)).rows[0] as Row | undefined
      if (!ex) throw new ExpansionError('Choose an active exclusivity.',409)
      const facts = (await tx.execute(sql`select industry,location from prospects where id=${row.prospect_id}`)).rows[0] as Row
      const match = matchExclusivity({clientId:row.client_id as number|null,sector:facts?.industry as string|null,area:facts?.location as string|null,sectorId:await effectiveSectorId(tx,row,facts?.industry)},{clientId:Number(ex.client_id),sector:String(ex.sector),area:String(ex.area),sectorId:(ex.sector_id as string|null) ?? null})
      if (match === 'none') throw new ExpansionError('There is no exclusivity conflict to decide.',409)
      if (decision === 'cleared' && match === 'restricted') throw new ExpansionError('A confirmed restriction can only be released by an approved exception.',409)
      const decided = await tx.execute(sql`insert into expansion_exclusivity_decisions(id,opportunity_id,exclusivity_id,decision,reference,decided_by) values(${randomUUID()},${id},${exclusivityId},${decision},${expansionText(input.reference,'Decision evidence and reference',1000)},${actor.id}) on conflict(opportunity_id,exclusivity_id) do nothing returning id`)
      if (!decided.rows[0]) throw new ExpansionError('A decision is already recorded for this opportunity and exclusivity. Decisions are final; contact the other founder.',409)
      await audit(tx,actor.id,id,'exclusivity_decided',{exclusivityId,decision,match})
      return {id}
    }
    if (input.action === 'reserve_discount') {
      if (row.status !== 'approved') throw new ExpansionError('Approve scope and reserve delivery capacity before reserving a discount.',409)
      const fee = expansionInteger(input.feePence,'approved build fee',0,199999)
      const reason = expansionText(input.reason,'Commercial reason for the discount',1000)
      // The policy row lock serialises every concurrent reservation against one allowance.
      const policy = (await tx.execute(sql`select id,allowance_count,permitted_fees_pence from expansion_discount_policies where partner_id=${String(row.partner_id)} and period_start<=current_date and period_end>current_date for update`)).rows[0] as Row | undefined
      if (!policy) throw new ExpansionError('No approved discount allowance is available for this partner.',409)
      if (!(policy.permitted_fees_pence as number[]).includes(fee)) throw new ExpansionError('That build fee is not a permitted discount for this partner.',403)
      if ((await tx.execute(sql`select id from expansion_discount_reservations where opportunity_id=${id} and status in ('reserved','consumed')`)).rows[0]) throw new ExpansionError('This opportunity already has an active discount reservation.',409)
      const used = await tx.execute(sql`select count(*)::integer c from expansion_discount_reservations where policy_id=${String(policy.id)} and status in ('reserved','consumed')`)
      if (Number(used.rows[0].c) >= Number(policy.allowance_count)) throw new ExpansionError('The discount allowance for this period is exhausted.',409)
      const reservationId = randomUUID()
      await tx.execute(sql`insert into expansion_discount_reservations(id,policy_id,opportunity_id,build_fee_pence,reserved_by,reason) values(${reservationId},${String(policy.id)},${id},${fee},${actor.id},${reason})`)
      await audit(tx,actor.id,id,'discount_reserved',{reservationId,fee,reason})
      return {id,reservationId}
    }
    if (input.action === 'release_discount') {
      const released = await tx.execute(sql`update expansion_discount_reservations set status='released',resolved_at=now() where opportunity_id=${id} and status='reserved' returning id`)
      if (!released.rows[0]) throw new ExpansionError('There is no unconsumed discount reservation to release.',409)
      await audit(tx,actor.id,id,'discount_released',{reason:expansionText(input.reason,'Release reason',1000)})
      return {id}
    }
    if (input.action === 'cancel_contract') {
      if (row.status !== 'contract_accepted') throw new ExpansionError('Choose an accepted contract for cancellation.',409)
      const reason = expansionText(input.reason,'Approved cancellation evidence and reason',3000)
      const contract = await tx.execute(sql`select id,commercial_contract_id from expansion_contracts where opportunity_id=${id} for update`)
      if (!contract.rows[0]) throw new ExpansionError('Accepted contract not found.',409)
      const canonicalId = contract.rows[0].commercial_contract_id
      const ended = await tx.execute(sql`update commercial_contracts
        set status='ended', ends_at=case when starts_at<now() then least(coalesce(ends_at,now()),now()) else ends_at end,
          version=version+1, actor_user_id=${actor.id}, updated_at=now()
        where id=${canonicalId} and status='confirmed' returning id`)
      if (ended.rows[0]) await tx.execute(sql`insert into commercial_audit(actor_user_id,entity,record_id,action,after_value)
        values(${actor.id},'contract',${String(canonicalId)},'expansion_contract_cancelled',${JSON.stringify({reason,status:'ended'})}::jsonb)`)
      await tx.execute(sql`insert into expansion_contract_cancellations(contract_id,reason,created_by) values(${contract.rows[0].id},${reason},${actor.id})`)
      await tx.execute(sql`update expansion_opportunities set status='withdrawn',updated_at=now() where id=${id}`)
      if (input.deliveryReviewed === true) await tx.execute(sql`update expansion_reservations set status='released' where opportunity_id=${id}`)
      await audit(tx,actor.id,id,'contract_cancelled',{reason,capacityReleased:input.deliveryReviewed===true})
      return {id}
    } else if (input.action === 'review_scope') {
      if (row.status !== 'scope_submitted') throw new ExpansionError('Scope must be submitted before review.',409)
      const decision = String(input.decision)
      if (!['approved','more_information','bespoke_required','deferred','closed_lost'].includes(decision)) throw new ExpansionError('Invalid scope outcome.')
      const notes = expansionText(input.notes,'Review decision and feasibility/price/risk assessment',6000)
      if (decision === 'approved') {
        if (input.technicalConfirmed !== true || input.commercialConfirmed !== true) throw new ExpansionError('Technical and commercial approval are both required.')
        await assertCommercialClearance(tx,row,String(row.partner_id),'founder')
        const period = capacityPeriod(input.period)
        const hours = expansionInteger(input.hours,'delivery hours')
        await tx.execute(sql`select pg_advisory_xact_lock(621908149)`)
        const available = await tx.execute(sql`select available_hours from expansion_capacity where period=${period} for update`)
        const reserved = await tx.execute(sql`select coalesce(sum(hours),0)::integer hours from expansion_reservations where period=${period} and status<>'released' and opportunity_id<>${id}`)
        if (!available.rows[0] || Number(available.rows[0].available_hours)-Number(reserved.rows[0].hours)<hours) throw new ExpansionError('Insufficient assessed delivery capacity. Defer or choose another week.',409)
        await tx.execute(sql`insert into expansion_reservations(opportunity_id,period,hours,status,approved_by) values(${id},${period},${hours},'provisional',${actor.id}) on conflict(opportunity_id) do update set period=excluded.period,hours=excluded.hours,status='provisional',approved_by=excluded.approved_by`)
      }
      await tx.execute(sql`update expansion_opportunities set status=${decision},review_notes=${notes},updated_at=now() where id=${id}`)
      await audit(tx,actor.id,id,'scope_reviewed',{decision,notes,scopeVersion:row.scope_version})
    } else if (input.action === 'accept_contract') {
      if (row.status !== 'approved') throw new ExpansionError('Approve scope and reserve capacity first.',409)
      const reservation = await tx.execute(sql`select opportunity_id from expansion_reservations where opportunity_id=${id} and status='provisional' for update`)
      if (!reservation.rows[0]) throw new ExpansionError('A valid provisional capacity reservation is required.',409)
      const clientId = expansionInteger(input.clientId,'client',1,2147483647)
      const client = await tx.execute(sql`select id from clients where id=${clientId}`)
      if (!client.rows[0]) throw new ExpansionError('Select an existing canonical client.')
      const canonicalProspect = await tx.execute(sql`select converted_client_id from prospects where id=${row.prospect_id} for update`)
      const existingConversion = await tx.execute(sql`select client_id from prospect_conversions where prospect_id=${row.prospect_id}`)
      if ((canonicalProspect.rows[0]?.converted_client_id && canonicalProspect.rows[0].converted_client_id!==clientId) || (existingConversion.rows[0] && existingConversion.rows[0].client_id!==clientId)) throw new ExpansionError('This prospect is already linked to a different client. Resolve the canonical CRM relationship before acceptance.',409)
      let discountReservationId: string | null = null
      let planPricing: { websitePence: number; monthlyPence: number } | null = null
      let planTerms = null as ReturnType<typeof parseCommissionTerms> | null
      if (input.plan !== undefined) {
        if (input.terms !== undefined) throw new ExpansionError('Choose either an approved plan or legacy terms, not both.')
        const request = { ...(input.plan as PlanRequest) }
        delete request.approvedDiscountFeePence // server-only field; never trust the client
        if (!request || typeof request !== 'object' || !(COMMERCIAL_PLAN_KEYS as readonly string[]).includes(request.plan)) throw new ExpansionError('Choose an approved commercial plan.')
        // Share-lock serialises acceptance against a founder disabling the plan.
        const setting = await tx.execute(sql`select enabled from expansion_plan_settings where plan_key=${request.plan as CommercialPlanKey} for share`)
        if (!setting.rows[0]?.enabled) throw new ExpansionError('This commercial plan is not enabled.',409)
        await assertAcceptanceGates(tx,row,request.plan,clientId)
        if (row.additional_claim_id && Number(row.client_id) !== clientId) throw new ExpansionError('An approved additional opportunity must be contracted with its attributed existing client.',409)
        if (request.plan === 'standard-v2' && request.buildFeePence !== undefined && request.buildFeePence !== 200000) {
          const held = (await tx.execute(sql`select r.id,r.build_fee_pence,p.period_end<=current_date expired from expansion_discount_reservations r join expansion_discount_policies p on p.id=r.policy_id where r.opportunity_id=${id} and r.status='reserved' for update of r`)).rows[0] as Row | undefined
          if (!held) throw new ExpansionError('A build fee below the standard £2,000 needs an approved discount allowance.',403)
          if (held.expired) throw new ExpansionError('The discount allowance period has expired; release and re-approve.',409)
          if (Number(held.build_fee_pence) !== request.buildFeePence) throw new ExpansionError('The requested build fee does not match the approved discount reservation.',409)
          request.approvedDiscountFeePence = request.buildFeePence
          discountReservationId = String(held.id)
        }
        try { planTerms = buildAcceptedTerms(request) } catch (error) { throw new ExpansionError(error instanceof Error ? error.message : 'Invalid commercial plan.', (error as { status?: number }).status ?? 400) }
        planPricing = { websitePence: Number(planTerms.commitment!.buildPence), monthlyPence: Number(planTerms.commitment!.recurringPence) }
      }
      // Legacy standard-v1 terms are for historical records and replays. A NEW acceptance through them gets no exemption from the
      // current market and exclusivity gates; existing accepted contracts are never re-evaluated (grandfathered, immutable).
      if (!planTerms) await assertAcceptanceGates(tx,row,'*',clientId)
      const terms = planTerms ?? parseCommissionTerms(input.terms)
      await tx.execute(sql`insert into expansion_commission_plans(version,terms,created_by) values(${terms.planVersion},${JSON.stringify(terms)}::jsonb,${actor.id}) on conflict(version) do nothing`)
      const plan = await tx.execute(sql`select terms from expansion_commission_plans where version=${terms.planVersion}`)
      if (JSON.stringify(parseCommissionTerms(plan.rows[0]?.terms)) !== JSON.stringify(terms)) throw new ExpansionError('This commission version already has different terms. Create a new version.',409)
      const reference = expansionText(input.agreementReference,'Accepted agreement evidence',500)
      const contractId = randomUUID()
      const qualifyingWebsite = BigInt(terms.milestones.deposit) + BigInt(terms.milestones.interim ?? '0') + BigInt(terms.milestones.final)
      const pricing = (planPricing ?? input.commercialPricing) as Record<string,unknown> | undefined
      const standardPricing = !planPricing && terms.milestones.deposit === '100000' && terms.milestones.final === '100000' && terms.milestones.first_retainer === '35000'
      if (!pricing && !standardPricing) throw new ExpansionError('Record actual signed website and recurring prices separately from bespoke commission limits.')
      const website = pricing ? expansionInteger(pricing.websitePence,'signed website price',0,2147483647) : 200000
      const monthly = pricing ? expansionInteger(pricing.monthlyPence,'signed recurring price',0,2147483647) : 35000
      if (BigInt(website) < qualifyingWebsite || BigInt(monthly) < BigInt(terms.milestones.first_retainer)) {
        throw new ExpansionError('Qualifying limits cannot exceed signed prices.')
      }
      const category = monthly > 0 ? 'premium_partnership' : 'website_build'
      const commercial = await tx.execute(sql`insert into commercial_contracts(client_id,prospect_id,category,status,monthly_amount,one_off_amount,evidence,starts_at,actor_user_id) values(${clientId},${row.prospect_id},${category},'confirmed',${monthly},${website},${reference},now(),${actor.id}) returning id`)
      await tx.execute(sql`insert into expansion_contracts(id,opportunity_id,client_id,commercial_contract_id,terms,scope_snapshot,scope_version,agreement_reference,accepted_at,created_by) values(${contractId},${id},${clientId},${commercial.rows[0].id},${JSON.stringify(terms)}::jsonb,${JSON.stringify(row.scope)}::jsonb,${row.scope_version},${reference},now(),${actor.id})`)
      if (discountReservationId) await tx.execute(sql`update expansion_discount_reservations set status='consumed',contract_id=${contractId},resolved_at=now() where id=${discountReservationId} and status='reserved'`)
      await tx.execute(sql`update expansion_opportunities set status='contract_accepted',client_id=${clientId},updated_at=now() where id=${id}`)
      await tx.execute(sql`update prospects set stage='won',converted_client_id=${clientId},won_at=now(),updated_at=now() where id=${row.prospect_id}`)
      if (!existingConversion.rows[0]) await tx.execute(sql`insert into prospect_conversions(prospect_id,client_id,actor_user_id,client_action,metadata_json) values(${row.prospect_id},${clientId},${actor.id},'linked',${JSON.stringify({source:'operation-expansion',contractId,scopeVersion:row.scope_version,scopeSnapshot:row.scope,agreementReference:reference})}::jsonb)`)
      await tx.execute(sql`update expansion_reservations set status='confirmed' where opportunity_id=${id} and status='provisional'`)
      await audit(tx,actor.id,id,'contract_accepted',{contractId,terms,reference,commercialPricing:{websitePence:website,monthlyPence:monthly}})
      return {id:contractId}
    } else if (input.action === 'release_capacity') {
      if (row.status === 'contract_accepted') throw new ExpansionError('Accepted contracts need explicit delivery review before capacity release.',409)
      await tx.execute(sql`update expansion_reservations set status='released' where opportunity_id=${id}`)
      await tx.execute(sql`update expansion_opportunities set status='deferred',updated_at=now() where id=${id}`)
      await audit(tx,actor.id,id,'capacity_released',{reason:expansionText(input.reason,'Reason')})
    } else throw new ExpansionError('Unknown founder action.')
    return {id}
  })
}
