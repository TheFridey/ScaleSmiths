import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { PgDialect } from "drizzle-orm/pg-core"
import type { SQL } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const FOUNDER = "10000000-0000-4000-8000-000000000001", USER_A = "10000000-0000-4000-8000-000000000002", USER_B = "10000000-0000-4000-8000-000000000003"
const PARTNER_A = "20000000-0000-4000-8000-000000000001", PARTNER_B = "20000000-0000-4000-8000-000000000002"
const OPP_B = "30000000-0000-4000-8000-000000000002"
const state = vi.hoisted(() => ({ database: null as import("@electric-sql/pglite").PGlite | null, actor: { id: "10000000-0000-4000-8000-000000000001", role: "owner", sessionVersion: 1, active: true } }))
vi.mock("@/lib/db", () => ({ db: { transaction: async (op: (tx: { execute: (q: SQL) => Promise<unknown> }) => Promise<unknown>) => state.database!.transaction(async tx => op({ execute: async s => { const q = new PgDialect().sqlToQuery(s); return tx.query(q.sql, q.params) } })) } }))
vi.mock("./rbac", () => ({ requireCapability: async (c: string) => {
  if ((c === "expansion.manage" && state.actor.role !== "owner") || (c === "expansion.partner" && state.actor.role !== "independent_partner")) throw new Error("Forbidden capability")
  return { ...state.actor }
} }))
import { decideMeeting, getMeetings, getToolkit, getToolkitAdmin, requestMeeting, respondToMeeting, setToolkitItem } from "./expansion-operations"

const asFounder = () => { state.actor = { id: FOUNDER, role: "owner", sessionVersion: 1, active: true } }
const asPartner = (id = USER_A) => { state.actor = { id, role: "independent_partner", sessionVersion: 1, active: true } }
const q = <T extends object = Record<string, unknown>>(sql: string, params: unknown[] = []) => state.database!.query<T>(sql, params)
const future = (days: number) => new Date(Date.now() + days * 86400000).toISOString()
const request = (over: Record<string, unknown> = {}) => requestMeeting({ meetingType: "joint_sales", preferredSlots: [future(3)], timeZone: "Europe/London", purpose: "Joint meeting with a prospect", ...over } as never)

describe("onboarding toolkit and founder meeting requests", () => {
  beforeAll(async () => {
    state.database = new PGlite()
    await state.database.exec(`
      create table admin_users(id uuid primary key,role text,active boolean,session_version integer,display_name text,email text);
      create table expansion_partners(id uuid primary key,user_id uuid references admin_users(id),activated_at timestamptz);
      create table expansion_opportunities(id uuid primary key,partner_id uuid references expansion_partners(id),prospect_id integer);
      create table prospects(id integer primary key,business_name text);
      create table expansion_resources(id uuid primary key,title text,status text,audience text);
      create table expansion_audit(id serial primary key,actor_id uuid,entity_id text,action text,details jsonb);
    `)
    await state.database.exec(readFileSync(new URL("../../../drizzle/0081_expansion_toolkit_meetings.sql", import.meta.url), "utf8"))
  }, 30000)
  beforeEach(async () => {
    await q("truncate expansion_meeting_requests,expansion_toolkit_items,expansion_resources,expansion_opportunities,prospects,expansion_partners,admin_users,expansion_audit restart identity cascade")
    await q("insert into admin_users values($1,'owner',true,1,'Founder','f@example.invalid'),($2,'independent_partner',true,1,'Partner A','a@example.invalid'),($3,'independent_partner',true,1,'Partner B','b@example.invalid')", [FOUNDER, USER_A, USER_B])
    await q("insert into expansion_partners(id,user_id,activated_at) values($1,$2,now()),($3,$4,now())", [PARTNER_A, USER_A, PARTNER_B, USER_B])
    await q("insert into prospects values(1,'Business One'),(2,'Business Two')")
    await q("insert into expansion_opportunities values('30000000-0000-4000-8000-000000000001',$1,1),($2,$3,2)", [PARTNER_A, OPP_B, PARTNER_B])
    asFounder()
  })
  afterAll(async () => { await state.database?.close() })

  it("shows honest defaults: nothing is available until a founder records evidence", async () => {
    asPartner(); const items = await getToolkit()
    const by = Object.fromEntries(items.map(i => [i.key, i]))
    expect(by.email).toMatchObject({ status: "planned", recorded: false }); expect(by.circlecard).toMatchObject({ status: "planned" })
    expect(by.referral_identifier.status).toBe("planned"); expect(by.joint_meetings.status).toBe("planned")
    expect(items.filter(i => ["available", "completed"].includes(i.status))).toEqual([])   // nothing is available until a founder records evidence
  })
  it("a founder records real fulfilment; evidence is mandatory before available or completed", async () => {
    await expect(setToolkitItem({ partnerId: PARTNER_A, itemKey: "email", status: "available" })).rejects.toThrow("fulfilment evidence")
    await expect(setToolkitItem({ partnerId: PARTNER_A, itemKey: "email", status: "available", detail: "   " })).rejects.toThrow()
    await expect(setToolkitItem({ partnerId: PARTNER_A, itemKey: "sms", status: "planned" })).rejects.toThrow("valid status")
    await state.database!.exec("insert into admin_users values('10000000-0000-4000-8000-000000000009','independent_partner',true,1,'Inactive','z@example.invalid'); insert into expansion_partners(id,user_id,activated_at) values('20000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000009',null)")
    await expect(setToolkitItem({ partnerId: "20000000-0000-4000-8000-000000000009", itemKey: "email", status: "planned" })).rejects.toThrow("activated partner")
    await setToolkitItem({ partnerId: PARTNER_A, itemKey: "email", status: "in_preparation", detail: "Mailbox requested from the mail administrator" })
    asPartner(); expect((await getToolkit()).find(i => i.key === "email")).toMatchObject({ status: "in_preparation", recorded: true })
    asFounder(); await setToolkitItem({ partnerId: PARTNER_A, itemKey: "email", status: "completed", detail: "Mailbox created and credentials handed over in person on a synthetic date" })
    asPartner(); expect((await getToolkit()).find(i => i.key === "email")).toMatchObject({ status: "completed" })
    expect((await q("select status from expansion_toolkit_items where partner_id=$1 and item_key='email'", [PARTNER_B])).rows).toEqual([])
    await expect(q("insert into expansion_toolkit_items(id,partner_id,item_key,status,updated_by) values(gen_random_uuid(),$1,'circlecard','available',$2)", [PARTNER_A, FOUNDER])).rejects.toThrow()   // the database refuses unevidenced availability too
    asPartner(USER_B); expect((await getToolkit()).find(i => i.key === "email")?.status).toBe("planned")
  })
  it("only a published partner resource can be associated, and toolkit administration is founder-only", async () => {
    await q("insert into expansion_resources values('60000000-0000-4000-8000-000000000001','Draft guide','draft','partner'),('60000000-0000-4000-8000-000000000002','Pricing guide','published','partner'),('60000000-0000-4000-8000-000000000003','Founder note','published','founder')")
    await expect(setToolkitItem({ partnerId: PARTNER_A, itemKey: "pricing_documents", status: "available", detail: "Guide shared", resourceId: "60000000-0000-4000-8000-000000000001" })).rejects.toThrow("published partner resource")
    await expect(setToolkitItem({ partnerId: PARTNER_A, itemKey: "pricing_documents", status: "available", detail: "Guide shared", resourceId: "60000000-0000-4000-8000-000000000003" })).rejects.toThrow("published partner resource")
    await setToolkitItem({ partnerId: PARTNER_A, itemKey: "pricing_documents", status: "available", detail: "Guide shared", resourceId: "60000000-0000-4000-8000-000000000002" })
    asPartner(); expect((await getToolkit()).find(i => i.key === "pricing_documents")).toMatchObject({ resourceTitle: "Pricing guide" })
    await expect(setToolkitItem({ partnerId: PARTNER_A, itemKey: "email", status: "planned" })).rejects.toThrow("Forbidden capability")
    await expect(getToolkitAdmin()).rejects.toThrow("Forbidden capability")
    asFounder(); expect((await getToolkitAdmin()).partners).toHaveLength(2)
  })
  it("meeting workflow: request, review, information, alternative, confirmation, completion", async () => {
    asPartner(); const { meetingId } = await request({ opportunityId: "30000000-0000-4000-8000-000000000001", meetingType: "bespoke_discovery", context: "Needs a booking system" })
    asFounder(); await decideMeeting({ meetingId, decision: "review" })
    await expect(decideMeeting({ meetingId, decision: "request_information" })).rejects.toThrow("Explain")
    await decideMeeting({ meetingId, decision: "request_information", note: "Which booking provider do they use?" })
    asPartner(); await expect(respondToMeeting({ meetingId, response: "add_information" })).rejects.toThrow("Add the requested")
    await respondToMeeting({ meetingId, response: "add_information", message: "They use Calendly." })
    expect((await q("select status,context from expansion_meeting_requests")).rows[0]).toMatchObject({ status: "requested", context: expect.stringContaining("Calendly") })
    asFounder(); await expect(decideMeeting({ meetingId, decision: "propose_alternative", start: "2020-01-01T10:00:00Z", note: "x" })).rejects.toThrow("future")
    const alt = future(5); await decideMeeting({ meetingId, decision: "propose_alternative", start: alt, note: "I can do this slot" })
    asPartner(); await respondToMeeting({ meetingId, response: "accept_alternative" })
    const confirmed = (await q<{ status: string; confirmed_start: Date }>("select status,confirmed_start from expansion_meeting_requests")).rows[0]
    expect(confirmed.status).toBe("confirmed"); expect(new Date(confirmed.confirmed_start).toISOString()).toBe(new Date(alt).toISOString())
    expect((await getMeetings("partner"))[0]).toMatchObject({ status: "confirmed", business_name: "Business One" })
    asFounder(); await decideMeeting({ meetingId, decision: "complete" })
    expect((await q("select status,confirmed_start is not null conf from expansion_meeting_requests")).rows).toEqual([{ status: "completed", conf: true }])
    await expect(decideMeeting({ meetingId, decision: "cancel", note: "late" })).rejects.toThrow()
    expect(await decideMeeting({ meetingId, decision: "complete" })).toMatchObject({ replayed: true })
    // meetings have no relationship to the commission ledger: founder participation can never alter commission
    expect((await q("select count(*)::int c from information_schema.columns where table_name='expansion_meeting_requests' and column_name ilike '%commission%'")).rows[0]).toEqual({ c: 0 })
  })
  it("validates requests and keeps partners apart", async () => {
    asPartner()
    await expect(request({ meetingType: "social" })).rejects.toThrow("meeting type")
    await expect(request({ timeZone: "Mars/Olympus" })).rejects.toThrow("time zone")
    await expect(request({ preferredSlots: [] })).rejects.toThrow("preferred dates")
    await expect(request({ preferredSlots: ["not a date"] })).rejects.toThrow("preferred dates")
    await expect(request({ opportunityId: OPP_B })).rejects.toThrow("your own opportunities")
    const mine = await request()
    asPartner(USER_B); expect(await getMeetings("partner")).toEqual([])
    await expect(respondToMeeting({ meetingId: mine.meetingId, response: "cancel" })).rejects.toThrow("not found")
    asPartner(); await expect(decideMeeting({ meetingId: mine.meetingId, decision: "confirm", start: future(2) })).rejects.toThrow("Forbidden capability")
    await expect(getMeetings("founder")).rejects.toThrow("Forbidden capability")
    await respondToMeeting({ meetingId: mine.meetingId, response: "cancel" })
    await expect(respondToMeeting({ meetingId: mine.meetingId, response: "cancel" })).rejects.toThrow("no longer be cancelled")
    for (let i = 0; i < 10; i++) await request()
    await expect(request()).rejects.toThrow("too many open")
  })
  it("the database enforces meeting transitions and a confirmed time", async () => {
    asPartner(); const { meetingId } = await request()
    await expect(q("update expansion_meeting_requests set status='completed' where id=$1", [meetingId])).rejects.toThrow()
    await expect(q("update expansion_meeting_requests set status='confirmed' where id=$1", [meetingId])).rejects.toThrow()               // needs a confirmed_start
    await expect(q("update expansion_meeting_requests set meeting_type='training' where id=$1", [meetingId])).rejects.toThrow("immutable")
    await q("update expansion_meeting_requests set status='declined' where id=$1", [meetingId])
    await expect(q("update expansion_meeting_requests set status='requested' where id=$1", [meetingId])).rejects.toThrow("closed")
    await expect(q("delete from expansion_meeting_requests")).rejects.toThrow("append-only")
  })
})
