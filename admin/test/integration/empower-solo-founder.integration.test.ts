import { AsyncLocalStorage } from "node:async_hooks"
import { randomUUID } from "node:crypto"
import { Pool } from "pg"
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import * as schema from "../../src/lib/schema"
import { hasCapability, type Capability } from "../../src/lib/rbac"

/*
 * AP-GOV-04 sole-founder path on a genuinely isolated database that contains exactly one active founder.
 * It must be a dedicated, freshly migrated database: the test refuses to run if any other active founder exists,
 * rather than deactivating anyone else's fixtures.
 */
type Actor = { id: string; role: "owner"; active: boolean; sessionVersion: number; displayName: string }
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

import { createContentItem, decideContentVersion, getContentAdmin, publishContentVersion, submitContentVersion } from "../../src/lib/server/empower-content"

export function safeSoloUrl(value: string | undefined): string {
  if (!value) throw new Error("EMPOWER_SOLO_TEST_DATABASE_URL is required.")
  const url = new URL(value)
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || !["55440", "55444"].includes(url.port) || url.pathname !== "/ss_empower_solo_test") {
    throw new Error("The sole-founder test requires the dedicated disposable database ss_empower_solo_test on localhost port 55440 or 55444.")
  }
  return value
}

const founder: Actor = { id: randomUUID(), role: "owner", active: true, sessionVersion: 1, displayName: "TEST ONLY sole founder" }
const inThreeMonths = () => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() + 2); return d.toISOString().slice(0, 10) }
let pool: Pool
const runAs = <T>(operation: () => Promise<T>) => state.actors!.run(founder, operation)

describe.skipIf(!process.env.EMPOWER_SOLO_TEST_DATABASE_URL)("Empower sole-founder approval on an isolated database", () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: safeSoloUrl(process.env.EMPOWER_SOLO_TEST_DATABASE_URL), max: 2 })
    state.database = drizzle(pool, { schema })
    state.actors = new AsyncLocalStorage<Actor>()
    const others = await pool.query("select count(*)::int n from admin_users where active=true and role::text in ('owner','administrator')")
    if (others.rows[0].n !== 0) throw new Error("The sole-founder database must start with no active founder; use a freshly migrated ss_empower_solo_test.")
    await pool.query("insert into admin_users(id,email,display_name,password_hash,role,active,session_version) values($1,$2,$3,'test-fixture-not-for-login','owner',true,1)", [founder.id, `solo-${founder.id}@example.invalid`, founder.displayName])
    vi.stubEnv("EMPOWER_FOUNDER_CONTENT_ENABLED", "true")
  })
  afterAll(async () => { vi.unstubAllEnvs(); await pool?.end() })

  it("lets the only active founder approve their own version only with a recorded reason", async () => {
    expect((await runAs(() => getContentAdmin()) as { activeFounders: number }).activeFounders).toBe(1)
    const c = await runAs(() => createContentItem({ kind: "knowledge", slug: `kb-solo-${founder.id.slice(0, 8)}`, audience: "partner_only", cadence: "service", title: "Sole founder entry",
      fields: { question: "Do you provide hosting?", answer: "Yes.", client_explanation: "none", limitations: "No price.", escalation_required: "never", topic: "hosting" }, sourceRefs: ["faq:hosting-provided"] }))
    await runAs(() => submitContentVersion({ versionId: c.versionId }))
    const decision = { versionId: c.versionId, decision: "approved", reference: "TEST ONLY FD-SOLO", notes: "TEST ONLY sole founder check", reviewBy: inThreeMonths() }
    await expect(runAs(() => decideContentVersion(decision))).rejects.toThrow(/only active founder/)
    await expect(runAs(() => decideContentVersion({ ...decision, selfApprovalReason: "short" }))).rejects.toThrow(/at least 10/)
    await runAs(() => decideContentVersion({ ...decision, selfApprovalReason: "TEST ONLY: I am the only active founder this period." }))
    const [row] = (await pool.query("select decided_by, self_approval_reason from empower_content_approvals where version_id=$1", [c.versionId])).rows
    expect(row).toEqual({ decided_by: founder.id, self_approval_reason: "TEST ONLY: I am the only active founder this period." })
    await runAs(() => publishContentVersion({ versionId: c.versionId }))
    const audit = await pool.query("select details->>'selfApproval' self from expansion_audit where entity_id=$1 and action='empower_approved'", [c.versionId])
    expect(audit.rows).toEqual([{ self: "true" }])
  })

  it("restores the two-founder rule as soon as a second founder becomes active", async () => {
    const second = randomUUID()
    await pool.query("insert into admin_users(id,email,display_name,password_hash,role,active,session_version) values($1,$2,'TEST ONLY second founder','test-fixture-not-for-login','administrator',true,1)", [second, `solo-second-${second}@example.invalid`])
    const c = await runAs(() => createContentItem({ kind: "knowledge", slug: `kb-solo-two-${founder.id.slice(0, 8)}`, audience: "partner_only", cadence: "service", title: "Second founder entry",
      fields: { question: "Do you provide hosting?", answer: "Yes.", client_explanation: "none", limitations: "No price.", escalation_required: "never", topic: "hosting" }, sourceRefs: ["faq:hosting-provided"] }))
    await runAs(() => submitContentVersion({ versionId: c.versionId }))
    await expect(runAs(() => decideContentVersion({ versionId: c.versionId, decision: "approved", reference: "TEST", notes: "TEST ONLY two founders", reviewBy: inThreeMonths(), selfApprovalReason: "Trying to self-approve anyway." }))).rejects.toMatchObject({ status: 403 })
  })
})
