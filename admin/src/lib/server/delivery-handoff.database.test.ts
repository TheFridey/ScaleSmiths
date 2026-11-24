import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { PgDialect } from "drizzle-orm/pg-core"
import { sql, type SQL } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
const F = "10000000-0000-4000-8000-000000000001", A = "10000000-0000-4000-8000-000000000002"
const B = "10000000-0000-4000-8000-000000000003", PA = "20000000-0000-4000-8000-000000000001"
const PB = "20000000-0000-4000-8000-000000000002", O = "30000000-0000-4000-8000-000000000001"
const C = "40000000-0000-4000-8000-000000000001"
const state=vi.hoisted(()=>({
  database:null as import("@electric-sql/pglite").PGlite|null,
  actor:{id:"10000000-0000-4000-8000-000000000001",role:"owner",sessionVersion:1,active:true,displayName:"Founder",email:"founder@example.invalid"},
  failCreation:false,
}))
vi.mock("@/lib/db",()=>({db:{transaction:async(op:(tx:{execute:(q:SQL)=>Promise<unknown>})=>Promise<unknown>)=>
  state.database!.transaction(async(tx)=>op({execute:async(statement)=>{const q=new PgDialect().sqlToQuery(statement);return tx.query(q.sql,q.params)}}))}}))
vi.mock("./rbac",()=>({requireCapability:async(c:string)=>{
  if(c==="expansion.manage" && state.actor.role!=="owner")throw Error("Founder capability denied")
  if(c==="expansion.partner" && state.actor.role!=="independent_partner")throw Error("Partner capability denied")
  return {...state.actor}
}}))
vi.mock("./empower-partner",()=>({partnerGuard:async(_tx:unknown,actor:{id:string;active:boolean;sessionVersion:number})=>{
  if(!actor.active||actor.sessionVersion!==1)throw Error("Partner is inactive")
  return actor.id===A?PA:actor.id===B?PB: (()=>{throw Error("Partner absent")})()
}}))
vi.mock("./delivery-project-service",()=>({createDeliveryProjectWithTx:async(tx:{execute:(q:SQL)=>Promise<{rows:Record<string,unknown>[]}>},input:Record<string,unknown>)=>{
  if(state.failCreation)throw Error("Delivery creation failed")
  const r=await tx.execute(sql`insert into delivery_projects(client_id,client_visible,client_status) values(${input.clientId},false,'planning') returning id`)
  return {id:Number(r.rows[0].id)}
}}))
import { approveDeliveryHandoff, founderHandoffQueue, partnerDeliveryHandoffs } from "./delivery-handoff"
const q=(query:string,params:unknown[]=[])=>state.database!.query<Record<string, unknown>>(query,params)
const approval=()=>({opportunityId:O,expectedContractId:C,confirm:true,reason:"Founder checked the signed agreement and accepted delivery scope."})
describe("B2.6 contract to delivery integration with disposable PostgreSQL",()=>{
  beforeAll(async()=>{
    state.database=new PGlite()
    await state.database.exec(String.raw`
      create function commercial_history_immutable() returns trigger language plpgsql as $$ begin raise exception 'history is immutable'; end $$;
      create table admin_users(id uuid primary key,role text,active boolean,session_version integer,display_name text);
      create table clients(id integer primary key);
      create table expansion_partners(id uuid primary key,user_id uuid);
      create table prospects(id integer primary key,business_name text);
      create table expansion_opportunities(id uuid primary key,partner_id uuid,prospect_id int,client_id int,status text);
      create table expansion_contracts(id uuid primary key,opportunity_id uuid unique,client_id int,accepted_at timestamptz,agreement_reference text,scope_version int,scope_snapshot jsonb);
      create table expansion_contract_cancellations(contract_id uuid primary key);
      create table delivery_projects(id serial primary key,client_id int,client_visible boolean default false,client_status text default 'planning',client_next_step text);
      create table expansion_audit(id serial primary key,actor_id uuid,entity_id text,action text,details jsonb);
      insert into admin_users values ('10000000-0000-4000-8000-000000000001','owner',true,1),
      ('10000000-0000-4000-8000-000000000002','independent_partner',true,1),
      ('10000000-0000-4000-8000-000000000003','independent_partner',true,1);
      insert into clients values(11),(12);
      insert into expansion_partners values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002'),
      ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003');
      insert into prospects values (1,'Example Builders');
      insert into expansion_opportunities values ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',1,11,'contract_accepted');
      insert into expansion_contracts values ('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',11,'2026-11-22T00:00:00Z','SIGNED-001',2,'{"services":["website"]}');
    `)
    await state.database.exec(readFileSync(new URL("../../../drizzle/0102_ascend_delivery_handoffs.sql",import.meta.url),"utf8"))
  })
  afterAll(async()=>await state.database?.close())
  beforeEach(async()=>{
    vi.stubEnv("DELIVERY_HANDOFF_ENABLED","true")
    state.actor={id:F,role:"owner",sessionVersion:1,active:true,displayName:"Founder",email:"founder@example.invalid"}
    state.failCreation=false
    await q("truncate expansion_delivery_handoffs, expansion_audit, delivery_projects restart identity cascade")
    await q("delete from expansion_contract_cancellations")
    await q("update expansion_contracts set client_id=11")
    await q("update expansion_opportunities set client_id=11,status='contract_accepted'")
    await q("update admin_users set active=true,session_version=1 where id=$1",[F])
  })
  it("does not show or mutate anything while switched off",async()=>{
    vi.stubEnv("DELIVERY_HANDOFF_ENABLED","false")
    await expect(founderHandoffQueue()).rejects.toThrow(/unavailable/)
    await expect(approveDeliveryHandoff(approval())).rejects.toThrow(/unavailable/)
    expect((await q("select count(*)::int c from delivery_projects")).rows[0].c).toBe(0)
  })
  it("creates exactly one internal project, immutable linkage and audit, with replay idempotence",async()=>{
    const before=await founderHandoffQueue()
    expect(before.candidates[0].readiness.ready).toBe(true)
    const a=await approveDeliveryHandoff(approval())
    const again=await approveDeliveryHandoff(approval())
    expect(a.replay).toBe(false)
    expect(again).toMatchObject({id:a.id,deliveryProjectId:a.deliveryProjectId,replay:true})
    expect((await q("select count(*)::int c from delivery_projects")).rows[0].c).toBe(1)
    expect((await q("select count(*)::int c from expansion_delivery_handoffs")).rows[0].c).toBe(1)
    expect((await q("select count(*)::int c from expansion_audit where action='delivery_handoff_approved'")).rows[0].c).toBe(1)
    await expect(q("update expansion_delivery_handoffs set founder_reason='tampered'")).rejects.toThrow(/immutable/)
    state.actor={...state.actor,id:A,role:"independent_partner"}
    const own=await partnerDeliveryHandoffs()
    expect(own.handoffs).toHaveLength(1)
    expect(own.handoffs[0]).toMatchObject({opportunityId:O,businessName:"Example Builders",status:"accepted_for_delivery",delivery:null})
    expect(JSON.stringify(own)).not.toContain("Founder checked")
    expect(JSON.stringify(own)).not.toContain("deliveryProjectId")
    state.actor={...state.actor,id:B}
    expect((await partnerDeliveryHandoffs()).handoffs).toHaveLength(0)
  })
  it("rejects cancelled contracts, stale contract IDs, client mismatch and revoked founder sessions",async()=>{
    await q("insert into expansion_contract_cancellations values($1)",[C])
    await expect(approveDeliveryHandoff(approval())).rejects.toThrow(/cancellation/)
    await q("delete from expansion_contract_cancellations")
    await expect(approveDeliveryHandoff({...approval(),expectedContractId:"40000000-0000-4000-8000-000000000002"})).rejects.toThrow(/changed/)
    await q("update expansion_contracts set client_id=12")
    await expect(approveDeliveryHandoff(approval())).rejects.toThrow(/same existing client/)
    await q("update expansion_contracts set client_id=11")
    await q("update admin_users set session_version=2 where id=$1",[F])
    await expect(approveDeliveryHandoff(approval())).rejects.toThrow(/revoked/)
    expect((await q("select count(*)::int c from delivery_projects")).rows[0].c).toBe(0)
  })
  it("rolls back all changes if the existing delivery creator fails",async()=>{
    state.failCreation=true
    await expect(approveDeliveryHandoff(approval())).rejects.toThrow(/Delivery creation failed/)
    expect((await q("select count(*)::int c from expansion_delivery_handoffs")).rows[0].c).toBe(0)
    expect((await q("select count(*)::int c from delivery_projects")).rows[0].c).toBe(0)
    expect((await q("select count(*)::int c from expansion_audit")).rows[0].c).toBe(0)
  })
})
