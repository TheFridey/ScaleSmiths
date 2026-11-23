import "server-only"
import { randomUUID } from "node:crypto"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { ExpansionError } from "@/lib/expansion"
import { hasCapability } from "@/lib/rbac"
import type { AdminRole } from "@/lib/admin-users"
import type { AutomationSignal } from "@/lib/ascend-automation"
import { requireCapability } from "./rbac"
import { ascendAutomationEnabled, founderAutomationSignals } from "./ascend-automation"

type Row = Record<string, unknown>
const resultRows = (value: { rows: unknown }): Row[] => value.rows as Row[]
async function authorisedFounder() {
  if (!ascendAutomationEnabled()) throw new ExpansionError("Operational automation is unavailable.",404)
  const actor = await requireCapability("expansion.manage")
  const check=await db.execute(sql`select role,active,session_version from admin_users where id=${actor.id}`)
  const row=resultRows(check)[0]
  if(!row?.active || Number(row.session_version)!==Number(actor.sessionVersion) ||
     !hasCapability(row.role as AdminRole,"expansion.manage"))
    throw new ExpansionError("Founder authorisation was revoked.",403)
  return actor
}
/** Only internal, reviewable advice is persisted; no commercial entity is mutated. */
export async function syncFounderReviewJobs(now = new Date()) {
  await authorisedFounder()
  const observed = await founderAutomationSignals(now)
  if(observed.signals.length>1200) throw new ExpansionError("Signal volume exceeds the safe review cap.",503)
  let inserted=0
  for(const signal of observed.signals) {
    if(signal.id.length>200 || signal.kind.length>80) continue
    const jobId=randomUUID()
    const result=await db.transaction(async tx=>{
      const r=await tx.execute(sql`insert into ascend_review_jobs
        (id,signal_key,source,kind,payload,observed_at)
        values(${jobId},${signal.id},${signal.source},${signal.kind},
          ${JSON.stringify(signal)}::jsonb,${signal.observedAt}::timestamptz)
        on conflict(signal_key) do nothing returning id`)
      if(!resultRows(r).length)return false
      await tx.execute(sql`insert into ascend_review_job_events(job_id,event,detail)
        values(${jobId},'observed',${JSON.stringify({signalKey:signal.id})}::jsonb)`)
      return true
    })
    if(result) inserted++
  }
  return {observed:observed.signals.length,inserted,alreadyPresent:observed.signals.length-inserted}
}
export async function founderReviewJobQueue() {
  await authorisedFounder()
  const r=await db.execute(sql`select id,signal_key,source,kind,payload,status,attempts,observed_at,
    created_at,updated_at,available_at,last_error from ascend_review_jobs
    order by case status when 'dead' then 0 when 'ready' then 1 when 'pending' then 2 when 'leased' then 3 else 4 end,
    updated_at desc limit 300`)
  return {items:resultRows(r).map(row=>({
    id:String(row.id),key:String(row.signal_key),source:String(row.source),
    kind:String(row.kind),payload:row.payload as AutomationSignal,status:String(row.status),
    attempts:Number(row.attempts),observedAt:String(row.observed_at),
    createdAt:String(row.created_at),updatedAt:String(row.updated_at),
    availableAt:String(row.available_at),error:row.last_error?String(row.last_error):null,
  })),mode:"founder_review_only" as const}
}
/** Claim is safe across replicas: row lock + lease token + bounded attempt count. */
export async function claimInternalReviewJob(now = new Date()) {
  await authorisedFounder()
  const token=randomUUID()
  const job=await db.transaction(async tx=>{
    // Reap exhausted leases first; without this, a crash on attempt five would stay leased forever.
    const expired=await tx.execute(sql`update ascend_review_jobs set status='dead',
      lease_token=null,lease_expires_at=null,updated_at=${now},last_error='Review lease expired after final attempt'
      where status='leased' and lease_expires_at<=${now} and attempts>=5 returning id`)
    for (const item of resultRows(expired)) {
      await tx.execute(sql`insert into ascend_review_job_events(job_id,event,detail)
        values(${item.id},'dead','{"reason":"exhausted_lease"}'::jsonb)`)
    }
    const r=await tx.execute(sql`with next as (
      select id from ascend_review_jobs where
        ((status='pending' and available_at<=${now}) or
         (status='leased' and lease_expires_at<=${now}))
        and attempts < 5
      order by available_at,id for update skip locked limit 1
    )
    update ascend_review_jobs j set status='leased',attempts=j.attempts+1,
      lease_token=${token},lease_expires_at=${new Date(now.getTime()+60000)},
      updated_at=${now} from next where j.id=next.id
    returning j.id,j.signal_key,j.payload,j.attempts`)
    const picked=resultRows(r)[0]
    if(!picked)return null
    await tx.execute(sql`insert into ascend_review_job_events(job_id,event,detail)
      values(${picked.id},'claimed',${JSON.stringify({attempt:Number(picked.attempts)})}::jsonb)`)
    return {id:String(picked.id),token,payload:picked.payload as AutomationSignal,attempt:Number(picked.attempts)}
  })
  return job
}
/** Finalisation is compare-and-set on the claim token. No stale or duplicate completion. */
export async function finishInternalReviewJob(id:string,token:string,success:boolean,now=new Date(),safeError="") {
  await authorisedFounder()
  if(!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(token))
    throw new ExpansionError("Invalid review job lease.",400)
  return db.transaction(async tx=>{
    const r=await tx.execute(sql`select attempts from ascend_review_jobs
      where id=${id} and status='leased' and lease_token=${token}
        and lease_expires_at>${now} for update`)
    const item=resultRows(r)[0]
    if(!item)throw new ExpansionError("Review job claim expired or changed.",409)
    const attempt=Number(item.attempts)
    const status=success?"ready":attempt>=5?"dead":"pending"
    const event=success?"ready":attempt>=5?"dead":"retry"
    const seconds=Math.min(3600,30*2**Math.max(0,attempt-1))
    const available=success||attempt>=5?now:new Date(now.getTime()+seconds*1000)
    await tx.execute(sql`update ascend_review_jobs
      set status=${status},lease_token=null,lease_expires_at=null,
        available_at=${available},last_error=${success?null:safeError.slice(0,240)},
        updated_at=${now}
      where id=${id} and lease_token=${token}`)
    await tx.execute(sql`insert into ascend_review_job_events(job_id,event,detail)
      values(${id},${event},${JSON.stringify({attempt,nextAvailableAt:available.toISOString()})}::jsonb)`)
    return {id,status,attempt,availableAt:available.toISOString()}
  })
}
/** Explicit founder review acknowledgement; never changes the underlying sales/delivery record. */
export async function resolveInternalReviewJob(id:string) {
  const actor=await authorisedFounder()
  if(!/^[0-9a-f-]{36}$/i.test(id))throw new ExpansionError("Invalid review job.",400)
  return db.transaction(async tx=>{
    const r=await tx.execute(sql`update ascend_review_jobs set status='resolved',updated_at=now()
      where id=${id} and status in ('ready','dead') returning id`)
    if(!resultRows(r).length)throw new ExpansionError("Only prepared or dead-letter tasks can be resolved.",409)
    await tx.execute(sql`insert into ascend_review_job_events(job_id,event,detail)
      values(${id},'resolved',${JSON.stringify({by:actor.id})}::jsonb)`)
    return {id,status:"resolved" as const}
  })
}
