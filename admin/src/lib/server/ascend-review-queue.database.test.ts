import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { PgDialect } from "drizzle-orm/pg-core"
import { sql, type SQL } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
const A="10000000-0000-4000-8000-000000000001"
const state=vi.hoisted(()=>({
  pg:null as import("@electric-sql/pglite").PGlite|null,
  enabled:true,active:true,sessionVersion:1,
  role:"owner" as "owner"|"independent_partner",
  signals:[{id:"sales:meeting:1",source:"sales_command",kind:"meeting",title:"TEST ONLY appointment",
    explanation:"A meeting awaits review",href:"/expansion",observedAt:"2026-11-23T00:00:00Z",
    recommendedAction:"Review the source record",severity:"attention"}],
}))
vi.mock("@/lib/db",()=>({db:{
  execute:async(statement:SQL)=>{const q=new PgDialect().sqlToQuery(statement);return state.pg!.query(q.sql,q.params)},
  transaction:async(fn:(tx:{execute:(s:SQL)=>Promise<unknown>})=>Promise<unknown>)=>
    state.pg!.transaction(async tx=>fn({execute:async(statement)=>{const q=new PgDialect().sqlToQuery(statement);return tx.query(q.sql,q.params)}})),
}}))
vi.mock("./rbac",()=>({requireCapability:async()=>{
  if(state.role!=="owner")throw Error("Forbidden founder")
  return {id:"10000000-0000-4000-8000-000000000001",role:state.role,sessionVersion:state.sessionVersion}
}}))
vi.mock("./ascend-automation",()=>({
  ascendAutomationEnabled:()=>state.enabled,
  founderAutomationSignals:async()=>({signals:state.signals}),
}))
import { syncFounderReviewJobs, founderReviewJobQueue, claimInternalReviewJob,
  finishInternalReviewJob, resolveInternalReviewJob } from "./ascend-review-queue"
const query=(q:string,values:unknown[]=[])=>state.pg!.query(q,values)
describe("B2.7 durable internal review queue",()=>{
  beforeAll(async()=>{
    state.pg=new PGlite()
    await state.pg.exec(String.raw`
      create function commercial_history_immutable() returns trigger language plpgsql as $$ begin raise exception 'immutable history'; end $$;
      create table admin_users(id uuid primary key,role text,active boolean,session_version integer);
      insert into admin_users values ('10000000-0000-4000-8000-000000000001','owner',true,1);
    `)
    await state.pg.exec(readFileSync(new URL("../../../drizzle/0103_ascend_review_jobs.sql",import.meta.url),"utf8"))
  })
  afterAll(async()=>await state.pg?.close())
  beforeEach(async()=>{
    state.enabled=true;state.active=true;state.sessionVersion=1;state.role="owner"
    await query("truncate ascend_review_job_events,ascend_review_jobs restart identity cascade")
    await query("update admin_users set active=true,session_version=1,role='owner'")
  })
  it("records an observed event once and never duplicates an existing task",async()=>{
    const first=await syncFounderReviewJobs()
    const again=await syncFounderReviewJobs()
    expect(first).toMatchObject({observed:1,inserted:1})
    expect(again).toMatchObject({observed:1,inserted:0,alreadyPresent:1})
    expect((await query("select count(*)::int c from ascend_review_jobs")).rows[0].c).toBe(1)
    expect((await query("select count(*)::int c from ascend_review_job_events")).rows[0].c).toBe(1)
    await expect(query("delete from ascend_review_job_events")).rejects.toThrow(/immutable/)
  })
  it("leases one task, rejects stale lease token and persists successful review",async()=>{
    await syncFounderReviewJobs()
    const now=new Date("2100-11-23T14:00:00Z")
    const claim=await claimInternalReviewJob(now)
    expect(claim).toMatchObject({attempt:1})
    expect(await claimInternalReviewJob(now)).toBeNull()
    await expect(finishInternalReviewJob(claim!.id,"00000000-0000-4000-8000-000000000000",true,now)).rejects.toThrow(/expired or changed/)
    const done=await finishInternalReviewJob(claim!.id,claim!.token,true,new Date(now.getTime()+1000))
    expect(done.status).toBe("ready")
    expect((await founderReviewJobQueue()).items[0].status).toBe("ready")
    expect((await resolveInternalReviewJob(claim!.id)).status).toBe("resolved")
    await expect(resolveInternalReviewJob(claim!.id)).rejects.toThrow(/Only prepared/)
    const events=await query("select event from ascend_review_job_events order by id")
    expect(events.rows.map(r=>r.event)).toEqual(["observed","claimed","ready","resolved"])
  })
  it("backs off after failure and dead-letters on fifth failed attempt",async()=>{
    await syncFounderReviewJobs()
    let time=new Date("2100-11-23T14:00:00Z")
    for(let i=1;i<=5;i++){
      const claim=await claimInternalReviewJob(time)
      expect(claim?.attempt).toBe(i)
      const result=await finishInternalReviewJob(claim!.id,claim!.token,false,new Date(time.getTime()+1000),"SAFE TEST ERROR")
      expect(result.status).toBe(i===5?"dead":"pending")
      expect(result.availableAt).toBeTruthy()
      time=new Date(new Date(result.availableAt).getTime()+1000)
    }
    expect(await claimInternalReviewJob(time)).toBeNull()
    expect((await founderReviewJobQueue()).items[0].status).toBe("dead")
    expect((await query("select count(*)::int c from ascend_review_job_events where event='dead'")).rows[0].c).toBe(1)
  })
  it("recovers a crashed fifth lease by moving it to dead-letter status",async()=>{
    await syncFounderReviewJobs()
    const one=await claimInternalReviewJob(new Date("2100-11-23T14:00:00Z"))
    await query("update ascend_review_jobs set attempts=5,lease_expires_at='2100-11-23T14:00:10Z' where id=$1",[one!.id])
    expect(await claimInternalReviewJob(new Date("2100-11-23T14:01:00Z"))).toBeNull()
    expect((await founderReviewJobQueue()).items[0].status).toBe("dead")
  })
  it("fails closed for disabled feature, inactive founder or changed session",async()=>{
    state.enabled=false
    await expect(syncFounderReviewJobs()).rejects.toThrow(/unavailable/)
    state.enabled=true
    await query("update admin_users set active=false")
    await expect(founderReviewJobQueue()).rejects.toThrow(/revoked/)
    await query("update admin_users set active=true,session_version=2")
    await expect(syncFounderReviewJobs()).rejects.toThrow(/revoked/)
    expect((await query("select count(*)::int c from ascend_review_jobs")).rows[0].c).toBe(0)
  })
})
