import { AsyncLocalStorage } from "node:async_hooks"
import { randomUUID } from "node:crypto"
import { Pool } from "pg"
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { sql } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import * as schema from "../../src/lib/schema"
import { hasCapability, type Capability } from "../../src/lib/rbac"

/*
 * Operation Empower B1.1 against a real PostgreSQL database, run as the restricted admin runtime role in CI.
 * Fixtures are additive and visibly test-labelled; nothing is truncated, dropped or migrated here.
 */
type Actor = { id: string; role: "owner" | "independent_partner"; active: boolean; sessionVersion: number; displayName: string }
type Gate = { arrive(pid: number): Promise<void>; pids: Set<number> }
const state = vi.hoisted(() => ({ database: null as NodePgDatabase<typeof schema> | null, actors: null as AsyncLocalStorage<Actor> | null, gate: null as Gate | null }))
vi.mock("@/lib/db", () => ({ db: {
  execute: (...args: Parameters<NodePgDatabase<typeof schema>["execute"]>) => state.database!.execute(...args),
  transaction: (operation: Parameters<NodePgDatabase<typeof schema>["transaction"]>[0]) => state.database!.transaction(async tx => {
    const gate = state.gate
    if (gate) { const result = await tx.execute(sql`select pg_backend_pid() as pid`); await gate.arrive(Number(result.rows[0].pid)) }
    return operation(tx)
  }),
} }))
vi.mock("../../src/lib/server/rbac", () => ({ requireCapability: async (capability: Capability) => {
  const actor = state.actors?.getStore()
  if (!actor || !hasCapability(actor.role, capability)) throw new Error("Forbidden capability")
  return { ...actor }
} }))

import {
  archiveContentVersion, createContentItem, decideContentVersion, getContentAdmin, publishContentVersion, saveContentDraft, servableContent, startContentRevision, submitContentVersion,
} from "../../src/lib/server/empower-content"

export function safeEmpowerUrl(value: string | undefined): string {
  if (!value) throw new Error("EXPANSION_TEST_DATABASE_URL is required for this explicit disposable database test.")
  const url = new URL(value)
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || !["55440", "55444"].includes(url.port) || url.pathname !== "/ss_expansion_test") {
    throw new Error("Empower content tests require the designated disposable database on localhost port 55440 or 55444.")
  }
  return value
}

const suffix = randomUUID().slice(0, 8)
const founderA: Actor = { id: randomUUID(), role: "owner", active: true, sessionVersion: 1, displayName: `TEST ONLY Empower founder A ${suffix}` }
const founderB: Actor = { id: randomUUID(), role: "owner", active: true, sessionVersion: 1, displayName: `TEST ONLY Empower founder B ${suffix}` }
const partner: Actor = { id: randomUUID(), role: "independent_partner", active: true, sessionVersion: 1, displayName: `TEST ONLY Empower partner ${suffix}` }
let pool: Pool
const runAs = <T>(actor: Actor, operation: () => Promise<T>) => state.actors!.run(actor, operation)
const inSixMonths = () => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() + 6); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10) }
const inTwoMonths = () => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() + 2); return d.toISOString().slice(0, 10) }
const knowledge = (answer = "Yes, as part of a build or as a managed service.") => ({
  question: "Do you provide hosting?", answer, client_explanation: "Yes. ScaleSmiths can host your site and will document what is covered.",
  limitations: "No published hosting price or uptime figure.", escalation_required: "when", escalation_condition: "The client needs a price", escalation_route: "technical_scoping", topic: "hosting",
})
const servable = (audiences: Array<"partner_only" | "client_facing">, asOf?: string) => state.database!.transaction(tx => servableContent(tx, audiences, { asOf }))
const mine = (list: Array<Record<string, unknown>>) => list.filter(r => String(r.slug).endsWith(suffix))
const approve = (versionId: string, actor = founderB, reviewBy = inSixMonths()) =>
  runAs(actor, () => decideContentVersion({ versionId, decision: "approved", reference: "TEST ONLY FD-1", notes: "TEST ONLY checked against faq:hosting-provided", reviewBy }))

async function race<T>(operations: Array<() => Promise<T>>) {
  let arrived = 0, release!: () => void
  const ready = new Promise<void>(resolve => { release = resolve })
  const gate: Gate = { pids: new Set(), arrive: async pid => {
    gate.pids.add(pid)
    if (++arrived === operations.length) release()
    await Promise.race([ready, new Promise<never>((_, reject) => { const t = setTimeout(() => reject(new Error("Concurrent transaction barrier timed out")), 10000); t.unref() })])
  } }
  state.gate = gate
  try { const results = await Promise.allSettled(operations.map(op => op())); expect(gate.pids.size).toBe(operations.length); return results } finally { state.gate = null }
}
const refused = (promise: Promise<unknown>) => promise.then(() => { throw new Error("expected the database to refuse") }, (error: unknown) => String((error as { message?: string }).message ?? error))

describe.skipIf(!process.env.EXPANSION_TEST_DATABASE_URL)("Empower B1.1 content workflow on real PostgreSQL", () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: safeEmpowerUrl(process.env.EXPANSION_TEST_DATABASE_URL), max: 6 })
    state.database = drizzle(pool, { schema })
    state.actors = new AsyncLocalStorage<Actor>()
    for (const actor of [founderA, founderB, partner]) {
      await pool.query("insert into admin_users(id,email,display_name,password_hash,role,active,session_version) values($1,$2,$3,'test-fixture-not-for-login',$4,true,1)",
        [actor.id, `empower-${actor.id}@example.invalid`, actor.displayName, actor.role])
    }
    vi.stubEnv("EMPOWER_FOUNDER_CONTENT_ENABLED", "true")
  })
  afterAll(async () => { vi.unstubAllEnvs(); await pool?.end() })

  it("is unavailable while the switch is off, and to partners at any time", async () => {
    vi.stubEnv("EMPOWER_FOUNDER_CONTENT_ENABLED", "false")
    await expect(runAs(founderA, () => createContentItem({ kind: "knowledge", slug: `kb-off-${suffix}`, audience: "client_facing", cadence: "service", title: "Off" }))).rejects.toMatchObject({ status: 404 })
    expect(await runAs(founderA, () => getContentAdmin())).toEqual({ enabled: false })
    vi.stubEnv("EMPOWER_FOUNDER_CONTENT_ENABLED", "true")
    await expect(runAs(partner, () => createContentItem({ kind: "knowledge", slug: `kb-partner-${suffix}`, audience: "client_facing", cadence: "service", title: "Partner" }))).rejects.toThrow(/Forbidden/)
    await expect(runAs(partner, () => getContentAdmin())).rejects.toThrow(/Forbidden/)
  })

  it("runs draft -> review -> second-founder approval -> publication -> supersession, serving only the current published version", async () => {
    const slug = `kb-host-${suffix}`
    const created = await runAs(founderA, () => createContentItem({ kind: "knowledge", slug, audience: "client_facing", cadence: "service", title: "Do you provide hosting?", fields: { question: "Hosting?" } }))
    await expect(runAs(founderA, () => submitContentVersion({ versionId: created.versionId }))).rejects.toThrow(/Answer/)
    // Separation of duties: another founder may not rewrite or submit this draft and then approve it as a non-author.
    await expect(runAs(founderB, () => saveContentDraft({ versionId: created.versionId, title: "Rewritten by founder B", fields: knowledge(), sourceRefs: ["faq:hosting-provided"] }))).rejects.toMatchObject({ status: 403 })
    await expect(runAs(founderB, () => submitContentVersion({ versionId: created.versionId }))).rejects.toMatchObject({ status: 403 })
    await runAs(founderA, () => saveContentDraft({ versionId: created.versionId, title: "Do you provide hosting?", fields: knowledge(), sourceRefs: "faq:hosting-provided\nfaq:hosting-location" }))
    await runAs(founderA, () => submitContentVersion({ versionId: created.versionId }))
    await expect(runAs(founderA, () => saveContentDraft({ versionId: created.versionId, title: "Changed after submission" }))).rejects.toMatchObject({ status: 409 })
    expect(await refused(pool.query("update empower_content_versions set title='Tampered' where id=$1", [created.versionId]))).toMatch(/Only a draft can be edited/)

    // AP-GOV-04: two founders are active, so the author may not approve their own work.
    await expect(approve(created.versionId, founderA)).rejects.toMatchObject({ status: 403 })
    expect(mine(await servable(["client_facing", "partner_only"]))).toEqual([])
    await approve(created.versionId)
    expect(mine(await servable(["client_facing"]))).toEqual([]) // approved is not published
    await runAs(founderB, () => publishContentVersion({ versionId: created.versionId }))
    expect(mine(await servable(["client_facing"])).map(r => r.version)).toEqual([1])
    expect(mine(await servable(["partner_only"]))).toEqual([]) // audience is enforced in SQL

    const revision = await runAs(founderA, () => startContentRevision({ itemId: created.itemId, changeSummary: "TEST ONLY clarify managed hosting" }))
    expect(revision.version).toBe(2)
    await expect(runAs(founderB, () => startContentRevision({ itemId: created.itemId }))).rejects.toMatchObject({ status: 409 })
    await runAs(founderA, () => saveContentDraft({ versionId: revision.versionId, title: "Do you provide hosting?", fields: knowledge("Yes. Hosting can be arranged as part of a build or as a managed service on its own."), sourceRefs: ["faq:hosting-provided"] }))
    await runAs(founderA, () => submitContentVersion({ versionId: revision.versionId }))
    await approve(revision.versionId)
    expect(mine(await servable(["client_facing"])).map(r => r.version)).toEqual([1]) // still v1 until v2 is published
    const published = await runAs(founderB, () => publishContentVersion({ versionId: revision.versionId }))
    expect(published.superseded).toEqual([1])
    const served = mine(await servable(["client_facing"]))
    expect(served.map(r => r.version)).toEqual([2])
    expect((served[0].fields as Record<string, string>).answer).toMatch(/on its own/)

    const history = await pool.query("select action from expansion_audit where entity_id = any($1::text[]) or details->>'itemId' = $2 order by id", [[created.itemId, created.versionId, revision.versionId], created.itemId])
    expect(history.rows.map(r => r.action)).toEqual(expect.arrayContaining(["empower_item_created", "empower_draft_saved", "empower_submitted", "empower_approved", "empower_published", "empower_revision_started"]))
    const approvals = await pool.query("select decided_by,reference,review_by from empower_content_approvals where version_id=$1", [revision.versionId])
    expect(approvals.rows).toEqual([expect.objectContaining({ decided_by: founderB.id, reference: "TEST ONLY FD-1" })])
  })

  it("records changes requested and rejection as permanent decisions, and withdrawal needs a reason", async () => {
    const make = async (tag: string) => {
      const c = await runAs(founderA, () => createContentItem({ kind: "knowledge", slug: `kb-${tag}-${suffix}`, audience: "client_facing", cadence: "service", title: "Do you provide hosting?", fields: knowledge(), sourceRefs: ["faq:hosting-provided"] }))
      await runAs(founderA, () => submitContentVersion({ versionId: c.versionId }))
      return c
    }
    const changes = await make("changes")
    await runAs(founderB, () => decideContentVersion({ versionId: changes.versionId, decision: "changes_requested", reference: "TEST ONLY FD-2", notes: "TEST ONLY tighten the limitation" }))
    const next = await runAs(founderA, () => startContentRevision({ itemId: changes.itemId }))
    expect(next.version).toBe(2)

    const rejected = await make("rejected")
    expect((await runAs(founderB, () => decideContentVersion({ versionId: rejected.versionId, decision: "rejected", reference: "TEST ONLY FD-3", notes: "TEST ONLY not needed" }))).status).toBe("archived")

    const withdrawn = await make("withdrawn")
    await approve(withdrawn.versionId)
    await runAs(founderB, () => publishContentVersion({ versionId: withdrawn.versionId }))
    await expect(runAs(founderB, () => archiveContentVersion({ versionId: withdrawn.versionId, reason: "no" }))).rejects.toThrow(/reason/)
    expect(await refused(pool.query("update empower_content_versions set status='archived',archived_at=now() where id=$1", [withdrawn.versionId]))).toMatch(/needs a recorded reason/)
    await runAs(founderB, () => archiveContentVersion({ versionId: withdrawn.versionId, reason: "TEST ONLY superseded by a policy change" }))
    expect(mine(await servable(["client_facing"])).find(r => r.version_id === withdrawn.versionId)).toBeUndefined()
    const audit = await pool.query("select action from expansion_audit where entity_id=$1", [withdrawn.versionId])
    expect(audit.rows.map(r => r.action)).toContain("empower_withdrawn")
  })

  it("enforces lifecycle, immutability and approval evidence in the database itself", async () => {
    const c = await runAs(founderA, () => createContentItem({ kind: "knowledge", slug: `kb-guards-${suffix}`, audience: "partner_only", cadence: "service", title: "Guard test", fields: knowledge(), sourceRefs: ["faq:hosting-provided"] }))
    expect(await refused(pool.query("update empower_content_items set audience='client_facing' where id=$1", [c.itemId]))).toBeTruthy()
    // Authorship cannot be forged after the fact: the creator is part of the version's permanent identity.
    expect(await refused(pool.query("update empower_content_versions set created_by=$2 where id=$1", [c.versionId, founderB.id]))).toMatch(/identity is immutable/)
    expect(await refused(pool.query("update empower_content_items set created_by=$2 where id=$1", [c.itemId, founderB.id]))).toBeTruthy()
    // A draft cannot carry a submitter; submission evidence belongs to submission.
    expect(await refused(pool.query("update empower_content_versions set submitted_by=$2 where id=$1", [c.versionId, founderB.id]))).toMatch(/Lifecycle evidence/)
    // The runtime role holds no DELETE privilege at all; the trigger is the second line of defence for any other role.
    expect(await refused(pool.query("delete from empower_content_versions where id=$1", [c.versionId]))).toMatch(/permission denied|history is retained/)
    expect(await refused(pool.query("insert into empower_content_versions(id,item_id,version,title,body,status,created_by) values($1,$2,9,'Born published','x','published',$3)", [randomUUID(), c.itemId, founderA.id]))).toMatch(/starts as a draft/)
    expect(await refused(pool.query("update empower_content_versions set status='published',published_at=now() where id=$1", [c.versionId]))).toMatch(/Invalid content lifecycle transition/)
    await runAs(founderA, () => submitContentVersion({ versionId: c.versionId }))
    expect(await refused(pool.query("update empower_content_versions set status='approved',approved_at=now(),review_by=current_date+30 where id=$1", [c.versionId]))).toMatch(/matching recorded founder decision/)
    // Self-approval is only possible with a recorded reason; a review date outside the cadence is refused.
    expect(await refused(pool.query("insert into empower_content_approvals(id,version_id,decision,decided_by,reference,notes,review_by) values($1,$2,'approved',$3,'TEST','TEST ONLY self',current_date+30)", [randomUUID(), c.versionId, founderA.id]))).toMatch(/must record a reason/)
    expect(await refused(pool.query("insert into empower_content_approvals(id,version_id,decision,decided_by,reference,notes,review_by) values($1,$2,'approved',$3,'TEST','TEST ONLY late',current_date+400)", [randomUUID(), c.versionId, founderB.id]))).toMatch(/within the review cadence/)
    // The submitter is an author too, even when a raw writer records someone else as submitter.
    const v2 = await runAs(founderA, () => createContentItem({ kind: "knowledge", slug: `kb-submitter-${suffix}`, audience: "partner_only", cadence: "service", title: "Submitter test", fields: knowledge(), sourceRefs: ["faq:hosting-provided"] }))
    await pool.query("update empower_content_versions set status='in_review',submitted_by=$2 where id=$1", [v2.versionId, founderB.id])
    expect(await refused(pool.query("insert into empower_content_approvals(id,version_id,decision,decided_by,reference,notes,review_by) values($1,$2,'approved',$3,'TEST','TEST ONLY submitter',current_date+30)", [randomUUID(), v2.versionId, founderB.id]))).toMatch(/must record a reason/)
    await approve(c.versionId, founderB, inTwoMonths())
    const [approval] = (await pool.query("select id from empower_content_approvals where version_id=$1", [c.versionId])).rows
    expect(await refused(pool.query("update empower_content_approvals set notes='rewritten' where id=$1", [approval.id]))).toBeTruthy()
    expect(await refused(pool.query("delete from empower_content_approvals where id=$1", [approval.id]))).toBeTruthy()
    expect(await refused(pool.query("update empower_content_versions set review_by=review_by+1 where id=$1", [c.versionId]))).toMatch(/Lifecycle evidence/)
  })

  it("never serves content past its review date (UTC)", async () => {
    const c = await runAs(founderA, () => createContentItem({ kind: "knowledge", slug: `kb-expiry-${suffix}`, audience: "partner_only", cadence: "service", title: "Expiry entry", fields: knowledge(), sourceRefs: ["faq:hosting-provided"] }))
    await runAs(founderA, () => submitContentVersion({ versionId: c.versionId }))
    const reviewBy = inTwoMonths()
    await approve(c.versionId, founderB, reviewBy)
    await runAs(founderB, () => publishContentVersion({ versionId: c.versionId }))
    const dayAfter = new Date(`${reviewBy}T00:00:00Z`); dayAfter.setUTCDate(dayAfter.getUTCDate() + 1)
    expect(mine(await servable(["partner_only"], reviewBy)).map(r => r.version_id)).toContain(c.versionId) // last valid day
    expect(mine(await servable(["partner_only"], dayAfter.toISOString().slice(0, 10))).map(r => r.version_id)).not.toContain(c.versionId)
    await expect(state.database!.transaction(tx => servableContent(tx, ["partner_only"], { asOf: "2026-01-01; drop table x" }))).rejects.toThrow(/Invalid date/)
  })

  it("takes every lifecycle timestamp and decision time from the database clock", async () => {
    const c = await runAs(founderA, () => createContentItem({ kind: "knowledge", slug: `kb-clock-${suffix}`, audience: "partner_only", cadence: "service", title: "Clock entry", fields: knowledge(), sourceRefs: ["faq:hosting-provided"] }))
    // Raw writers cannot plant evidence that belongs to another transition.
    expect(await refused(pool.query("update empower_content_versions set status='in_review',submitted_by=$2,archive_reason='planted reason' where id=$1", [c.versionId, founderA.id]))).toMatch(/archive reason belongs to archiving/)
    expect(await refused(pool.query("update empower_content_versions set status='in_review',submitted_by=$2,review_by=current_date+30 where id=$1", [c.versionId, founderA.id]))).toMatch(/Approval evidence belongs to approval/)
    // A backdated submission time is replaced by the database clock.
    await pool.query("update empower_content_versions set status='in_review',submitted_by=$2,submitted_at=now()-interval '400 days',archived_at=now()-interval '1 day' where id=$1", [c.versionId, founderA.id])
    const submitted = (await pool.query("select submitted_at > now()-interval '1 minute' fresh, archived_at from empower_content_versions where id=$1", [c.versionId])).rows[0]
    expect(submitted).toEqual({ fresh: true, archived_at: null })
    // A forward-dated decision cannot widen the review window.
    expect(await refused(pool.query("insert into empower_content_approvals(id,version_id,decision,decided_by,decided_at,reference,notes,review_by) values($1,$2,'approved',$3,now()+interval '300 days','TEST','TEST ONLY forward dated',current_date+300)", [randomUUID(), c.versionId, founderB.id]))).toMatch(/within the review cadence/)
    await approve(c.versionId, founderB, inTwoMonths())
    const decision = (await pool.query("select decided_at > now()-interval '1 minute' and decided_at <= now() fresh from empower_content_approvals where version_id=$1", [c.versionId])).rows[0]
    expect(decision.fresh).toBe(true)
    // Approved, then a raw attempt to backdate publication: the timestamp is the database clock regardless.
    await pool.query("update empower_content_versions set status='published',published_at=now()-interval '100 days' where id=$1", [c.versionId])
    const published = (await pool.query("select published_at > now()-interval '1 minute' fresh from empower_content_versions where id=$1", [c.versionId])).rows[0]
    expect(published.fresh).toBe(true)
  })

  it("allows only one version in progress per item under concurrent revisions", async () => {
    const c = await runAs(founderA, () => createContentItem({ kind: "knowledge", slug: `kb-race-${suffix}`, audience: "client_facing", cadence: "service", title: "Race entry", fields: knowledge(), sourceRefs: ["faq:hosting-provided"] }))
    await runAs(founderA, () => submitContentVersion({ versionId: c.versionId }))
    await approve(c.versionId)
    await runAs(founderB, () => publishContentVersion({ versionId: c.versionId }))
    const results = await race([
      () => runAs(founderA, () => startContentRevision({ itemId: c.itemId })),
      () => runAs(founderB, () => startContentRevision({ itemId: c.itemId })),
    ])
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1)
    const open = await pool.query("select count(*)::int n from empower_content_versions where item_id=$1 and status in ('draft','in_review','approved')", [c.itemId])
    expect(open.rows[0].n).toBe(1)
  })

  it("denies a founder whose session was revoked", async () => {
    await pool.query("update admin_users set session_version=session_version+1 where id=$1", [founderA.id])
    try {
      await expect(runAs(founderA, () => createContentItem({ kind: "knowledge", slug: `kb-revoked-${suffix}`, audience: "client_facing", cadence: "service", title: "Revoked" }))).rejects.toMatchObject({ status: 403 })
    } finally { await pool.query("update admin_users set session_version=session_version-1 where id=$1", [founderA.id]) }
  })

  it.skipIf(!process.env.EXPANSION_WEB_TEST_DATABASE_URL)("gives the public web role no access to content tables", async () => {
    const web = new Pool({ connectionString: process.env.EXPANSION_WEB_TEST_DATABASE_URL, max: 1 })
    try {
      for (const table of ["empower_content_items", "empower_content_versions", "empower_content_approvals"]) {
        expect(await refused(web.query(`select 1 from ${table} limit 1`))).toMatch(/permission denied/)
      }
    } finally { await web.end() }
  })
})
