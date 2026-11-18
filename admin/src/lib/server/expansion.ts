import 'server-only'
import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { db, type AdminDatabaseTransaction } from '@/lib/db'
import { requireCapability } from './rbac'
import { issueInvitation } from './partner-invitations'
import { ExpansionError, expansionText, expansionId, expansionInteger, prospectDomain, parseDiscovery, technicalReviewFlags, assertPartnerTransition, capacityPeriod } from '@/lib/expansion'
import { parseCommissionTerms } from '@/lib/expansion-finance'
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
export async function partnerSnapshot() {
  const actor = await requireCapability('expansion.partner')
  return db.transaction(async tx => {
    const id = await partner(tx,actor)
    const opportunities = await tx.execute(sql`select o.id,o.status,o.discovery,o.scope,o.scope_version,o.review_notes,o.created_at,p.business_name,p.website_url,p.contact_name,p.contact_email,p.next_follow_up_at,c.id contract_id from expansion_opportunities o join prospects p on p.id=o.prospect_id left join expansion_contracts c on c.opportunity_id=o.id where o.partner_id=${id} order by o.created_at desc`)
    const resources = await tx.execute(sql`select id,title,category,version,audience,content,status,created_at from expansion_resources where status='published' order by created_at desc`)
    const capacity = await tx.execute(sql`select c.period,greatest(0,c.available_hours-coalesce(sum(r.hours) filter(where r.status<>'released'),0))::integer remaining_hours from expansion_capacity c left join expansion_reservations r on r.period=c.period where c.period>=current_date-7 group by c.period order by c.period`)
    return { partnerId:id, displayName:actor.displayName, opportunities:opportunities.rows, resources:resources.rows, capacity:capacity.rows }
  })
}
export async function founderSnapshot() {
  const actor = await requireCapability('expansion.manage')
  return db.transaction(async tx=>{
  await currentActor(tx,actor,'expansion.manage')
  const [applications,partners,opportunities,capacity,resources,clients] = await Promise.all([
    tx.execute(sql`select * from partner_applications order by submitted_at desc limit 200`),
    tx.execute(sql`select p.id,p.user_id,p.agreement_version,p.activated_at,u.display_name,u.email,u.active from expansion_partners p join admin_users u on u.id=p.user_id order by p.created_at desc`),
    tx.execute(sql`select o.*,p.business_name,u.display_name partner_name,c.id contract_id from expansion_opportunities o join prospects p on p.id=o.prospect_id join expansion_partners ep on ep.id=o.partner_id join admin_users u on u.id=ep.user_id left join expansion_contracts c on c.opportunity_id=o.id order by o.created_at desc limit 500`),
    tx.execute(sql`select c.*,coalesce(sum(r.hours) filter(where r.status<>'released'),0)::integer reserved_hours from expansion_capacity c left join expansion_reservations r on r.period=c.period group by c.period order by c.period`),
    tx.execute(sql`select * from expansion_resources order by created_at desc`),
    tx.execute(sql`select id,name from clients order by name`),
  ])
  return { applications:applications.rows,partners:partners.rows,opportunities:opportunities.rows,capacity:capacity.rows,resources:resources.rows,clients:clients.rows }
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
      await tx.execute(sql`insert into expansion_opportunities(id,partner_id,prospect_id,normalized_domain,company_number) values(${id},${partnerId},${created.rows[0].id},${domain},${companyNumber})`)
      await audit(tx,actor.id,id,'prospect_registered',{domain})
      return {id}
    }
    const id = expansionId(input.id)
    const row = await opportunity(tx,id,partnerId)
    if (input.action === 'stage') {
      const stage = assertPartnerTransition(String(row.status),input.status)
      await tx.execute(sql`update expansion_opportunities set status=${stage},updated_at=now() where id=${id}`)
      const canonicalStage = stage==='qualified' ? 'qualified' : stage==='contacted' ? 'contacted' : ['closed_lost','withdrawn'].includes(stage) ? 'lost' : null
      if (canonicalStage) await tx.execute(sql`update prospects set stage=${canonicalStage}::prospect_stage,updated_at=now() where id=${row.prospect_id}`)
      await audit(tx,actor.id,id,'stage_changed',{from:row.status,to:stage})
    } else if (input.action === 'discovery') {
      if (!['registered','contacted','discovery','qualified','more_information','bespoke_required','deferred'].includes(String(row.status))) throw new ExpansionError('This discovery is locked. Request a new review.',409)
      const discovery = parseDiscovery(input.discovery)
      await tx.execute(sql`update expansion_opportunities set discovery=${JSON.stringify(discovery)}::jsonb,status='discovery',updated_at=now() where id=${id}`)
      await audit(tx,actor.id,id,'discovery_saved')
    } else if (input.action === 'submit_scope') {
      if (!['discovery','qualified','more_information','bespoke_required','deferred'].includes(String(row.status))) throw new ExpansionError('Complete discovery before submitting scope.',409)
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
    if (input.action === 'purge_applicants') {
      const deleted = await tx.execute(sql`delete from partner_applications a where a.retention_until<=now() and not exists(select 1 from expansion_partners p where p.application_id=a.id) returning id`)
      await audit(tx,actor.id,'applicant_retention','expired_unlinked_applicants_purged',{count:deleted.rows.length})
      return {purged:deleted.rows.length}
    }
    if (input.action === 'review_application') {
      const id = expansionInteger(input.id,'application',1,2147483647)
      const statuses = ['under_review','conversation_arranged','assessment_in_progress','approved_in_principle','agreement_pending','onboarding','declined','withdrawn','archived']
      if (!statuses.includes(String(input.status))) throw new ExpansionError('Invalid recruitment state.')
      const current = await tx.execute(sql`select * from partner_applications where id=${id} for update`)
      if (!current.rows[0] || ['activated','archived'].includes(String(current.rows[0].status))) throw new ExpansionError('Application cannot be reviewed.',409)
      const confirmations = {legal:input.legal===true,agreement:input.agreement===true,independentStatus:input.independentStatus===true,operations:input.operations===true,confirmedBy:actor.id,confirmedAt:new Date().toISOString()}
      await tx.execute(sql`update partner_applications set status=${String(input.status)},review_notes=${expansionText(input.notes,'Review notes',6000)},onboarding_confirmations=${JSON.stringify(confirmations)}::jsonb where id=${id}`)
      await audit(tx,actor.id,id,'application_reviewed',{status:input.status,confirmations})
      return {id}
    }
    if (input.action === 'invite') {
      const result = await issueInvitation(tx,expansionInteger(input.id,'application',1,2147483647),actor.id,expansionText(input.agreementVersion,'Agreement version',100))
      await audit(tx,actor.id,result.partnerId,'invitation_issued')
      return result
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
      await tx.execute(sql`insert into expansion_suppressions(normalized_domain,reason,created_by) values(${domain},${expansionText(input.reason,'Reason',3000)},${actor.id}) on conflict(normalized_domain) do nothing`)
      await audit(tx,actor.id,domain,'business_suppressed')
      return {domain}
    }
    const id = expansionId(input.id)
    const row = await opportunity(tx,id)
    if (input.action === 'cancel_contract') {
      if (row.status !== 'contract_accepted') throw new ExpansionError('Choose an accepted contract for cancellation.',409)
      const reason = expansionText(input.reason,'Approved cancellation evidence and reason',3000)
      const contract = await tx.execute(sql`select id from expansion_contracts where opportunity_id=${id} for update`)
      if (!contract.rows[0]) throw new ExpansionError('Accepted contract not found.',409)
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
      const terms = parseCommissionTerms(input.terms)
      await tx.execute(sql`insert into expansion_commission_plans(version,terms,created_by) values(${terms.planVersion},${JSON.stringify(terms)}::jsonb,${actor.id}) on conflict(version) do nothing`)
      const plan = await tx.execute(sql`select terms from expansion_commission_plans where version=${terms.planVersion}`)
      if (JSON.stringify(parseCommissionTerms(plan.rows[0]?.terms)) !== JSON.stringify(terms)) throw new ExpansionError('This commission version already has different terms. Create a new version.',409)
      const reference = expansionText(input.agreementReference,'Accepted agreement evidence',500)
      const contractId = randomUUID()
      const website = Number(BigInt(terms.milestones.deposit)+BigInt(terms.milestones.final))
      expansionInteger(website,'website total',0,2147483647)
      const commercial = await tx.execute(sql`insert into commercial_contracts(client_id,prospect_id,category,status,monthly_amount,one_off_amount,evidence,starts_at,actor_user_id) values(${clientId},${row.prospect_id},'premium_partnership','confirmed',${Number(terms.milestones.first_retainer)},${website},${reference},now(),${actor.id}) returning id`)
      await tx.execute(sql`insert into expansion_contracts(id,opportunity_id,client_id,commercial_contract_id,terms,scope_snapshot,scope_version,agreement_reference,accepted_at,created_by) values(${contractId},${id},${clientId},${commercial.rows[0].id},${JSON.stringify(terms)}::jsonb,${JSON.stringify(row.scope)}::jsonb,${row.scope_version},${reference},now(),${actor.id})`)
      await tx.execute(sql`update expansion_opportunities set status='contract_accepted',client_id=${clientId},updated_at=now() where id=${id}`)
      await tx.execute(sql`update prospects set stage='won',converted_client_id=${clientId},won_at=now(),updated_at=now() where id=${row.prospect_id}`)
      if (!existingConversion.rows[0]) await tx.execute(sql`insert into prospect_conversions(prospect_id,client_id,actor_user_id,client_action,metadata_json) values(${row.prospect_id},${clientId},${actor.id},'linked',${JSON.stringify({source:'operation-expansion',contractId,scopeVersion:row.scope_version,scopeSnapshot:row.scope,agreementReference:reference})}::jsonb)`)
      await tx.execute(sql`update expansion_reservations set status='confirmed' where opportunity_id=${id} and status='provisional'`)
      await audit(tx,actor.id,id,'contract_accepted',{contractId,terms,reference})
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
