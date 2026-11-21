import { AsyncLocalStorage } from "node:async_hooks"
import { randomUUID } from "node:crypto"
import { Pool } from "pg"
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import * as schema from "../../src/lib/schema"
import { hasCapability, type Capability } from "../../src/lib/rbac"

/* Operation Empower B1.3 Resource Centre against real PostgreSQL, as the restricted admin runtime role in CI. Synthetic fixtures. */
type Actor = { id: string; role: "owner" | "independent_partner"; active: boolean; sessionVersion: number; displayName: string }
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

import { addSearchSynonym, archiveContentVersion, createContentItem, decideContentVersion, publishContentVersion, setSearchSynonymActive, submitContentVersion } from "../../src/lib/server/empower-content"
import { downloadResource, getResource, listResources } from "../../src/lib/server/empower-resources"

function safeUrl(value: string | undefined): string {
  if (!value) throw new Error("EXPANSION_TEST_DATABASE_URL is required.")
  const url = new URL(value)
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || !["55440", "55444"].includes(url.port) || url.pathname !== "/ss_expansion_test") throw new Error("Resource tests require the designated disposable database.")
  return value
}
const suffix = randomUUID().slice(0, 8)
const mk = (role: Actor["role"], name: string): Actor => ({ id: randomUUID(), role, active: true, sessionVersion: 1, displayName: `TEST ONLY Resources ${name} ${suffix}` })
const founderA = mk("owner", "founder A"), founderB = mk("owner", "founder B"), partner = mk("independent_partner", "partner"), revoked = mk("independent_partner", "revoked")
let pool: Pool
const runAs = <T>(actor: Actor, operation: () => Promise<T>) => state.actors!.run(actor, operation)
const reviewBy = () => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() + 2); return d.toISOString().slice(0, 10) }
const refused = (p: Promise<unknown>) => p.then(() => { throw new Error("expected a refusal") }, (e: unknown) => String((e as { message?: string }).message ?? e))
// A letters-only token unique to this run, so full-text search can find this run's rows. Digits map to letters, so it is
// never empty even when the random suffix is all digits.
const tag = `rt${suffix.replace(/[0-9]/g, (d) => "abcdefghij"[Number(d)])}`
async function published(slug: string, audience: "client_facing" | "partner_only", title: string, body: string, fields: Record<string, unknown>, kind: "resource" | "lesson" = "resource") {
  const c = await runAs(founderA, () => createContentItem({ kind, slug, audience, cadence: "service", title, body, fields, sourceRefs: ["faq:hosting-provided"] }))
  await runAs(founderA, () => submitContentVersion({ versionId: c.versionId }))
  await runAs(founderB, () => decideContentVersion({ versionId: c.versionId, decision: "approved", reference: "TEST ONLY FD-R", notes: "TEST ONLY checked resource", reviewBy: reviewBy() }))
  await runAs(founderB, () => publishContentVersion({ versionId: c.versionId }))
  return c
}
async function partnerFixture(actor: Actor) {
  const email = `resources-${actor.id}@example.invalid`
  const app = await pool.query<{ id: number }>("insert into partner_applications(name,email,region,experience,motivation,privacy_version,status,retention_until,onboarding_confirmations) values($1,$2,'TEST ONLY','Demonstration experience','Isolated Resource Centre test only','test-reviewed-v1','activated',now()+interval '30 days','{\"agreement\":true,\"legal\":true,\"independentStatus\":true,\"operations\":true}') returning id", [actor.displayName, email])
  await pool.query("insert into admin_users(id,email,display_name,password_hash,role,active,session_version) values($1,$2,$3,'test-fixture-not-for-login',$4,true,1)", [actor.id, email, actor.displayName, actor.role])
  await pool.query("insert into expansion_partners(id,user_id,application_id,agreement_version,confirmed_at,activated_at) values($1,$2,$3,'test-reviewed-v1',now(),now())", [randomUUID(), actor.id, app.rows[0].id])
}
const slugs = (r: { resources: { slug: string }[] }) => r.resources.map((x) => x.slug).filter((s) => s.endsWith(suffix))

describe.skipIf(!process.env.EXPANSION_TEST_DATABASE_URL)("Empower B1.3 Resource Centre on real PostgreSQL", () => {
  let guide: { itemId: string; versionId: string }, reference: { itemId: string; versionId: string }, lesson: { itemId: string; versionId: string }
  beforeAll(async () => {
    pool = new Pool({ connectionString: safeUrl(process.env.EXPANSION_TEST_DATABASE_URL), max: 4 })
    state.database = drizzle(pool, { schema })
    state.actors = new AsyncLocalStorage<Actor>()
    for (const f of [founderA, founderB]) await pool.query("insert into admin_users(id,email,display_name,password_hash,role,active,session_version) values($1,$2,$3,'test-fixture-not-for-login','owner',true,1)", [f.id, `resources-${f.id}@example.invalid`, f.displayName])
    for (const p of [partner, revoked]) await partnerFixture(p)
    vi.stubEnv("EMPOWER_FOUNDER_CONTENT_ENABLED", "true"); vi.stubEnv("PARTNER_RESOURCE_CENTRE_ENABLED", "true"); vi.stubEnv("PARTNER_ACADEMY_ENABLED", "true")
    lesson = await published(`lesson-hosting-${suffix}`, "partner_only", `Hosting lesson ${tag}`, "Hosting can be part of a build or a managed service.", { course_code: "C02", lesson_code: "C02-L2" }, "lesson")
    await runAs(founderA, async () => {
      const c = await createContentItem({ kind: "course", slug: `course-hosting-${suffix}`, audience: "partner_only", cadence: "service", title: `Hosting course ${tag}`, body: "A course used by the Resource Centre test.",
        fields: { category: "services", objectives: ["Explain hosting honestly"], modules: [{ title: "Hosting", lessons: [lesson.itemId] }] }, sourceRefs: ["TEST ONLY"] })
      await submitContentVersion({ versionId: c.versionId })
      await runAs(founderB, () => decideContentVersion({ versionId: c.versionId, decision: "approved", reference: "TEST ONLY FD-C", notes: "TEST ONLY course", reviewBy: reviewBy() }))
      await runAs(founderB, () => publishContentVersion({ versionId: c.versionId }))
    })
    guide = await published(`guide-hosting-${suffix}`, "client_facing", `Hosting guide ${tag}`, `## Hosting ${tag}\n\nHTTPS certificate provisioning and renewal are part of managed hosting.`, { summary: "Hosting, explained for clients", category: "guide", related: [lesson.itemId] })
    reference = await published(`reference-terms-${suffix}`, "partner_only", `Pricing reference ${tag}`, `Published starting prices ${tag}, with the boundary. Partner preparation only.`, { summary: "Published prices", category: "reference" })
  })
  afterAll(async () => { vi.unstubAllEnvs(); await pool?.end() })

  it("is closed while its switch is off and to anyone but active partners", async () => {
    vi.stubEnv("PARTNER_RESOURCE_CENTRE_ENABLED", "false")
    await expect(runAs(partner, () => listResources({}))).rejects.toMatchObject({ status: 404 })
    vi.stubEnv("PARTNER_RESOURCE_CENTRE_ENABLED", "true")
    await expect(runAs(founderA, () => listResources({}))).rejects.toThrow(/Forbidden/)
    await pool.query("update admin_users set active=false where id=$1", [revoked.id])
    await expect(runAs(revoked, () => listResources({}))).rejects.toMatchObject({ status: 403 })
  })

  it("lists only published resources, with category and audience filters", async () => {
    const draft = await runAs(founderA, () => createContentItem({ kind: "resource", slug: `draft-${suffix}`, audience: "client_facing", cadence: "service", title: `Draft resource ${tag}`, body: "Not yet approved, never served to partners.", fields: { summary: "Draft", category: "guide" }, sourceRefs: ["TEST ONLY"] }))
    expect(draft.version).toBe(1)
    const all = await runAs(partner, () => listResources({}))
    expect(slugs(all)).toEqual(expect.arrayContaining([`guide-hosting-${suffix}`, `reference-terms-${suffix}`]))
    expect(slugs(all)).not.toContain(`draft-${suffix}`)
    expect(slugs(await runAs(partner, () => listResources({ category: "guide" })))).toEqual([`guide-hosting-${suffix}`])
    expect(slugs(await runAs(partner, () => listResources({ audience: "partner_only" })))).toEqual([`reference-terms-${suffix}`])
    await expect(runAs(partner, () => listResources({ category: "secret" }))).rejects.toThrow(/valid category/)
    await expect(runAs(partner, () => listResources({ q: "x".repeat(201) }))).rejects.toThrow(/at most 200/)
    expect(slugs(await runAs(partner, () => listResources({ q: `${tag} & | ! ( ' -- ;` })))).toEqual(expect.arrayContaining([`guide-hosting-${suffix}`])) // hostile syntax is just text
  })

  it("ranks deterministically and expands founder-managed synonyms", async () => {
    const hosting = await runAs(partner, () => listResources({ q: `hosting ${tag}` }))
    expect(slugs(hosting)[0]).toBe(`guide-hosting-${suffix}`)
    expect(slugs(await runAs(partner, () => listResources({ q: `hosting ${tag}` })))).toEqual(slugs(hosting))
    const term = `ssl${tag}`.slice(0, 40)
    expect(slugs(await runAs(partner, () => listResources({ q: term })))).toEqual([])
    const syn = await runAs(founderA, () => addSearchSynonym({ term, expansion: `https certificate ${tag}` }))
    expect(slugs(await runAs(partner, () => listResources({ q: term })))).toEqual([`guide-hosting-${suffix}`])
    await expect(runAs(partner, () => addSearchSynonym({ term: "x1", expansion: "y" }))).rejects.toThrow(/Forbidden/)
    expect(await refused(pool.query("update empower_search_synonyms set expansion='rewritten' where id=$1", [syn.id]))).toMatch(/cannot be rewritten/)
    expect(await refused(pool.query("delete from empower_search_synonyms where id=$1", [syn.id]))).toMatch(/permission denied|retained/)
    await runAs(founderA, () => setSearchSynonymActive({ id: syn.id, active: false }))
    expect(slugs(await runAs(partner, () => listResources({ q: term })))).toEqual([])
    const audit = await pool.query("select action from expansion_audit where entity_id=$1 order by id", [syn.id])
    expect(audit.rows.map((r) => r.action)).toEqual(["empower_synonym_added", "empower_synonym_disabled"])
  })

  it("serves one resource with related lessons, and downloads the approved text", async () => {
    const r = await runAs(partner, () => getResource({ slug: `guide-hosting-${suffix}` }))
    expect(r).toMatchObject({ audience: "client_facing", version: 1, category: "guide" })
    expect(r.related).toEqual([{ kind: "lesson", title: `Hosting lesson ${tag}`, href: `/partner/academy/course-hosting-${suffix}?lesson=${lesson.itemId}` }])
    vi.stubEnv("PARTNER_ACADEMY_ENABLED", "false")
    expect((await runAs(partner, () => getResource({ slug: `guide-hosting-${suffix}` }))).related).toEqual([])
    vi.stubEnv("PARTNER_ACADEMY_ENABLED", "true")
    const file = await runAs(partner, () => downloadResource({ slug: `guide-hosting-${suffix}` }))
    expect(file.filename).toBe(`guide-hosting-${suffix}.md`)
    expect(file.text).toContain("Client-facing: approved for sharing")
    expect(file.text).toContain("Version 1, approved")
    expect(file.text).toContain("HTTPS certificate provisioning")
    await expect(runAs(partner, () => getResource({ slug: `draft-${suffix}` }))).rejects.toMatchObject({ status: 404 })
    await expect(runAs(partner, () => getResource({ slug: "../../etc/passwd" }))).rejects.toMatchObject({ status: 404 })
  })

  it("stops serving a withdrawn resource immediately", async () => {
    await runAs(founderB, () => archiveContentVersion({ versionId: reference.versionId, reason: "TEST ONLY withdrawn" }))
    expect(slugs(await runAs(partner, () => listResources({})))).not.toContain(`reference-terms-${suffix}`)
    await expect(runAs(partner, () => downloadResource({ slug: `reference-terms-${suffix}` }))).rejects.toMatchObject({ status: 404 })
    expect(guide.versionId).toBeTruthy()
  })

  it("shows the frozen B0 partner library read-only and labelled, never its client rows", async () => {
    const partnerRow = randomUUID(), clientRow = randomUUID()
    await pool.query("insert into expansion_resources(id,title,category,version,audience,content,status,created_by) values($1,$2,'Legacy',1,'partner','Legacy partner text','published',$3),($4,$5,'Legacy',1,'client','Legacy client text','published',$3)",
      [partnerRow, `Legacy partner ${tag}`, founderA.id, clientRow, `Legacy client ${tag}`])
    const list = await runAs(partner, () => listResources({ q: `legacy partner ${tag}` }))
    expect(list.legacy.map((x) => x.slug)).toContain(`legacy-${partnerRow}`)
    expect(list.legacy.map((x) => x.slug)).not.toContain(`legacy-${clientRow}`)
    expect(await runAs(partner, () => getResource({ slug: `legacy-${partnerRow}` }))).toMatchObject({ legacy: true, body: "Legacy partner text" })
    await expect(runAs(partner, () => getResource({ slug: `legacy-${clientRow}` }))).rejects.toMatchObject({ status: 404 })
  })

  it("gives the public web role no access to search synonyms", async () => {
    if (!process.env.EXPANSION_WEB_TEST_DATABASE_URL) return
    const web = new Pool({ connectionString: process.env.EXPANSION_WEB_TEST_DATABASE_URL, max: 1 })
    try { expect(await refused(web.query("select 1 from empower_search_synonyms limit 1"))).toMatch(/permission denied/) } finally { await web.end() }
  })
})
