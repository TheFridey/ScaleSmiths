import "server-only"
import { randomUUID } from "node:crypto"
import { sql, type SQL } from "drizzle-orm"
import { db, type AdminDatabaseTransaction } from "@/lib/db"
import { ADMIN_ROLES, type AdminRole } from "@/lib/admin-users"
import { hasCapability } from "@/lib/rbac"
import { translateDbError } from "@/lib/db-errors"
import {
  ContentError, approvalAuthority, changeSummary, checkSubmission, contentAudience, contentBody, contentDecision, contentFields, contentKind,
  contentSlug, contentTitle, courseLessonIds, reviewByDate, reviewCadence, sourceRefs, type ContentAudience, type ContentKind,
} from "@/lib/empower-content"
import { requireCapability } from "./rbac"

/*
 * Operation Empower B1.1: the founder content workflow. Founders (holders of `expansion.manage`) draft, submit, decide, publish,
 * supersede and withdraw content. Nothing here serves content to partners: `servableContent` is the single read rule later phases
 * must use, and it is exercised only by tests until a partner surface ships behind its own switch.
 * The whole workspace is OFF unless EMPOWER_FOUNDER_CONTENT_ENABLED=true.
 * Lock order: admin_users (share) -> empower_content_items (update) -> empower_content_versions (update).
 */
type Row = Record<string, unknown>
type Executor = Pick<AdminDatabaseTransaction, "execute">
type Actor = Awaited<ReturnType<typeof requireCapability>>
const FOUNDER_ROLES = ADMIN_ROLES.filter((role) => hasCapability(role, "expansion.manage"))

export const founderContentEnabled = () => process.env.EMPOWER_FOUNDER_CONTENT_ENABLED === "true"
const rows = async (tx: Executor, query: SQL): Promise<Row[]> => (await tx.execute(query)).rows as Row[]
const uuid = (value: unknown) => {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new ContentError("A valid record identifier is required.")
  return value.toLowerCase()
}
const conflict = (message: string): never => { throw new ContentError(message, 409) }
const audit = (tx: Executor, actorId: string, entity: string, action: string, details: unknown) =>
  tx.execute(sql`insert into expansion_audit(actor_id,entity_id,action,details) values(${actorId},${entity},${action},${JSON.stringify(details)}::jsonb)`)
/** Database refusals (lifecycle trigger, unique indexes) become founder-readable conflicts; anything else propagates. */
async function guarded<T>(operation: () => Promise<T>, fallback: string): Promise<T> {
  try { return await operation() } catch (error) {
    if (error instanceof ContentError) throw error
    const safe = translateDbError(error, fallback)
    if (safe) throw new ContentError(safe.message, safe.status)
    throw error
  }
}

async function founder() {
  if (!founderContentEnabled()) throw new ContentError("The founder Content workspace is not enabled in this environment.", 404)
  return requireCapability("expansion.manage")
}
async function founderGuard(tx: Executor, actor: Actor) {
  const [user] = await rows(tx, sql`select role::text,active,session_version from admin_users where id=${actor.id} for share`)
  if (!user?.active || user.session_version !== actor.sessionVersion || !hasCapability(user.role as AdminRole, "expansion.manage")) throw new ContentError("Founder authority was revoked.", 403)
}
async function activeFounderCount(tx: Executor) {
  const roleList = sql.join(FOUNDER_ROLES.map((role) => sql`${role}`), sql`,`)
  // Share-locked so a founder cannot self-approve while a second founder is being activated concurrently (AP-GOV-04).
  const [row] = await rows(tx, sql`select count(*)::int n from (select id from admin_users where active=true and role::text in (${roleList}) for share) founders`)
  return Number(row.n)
}
async function lockVersion(tx: Executor, id: string) {
  const [src] = await rows(tx, sql`select item_id from empower_content_versions where id=${id}`)
  if (!src) throw new ContentError("Content version not found.", 404)
  const [item] = await rows(tx, sql`select * from empower_content_items where id=${String(src.item_id)} for update`)
  const [version] = await rows(tx, sql`select * from empower_content_versions where id=${id} for update`)
  return { item, version }
}

/**
 * AP-GOV-04 separation of duties: a version has exactly one author, who alone may edit and submit it. Otherwise a second founder
 * could rewrite someone else's draft and then approve it as "not the author". Another founder can archive an abandoned draft
 * and start their own revision instead.
 */
function requireAuthor(version: Row, actor: Actor) {
  if (String(version.created_by) !== actor.id) throw new ContentError("Only the author of this draft can edit or submit it. Archive it and start your own revision instead.", 403)
}

/**
 * B1.2: a course may be submitted or published only when every linked lesson has a published, in-date version. Lessons are
 * approved independently (with their own author/approver separation), so a founder cannot slip their own unreviewed lesson
 * into a course. Lesson item rows are share-locked in id order so a concurrent withdrawal waits for this check.
 */
async function assertCourseLessonsServable(tx: Executor, fields: unknown) {
  const ids = courseLessonIds(fields)
  if (!ids.length) throw new ContentError("A course needs at least one lesson.", 409)
  const list = sql.join(ids.map((lessonId) => sql`${lessonId}::uuid`), sql`,`)
  await tx.execute(sql`select id from empower_content_items where id in (${list}) order by id for share`)
  const ready = await rows(tx, sql`select i.id from empower_content_items i join empower_content_versions v on v.item_id=i.id and v.status='published' and v.review_by >= (now() at time zone 'UTC')::date where i.kind='lesson' and i.audience='partner_only' and i.id in (${list})`)
  const missing = ids.filter((lessonId) => !ready.some((r) => String(r.id) === lessonId))
  if (missing.length) throw new ContentError(`Every lesson in a course must be a published, in-date, partner-only lesson first (${missing.length} of ${ids.length} not ready).`, 409)
}

export interface DraftInput { title?: unknown; body?: unknown; fields?: unknown; sourceRefs?: unknown; changeSummary?: unknown }
function draftValues(kind: ContentKind, input: DraftInput) {
  return {
    title: contentTitle(input.title), body: contentBody(input.body ?? ""), fields: contentFields(kind, input.fields, false),
    sources: sourceRefs(input.sourceRefs), summary: changeSummary(input.changeSummary),
  }
}

export async function createContentItem(input: DraftInput & { kind?: unknown; slug?: unknown; audience?: unknown; cadence?: unknown }) {
  const actor = await founder()
  const kind = contentKind(input.kind), slug = contentSlug(input.slug), audience = contentAudience(input.audience), cadence = reviewCadence(input.cadence)
  if (kind === "course" && audience !== "partner_only") throw new ContentError("Academy courses are for partners only.")
  const values = draftValues(kind, input)
  const itemId = randomUUID(), versionId = randomUUID()
  return db.transaction(async (tx) => guarded(async () => {
    await founderGuard(tx, actor)
    await tx.execute(sql`insert into empower_content_items(id,kind,slug,audience,review_cadence_months,created_by) values(${itemId},${kind},${slug},${audience},${cadence},${actor.id})`)
    await tx.execute(sql`insert into empower_content_versions(id,item_id,version,title,body,fields,source_refs,change_summary,created_by)
      values(${versionId},${itemId},1,${values.title},${values.body},${JSON.stringify(values.fields)}::jsonb,${JSON.stringify(values.sources)}::jsonb,${values.summary},${actor.id})`)
    await audit(tx, actor.id, itemId, "empower_item_created", { kind, slug, audience, reviewCadenceMonths: cadence, versionId })
    return { itemId, versionId, version: 1 }
  }, "A content item with that slug already exists."))
}

export async function saveContentDraft(input: DraftInput & { versionId?: unknown }) {
  const actor = await founder(), id = uuid(input.versionId)
  return db.transaction(async (tx) => guarded(async () => {
    await founderGuard(tx, actor)
    const { item, version } = await lockVersion(tx, id)
    if (version.status !== "draft") conflict("Only a draft can be edited. Start a new revision instead.")
    requireAuthor(version, actor)
    const values = draftValues(item.kind as ContentKind, input)
    await tx.execute(sql`update empower_content_versions set title=${values.title},body=${values.body},fields=${JSON.stringify(values.fields)}::jsonb,
      source_refs=${JSON.stringify(values.sources)}::jsonb,change_summary=${values.summary} where id=${id}`)
    await audit(tx, actor.id, id, "empower_draft_saved", { itemId: item.id, version: version.version })
    return { versionId: id }
  }, "This draft cannot be saved."))
}

/** Starts the next version of an item from its latest content. Only one version may be in progress at a time. */
export async function startContentRevision(input: { itemId?: unknown; changeSummary?: unknown }) {
  const actor = await founder(), itemId = uuid(input.itemId), summary = changeSummary(input.changeSummary)
  return db.transaction(async (tx) => guarded(async () => {
    await founderGuard(tx, actor)
    const [item] = await rows(tx, sql`select * from empower_content_items where id=${itemId} for update`)
    if (!item) throw new ContentError("Content item not found.", 404)
    const [open] = await rows(tx, sql`select id,status from empower_content_versions where item_id=${itemId} and status in ('draft','in_review','approved')`)
    if (open) conflict(`Version in progress (${String(open.status).replace("_", " ")}): finish or archive it first.`)
    const [latest] = await rows(tx, sql`select * from empower_content_versions where item_id=${itemId} order by version desc limit 1`)
    const versionId = randomUUID(), next = Number(latest.version) + 1
    await tx.execute(sql`insert into empower_content_versions(id,item_id,version,title,body,fields,source_refs,change_summary,created_by)
      values(${versionId},${itemId},${next},${String(latest.title)},${String(latest.body)},${JSON.stringify(latest.fields)}::jsonb,${JSON.stringify(latest.source_refs)}::jsonb,${summary},${actor.id})`)
    await audit(tx, actor.id, versionId, "empower_revision_started", { itemId, version: next, fromVersion: latest.version })
    return { versionId, version: next }
  }, "A revision could not be started."))
}

export async function submitContentVersion(input: { versionId?: unknown; lintOverrideReason?: unknown }) {
  const actor = await founder(), id = uuid(input.versionId)
  return db.transaction(async (tx) => guarded(async () => {
    await founderGuard(tx, actor)
    const { item, version } = await lockVersion(tx, id)
    if (version.status !== "draft") conflict("Only a draft can be submitted for review.")
    requireAuthor(version, actor)
    const check = checkSubmission({
      kind: item.kind as ContentKind, audience: item.audience as ContentAudience, cadenceMonths: Number(item.review_cadence_months),
      title: String(version.title), body: String(version.body), fields: version.fields, sources: version.source_refs, lintOverrideReason: input.lintOverrideReason,
    })
    await tx.execute(sql`update empower_content_versions set lint_override_reason=${check.lintOverrideReason} where id=${id}`)
    if (item.kind === "course") await assertCourseLessonsServable(tx, check.fields)
    await tx.execute(sql`update empower_content_versions set status='in_review',submitted_by=${actor.id},submitted_at=now() where id=${id}`)
    await audit(tx, actor.id, id, "empower_submitted", { itemId: item.id, version: version.version, lintHits: check.lintHits, lintOverridden: Boolean(check.lintOverrideReason) })
    return { versionId: id, status: "in_review" }
  }, "This version cannot be submitted."))
}

export async function decideContentVersion(input: { versionId?: unknown; decision?: unknown; reference?: unknown; notes?: unknown; reviewBy?: unknown; selfApprovalReason?: unknown }) {
  const actor = await founder(), id = uuid(input.versionId), decision = contentDecision(input.decision)
  const reference = typeof input.reference === "string" ? input.reference.trim() : ""
  const notes = typeof input.notes === "string" ? input.notes.trim() : ""
  if (reference.length < 3 || reference.length > 200) throw new ContentError("Record the decision reference (3 to 200 characters).")
  if (notes.length < 5 || notes.length > 2000) throw new ContentError("Record the reason for your decision (5 to 2000 characters).")
  return db.transaction(async (tx) => guarded(async () => {
    await founderGuard(tx, actor)
    const { item, version } = await lockVersion(tx, id)
    if (version.status !== "in_review") conflict("Only a version in review can receive a decision.")
    let reviewBy: string | null = null, selfApprovalReason: string | null = null
    if (decision === "approved") {
      reviewBy = reviewByDate(input.reviewBy, Number(item.review_cadence_months))
      selfApprovalReason = approvalAuthority({ approverId: actor.id, authorId: String(version.created_by), activeFounders: await activeFounderCount(tx), selfApprovalReason: input.selfApprovalReason }).selfApprovalReason
    } else if (input.selfApprovalReason) throw new ContentError("A self-approval reason applies only to approval.")
    const approvalId = randomUUID()
    await tx.execute(sql`insert into empower_content_approvals(id,version_id,decision,decided_by,reference,notes,review_by,self_approval_reason)
      values(${approvalId},${id},${decision},${actor.id},${reference},${notes},${reviewBy},${selfApprovalReason})`)
    if (decision === "approved") await tx.execute(sql`update empower_content_versions set status='approved',review_by=${reviewBy},approved_at=now() where id=${id}`)
    else if (decision === "changes_requested") await tx.execute(sql`update empower_content_versions set status='changes_requested' where id=${id}`)
    else await tx.execute(sql`update empower_content_versions set status='archived',archived_at=now(),archive_reason=${`Rejected: ${notes}`.slice(0, 2000)} where id=${id}`)
    await audit(tx, actor.id, id, `empower_${decision}`, { itemId: item.id, version: version.version, approvalId, reference, reviewBy, selfApproval: Boolean(selfApprovalReason) })
    return { versionId: id, status: decision === "rejected" ? "archived" : decision, approvalId }
  }, "This decision is not permitted."))
}

/** Publishing a version supersedes the item's previously published version in the same transaction. */
export async function publishContentVersion(input: { versionId?: unknown }) {
  const actor = await founder(), id = uuid(input.versionId)
  return db.transaction(async (tx) => guarded(async () => {
    await founderGuard(tx, actor)
    const { item, version } = await lockVersion(tx, id)
    if (version.status !== "approved") conflict("Only an approved version can be published.")
    // A course is published only if every lesson it links is itself published and in date at this moment (lesson rows share-locked).
    if (item.kind === "course") await assertCourseLessonsServable(tx, version.fields)
    const superseded = await rows(tx, sql`update empower_content_versions set status='superseded',superseded_at=now() where item_id=${String(item.id)} and status='published' returning id,version`)
    await tx.execute(sql`update empower_content_versions set status='published',published_at=now() where id=${id}`)
    await audit(tx, actor.id, id, "empower_published", { itemId: item.id, version: version.version, supersededVersionIds: superseded.map((r) => r.id) })
    return { versionId: id, status: "published", superseded: superseded.map((r) => Number(r.version)) }
  }, "This version cannot be published."))
}

/** Archives a draft or approved version, or withdraws a published one (reason required, AP-PUB-01). History is kept. */
export async function archiveContentVersion(input: { versionId?: unknown; reason?: unknown }) {
  const actor = await founder(), id = uuid(input.versionId)
  const reason = typeof input.reason === "string" ? input.reason.trim() : ""
  if (reason.length < 5 || reason.length > 2000) throw new ContentError("Record the reason (5 to 2000 characters).")
  return db.transaction(async (tx) => guarded(async () => {
    await founderGuard(tx, actor)
    const { item, version } = await lockVersion(tx, id)
    if (!["draft", "approved", "published"].includes(String(version.status))) conflict("This version cannot be archived from its current state.")
    await tx.execute(sql`update empower_content_versions set status='archived',archived_at=now(),archive_reason=${reason} where id=${id}`)
    await audit(tx, actor.id, id, version.status === "published" ? "empower_withdrawn" : "empower_archived", { itemId: item.id, version: version.version, reason })
    return { versionId: id, status: "archived" }
  }, "This version cannot be archived."))
}

/**
 * THE read rule for any partner-facing surface: published, inside its review window, and in an audience the reader may see.
 * Everything else (drafts, in review, approved-but-unpublished, superseded, archived, expired) is never returned.
 */
export async function servableContent(tx: Executor, audiences: readonly ContentAudience[], options: { kind?: ContentKind; asOf?: string } = {}) {
  if (!audiences.length) return []
  const list = sql.join(audiences.map((a) => sql`${contentAudience(a)}`), sql`,`)
  const { kind } = options
  // UTC calendar date, matching the database guards. `asOf` exists only so tests can check expiry deterministically.
  if (options.asOf !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(options.asOf)) throw new ContentError("Invalid date.")
  const today = options.asOf ? sql`${options.asOf}::date` : sql`(now() at time zone 'UTC')::date`
  return rows(tx, sql`select i.id item_id,i.slug,i.kind,i.audience,v.id version_id,v.version,v.title,v.body,v.fields,v.source_refs,v.approved_at,v.review_by,v.published_at
    from empower_content_versions v join empower_content_items i on i.id=v.item_id
    where v.status='published' and v.review_by >= ${today} and i.audience in (${list}) ${kind ? sql`and i.kind=${contentKind(kind)}` : sql``}
    order by i.kind, i.slug`)
}

export async function getContentAdmin() {
  if (!founderContentEnabled()) return { enabled: false }
  const actor = await requireCapability("expansion.manage")
  return db.transaction(async (tx) => {
    await tx.execute(sql`set transaction isolation level repeatable read`)
    await founderGuard(tx, actor)
    const items = await rows(tx, sql`select i.id,i.kind,i.slug,i.audience,i.review_cadence_months,i.created_at,u.display_name created_by_name from empower_content_items i join admin_users u on u.id=i.created_by order by i.kind,i.slug`)
    const versions = await rows(tx, sql`select v.id,v.item_id,v.version,v.title,v.body,v.fields,v.source_refs,v.change_summary,v.lint_override_reason,v.status,v.review_by,v.approved_at,v.published_at,
      v.superseded_at,v.archived_at,v.archive_reason,v.submitted_at,v.created_at,v.created_by,u.display_name author_name,(v.status='published' and v.review_by < (now() at time zone 'UTC')::date) review_overdue
      from empower_content_versions v join admin_users u on u.id=v.created_by order by v.item_id,v.version desc`)
    const approvals = await rows(tx, sql`select a.id,a.version_id,a.decision,a.decided_at,a.reference,a.notes,a.review_by,a.self_approval_reason,u.display_name decided_by_name
      from empower_content_approvals a join admin_users u on u.id=a.decided_by order by a.decided_at desc`)
    const counts: Record<string, number> = {}
    for (const v of versions) counts[String(v.status)] = (counts[String(v.status)] ?? 0) + 1
    return { enabled: true, items, versions, approvals, counts, reviewDue: versions.filter((v) => v.review_overdue).length, activeFounders: await activeFounderCount(tx), actorId: actor.id }
  })
}
