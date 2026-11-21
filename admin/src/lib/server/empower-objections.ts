import "server-only"
import { sql, type SQL } from "drizzle-orm"
import { db, type AdminDatabaseTransaction } from "@/lib/db"
import { ContentError, OBJECTION_CATEGORIES, courseLessonIds, expandQuery, searchQuery, type Synonym } from "@/lib/empower-content"
import { partnerAcademyEnabled, partnerGuard, partnerKnowledgeEnabled, partnerResourcesEnabled } from "./empower-partner"
import { requireCapability } from "./rbac"

/*
 * Operation Empower B1.5: the partner objection-handling workspace. OFF unless PARTNER_OBJECTION_HANDLING_ENABLED=true, independent of
 * the other switches. Partners search approved objection responses (published, in review date) with the B1.3 full-text index and the
 * founder-managed synonyms; an exact concern or alternative-phrasing match always ranks first, then rank, then slug. Each response
 * keeps the client-safe line (the only text offered for copying) apart from the partner explanation, limitation and escalation.
 * Related resources, lessons and knowledge entries are shown only when they are themselves servable and their module is switched on.
 * Nothing is generated and nothing is logged.
 */
type Row = Record<string, unknown>
type Executor = Pick<AdminDatabaseTransaction, "execute">
export const partnerObjectionsEnabled = () => process.env.PARTNER_OBJECTION_HANDLING_ENABLED === "true"
const rows = async (tx: Executor, query: SQL): Promise<Row[]> => (await tx.execute(query)).rows as Row[]
/** Published and within its review date (UTC calendar day). `asOf` exists only so tests can check expiry deterministically, as servableContent does. */
const servable = (asOf?: string) => {
  if (asOf !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new ContentError("Invalid date.")
  return asOf ? sql`v.status='published' and v.review_by >= ${asOf}::date` : sql`v.status='published' and v.review_by >= (now() at time zone 'UTC')::date`
}
const ALIASES = sql`jsonb_array_elements_text(case when jsonb_typeof(v.fields->'aliases')='array' then v.fields->'aliases' else '[]'::jsonb end)`

async function partner() {
  if (!partnerObjectionsEnabled()) throw new ContentError("Objection handling is not available yet.", 404)
  return requireCapability("expansion.partner")
}

type Fields = { category?: string; concern?: string; client_line?: string; guidance?: string; limitation?: string; discovery_questions?: string[]; aliases?: string[]; related?: string[]
  escalation_required?: string; escalation_condition?: string; escalation_route?: string; source_id?: string }
export type RelatedLink = { kind: "resource" | "lesson" | "knowledge"; title: string; href: string }
export type ObjectionResponse = ReturnType<typeof shape> & { related: RelatedLink[] }

const shape = (r: Row) => {
  const f = (r.fields ?? {}) as Fields
  return {
    itemId: String(r.item_id), slug: String(r.slug), version: Number(r.version), title: String(r.title), category: f.category ?? null,
    concern: f.concern ?? String(r.title), clientLine: f.client_line ?? "", guidance: f.guidance ?? "", limitation: f.limitation ?? "",
    discoveryQuestions: Array.isArray(f.discovery_questions) ? f.discovery_questions : [], aliases: Array.isArray(f.aliases) ? f.aliases : [],
    escalation: { required: f.escalation_required ?? "never", condition: f.escalation_condition ?? null, route: f.escalation_route ?? null },
    sources: (r.source_refs ?? []) as string[],
    approvedAt: r.approved_at ? new Date(String(r.approved_at)).toISOString() : null, publishedAt: r.published_at ? new Date(String(r.published_at)).toISOString() : null,
    reviewBy: r.review_by ? String(r.review_by).slice(0, 10) : null,
  }
}

/** Resolve related links to servable content in switched-on modules only; anything withdrawn, expired, draft or unknown is dropped. */
export async function relatedForObjections(tx: Executor, entries: { itemId: string; related: string[] }[], asOf?: string): Promise<Record<string, RelatedLink[]>> {
  const SERVABLE = servable(asOf)
  const ids = [...new Set(entries.flatMap((e) => e.related.filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id))))]
  const out: Record<string, RelatedLink[]> = {}
  if (!ids.length) return out
  const list = sql.join(ids.map((id) => sql`${id}::uuid`), sql`,`)
  const found = new Map<string, RelatedLink>()
  if (partnerResourcesEnabled()) for (const x of await rows(tx, sql`select i.id,i.slug,v.title from empower_content_versions v join empower_content_items i on i.id=v.item_id
    where i.id in (${list}) and i.kind='resource' and ${SERVABLE}`)) found.set(String(x.id), { kind: "resource", title: String(x.title), href: `/partner/resources/${String(x.slug)}` })
  if (partnerKnowledgeEnabled()) for (const x of await rows(tx, sql`select i.id,v.title,coalesce(v.fields->>'question', v.title) question from empower_content_versions v join empower_content_items i on i.id=v.item_id
    where i.id in (${list}) and i.kind='knowledge' and ${SERVABLE}`)) found.set(String(x.id), { kind: "knowledge", title: String(x.question), href: `/partner/knowledge?q=${encodeURIComponent(String(x.question))}` })
  if (partnerAcademyEnabled()) {
    const lessons = await rows(tx, sql`select i.id,v.title from empower_content_versions v join empower_content_items i on i.id=v.item_id
      where i.id in (${list}) and i.kind='lesson' and i.audience='partner_only' and ${SERVABLE}`)
    if (lessons.length) {
      const courses = await rows(tx, sql`select i.slug,v.fields from empower_content_versions v join empower_content_items i on i.id=v.item_id where i.kind='course' and ${SERVABLE} order by i.slug`)
      for (const l of lessons) {
        const course = courses.find((c) => courseLessonIds(c.fields).includes(String(l.id)))
        if (course) found.set(String(l.id), { kind: "lesson", title: String(l.title), href: `/partner/academy/${String(course.slug)}?lesson=${String(l.id)}` })
      }
    }
  }
  const order = { resource: 0, lesson: 1, knowledge: 2 } as const
  for (const e of entries) out[e.itemId] = e.related.map((id) => found.get(id)).filter((x): x is RelatedLink => !!x).sort((a, b) => order[a.kind] - order[b.kind] || a.title.localeCompare(b.title))
  return out
}

function category(value: unknown): string | null {
  if (value == null || value === "" || value === "all") return null
  if (typeof value !== "string" || !(OBJECTION_CATEGORIES as readonly string[]).includes(value)) throw new ContentError("Choose a valid category.")
  return value
}

/** Ranked objection search; with no query, the category list or the most recently approved responses. */
export async function searchObjections(input: { q?: unknown; category?: unknown }, options: { asOf?: string } = {}) {
  const SERVABLE = servable(options.asOf)
  const actor = await partner()
  const q = searchQuery(input.q)
  const cat = category(input.category)
  return db.transaction(async (tx) => {
    await tx.execute(sql`set transaction isolation level repeatable read`)
    await partnerGuard(tx, actor)
    const catFilter = cat ? sql`and v.fields->>'category'=${cat}` : sql``
    const columns = sql`i.id item_id,i.slug,v.version,v.title,v.fields,v.source_refs,v.approved_at,v.published_at,v.review_by`
    let found: Row[]
    if (q) {
      const synonyms: Synonym[] = (await rows(tx, sql`select term,expansion from empower_search_synonyms where active order by term`)).map((r) => ({ term: String(r.term), expansion: String(r.expansion) }))
      const normalised = q.toLowerCase().replace(/[?!.]+$/, "").replace(/["“”']/g, "").trim()
      found = await rows(tx, sql`with q as (select websearch_to_tsquery('english', ${expandQuery(q, synonyms)}) query, ${normalised} raw)
        select ${columns},
          (case when lower(regexp_replace(regexp_replace(coalesce(v.fields->>'concern', v.title), '["“”'']', '', 'g'), '[?!.]+$', '')) = q.raw
                  or exists (select 1 from ${ALIASES} a(alias) where lower(regexp_replace(regexp_replace(a.alias, '["“”'']', '', 'g'), '[?!.]+$', '')) = q.raw) then 100 else 0 end)
          + ts_rank_cd(empower_search_document(v.title,v.body,v.fields), q.query, 32) rank
        from empower_content_versions v join empower_content_items i on i.id=v.item_id cross join q
        where i.kind='objection' and i.audience='partner_only' and ${SERVABLE} ${catFilter}
          and (empower_search_document(v.title,v.body,v.fields) @@ q.query
               or exists (select 1 from ${ALIASES} a(alias) where lower(regexp_replace(regexp_replace(a.alias, '["“”'']', '', 'g'), '[?!.]+$', '')) = q.raw))
        order by rank desc, i.slug limit 20`)
    } else if (cat) {
      found = await rows(tx, sql`select ${columns} from empower_content_versions v join empower_content_items i on i.id=v.item_id
        where i.kind='objection' and i.audience='partner_only' and ${SERVABLE} ${catFilter} order by v.title, i.slug limit 100`)
    } else {
      found = await rows(tx, sql`select ${columns} from empower_content_versions v join empower_content_items i on i.id=v.item_id
        where i.kind='objection' and i.audience='partner_only' and ${SERVABLE} order by v.approved_at desc, i.slug limit 6`)
    }
    const entries = found.map(shape)
    const related = await relatedForObjections(tx, found.map((r) => ({ itemId: String(r.item_id), related: ((r.fields as Fields)?.related ?? []) as string[] })), options.asOf)
    const categories = (await rows(tx, sql`select v.fields->>'category' category, count(*)::int n from empower_content_versions v join empower_content_items i on i.id=v.item_id
      where i.kind='objection' and i.audience='partner_only' and ${SERVABLE} and v.fields ? 'category' group by 1 order by 1`)).map((r) => ({ key: String(r.category), count: Number(r.n) }))
    return { query: q, category: cat, mode: q ? "search" : cat ? "category" : "recent", categories, entries: entries.map((e) => ({ ...e, related: related[e.itemId] ?? [] })) }
  })
}
