import "server-only"
import { sql, type SQL } from "drizzle-orm"
import { withInternalAggregate } from "@/lib/db"
import { JarvisServiceError, type JarvisReadAction, type jarvisReadQuery } from "@/lib/jarvis-service"

// Fixed, explicit projections. No passwords, tokens, billing snapshots, PDFs,
// integration configs, arbitrary SQL, workspace paths or unbounded JSON blobs.
const sources: Record<JarvisReadAction, {entity: string; query: SQL}> = {
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
}
export interface JarvisSourceRow {id: string; client_id: string | null; attributes: Record<string, unknown>}
export function jarvisPage(action: JarvisReadAction, query: ReturnType<typeof jarvisReadQuery>, rows: JarvisSourceRow[], now = new Date().toISOString()) {
  const complete = rows.length <= query.limit
  const selected = rows.slice(0, query.limit)
  return {records: selected.map(row => ({id: row.id, entityType: sources[action].entity, attributes: row.attributes, sourceRef: `https://admin.scalesmiths.co.uk/api/jarvis/v1/${action}?id=${encodeURIComponent(row.id)}`, observedAt: now, validTo: new Date(Date.parse(now)+15*60_000).toISOString(), confidence: 1, privacy: "RESTRICTED" as const})), complete, ...(!complete ? {cursor: selected.at(-1)!.id} : {})}
}
export async function readJarvisPage(action: JarvisReadAction, query: ReturnType<typeof jarvisReadQuery>) {
  if (query.id && query.clientId && ["clients.read","retainers.read"].includes(action) && query.id !== query.clientId) throw new JarvisServiceError(400, "conflicting_client_filter")
  return withInternalAggregate(async tx => {
    await tx.execute(sql`set local statement_timeout = '5000ms'`)
    const rows = await tx.execute(sql`with source as (${sources[action].query}) select id,client_id,attributes from source where (${query.id}::text is null or id=${query.id}) and (${query.clientId}::text is null or client_id=${query.clientId}) and (${query.cursor}::text is null or id>${query.cursor}) order by id limit ${query.limit+1}`)
    return jarvisPage(action, query, rows.rows as unknown as JarvisSourceRow[])
  })
}
