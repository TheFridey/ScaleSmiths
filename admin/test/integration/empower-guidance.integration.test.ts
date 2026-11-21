import { AsyncLocalStorage } from "node:async_hooks"
import { randomUUID } from "node:crypto"
import { Pool } from "pg"
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import * as schema from "../../src/lib/schema"
import { hasCapability, type Capability } from "../../src/lib/rbac"

/* Operation Empower B1.6 unified partner workspace against real PostgreSQL, as the restricted admin runtime role. Synthetic fixtures only. */
type Actor = { id: string; role: "owner" | "independent_partner" | "viewer"; active: boolean; sessionVersion: number; displayName: string }
const state = vi.hoisted(() => ({ database: null as NodePgDatabase<typeof schema> | null, actors: null as AsyncLocalStorage<Actor> | null }))
vi.mock("@/lib/db", () => ({ db: {
  execute: (...args: Parameters<NodePgDatabase<typeof schema>["execute"]>) => state.database!.execute(...args),
  transaction: (operation: Parameters<NodePgDatabase<typeof schema>["transaction"]>[0]) => state.database!.transaction(operation),
} }))
vi.mock("../../src/lib/server/rbac", () => ({ requireCapability: async (capability: Capability) => {
  const actor = state.actors?.getStore()
  if (!actor || !hasCapability(actor.role, capability)) throw new Error("Forbidden capability")
  return { ...actor }
} }))

import { archiveContentVersion, createContentItem, decideContentVersion, publishContentVersion, submitContentVersion } from "../../src/lib/server/empower-content"
import { founderMutation, founderSnapshot, partnerMutation } from "../../src/lib/server/expansion"
import { requestMeeting } from "../../src/lib/server/expansion-operations"
import { founderOperations, meetingPreparation, opportunityGuidance, partnerToday, searchGuidance } from "../../src/lib/server/empower-guidance"

function safeUrl(value: string | undefined): string {
  if (!value) throw new Error("EXPANSION_TEST_DATABASE_URL is required.")
  const url = new URL(value)
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || !["55440", "55444"].includes(url.port) || url.pathname !== "/ss_expansion_test") throw new Error("Workspace tests require the designated disposable database.")
  return value
}
const suffix = randomUUID().slice(0, 8), tag = `gw${suffix.replace(/[0-9]/g, (d) => "abcdefghij"[Number(d)])}`
const mk = (role: Actor["role"], name: string): Actor => ({ id: randomUUID(), role, active: true, sessionVersion: 1, displayName: `TEST ONLY Workspace ${name} ${suffix}` })
const founderA = mk("owner", "founder A"), founderB = mk("owner", "founder B"), partnerA = mk("independent_partner", "partner A"), partnerB = mk("independent_partner", "partner B"), viewer = mk("viewer", "viewer")
let pool: Pool
const runAs = <T>(actor: Actor, operation: () => Promise<T>) => state.actors!.run(actor, operation)
const inMonths = (n: number) => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10) }
async function publish(payload: Record<string, unknown>) {
  const c = await runAs(founderA, () => createContentItem(payload as never))
  await runAs(founderA, () => submitContentVersion({ versionId: c.versionId }))
  await runAs(founderB, () => decideContentVersion({ versionId: c.versionId, decision: "approved", reference: "TEST ONLY FD-GW", notes: "TEST ONLY workspace fixture", reviewBy: inMonths(2) }))
  await runAs(founderB, () => publishContentVersion({ versionId: c.versionId }))
  return c
}
const kb = (slug: string, topic: string, audience: "client_facing" | "partner_only", extra: Record<string, unknown> = {}) => ({ kind: "knowledge", slug, audience, cadence: "service", title: `${topic} question ${tag}`, body: "",
  fields: { question: `How does ${topic} work ${tag}?`, answer: `Precise partner answer about ${topic} ${tag}.`, client_explanation: audience === "client_facing" ? `Client-safe explanation of ${topic} ${tag}.` : "none. Partner only.", limitations: "No price or timeline.", escalation_required: "never", topic, ...extra }, sourceRefs: ["faq:test"] })
const financial = async () => (await pool.query(`select md5(coalesce(string_agg(x, '|' order by x), '')) h from (
  select 'l'||l::text x from expansion_commission_ledger l union all select 'p'||p::text from expansion_payouts p union all select 'w'||w::text from expansion_withdrawal_requests w
  union all select 'c'||c::text from expansion_contracts c union all select 'o'||o.id||o.status from expansion_opportunities o) t`)).rows[0].h as string

describe.skipIf(!process.env.EXPANSION_TEST_DATABASE_URL)("Empower B1.6 unified partner workspace on real PostgreSQL", () => {
  let oppA = "", oppB = "", meetingA = "", meetingB = ""
  beforeAll(async () => {
    pool = new Pool({ connectionString: safeUrl(process.env.EXPANSION_TEST_DATABASE_URL), max: 6 })
    state.database = drizzle(pool, { schema })
    state.actors = new AsyncLocalStorage<Actor>()
    for (const f of [founderA, founderB, viewer]) await pool.query("insert into admin_users(id,email,display_name,password_hash,role,active,session_version) values($1,$2,$3,'test-fixture-not-for-login',$4,true,1)", [f.id, `gw-${f.id}@example.invalid`, f.displayName, f.role])
    for (const p of [partnerA, partnerB]) {
      const email = `gw-${p.id}@example.invalid`
      const app = await pool.query<{ id: number }>("insert into partner_applications(name,email,region,experience,motivation,privacy_version,status,retention_until,onboarding_confirmations) values($1,$2,'TEST ONLY','Demonstration experience','Isolated workspace test only','test-reviewed-v1','activated',now()+interval '30 days','{\"agreement\":true,\"legal\":true,\"independentStatus\":true,\"operations\":true}') returning id", [p.displayName, email])
      await pool.query("insert into admin_users(id,email,display_name,password_hash,role,active,session_version) values($1,$2,$3,'test-fixture-not-for-login','independent_partner',true,1)", [p.id, email, p.displayName])
      await pool.query("insert into expansion_partners(id,user_id,application_id,agreement_version,confirmed_at,activated_at,operating_country) values($1,$2,$3,'test-reviewed-v1',now(),now(),'GB')", [randomUUID(), p.id, app.rows[0].id])
    }
    for (const k of ["EMPOWER_FOUNDER_CONTENT_ENABLED", "PARTNER_UNIFIED_WORKSPACE_ENABLED", "PARTNER_RESOURCE_CENTRE_ENABLED", "PARTNER_KNOWLEDGE_BASE_ENABLED", "PARTNER_ACADEMY_ENABLED"]) vi.stubEnv(k, "true")
    await publish(kb(`kb-seo-${suffix}`, "seo", "client_facing"))
    await publish(kb(`kb-crm-${suffix}`, "crm", "partner_only"))
    await publish({ kind: "resource", slug: `res-seo-${suffix}`, audience: "client_facing", cadence: "service", title: `SEO guide ${tag}`, body: "How search visibility works for small businesses.", fields: { summary: `Client-safe SEO summary ${tag}`, category: "guide" }, sourceRefs: ["faq:test"] })
    await publish({ kind: "resource", slug: `res-internal-${suffix}`, audience: "partner_only", cadence: "service", title: `Internal pricing notes ${tag}`, body: "Partner-only pricing context for search work.", fields: { summary: `Partner-only summary ${tag}`, category: "reference" }, sourceRefs: ["faq:test"] })
    await runAs(founderA, () => createContentItem(kb(`kb-draft-${suffix}`, "seo", "client_facing") as never))
    const withdrawn = await publish(kb(`kb-withdrawn-${suffix}`, "seo", "client_facing"))
    await runAs(founderB, () => archiveContentVersion({ versionId: withdrawn.versionId, reason: "TEST ONLY withdrawn" }))
    await runAs(founderA, () => founderMutation({ action: "set_market", countryCode: "GB", countryName: "United Kingdom", status: "approved", planKeys: ["standard-v2"], legalReviewed: true, accountingReviewed: true, privacyReviewed: true, operationsReviewed: true, approvalReference: `TEST ONLY ${suffix}` }))
    oppA = await runAs(partnerA, async () => {
      const r = await partnerMutation({ action: "register", country: "GB", businessName: `TEST ONLY Prospect A ${suffix}`, website: `gw-a-${suffix}.example`, contactName: "Test director" }) as { id: string }
      await partnerMutation({ action: "discovery", id: r.id, discovery: { objectives: "More enquiries", seoConcerns: "Not found on Google", integrations: "Connect to our CRM" } })
      return r.id
    })
    oppB = await runAs(partnerB, async () => (await partnerMutation({ action: "register", country: "GB", businessName: `TEST ONLY Prospect B ${suffix}`, website: `gw-b-${suffix}.example`, contactName: "Test director" }) as { id: string }).id)
    const slot = new Date(Date.now() + 5 * 86400000).toISOString()
    meetingA = String((await runAs(partnerA, () => requestMeeting({ meetingType: "technical_scoping", opportunityId: oppA, preferredSlots: [slot], timeZone: "Europe/London", purpose: `TEST ONLY scoping ${tag}` })) as { meetingId: string }).meetingId)
    meetingB = String((await runAs(partnerB, () => requestMeeting({ meetingType: "joint_sales", opportunityId: oppB, preferredSlots: [slot], timeZone: "Europe/London", purpose: `TEST ONLY joint ${tag}` })) as { meetingId: string }).meetingId)
  })
  afterAll(async () => { vi.unstubAllEnvs(); await pool?.end() })

  it("is closed while switched off and to anyone but active partners", async () => {
    vi.stubEnv("PARTNER_UNIFIED_WORKSPACE_ENABLED", "false")
    await expect(runAs(partnerA, () => searchGuidance({ q: "seo" }))).rejects.toMatchObject({ status: 404 })
    await expect(runAs(partnerA, () => partnerToday())).rejects.toMatchObject({ status: 404 })
    vi.stubEnv("PARTNER_UNIFIED_WORKSPACE_ENABLED", "true")
    for (const actor of [founderA, viewer]) await expect(runAs(actor, () => searchGuidance({ q: "seo" }))).rejects.toThrow(/Forbidden/)
  })

  it("searches every module but serves only published, in-date, switched-on content, with client-safe copy decided by the server", async () => {
    const r = await runAs(partnerA, () => searchGuidance({ q: `seo ${tag}` }))
    const titles = r.results.map((x) => x.title)
    expect(titles).toEqual(expect.arrayContaining([`How does seo work ${tag}?`, `SEO guide ${tag}`]))
    expect(JSON.stringify(r)).not.toMatch(/kb-draft|kb-withdrawn/)
    expect(r.results.filter((x) => x.title === `How does seo work ${tag}?`)).toHaveLength(1)
    const answer = r.results.find((x) => x.title === `How does seo work ${tag}?`)!
    expect(answer).toMatchObject({ type: "answer", audience: "client_facing", copy: `Client-safe explanation of seo ${tag}.` })
    expect(r.results.find((x) => x.title === `SEO guide ${tag}`)).toMatchObject({ type: "resource", copy: `Client-safe SEO summary ${tag}` })
    const internal = (await runAs(partnerA, () => searchGuidance({ q: `pricing notes ${tag}` }))).results.find((x) => x.title === `Internal pricing notes ${tag}`)!
    expect(internal).toMatchObject({ audience: "partner_only", copy: null })
    const crm = (await runAs(partnerA, () => searchGuidance({ q: `crm ${tag}` }))).results.find((x) => x.type === "answer")!
    expect(crm).toMatchObject({ audience: "partner_only", copy: null })
    // A module that is switched off contributes nothing.
    vi.stubEnv("PARTNER_RESOURCE_CENTRE_ENABLED", "false")
    expect((await runAs(partnerA, () => searchGuidance({ q: `seo ${tag}` }))).results.map((x) => x.type)).not.toContain("resource")
    vi.stubEnv("PARTNER_RESOURCE_CENTRE_ENABLED", "true")
  })

  it("ranks exact matches first, deterministically, and rejects hostile or invalid input", async () => {
    const exact = await runAs(partnerA, () => searchGuidance({ q: `SEO guide ${tag}` }))
    expect(exact.results[0].title).toBe(`SEO guide ${tag}`)
    const a = await runAs(partnerA, () => searchGuidance({ q: `seo ${tag}` })), b = await runAs(partnerA, () => searchGuidance({ q: `seo ${tag}` }))
    expect(a.results.map((x) => x.href)).toEqual(b.results.map((x) => x.href))
    for (const hostile of [`'); drop table empower_content_items; --`, `" or 1=1 --`, `seo & !${tag}`, "x".repeat(200)]) await expect(runAs(partnerA, () => searchGuidance({ q: hostile }))).resolves.toBeTruthy()
    await expect(runAs(partnerA, () => searchGuidance({ q: "x".repeat(201) }))).rejects.toThrow(/at most/)
    await expect(runAs(partnerA, () => searchGuidance({ type: "founder_notes" }))).rejects.toThrow(/valid content type/)
  })

  it("gives contextual guidance for the partner's own prospect only, chosen from what they recorded", async () => {
    const g = await runAs(partnerA, () => opportunityGuidance(oppA))
    expect(g.reasons.map((r) => r.id)).toEqual(expect.arrayContaining(["existing-website", "seo", "automation"]))
    expect(g.guidance.map((x) => x.title)).toEqual(expect.arrayContaining([`How does seo work ${tag}?`, `How does crm work ${tag}?`]))
    expect(g.opportunity.status.label).toBeTruthy()
    expect(g.meetings).toEqual([expect.objectContaining({ id: meetingA, statusKey: "requested", status: expect.objectContaining({ label: "Meeting requested" }) })])
    await expect(runAs(partnerB, () => opportunityGuidance(oppA))).rejects.toMatchObject({ status: 404 })
    await expect(runAs(partnerA, () => opportunityGuidance("not-a-uuid"))).rejects.toMatchObject({ status: 404 })
  })

  it("prepares the partner's own meetings and never presents a request as a booking", async () => {
    const prep = await runAs(partnerA, () => meetingPreparation(meetingA))
    expect(prep.meeting).toMatchObject({ type: "technical_scoping", statusKey: "requested", confirmedStart: null })
    expect(prep.meeting.status.meaning).toMatch(/not booked/i)
    expect(prep.opportunity?.recorded.map((r) => r.field)).toEqual(expect.arrayContaining(["seoConcerns", "integrations"]))
    await expect(runAs(partnerA, () => meetingPreparation(meetingB))).rejects.toMatchObject({ status: 404 })
    await expect(runAs(partnerB, () => meetingPreparation(meetingA))).rejects.toMatchObject({ status: 404 })
  })

  it("shows each partner only their own day", async () => {
    const a = await runAs(partnerA, () => partnerToday()), b = await runAs(partnerB, () => partnerToday())
    expect(a.opportunities.map((o) => o.id)).toEqual([oppA]); expect(b.opportunities.map((o) => o.id)).toEqual([oppB])
    expect(a.meetings.map((m) => m.id)).toEqual([meetingA]); expect(JSON.stringify(a)).not.toMatch(new RegExp(`Prospect B ${suffix}|${meetingB}`))
  })

  it("gives founders a queue over real records, and refuses suspended partners", async () => {
    const ops = await state.database!.transaction((tx) => founderOperations(tx))
    expect(ops.meetings.map((m) => String((m as Record<string, unknown>).id))).toEqual(expect.arrayContaining([meetingA, meetingB]))
    expect((await runAs(founderA, () => founderSnapshot())).operations.meetings.length).toBeGreaterThanOrEqual(2)
    await pool.query("update admin_users set active=false, session_version=session_version+1 where id=$1", [partnerB.id])
    await expect(runAs(partnerB, () => partnerToday())).rejects.toMatchObject({ status: 403 })
    await expect(runAs(partnerB, () => searchGuidance({ q: "seo" }))).rejects.toMatchObject({ status: 403 })
  })

  it("never changes commercial or financial records", async () => {
    const before = await financial()
    for (let i = 0; i < 3; i++) {
      await runAs(partnerA, () => searchGuidance({ q: `seo ${tag}` })); await runAs(partnerA, () => opportunityGuidance(oppA))
      await runAs(partnerA, () => meetingPreparation(meetingA)); await runAs(partnerA, () => partnerToday())
    }
    expect(await financial()).toBe(before)
    expect((await pool.query("select status from expansion_meeting_requests where id=$1", [meetingA])).rows).toEqual([{ status: "requested" }])
  })
})
