import "server-only"
import { randomUUID } from "node:crypto"
import { sql, type SQL } from "drizzle-orm"
import { db, type AdminDatabaseTransaction } from "@/lib/db"
import { translateDbError } from "@/lib/db-errors"
import { ContentError, courseLessonIds, gradeCheck, publicChecks, type CourseModule } from "@/lib/empower-content"
import { requireCapability } from "./rbac"
import { partnerAcademyEnabled, partnerGuard } from "./empower-partner"
import { relatedResourcesForLessons } from "./empower-resources"
export { partnerAcademyEnabled }

/*
 * Operation Empower B1.2: the partner side of the Academy. OFF unless PARTNER_ACADEMY_ENABLED=true, independently of the founder
 * studio switch. Every read goes through the published, in-date rule: a course is listed only while its current version is
 * published and in date, and a lesson inside it only while the lesson's own current version is too. Anything else is presented
 * as "temporarily unavailable" with no content (fail closed).
 *
 * Learning records are private to the partner who made them, keyed by the authenticated partner via `partnerGuard`, voluntary,
 * and never read by any commission, allocation, achievement, referral or withdrawal code. A completion belongs to the exact lesson
 * version read: when a lesson is revised, the earlier completion is kept and shown as "updated since you completed it", and the
 * new version is not claimed as complete.
 */
type Row = Record<string, unknown>
type Executor = Pick<AdminDatabaseTransaction, "execute">

const rows = async (tx: Executor, query: SQL): Promise<Row[]> => (await tx.execute(query)).rows as Row[]
const uuidList = (ids: string[]) => sql.join(ids.map((id) => sql`${id}::uuid`), sql`,`)
const UTC_TODAY = sql`(now() at time zone 'UTC')::date`
const uuid = (value: unknown) => {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new ContentError("A valid record identifier is required.")
  return value.toLowerCase()
}

async function partner() {
  if (!partnerAcademyEnabled()) throw new ContentError("The Partner Academy is not available yet.", 404)
  return requireCapability("expansion.partner")
}

interface LessonView { itemId: string; available: boolean; versionId?: string; version?: number; slug?: string; title?: string; readingMinutes?: number | null; publishedAt?: string; state: "completed" | "updated" | "not_started" | "unavailable"; completedAt?: string | null; checks?: number }
interface CourseView { itemId: string; slug: string; versionId: string; version: number; title: string; description: string; category: string | null; objectives: string[]; estimatedMinutes: number | null; publishedAt: string; updatedAt: string; modules: { title: string; summary?: string; lessons: LessonView[] }[]; progress: { completed: number; available: number; unavailable: number }; lastLessonItemId: string | null; lastViewedAt: string | null }

async function load(tx: Executor, partnerId: string, slug?: string) {
  const courses = await rows(tx, sql`select i.id item_id,i.slug,v.id version_id,v.version,v.title,v.body,v.fields,v.published_at from empower_content_versions v join empower_content_items i on i.id=v.item_id
    where i.kind='course' and v.status='published' and v.review_by >= ${UTC_TODAY} ${slug ? sql`and i.slug=${slug}` : sql``} order by v.title`)
  const lessonIds = [...new Set(courses.flatMap((c) => courseLessonIds(c.fields)))]
  const lessons = lessonIds.length ? await rows(tx, sql`select i.id item_id,i.slug,v.id version_id,v.version,v.title,v.body,v.fields,v.source_refs,v.published_at from empower_content_versions v join empower_content_items i on i.id=v.item_id
    where i.kind='lesson' and i.audience='partner_only' and v.status='published' and v.review_by >= ${UTC_TODAY} and i.id in (${uuidList(lessonIds)})`) : []
  const completions = await rows(tx, sql`select c.lesson_version_id,c.completed_at,v.item_id lesson_item_id from empower_academy_completions c join empower_content_versions v on v.id=c.lesson_version_id where c.partner_id=${partnerId}`)
  const states = await rows(tx, sql`select course_item_id,last_lesson_item_id,last_viewed_at from empower_academy_course_state where partner_id=${partnerId}`)
  const byLesson = new Map(lessons.map((l) => [String(l.item_id), l]))
  const views: CourseView[] = []
  for (const c of courses) {
    const fields = (c.fields ?? {}) as { category?: string; objectives?: string[]; modules?: CourseModule[]; estimated_minutes?: string }
    let completed = 0, available = 0, unavailable = 0, latest = new Date(String(c.published_at)).getTime(), minutes = 0, minutesKnown = true
    const modules = (fields.modules ?? []).map((m) => ({ title: m.title, ...(m.summary ? { summary: m.summary } : {}), lessons: m.lessons.map((id): LessonView => {
      const l = byLesson.get(id)
      if (!l) { unavailable++; return { itemId: id, available: false, state: "unavailable" } }
      available++
      const lf = (l.fields ?? {}) as { reading_minutes?: string; checks?: unknown[] }
      const done = completions.find((x) => String(x.lesson_version_id) === String(l.version_id))
      const earlier = !done && completions.some((x) => String(x.lesson_item_id) === id)
      if (done) completed++
      const reading = lf.reading_minutes ? Number(lf.reading_minutes) : null
      if (reading) minutes += reading; else minutesKnown = false
      latest = Math.max(latest, new Date(String(l.published_at)).getTime())
      return { itemId: id, available: true, versionId: String(l.version_id), version: Number(l.version), slug: String(l.slug), title: String(l.title), readingMinutes: reading, publishedAt: String(l.published_at),
        state: done ? "completed" : earlier ? "updated" : "not_started", completedAt: done ? String(done.completed_at) : null, checks: Array.isArray(lf.checks) ? lf.checks.length : 0 }
    }) }))
    if (!available) continue // fail closed: a course with no currently servable lesson is not offered at all
    const state = states.find((s) => String(s.course_item_id) === String(c.item_id))
    views.push({ itemId: String(c.item_id), slug: String(c.slug), versionId: String(c.version_id), version: Number(c.version), title: String(c.title), description: String(c.body), category: fields.category ?? null,
      objectives: fields.objectives ?? [], estimatedMinutes: fields.estimated_minutes ? Number(fields.estimated_minutes) : minutesKnown && minutes ? minutes : null, publishedAt: String(c.published_at), updatedAt: new Date(latest).toISOString(),
      modules, progress: { completed, available, unavailable }, lastLessonItemId: state ? String(state.last_lesson_item_id) : null, lastViewedAt: state ? String(state.last_viewed_at) : null })
  }
  return { views, byLesson }
}

/** Dashboard and catalogue: every currently servable course with this partner's own progress. No lesson bodies. */
export async function getAcademy() {
  const actor = await partner()
  return db.transaction(async (tx) => {
    await tx.execute(sql`set transaction isolation level repeatable read`)
    const partnerId = await partnerGuard(tx, actor)
    const { views } = await load(tx, partnerId)
    const history = await rows(tx, sql`select count(*)::int n from empower_academy_completions where partner_id=${partnerId}`)
    return { enabled: true, courses: views, completionsRecorded: Number(history[0].n) }
  })
}

/** One course with lesson bodies and knowledge-check questions (never answers or explanations before an attempt). */
export async function getAcademyCourse(input: { slug?: unknown }) {
  const actor = await partner()
  const slug = typeof input.slug === "string" && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(input.slug) && input.slug.length <= 120 ? input.slug : null
  if (!slug) throw new ContentError("Course not found.", 404)
  return db.transaction(async (tx) => {
    await tx.execute(sql`set transaction isolation level repeatable read`)
    const partnerId = await partnerGuard(tx, actor)
    const { views, byLesson } = await load(tx, partnerId, slug)
    const course = views[0]
    if (!course) throw new ContentError("This course is not available.", 404)
    const versionIds = course.modules.flatMap((m) => m.lessons.filter((l) => l.available).map((l) => l.versionId!))
    const attempts = versionIds.length ? await rows(tx, sql`select distinct on (lesson_version_id,question_id) lesson_version_id,question_id,correct,answer,attempted_at from empower_academy_check_attempts
      where partner_id=${partnerId} and lesson_version_id in (${uuidList(versionIds)}) order by lesson_version_id,question_id,attempted_at desc`) : []
    const lessons: Record<string, { body: string; sources: unknown; checks: unknown[] }> = {}
    for (const m of course.modules) for (const l of m.lessons) {
      if (!l.available) continue
      const src = byLesson.get(l.itemId)!
      const fields = (src.fields ?? {}) as { checks?: unknown }
      const full = Array.isArray(fields.checks) ? fields.checks as { id: string; answer: string[]; explanation: string }[] : []
      lessons[l.itemId] = { body: String(src.body), sources: (src as Row).source_refs ?? [], checks: publicChecks(fields.checks).map((q) => {
        const last = attempts.find((a) => String(a.lesson_version_id) === l.versionId && a.question_id === q.id)
        const key = full.find((f) => f.id === q.id)
        return last ? { ...q, lastAttempt: { correct: last.correct === true, given: last.answer, answer: key?.answer ?? [], explanation: key?.explanation ?? "" } } : q
      }) }
    }
    const related = await relatedResourcesForLessons(tx, Object.keys(lessons))
    for (const id of Object.keys(lessons)) (lessons[id] as typeof lessons[string] & { related?: unknown }).related = related[id] ?? []
    return { course, lessons }
  })
}

const translate = (error: unknown, fallback: string): never => {
  if (error instanceof ContentError) throw error
  const safe = translateDbError(error, fallback)
  if (safe) throw new ContentError(safe.message, safe.status)
  throw error
}

/** Optional, voluntary and idempotent: pressing "complete" twice records one completion. Refused if the lesson is no longer available. */
export async function completeAcademyLesson(input: { courseVersionId?: unknown; lessonVersionId?: unknown }) {
  const actor = await partner(), courseVersionId = uuid(input.courseVersionId), lessonVersionId = uuid(input.lessonVersionId)
  return db.transaction(async (tx) => {
    const partnerId = await partnerGuard(tx, actor)
    try {
      const inserted = await rows(tx, sql`insert into empower_academy_completions(id,partner_id,course_version_id,lesson_version_id) values(${randomUUID()},${partnerId},${courseVersionId},${lessonVersionId})
        on conflict (partner_id,lesson_version_id) do nothing returning id`)
      return { completed: true, alreadyRecorded: inserted.length === 0 }
    } catch (error) { return translate(error, "This lesson is not currently available.") }
  })
}

/** "Continue where you left off". Recorded only for a lesson that is currently servable in that course. */
export async function recordAcademyView(input: { courseVersionId?: unknown; lessonVersionId?: unknown }) {
  const actor = await partner(), courseVersionId = uuid(input.courseVersionId), lessonVersionId = uuid(input.lessonVersionId)
  return db.transaction(async (tx) => {
    const partnerId = await partnerGuard(tx, actor)
    const [ok] = await rows(tx, sql`select empower_academy_lesson_servable(${courseVersionId}::uuid,${lessonVersionId}::uuid) ok, (select item_id from empower_content_versions where id=${courseVersionId}) course_item,
      (select item_id from empower_content_versions where id=${lessonVersionId}) lesson_item`)
    if (!ok?.ok) throw new ContentError("This lesson is not currently available.", 409)
    await tx.execute(sql`insert into empower_academy_course_state(partner_id,course_item_id,last_lesson_item_id) values(${partnerId},${String(ok.course_item)},${String(ok.lesson_item)})
      on conflict (partner_id,course_item_id) do update set last_lesson_item_id=excluded.last_lesson_item_id,last_viewed_at=now()`)
    return { recorded: true }
  })
}

/** Grades an optional knowledge-check answer on the server and returns feedback. Retries are allowed; every attempt is kept privately. */
export async function attemptAcademyCheck(input: { courseVersionId?: unknown; lessonVersionId?: unknown; questionId?: unknown; answer?: unknown }) {
  const actor = await partner(), courseVersionId = uuid(input.courseVersionId), lessonVersionId = uuid(input.lessonVersionId)
  return db.transaction(async (tx) => {
    const partnerId = await partnerGuard(tx, actor)
    const [lesson] = await rows(tx, sql`select v.fields from empower_content_versions v where v.id=${lessonVersionId} and empower_academy_lesson_servable(${courseVersionId}::uuid,${lessonVersionId}::uuid)`)
    if (!lesson) throw new ContentError("This lesson is not currently available.", 409)
    const result = gradeCheck((lesson.fields as { checks?: unknown } | null)?.checks, input.questionId, input.answer)
    try {
      await tx.execute(sql`insert into empower_academy_check_attempts(id,partner_id,course_version_id,lesson_version_id,question_id,answer,correct)
        values(${randomUUID()},${partnerId},${courseVersionId},${lessonVersionId},${result.questionId},${JSON.stringify(result.given)}::jsonb,${result.correct})`)
    } catch (error) { return translate(error, "This lesson is not currently available.") }
    return result
  })
}
