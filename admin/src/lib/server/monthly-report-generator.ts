import "server-only"

import { and, desc, eq, gte, lt, ne } from "drizzle-orm"
import type { ForgeJsonSchema, JsonValue } from "@/lib/forge-ai"
import { formatReportPeriod } from "@/lib/monthly-reports"
import { db } from "@/lib/db"
import { clientRequests, clientTimelineEvents, clients } from "@/lib/schema"
import { runForgeAiJson } from "@/lib/server/forge-ai"

interface ReportSectionData extends Record<string, JsonValue> {
  executiveSummary: string
  workCompleted: string[]
  supportRequestsResolved: string[]
  seoContentImprovements: string[]
  websiteHealthStatus: string[]
  recommendations: string[]
  nextMonthFocus: string[]
  positiveClosingNote: string
}

const REPORT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "executiveSummary",
    "workCompleted",
    "supportRequestsResolved",
    "seoContentImprovements",
    "websiteHealthStatus",
    "recommendations",
    "nextMonthFocus",
    "positiveClosingNote",
  ],
  properties: {
    executiveSummary: { type: "string" },
    workCompleted: { type: "array", items: { type: "string" } },
    supportRequestsResolved: { type: "array", items: { type: "string" } },
    seoContentImprovements: { type: "array", items: { type: "string" } },
    websiteHealthStatus: { type: "array", items: { type: "string" } },
    recommendations: { type: "array", items: { type: "string" } },
    nextMonthFocus: { type: "array", items: { type: "string" } },
    positiveClosingNote: { type: "string" },
  },
} as const satisfies ForgeJsonSchema

export async function generateMonthlyClientReport(input: {
  clientId: string
  month: number
  year: number
}) {
  const context = await buildReportContext(input.clientId, input.month, input.year)
  const fallback = buildFallbackReport(context)

  let data = fallback
  let generatedBy: "forge" | "manual" = "manual"

  try {
    const result = await runForgeAiJson<ReportSectionData>({
      taskType: "copywriting",
      schema: REPORT_SCHEMA,
      schemaName: "monthly_client_report",
      prompt: buildReportPrompt(context),
      systemPrompt: [
        "Write a positive but truthful monthly client report for ScaleSmiths.",
        "Do not invent traffic, ranking, conversion, uptime, revenue, or analytics metrics.",
        "If analytics, SEO, or monitoring data is missing, say it is not connected yet.",
        "Use only the supplied data. Do not expose internal notes, raw Forge output, or private operational details.",
        "Return concise, polished report sections.",
      ].join("\n"),
      mockData: fallback,
      fallbackOnSchemaMismatch: true,
      maxTokens: 1800,
      temperature: 0.3,
    })
    data = result.data
    generatedBy = result.provider === "mock" ? "manual" : "forge"
  } catch {
    data = fallback
  }

  const title = `${context.businessName} monthly report - ${context.periodLabel}`
  const summary = data.executiveSummary
  const htmlContent = renderReportHtml(context, data)

  return { title, summary, htmlContent, generatedBy }
}

async function buildReportContext(clientId: string, month: number, year: number) {
  const periodStart = new Date(Date.UTC(year, month - 1, 1))
  const periodEnd = new Date(Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1))
  const periodLabel = formatReportPeriod(month, year)
  const [clientProfile] = await db
    .select({
      name: clients.name,
      contactName: clients.contactName,
      tier: clients.tier,
      status: clients.status,
      progress: clients.progress,
    })
    .from(clients)
    .where(eq(clients.name, clientId))
    .limit(1)

  const completedRequests = await db
    .select({
      id: clientRequests.id,
      title: clientRequests.title,
      category: clientRequests.category,
      priority: clientRequests.priority,
      status: clientRequests.status,
      completedAt: clientRequests.completedAt,
      updatedAt: clientRequests.updatedAt,
      forgeSummary: clientRequests.forgeSummary,
    })
    .from(clientRequests)
    .where(and(
      eq(clientRequests.clientId, clientId),
      eq(clientRequests.status, "completed"),
      gte(clientRequests.updatedAt, periodStart),
      lt(clientRequests.updatedAt, periodEnd),
    ))
    .orderBy(desc(clientRequests.updatedAt))

  const openRequests = await db
    .select({
      id: clientRequests.id,
      title: clientRequests.title,
      category: clientRequests.category,
      priority: clientRequests.priority,
      status: clientRequests.status,
      updatedAt: clientRequests.updatedAt,
      forgeSummary: clientRequests.forgeSummary,
    })
    .from(clientRequests)
    .where(and(
      eq(clientRequests.clientId, clientId),
      ne(clientRequests.status, "completed"),
      ne(clientRequests.status, "cancelled"),
    ))
    .orderBy(desc(clientRequests.updatedAt))
    .limit(12)

  const timeline = await db
    .select({
      type: clientTimelineEvents.type,
      title: clientTimelineEvents.title,
      description: clientTimelineEvents.description,
      createdAt: clientTimelineEvents.createdAt,
    })
    .from(clientTimelineEvents)
    .where(and(
      eq(clientTimelineEvents.clientId, clientId),
      eq(clientTimelineEvents.visibility, "client_visible"),
      gte(clientTimelineEvents.createdAt, periodStart),
      lt(clientTimelineEvents.createdAt, periodEnd),
    ))
    .orderBy(desc(clientTimelineEvents.createdAt))
    .limit(20)

  return {
    clientId,
    businessName: clientProfile?.name ?? deriveClientName(clientId),
    contactName: clientProfile?.contactName ?? null,
    tier: clientProfile?.tier ?? "Plan not assigned",
    clientStatus: clientProfile?.status ?? "Portal active",
    progress: clientProfile?.progress ?? null,
    month,
    year,
    periodLabel,
    completedRequests,
    openRequests,
    timeline,
    analyticsConnected: false,
    logoUrl: null as string | null,
  }
}

function buildFallbackReport(context: Awaited<ReturnType<typeof buildReportContext>>): ReportSectionData {
  const completed = context.completedRequests.map((request) => `${request.title} (${labelize(request.category)})`)
  const resolved = context.completedRequests.length > 0
    ? context.completedRequests.map((request) => `${request.title} was marked complete.`)
    : ["No support requests were marked complete in this reporting period."]
  const active = context.openRequests.map((request) => `${request.title} is currently ${labelize(request.status)}.`)
  const contentItems = [...context.completedRequests, ...context.openRequests]
    .filter((request) => ["seo_request", "content_assets", "new_page", "website_update"].includes(request.category))
    .map((request) => `${request.title} supported website content or SEO improvement.`)
  const timelineHighlights = context.timeline.slice(0, 4).map((event) => `${event.title}: ${event.description}`)

  return {
    executiveSummary: `${context.periodLabel} focused on keeping ${context.businessName} moving forward through request handling, visible portal updates, and practical next-step planning. Analytics and SEO monitoring are not connected yet, so this report avoids invented performance metrics.`,
    workCompleted: completed.length > 0 ? completed : ["No completed work was recorded for this month yet."],
    supportRequestsResolved: resolved,
    seoContentImprovements: contentItems.length > 0 ? contentItems : ["SEO/content analytics are not connected yet; no specific content improvements were recorded for this month."],
    websiteHealthStatus: [
      `Client status: ${context.clientStatus}.`,
      context.progress === null ? "Project progress is not connected to the client portal yet." : `Current tracked progress is ${context.progress}%.`,
      "Analytics, uptime monitoring, and Search Console data are not connected yet.",
    ],
    recommendations: [
      "Keep logging requests through the portal so priorities and decisions stay visible.",
      "Connect analytics/search data when available to make future reports more evidence-led.",
      active.length > 0 ? "Review open request priorities so the next work cycle stays focused." : "Use the next month to identify the highest-value improvement area.",
    ],
    nextMonthFocus: active.length > 0 ? active : ["Confirm the next improvement priority and continue publishing useful client-visible updates."],
    positiveClosingNote: timelineHighlights.length > 0
      ? `The strongest signal this month is steady communication: ${timelineHighlights[0]}`
      : "ScaleSmiths will keep the portal focused on clear updates, useful recommendations, and practical delivery momentum.",
  }
}

function buildReportPrompt(context: Awaited<ReturnType<typeof buildReportContext>>) {
  return JSON.stringify({
    client: {
      clientId: context.clientId,
      businessName: context.businessName,
      tier: context.tier,
      status: context.clientStatus,
      progress: context.progress,
    },
    period: context.periodLabel,
    constraints: {
      analyticsConnected: context.analyticsConnected,
      neverInventMetrics: true,
      missingAnalyticsLabel: "not connected yet",
      doNotExposeRawForgeOutput: true,
    },
    completedRequests: context.completedRequests.map((request) => ({
      title: request.title,
      category: request.category,
      priority: request.priority,
      safeForgeSummary: request.forgeSummary?.slice(0, 500) ?? null,
    })),
    openRequests: context.openRequests.map((request) => ({
      title: request.title,
      category: request.category,
      priority: request.priority,
      status: request.status,
      safeForgeSummary: request.forgeSummary?.slice(0, 500) ?? null,
    })),
    clientVisibleTimeline: context.timeline.map((event) => ({
      type: event.type,
      title: event.title,
      description: event.description,
    })),
  })
}

function renderReportHtml(context: Awaited<ReturnType<typeof buildReportContext>>, report: ReportSectionData) {
  const sections = [
    section("Executive summary", [report.executiveSummary]),
    section("Work completed", report.workCompleted),
    section("Support requests resolved", report.supportRequestsResolved),
    section("SEO/content improvements", report.seoContentImprovements),
    section("Website health/status", report.websiteHealthStatus),
    section("Recommendations", report.recommendations),
    section("Next month focus", report.nextMonthFocus),
    section("Closing note", [report.positiveClosingNote]),
  ].join("")

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(context.businessName)} monthly report - ${escapeHtml(context.periodLabel)}</title>
  <style>
    :root { color-scheme: dark; }
    body { margin:0; background:#080b12; color:#f4f4f5; font-family:Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height:1.6; }
    .wrap { max-width:980px; margin:0 auto; padding:42px 22px 56px; }
    .brand { display:flex; align-items:center; justify-content:space-between; gap:18px; margin-bottom:34px; }
    .mark { font-weight:900; letter-spacing:.08em; text-transform:uppercase; color:#38bdf8; }
    .period { color:#a1a1aa; font-size:14px; }
    .hero { border:1px solid rgba(56,189,248,.22); background:linear-gradient(135deg, rgba(56,189,248,.14), rgba(16,185,129,.08)); border-radius:18px; padding:30px; }
    h1 { margin:0; font-size:clamp(34px,5vw,56px); line-height:1; letter-spacing:-.04em; }
    .subtitle { margin-top:16px; max-width:760px; color:#d4d4d8; }
    .client { margin-top:22px; display:flex; flex-wrap:wrap; gap:10px; color:#d4d4d8; font-size:14px; }
    .pill { border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.05); border-radius:999px; padding:6px 10px; }
    .section { margin-top:18px; border:1px solid rgba(255,255,255,.1); background:rgba(255,255,255,.045); border-radius:14px; padding:22px; }
    h2 { margin:0 0 12px; font-size:20px; letter-spacing:-.02em; }
    ul { margin:0; padding-left:20px; }
    li { margin:8px 0; color:#e4e4e7; }
    p { margin:0; color:#e4e4e7; }
    .footer { margin-top:28px; color:#a1a1aa; font-size:13px; }
    a { color:#38bdf8; }
  </style>
</head>
<body>
  <main class="wrap">
    <div class="brand">
      <div class="mark">ScaleSmiths</div>
      <div class="period">${escapeHtml(context.periodLabel)}</div>
    </div>
    <section class="hero">
      <h1>${escapeHtml(context.businessName)} monthly report</h1>
      <p class="subtitle">${escapeHtml(report.executiveSummary)}</p>
      <div class="client">
        <span class="pill">Client: ${escapeHtml(context.businessName)}</span>
        <span class="pill">Plan: ${escapeHtml(context.tier)}</span>
        <span class="pill">Analytics: not connected yet</span>
      </div>
    </section>
    ${sections}
    <p class="footer">Prepared by ScaleSmiths. This report only uses connected portal data and avoids invented metrics.</p>
  </main>
</body>
</html>`
}

function section(title: string, items: string[]) {
  const safeItems = items.length > 0 ? items : ["Not populated yet."]
  return `<section class="section"><h2>${escapeHtml(title)}</h2>${safeItems.length === 1 ? `<p>${escapeHtml(safeItems[0])}</p>` : `<ul>${safeItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`}</section>`
}

function deriveClientName(clientId: string) {
  return clientId.replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/.#?]/)[0].replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Client"
}

function labelize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
