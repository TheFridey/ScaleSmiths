import { AsyncLocalStorage } from "node:async_hooks"
import { randomUUID } from "node:crypto"
import { Pool } from "pg"
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { sql } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import * as schema from "../../src/lib/schema"
import { hasCapability, type Capability } from "../../src/lib/rbac"

/*
 * Operation Empower B1.2 Partner Academy against real PostgreSQL, as the restricted admin runtime role in CI.
 * Fixtures are additive, synthetic and visibly test-labelled.
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

import { archiveContentVersion, createContentItem, decideContentVersion, publishContentVersion, saveContentDraft, startContentRevision, submitContentVersion } from "../../src/lib/server/empower-content"
import { attemptAcademyCheck, completeAcademyLesson, getAcademy, getAcademyCourse, recordAcademyView } from "../../src/lib/server/empower-academy"

function safeUrl(value: string | undefined): string {
  if (!value) throw new Error("EXPANSION_TEST_DATABASE_URL is required.")
  const url = new URL(value)
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || !["55440", "55444"].includes(url.port) || url.pathname !== "/ss_expansion_test") throw new Error("Academy tests require the designated disposable database.")
  return value
}

const suffix = randomUUID().slice(0, 8)
const mk = (role: Actor["role"], name: string): Actor => ({ id: randomUUID(), role, active: true, sessionVersion: 1, displayName: `TEST ONLY Academy ${name} ${suffix}` })
const founderA = mk("owner", "founder A"), founderB = mk("owner", "founder B")
const partnerOne = mk("independent_partner", "partner one"), partnerTwo = mk("independent_partner", "partner two"), partnerRevoked = mk("independent_partner", "partner revoked"), partnerPending = mk("independent_partner", "partner pending")
let pool: Pool
const runAs = <T>(actor: Actor, operation: () => Promise<T>) => state.actors!.run(actor, operation)
const reviewBy = () => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() + 2); return d.toISOString().slice(0, 10) }
const check = (id: string) => ({ id, type: "single", prompt: "Can anyone guarantee first place on Google?", options: [{ id: "a", text: "Yes, with enough budget" }, { id: "b", text: "No" }], answer: ["b"], explanation: "Rankings depend on Google's systems, competitors and the searcher." })
const lessonBody = "## Timescales\n\nNo one can **guarantee** first place on Google.\n\n<script>alert(1)</script>"

async function publishedLesson(code: string, checks: unknown[] = []) {
  const c = await runAs(founderA, () => createContentItem({ kind: "lesson", slug: `lesson-${code.toLowerCase()}-${suffix}`, audience: "partner_only", cadence: "service", title: `${code} Timescales and guarantees`,
    body: lessonBody, fields: { course_code: code.slice(0, 3), lesson_code: code, reading_minutes: "6", checks }, sourceRefs: ["faq:ranking-guarantees"] }))
  await runAs(founderA, () => submitContentVersion({ versionId: c.versionId }))
  await runAs(founderB, () => decideContentVersion({ versionId: c.versionId, decision: "approved", reference: "TEST ONLY FD-L", notes: "TEST ONLY checked lesson", reviewBy: reviewBy() }))
  await runAs(founderB, () => publishContentVersion({ versionId: c.versionId }))
  return c
}
async function partnerFixture(actor: Actor, activated = true) {
  const email = `academy-${actor.id}@example.invalid`
  const app = await pool.query<{ id: number }>("insert into partner_applications(name,email,region,experience,motivation,privacy_version,status,retention_until,onboarding_confirmations) values($1,$2,'TEST ONLY','Demonstration experience','Isolated Academy test only','test-reviewed-v1','activated',now()+interval '30 days','{\"agreement\":true,\"legal\":true,\"independentStatus\":true,\"operations\":true}') returning id", [actor.displayName, email])
  await pool.query("insert into admin_users(id,email,display_name,password_hash,role,active,session_version) values($1,$2,$3,'test-fixture-not-for-login',$4,true,1)", [actor.id, email, actor.displayName, actor.role])
  await pool.query(`insert into expansion_partners(id,user_id,application_id,agreement_version,confirmed_at,activated_at) values($1,$2,$3,'test-reviewed-v1',now(),${activated ? "now()" : "null"})`, [randomUUID(), actor.id, app.rows[0].id])
}
const refused = (promise: Promise<unknown>) => promise.then(() => { throw new Error("expected a refusal") }, (error: unknown) => String((error as { message?: string }).message ?? error))
type Course = Awaited<ReturnType<typeof getAcademy>>["courses"][number]
const mineCourse = async (actor: Actor) => (await runAs(actor, () => getAcademy())).courses.find((c: Course) => c.slug === `course-c03-${suffix}`)

describe.skipIf(!process.env.EXPANSION_TEST_DATABASE_URL)("Empower B1.2 Partner Academy on real PostgreSQL", () => {
  let lessonOne: { itemId: string; versionId: string }, lessonTwo: { itemId: string; versionId: string }, course: { itemId: string; versionId: string }
  beforeAll(async () => {
    pool = new Pool({ connectionString: safeUrl(process.env.EXPANSION_TEST_DATABASE_URL), max: 6 })
    state.database = drizzle(pool, { schema })
    state.actors = new AsyncLocalStorage<Actor>()
    for (const f of [founderA, founderB]) await pool.query("insert into admin_users(id,email,display_name,password_hash,role,active,session_version) values($1,$2,$3,'test-fixture-not-for-login','owner',true,1)", [f.id, `academy-${f.id}@example.invalid`, f.displayName])
    for (const p of [partnerOne, partnerTwo, partnerRevoked]) await partnerFixture(p)
    await partnerFixture(partnerPending, false)
    vi.stubEnv("EMPOWER_FOUNDER_CONTENT_ENABLED", "true")
    vi.stubEnv("PARTNER_ACADEMY_ENABLED", "true")
  })
  afterAll(async () => { vi.unstubAllEnvs(); await pool?.end() })

  it("publishes a course only when every linked lesson is published, with independent approval", async () => {
    lessonOne = await publishedLesson("C03-L4", [check("q1")])
    const draftLesson = await runAs(founderA, () => createContentItem({ kind: "lesson", slug: `lesson-c03-l5-${suffix}`, audience: "partner_only", cadence: "service", title: "C03-L5 Build versus ongoing",
      body: "Search foundations are part of every build. Ongoing SEO is separate work.", fields: { course_code: "C03", lesson_code: "C03-L5", reading_minutes: "5" }, sourceRefs: ["faq:seo-in-build"] }))
    lessonTwo = draftLesson
    const fields = { category: "digital-growth", objectives: ["Explain SEO timescales honestly"], modules: [{ title: "Honest expectations", lessons: [lessonOne.itemId, lessonTwo.itemId] }] }
    expect(await refused(runAs(founderA, () => createContentItem({ kind: "course", slug: `course-bad-${suffix}`, audience: "client_facing", cadence: "service", title: "Wrong audience" })))).toMatch(/partners only/)
    course = await runAs(founderA, () => createContentItem({ kind: "course", slug: `course-c03-${suffix}`, audience: "partner_only", cadence: "service", title: "SEO and Digital Growth",
      body: "Talk about search visibility, including AI search, accurately and without promises.", fields, sourceRefs: ["docs/expansion/empower/CURRICULUM.md#c03"] }))
    // A draft course may hold a draft lesson, but cannot be submitted until that lesson is itself published.
    expect(await refused(runAs(founderA, () => submitContentVersion({ versionId: course.versionId })))).toMatch(/1 of 2 not ready/)
    // The structure must reference real lesson items, enforced in the database for any writer.
    expect(await refused(pool.query(`update empower_content_versions set fields=jsonb_set(fields,'{modules,0,lessons}',$2::jsonb) where id=$1`, [course.versionId, JSON.stringify([course.itemId])]))).toMatch(/only existing lesson items/)
    await runAs(founderA, () => submitContentVersion({ versionId: lessonTwo.versionId }))
    await runAs(founderB, () => decideContentVersion({ versionId: lessonTwo.versionId, decision: "approved", reference: "TEST ONLY FD-L2", notes: "TEST ONLY checked", reviewBy: reviewBy() }))
    await runAs(founderB, () => publishContentVersion({ versionId: lessonTwo.versionId }))
    await runAs(founderA, () => submitContentVersion({ versionId: course.versionId }))
    expect(await refused(runAs(founderA, () => decideContentVersion({ versionId: course.versionId, decision: "approved", reference: "TEST-X", notes: "Self approval attempt", reviewBy: reviewBy() })))).toMatch(/Another active founder/)
    await runAs(founderB, () => decideContentVersion({ versionId: course.versionId, decision: "approved", reference: "TEST ONLY FD-C", notes: "TEST ONLY checked course", reviewBy: reviewBy() }))
    await runAs(founderB, () => publishContentVersion({ versionId: course.versionId }))
  })

  it("serves the Academy only behind its switch, only to active partners", async () => {
    vi.stubEnv("PARTNER_ACADEMY_ENABLED", "false")
    await expect(runAs(partnerOne, () => getAcademy())).rejects.toMatchObject({ status: 404 })
    vi.stubEnv("PARTNER_ACADEMY_ENABLED", "true")
    await expect(runAs(founderA, () => getAcademy())).rejects.toThrow(/Forbidden/)
    await expect(runAs(partnerPending, () => getAcademy())).rejects.toMatchObject({ status: 403 })
    await pool.query("update admin_users set active=false where id=$1", [partnerRevoked.id])
    await expect(runAs(partnerRevoked, () => getAcademy())).rejects.toMatchObject({ status: 403 })
    await pool.query("update admin_users set session_version=session_version+1 where id=$1", [partnerTwo.id])
    try { await expect(runAs(partnerTwo, () => getAcademy())).rejects.toMatchObject({ status: 403 }) } finally { await pool.query("update admin_users set session_version=session_version-1 where id=$1", [partnerTwo.id]) }
  })

  it("never sends answers before an attempt, renders lesson text and grades on the server", async () => {
    const view = await runAs(partnerOne, () => getAcademyCourse({ slug: `course-c03-${suffix}` }))
    expect(view.course.progress).toEqual({ completed: 0, available: 2, unavailable: 0 })
    expect(view.course.estimatedMinutes).toBe(11)
    const lesson = view.lessons[lessonOne.itemId]
    expect(lesson.body).toContain("guarantee")
    expect(JSON.stringify(lesson.checks)).not.toMatch(/"answer"|explanation|Rankings depend/)
    const wrong = await runAs(partnerOne, () => attemptAcademyCheck({ courseVersionId: course.versionId, lessonVersionId: lessonOne.versionId, questionId: "q1", answer: ["a"] }))
    expect(wrong).toMatchObject({ correct: false, answer: ["b"], explanation: expect.stringContaining("Rankings depend") })
    const right = await runAs(partnerOne, () => attemptAcademyCheck({ courseVersionId: course.versionId, lessonVersionId: lessonOne.versionId, questionId: "q1", answer: ["b"] }))
    expect(right.correct).toBe(true)
    const after = await runAs(partnerOne, () => getAcademyCourse({ slug: `course-c03-${suffix}` }))
    expect(after.lessons[lessonOne.itemId].checks[0]).toMatchObject({ lastAttempt: { correct: true } })
    // Another partner sees none of it.
    const other = await runAs(partnerTwo, () => getAcademyCourse({ slug: `course-c03-${suffix}` }))
    expect(other.lessons[lessonOne.itemId].checks[0]).not.toHaveProperty("lastAttempt")
    expect(await refused(runAs(partnerOne, () => attemptAcademyCheck({ courseVersionId: course.versionId, lessonVersionId: lessonOne.versionId, questionId: "q9", answer: ["a"] })))).toMatch(/not part/)
  })

  it("records an optional completion once, even under concurrent presses, privately", async () => {
    const press = () => runAs(partnerOne, () => completeAcademyLesson({ courseVersionId: course.versionId, lessonVersionId: lessonOne.versionId }))
    let arrived = 0, release!: () => void
    const ready = new Promise<void>(resolve => { release = resolve })
    state.gate = { pids: new Set(), arrive: async () => { if (++arrived === 2) release(); await ready } }
    try { const results = await Promise.allSettled([press(), press()]); expect(results.every(r => r.status === "fulfilled")).toBe(true) } finally { state.gate = null }
    expect((await press()).alreadyRecorded).toBe(true)
    const rows = await pool.query("select count(*)::int n from empower_academy_completions c join expansion_partners p on p.id=c.partner_id where p.user_id=$1", [partnerOne.id])
    expect(rows.rows[0].n).toBe(1)
    await runAs(partnerOne, () => recordAcademyView({ courseVersionId: course.versionId, lessonVersionId: lessonTwo.versionId }))
    const one = await mineCourse(partnerOne), two = await mineCourse(partnerTwo)
    expect(one!.progress.completed).toBe(1)
    expect(one!.lastLessonItemId).toBe(lessonTwo.itemId)
    expect(two!.progress.completed).toBe(0)
    expect(two!.lastLessonItemId).toBeNull()
    expect(await refused(pool.query("update empower_academy_completions set completed_at=now()-interval '1 year' where partner_id=(select id from expansion_partners where user_id=$1)", [partnerOne.id]))).toBeTruthy()
  })

  it("keeps history but does not claim a revised lesson is complete", async () => {
    const revision = await runAs(founderA, () => startContentRevision({ itemId: lessonOne.itemId, changeSummary: "TEST ONLY clarify measurement" }))
    await runAs(founderA, () => saveContentDraft({ versionId: revision.versionId, title: "C03-L4 Timescales and guarantees", body: `${lessonBody}\n\nProgress is measured against a recorded baseline.`,
      fields: { course_code: "C03", lesson_code: "C03-L4", reading_minutes: "6", checks: [check("q1")] }, sourceRefs: ["faq:ranking-guarantees", "faq:seo-timeline"] }))
    await runAs(founderA, () => submitContentVersion({ versionId: revision.versionId }))
    await runAs(founderB, () => decideContentVersion({ versionId: revision.versionId, decision: "approved", reference: "TEST ONLY FD-L1v2", notes: "TEST ONLY checked revision", reviewBy: reviewBy() }))
    await runAs(founderB, () => publishContentVersion({ versionId: revision.versionId }))
    const view = await mineCourse(partnerOne)
    const l1 = view!.modules[0].lessons.find((l) => l.itemId === lessonOne.itemId)!
    expect(l1).toMatchObject({ state: "updated", version: 2 })
    expect(view!.progress.completed).toBe(0)
    const kept = await pool.query("select count(*)::int n from empower_academy_completions where lesson_version_id=$1", [lessonOne.versionId])
    expect(kept.rows[0].n).toBe(1)
    // The superseded version can no longer receive completions.
    expect(await refused(runAs(partnerTwo, () => completeAcademyLesson({ courseVersionId: course.versionId, lessonVersionId: lessonOne.versionId })))).toMatch(/not currently available/)
    lessonOne = { itemId: lessonOne.itemId, versionId: revision.versionId }
  })

  it("fails closed when a lesson is withdrawn, and hides a withdrawn course while keeping records", async () => {
    await runAs(founderB, () => archiveContentVersion({ versionId: lessonTwo.versionId, reason: "TEST ONLY withdrawn for correction" }))
    const view = await runAs(partnerOne, () => getAcademyCourse({ slug: `course-c03-${suffix}` }))
    const l2 = view.course.modules[0].lessons.find((l) => l.itemId === lessonTwo.itemId)!
    expect(l2).toEqual({ itemId: lessonTwo.itemId, available: false, state: "unavailable" })
    expect(view.lessons[lessonTwo.itemId]).toBeUndefined()
    expect(view.course.progress).toMatchObject({ available: 1, unavailable: 1 })
    expect(await refused(runAs(partnerOne, () => completeAcademyLesson({ courseVersionId: course.versionId, lessonVersionId: lessonTwo.versionId })))).toMatch(/not currently available/)
    expect(await refused(runAs(partnerOne, () => recordAcademyView({ courseVersionId: course.versionId, lessonVersionId: lessonTwo.versionId })))).toMatch(/not currently available/)
    await runAs(founderB, () => archiveContentVersion({ versionId: course.versionId, reason: "TEST ONLY course withdrawn" }))
    expect(await mineCourse(partnerOne)).toBeUndefined()
    await expect(runAs(partnerOne, () => getAcademyCourse({ slug: `course-c03-${suffix}` }))).rejects.toMatchObject({ status: 404 })
    expect(await refused(runAs(partnerOne, () => completeAcademyLesson({ courseVersionId: course.versionId, lessonVersionId: lessonOne.versionId })))).toMatch(/not currently available/)
    const kept = await pool.query("select count(*)::int n from empower_academy_completions c join expansion_partners p on p.id=c.partner_id where p.user_id=$1", [partnerOne.id])
    expect(kept.rows[0].n).toBe(1)
  })

  it("serialises course publication against a concurrent lesson withdrawal", async () => {
    const lesson = await publishedLesson("C03-L6")
    const c = await runAs(founderA, () => createContentItem({ kind: "course", slug: `course-race-${suffix}`, audience: "partner_only", cadence: "service", title: "Race course",
      body: "A course used to prove publication and withdrawal are serialised.", fields: { category: "digital-growth", objectives: ["Prove serialisation"], modules: [{ title: "Only module", lessons: [lesson.itemId] }] }, sourceRefs: ["TEST ONLY"] }))
    await runAs(founderA, () => submitContentVersion({ versionId: c.versionId }))
    await runAs(founderB, () => decideContentVersion({ versionId: c.versionId, decision: "approved", reference: "TEST", notes: "TEST ONLY race", reviewBy: reviewBy() }))
    let arrived = 0, release!: () => void
    const ready = new Promise<void>(resolve => { release = resolve })
    state.gate = { pids: new Set(), arrive: async () => { if (++arrived === 2) release(); await ready } }
    let results: PromiseSettledResult<unknown>[]
    try {
      results = await Promise.allSettled([
        runAs(founderB, () => publishContentVersion({ versionId: c.versionId })),
        runAs(founderB, () => archiveContentVersion({ versionId: lesson.versionId, reason: "TEST ONLY concurrent withdrawal" })),
      ])
    } finally { state.gate = null }
    expect(results.filter(r => r.status === "rejected").map(r => String((r as PromiseRejectedResult).reason?.message))).not.toContainEqual(expect.stringMatching(/deadlock/i))
    expect(results[1].status).toBe("fulfilled") // a withdrawal is never blocked
    // Whatever the order, the lesson is not served.
    const served = await runAs(partnerOne, () => getAcademy())
    expect(served.courses.find((x: Course) => x.slug === `course-race-${suffix}`)).toBeUndefined()
  })

  it("gives the public web role no access to Academy tables", async () => {
    if (!process.env.EXPANSION_WEB_TEST_DATABASE_URL) return
    const web = new Pool({ connectionString: process.env.EXPANSION_WEB_TEST_DATABASE_URL, max: 1 })
    try {
      for (const table of ["empower_academy_completions", "empower_academy_check_attempts", "empower_academy_course_state"]) expect(await refused(web.query(`select 1 from ${table} limit 1`))).toMatch(/permission denied/)
    } finally { await web.end() }
  })
})
