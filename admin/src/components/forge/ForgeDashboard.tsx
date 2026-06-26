"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock,
  Code2,
  Download,
  DollarSign,
  FileText,
  Gauge,
  Layers3,
  Monitor,
  Plus,
  Radio,
  Rocket,
  ShieldCheck,
  Sparkles,
  Target,
  TerminalSquare,
  TrendingUp,
  Workflow,
} from "lucide-react"
import { FORGE_DASHBOARD_CARDS, FORGE_WORKFLOW_STAGES, type ForgePriority, type ForgeProjectStatus } from "@/lib/forge"

const T = {
  s1: "var(--s1)",
  s2: "var(--s2)",
  s3: "var(--s3)",
  b1: "var(--b1)",
  b2: "var(--b2)",
  t1: "var(--t1)",
  t2: "var(--t2)",
  t3: "var(--t3)",
  grn: "var(--grn)",
  amb: "var(--amb)",
}

type DashboardTab = "projects" | "pipeline" | "activity" | "readiness"
type DashboardCardKey = (typeof FORGE_DASHBOARD_CARDS)[number]["key"]

const TABS: Array<{ key: DashboardTab; label: string; Icon: LucideIcon }> = [
  { key: "projects", label: "Projects", Icon: Layers3 },
  { key: "pipeline", label: "Pipeline", Icon: Workflow },
  { key: "activity", label: "Activity", Icon: Activity },
  { key: "readiness", label: "Readiness", Icon: ShieldCheck },
]

const CARD_ICONS = {
  "active-projects": Target,
  "draft-builds": FileText,
  "awaiting-qa": Clock,
  "ready-to-deploy": CheckCircle2,
  "integrations-health": ShieldCheck,
  "recent-activity": Activity,
} satisfies Record<DashboardCardKey, LucideIcon>

const WORKFLOW_ICONS = [Radio, Sparkles, Target, Workflow, FileText, Code2, Monitor, ShieldCheck, Gauge, TerminalSquare, Rocket, CheckCircle2]

interface ForgeProjectSummary {
  id: number
  name: string
  businessName: string
  industry: string | null
  websiteUrl: string | null
  status: ForgeProjectStatus
  priority: ForgePriority
  deadline: Date | string | null
  updatedAt: Date | string
}

interface ForgeActivitySummary {
  id: number
  action: string
  message: string
  actor: string | null
  createdAt: Date | string
}

interface ForgeAiDashboardMetrics {
  todaySpend: number
  monthSpend: number
  mostExpensiveProject: {
    projectId: number | null
    projectName: string
    businessName: string | null
    estimatedCost: number
  } | null
  averageCostPerSite: number
  budget: {
    monthly: {
      limit: number | null
      warning: boolean
      blocked: boolean
    }
  }
}

export function ForgeDashboard({
  projects,
  recentActivity,
  aiMetrics,
  averageDesignScore,
}: {
  projects: ForgeProjectSummary[]
  recentActivity: ForgeActivitySummary[]
  aiMetrics: ForgeAiDashboardMetrics
  averageDesignScore: number | null
}) {
  const [activeTab, setActiveTab] = useState<DashboardTab>("projects")

  const activeProjects = projects.filter((project) => project.status !== "archived")
  const readyProjects = projects.filter((project) => project.status === "ready_to_deploy")
  const qaProjects = projects.filter((project) => project.status === "qa")
  const buildProjects = projects.filter((project) => ["build", "preview", "integrations"].includes(project.status))
  const urgentProjects = projects.filter((project) => project.priority === "high" && project.status !== "archived")
  const newestProject = projects[0]
  const latestActivity = recentActivity[0]

  const cardValues: Record<DashboardCardKey, string> = {
    "active-projects": String(activeProjects.length),
    "draft-builds": String(projects.filter((project) => ["intake", "research", "strategy", "sitemap", "copy", "design", "build", "preview"].includes(project.status)).length),
    "awaiting-qa": String(qaProjects.length),
    "ready-to-deploy": String(readyProjects.length),
    "integrations-health": "Idle",
    "recent-activity": String(recentActivity.length),
  }

  const stageMap = useMemo(() => {
    const map = new Map<ForgeProjectStatus, number>()
    for (const project of activeProjects) map.set(project.status, (map.get(project.status) ?? 0) + 1)
    return map
  }, [activeProjects])

  const nextActions = buildNextActions({
    projects,
    activeProjects,
    readyProjects,
    qaProjects,
    buildProjects,
    urgentProjects,
  })

  return (
    <div
      className="mx-auto flex h-[calc(100vh-1rem)] w-full max-w-none flex-col overflow-hidden rounded-[8px] border sm:h-[calc(100vh-1.5rem)] lg:h-[calc(100vh-2.5rem)]"
      style={{
        borderColor: "rgba(56,189,248,.18)",
        background: "linear-gradient(135deg, #070b13 0%, #0b1020 48%, #060b10 100%)",
        boxShadow: "0 24px 80px rgba(0,0,0,.34)",
      }}
    >
      <header className="flex h-[58px] shrink-0 items-center justify-between gap-4 border-b px-4" style={{ borderColor: "rgba(148,163,184,.14)" }}>
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border" style={{ borderColor:"rgba(56,189,248,.25)", background:"rgba(15,23,42,.74)" }}>
            <Gauge size={17} style={{ color:"#22d3ee" }} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-syne text-lg font-extrabold text-white">Forge</h1>
              <span className="hidden font-dm text-[10px] font-semibold uppercase tracking-[.3em] sm:inline" style={{ color:"#64748b" }}>Digital Engine V1</span>
            </div>
            <p className="truncate font-dm text-xs" style={{ color:"#94a3b8" }}>
              Intake, build, QA, export, deploy.
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Pill icon={Radio} label={`${recentActivity.length || 0} signals`} tone="cyan" />
          <Pill icon={Gauge} label={`Design ${averageDesignScore === null ? "n/a" : `${averageDesignScore}/100`}`} tone={averageDesignScore !== null && averageDesignScore >= 80 ? "green" : "cyan"} />
          <Pill icon={ShieldCheck} label="Admin only" tone="green" />
        </div>

        <Link
          href="/forge/new"
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-4 font-dm text-sm font-bold text-[#06121f] transition-transform hover:-translate-y-0.5"
          style={{ background:"linear-gradient(135deg, #f8fafc, #67e8f9)" }}
        >
          <Plus size={16} aria-hidden="true" />
          New Project
        </Link>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-[380px_1fr]">
        <aside className="flex min-h-0 flex-col border-b p-4 lg:border-b-0 lg:border-r" style={{ borderColor:"rgba(148,163,184,.14)" }}>
          <div
            className="relative mb-4 shrink-0 overflow-hidden rounded-[8px] border p-4"
            style={{ borderColor:"rgba(56,189,248,.18)", background:"rgba(2,6,23,.58)" }}
          >
            <GridWash />
            <div className="relative">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="font-dm text-[11px] font-semibold uppercase tracking-[.22em]" style={{ color:"#7dd3fc" }}>Agent Console</p>
                  <h2 className="mt-1 font-syne text-2xl font-extrabold leading-none text-white">Command Centre</h2>
                </div>
                <TerminalSquare size={20} style={{ color:"#22d3ee" }} aria-hidden="true" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Metric label="Active" value={activeProjects.length} tone="cyan" />
                <Metric label="QA" value={qaProjects.length} tone="amber" />
                <Metric label="Design" value={averageDesignScore ?? "n/a"} tone={averageDesignScore !== null && averageDesignScore >= 80 ? "green" : "cyan"} />
              </div>
            </div>
          </div>

          <div className="mb-4 grid shrink-0 grid-cols-2 gap-2">
            <Signal label="Latest Run" value={newestProject?.name ?? "No project"} detail={newestProject ? labelize(newestProject.status) : "Create first run"} />
            <Signal label="Latest Signal" value={latestActivity ? labelize(latestActivity.action) : "Quiet"} detail={latestActivity ? formatDate(latestActivity.createdAt) : "No activity"} />
          </div>

          <div className="min-h-0 flex-1 rounded-[8px] border" style={{ background:T.s1, borderColor:T.b1 }}>
            <div className="flex h-11 items-center justify-between border-b px-3" style={{ borderColor:T.b1 }}>
              <div className="flex items-center gap-2">
                <Sparkles size={15} style={{ color:"#a78bfa" }} aria-hidden="true" />
                <h2 className="font-dm text-sm font-semibold">What Needs Doing</h2>
              </div>
              <span className="font-dm text-[11px]" style={{ color:T.t2 }}>{nextActions.length}</span>
            </div>
            <div className="h-[calc(100%-2.75rem)] overflow-auto p-3">
              <div className="space-y-2">
                {nextActions.map((action) => (
                  <Link key={action.title} href={action.href} className="group block rounded-[8px] border p-3 transition-colors hover:bg-[rgba(56,189,248,.045)]" style={{ borderColor:T.b1, background:T.s2 }}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <action.Icon size={14} style={{ color:action.color }} aria-hidden="true" />
                        <span className="truncate font-dm text-xs font-semibold">{action.title}</span>
                      </div>
                      <ChevronRight size={14} className="shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color:T.t3 }} aria-hidden="true" />
                    </div>
                    <p className="line-clamp-2 font-dm text-[11px] leading-4" style={{ color:T.t2 }}>{action.detail}</p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <main className="flex min-h-0 flex-col p-4">
          <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-dm text-[11px] font-semibold uppercase tracking-[.22em]" style={{ color:"#7dd3fc" }}>App Preview</p>
              <h2 className="font-syne text-xl font-extrabold text-white">Production Dashboard</h2>
            </div>
            <div className="flex rounded-full border p-1" style={{ background:"rgba(15,23,42,.72)", borderColor:"rgba(148,163,184,.16)" }}>
              {TABS.map(({ key, label, Icon }) => {
                const active = activeTab === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key)}
                    className="inline-flex h-9 items-center gap-2 rounded-full px-3 font-dm text-xs font-semibold transition-colors"
                    style={{ background:active ? "#f8fafc" : "transparent", color:active ? "#06121f" : "#94a3b8" }}
                  >
                    <Icon size={14} aria-hidden="true" />
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mb-3 grid shrink-0 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <AiSpendCard icon={DollarSign} label="Today's AI Spend" value={formatCost(aiMetrics.todaySpend)} detail="Usage completed today" tone={aiMetrics.budget.monthly.blocked ? "amber" : "cyan"} />
            <AiSpendCard
              icon={TrendingUp}
              label="This Month AI Spend"
              value={formatCost(aiMetrics.monthSpend)}
              detail={aiMetrics.budget.monthly.limit ? `${Math.round(((aiMetrics.monthSpend / aiMetrics.budget.monthly.limit) || 0) * 100)}% of monthly limit` : "No monthly limit set"}
              tone={aiMetrics.budget.monthly.warning ? "amber" : "green"}
            />
            <AiSpendCard
              icon={Activity}
              label="Most Expensive Project"
              value={aiMetrics.mostExpensiveProject ? formatCost(aiMetrics.mostExpensiveProject.estimatedCost) : "$0.0000"}
              detail={aiMetrics.mostExpensiveProject?.projectName ?? "No AI usage yet"}
              tone="violet"
            />
            <Link href="/api/forge/ai-usage/export" className="group rounded-[8px] border p-3 transition-colors hover:bg-[rgba(56,189,248,.045)]" style={{ background:T.s1, borderColor:T.b1 }}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="font-dm text-[10px] font-semibold uppercase tracking-[.1em]" style={{ color:T.t2 }}>Average Cost Per Site</div>
                <Download size={15} style={{ color:"#22d3ee" }} aria-hidden="true" />
              </div>
              <div className="font-syne text-xl font-extrabold" style={{ color:"#22d3ee" }}>{formatCost(aiMetrics.averageCostPerSite)}</div>
              <div className="mt-1 font-dm text-[11px]" style={{ color:T.t2 }}>Export CSV report</div>
            </Link>
          </div>

          <section className="min-h-0 flex-1 overflow-hidden rounded-[8px] border" style={{ background:T.s1, borderColor:T.b1 }}>
            <div className="grid h-12 grid-cols-3 border-b md:grid-cols-6" style={{ borderColor:T.b1, background:T.s2 }}>
              {FORGE_DASHBOARD_CARDS.map((card) => {
                const Icon = CARD_ICONS[card.key]
                return (
                  <div key={card.key} className="flex min-w-0 items-center gap-2 border-r px-3 last:border-r-0" style={{ borderColor:T.b1 }}>
                    <Icon size={14} style={{ color:metricColor(card.key) }} aria-hidden="true" />
                    <span className="hidden truncate font-dm text-[11px] md:inline" style={{ color:T.t2 }}>{card.label}</span>
                    <span className="ml-auto font-syne text-sm font-extrabold" style={{ color:metricColor(card.key) }}>{cardValues[card.key]}</span>
                  </div>
                )
              })}
            </div>

            <div className="h-[calc(100%-3rem)] overflow-hidden">
              {activeTab === "projects" && <ProjectsTab projects={projects} />}
              {activeTab === "pipeline" && <PipelineTab stageMap={stageMap} activeCount={activeProjects.length} />}
              {activeTab === "activity" && <ActivityTab recentActivity={recentActivity} />}
              {activeTab === "readiness" && (
                <ReadinessTab
                  activeProjects={activeProjects}
                  buildProjects={buildProjects}
                  qaProjects={qaProjects}
                  readyProjects={readyProjects}
                  urgentProjects={urgentProjects}
                />
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

function AiSpendCard({ icon: Icon, label, value, detail, tone }: { icon: LucideIcon; label: string; value: string; detail: string; tone: "cyan" | "green" | "amber" | "violet" }) {
  return (
    <div className="rounded-[8px] border p-3" style={{ background:T.s1, borderColor:T.b1 }}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="font-dm text-[10px] font-semibold uppercase tracking-[.1em]" style={{ color:T.t2 }}>{label}</div>
        <Icon size={15} style={{ color:toneColor(tone) }} aria-hidden="true" />
      </div>
      <div className="font-syne text-xl font-extrabold" style={{ color:toneColor(tone) }}>{value}</div>
      <div className="mt-1 truncate font-dm text-[11px]" style={{ color:T.t2 }}>{detail}</div>
    </div>
  )
}

function ProjectsTab({ projects }: { projects: ForgeProjectSummary[] }) {
  if (projects.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-[540px] rounded-[8px] border border-dashed p-6 text-center" style={{ borderColor:T.b2, background:T.s2 }}>
          <Target size={24} className="mx-auto mb-4 text-acc" aria-hidden="true" />
          <h3 className="font-syne text-xl font-bold">No Forge projects yet</h3>
          <p className="mt-2 font-dm text-sm leading-relaxed" style={{ color:T.t2 }}>Create the first project to start intake, tasks, artifacts, QA, and deploy readiness.</p>
          <Link href="/forge/new" className="mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 font-dm text-sm font-bold text-white" style={{ background:"var(--acc)" }}>
            <Plus size={15} aria-hidden="true" />
            Create Project
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto">
      <div className="hidden min-w-[820px] md:block">
        <div className="sticky top-0 z-10 grid h-11 items-center gap-3 border-b px-4" style={{ gridTemplateColumns:"1.35fr 1fr .8fr .7fr .7fr 28px", borderColor:T.b1, background:T.s1 }}>
          {["Project", "Business", "Stage", "Priority", "Updated", ""].map((heading) => (
            <div key={heading || "open"} className="font-dm text-[11px] font-semibold uppercase tracking-[.1em]" style={{ color:T.t2 }}>{heading}</div>
          ))}
        </div>
        {projects.map((project, index) => (
          <ProjectRow key={project.id} project={project} isLast={index === projects.length - 1} />
        ))}
      </div>

      <div className="grid gap-3 p-3 md:hidden">
        {projects.map((project) => (
          <Link key={project.id} href={`/forge/${project.id}`} className="rounded-[8px] border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-dm text-sm font-semibold">{project.name}</div>
                <div className="truncate font-dm text-[11px]" style={{ color:T.t2 }}>{project.businessName}</div>
              </div>
              <ArrowRight size={16} style={{ color:T.t3 }} aria-hidden="true" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge value={labelize(project.status)} tone={statusTone(project.status)} />
              <Badge value={project.priority} tone={priorityTone(project.priority)} />
              <span className="font-dm text-[11px]" style={{ color:T.t2 }}>{formatDate(project.updatedAt)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

function ProjectRow({ project, isLast }: { project: ForgeProjectSummary; isLast: boolean }) {
  return (
    <Link
      href={`/forge/${project.id}`}
      className="grid h-[58px] items-center gap-3 px-4 transition-colors hover:bg-[rgba(56,189,248,.045)]"
      style={{ gridTemplateColumns:"1.35fr 1fr .8fr .7fr .7fr 28px", borderBottom:isLast ? "none" : `1px solid ${T.b1}` }}
    >
      <div className="min-w-0">
        <div className="truncate font-dm text-sm font-semibold">{project.name}</div>
        <div className="truncate font-dm text-[11px]" style={{ color:T.t2 }}>{project.websiteUrl ?? "No website set"}</div>
      </div>
      <div className="min-w-0">
        <div className="truncate font-dm text-sm">{project.businessName}</div>
        <div className="truncate font-dm text-[11px]" style={{ color:T.t2 }}>{project.industry ?? "No industry"}</div>
      </div>
      <Badge value={labelize(project.status)} tone={statusTone(project.status)} />
      <Badge value={project.priority} tone={priorityTone(project.priority)} />
      <div className="font-dm text-xs" style={{ color:T.t2 }}>{formatDate(project.updatedAt)}</div>
      <ArrowRight size={16} style={{ color:T.t3 }} aria-hidden="true" />
    </Link>
  )
}

function PipelineTab({ stageMap, activeCount }: { stageMap: Map<ForgeProjectStatus, number>; activeCount: number }) {
  return (
    <div className="h-full overflow-auto p-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {FORGE_WORKFLOW_STAGES.map((stage, index) => {
          const Icon = WORKFLOW_ICONS[index % WORKFLOW_ICONS.length]
          const status = stageToStatus(stage)
          const count = status ? stageMap.get(status) ?? 0 : 0
          const width = activeCount ? Math.max(6, Math.round((count / activeCount) * 100)) : 6

          return (
            <div key={stage} className="rounded-[8px] border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-syne text-sm font-extrabold">{String(index + 1).padStart(2, "0")}</span>
                  <Icon size={15} style={{ color:index < 6 ? "#38bdf8" : "#94a3b8" }} aria-hidden="true" />
                </div>
                <span className="font-dm text-xs" style={{ color:T.t2 }}>{count}</span>
              </div>
              <div className="mb-3 truncate font-dm text-sm font-semibold">{stage}</div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-[#22d3ee]" style={{ width:`${width}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ActivityTab({ recentActivity }: { recentActivity: ForgeActivitySummary[] }) {
  return (
    <div className="h-full overflow-auto p-4">
      {recentActivity.length === 0 ? (
        <div className="rounded-[8px] border border-dashed p-4 font-dm text-sm" style={{ borderColor:T.b2, color:T.t2 }}>No Forge activity has been logged yet.</div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {recentActivity.map((activity) => (
            <div key={activity.id} className="rounded-[8px] border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <CircleDot size={14} style={{ color:"#22d3ee" }} aria-hidden="true" />
                  <div className="truncate font-dm text-xs font-semibold">{labelize(activity.action)}</div>
                </div>
                <div className="shrink-0 font-dm text-[11px]" style={{ color:T.t3 }}>{formatDate(activity.createdAt)}</div>
              </div>
              <p className="line-clamp-2 font-dm text-xs leading-relaxed" style={{ color:T.t2 }}>{activity.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ReadinessTab({
  activeProjects,
  buildProjects,
  qaProjects,
  readyProjects,
  urgentProjects,
}: {
  activeProjects: ForgeProjectSummary[]
  buildProjects: ForgeProjectSummary[]
  qaProjects: ForgeProjectSummary[]
  readyProjects: ForgeProjectSummary[]
  urgentProjects: ForgeProjectSummary[]
}) {
  const checks = [
    { label:"Active Load", value:activeProjects.length, detail:"Non-archived production runs", Icon:Target, tone:"cyan" as const },
    { label:"Build Lane", value:buildProjects.length, detail:"Build, preview, or integration stage", Icon:Code2, tone:"violet" as const },
    { label:"Awaiting QA", value:qaProjects.length, detail:"Needs final quality pass", Icon:Clock, tone:"amber" as const },
    { label:"Ready", value:readyProjects.length, detail:"Prepared for deployment handoff", Icon:Rocket, tone:"green" as const },
    { label:"Urgent", value:urgentProjects.length, detail:"High priority active work", Icon:Activity, tone:"amber" as const },
  ]

  return (
    <div className="h-full overflow-auto p-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {checks.map((check) => (
          <div key={check.label} className="rounded-[8px] border p-4" style={{ background:T.s2, borderColor:T.b1 }}>
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <div className="font-dm text-[11px] font-semibold uppercase tracking-[.12em]" style={{ color:T.t2 }}>{check.label}</div>
                <p className="mt-1 line-clamp-2 font-dm text-xs leading-5" style={{ color:T.t2 }}>{check.detail}</p>
              </div>
              <check.Icon size={17} style={{ color:toneColor(check.tone) }} aria-hidden="true" />
            </div>
            <div className="font-syne text-3xl font-extrabold" style={{ color:toneColor(check.tone) }}>{check.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Pill({ icon: Icon, label, tone }: { icon: LucideIcon; label: string; tone: "cyan" | "green" }) {
  return (
    <div className="inline-flex h-8 items-center gap-2 rounded-full border px-3" style={{ background:"rgba(15,23,42,.7)", borderColor:"rgba(148,163,184,.16)" }}>
      <Icon size={13} style={{ color:toneColor(tone) }} aria-hidden="true" />
      <span className="font-dm text-[11px] font-semibold" style={{ color:"#cbd5e1" }}>{label}</span>
    </div>
  )
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone: "cyan" | "amber" | "green" }) {
  return (
    <div className="rounded-[8px] border p-3" style={{ background:"rgba(15,23,42,.64)", borderColor:"rgba(148,163,184,.14)" }}>
      <div className="font-dm text-[10px] font-semibold uppercase tracking-[.1em]" style={{ color:"#94a3b8" }}>{label}</div>
      <div className="mt-1 font-syne text-2xl font-extrabold" style={{ color:toneColor(tone) }}>{value}</div>
    </div>
  )
}

function Signal({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[8px] border p-3" style={{ background:T.s1, borderColor:T.b1 }}>
      <div className="font-dm text-[10px] font-semibold uppercase tracking-[.1em]" style={{ color:T.t2 }}>{label}</div>
      <div className="mt-1 truncate font-dm text-sm font-semibold">{value}</div>
      <div className="mt-0.5 truncate font-dm text-[11px]" style={{ color:T.t2 }}>{detail}</div>
    </div>
  )
}

function Badge({ value, tone }: { value: string; tone: "accent" | "good" | "warn" | "muted" }) {
  const color = tone === "good" ? T.grn : tone === "warn" ? T.amb : tone === "accent" ? "#38bdf8" : T.t2

  return (
    <span className="inline-flex w-fit rounded-full px-2.5 py-1 font-dm text-[10px] font-semibold uppercase tracking-[.05em]" style={{ background:T.s2, border:`1px solid ${T.b2}`, color }}>
      {value}
    </span>
  )
}

function GridWash() {
  return (
    <div
      className="pointer-events-none absolute inset-0 opacity-60"
      style={{
        backgroundImage:
          "linear-gradient(rgba(148,163,184,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.06) 1px, transparent 1px)",
        backgroundSize: "34px 34px",
        maskImage: "linear-gradient(to bottom, black, transparent 90%)",
      }}
      aria-hidden="true"
    />
  )
}

function buildNextActions({
  projects,
  activeProjects,
  readyProjects,
  qaProjects,
  buildProjects,
  urgentProjects,
}: {
  projects: ForgeProjectSummary[]
  activeProjects: ForgeProjectSummary[]
  readyProjects: ForgeProjectSummary[]
  qaProjects: ForgeProjectSummary[]
  buildProjects: ForgeProjectSummary[]
  urgentProjects: ForgeProjectSummary[]
}) {
  if (projects.length === 0) {
    return [
      { title:"Create first project", detail:"Start intake and generate the first Forge production run.", href:"/forge/new", Icon:Plus, color:"#22d3ee" },
      { title:"Prepare workflow", detail:"Pipeline stages are ready for research, copy, design, build, QA, and deployment.", href:"/forge/new", Icon:Workflow, color:"#a78bfa" },
    ]
  }

  const newest = projects[0]
  return [
    urgentProjects.length
      ? { title:"Review high priority work", detail:`${urgentProjects.length} active project${urgentProjects.length === 1 ? "" : "s"} marked high priority.`, href:`/forge/${urgentProjects[0].id}`, Icon:Activity, color:T.amb }
      : { title:"Open latest run", detail:`Continue ${newest.name} from ${labelize(newest.status)}.`, href:`/forge/${newest.id}`, Icon:ArrowRight, color:"#22d3ee" },
    qaProjects.length
      ? { title:"Run QA checks", detail:`${qaProjects.length} project${qaProjects.length === 1 ? "" : "s"} waiting in QA.`, href:`/forge/${qaProjects[0].id}`, Icon:ShieldCheck, color:T.amb }
      : { title:"Keep QA lane clear", detail:"No active project is currently blocked in QA.", href:`/forge/${newest.id}`, Icon:CheckCircle2, color:T.grn },
    readyProjects.length
      ? { title:"Prepare deployment", detail:`${readyProjects.length} project${readyProjects.length === 1 ? " is" : "s are"} ready to deploy.`, href:`/forge/${readyProjects[0].id}`, Icon:Rocket, color:T.grn }
      : { title:"Move build forward", detail:buildProjects.length ? `${buildProjects.length} build lane project${buildProjects.length === 1 ? "" : "s"} need review.` : "Use the cockpit to push the next project through production.", href:`/forge/${newest.id}`, Icon:Code2, color:"#a78bfa" },
    { title:"Create new project", detail:`${activeProjects.length} active run${activeProjects.length === 1 ? "" : "s"} in Forge right now.`, href:"/forge/new", Icon:Plus, color:"#22d3ee" },
  ]
}

function metricColor(key: DashboardCardKey) {
  if (key === "ready-to-deploy") return T.grn
  if (key === "awaiting-qa" || key === "draft-builds") return T.amb
  if (key === "recent-activity") return "#cbd5e1"
  return "#38bdf8"
}

function statusTone(status: ForgeProjectStatus): "accent" | "good" | "warn" | "muted" {
  if (status === "archived") return "muted"
  if (status === "ready_to_deploy" || status === "deployed") return "good"
  if (status === "qa" || status === "client_review") return "warn"
  return "accent"
}

function priorityTone(priority: ForgePriority): "good" | "warn" | "muted" {
  if (priority === "high") return "warn"
  if (priority === "low") return "good"
  return "muted"
}

function toneColor(tone: "cyan" | "green" | "amber" | "violet") {
  if (tone === "green") return T.grn
  if (tone === "amber") return T.amb
  if (tone === "violet") return "#a78bfa"
  return "#22d3ee"
}

function stageToStatus(stage: string): ForgeProjectStatus | null {
  const normalized = stage.toLowerCase()
  if (normalized.includes("intake")) return "intake"
  if (normalized.includes("strategy")) return "strategy"
  if (normalized.includes("brief")) return "strategy"
  if (normalized.includes("site plan")) return "sitemap"
  if (normalized.includes("design token")) return "design"
  if (normalized.includes("code generation")) return "build"
  if (normalized.includes("copy generation")) return "copy"
  if (normalized.includes("seo") || normalized.includes("schema")) return "build"
  if (normalized.includes("internal critique")) return "qa"
  if (normalized.includes("design critique")) return "qa"
  if (normalized.includes("copy rewrite")) return "copy"
  if (normalized.includes("code repair")) return "qa"
  if (normalized.includes("final validation")) return "qa"
  if (normalized.includes("preview") || normalized.includes("export")) return "preview"
  if (normalized.includes("review")) return "client_review"
  if (normalized.includes("deploy")) return "ready_to_deploy"
  return null
}

function formatDate(value: Date | string | null) {
  if (!value) return "No date"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "No date"
  return date.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })
}

function formatCost(value: number) {
  return `$${value.toFixed(value >= 10 ? 2 : 4)}`
}

function labelize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}
