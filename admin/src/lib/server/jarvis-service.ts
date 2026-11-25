import "server-only"
import { sql, type SQL } from "drizzle-orm"
import { withInternalAggregate } from "@/lib/db"
import { CURSOR_SEPARATOR, decodeCursor, encodeCursor, JarvisServiceError, type JarvisReadAction, type jarvisReadQuery } from "@/lib/jarvis-service"

// Fixed, explicit projections. No passwords, tokens, billing snapshots, PDFs,
// integration configs, arbitrary SQL, workspace paths or unbounded JSON blobs.
// Communications projections additionally exclude internal-visibility notes and
// truncate free text, so a message body can never be used to smuggle bulk data.
// Bodies are capped at 400 characters and short identifying fields at 200, which
// bounds the serialised size of one page: `limit` caps rows, not bytes, so an
// unbounded `text` column would otherwise make a single page arbitrarily large.
// `ts` is the single timestamp used for ordering. Actions without `ts` keep the
// original id-ascending contract; the communications actions order newest-first
// so a bounded page always contains the newest records, not the oldest.
const sources: Record<JarvisReadAction, {entity: string; query: SQL; ts?: string}> = {
  "clients.read": {entity: "client", query: sql`select id::text id, id::text client_id, jsonb_build_object('name',name,'contactName',contact_name,'contactEmail',contact_email,'status',status,'tier',tier,'sourceUpdatedAt',updated_at) attributes from clients`},
  "leads.read": {entity: "lead", query: sql`select id::text id, converted_client_id::text client_id, jsonb_build_object('name',business_name,'contactName',contact_name,'contactEmail',contact_email,'websiteUrl',website_url,'status',stage,'priority',priority,'nextFollowUpAt',next_follow_up_at,'lastContactAt',last_contacted_at,'sourceUpdatedAt',updated_at) attributes from prospects`},
  "projects.read": {entity: "project", query: sql`select id::text id, client_id::text client_id, jsonb_build_object('clientId',client_id,'name',name,'status',status,'phase',current_phase,'targetEndDate',target_end_date,'sourceUpdatedAt',updated_at) attributes from delivery_projects`},
  "tasks.read": {entity: "task", query: sql`select id::text id, client_id::text client_id, jsonb_build_object('clientId',client_id,'title',title,'status',"column",'priority',priority,'createdAt',created_at) attributes from kanban_cards`},
  "invoices.read": {entity: "invoice", query: sql`select id::text id, client_id::text client_id, jsonb_build_object('clientId',client_id,'invoiceNumber',invoice_number,'status',case when status='issued' and due_date<now() then 'overdue' when status='issued' then 'unpaid' else status::text end,'sourceStatus',status,'amountMinor',total,'currency',currency,'dueAt',due_date,'paidAt',paid_at,'sourceUpdatedAt',updated_at) attributes from invoices`},
  "payments.read": {entity: "payment", query: sql`select id::text id, client_id::text client_id, jsonb_build_object('clientId',client_id,'invoiceId',id,'kind','invoice_settlement','amountMinor',total,'currency',currency,'paidAt',paid_at,'sourceUpdatedAt',updated_at) attributes from invoices where status='paid' and paid_at is not null`},
  // CRM MRR and proposal prices are stored in whole GBP, unlike invoice totals.
  "retainers.read": {entity: "retainer", query: sql`select id::text id, id::text client_id, jsonb_build_object('clientId',id,'name',name,'status',case when status='active' then 'active' else 'inactive' end,'sourceStatus',status,'amountMinor',mrr::bigint*100,'currency','GBP','period','month','kind','crm_monthly_retainer','sourceUpdatedAt',updated_at) attributes from clients where mrr>0`},
  "proposals.read": {entity: "proposal", query: sql`select id::text id, client_id::text client_id, jsonb_build_object('clientId',client_id,'prospectId',prospect_id,'title',title,'status',status,'amountMinor',build_price::bigint*100,'monthlyRetainerMinor',retainer_price::bigint*100,'currency','GBP','sourceUpdatedAt',updated_at) attributes from sales_proposals`},
  "analytics.read": {entity: "analytics", query: sql`select id::text id, client_id::text client_id, jsonb_build_object('clientId',client_id,'metricDate',metric_date,'source',source,'sourceAttribution',source_attribution,'sessions',sessions,'conversionEvents',conversion_events,'formSubmissions',form_submissions,'phoneClicks',phone_clicks,'searchImpressions',search_impressions,'searchClicks',search_clicks,'errorCount',error_count,'uptimeChecks',uptime_checks,'uptimeFailures',uptime_failures,'lcpP75Ms',lcp_p75_ms,'observedAt',ingested_at) attributes from client_analytics_daily_metrics`},
  "deployments.read": {entity: "deployment", query: sql`select d.id::text id, p.client_id::text client_id, jsonb_build_object('clientId',p.client_id,'projectId',d.project_id,'candidateNumber',d.candidate_number,'status',d.state,'repositoryCommit',d.repository_commit,'kind','deployment_candidate','sourceUpdatedAt',d.updated_at) attributes from forge_deployment_candidates d join forge_projects p on p.id=d.project_id`},

  // OPERATION WATCHTOWER -----------------------------------------------------
  // Message-level rows are append-only, so they are a stable deduplication key
  // for the reviewer. Internal-visibility notes are excluded at the source.
  "messages.read": {entity: "message", ts: "m.created_at", query: sql`select m.id::text id, r.client_id::text client_id, jsonb_build_object('requestId',m.request_id,'requestTitle',left(coalesce(r.title,''),200),'requestStatus',r.status::text,'senderType',m.sender_type::text,'senderName',left(coalesce(m.sender_name,''),200),'bodyExcerpt',left(coalesce(m.body,''),400),'createdAt',m.created_at,'adminLastReadAt',r.admin_last_read_at) attributes, coalesce(m.created_at, to_timestamp(0)) ts from client_request_messages m join client_requests r on r.id=m.request_id where m.visibility='client_visible'`},
  "enquiries.read": {entity: "enquiry", ts: "created_at", query: sql`select id::text id, null::text client_id, jsonb_build_object('name',left(coalesce(name,''),200),'business',left(coalesce(business,''),200),'enquiryIntent',enquiry_intent,'leadSource',lead_source,'status',status::text,'createdAt',created_at,'briefExcerpt',left(coalesce(brief,''),400),'emailDeliveryStatus',email_delivery_status) attributes, coalesce(created_at, to_timestamp(0)) ts from quote_requests`},
  "partner-applications.read": {entity: "partner_application", ts: "submitted_at", query: sql`select id::text id, null::text client_id, jsonb_build_object('name',left(coalesce(name,''),200),'businessActivity',left(coalesce(business_activity,''),200),'region',left(coalesce(region,''),200),'status',status,'submittedAt',submitted_at,'motivationExcerpt',left(coalesce(motivation,''),400)) attributes, coalesce(submitted_at, to_timestamp(0)) ts from partner_applications`},
  // Partner-initiated requests that require a founder decision. Meeting requests
  // carry the partner's own name via their application record; the prefixed key
  // keeps the two sources distinct inside one ordered cursor.
  // Toolkit rows have no created_at column (0081_expansion_toolkit_meetings.sql
  // defines only updated_at), so createdAt and updatedAt both carry the last
  // update time. createdAt is the key the existing WATCHTOWER consumer reads;
  // dropping it silently discarded every toolkit approval request.
  "partner-requests.read": {entity: "partner_request", ts: "created_at", query: sql`select 'mr:'||mr.id::text id, null::text client_id, jsonb_build_object('kind','meeting_request','partnerName',left(coalesce(pa.name,''),200),'meetingType',left(coalesce(mr.meeting_type,''),200),'purpose',left(coalesce(mr.purpose,''),400),'status',mr.status,'createdAt',mr.created_at) attributes, coalesce(mr.created_at, to_timestamp(0)) ts from expansion_meeting_requests mr join expansion_partners ep on ep.id=mr.partner_id join partner_applications pa on pa.id=ep.application_id union all select 'tk:'||ti.id::text id, null::text client_id, jsonb_build_object('kind','toolkit_request','partnerName',left(coalesce(pa.name,''),200),'itemKey',left(coalesce(ti.item_key,''),200),'status',ti.status,'createdAt',ti.updated_at,'updatedAt',ti.updated_at,'detail',left(coalesce(ti.detail,''),400)) attributes, coalesce(ti.updated_at, to_timestamp(0)) ts from expansion_toolkit_items ti join expansion_partners ep on ep.id=ti.partner_id join partner_applications pa on pa.id=ep.application_id where ti.status='awaiting_approval'`},
}
export interface JarvisSourceRow {id: string; client_id: string | null; attributes: Record<string, unknown>; ts?: string}
// A keyset cursor is "<micros>|<id>". The timestamp is part of the key so a page
// boundary cannot skip or repeat a row when several rows share a timestamp. The
// codec lives in the pure module so the emitted and accepted forms share one
// definition.
export function jarvisPage(action: JarvisReadAction, query: ReturnType<typeof jarvisReadQuery>, rows: JarvisSourceRow[], now = new Date().toISOString()) {
  const complete = rows.length <= query.limit
  const selected = rows.slice(0, query.limit)
  const last = selected.at(-1)
  const nextCursor = !complete && last
    ? (sources[action].ts ? encodeCursor(last.ts ?? "", last.id) : last.id)
    : undefined
  return {records: selected.map(row => ({id: row.id, entityType: sources[action].entity, attributes: row.attributes, sourceRef: `https://admin.scalesmiths.co.uk/api/jarvis/v1/${action}?id=${encodeURIComponent(row.id)}`, observedAt: now, validTo: new Date(Date.parse(now)+15*60_000).toISOString(), confidence: 1, privacy: "RESTRICTED" as const})), complete, ...(nextCursor ? {cursor: nextCursor} : {})}
}
export async function readJarvisPage(action: JarvisReadAction, query: ReturnType<typeof jarvisReadQuery>) {
  if (query.id && query.clientId && ["clients.read","retainers.read"].includes(action) && query.id !== query.clientId) throw new JarvisServiceError(400, "conflicting_client_filter")
  // Communications sources page newest-first. A bounded page must contain the
  // newest records, otherwise a growing table silently hides new messages behind
  // old history. The other actions keep their original id-ascending contract.
  const keyset = Boolean(sources[action].ts)
  return withInternalAggregate(async tx => {
    await tx.execute(sql`set local statement_timeout = '5000ms'`)
    if (keyset) {
      const {ts, id} = decodeCursor(query.cursor)
      // A plain-id cursor cannot address a keyset page: the comparison would be
      // NULL and the page would come back empty, which reads as "no more data".
      if (query.cursor && (ts === null || id === null)) throw new JarvisServiceError(400, "invalid_cursor")
      // The cursor timestamp is whole microseconds, so a page boundary is an
      // exact integer comparison. Casting the client's value to timestamptz
      // would let a forged cursor like `2026-99-99 99:99:99` reach the database
      // and surface as an internal error instead of invalid_query.
      // numeric, not bigint: microseconds since the epoch exceed bigint past
      // roughly the year 294000, and a timestamptz can legally hold them.
      // trunc(...)::numeric(30,0) is load-bearing: extract() returns numeric with
      // scale 6, so a bare numeric cast renders "1795168800000000.000000" and the
      // emitted cursor then fails this module's own grammar.
      //
      // A timestamptz can also hold 'infinity' and '-infinity'. extract(epoch) on
      // those is infinite, numeric(30,0) cannot store it, and the value is
      // computed in ORDER BY for every row — so one such row failed every page of
      // the action, including pages that would not have returned it. Non-finite
      // timestamps are clamped instead, so the row is still returned and still
      // carries its real value in attributes.
      //
      // The sentinels are +/-1e19, NOT the extreme finite microseconds. Measured
      // on PostgreSQL 14: the finite range is about -2.1087e17 .. +9.2243e18, and
      // using those values as sentinels made +infinity tie with the largest
      // finite timestamp and -infinity tie with the smallest, so infinity did not
      // sort strictly outside the finite rows. 1e19 is strictly beyond both ends
      // and still fits the 20-digit cursor grammar.
      //
      // Precision, measured on PostgreSQL 14 rather than assumed: microsecond
      // resolution is exact while the microsecond value fits an int64, which is
      // Unix microseconds up to roughly the year 294247. Beyond that extract()
      // switches to a numeric division with limited scale and sub-100us resolution
      // is lost, so adjacent microseconds collapse — 294276-12-31 23:59:59.999998
      // and ...999999 both yield 9224318016000000000. Collapsed values do not break
      // pagination: the comparison is the tuple (micros, id) and ids are unique, so
      // a page boundary inside a collapsed group still advances by id with no
      // skipped or repeated row.
      // This depends on extract(epoch ...) returning numeric, which is PostgreSQL 14
      // behaviour. Older releases returned double precision, where this expression
      // would lose microseconds far earlier.
      const micros = sql`case when isfinite(source.ts) then trunc(extract(epoch from source.ts)*1000000)::numeric(30,0) when source.ts > timestamptz '1970-01-01 00:00:00+00' then 10000000000000000000::numeric(30,0) else (-10000000000000000000)::numeric(30,0) end`
      const rows = await tx.execute(sql`with source as (${sources[action].query}) select id,client_id,attributes,${micros}::text ts from source where (${query.id}::text is null or id=${query.id}) and (${query.clientId}::text is null or client_id=${query.clientId}) and (${ts}::numeric is null or (${micros},id) < (${ts}::numeric,${id}::text)) order by ${micros} desc, id desc limit ${query.limit+1}`)
      return jarvisPage(action, query, rows.rows as unknown as JarvisSourceRow[])
    }
    // An id-ordered action must not accept a keyset cursor: `id > '<micros>|<id>'`
    // is a text comparison, so it would return a misaligned or empty page while
    // still reporting complete:true, which reads as "no more data".
    if (query.cursor && query.cursor.includes(CURSOR_SEPARATOR)) throw new JarvisServiceError(400, "invalid_cursor")
    const rows = await tx.execute(sql`with source as (${sources[action].query}) select id,client_id,attributes from source where (${query.id}::text is null or id=${query.id}) and (${query.clientId}::text is null or client_id=${query.clientId}) and (${query.cursor}::text is null or id>${query.cursor}) order by id limit ${query.limit+1}`)
    return jarvisPage(action, query, rows.rows as unknown as JarvisSourceRow[])
  })
}
