"use client"

import Link from "next/link"
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock,
  Cpu,
  FileText,
  Gauge,
  Layers3,
  Plus,
  Radio,
  ShieldCheck,
  Sparkles,
  Target,
  TerminalSquare,
  Workflow,
  Zap,
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
  acc: "var(--acc)",
  grn: "var(--grn)",
  amb: "var(--amb)",
  red: "var(--red)",
}

type DashboardCardKey = (typeof FORGE_DASHBOARD_CARDS)[number]["key"]

const CARD_ICONS = {
  "active-projects": Target,
  "draft-builds": FileText,
  "awaiting-qa": Clock,
  "ready-to-deploy": CheckCircle2,
  "integrations-health": ShieldCheck,
  "recent-activity": Activity,
} satisfies Record<DashboardCardKey, typeof Target>

const CARD_COLORS = {
  "active-projects": "#38bdf8",
  "draft-builds": "#a78bfa",
  "awaiting-qa": T.amb,
  "ready-to-deploy": T.grn,
  "integrations-health": "#22d3ee",
  "recent-activity": "#cbd5e1",
} satisfies Record<DashboardCardKey, string>

const WORKFLOW_ICONS = [Radio, Sparkles, Target, Workflow, FileText, Layers3, Cpu, ShieldCheck, Gauge, TerminalSquare, Zap, CheckCircle2]

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

export function ForgeDashboard({ projects, recentActivity }: { projects: ForgeProjectSummary[]; recentActivity: ForgeActivitySummary[] }) {
  const activeProjects = projects.filter((project) => project.status !== "archived")
  const readyProjects = projects.filter((project) => project.status === "ready_to_deploy")
  const qaProjects = projects.filter((project) => project.status === "qa")
  const buildProjects = projects.filter((project) => ["build", "preview", "integrations"].includes(project.status))
  const urgentProjects = projects.filter((project) => project.priority === "high" && project.status !== "archived")
  const cardValues: Record<DashboardCardKey, string> = {
    "active-projects": String(activeProjects.length),
    "draft-builds": String(projects.filter((project) => ["intake", "research", "strategy", "sitemap", "copy", "design", "build", "preview"].includes(project.status)).length),
    "awaiting-qa": String(qaProjects.length),
    "ready-to-deploy": String(readyProjects.length),
    "integrations-health": "Idle",
    "recent-activity": String(recentActivity.length),
  }
  const newestProject = projects[0]
  const latestActivity = recentActivity[0]
  const stageMap = new Map<ForgeProjectStatus, number>()
  for (const project of activeProjects) {
    stageMap.set(project.status, (stageMap.get(project.status) ?? 0) + 1)
  }
  const activityDensity = recentActivity.length > 0 ? `${recentActivity.length} signals` : "Quiet"

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <section
        className="relative overflow-hidden rounded-[8px] border"
        style={{
          borderColor: "rgba(56, 189, 248, 0.18)",
          background:
            "linear-gradient(135deg, #080d18 0%, #0a1020 42%, #071015 100%)",
          boxShadow: "0 24px 80px rgba(0, 0, 0, 0.32)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "linear-gradient(rgba(148,163,184,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.06) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "linear-gradient(to bottom, black, transparent 86%)",
          }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(56,189,248,.65), transparent)" }}
          aria-hidden="true"
        />

        <div className="relative grid gap-8 p-5 sm:p-7 xl:grid-cols-[1.1fr_.9fr] xl:p-8">
          <div className="flex min-h-[430px] flex-col justify-between gap-8">
            <div>
              <div className="mb-7 flex flex-wrap items-center gap-3">
                <StatusPill icon={Radio} label="Private production engine" value={activityDensity} tone="cyan" />
                <StatusPill icon={ShieldCheck} label="Auth gated" value="Admin only" tone="green" />
                <StatusPill icon={Cpu} label="Runtime" value="PM2 live" tone="violet" />
              </div>

              <div className="max-w-[820px]">
                <div className="mb-4 flex items-center gap-3">
                  <div className="h-px w-10" style={{ background: "rgba(56,189,248,.6)" }} aria-hidden="true" />
                  <p className="font-dm text-[11px] font-semibold uppercase tracking-[.42em]" style={{ color: "#93c5fd" }}>
                    ScaleSmiths Digital Forge V1.0
                  </p>
                </div>
                <h1 className="font-syne text-[clamp(2.6rem,6vw,6.2rem)] font-extrabold leading-[.9] tracking-normal text-white">
                  Build Once.
                  <span className="block" style={{ color: "#22d3ee" }}>Launch Sharper.</span>
                </h1>
                <p className="mt-6 max-w-[670px] font-dm text-base leading-7" style={{ color: "#b8c3d7" }}>
                  A private command centre for turning intake, research, copy, design, QA, exports, and deployment readiness into controlled production runs.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <HeroMetric label="Active Projects" value={activeProjects.length} detail={urgentProjects.length ? `${urgentProjects.length} high priority` : "No urgent flags"} tone="cyan" />
              <HeroMetric label="Build Lane" value={buildProjects.length} detail="Build, preview, integrations" tone="violet" />
              <HeroMetric label="Ready / QA" value={`${readyProjects.length}/${qaProjects.length}`} detail="Deploy ready / awaiting QA" tone="green" />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-[8px] border p-4" style={{ background: "rgba(2, 6, 23, .62)", borderColor: "rgba(148,163,184,.18)" }}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-dm text-[11px] font-semibold uppercase tracking-[.22em]" style={{ color: "#7dd3fc" }}>App Preview</p>
                  <h2 className="mt-1 font-syne text-xl font-extrabold text-white">Production Cockpit</h2>
                </div>
                <Link
                  href="/forge/new"
                  className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 font-dm text-sm font-bold text-[#06121f] transition-transform hover:-translate-y-0.5"
                  style={{ background: "linear-gradient(135deg, #f8fafc, #67e8f9)" }}
                >
                  <Plus size={16} aria-hidden="true" />
                  New Project
                </Link>
              </div>

              <div className="relative overflow-hidden rounded-[8px] border" style={{ borderColor: "rgba(56,189,248,.18)", background: "#050914" }}>
                <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "rgba(148,163,184,.14)" }}>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" aria-hidden="true" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" aria-hidden="true" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#38bdf8]" aria-hidden="true" />
                  </div>
                  <p className="font-dm text-[10px] font-semibold uppercase tracking-[.24em]" style={{ color: "#64748b" }}>
                    live queue
                  </p>
                </div>
                <div className="grid gap-3 p-4 sm:grid-cols-[.95fr_1.05fr]">
                  <div className="space-y-3">
                    <PreviewTile icon={Gauge} label="Current Run" value={newestProject?.name ?? "No active run"} subvalue={newestProject ? labelize(newestProject.status) : "Create a project to begin"} tone="cyan" />
                    <PreviewTile icon={Activity} label="Latest Signal" value={latestActivity ? labelize(latestActivity.action) : "No activity"} subvalue={latestActivity?.message ?? "Activity logs will appear here"} tone="green" />
                  </div>
                  <div className="rounded-[8px] border p-4" style={{ borderColor: "rgba(148,163,184,.14)", background: "linear-gradient(180deg, rgba(15,23,42,.72), rgba(2,6,23,.72))" }}>
                    <div className="mb-4 flex items-center justify-between">
                      <p className="font-dm text-xs font-semibold text-white">Stage Pressure</p>
                      <TerminalSquare size={16} style={{ color: "#38bdf8" }} aria-hidden="true" />
                    </div>
                    <div className="space-y-2">
                      {(["intake", "copy", "build", "qa", "ready_to_deploy"] as ForgeProjectStatus[]).map((status) => {
                        const count = stageMap.get(status) ?? 0
                        const width = activeProjects.length ? Math.max(8, Math.round((count / activeProjects.length) * 100)) : 8

                        return (
                          <div key={status} className="grid grid-cols-[92px_1fr_24px] items-center gap-2">
                            <span className="truncate font-dm text-[11px]" style={{ color: "#94a3b8" }}>{labelize(status)}</span>
                            <span className="h-1.5 overflow-hidden rounded-full bg-white/10">
                              <span className="block h-full rounded-full bg-[#22d3ee]" style={{ width: `${width}%` }} />
                            </span>
                            <span className="text-right font-dm text-[11px] text-white">{count}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <section className="grid gap-2 sm:grid-cols-3">
              {FORGE_DASHBOARD_CARDS.slice(0, 6).map((card) => {
                const Icon = CARD_ICONS[card.key]
                const color = CARD_COLORS[card.key]

                return (
                  <article key={card.key} className="rounded-[8px] border p-3" style={{ background: "rgba(15, 23, 42, .46)", borderColor: "rgba(148,163,184,.14)" }}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <Icon size={15} style={{ color }} aria-hidden="true" />
                      <span className="font-syne text-lg font-extrabold" style={{ color }}>{cardValues[card.key]}</span>
                    </div>
                    <h2 className="truncate font-dm text-xs font-semibold text-white">{card.label}</h2>
                    <p className="mt-1 line-clamp-2 font-dm text-[11px] leading-4" style={{ color: "#94a3b8" }}>{card.note}</p>
                  </article>
                )
              })}
            </section>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.45fr_.75fr]">
        <div className="rounded-[8px] border" style={{ background:T.s1, borderColor:T.b1 }}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5" style={{ borderColor:T.b1 }}>
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Layers3 size={17} style={{ color:"#38bdf8" }} aria-hidden="true" />
                <h2 className="font-syne text-xl font-extrabold">Forge Projects</h2>
              </div>
              <p className="font-dm text-sm" style={{ color:T.t2 }}>Live production runs from intake to deployment readiness.</p>
            </div>
            <span className="rounded-full border px-3 py-1.5 font-dm text-[11px] font-semibold uppercase tracking-[.08em]" style={{ background:T.s2, borderColor:T.b1, color:T.t2 }}>{projects.length} total</span>
          </div>

          {projects.length === 0 ? (
            <div className="p-5">
              <div className="rounded-[8px] border border-dashed p-8" style={{ borderColor:T.b2, background:T.s2 }}>
                <Target size={22} className="mb-4 text-acc" aria-hidden="true" />
                <h3 className="font-syne text-xl font-bold">No Forge projects yet</h3>
                <p className="mt-2 max-w-[560px] font-dm text-sm leading-relaxed" style={{ color:T.t2 }}>
                  Create the first project to start capturing intake, project memory, production tasks, artifacts, integration settings, and activity logs.
                </p>
                <Link href="/forge/new" className="mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 font-dm text-sm font-bold text-white" style={{ background:T.acc }}>
                  <Plus size={15} aria-hidden="true" /> Create Project
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="hidden overflow-hidden md:block">
                <div className="grid gap-3 border-b px-5 py-3" style={{ gridTemplateColumns:"1.35fr 1fr .85fr .7fr .7fr 32px", borderColor:T.b1, background:T.s2 }}>
                  {["Project", "Business", "Stage", "Priority", "Updated", ""].map((heading) => (
                    <div key={heading || "open"} className="font-dm text-[11px] font-semibold uppercase tracking-[.1em]" style={{ color:T.t2 }}>{heading}</div>
                  ))}
                </div>
                {projects.map((project, index) => (
                  <Link
                    key={project.id}
                    href={`/forge/${project.id}`}
                    className="grid items-center gap-3 px-5 py-4 transition-colors hover:bg-[rgba(56,189,248,.045)]"
                    style={{ gridTemplateColumns:"1.35fr 1fr .85fr .7fr .7fr 32px", borderBottom:index < projects.length - 1 ? `1px solid ${T.b1}` : "none" }}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-dm text-sm font-semibold">{project.name}</div>
                      <div className="truncate font-dm text-[11px]" style={{ color:T.t2 }}>{project.websiteUrl ?? "No website set"}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-dm text-sm">{project.businessName}</div>
                      <div className="truncate font-dm text-[11px]" style={{ color:T.t2 }}>{project.industry ?? "No industry"}</div>
                    </div>
                    <Badge value={labelize(project.status)} tone={project.status === "archived" ? "muted" : project.status === "ready_to_deploy" ? "good" : project.status === "qa" ? "warn" : "accent"} />
                    <Badge value={project.priority} tone={project.priority === "high" ? "warn" : project.priority === "low" ? "good" : "muted"} />
                    <div className="font-dm text-xs" style={{ color:T.t2 }}>{formatDate(project.updatedAt)}</div>
                    <ArrowRight size={16} style={{ color:T.t3 }} aria-hidden="true" />
                  </Link>
                ))}
              </div>

              <div className="grid gap-3 p-4 md:hidden">
                {projects.map((project) => (
                  <Link key={project.id} href={`/forge/${project.id}`} className="rounded-[8px] border p-4" style={{ background:T.s2, borderColor:T.b1 }}>
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-dm text-sm font-semibold">{project.name}</div>
                        <div className="truncate font-dm text-[11px]" style={{ color:T.t2 }}>{project.businessName}</div>
                      </div>
                      <ArrowRight size={16} style={{ color:T.t3 }} aria-hidden="true" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge value={labelize(project.status)} tone={project.status === "ready_to_deploy" ? "good" : project.status === "qa" ? "warn" : "accent"} />
                      <Badge value={project.priority} tone={project.priority === "high" ? "warn" : project.priority === "low" ? "good" : "muted"} />
                      <span className="font-dm text-[11px]" style={{ color:T.t2 }}>{formatDate(project.updatedAt)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="space-y-5">
          <div className="rounded-[8px] border p-5" style={{ background:T.s1, borderColor:T.b1 }}>
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Workflow size={17} style={{ color:"#a78bfa" }} aria-hidden="true" />
                  <h2 className="font-syne text-lg font-extrabold">Production Pipeline</h2>
                </div>
                <p className="font-dm text-sm" style={{ color:T.t2 }}>Stage markers across every Forge project run.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {FORGE_WORKFLOW_STAGES.map((stage, index) => {
                const Icon = WORKFLOW_ICONS[index % WORKFLOW_ICONS.length]

                return (
                  <div key={stage} className="rounded-[8px] border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
                    <div className="mb-3 flex items-center justify-between">
                      <span className="font-syne text-sm font-extrabold" style={{ color:T.t1 }}>{String(index + 1).padStart(2, "0")}</span>
                      <Icon size={14} style={{ color:index < 6 ? "#38bdf8" : "#94a3b8" }} aria-hidden="true" />
                    </div>
                    <div className="font-dm text-xs leading-4" style={{ color:T.t2 }}>{stage}</div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="rounded-[8px] border p-5" style={{ background:T.s1, borderColor:T.b1 }}>
            <div className="mb-4 flex items-center gap-2">
              <Activity size={17} style={{ color:T.grn }} aria-hidden="true" />
              <h2 className="font-syne text-lg font-extrabold">Recent Activity</h2>
            </div>
            <div className="space-y-3">
              {recentActivity.length === 0 ? (
                <div className="rounded-[8px] border border-dashed p-4 font-dm text-sm" style={{ borderColor:T.b2, color:T.t2 }}>No Forge activity has been logged yet.</div>
              ) : recentActivity.map((activity) => (
                <div key={activity.id} className="rounded-[8px] border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="truncate font-dm text-xs font-semibold">{labelize(activity.action)}</div>
                    <div className="shrink-0 font-dm text-[11px]" style={{ color:T.t3 }}>{formatDate(activity.createdAt)}</div>
                  </div>
                  <p className="mt-1 line-clamp-2 font-dm text-xs leading-relaxed" style={{ color:T.t2 }}>{activity.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function StatusPill({ icon: Icon, label, value, tone }: { icon: typeof Gauge; label: string; value: string; tone: "cyan" | "green" | "violet" }) {
  const color = tone === "green" ? T.grn : tone === "violet" ? "#a78bfa" : "#22d3ee"

  return (
    <div className="inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1.5" style={{ background:"rgba(15,23,42,.72)", borderColor:"rgba(148,163,184,.18)" }}>
      <Icon size={14} style={{ color }} aria-hidden="true" />
      <span className="font-dm text-[11px] font-semibold uppercase tracking-[.08em]" style={{ color:"#cbd5e1" }}>{label}</span>
      <span className="hidden font-dm text-[11px] sm:inline" style={{ color:"#64748b" }}>-</span>
      <span className="font-dm text-[11px]" style={{ color }}>{value}</span>
    </div>
  )
}

function HeroMetric({ label, value, detail, tone }: { label: string; value: number | string; detail: string; tone: "cyan" | "green" | "violet" }) {
  const color = tone === "green" ? T.grn : tone === "violet" ? "#a78bfa" : "#22d3ee"

  return (
    <div className="rounded-[8px] border p-4" style={{ background:"rgba(15,23,42,.58)", borderColor:"rgba(148,163,184,.14)" }}>
      <div className="font-dm text-[11px] font-semibold uppercase tracking-[.12em]" style={{ color:"#94a3b8" }}>{label}</div>
      <div className="mt-2 font-syne text-3xl font-extrabold" style={{ color }}>{value}</div>
      <div className="mt-1 truncate font-dm text-xs" style={{ color:"#cbd5e1" }}>{detail}</div>
    </div>
  )
}

function PreviewTile({ icon: Icon, label, value, subvalue, tone }: { icon: typeof Gauge; label: string; value: string; subvalue: string; tone: "cyan" | "green" }) {
  const color = tone === "green" ? T.grn : "#22d3ee"

  return (
    <div className="rounded-[8px] border p-4" style={{ background:"rgba(15,23,42,.72)", borderColor:"rgba(148,163,184,.14)" }}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="font-dm text-[11px] font-semibold uppercase tracking-[.12em]" style={{ color:"#94a3b8" }}>{label}</span>
        <Icon size={15} style={{ color }} aria-hidden="true" />
      </div>
      <div className="truncate font-dm text-sm font-semibold text-white">{value}</div>
      <p className="mt-1 line-clamp-2 font-dm text-xs leading-5" style={{ color:"#94a3b8" }}>{subvalue}</p>
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

function formatDate(value: Date | string | null) {
  if (!value) return "No date"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "No date"
  return date.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })
}

function labelize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}
