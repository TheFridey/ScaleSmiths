import "server-only"
import { sql, type SQL } from "drizzle-orm"
import { db, type AdminDatabaseTransaction } from "@/lib/db"
import { ContentError, KNOWLEDGE_TOPICS, expandQuery, searchQuery, type Synonym } from "@/lib/empower-content"
import { partnerGuard, partnerKnowledgeEnabled } from "./empower-partner"
import { relatedResourcesForLessons } from "./empower-resources"
import { requireCapability } from "./rbac"

/*
 * Operation Empower B1.4: the partner Knowledge Base. OFF unless PARTNER_KNOWLEDGE_BASE_ENABLED=true, independent of the other
 * switches. Partners search approved knowledge entries (published, in date) with deterministic PostgreSQL full-text search and the
 * founder-managed synonyms; an exact alias or question match always ranks first. Each entry gives the precise partner answer, the
 * client-safe explanation, its limitation, when to escalate and its sources. Nothing is generated and nothing is logged.
 */
type Row = Record<string, unknown>
type Executor = Pick<AdminDatabaseTransaction, "execute">
export { partnerKnowledgeEnabled }
const rows = async (tx: Executor, query: SQL): Promise<Row[]> => (await tx.execute(query)).rows as Row[]
const SERVABLE = sql`v.status='published' and v.review_by >= (now() at time zone 'UTC')::date`

async function partner() {
  if (!partnerKnowledgeEnabled()) throw new ContentError("The Knowledge Base is not available yet.", 404)
  return requireCapability("expansion.partner")
}
type Fields = { question?: string; answer?: string; client_explanation?: string; limitations?: string; escalation_required?: string; escalation_condition?: string; escalation_route?: string; aliases?: string[]; topic?: string }
const shape = (r: Row) => {
  const f = (r.fields ?? {}) as Fields
  const client = (f.client_explanation ?? "").trim()
  return {
    itemId: String(r.item_id), slug: String(r.slug), audience: String(r.audience), version: Number(r.version), title: String(r.title),
    question: f.question ?? String(r.title), answer: f.answer ?? "", clientExplanation: /^none\b/i.test(client) ? null : client || null,
    limitations: f.limitations ?? "", escalation: { required: f.escalation_required ?? "never", condition: f.escalation_condition ?? null, route: f.escalation_route ?? null },
    aliases: Array.isArray(f.aliases) ? f.aliases : [], topic: f.topic ?? null, sources: (r.source_refs ?? []) as string[],
    approvedAt: r.approved_at ? new Date(String(r.approved_at)).toISOString() : null, reviewBy: r.review_by ? String(r.review_by).slice(0, 10) : null,
  }
}

/** Ranked knowledge search (or the full list by topic when there is no query). Exact alias or question matches always come first. */
export async function searchKnowledge(input: { q?: unknown; topic?: unknown }) {
  const actor = await partner()
  const q = searchQuery(input.q)
  const topic = input.topic == null || input.topic === "" || input.topic === "all" ? null
    : (KNOWLEDGE_TOPICS as readonly string[]).includes(String(input.topic)) ? String(input.topic) : (() => { throw new ContentError("Choose a valid topic.") })()
  return db.transaction(async (tx) => {
    await tx.execute(sql`set transaction isolation level repeatable read`)
    await partnerGuard(tx, actor)
    const topicFilter = topic ? sql`and v.fields->>'topic'=${topic}` : sql``
    let found: Row[]
    if (q) {
      const synonyms: Synonym[] = (await rows(tx, sql`select term,expansion from empower_search_synonyms where active order by term`)).map((r) => ({ term: String(r.term), expansion: String(r.expansion) }))
      const normalised = q.toLowerCase().replace(/[?!.]+$/, "").trim()
      found = await rows(tx, sql`with q as (select websearch_to_tsquery('english', ${expandQuery(q, synonyms)}) query, ${normalised} raw)
        select i.id item_id,i.slug,i.audience,v.version,v.title,v.fields,v.source_refs,v.approved_at,v.review_by,
          (case when lower(regexp_replace(coalesce(v.fields->>'question', v.title), '[?!.]+$', '')) = q.raw
                  or exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(v.fields->'aliases')='array' then v.fields->'aliases' else '[]'::jsonb end) a(alias)
                             where lower(regexp_replace(a.alias, '[?!.]+$', '')) = q.raw) then 100 else 0 end)
          + ts_rank_cd(empower_search_document(v.title,v.body,v.fields), q.query, 32) rank
        from empower_content_versions v join empower_content_items i on i.id=v.item_id cross join q
        where i.kind='knowledge' and ${SERVABLE} ${topicFilter}
          and (empower_search_document(v.title,v.body,v.fields) @@ q.query
               or exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(v.fields->'aliases')='array' then v.fields->'aliases' else '[]'::jsonb end) a(alias)
                          where lower(regexp_replace(a.alias, '[?!.]+$', '')) = q.raw))
        order by rank desc, i.slug limit 20`)
    } else {
      found = await rows(tx, sql`select i.id item_id,i.slug,i.audience,v.version,v.title,v.fields,v.source_refs,v.approved_at,v.review_by
        from empower_content_versions v join empower_content_items i on i.id=v.item_id where i.kind='knowledge' and ${SERVABLE} ${topicFilter}
        order by v.fields->>'topic', v.title limit 200`)
    }
    const entries = found.map(shape)
    const related = await relatedResourcesForLessons(tx, entries.map((e) => e.itemId))
    const topics = (await rows(tx, sql`select distinct v.fields->>'topic' topic from empower_content_versions v join empower_content_items i on i.id=v.item_id
      where i.kind='knowledge' and ${SERVABLE} and v.fields ? 'topic' order by 1`)).map((r) => String(r.topic))
    return { query: q, topic, topics, entries: entries.map((e) => ({ ...e, related: related[e.itemId] ?? [] })) }
  })
}
