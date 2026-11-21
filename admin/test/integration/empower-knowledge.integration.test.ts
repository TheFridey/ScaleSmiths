import { AsyncLocalStorage } from "node:async_hooks"
import { randomUUID } from "node:crypto"
import { Pool } from "pg"
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import * as schema from "../../src/lib/schema"
import { hasCapability, type Capability } from "../../src/lib/rbac"

/* Operation Empower B1.4 Knowledge Base against real PostgreSQL, as the restricted admin runtime role in CI. Synthetic fixtures. */
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

import { archiveContentVersion, createContentItem, decideContentVersion, publishContentVersion, submitContentVersion } from "../../src/lib/server/empower-content"
import { searchKnowledge } from "../../src/lib/server/empower-knowledge"

function safeUrl(value: string | undefined): string {
  if (!value) throw new Error("EXPANSION_TEST_DATABASE_URL is required.")
  const url = new URL(value)
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || !["55440", "55444"].includes(url.port) || url.pathname !== "/ss_expansion_test") throw new Error("Knowledge tests require the designated disposable database.")
  return value
}
const suffix = randomUUID().slice(0, 8), tag = suffix.replace(/[0-9]/g, "") || "kbtag"
const mk = (role: Actor["role"], name: string): Actor => ({ id: randomUUID(), role, active: true, sessionVersion: 1, displayName: `TEST ONLY Knowledge ${name} ${suffix}` })
const founderA = mk("owner", "founder A"), founderB = mk("owner", "founder B"), partner = mk("independent_partner", "partner")
let pool: Pool
const runAs = <T>(actor: Actor, operation: () => Promise<T>) => state.actors!.run(actor, operation)
const reviewBy = () => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() + 2); return d.toISOString().slice(0, 10) }
const entry = (question: string, topic: string, extra: Record<string, unknown> = {}) => ({ question, answer: `Answer about ${topic} ${tag}.`, client_explanation: `Client-safe explanation about ${topic} ${tag}.`,
  limitations: "No price or timeline.", escalation_required: "when", escalation_condition: "the client needs a price", escalation_route: "technical_scoping", topic, ...extra })
async function published(slug: string, audience: "client_facing" | "partner_only", fields: Record<string, unknown>, cadence = "service") {
  const c = await runAs(founderA, () => createContentItem({ kind: "knowledge", slug, audience, cadence, title: String(fields.question), body: "", fields, sourceRefs: ["faq:hosting-provided"] }))
  await runAs(founderA, () => submitContentVersion({ versionId: c.versionId }))
  await runAs(founderB, () => decideContentVersion({ versionId: c.versionId, decision: "approved", reference: "TEST ONLY FD-K", notes: "TEST ONLY checked entry", reviewBy: reviewBy() }))
  await runAs(founderB, () => publishContentVersion({ versionId: c.versionId }))
  return c
}
const mine = (r: { entries: { slug: string }[] }) => r.entries.map((e) => e.slug).filter((s) => s.endsWith(suffix))

describe.skipIf(!process.env.EXPANSION_TEST_DATABASE_URL)("Empower B1.4 Knowledge Base on real PostgreSQL", () => {
  let hosting: { itemId: string; versionId: string }, included: { versionId: string }
  beforeAll(async () => {
    pool = new Pool({ connectionString: safeUrl(process.env.EXPANSION_TEST_DATABASE_URL), max: 4 })
    state.database = drizzle(pool, { schema })
    state.actors = new AsyncLocalStorage<Actor>()
    for (const f of [founderA, founderB]) await pool.query("insert into admin_users(id,email,display_name,password_hash,role,active,session_version) values($1,$2,$3,'test-fixture-not-for-login','owner',true,1)", [f.id, `knowledge-${f.id}@example.invalid`, f.displayName])
    const email = `knowledge-${partner.id}@example.invalid`
    const app = await pool.query<{ id: number }>("insert into partner_applications(name,email,region,experience,motivation,privacy_version,status,retention_until,onboarding_confirmations) values($1,$2,'TEST ONLY','Demonstration experience','Isolated Knowledge Base test only','test-reviewed-v1','activated',now()+interval '30 days','{\"agreement\":true,\"legal\":true,\"independentStatus\":true,\"operations\":true}') returning id", [partner.displayName, email])
    await pool.query("insert into admin_users(id,email,display_name,password_hash,role,active,session_version) values($1,$2,$3,'test-fixture-not-for-login','independent_partner',true,1)", [partner.id, email, partner.displayName])
    await pool.query("insert into expansion_partners(id,user_id,application_id,agreement_version,confirmed_at,activated_at) values($1,$2,$3,'test-reviewed-v1',now(),now())", [randomUUID(), partner.id, app.rows[0].id])
    vi.stubEnv("EMPOWER_FOUNDER_CONTENT_ENABLED", "true"); vi.stubEnv("PARTNER_KNOWLEDGE_BASE_ENABLED", "true"); vi.stubEnv("PARTNER_RESOURCE_CENTRE_ENABLED", "true")
    hosting = await published(`kb-hosting-${suffix}`, "client_facing", entry(`Do you provide hosting ${tag}?`, "hosting", { aliases: [`do you do web hosting ${tag}`] }))
    included = await published(`kb-included-${suffix}`, "client_facing", entry(`Is hosting included in a Growth Partnership ${tag}?`, "hosting"))
    await published(`kb-commission-${suffix}`, "partner_only", entry(`How is my commission calculated ${tag}?`, "commission", { client_explanation: "none. Partner only.", escalation_required: "always", escalation_condition: undefined, escalation_route: "commercial_assistance" }), "commercial")
  })
  afterAll(async () => { vi.unstubAllEnvs(); await pool?.end() })

  it("is closed while its switch is off and to anyone but active partners", async () => {
    vi.stubEnv("PARTNER_KNOWLEDGE_BASE_ENABLED", "false")
    await expect(runAs(partner, () => searchKnowledge({ q: "hosting" }))).rejects.toMatchObject({ status: 404 })
    vi.stubEnv("PARTNER_KNOWLEDGE_BASE_ENABLED", "true")
    await expect(runAs(founderA, () => searchKnowledge({ q: "hosting" }))).rejects.toThrow(/Forbidden/)
  })

  it("ranks an exact alias or question match first, deterministically", async () => {
    const byAlias = await runAs(partner, () => searchKnowledge({ q: `Do you do web hosting ${tag}?` }))
    expect(mine(byAlias)[0]).toBe(`kb-hosting-${suffix}`)
    const byQuestion = await runAs(partner, () => searchKnowledge({ q: `is hosting included in a growth partnership ${tag}` }))
    expect(mine(byQuestion)[0]).toBe(`kb-included-${suffix}`)
    const general = await runAs(partner, () => searchKnowledge({ q: `hosting ${tag}` }))
    expect(mine(general)).toEqual(expect.arrayContaining([`kb-hosting-${suffix}`, `kb-included-${suffix}`]))
    expect(mine(await runAs(partner, () => searchKnowledge({ q: `hosting ${tag}` })))).toEqual(mine(general))
  })

  it("returns the precise answer, client explanation, limitation, escalation and sources; partner-only has no client line", async () => {
    const r = await runAs(partner, () => searchKnowledge({ q: `Do you provide hosting ${tag}?` }))
    expect(r.entries.find((e) => e.slug === `kb-hosting-${suffix}`)).toMatchObject({ audience: "client_facing", clientExplanation: `Client-safe explanation about hosting ${tag}.`, limitations: "No price or timeline.",
      escalation: { required: "when", condition: "the client needs a price", route: "technical_scoping" }, sources: ["faq:hosting-provided"], version: 1 })
    const c = await runAs(partner, () => searchKnowledge({ topic: "commission" }))
    expect(c.entries.find((e) => e.slug === `kb-commission-${suffix}`)).toMatchObject({ audience: "partner_only", clientExplanation: null, escalation: { required: "always", route: "commercial_assistance" } })
    await expect(runAs(partner, () => searchKnowledge({ topic: "secrets" }))).rejects.toThrow(/valid topic/)
  })

  it("never returns drafts or withdrawn entries, and links related published resources", async () => {
    await runAs(founderA, () => createContentItem({ kind: "knowledge", slug: `kb-draft-${suffix}`, audience: "client_facing", cadence: "service", title: `Draft hosting ${tag}`, body: "", fields: entry(`Draft hosting ${tag}?`, "hosting"), sourceRefs: ["TEST"] }))
    expect(mine(await runAs(partner, () => searchKnowledge({ q: `draft hosting ${tag}` })))).not.toContain(`kb-draft-${suffix}`)
    await runAs(founderB, () => archiveContentVersion({ versionId: included.versionId, reason: "TEST ONLY withdrawn entry" }))
    expect(mine(await runAs(partner, () => searchKnowledge({ q: `hosting ${tag}` })))).not.toContain(`kb-included-${suffix}`)
    const res = await runAs(founderA, () => createContentItem({ kind: "resource", slug: `res-kb-${suffix}`, audience: "client_facing", cadence: "service", title: `Hosting guide ${tag}`, body: "Hosting can be part of a build or a managed service.",
      fields: { summary: "Hosting explained", category: "guide", related: [hosting.itemId] }, sourceRefs: ["faq:hosting-provided"] }))
    await runAs(founderA, () => submitContentVersion({ versionId: res.versionId }))
    await runAs(founderB, () => decideContentVersion({ versionId: res.versionId, decision: "approved", reference: "TEST", notes: "TEST ONLY resource", reviewBy: reviewBy() }))
    await runAs(founderB, () => publishContentVersion({ versionId: res.versionId }))
    const r = await runAs(partner, () => searchKnowledge({ q: `Do you provide hosting ${tag}?` }))
    expect(r.entries.find((e) => e.slug === `kb-hosting-${suffix}`)!.related).toEqual([{ title: `Hosting guide ${tag}`, href: `/partner/resources/res-kb-${suffix}` }])
    expect(r.topics).toEqual(expect.arrayContaining(["hosting", "commission"]))
  })
})
