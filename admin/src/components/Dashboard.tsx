"use client"

import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts"
import { Activity, Bell, CalendarClock, DollarSign, Mail, Plus, Target, TrendingUp, Trophy, Users } from "lucide-react"
import Link from "next/link"
import { PROSPECT_STAGES, STAGE_LABELS, type ProspectStage } from "@/lib/prospects"

const T = { t1:"var(--t1)",t2:"var(--t2)",t3:"var(--t3)",s1:"var(--s1)",s2:"var(--s2)",s3:"var(--s3)",b1:"var(--b1)",b2:"var(--b2)",acc:"var(--acc)",grn:"var(--grn)",amb:"var(--amb)",red:"var(--red)" }

interface DashboardClient {
  name: string
  tier: string | null
  mrr: number
  status: string
  progress: number
}

interface SalesMetrics {
  outreachSentThisWeek: number
  repliesThisWeek: number
  discoveryCallsBooked: number
  proposalsSent: number
  dealsWonThisMonth: number
  dealsLostThisMonth: number
  pipelineValue: number
  expectedMonthlyRetainerValue: number
  followUpsDueToday: number
  overdueFollowUps: number
  prospectsByStage: Record<ProspectStage, number>
  replyRate: number
  proposalRate: number
  winRate: number
}

interface DashboardContentProps {
  clients: DashboardClient[]
  salesMetrics: SalesMetrics
  todayLabel: string
}

function computeTierMrr(clients: DashboardClient[]) {
  const totalsByTier = new Map<string, number>()

  clients.forEach((client) => {
    const tier = client.tier ?? "No tier set"
    totalsByTier.set(tier, (totalsByTier.get(tier) ?? 0) + client.mrr)
  })

  return Array.from(totalsByTier, ([name, value]) => ({ name, value }))
}

export function DashboardContent({ clients, salesMetrics, todayLabel }: DashboardContentProps) {
  const activeClients = clients.filter((c) => c.status === "active")
  const totalMrr = clients.reduce((sum, c) => sum + c.mrr, 0)
  const avgRetainer = activeClients.length ? Math.round(totalMrr / activeClients.length) : 0
  const activeProjects = clients.filter((c) => c.progress < 100).length
  const inReview = clients.filter((c) => c.status === "review").length
  const shownClients = clients.slice(0, 4)
  const mrrData = computeTierMrr(clients)
  const metrics = [
    { label:"Monthly MRR", value:`GBP ${totalMrr.toLocaleString()}`, sub:"Live from clients table", color:T.grn, Icon:DollarSign },
    { label:"Active Clients", value:String(activeClients.length), sub:`${clients.length} total clients`, color:T.acc, Icon:Users },
    { label:"Active Projects", value:String(activeProjects), sub:`${inReview} in review`, color:T.amb, Icon:Activity },
    { label:"Avg. Retainer", value:`GBP ${avgRetainer.toLocaleString()}`, sub:"Target: GBP 2k/client", color:"var(--silver,#a8a8a8)", Icon:TrendingUp },
  ]
  const salesCards = [
    { label:"Outreach this week", value:String(salesMetrics.outreachSentThisWeek), sub:`${salesMetrics.repliesThisWeek} replies`, color:T.acc, Icon:Mail },
    { label:"Discovery calls", value:String(salesMetrics.discoveryCallsBooked), sub:`${salesMetrics.proposalsSent} proposals sent`, color:T.amb, Icon:CalendarClock },
    { label:"Won this month", value:String(salesMetrics.dealsWonThisMonth), sub:`${salesMetrics.dealsLostThisMonth} lost`, color:T.grn, Icon:Trophy },
    { label:"Pipeline value", value:`GBP ${salesMetrics.pipelineValue.toLocaleString()}`, sub:`GBP ${salesMetrics.expectedMonthlyRetainerValue.toLocaleString()} projected MRR`, color:T.acc, Icon:Target },
  ]

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="font-syne text-2xl font-extrabold tracking-tight">Command Centre</h1>
          <p className="font-dm text-sm mt-0.5" style={{ color: T.t2 }}>
            {todayLabel}
          </p>
        </div>
        <div className="flex gap-2.5">
          <button aria-label="Notifications" className="flex items-center p-2 rounded-lg border" style={{ background: T.s2, borderColor: T.b1 }}>
            <Bell size={14} style={{ color: T.t2 }} />
          </button>
          <Link href="/clients/new" className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-dm text-sm font-medium text-white" style={{ background: "var(--acc)" }}>
            <Plus size={14} /> New Client
          </Link>
          <Link href="/prospects" className="flex items-center gap-1.5 px-4 py-2 rounded-lg border font-dm text-sm font-medium" style={{ background: T.s2, borderColor: T.b1, color: T.t1 }}>
            <Target size={14} /> Pipeline
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-5">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl p-5 border" style={{ background: T.s1, borderColor: T.b1 }}>
            <div className="flex justify-between mb-3">
              <span className="font-dm text-xs" style={{ color: T.t2 }}>{m.label}</span>
              <m.Icon size={15} style={{ color: m.color }} aria-hidden="true" />
            </div>
            <div className="font-syne text-[24px] font-extrabold mb-0.5">{m.value}</div>
            <div className="font-dm text-[11px]" style={{ color: T.t3 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-3 mb-5">
        {salesCards.map((m) => (
          <div key={m.label} className="rounded-xl p-5 border" style={{ background: T.s1, borderColor: T.b1 }}>
            <div className="flex justify-between mb-3">
              <span className="font-dm text-xs" style={{ color: T.t2 }}>{m.label}</span>
              <m.Icon size={15} style={{ color: m.color }} aria-hidden="true" />
            </div>
            <div className="font-syne text-[22px] font-extrabold mb-0.5">{m.value}</div>
            <div className="font-dm text-[11px]" style={{ color: T.t3 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[1.6fr_1fr] gap-3">
        <div className="rounded-xl border p-6" style={{ background: T.s1, borderColor: T.b1 }}>
          <h2 className="font-syne text-[15px] font-bold mb-4">MRR by Tier</h2>
          <ResponsiveContainer width="100%" height={148}>
            <BarChart data={mrrData} barSize={30}>
              <XAxis dataKey="name" tick={{ fontFamily: "var(--font-dm)", fontSize: 11, fill: T.t2 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: T.s2, border: `1px solid ${T.b2}`, borderRadius: 8, fontFamily: "var(--font-dm)", fontSize: 12 }}
                labelStyle={{ color: T.t2 }}
                itemStyle={{ color: T.t1 }}
                formatter={(v: number) => [`GBP ${v.toLocaleString()}`, "MRR"]}
              />
              <Bar dataKey="value" fill="var(--acc)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border p-6" style={{ background: T.s1, borderColor: T.b1 }}>
          <h2 className="font-syne text-[15px] font-bold mb-4">Active Clients</h2>
          {shownClients.length === 0 && (
            <div className="font-dm text-sm" style={{ color: T.t2 }}>No clients in the database yet.</div>
          )}
          {shownClients.map((c, i) => (
            <div key={c.name} className="flex items-center gap-2.5 py-2.5" style={{ borderBottom: i < shownClients.length - 1 ? `1px solid ${T.b1}` : "none" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-syne text-[13px] font-bold" style={{ background: T.s3, color: T.t2 }}>{c.name[0]}</div>
              <div className="flex-1 min-w-0">
                <div className="font-dm text-[13px] font-medium truncate">{c.name}</div>
                <div className="font-dm text-[11px]" style={{ color: T.t2 }}>{c.tier ?? "No tier set"}</div>
              </div>
              <div className="font-syne text-[13px] font-bold shrink-0" style={{ color: c.mrr > 0 ? T.grn : T.amb }}>
                {c.mrr > 0 ? `GBP ${c.mrr}/mo` : "Build"}
              </div>
            </div>
          ))}

          <div className="mt-5 border-t pt-4" style={{ borderColor: T.b1 }}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-syne text-[15px] font-bold">Sales Follow-ups</h2>
              <Link href="/prospects" className="font-dm text-xs" style={{ color: T.acc }}>Open pipeline</Link>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
                <div className="font-syne text-lg font-bold" style={{ color: salesMetrics.followUpsDueToday > 0 ? T.amb : T.t1 }}>{salesMetrics.followUpsDueToday}</div>
                <div className="font-dm text-[11px]" style={{ color:T.t2 }}>due today</div>
              </div>
              <div className="rounded-lg border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
                <div className="font-syne text-lg font-bold" style={{ color: salesMetrics.overdueFollowUps > 0 ? T.red : T.t1 }}>{salesMetrics.overdueFollowUps}</div>
                <div className="font-dm text-[11px]" style={{ color:T.t2 }}>overdue</div>
              </div>
            </div>
            <div className="mt-4 space-y-2">
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
            <div className="mt-4 grid grid-cols-3 gap-2 font-dm text-[11px]" style={{ color:T.t2 }}>
              <span>{salesMetrics.replyRate}% reply</span>
              <span>{salesMetrics.proposalRate}% proposal</span>
              <span>{salesMetrics.winRate}% win</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
