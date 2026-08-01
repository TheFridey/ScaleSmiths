"use client"

import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts"
import { Activity, AlertTriangle, Bell, CalendarClock, CheckCircle2, Clock3, FileText, Gauge, Mail, MessageSquare, Plus, PoundSterling, Target, TrendingUp, Trophy, Users } from "lucide-react"
import Link from "next/link"
import { PROSPECT_STAGES, STAGE_LABELS, type ProspectStage } from "@/lib/prospects"

const T = { t1:"var(--t1)",t2:"var(--t2)",t3:"var(--t3)",s1:"var(--s1)",s2:"var(--s2)",s3:"var(--s3)",b1:"var(--b1)",b2:"var(--b2)",acc:"var(--acc)",grn:"var(--grn)",amb:"var(--amb)",red:"var(--red)" }

const gbp = (n: number) => `GBP ${Math.round(n).toLocaleString("en-GB")}`

interface DashboardClient {
  id: number
  name: string
  tier: string | null
  mrr: number
  status: string
  progress: number
}

interface OperationalSnapshot {
  unreadClientReplies: {
    id: number
    requestId: number
    senderName: string
    body: string
    createdAt: string
    requestTitle: string
    clientId: string
    requestStatus: string
  }[]
  criticalRequests: DashboardRequest[]
  waitingClientRequests: DashboardRequest[]
  reportsDueThisMonth: {
    id: number
    name: string
    tier: string | null
    status: string
  }[]
  proposalsMissing: {
    id: number
    businessName: string
    contactName: string | null
    proposalSentAt: string | null
  }[]
  recentTimeline: {
    id: number
    clientId: string
    title: string
    description: string
    visibility: "client_visible" | "internal"
    createdAt: string
  }[]
  currentMonthReportCount: number
}

interface DashboardRequest {
  id: number
  clientId: string
  title: string
  priority: "low" | "medium" | "high" | "critical"
  status: "new" | "triaged" | "in_progress" | "waiting_client" | "completed" | "cancelled"
  updatedAt: string
}

interface SalesMetrics {
  outreachSentThisWeek: number
  repliesThisWeek: number
  discoveryCallsBooked: number
  proposalsSent: number
  dealsWonThisMonth: number
  dealsLostThisMonth: number
  pipelineValue: number
  weightedPipelineValue: number
  expectedMonthlyRetainerValue: number
  followUpsDueToday: number
  overdueFollowUps: number
  prospectsByStage: Record<ProspectStage, number>
  replyRate: number
  proposalRate: number
  winRate: number
  closeRate: number
  proposalConversionRate: number
  avgProjectValue: number
  avgRetainerValue: number
  openProspects: number
}

interface DashboardContentProps {
  clients: DashboardClient[]
  salesMetrics: SalesMetrics
  todayLabel: string
  operational: OperationalSnapshot
}

interface MetricCard {
  label: string
  value: string
  sub: string
  color: string
  Icon: typeof PoundSterling
}

type InsightTone = "positive" | "warning" | "critical" | "neutral"
const TONE_COLOR: Record<InsightTone, string> = { positive: T.grn, warning: T.amb, critical: T.red, neutral: T.acc }

function computeTierMrr(clients: DashboardClient[]) {
  const totalsByTier = new Map<string, number>()

  clients.forEach((client) => {
    const tier = client.tier ?? "No tier set"
    totalsByTier.set(tier, (totalsByTier.get(tier) ?? 0) + client.mrr)
  })

  return Array.from(totalsByTier, ([name, value]) => ({ name, value }))
}

/** Auto-surface the most relevant signals: risks first, then headline value and wins. */
function buildInsights(m: SalesMetrics, totalMrr: number, activeClients: number): { text: string; tone: InsightTone }[] {
  const out: { text: string; tone: InsightTone }[] = []
  if (m.overdueFollowUps > 0) out.push({ text: `${m.overdueFollowUps} follow-up${m.overdueFollowUps === 1 ? "" : "s"} overdue`, tone: "critical" })
  if (m.followUpsDueToday > 0) out.push({ text: `${m.followUpsDueToday} follow-up${m.followUpsDueToday === 1 ? "" : "s"} due today`, tone: "warning" })
  if (m.pipelineValue > 0) out.push({ text: `${gbp(m.pipelineValue)} in active pipeline`, tone: "neutral" })
  if (m.weightedPipelineValue > 0) out.push({ text: `${gbp(m.weightedPipelineValue)} weighted forecast`, tone: "neutral" })
  if (m.dealsWonThisMonth > 0) out.push({ text: `${m.dealsWonThisMonth} deal${m.dealsWonThisMonth === 1 ? "" : "s"} won this month`, tone: "positive" })
  if (totalMrr > 0) out.push({ text: `${gbp(totalMrr)} MRR across ${activeClients} client${activeClients === 1 ? "" : "s"}`, tone: "positive" })
  if (out.length === 0) out.push({ text: "Pipeline is clear - add prospects to start tracking", tone: "neutral" })
  return out.slice(0, 4)
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-syne text-[12px] font-bold uppercase mb-3" style={{ color: T.t2, letterSpacing: "0.09em" }}>
      {children}
    </h2>
  )
}

function MetricGrid({ cards, size = 24 }: { cards: MetricCard[]; size?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {cards.map((m) => (
        <div key={m.label} className="flex min-h-[112px] flex-col justify-between rounded-[8px] border p-4 sm:p-5" style={{ background: T.s1, borderColor: T.b1 }}>
          <div className="flex items-center justify-between">
            <span className="font-dm text-xs" style={{ color: T.t2 }}>{m.label}</span>
            <m.Icon size={15} style={{ color: m.color }} aria-hidden="true" />
          </div>
          <div>
            <div className="font-syne font-extrabold" style={{ fontSize: size }}>{m.value}</div>
            <div className="font-dm text-[11px] mt-0.5" style={{ color: T.t3 }}>{m.sub}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function DashboardContent({ clients, salesMetrics, todayLabel, operational }: DashboardContentProps) {
  const activeClients = clients.filter((c) => c.status === "active")
  const totalMrr = clients.reduce((sum, c) => sum + c.mrr, 0)
  const avgRetainer = activeClients.length ? Math.round(totalMrr / activeClients.length) : 0
  const activeProjects = clients.filter((c) => c.progress < 100).length
  const inReview = clients.filter((c) => c.status === "review").length
  const shownClients = clients.slice(0, 4)
  const mrrData = computeTierMrr(clients)
  const insights = buildInsights(salesMetrics, totalMrr, activeClients.length)

  const revenueCards: MetricCard[] = [
    { label:"Monthly MRR", value:gbp(totalMrr), sub:"Live from clients table", color:T.grn, Icon:PoundSterling },
    { label:"Active Clients", value:String(activeClients.length), sub:`${clients.length} total clients`, color:T.acc, Icon:Users },
    { label:"Avg. Retainer", value:gbp(avgRetainer), sub:"Target: GBP 2k / client", color:T.grn, Icon:TrendingUp },
    { label:"Active Projects", value:String(activeProjects), sub:`${inReview} in review`, color:T.amb, Icon:Activity },
  ]

  const pipelineCards: MetricCard[] = [
    { label:"Pipeline value", value:gbp(salesMetrics.pipelineValue), sub:`${salesMetrics.openProspects} open prospects`, color:T.acc, Icon:Target },
    { label:"Weighted forecast", value:gbp(salesMetrics.weightedPipelineValue), sub:"Stage-probability adjusted", color:T.acc, Icon:Gauge },
    { label:"Close rate", value:`${salesMetrics.closeRate}%`, sub:`${salesMetrics.proposalConversionRate}% proposal to win`, color:T.grn, Icon:Trophy },
    { label:"Avg. deal value", value:gbp(salesMetrics.avgProjectValue), sub:`${gbp(salesMetrics.avgRetainerValue)}/mo avg retainer`, color:"var(--silver,#a8a8a8)", Icon:FileText },
  ]

  const activityCards: MetricCard[] = [
    { label:"Outreach this week", value:String(salesMetrics.outreachSentThisWeek), sub:`${salesMetrics.repliesThisWeek} replies`, color:T.acc, Icon:Mail },
    { label:"Discovery calls", value:String(salesMetrics.discoveryCallsBooked), sub:`${salesMetrics.proposalsSent} proposals sent`, color:T.amb, Icon:CalendarClock },
    { label:"Won this month", value:String(salesMetrics.dealsWonThisMonth), sub:`${salesMetrics.dealsLostThisMonth} lost`, color:T.grn, Icon:Trophy },
    { label:"Projected new MRR", value:gbp(salesMetrics.expectedMonthlyRetainerValue), sub:"From open retainer deals", color:T.grn, Icon:PoundSterling },
  ]

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 rounded-[8px] border p-3 sm:p-4 lg:p-5" style={{ background:"rgba(2,6,23,.58)", borderColor:"rgba(56,189,248,.18)", boxShadow:"0 24px 80px rgba(0,0,0,.28)" }}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-syne text-2xl font-extrabold tracking-tight">Command Centre</h1>
          <p className="font-dm text-sm mt-0.5" style={{ color: T.t2 }}>{todayLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button aria-label="Notifications" className="flex items-center rounded-[8px] border p-2" style={{ background: T.s2, borderColor: T.b1 }}>
            <Bell size={14} style={{ color: T.t2 }} />
          </button>
          <Link href="/clients/new" className="flex items-center gap-1.5 rounded-[8px] px-4 py-2 font-dm text-sm font-medium text-white" style={{ background: "var(--acc)" }}>
            <Plus size={14} /> New Client
          </Link>
          <Link href="/prospects" className="flex items-center gap-1.5 rounded-[8px] border px-4 py-2 font-dm text-sm font-medium" style={{ background: T.s2, borderColor: T.b1, color: T.t1 }}>
            <Target size={14} /> Pipeline
          </Link>
        </div>
      </div>

      {/* Auto-surfaced insights */}
      <div className="flex flex-wrap gap-2">
        {insights.map((insight) => (
          <span
            key={insight.text}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-dm text-[12px] font-medium"
            style={{ background: T.s2, borderColor: T.b1, color: T.t1 }}
          >
            {(insight.tone === "critical" || insight.tone === "warning") && (
              <AlertTriangle size={12} style={{ color: TONE_COLOR[insight.tone] }} aria-hidden="true" />
            )}
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: TONE_COLOR[insight.tone] }} aria-hidden="true" />
            {insight.text}
          </span>
        ))}
      </div>

      <section>
        <SectionLabel>Client Operations</SectionLabel>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          <OpsPanel
            title="Unread client replies"
            count={operational.unreadClientReplies.length}
            Icon={MessageSquare}
            tone={operational.unreadClientReplies.length > 0 ? T.amb : T.grn}
            emptyTitle="No client replies waiting"
            emptyBody="Client-visible request threads are clear."
          >
            {operational.unreadClientReplies.slice(0, 4).map((reply) => (
              <OpsItem key={reply.id} href={`/requests?request=${reply.requestId}`} title={reply.requestTitle} meta={`${reply.clientId} / ${formatDate(reply.createdAt)}`} body={reply.body} />
            ))}
          </OpsPanel>

          <OpsPanel
            title="Critical requests"
            count={operational.criticalRequests.length}
            Icon={AlertTriangle}
            tone={operational.criticalRequests.length > 0 ? T.red : T.grn}
            emptyTitle="No critical requests"
            emptyBody="No active critical support items are open."
          >
            {operational.criticalRequests.map((request) => (
              <OpsItem key={request.id} href={`/requests?request=${request.id}`} title={request.title} meta={`${request.clientId} / ${labelize(request.status)}`} body={`Updated ${formatDate(request.updatedAt)}`} />
            ))}
          </OpsPanel>

          <OpsPanel
            title="Waiting client"
            count={operational.waitingClientRequests.length}
            Icon={Clock3}
            tone={operational.waitingClientRequests.length > 0 ? T.amb : T.grn}
            emptyTitle="Nothing waiting on clients"
            emptyBody="No request is currently blocked on client input."
          >
            {operational.waitingClientRequests.map((request) => (
              <OpsItem key={request.id} href={`/requests?request=${request.id}`} title={request.title} meta={request.clientId} body={`Waiting since ${formatDate(request.updatedAt)}`} />
            ))}
          </OpsPanel>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
          <OpsPanel
            title="Reports due this month"
            count={operational.reportsDueThisMonth.length}
            Icon={FileText}
            tone={operational.reportsDueThisMonth.length > 0 ? T.amb : T.grn}
            emptyTitle="Reports covered"
            emptyBody={`${operational.currentMonthReportCount} report${operational.currentMonthReportCount === 1 ? "" : "s"} exist for this month.`}
          >
            {operational.reportsDueThisMonth.slice(0, 5).map((client) => (
              <OpsItem key={client.id} href="/requests" title={client.name} meta={client.tier ?? "No tier"} body={`Status: ${client.status}`} />
            ))}
          </OpsPanel>

          <OpsPanel
            title="Missing proposal drafts"
            count={operational.proposalsMissing.length}
            Icon={Target}
            tone={operational.proposalsMissing.length > 0 ? T.amb : T.grn}
            emptyTitle="Proposal drafts covered"
            emptyBody="Every proposal-stage prospect has a generated proposal draft."
          >
            {operational.proposalsMissing.slice(0, 5).map((prospect) => (
              <OpsItem key={prospect.id} href="/prospects" title={prospect.businessName} meta={prospect.contactName ?? "No contact"} body={prospect.proposalSentAt ? `Proposal stage since ${formatDate(prospect.proposalSentAt)}` : "Proposal stage"} />
            ))}
          </OpsPanel>

          <OpsPanel
            title="Recent timeline activity"
            count={operational.recentTimeline.length}
            Icon={Activity}
            tone={T.acc}
            emptyTitle="No timeline activity yet"
            emptyBody="Client-visible and internal timeline events will appear here."
          >
            {operational.recentTimeline.slice(0, 5).map((event) => (
              <OpsItem key={event.id} href="/requests" title={event.title} meta={`${event.clientId} / ${event.visibility === "internal" ? "internal" : "client-visible"}`} body={event.description} />
            ))}
          </OpsPanel>
        </div>
      </section>

      <section>
        <SectionLabel>Revenue &amp; Clients</SectionLabel>
        <MetricGrid cards={revenueCards} />
      </section>

      <section>
        <SectionLabel>Sales Pipeline</SectionLabel>
        <MetricGrid cards={pipelineCards} size={22} />
      </section>

      <section>
        <SectionLabel>Outreach Activity</SectionLabel>
        <MetricGrid cards={activityCards} size={22} />
      </section>

      <section>
        <SectionLabel>Operations</SectionLabel>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.6fr_1fr]">
          <div className="rounded-[8px] border p-4 sm:p-5" style={{ background: T.s1, borderColor: T.b1 }}>
            <h3 className="font-syne text-[15px] font-bold mb-4">MRR by Tier</h3>
            {mrrData.length === 0 ? (
              <p className="flex h-[148px] items-center justify-center font-dm text-sm" style={{ color: T.t2 }}>No recurring revenue data yet.</p>
            ) : <ResponsiveContainer width="100%" height={148}>
              <BarChart data={mrrData} barSize={30} accessibilityLayer aria-label="Monthly recurring revenue by client tier">
                <XAxis dataKey="name" tick={{ fontFamily: "var(--font-dm)", fontSize: 11, fill: T.t2 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: T.s2, border: `1px solid ${T.b2}`, borderRadius: 8, fontFamily: "var(--font-dm)", fontSize: 12 }}
                  labelStyle={{ color: T.t2 }}
                  itemStyle={{ color: T.t1 }}
                  formatter={(value) => [gbp(typeof value === "number" ? value : Number(value)), "MRR"]}
                />
                <Bar dataKey="value" fill="var(--acc)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>}
          </div>

          <div className="rounded-[8px] border p-4 sm:p-5" style={{ background: T.s1, borderColor: T.b1 }}>
            <h3 className="font-syne text-[15px] font-bold mb-4">Active Clients</h3>
            {shownClients.length === 0 && (
              <div className="font-dm text-sm" style={{ color: T.t2 }}>No clients in the database yet.</div>
            )}
            {shownClients.map((c, i) => (
              <div key={c.name} className="flex items-center gap-2.5 py-2.5" style={{ borderBottom: i < shownClients.length - 1 ? `1px solid ${T.b1}` : "none" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-syne text-[13px] font-bold" style={{ background: T.s3, color: T.t2 }}>{initial(c.name)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-dm text-[13px] font-medium truncate">{c.name}</div>
                  <div className="font-dm text-[11px]" style={{ color: T.t2 }}>{c.tier ?? "No tier set"}</div>
                </div>
                <div className="font-syne text-[13px] font-bold shrink-0" style={{ color: c.mrr > 0 ? T.grn : T.amb }}>
                  {c.mrr > 0 ? `${gbp(c.mrr)}/mo` : "Build"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <SectionLabel>Pipeline Health</SectionLabel>
          <Link href="/prospects" className="font-dm text-xs" style={{ color: T.acc }}>Open pipeline</Link>
        </div>
        <div className="rounded-[8px] border p-4 sm:p-5" style={{ background: T.s1, borderColor: T.b1 }}>
          <div className="grid grid-cols-2 gap-2 sm:max-w-xs">
            <div className="rounded-lg border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
              <div className="font-syne text-lg font-bold" style={{ color: salesMetrics.followUpsDueToday > 0 ? T.amb : T.t1 }}>{salesMetrics.followUpsDueToday}</div>
              <div className="font-dm text-[11px]" style={{ color:T.t2 }}>due today</div>
            </div>
            <div className="rounded-lg border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
              <div className="font-syne text-lg font-bold" style={{ color: salesMetrics.overdueFollowUps > 0 ? T.red : T.t1 }}>{salesMetrics.overdueFollowUps}</div>
              <div className="font-dm text-[11px]" style={{ color:T.t2 }}>overdue</div>
            </div>
          </div>
          <div className="mt-5 space-y-2">
            {PROSPECT_STAGES.map((stage) => (
              <div key={stage} className="flex items-center gap-2">
                <span className="w-28 shrink-0 font-dm text-[11px]" style={{ color:T.t2 }}>{STAGE_LABELS[stage]}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background:T.s3 }}>
                  <div className="h-full rounded-full" style={{ width:`${Math.min(100, (salesMetrics.prospectsByStage[stage] ?? 0) * 18)}%`, background:stage === "won" ? T.grn : stage === "lost" ? T.red : T.acc }} />
                </div>
                <span className="w-5 text-right font-syne text-[11px] font-bold">{salesMetrics.prospectsByStage[stage] ?? 0}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 font-dm text-[11px]" style={{ color:T.t2 }}>
            <span>{salesMetrics.replyRate}% reply rate</span>
            <span>{salesMetrics.proposalRate}% reach proposal</span>
            <span>{salesMetrics.winRate}% win rate</span>
          </div>
        </div>
      </section>
    </div>
  )
}

function initial(value: string) {
  return value.trim().charAt(0).toUpperCase() || "?"
}

function OpsPanel({ title, count, Icon, tone, emptyTitle, emptyBody, children }: {
  title: string
  count: number
  Icon: typeof AlertTriangle
  tone: string
  emptyTitle: string
  emptyBody: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-[8px] border p-4" style={{ background:T.s1, borderColor:T.b1 }}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon size={15} style={{ color:tone }} aria-hidden="true" />
          <h3 className="truncate font-syne text-[15px] font-bold">{title}</h3>
        </div>
        <span className="rounded border px-2 py-0.5 font-syne text-xs font-bold" style={{ borderColor:T.b2, background:T.s2, color:tone }}>{count}</span>
      </div>
      {count === 0 ? (
        <div className="rounded-lg border border-dashed p-4" style={{ borderColor:T.b1, background:T.s2 }}>
          <CheckCircle2 size={15} className="mb-2" style={{ color:T.grn }} aria-hidden="true" />
          <div className="font-dm text-sm font-semibold">{emptyTitle}</div>
          <p className="mt-1 font-dm text-xs leading-relaxed" style={{ color:T.t2 }}>{emptyBody}</p>
        </div>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </div>
  )
}

function OpsItem({ href, title, meta, body }: { href: string; title: string; meta: string; body: string }) {
  return (
    <Link href={href} className="block rounded-lg border p-3 transition-colors hover:border-acc/60" style={{ background:T.s2, borderColor:T.b1 }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="line-clamp-1 font-dm text-sm font-semibold">{title}</div>
          <div className="mt-1 font-dm text-[11px]" style={{ color:T.t3 }}>{meta}</div>
        </div>
      </div>
      <p className="mt-2 line-clamp-2 font-dm text-xs leading-relaxed" style={{ color:T.t2 }}>{body}</p>
    </Link>
  )
}

function labelize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "No date"
  return date.toLocaleDateString("en-GB", { day:"2-digit", month:"short" })
}
