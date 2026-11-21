import { AsyncLocalStorage } from "node:async_hooks"
import { randomUUID } from "node:crypto"
import { Pool } from "pg"
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import * as schema from "../../src/lib/schema"
import { hasCapability, type Capability } from "../../src/lib/rbac"

/* Operation Empower B1.5 objection handling against real PostgreSQL, as the restricted admin runtime role in CI. Synthetic fixtures. */
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

import { addSearchSynonym, archiveContentVersion, createContentItem, decideContentVersion, publishContentVersion, startContentRevision, saveContentDraft, submitContentVersion } from "../../src/lib/server/empower-content"
import { searchObjections } from "../../src/lib/server/empower-objections"

function safeUrl(value: string | undefined, variable: string): string {
  if (!value) throw new Error(`${variable} is required.`)
  const url = new URL(value)
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || !["55440", "55444"].includes(url.port) || url.pathname !== "/ss_expansion_test") throw new Error("Objection tests require the designated disposable database.")
  return value
}
// Letters only and unique per run, so full-text search matches this run's rows only.
const suffix = randomUUID().slice(0, 8), tag = `ob${suffix.replace(/[0-9]/g, (d) => "abcdefghij"[Number(d)])}`
const mk = (role: Actor["role"], name: string): Actor => ({ id: randomUUID(), role, active: true, sessionVersion: 1, displayName: `TEST ONLY Objection ${name} ${suffix}` })
const founderA = mk("owner", "founder A"), founderB = mk("owner", "founder B"), partner = mk("independent_partner", "partner"), other = mk("independent_partner", "other partner"), viewer = mk("viewer", "viewer")
let pool: Pool
const runAs = <T>(actor: Actor, operation: () => Promise<T>) => state.actors!.run(actor, operation)
const inMonths = (n: number) => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10) }
const dayAfter = (iso: string) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10) }
const objection = (topic: string, extra: Record<string, unknown> = {}) => ({
  category: "hosting", concern: `Do you do ${topic} ${tag}?`, client_line: `Yes, ${topic} can be part of a build or a managed service ${tag}.`,
  guidance: `Published facts only about ${topic} ${tag}.`, limitation: "No price, uptime figure or deliverability promise.", discovery_questions: ["What do you use now?"],
  escalation_required: "when", escalation_condition: "the client has a live delivery problem", escalation_route: "technical_scoping", ...extra,
})
async function draft(slug: string, fields: Record<string, unknown>, kind = "objection", cadence = "service", audience = "partner_only") {
  return runAs(founderA, () => createContentItem({ kind, slug, audience, cadence, title: String(fields.concern ?? fields.question ?? fields.summary ?? slug), body: kind === "resource" ? "Hosting can be part of a build or a managed service." : "", fields, sourceRefs: ["faq:hosting-provided"] }))
}
async function publish(versionId: string, reviewBy = inMonths(2)) {
  await runAs(founderA, () => submitContentVersion({ versionId }))
  await runAs(founderB, () => decideContentVersion({ versionId, decision: "approved", reference: "TEST ONLY FD-OBJ", notes: "TEST ONLY objection checked", reviewBy }))
  await runAs(founderB, () => publishContentVersion({ versionId }))
}
const slugs = (r: { entries: { slug: string }[] }) => r.entries.map((e) => e.slug).filter((s) => s.endsWith(suffix))
const search = (q: string, extra: Record<string, unknown> = {}, actor = partner, asOf?: string) => runAs(actor, () => searchObjections({ q, ...extra }, asOf ? { asOf } : {}))

describe.skipIf(!process.env.EXPANSION_TEST_DATABASE_URL)("Empower B1.5 objection handling on real PostgreSQL", () => {
  let hosting: { itemId: string; versionId: string }, resource: { itemId: string; versionId: string }, kb: { itemId: string; versionId: string }
  const reviewBy = inMonths(2), kbReviewBy = inMonths(1)
  beforeAll(async () => {
    pool = new Pool({ connectionString: safeUrl(process.env.EXPANSION_TEST_DATABASE_URL, "EXPANSION_TEST_DATABASE_URL"), max: 6 })
    state.database = drizzle(pool, { schema })
    state.actors = new AsyncLocalStorage<Actor>()
    for (const f of [founderA, founderB, viewer]) await pool.query("insert into admin_users(id,email,display_name,password_hash,role,active,session_version) values($1,$2,$3,'test-fixture-not-for-login',$4,true,1)", [f.id, `objection-${f.id}@example.invalid`, f.displayName, f.role])
    for (const p of [partner, other]) {
      const email = `objection-${p.id}@example.invalid`
      const app = await pool.query<{ id: number }>("insert into partner_applications(name,email,region,experience,motivation,privacy_version,status,retention_until,onboarding_confirmations) values($1,$2,'TEST ONLY','Demonstration experience','Isolated objection test only','test-reviewed-v1','activated',now()+interval '30 days','{\"agreement\":true,\"legal\":true,\"independentStatus\":true,\"operations\":true}') returning id", [p.displayName, email])
      await pool.query("insert into admin_users(id,email,display_name,password_hash,role,active,session_version) values($1,$2,$3,'test-fixture-not-for-login','independent_partner',true,1)", [p.id, email, p.displayName])
      await pool.query("insert into expansion_partners(id,user_id,application_id,agreement_version,confirmed_at,activated_at) values($1,$2,$3,'test-reviewed-v1',now(),now())", [randomUUID(), p.id, app.rows[0].id])
    }
    for (const k of ["EMPOWER_FOUNDER_CONTENT_ENABLED", "PARTNER_OBJECTION_HANDLING_ENABLED", "PARTNER_RESOURCE_CENTRE_ENABLED", "PARTNER_KNOWLEDGE_BASE_ENABLED"]) vi.stubEnv(k, "true")
    resource = await draft(`res-obj-${suffix}`, { summary: `Hosting explained ${tag}`, category: "guide" }, "resource", "service", "client_facing")
    await publish(resource.versionId)
    kb = await draft(`kb-obj-${suffix}`, { question: `Do you provide hosting ${tag}?`, answer: "Yes, as part of a build or a managed service.", client_explanation: "Hosting can be included.", limitations: "No price.", escalation_required: "never", topic: "hosting" }, "knowledge", "service", "client_facing")
    await publish(kb.versionId, kbReviewBy)
    hosting = await draft(`obj-hosting-${suffix}`, objection("hosting", { aliases: [`do you host websites ${tag}`], related: [resource.itemId, kb.itemId] }))
    await publish(hosting.versionId)
  })
  afterAll(async () => { vi.unstubAllEnvs(); await pool?.end() })

  it("1-3: drafts and submitted responses stay invisible; published responses appear", async () => {
    const d = await draft(`obj-draft-${suffix}`, objection("email"))
    expect(slugs(await search(`email ${tag}`))).not.toContain(`obj-draft-${suffix}`)
    await runAs(founderA, () => submitContentVersion({ versionId: d.versionId }))
    expect(slugs(await search(`email ${tag}`))).not.toContain(`obj-draft-${suffix}`)
    expect(slugs(await search(`hosting ${tag}`))).toEqual([`obj-hosting-${suffix}`])
  })

  it("4, 9: expired responses and expired related articles disappear", async () => {
    const related = async (asOf: string) => (await search(`hosting ${tag}`, {}, partner, asOf)).entries.find((e) => e.slug === `obj-hosting-${suffix}`)?.related.map((x) => x.kind)
    expect(await related(kbReviewBy)).toEqual(["resource", "knowledge"])        // last valid day of the linked article
    expect(await related(dayAfter(kbReviewBy))).toEqual(["resource"])           // article expired, response still valid: link hidden
    expect(slugs(await search(`hosting ${tag}`, {}, partner, dayAfter(reviewBy)))).toEqual([]) // response expired
  })

  it("5, 13: withdrawal removes a response, and concurrent publication never leaves two live versions", async () => {
    const w = await draft(`obj-withdraw-${suffix}`, objection("domains"))
    await publish(w.versionId)
    expect(slugs(await search(`domains ${tag}`))).toContain(`obj-withdraw-${suffix}`)
    const rev = await runAs(founderA, () => startContentRevision({ itemId: w.itemId, changeSummary: "TEST ONLY wording" }))
    await runAs(founderA, () => saveContentDraft({ versionId: rev.versionId, title: `Do you do domains ${tag}?`, body: "", fields: objection("domains", { client_line: `Yes, domains can be managed for you ${tag}.` }), sourceRefs: ["faq:hosting-provided"] }))
    await runAs(founderA, () => submitContentVersion({ versionId: rev.versionId }))
    await runAs(founderB, () => decideContentVersion({ versionId: rev.versionId, decision: "approved", reference: "TEST ONLY FD-OBJ2", notes: "TEST ONLY revision checked", reviewBy: inMonths(2) }))
    const results = await Promise.allSettled([runAs(founderB, () => publishContentVersion({ versionId: rev.versionId })), runAs(founderA, () => publishContentVersion({ versionId: rev.versionId }))])
    expect(results.filter((x) => x.status === "fulfilled").length).toBeGreaterThanOrEqual(1)
    expect((await pool.query("select count(*)::int n from empower_content_versions where item_id=$1 and status='published'", [w.itemId])).rows).toEqual([{ n: 1 }])
    await runAs(founderB, () => archiveContentVersion({ versionId: rev.versionId, reason: "TEST ONLY withdrawn response" }))
    expect(slugs(await search(`domains ${tag}`))).not.toContain(`obj-withdraw-${suffix}`)
  })

  it("6, 7: invalid categories and partner-only client lines are refused by the service and by the database", async () => {
    await expect(draft(`obj-badcat-${suffix}`, objection("dns", { category: "gossip" }))).rejects.toThrow(/objection category/)
    await expect(draft(`obj-leak-${suffix}`, objection("dns", { client_line: "Your partner earns commission on this." }))).rejects.toThrow(/partner-only terms/)
    await expect(runAs(partner, () => searchObjections({ category: "gossip" }))).rejects.toThrow(/valid category/)
    // A direct write as the runtime role cannot put partner-only terms into the client line, or a bad category into review.
    const ok = await draft(`obj-direct-${suffix}`, objection("dns"))
    await expect(pool.query("update empower_content_versions set fields = fields || '{\"client_line\":\"Ask about the partner commission.\"}'::jsonb where id=$1", [ok.versionId])).rejects.toThrow(/partner-only terms/)
    await expect(pool.query("update empower_content_versions set fields = fields || '{\"category\":\"gossip\"}'::jsonb, status='in_review', submitted_by=$2, submitted_at=now() where id=$1", [ok.versionId, founderA.id])).rejects.toThrow()
    await expect(pool.query("insert into empower_content_items(id,kind,slug,audience,review_cadence_months,created_by) values($1,'objection',$2,'client_facing',6,$3)", [randomUUID(), `obj-public-${suffix}`, founderA.id])).rejects.toThrow(/objection_partner_only/)
  })

  it("8: unapproved related resources are hidden", async () => {
    const hidden = await draft(`res-hidden-${suffix}`, { summary: `Unapproved ${tag}`, category: "guide" }, "resource", "service", "client_facing")
    const o = await draft(`obj-rel-${suffix}`, objection("backups", { related: [hidden.itemId, resource.itemId] }))
    await publish(o.versionId)
    const r = await search(`backups ${tag}`)
    expect(r.entries.find((e) => e.slug === `obj-rel-${suffix}`)!.related.map((x) => x.href)).toEqual([`/partner/resources/res-obj-${suffix}`])
    // A link to something that does not exist is refused by the database guard (the studio only ever offers existing items).
    await expect(draft(`obj-ghost-${suffix}`, objection("ghost", { related: [randomUUID()] }))).rejects.toThrow(/not permitted/)
    await expect(pool.query("update empower_content_versions set fields = fields || jsonb_build_object('related', jsonb_build_array($2::text)) where id=$1", [o.versionId, randomUUID()])).rejects.toThrow()
  })

  it("10, 14: founder permission checks hold and approval attribution cannot be forged", async () => {
    await expect(runAs(viewer, () => createContentItem({ kind: "objection", slug: `obj-viewer-${suffix}`, audience: "partner_only", cadence: "service", title: "x", body: "", fields: objection("x"), sourceRefs: ["x:y"] }))).rejects.toThrow(/Forbidden/)
    await expect(runAs(partner, () => createContentItem({ kind: "objection", slug: `obj-partner-${suffix}`, audience: "partner_only", cadence: "service", title: "x", body: "", fields: objection("x"), sourceRefs: ["x:y"] }))).rejects.toThrow(/Forbidden/)
    const s = await draft(`obj-self-${suffix}`, objection("crm"))
    await runAs(founderA, () => submitContentVersion({ versionId: s.versionId }))
    // The author cannot approve their own submission while another founder is active, whether through the service or a forged row.
    await expect(runAs(founderA, () => decideContentVersion({ versionId: s.versionId, decision: "approved", reference: "TEST", notes: "TEST ONLY self approval", reviewBy: inMonths(2) }))).rejects.toThrow()
    await expect(pool.query("insert into empower_content_approvals(id,version_id,decision,decided_by,reference,notes,review_by) values($1,$2,'approved',$3,'TEST','TEST ONLY forged',current_date+30)", [randomUUID(), s.versionId, founderA.id])).rejects.toThrow()
  })

  it("11, 12: search is deterministic, exact phrasing ranks first, synonyms apply and hostile syntax is inert", async () => {
    const second = await draft(`obj-hosting2-${suffix}`, objection("hosting plans", { concern: `Is hosting included ${tag}?` }))
    await publish(second.versionId)
    const first = await search(`Do you host websites ${tag}?`)
    expect(slugs(first)[0]).toBe(`obj-hosting-${suffix}`)
    const a = slugs(await search(`hosting ${tag}`)), b = slugs(await search(`hosting ${tag}`))
    expect(a).toEqual(b); expect(a).toEqual(expect.arrayContaining([`obj-hosting-${suffix}`, `obj-hosting2-${suffix}`]))
    const term = `zq${tag}`.slice(0, 20)
    await runAs(founderA, () => addSearchSynonym({ term, expansion: `hosting ${tag}` }))
    expect(slugs(await search(term))).toEqual(expect.arrayContaining([`obj-hosting-${suffix}`]))
    for (const hostile of [`'); drop table empower_content_items; --`, `hosting ${tag} & !`, `" OR 1=1 --`, `-hosting ${tag}`, "x".repeat(200)]) await expect(search(hostile)).resolves.toBeTruthy()
    await expect(search("x".repeat(201))).rejects.toThrow(/at most/)
    expect((await pool.query("select count(*)::int n from empower_content_items where slug=$1", [`obj-hosting-${suffix}`])).rows).toEqual([{ n: 1 }])
  })

  it("15: closed while switched off, refused to non-partners and to suspended partners; partners only see shared content", async () => {
    vi.stubEnv("PARTNER_OBJECTION_HANDLING_ENABLED", "false")
    await expect(search(`hosting ${tag}`)).rejects.toMatchObject({ status: 404 })
    vi.stubEnv("PARTNER_OBJECTION_HANDLING_ENABLED", "true")
    await expect(search(`hosting ${tag}`, {}, founderA)).rejects.toThrow(/Forbidden/)
    await expect(search(`hosting ${tag}`, {}, viewer)).rejects.toThrow(/Forbidden/)
    // Another partner sees the same approved material and nothing partner-specific.
    expect(slugs(await search(`hosting ${tag}`, {}, other))).toEqual(slugs(await search(`hosting ${tag}`)))
    await pool.query("update admin_users set active=false, session_version=session_version+1 where id=$1", [other.id])
    await expect(search(`hosting ${tag}`, {}, other)).rejects.toMatchObject({ status: 403 })
  })

  it("16: the restricted public web role cannot read private content tables", async () => {
    const web = new Pool({ connectionString: safeUrl(process.env.EXPANSION_WEB_TEST_DATABASE_URL, "EXPANSION_WEB_TEST_DATABASE_URL"), max: 1 })
    try {
      for (const table of ["empower_content_items", "empower_content_versions", "empower_content_approvals", "empower_search_synonyms"]) await expect(web.query(`select 1 from ${table} limit 1`)).rejects.toThrow(/permission denied/)
    } finally { await web.end() }
  })
})
