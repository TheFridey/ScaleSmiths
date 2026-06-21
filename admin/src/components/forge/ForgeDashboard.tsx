"use client"

import Link from "next/link"
import { Activity, CheckCircle2, Clock, FileText, Gauge, Plus, ShieldCheck, Target } from "lucide-react"
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

const CARD_ICONS = {
  "active-projects": Target,
  "draft-builds": FileText,
  "awaiting-qa": Clock,
  "ready-to-deploy": CheckCircle2,
  "integrations-health": ShieldCheck,
  "recent-activity": Activity,
}

const CARD_COLORS = {
  "active-projects": T.acc,
  "draft-builds": T.amb,
  "awaiting-qa": T.amb,
  "ready-to-deploy": T.grn,
  "integrations-health": T.acc,
  "recent-activity": T.t2,
}

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
  const cardValues: Record<(typeof FORGE_DASHBOARD_CARDS)[number]["key"], string> = {
    "active-projects": String(activeProjects.length),
    "draft-builds": String(projects.filter((project) => ["intake", "research", "strategy", "sitemap", "copy", "design", "build", "preview"].includes(project.status)).length),
    "awaiting-qa": String(projects.filter((project) => project.status === "qa").length),
    "ready-to-deploy": String(projects.filter((project) => project.status === "ready_to_deploy").length),
    "integrations-health": "Idle",
    "recent-activity": String(recentActivity.length),
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-dm text-[11px] font-semibold uppercase tracking-[.08em]" style={{ background:T.s2, borderColor:T.b1, color:T.t2 }}>
            <Gauge size={13} style={{ color:T.acc }} aria-hidden="true" />
            Private Engine
          </div>
          <h1 className="font-syne text-3xl font-extrabold tracking-tight">Forge</h1>
          <p className="mt-2 max-w-[760px] font-dm text-sm leading-relaxed" style={{ color:T.t2 }}>
            Forge is the internal ScaleSmiths AI website production engine for taking client intake through research, sitemap, copy, design direction, builds, QA, and deployment readiness.
          </p>
        </div>
        <Link href="/forge/new" className="inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 font-dm text-sm font-medium text-white" style={{ background:T.acc }}>
          <Plus size={15} aria-hidden="true" /> New Project
        </Link>
      </div>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {FORGE_DASHBOARD_CARDS.map((card) => {
          const Icon = CARD_ICONS[card.key]
          const color = CARD_COLORS[card.key]

          return (
            <article key={card.key} className="min-h-[154px] rounded-xl border p-5" style={{ background:T.s1, borderColor:T.b1 }}>
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-dm text-sm font-semibold">{card.label}</h2>
                  <p className="mt-1 font-dm text-xs leading-relaxed" style={{ color:T.t2 }}>{card.note}</p>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border" style={{ background:T.s2, borderColor:T.b2 }}>
                  <Icon size={17} style={{ color }} aria-hidden="true" />
                </div>
              </div>
              <div className="font-syne text-2xl font-extrabold" style={{ color }}>{cardValues[card.key]}</div>
            </article>
          )
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_.8fr]">
        <div className="rounded-xl border p-6" style={{ background:T.s1, borderColor:T.b1 }}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-syne text-lg font-bold">Forge Projects</h2>
              <p className="mt-1 font-dm text-sm" style={{ color:T.t2 }}>Internal production runs from intake to deployment readiness.</p>
            </div>
            <span className="rounded-lg border px-2.5 py-1 font-dm text-[11px]" style={{ background:T.s2, borderColor:T.b1, color:T.t2 }}>{projects.length} total</span>
          </div>

          {projects.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8" style={{ borderColor:T.b2, background:T.s2 }}>
              <Target size={22} className="mb-4 text-acc" aria-hidden="true" />
              <h3 className="font-syne text-xl font-bold">No Forge projects yet</h3>
              <p className="mt-2 max-w-[560px] font-dm text-sm leading-relaxed" style={{ color:T.t2 }}>
                Create the first project to start capturing intake, project memory, production tasks, artifacts, integration settings, and activity logs.
              </p>
              <Link href="/forge/new" className="mt-5 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 font-dm text-sm font-medium text-white" style={{ background:T.acc }}>
                <Plus size={15} aria-hidden="true" /> Create Project
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border" style={{ borderColor:T.b1 }}>
              <div className="grid gap-3 border-b px-4 py-3" style={{ gridTemplateColumns:"1.4fr 1fr .75fr .75fr .75fr", borderColor:T.b1, background:T.s2 }}>
                {["Project", "Business", "Stage", "Priority", "Updated"].map((heading) => (
                  <div key={heading} className="font-dm text-[11px] font-semibold uppercase tracking-[.07em]" style={{ color:T.t2 }}>{heading}</div>
                ))}
              </div>
              {projects.map((project, index) => (
                <Link
                  key={project.id}
                  href={`/forge/${project.id}`}
                  className="grid items-center gap-3 px-4 py-4 transition-colors hover:bg-[var(--s2)]"
                  style={{ gridTemplateColumns:"1.4fr 1fr .75fr .75fr .75fr", borderBottom:index < projects.length - 1 ? `1px solid ${T.b1}` : "none" }}
                >
                  <div className="min-w-0">
                    <div className="truncate font-dm text-sm font-semibold">{project.name}</div>
                    <div className="truncate font-dm text-[11px]" style={{ color:T.t2 }}>{project.websiteUrl ?? "No website set"}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-dm text-sm">{project.businessName}</div>
                    <div className="truncate font-dm text-[11px]" style={{ color:T.t2 }}>{project.industry ?? "No industry"}</div>
                  </div>
                  <Badge value={labelize(project.status)} tone={project.status === "archived" ? "muted" : project.status === "ready_to_deploy" ? "good" : "accent"} />
                  <Badge value={project.priority} tone={project.priority === "high" ? "warn" : project.priority === "low" ? "good" : "muted"} />
                  <div className="font-dm text-xs" style={{ color:T.t2 }}>{formatDate(project.updatedAt)}</div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border p-6" style={{ background:T.s1, borderColor:T.b1 }}>
            <h2 className="font-syne text-lg font-bold">Production Pipeline</h2>
            <p className="mt-1 font-dm text-sm" style={{ color:T.t2 }}>Stage markers are ready for each Forge project run.</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {FORGE_WORKFLOW_STAGES.map((stage, index) => (
                <div key={stage} className="rounded-lg border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-syne text-sm font-bold" style={{ color:T.t1 }}>{String(index + 1).padStart(2, "0")}</span>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background:T.t3 }} aria-hidden="true" />
                  </div>
                  <div className="font-dm text-xs" style={{ color:T.t2 }}>{stage}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border p-6" style={{ background:T.s1, borderColor:T.b1 }}>
            <h2 className="font-syne text-lg font-bold">Recent Activity</h2>
            <div className="mt-4 space-y-3">
              {recentActivity.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 font-dm text-sm" style={{ borderColor:T.b2, color:T.t2 }}>No Forge activity has been logged yet.</div>
              ) : recentActivity.map((activity) => (
                <div key={activity.id} className="rounded-lg border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-dm text-xs font-semibold">{labelize(activity.action)}</div>
                    <div className="font-dm text-[11px]" style={{ color:T.t3 }}>{formatDate(activity.createdAt)}</div>
                  </div>
                  <p className="mt-1 font-dm text-xs leading-relaxed" style={{ color:T.t2 }}>{activity.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function Badge({ value, tone }: { value: string; tone: "accent" | "good" | "warn" | "muted" }) {
  const color = tone === "good" ? T.grn : tone === "warn" ? T.amb : tone === "accent" ? T.acc : T.t2

  return (
    <span className="inline-flex w-fit rounded px-2 py-0.5 font-dm text-[10px] font-semibold uppercase tracking-[.05em]" style={{ background:T.s2, border:`1px solid ${T.b2}`, color }}>
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
