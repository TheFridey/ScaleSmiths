import "server-only"
import { and, asc, desc, eq, gte, lt, ne } from "drizzle-orm"
import { summarizeClientAnalytics, type ClientAnalyticsDailyMetric } from "@/lib/client-analytics"
import { db } from "@/lib/db"
import { formatReportPeriod } from "@/lib/monthly-reports"
import { clientAnalyticsDailyMetrics, clientRequests, clientTimelineEvents, clients, deliveryMilestones, deliveryProjects, invoices } from "@/lib/schema"

export interface MonthlyReportEvidence extends Record<string, unknown> {
  schemaVersion: 1
  assembledAt: string
  period: { month: number; year: number; start: string; end: string; label: string }
  client: { recordId: number; portalClientId: string; name: string }
  completedWork: Array<{ source: "milestone" | "activity"; id: number; title: string; detail: string | null; occurredAt: string }>
  milestones: Array<{ id: number; projectId: number; project: string; title: string; status: string; completedAt: string | null; targetDate: string | null }>
  deployments: Array<{ id: number; title: string; detail: string; occurredAt: string }>
  requestsResolved: Array<{ id: number; title: string; category: string; completedAt: string }>
  analytics: null | { totals: Record<string, number>; sources: string[]; measuredThrough: string }
  recommendations: Array<{ id: number; title: string; detail: string }>
  nextMonthPriorities: Array<{ source: "milestone" | "request"; id: number; title: string; detail: string | null }>
  financialActivity: Array<{ id: number; invoiceNumber: string; status: string; totalMinor: number; eventAt: string }>
  sourceAvailability: Record<string, { available: boolean; reason?: string }>
}

export async function generateMonthlyClientReport(input: { clientId: string; month: number; year: number }) {
  return assembleMonthlyClientReport(await collectMonthlyReportEvidence(input))
}

export async function collectMonthlyReportEvidence(input: { clientId: string; month: number; year: number }): Promise<MonthlyReportEvidence> {
  const start = new Date(Date.UTC(input.year, input.month - 1, 1))
  const end = new Date(Date.UTC(input.month === 12 ? input.year + 1 : input.year, input.month === 12 ? 0 : input.month, 1))
  const [client] = await db.select({ id: clients.id, name: clients.name, portalClientId: clients.portalClientId }).from(clients).where(eq(clients.portalClientId, input.clientId)).limit(1)
  if (!client?.portalClientId) throw new Error("The portal client is not linked to an internal client record.")

  const [milestones, resolved, openRequests, timeline, rawMetrics, publishedInvoices] = await Promise.all([
    db.select({ id: deliveryMilestones.id, projectId: deliveryProjects.id, project: deliveryProjects.name, title: deliveryMilestones.title, status: deliveryMilestones.status, completedAt: deliveryMilestones.completedAt, targetDate: deliveryMilestones.targetDate }).from(deliveryMilestones).innerJoin(deliveryProjects, eq(deliveryMilestones.projectId, deliveryProjects.id)).where(and(eq(deliveryProjects.clientId, client.id), eq(deliveryProjects.clientVisible, true), eq(deliveryMilestones.clientVisible, true))).orderBy(asc(deliveryMilestones.position)),
    db.select({ id: clientRequests.id, title: clientRequests.title, category: clientRequests.category, completedAt: clientRequests.completedAt }).from(clientRequests).where(and(eq(clientRequests.clientId, input.clientId), eq(clientRequests.status, "completed"), gte(clientRequests.completedAt, start), lt(clientRequests.completedAt, end))).orderBy(desc(clientRequests.completedAt)),
    db.select({ id: clientRequests.id, title: clientRequests.title, status: clientRequests.status }).from(clientRequests).where(and(eq(clientRequests.clientId, input.clientId), ne(clientRequests.status, "completed"), ne(clientRequests.status, "cancelled"))).orderBy(desc(clientRequests.updatedAt)).limit(12),
    db.select({ id: clientTimelineEvents.id, sourceDomain: clientTimelineEvents.sourceDomain, type: clientTimelineEvents.type, title: clientTimelineEvents.title, description: clientTimelineEvents.description, occurredAt: clientTimelineEvents.occurredAt }).from(clientTimelineEvents).where(and(eq(clientTimelineEvents.clientId, input.clientId), eq(clientTimelineEvents.visibility, "client_visible"), gte(clientTimelineEvents.occurredAt, start), lt(clientTimelineEvents.occurredAt, end))).orderBy(desc(clientTimelineEvents.occurredAt)).limit(100),
    db.select().from(clientAnalyticsDailyMetrics).where(and(eq(clientAnalyticsDailyMetrics.clientId, client.id), gte(clientAnalyticsDailyMetrics.metricDate, start), lt(clientAnalyticsDailyMetrics.metricDate, end))).orderBy(asc(clientAnalyticsDailyMetrics.metricDate)),
    db.select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber, status: invoices.status, total: invoices.total, portalPublishedAt: invoices.portalPublishedAt, paidAt: invoices.paidAt }).from(invoices).where(and(eq(invoices.clientId, client.id), ne(invoices.status, "draft"), gte(invoices.portalPublishedAt, start), lt(invoices.portalPublishedAt, end))).orderBy(desc(invoices.portalPublishedAt)),
  ])
  const analytics = analyticsEvidence(rawMetrics.map(toMetric))
  const completedMilestones = milestones.filter((row) => row.completedAt && row.completedAt >= start && row.completedAt < end)
  const deployments = timeline.filter(isDeployment)
  const recommendations = timeline.filter((row) => row.sourceDomain === "optimisation" || row.type.includes("recommendation"))
  const activities = timeline.filter((row) => !isDeployment(row) && !recommendations.includes(row) && row.sourceDomain !== "report")
  return {
    schemaVersion: 1, assembledAt: new Date().toISOString(),
    period: { month: input.month, year: input.year, start: start.toISOString(), end: end.toISOString(), label: formatReportPeriod(input.month, input.year) },
    client: { recordId: client.id, portalClientId: client.portalClientId, name: client.name },
    completedWork: [...completedMilestones.map((row) => ({ source: "milestone" as const, id: row.id, title: row.title, detail: row.project, occurredAt: row.completedAt!.toISOString() })), ...activities.map((row) => ({ source: "activity" as const, id: row.id, title: row.title, detail: row.description || null, occurredAt: row.occurredAt.toISOString() }))],
    milestones: milestones.map((row) => ({ id: row.id, projectId: row.projectId, project: row.project, title: row.title, status: row.status, completedAt: row.completedAt?.toISOString() ?? null, targetDate: row.targetDate?.toISOString() ?? null })),
    deployments: deployments.map((row) => ({ id: row.id, title: row.title, detail: row.description, occurredAt: row.occurredAt.toISOString() })),
    requestsResolved: resolved.filter((row): row is typeof row & { completedAt: Date } => Boolean(row.completedAt)).map((row) => ({ id: row.id, title: row.title, category: row.category, completedAt: row.completedAt.toISOString() })),
    analytics,
    recommendations: recommendations.map((row) => ({ id: row.id, title: row.title, detail: row.description })),
    nextMonthPriorities: [...milestones.filter((row) => row.status !== "completed" && row.status !== "skipped").slice(0, 8).map((row) => ({ source: "milestone" as const, id: row.id, title: row.title, detail: row.project })), ...openRequests.slice(0, 8).map((row) => ({ source: "request" as const, id: row.id, title: row.title, detail: labelize(row.status) }))],
    financialActivity: publishedInvoices.filter((row): row is typeof row & { invoiceNumber: string; portalPublishedAt: Date } => Boolean(row.invoiceNumber && row.portalPublishedAt)).map((row) => ({ id: row.id, invoiceNumber: row.invoiceNumber, status: row.status, totalMinor: row.total, eventAt: (row.paidAt ?? row.portalPublishedAt).toISOString() })),
    sourceAvailability: {
      projects: { available: milestones.length > 0 }, requests: { available: resolved.length > 0 || openRequests.length > 0 }, clientVisibleActivity: { available: timeline.length > 0 }, analytics: { available: analytics !== null }, publishedInvoices: { available: publishedInvoices.length > 0 },
      optimisationProposals: { available: recommendations.length > 0, reason: recommendations.length ? undefined : "No client-visible optimisation activity was recorded." },
    },
  }
}

export function assembleMonthlyClientReport(evidence: MonthlyReportEvidence) {
  const counts = [countPhrase(evidence.completedWork.length, "completed work item"), countPhrase(evidence.deployments.length, "deployment or change"), countPhrase(evidence.requestsResolved.length, "resolved request")].filter(Boolean)
  const summary = counts.length ? `${evidence.period.label} records ${joinPhrases(counts)} from client-visible operational data.` : `No client-visible operational activity is present in the connected data for ${evidence.period.label}.`
  return { title: `${evidence.client.name} monthly report - ${evidence.period.label}`, summary, htmlContent: renderHtml(evidence, summary), generatedBy: "manual" as const, sourceSnapshot: evidence }
}

function analyticsEvidence(rows: ClientAnalyticsDailyMetric[]): MonthlyReportEvidence["analytics"] {
  if (!rows.length) return null
  const totals = Object.fromEntries(Object.entries(summarizeClientAnalytics({ configs: [], metrics: rows }).totals).filter((entry): entry is [string, number] => typeof entry[1] === "number"))
  return Object.keys(totals).length ? { totals, sources: [...new Set(rows.map((row) => row.sourceAttribution))], measuredThrough: rows.at(-1)!.metricDate } : null
}
function toMetric(row: typeof clientAnalyticsDailyMetrics.$inferSelect): ClientAnalyticsDailyMetric { return { clientId: row.clientId, configId: row.configId, metricDate: row.metricDate.toISOString(), source: row.source, sourceAttribution: row.sourceAttribution, sessions: row.sessions, conversionEvents: row.conversionEvents, formSubmissions: row.formSubmissions, phoneClicks: row.phoneClicks, ctaClicks: row.ctaClicks, searchImpressions: row.searchImpressions, searchClicks: row.searchClicks, errorCount: row.errorCount, uptimeChecks: row.uptimeChecks, uptimeFailures: row.uptimeFailures, lcpP75Ms: row.lcpP75Ms, inpP75Ms: row.inpP75Ms, clsP75: row.clsP75 === null ? null : Number(row.clsP75) } }
function renderHtml(e: MonthlyReportEvidence, summary: string) {
  const sections = [section("Period summary", [summary]), section("Work completed", e.completedWork.map((x) => x.detail ? `${x.title} — ${x.detail}` : x.title)), section("Milestones", e.milestones.map((x) => `${x.project}: ${x.title} — ${labelize(x.status)}`)), section("Deployments and changes", e.deployments.map((x) => `${x.title} — ${x.detail}`)), section("Requests resolved", e.requestsResolved.map((x) => `${x.title} — ${labelize(x.category)}`)), e.analytics ? section("Analytics and KPIs", Object.entries(e.analytics.totals).map(([key, value]) => `${metricLabel(key)}: ${formatMetric(key, value)}`)) : "", section("Recommendations", e.recommendations.map((x) => `${x.title} — ${x.detail}`)), section("Next-month priorities", e.nextMonthPriorities.map((x) => x.detail ? `${x.title} — ${x.detail}` : x.title))].filter(Boolean).join("")
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(e.client.name)} monthly report</title><style>body{margin:0;background:#080b12;color:#f4f4f5;font-family:Inter,system-ui,sans-serif;line-height:1.6}.wrap{max-width:920px;margin:auto;padding:42px 22px}.hero,.section{border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:24px;margin-bottom:18px}.hero{background:linear-gradient(135deg,rgba(56,189,248,.14),rgba(16,185,129,.08))}h1{margin:0;font-size:clamp(32px,5vw,52px);line-height:1.05}h2{margin:0 0 10px;font-size:20px}p,ul{margin:0}li{margin:7px 0}.period,.footer{color:#a1a1aa}.footer{font-size:13px}</style></head><body><main class="wrap"><p class="period">ScaleSmiths · ${escapeHtml(e.period.label)}</p><section class="hero"><h1>${escapeHtml(e.client.name)} monthly report</h1><p>${escapeHtml(summary)}</p></section>${sections}<p class="footer">Drafted from connected client-visible operational records. Reviewed and published deliberately by ScaleSmiths.</p></main></body></html>`
}
function section(title: string, items: string[]) { return items.length ? `<section class="section"><h2>${escapeHtml(title)}</h2>${items.length === 1 ? `<p>${escapeHtml(items[0])}</p>` : `<ul>${items.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>`}</section>` : "" }
function isDeployment(row: { sourceDomain: string | null; type: string }) { return row.sourceDomain === "deployment" || /(deploy|launch|release|staging|website_change)/i.test(row.type) }
function countPhrase(count: number, label: string) { return count ? `${count} ${label}${count === 1 ? "" : "s"}` : "" }
function joinPhrases(items: string[]) { return items.length < 2 ? items[0] : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}` }
function labelize(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, (x) => x.toUpperCase()) }
function metricLabel(key: string) { return key.replace(/([A-Z])/g, " $1").replace(/^\w/, (x) => x.toUpperCase()).replace(/ P75 Ms$/, " p75 (ms)") }
function formatMetric(key: string, value: number) { return key === "uptimePercent" ? `${value}%` : new Intl.NumberFormat("en-GB", { maximumFractionDigits: key === "clsP75" ? 4 : 2 }).format(value) }
function escapeHtml(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;") }
