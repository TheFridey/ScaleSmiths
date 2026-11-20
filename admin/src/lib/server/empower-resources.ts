import "server-only"
import { sql, type SQL } from "drizzle-orm"
import { db, type AdminDatabaseTransaction } from "@/lib/db"
import { ContentError, RESOURCE_CATEGORIES, contentAudience, courseLessonIds, expandQuery, searchQuery, type Synonym } from "@/lib/empower-content"
import { partnerAcademyEnabled, partnerGuard, partnerResourcesEnabled } from "./empower-partner"
export { partnerResourcesEnabled }
import { requireCapability } from "./rbac"

/*
 * Operation Empower B1.3: the partner Resource Centre. OFF unless PARTNER_RESOURCE_CENTRE_ENABLED=true, independent of the
 * founder studio and the Academy. Partners see only published, in-date resources (both audiences; the audience is shown so a
 * partner knows what may be shared). Search is deterministic PostgreSQL full-text search over the published version's own
 * text, with founder-managed synonyms; nothing is generated. The frozen B0 resource library (AP-ENG-01) is shown read-only and
 * labelled "legacy". Downloads are plain-text Markdown of the approved version, with its approval details; no files are stored.
 */
type Row = Record<string, unknown>
type Executor = Pick<AdminDatabaseTransaction, "execute">
const rows = async (tx: Executor, query: SQL): Promise<Row[]> => (await tx.execute(query)).rows as Row[]
const UTC_TODAY = sql`(now() at time zone 'UTC')::date`
const SERVABLE = sql`v.status='published' and v.review_by >= ${UTC_TODAY}`

async function partner() {
  if (!partnerResourcesEnabled()) throw new ContentError("The Resource Centre is not available yet.", 404)
  return requireCapability("expansion.partner")
}
const slugOf = (value: unknown) => typeof value === "string" && value.length <= 160 && /^(legacy-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[a-z0-9]+(-[a-z0-9]+)*)$/.test(value) ? value : null
const shape = (r: Row) => {
  const f = (r.fields ?? {}) as { summary?: string; category?: string }
  return { slug: String(r.slug), title: String(r.title), summary: f.summary ?? "", category: f.category ?? null, audience: String(r.audience), version: Number(r.version),
    approvedAt: r.approved_at ? new Date(String(r.approved_at)).toISOString() : null, reviewBy: r.review_by ? String(r.review_by).slice(0, 10) : null,
    publishedAt: r.published_at ? new Date(String(r.published_at)).toISOString() : null, legacy: false }
}

async function activeSynonyms(tx: Executor): Promise<Synonym[]> {
  return (await rows(tx, sql`select term,expansion from empower_search_synonyms where active order by term`)).map((r) => ({ term: String(r.term), expansion: String(r.expansion) }))
}

/** Resource list or ranked search, with optional category and audience filters. Legacy B0 resources follow, labelled. */
export async function listResources(input: { q?: unknown; category?: unknown; audience?: unknown }) {
  const actor = await partner()
  const q = searchQuery(input.q)
  const category = input.category == null || input.category === "" || input.category === "all" ? null
    : (RESOURCE_CATEGORIES as readonly string[]).includes(String(input.category)) ? String(input.category) : (() => { throw new ContentError("Choose a valid category.") })()
  const audience = input.audience == null || input.audience === "" || input.audience === "all" ? null : contentAudience(input.audience)
  return db.transaction(async (tx) => {
    await tx.execute(sql`set transaction isolation level repeatable read`)
    await partnerGuard(tx, actor)
    const filters = sql`${category ? sql`and v.fields->>'category'=${category}` : sql``} ${audience ? sql`and i.audience=${audience}` : sql``}`
    let found: Row[]
    if (q) {
      const expanded = expandQuery(q, await activeSynonyms(tx))
      found = await rows(tx, sql`with q as (select websearch_to_tsquery('english', ${expanded}) query, lower(${q}) raw)
        select i.slug,i.audience,v.version,v.title,v.fields,v.approved_at,v.review_by,v.published_at,
          ts_rank_cd(empower_search_document(v.title,v.body,v.fields), q.query, 32)
            + case when lower(v.title)=q.raw then 10 when position(q.raw in lower(v.title))>0 then 1 else 0 end rank
        from empower_content_versions v join empower_content_items i on i.id=v.item_id cross join q
        where i.kind='resource' and ${SERVABLE} and empower_search_document(v.title,v.body,v.fields) @@ q.query ${filters}
        order by rank desc, i.slug limit 50`)
    } else {
      found = await rows(tx, sql`select i.slug,i.audience,v.version,v.title,v.fields,v.approved_at,v.review_by,v.published_at from empower_content_versions v
        join empower_content_items i on i.id=v.item_id where i.kind='resource' and ${SERVABLE} ${filters} order by v.fields->>'category', v.title limit 200`)
    }
    // AP-ENG-01: the frozen B0 library, read-only, partner audience only, never part of ranked search.
    const legacy = !category && audience !== "client_facing" ? await rows(tx, sql`select * from (select distinct on (title) id,title,category,created_at from expansion_resources where status='published' and audience='partner'
      ${q ? sql`and position(lower(${q}) in lower(title || ' ' || content))>0` : sql``} order by title, version desc) latest order by created_at desc limit 50`) : []
    return {
      query: q, category, audience,
      resources: found.map(shape),
      legacy: legacy.map((r) => ({ slug: `legacy-${String(r.id)}`, title: String(r.title), summary: "", category: String(r.category), audience: "partner_only", version: null, approvedAt: null, reviewBy: null, publishedAt: new Date(String(r.created_at)).toISOString(), legacy: true })),
    }
  })
}

async function loadResource(tx: Executor, slug: string) {
  if (slug.startsWith("legacy-")) {
    const [r] = await rows(tx, sql`select id,title,category,content,created_at from expansion_resources where id=${slug.slice(7)}::uuid and status='published' and audience='partner'`)
    if (!r) return null
    return { slug, title: String(r.title), summary: "", category: String(r.category), audience: "partner_only", version: null, approvedAt: null, reviewBy: null, publishedAt: new Date(String(r.created_at)).toISOString(),
      legacy: true, body: String(r.content), sources: [] as string[], related: [] as { kind: string; title: string; href: string }[] }
  }
  const [r] = await rows(tx, sql`select i.id item_id,i.slug,i.audience,v.version,v.title,v.body,v.fields,v.source_refs,v.approved_at,v.review_by,v.published_at from empower_content_versions v
    join empower_content_items i on i.id=v.item_id where i.kind='resource' and i.slug=${slug} and ${SERVABLE}`)
  if (!r) return null
  const ids = ((r.fields as { related?: string[] } | null)?.related ?? []).filter((id) => /^[0-9a-f-]{36}$/.test(id))
  const related: { kind: string; title: string; href: string }[] = []
  if (ids.length) {
    const list = sql.join(ids.map((id) => sql`${id}::uuid`), sql`,`)
    for (const x of await rows(tx, sql`select i.id,i.kind,i.slug,v.title from empower_content_versions v join empower_content_items i on i.id=v.item_id
      where i.id in (${list}) and i.kind='resource' and ${SERVABLE} order by v.title`)) related.push({ kind: "resource", title: String(x.title), href: `/partner/resources/${String(x.slug)}` })
    if (partnerAcademyEnabled()) {
      const lessons = await rows(tx, sql`select i.id,v.title from empower_content_versions v join empower_content_items i on i.id=v.item_id
        where i.id in (${list}) and i.kind='lesson' and i.audience='partner_only' and ${SERVABLE} order by v.title`)
      if (lessons.length) {
        const courses = await rows(tx, sql`select i.slug,v.fields from empower_content_versions v join empower_content_items i on i.id=v.item_id where i.kind='course' and ${SERVABLE} order by i.slug`)
        for (const l of lessons) {
          const course = courses.find((c) => courseLessonIds(c.fields).includes(String(l.id)))
          if (course) related.push({ kind: "lesson", title: String(l.title), href: `/partner/academy/${String(course.slug)}?lesson=${String(l.id)}` })
        }
      }
    }
  }
  return { ...shape(r), body: String(r.body), sources: (r.source_refs ?? []) as string[], related }
}

export async function getResource(input: { slug?: unknown }) {
  const actor = await partner(), slug = slugOf(input.slug)
  if (!slug) throw new ContentError("Resource not found.", 404)
  return db.transaction(async (tx) => {
    await tx.execute(sql`set transaction isolation level repeatable read`)
    await partnerGuard(tx, actor)
    const resource = await loadResource(tx, slug)
    if (!resource) throw new ContentError("This resource is not available.", 404)
    return resource
  })
}

/** The approved version as a Markdown text file, headed with its audience and approval details. Not logged (AP-PRIV-03). */
export async function downloadResource(input: { slug?: unknown }) {
  const r = await getResource(input)
  const audience = r.audience === "client_facing" ? "Client-facing: approved for sharing" : "Partner only: do not share"
  const header = [`# ${r.title}`, "", `> ${audience}.${r.legacy ? " Legacy resource from the earlier library." : ` Version ${r.version}, approved ${r.approvedAt?.slice(0, 10)}, review by ${r.reviewBy}.`}`,
    "> Issued by ScaleSmiths from the Partner Resource Centre. Check the Resource Centre for the current version before reuse.", ""]
  return { filename: `${r.slug.replace(/[^a-z0-9-]/g, "")}.md`, text: [...header, r.body, ""].join("\n") }
}

/** For the Academy lesson viewer: published resources that name this lesson as related. Empty while the Resource Centre is off. */
export async function relatedResourcesForLessons(tx: Executor, lessonIds: string[]) {
  if (!partnerResourcesEnabled() || !lessonIds.length) return {} as Record<string, { title: string; href: string }[]>
  const out: Record<string, { title: string; href: string }[]> = {}
  const found = await rows(tx, sql`select i.slug,v.title,v.fields->'related' related from empower_content_versions v join empower_content_items i on i.id=v.item_id
    where i.kind='resource' and ${SERVABLE} and jsonb_typeof(v.fields->'related')='array' order by v.title`)
  for (const r of found) for (const id of (r.related as string[]) ?? []) if (lessonIds.includes(id)) (out[id] ??= []).push({ title: String(r.title), href: `/partner/resources/${String(r.slug)}` })
  return out
}
