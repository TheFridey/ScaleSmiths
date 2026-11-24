import "server-only"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { ContentError } from "@/lib/empower-content"
import { decideContentVersion, publishContentVersion, submitContentVersion } from "./empower-content"
import { requireCapability } from "./rbac"

/*
 * Operation EMPOWER B2.10: the consolidated founder review queue. A batch is a convenience over the existing single-version
 * services, never a new route around them: each version is submitted, decided or published by its own call, in its own transaction,
 * with every existing rule re-applied (lint on submission, second-founder approval authority, review-by dates, the rule that a
 * course publishes only once its lessons are servable, and the audit trail). A batch records nothing on anyone's behalf: the acting
 * founder is the authenticated caller of every call. Agreements are never batched: each agreement version is handled individually.
 */
export const BATCH_LIMIT = 200
/** Lessons and standalone content first, courses last: a course can be published only when its lessons are already servable. */
const PUBLISH_ORDER: Record<string, number> = { lesson: 0, resource: 1, template: 1, knowledge: 1, objection: 1, course: 2 }
export type BatchResult = { versionId: string; title: string; kind: string; ok: boolean; error?: string }

function versionIds(value: unknown): string[] {
  if (!Array.isArray(value) || !value.length || value.length > BATCH_LIMIT) throw new ContentError(`Choose between 1 and ${BATCH_LIMIT} items.`)
  const ids = [...new Set(value.map((v) => (typeof v === "string" ? v.toLowerCase() : "")))]
  if (ids.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id))) throw new ContentError("Every item needs a valid identifier.")
  return ids
}

async function describe(ids: string[]) {
  const list = sql.join(ids.map((id) => sql`${id}`), sql`,`)
  const rows = (await db.execute(sql`select v.id,v.title,i.kind from empower_content_versions v join empower_content_items i on i.id=v.item_id where v.id in (${list})`)).rows as { id: string; title: string; kind: string }[]
  if (rows.length !== ids.length) throw new ContentError("One or more items no longer exist. Refresh and try again.", 404)
  if (rows.some((r) => r.kind === "agreement")) throw new ContentError("Agreements are never handled in a batch. Review, approve and publish each agreement version individually.")
  return rows
}

async function each(rows: { id: string; title: string; kind: string }[], call: (id: string) => Promise<unknown>): Promise<BatchResult[]> {
  const results: BatchResult[] = []
  for (const r of rows) {
    try { await call(r.id); results.push({ versionId: r.id, title: r.title, kind: r.kind, ok: true }) }
    catch (error) { results.push({ versionId: r.id, title: r.title, kind: r.kind, ok: false, error: error instanceof Error ? error.message : "Refused." }) }
  }
  return results
}

/** The author submits their drafts for review. Lint findings stop an item unless the author gives an override reason for it individually. */
export async function submitContentBatch(input: { versionIds?: unknown }) {
  await requireCapability("expansion.manage")
  const rows = await describe(versionIds(input.versionIds))
  return { action: "submit", results: await each(rows, (id) => submitContentVersion({ versionId: id })) }
}

/** The reviewing founder approves (or requests changes to) each version, with one recorded reference for the review session. */
export async function decideContentBatch(input: { versionIds?: unknown; decision?: unknown; reference?: unknown; notes?: unknown; reviewBy?: unknown; selfApprovalReason?: unknown }) {
  await requireCapability("expansion.manage")
  if (input.decision !== "approved" && input.decision !== "changes_requested") throw new ContentError("A batch can approve or request changes. Reject items individually.")
  const rows = await describe(versionIds(input.versionIds))
  return { action: String(input.decision), results: await each(rows, (id) => decideContentVersion({ versionId: id, decision: input.decision, reference: input.reference, notes: input.notes, reviewBy: input.decision === 'approved' ? input.reviewBy : undefined, selfApprovalReason: input.selfApprovalReason })) }
}

/** Publishes approved versions, lessons before courses. Anything not approved is refused by the single-version service. */
export async function publishContentBatch(input: { versionIds?: unknown }) {
  await requireCapability("expansion.manage")
  const rows = (await describe(versionIds(input.versionIds))).sort((a, b) => (PUBLISH_ORDER[a.kind] ?? 1) - (PUBLISH_ORDER[b.kind] ?? 1))
  return { action: "publish", results: await each(rows, (id) => publishContentVersion({ versionId: id })) }
}
