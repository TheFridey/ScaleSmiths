import "server-only"
import { randomUUID } from "node:crypto"
import { sql, type SQL } from "drizzle-orm"
import { db, type AdminDatabaseTransaction } from "@/lib/db"
import { ExpansionError } from "@/lib/expansion"
import { hasCapability } from "@/lib/rbac"
import type { AdminRole } from "@/lib/admin-users"
import { handoffReadiness, validateHandoffApproval, type HandoffSource } from "@/lib/delivery-handoff"
import { createDeliveryProjectWithTx } from "./delivery-project-service"
import { requireCapability } from "./rbac"
import { partnerGuard } from "./empower-partner"

type Row = Record<string, unknown>
type Executor = Pick<AdminDatabaseTransaction, "execute">
const rows = async (tx: Executor, statement: SQL): Promise<Row[]> => (await tx.execute(statement)).rows as Row[]
export const deliveryHandoffEnabled = () => process.env.DELIVERY_HANDOFF_ENABLED === "true"
function checkEnabled() { if (!deliveryHandoffEnabled()) throw new ExpansionError("Delivery handoff is unavailable.", 404) }
type Actor = Awaited<ReturnType<typeof requireCapability>>
async function liveFounder(tx: Executor, actor: Actor) {
  const [user] = await rows(tx, sql`select role,active,session_version from admin_users where id=${actor.id} for share`)
  if (!user?.active || user.session_version !== actor.sessionVersion || !hasCapability(user.role as AdminRole, "expansion.manage"))
    throw new ExpansionError("Founder authorisation was revoked.", 403)
}
const sourceQuery = (opportunityId: string) => sql`select o.id opportunity_id,o.status opportunity_status,o.partner_id,
  o.client_id opportunity_client_id,c.id contract_id,c.client_id contract_client_id,c.accepted_at,
  c.agreement_reference,c.scope_version,c.scope_snapshot,p.business_name,
  h.id handoff_id,h.delivery_project_id,
  exists(select 1 from expansion_contract_cancellations cc where cc.contract_id=c.id) cancelled
  from expansion_opportunities o join prospects p on p.id=o.prospect_id
  left join expansion_contracts c on c.opportunity_id=o.id
  left join expansion_delivery_handoffs h on h.opportunity_id=o.id
  where o.id=${opportunityId}`
function asSource(r: Row): HandoffSource {
  return { opportunityId:String(r.opportunity_id),opportunityStatus:String(r.opportunity_status),
    contractId:r.contract_id?String(r.contract_id):null,contractClientId:r.contract_client_id?Number(r.contract_client_id):null,
    opportunityClientId:r.opportunity_client_id?Number(r.opportunity_client_id):null,
    acceptedAt:r.accepted_at?String(r.accepted_at):null,agreementReference:r.agreement_reference?String(r.agreement_reference):null,
    scopeVersion:r.scope_version?Number(r.scope_version):null,scopeSnapshot:r.scope_snapshot,
    cancelled:Boolean(r.cancelled),existingHandoffId:r.handoff_id?String(r.handoff_id):null }
}
/** Read-only founder backlog; no Forge or financial mutations. */
export async function founderHandoffQueue() {
  checkEnabled()
  const actor = await requireCapability("expansion.manage")
  return db.transaction(async tx => {
    await tx.execute(sql`set transaction isolation level repeatable read`)
    await liveFounder(tx,actor)
    const list=await rows(tx,sql`select o.id opportunity_id,o.status opportunity_status,o.partner_id,
      o.client_id opportunity_client_id,c.id contract_id,c.client_id contract_client_id,c.accepted_at,
      c.agreement_reference,c.scope_version,c.scope_snapshot,p.business_name,u.display_name partner_name,
      h.id handoff_id,h.delivery_project_id,
      exists(select 1 from expansion_contract_cancellations cc where cc.contract_id=c.id) cancelled
      from expansion_opportunities o
      join prospects p on p.id=o.prospect_id
      join expansion_partners ep on ep.id=o.partner_id
      join admin_users u on u.id=ep.user_id
      join expansion_contracts c on c.opportunity_id=o.id
      left join expansion_delivery_handoffs h on h.opportunity_id=o.id
      where o.status='contract_accepted' order by c.accepted_at desc limit 250`)
    return {generatedAt:new Date().toISOString(),candidates:list.map(r=>({
      opportunityId:String(r.opportunity_id),contractId:String(r.contract_id),
      clientId:Number(r.contract_client_id),businessName:String(r.business_name),
      partnerName:String(r.partner_name),acceptedAt:String(r.accepted_at),
      agreementReference:String(r.agreement_reference),scopeVersion:Number(r.scope_version),
      deliveryProjectId:r.delivery_project_id?Number(r.delivery_project_id):null,
      readiness:handoffReadiness(asSource(r)),
    }))}
  })
}
/** Founder confirms an accepted contract; one serialised transaction creates the internal project and immutable link. */
export async function approveDeliveryHandoff(input:{opportunityId?:unknown;expectedContractId?:unknown;confirm?:unknown;reason?:unknown}) {
  checkEnabled()
  const actor=await requireCapability("expansion.manage")
  let approval:ReturnType<typeof validateHandoffApproval>
  try {approval=validateHandoffApproval(input)}
  catch(e) {throw new ExpansionError((e as Error).message,400)}
  return db.transaction(async tx=>{
    await liveFounder(tx,actor)
    const [locked]=await rows(tx,sql`select id from expansion_opportunities where id=${approval.opportunityId} for update`)
    if(!locked) throw new ExpansionError("Opportunity not found.",404)
    const [source]=await rows(tx,sourceQuery(approval.opportunityId))
    if(!source) throw new ExpansionError("Opportunity not found.",404)
    if(source.contract_id!==approval.expectedContractId) throw new ExpansionError("The accepted contract changed. Review its current record.",409)
    if(source.handoff_id) return {id:String(source.handoff_id),deliveryProjectId:Number(source.delivery_project_id),replay:true}
    const readiness=handoffReadiness(asSource(source))
    if(!readiness.ready) throw new ExpansionError(readiness.blockers.join(" "),409)
    const project=await createDeliveryProjectWithTx(tx,{
      clientId:Number(source.contract_client_id),
      name:String(source.business_name).slice(0,160)+" — Delivery",
      summary:"Internal delivery workspace for an accepted ScaleSmiths commercial agreement.",
      clientVisible:false,clientStagingVisible:false,clientStatus:"planning",
    },{id:actor.id,name:actor.displayName,email:actor.email})
    const id=randomUUID()
    await tx.execute(sql`insert into expansion_delivery_handoffs
      (id,opportunity_id,contract_id,client_id,delivery_project_id,partner_id,scope_version,scope_snapshot,agreement_reference,accepted_at,founder_reason,approved_by)
      values(${id},${approval.opportunityId},${approval.expectedContractId},${source.contract_client_id},
      ${project.id},${source.partner_id},${source.scope_version},${JSON.stringify(source.scope_snapshot)}::jsonb,
      ${source.agreement_reference},${source.accepted_at},${approval.reason},${actor.id})`)
    await tx.execute(sql`insert into expansion_audit(actor_id,entity_id,action,details) values(${actor.id},${approval.opportunityId},
      'delivery_handoff_approved',${JSON.stringify({handoffId:id,contractId:approval.expectedContractId,deliveryProjectId:project.id,scopeVersion:Number(source.scope_version)})}::jsonb)`)
    return {id,deliveryProjectId:project.id,replay:false}
  })
}
/** Partner-safe read: existing partnerGuard; delivery internals never exposed. */
export async function partnerDeliveryHandoffs() {
  checkEnabled()
  const actor=await requireCapability("expansion.partner")
  return db.transaction(async tx=>{
    await tx.execute(sql`set transaction isolation level repeatable read`)
    const partnerId=await partnerGuard(tx,actor)
    const list=await rows(tx,sql`select h.id,h.opportunity_id,h.created_at,p.business_name,
      d.client_visible,d.client_status,d.client_next_step
      from expansion_delivery_handoffs h join expansion_opportunities o
      on o.id=h.opportunity_id and o.partner_id=${partnerId}
      join prospects p on p.id=o.prospect_id
      join delivery_projects d on d.id=h.delivery_project_id
      where h.partner_id=${partnerId} order by h.created_at desc limit 250`)
    return {handoffs:list.map(r=>({
      id:String(r.id),opportunityId:String(r.opportunity_id),businessName:String(r.business_name),
      handedOffAt:String(r.created_at),status:"accepted_for_delivery",
      delivery:r.client_visible?{status:String(r.client_status),nextStep:r.client_next_step?String(r.client_next_step):null}:null,
    }))}
  })
}
