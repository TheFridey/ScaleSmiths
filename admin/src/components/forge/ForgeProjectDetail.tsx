"use client"

import Link from "next/link"
import { Activity, Archive, Box, Brain, ChevronLeft, Link2, ListChecks } from "lucide-react"
import { ForgeArtifactTabs } from "./ForgeArtifactTabs"
import { ForgeBuildLogsDrawer } from "./ForgeBuildLogsDrawer"
import { ForgeIntakeForm, type ForgeIntakeState } from "./ForgeIntakeForm"
import { ForgeProjectForm, type ForgeProjectFormValue } from "./ForgeProjectForm"
import { ForgeComponentSpecPanel } from "./ForgeComponentSpecPanel"
import { ForgeCommandChatPanel } from "./ForgeCommandChatPanel"
import { ForgeCopyPanel } from "./ForgeCopyPanel"
import { ForgeDesignDirectionPanel } from "./ForgeDesignDirectionPanel"
import { ForgeGenerateSitePanel } from "./ForgeGenerateSitePanel"
import { ForgeDeployPanel } from "./ForgeDeployPanel"
import { ForgeExportPanel } from "./ForgeExportPanel"
import { ForgePreviewRail } from "./ForgePreviewRail"
import { ForgeProposalPanel } from "./ForgeProposalPanel"
import { ForgeResendConfigPanel } from "./ForgeResendConfigPanel"
import { ForgeResearchActions } from "./ForgeResearchActions"
import { ForgeSeoPanel } from "./ForgeSeoPanel"
import { ForgeSitemapStrategyPanel } from "./ForgeSitemapStrategyPanel"
import { ForgeVisualQaPanel } from "./ForgeVisualQaPanel"
import { ForgeWhatsAppConfigPanel } from "./ForgeWhatsAppConfigPanel"
import { ForgeWorkspacePanel } from "./ForgeWorkspacePanel"
import { redactIntegrationConfig, type ForgeArtifactType, type ForgeIntegrationProvider, type ForgeTaskAgentType, type ForgeTaskStatus } from "@/lib/forge"
import type { ForgeComponentSpecArtifactState } from "@/lib/forge-component-spec"
import type { ForgeCommandChatState } from "@/lib/forge-command-chat"
import type { ForgeCopyArtifactState } from "@/lib/forge-copy"
import type { ForgeDesignArtifactState } from "@/lib/forge-design"
import type { ForgeGeneratedCodeArtifactState } from "@/lib/forge-frontend-code"
import type { ForgePreviewState } from "@/lib/forge-preview"
import type { ForgeQaArtifactState } from "@/lib/forge-qa"
import type { ForgeSeoArtifactState } from "@/lib/forge-seo"
import type { ForgeVisualQaArtifactState } from "@/lib/forge-visual-qa"
import type { ForgeProposalArtifactState } from "@/lib/forge-proposal"
import type { ForgeExportArtifactState } from "@/lib/forge-export"
import type { ForgeDeployArtifactState } from "@/lib/forge-deploy"
import type { ForgeResendConfig } from "@/lib/forge-resend"
import type { ForgeSitemapArtifactState } from "@/lib/forge-sitemap"
import type { ForgeWhatsAppConfig } from "@/lib/forge-whatsapp"
import type { ForgeWorkspaceMetadata } from "@/lib/forge-workspace"

const T = { s1:"var(--s1)", s2:"var(--s2)", s3:"var(--s3)", b1:"var(--b1)", b2:"var(--b2)", t1:"var(--t1)", t2:"var(--t2)", t3:"var(--t3)", acc:"var(--acc)", grn:"var(--grn)", amb:"var(--amb)", red:"var(--red)" }

interface ForgeTaskRow {
  id: number
  title: string
  description: string | null
  agentType: ForgeTaskAgentType
  status: ForgeTaskStatus
  createdAt: Date | string
}

interface ForgeArtifactRow {
  id: number
  type: ForgeArtifactType
  title: string
  content: string | null
  createdAt: Date | string
}

interface ForgeIntegrationRow {
  id: number
  provider: ForgeIntegrationProvider
  configJson: Record<string, unknown> | null
  enabled: boolean
  updatedAt: Date | string
}

interface ForgeActivityRow {
  id: number
  actor: string | null
  action: string
  message: string
  createdAt: Date | string
}

interface ForgeMemoryRow {
  id: number
  key: string
  value: string
  source: string | null
  updatedAt: Date | string
}

export function ForgeProjectDetail({
  project,
  tasks,
  artifacts,
  integrations,
  activityLogs,
  memories,
  initialIntake,
  initialSitemap,
  initialCopy,
  initialDesign,
  initialComponentSpec,
  initialWorkspace,
  initialGeneratedCode,
  initialPreview,
  initialQa,
  initialSeo,
  initialVisualQa,
  initialProposal,
  initialExport,
  initialDeploy,
  initialCommandChat,
  initialResendConfig,
  initialWhatsAppConfig,
}: {
  project: ForgeProjectFormValue
  tasks: ForgeTaskRow[]
  artifacts: ForgeArtifactRow[]
  integrations: ForgeIntegrationRow[]
  activityLogs: ForgeActivityRow[]
  memories: ForgeMemoryRow[]
  initialIntake: ForgeIntakeState
  initialSitemap: ForgeSitemapArtifactState
  initialCopy: ForgeCopyArtifactState
  initialDesign: ForgeDesignArtifactState
  initialComponentSpec: ForgeComponentSpecArtifactState
  initialWorkspace: ForgeWorkspaceMetadata | null
  initialGeneratedCode: ForgeGeneratedCodeArtifactState
  initialPreview: ForgePreviewState | null
  initialQa: ForgeQaArtifactState
  initialSeo: ForgeSeoArtifactState
  initialVisualQa: ForgeVisualQaArtifactState
  initialProposal: ForgeProposalArtifactState
  initialExport: ForgeExportArtifactState
  initialDeploy: ForgeDeployArtifactState
  initialCommandChat: ForgeCommandChatState
  initialResendConfig: ForgeResendConfig
  initialWhatsAppConfig: ForgeWhatsAppConfig
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/forge" className="mb-3 inline-flex items-center gap-1.5 font-dm text-xs" style={{ color:T.t2 }}>
            <ChevronLeft size={13} aria-hidden="true" /> Forge Projects
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-syne text-3xl font-extrabold tracking-tight">{project.name}</h1>
            <Badge value={labelize(project.status ?? "intake")} tone={project.status === "archived" ? "muted" : project.status === "ready_to_deploy" ? "good" : "accent"} />
            <Badge value={project.priority} tone={project.priority === "high" ? "warn" : project.priority === "low" ? "good" : "muted"} />
          </div>
          <p className="mt-1 font-dm text-sm" style={{ color:T.t2 }}>{project.businessName} / {project.industry ?? "No industry set"}</p>
        </div>
        {project.status === "archived" && (
          <div className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 font-dm text-sm" style={{ background:T.s2, borderColor:T.b1, color:T.t2 }}>
            <Archive size={14} aria-hidden="true" /> Archived
          </div>
        )}
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[260px_minmax(0,1fr)_380px] 2xl:grid-cols-[280px_minmax(0,1fr)_460px]">
        <aside className="space-y-4 xl:sticky xl:top-4">
          <StageSidebar
            project={project}
            stages={buildStageTimeline({
              intake: initialIntake,
              sitemap: initialSitemap,
              copy: initialCopy,
              design: initialDesign,
              generatedCode: initialGeneratedCode,
              qa: initialQa,
              preview: initialPreview,
              deploy: initialDeploy,
              tasks,
              artifacts,
              integrations,
            })}
          />
          <Panel title="Core Details" icon={Box}>
            <DetailGrid rows={[
              ["Business", project.businessName],
              ["Industry", project.industry ?? "Not set"],
              ["Website", project.websiteUrl ?? "Not set"],
              ["Audience", project.targetAudience ?? "Not set"],
              ["Goal", project.primaryGoal ?? "Not set"],
              ["Budget", project.budgetRange ?? "Not set"],
              ["Deadline", formatDate(project.deadline)],
              ["Brand notes", project.brandNotes ?? "Not set"],
            ]} />
          </Panel>
          <ForgeProjectForm mode="edit" project={project} />
        </aside>

        <main className="min-w-0 space-y-4">
          <ForgeCommandChatPanel projectId={project.id ?? 0} initialChat={initialCommandChat} disabled={project.status === "archived"} />
          <ForgeArtifactTabs artifacts={artifacts} />

          <section className="space-y-4">
            <div className="rounded-xl border p-4" style={{ background:T.s1, borderColor:T.b1 }}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-syne text-lg font-bold">Production Workstream</h2>
                  <p className="mt-1 font-dm text-sm" style={{ color:T.t2 }}>Run and review the core Forge pipeline without leaving the cockpit.</p>
                </div>
                <StatusBadge value="needs review" status="needs_review" />
              </div>
            </div>
            <ForgeIntakeForm projectId={project.id ?? 0} initialIntake={initialIntake} />
            <ForgeResearchActions projectId={project.id ?? 0} disabled={project.status === "archived"} />
            <ForgeSitemapStrategyPanel projectId={project.id ?? 0} initialState={initialSitemap} disabled={project.status === "archived"} />
            <ForgeCopyPanel projectId={project.id ?? 0} initialState={initialCopy} sitemapState={initialSitemap} disabled={project.status === "archived"} />
            <ForgeDesignDirectionPanel projectId={project.id ?? 0} initialState={initialDesign} copyState={initialCopy} disabled={project.status === "archived"} />
            <ForgeComponentSpecPanel projectId={project.id ?? 0} initialState={initialComponentSpec} designState={initialDesign} disabled={project.status === "archived"} />
            <ForgeWorkspacePanel projectId={project.id ?? 0} initialWorkspace={initialWorkspace} disabled={project.status === "archived"} />
            <ForgeResendConfigPanel projectId={project.id ?? 0} initialConfig={initialResendConfig} disabled={project.status === "archived"} />
            <ForgeWhatsAppConfigPanel projectId={project.id ?? 0} initialConfig={initialWhatsAppConfig} disabled={project.status === "archived"} />
            <ForgeGenerateSitePanel
              projectId={project.id ?? 0}
              initialWorkspace={initialWorkspace}
              componentSpecState={initialComponentSpec}
              initialGeneratedCode={initialGeneratedCode}
              disabled={project.status === "archived"}
            />
            <ForgeSeoPanel
              projectId={project.id ?? 0}
              initialSeo={initialSeo}
              sitemapState={initialSitemap}
              copyState={initialCopy}
              disabled={project.status === "archived"}
            />
            <ForgeVisualQaPanel
              projectId={project.id ?? 0}
              initialWorkspace={initialWorkspace}
              initialGeneratedCode={initialGeneratedCode}
              initialVisualQa={initialVisualQa}
              disabled={project.status === "archived"}
            />
            <ForgeProposalPanel
              projectId={project.id ?? 0}
              initialProposal={initialProposal}
              intakeReady={(initialIntake.completenessScore ?? 0) > 0}
              disabled={project.status === "archived"}
            />
            <ForgeExportPanel
              projectId={project.id ?? 0}
              initialExport={initialExport}
              siteReady={initialGeneratedCode.status === "generated"}
              proposalReady={initialProposal.status === "generated"}
              disabled={project.status === "archived"}
            />
            <ForgeDeployPanel
              projectId={project.id ?? 0}
              initialDeploy={initialDeploy}
              siteReady={initialGeneratedCode.status === "generated"}
              disabled={project.status === "archived"}
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Panel title="Tasks" icon={ListChecks}>
              <TaskList rows={tasks} />
            </Panel>
            <Panel title="Activity Log" icon={Activity}>
              <ActivityList rows={activityLogs} />
            </Panel>
            <Panel title="Project Memory" icon={Brain}>
              <MemoryList rows={memories} />
            </Panel>
            <Panel title="Integrations" icon={Link2}>
              <IntegrationList rows={integrations} />
            </Panel>
          </section>
        </main>

        <ForgePreviewRail
          projectId={project.id ?? 0}
          initialWorkspace={initialWorkspace}
          initialGeneratedCode={initialGeneratedCode}
          initialPreview={initialPreview}
          disabled={project.status === "archived"}
        />
      </div>

      <ForgeBuildLogsDrawer
        projectId={project.id ?? 0}
        initialWorkspace={initialWorkspace}
        initialGeneratedCode={initialGeneratedCode}
        initialQa={initialQa}
        disabled={project.status === "archived"}
      />
    </div>
  )
}

type CockpitStageStatus = "approved" | "needs_review" | "failed" | "running" | "complete"

interface CockpitStage {
  label: string
  status: CockpitStageStatus
  detail: string
}

function StageSidebar({ project, stages }: { project: ForgeProjectFormValue; stages: CockpitStage[] }) {
  const completed = stages.filter((stage) => stage.status === "approved" || stage.status === "complete").length
  return (
    <section className="rounded-xl border p-4" style={{ background:T.s1, borderColor:T.b1 }}>
      <div className="mb-4">
        <div className="font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Project cockpit</div>
        <h2 className="mt-1 font-syne text-lg font-bold">{project.businessName}</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <StatusBadge value={project.status ?? "intake"} status={project.status === "archived" ? "failed" : "running"} />
          <StatusBadge value={`${completed}/${stages.length} ready`} status={completed === stages.length ? "complete" : "needs_review"} />
        </div>
      </div>
      <div className="space-y-2">
        {stages.map((stage) => (
          <div key={stage.label} className="rounded-lg border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
            <div className="flex items-center justify-between gap-2">
              <div className="font-dm text-sm font-semibold" style={{ color:T.t1 }}>{stage.label}</div>
              <StatusBadge value={stage.status.replace("_", " ")} status={stage.status} />
            </div>
            <p className="mt-1 font-dm text-[11px] leading-relaxed" style={{ color:T.t2 }}>{stage.detail}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function buildStageTimeline({
  intake,
  sitemap,
  copy,
  design,
  generatedCode,
  qa,
  preview,
  deploy,
  tasks,
  artifacts,
  integrations,
}: {
  intake: ForgeIntakeState
  sitemap: ForgeSitemapArtifactState
  copy: ForgeCopyArtifactState
  design: ForgeDesignArtifactState
  generatedCode: ForgeGeneratedCodeArtifactState
  qa: ForgeQaArtifactState
  preview: ForgePreviewState | null
  deploy: ForgeDeployArtifactState
  tasks: ForgeTaskRow[]
  artifacts: ForgeArtifactRow[]
  integrations: ForgeIntegrationRow[]
}): CockpitStage[] {
  return [
    {
      label: "Intake",
      status: intake.status === "completed" ? "approved" : intake.completenessScore > 0 ? "needs_review" : stageTaskStatus(tasks, ["intake"], "needs_review"),
      detail: `${intake.completenessScore}% complete`,
    },
    {
      label: "Research",
      status: stageArtifactStatus(tasks, artifacts, ["research"], ["research_report"]),
      detail: "Business and market research",
    },
    {
      label: "Strategy",
      status: sitemap.status === "approved" ? "approved" : sitemap.status === "draft" ? "needs_review" : stageTaskStatus(tasks, ["strategy", "sitemap"], "needs_review"),
      detail: "Sitemap and page strategy",
    },
    {
      label: "Copy",
      status: copy.status === "approved" ? "approved" : copy.status === "draft" ? "needs_review" : stageTaskStatus(tasks, ["copy"], "needs_review"),
      detail: "SEO copy and page content",
    },
    {
      label: "Design",
      status: design.status === "approved" ? "approved" : design.status === "draft" ? "needs_review" : stageTaskStatus(tasks, ["design"], "needs_review"),
      detail: "Style, motion, and component direction",
    },
    {
      label: "Build",
      status: generatedCode.status === "generated" ? "complete" : stageTaskStatus(tasks, ["frontend"], "needs_review"),
      detail: generatedCode.summary ? `${generatedCode.summary.fileCount} generated files` : "Generated site workspace",
    },
    {
      label: "QA",
      status: qa.status === "passed" ? "complete" : qa.status === "failed" ? "failed" : stageTaskStatus(tasks, ["qa", "repair"], "needs_review"),
      detail: qa.report ? `${qa.report.commands.length} checks` : "Build and repair checks",
    },
    {
      label: "Integrations",
      status: integrations.some((integration) => integration.enabled) ? "complete" : stageTaskStatus(tasks, ["integration"], "needs_review"),
      detail: `${integrations.filter((integration) => integration.enabled).length} enabled`,
    },
    {
      label: "Preview",
      status: preview?.status === "running" ? "running" : preview?.status === "failed" ? "failed" : generatedCode.status === "generated" ? "complete" : "needs_review",
      detail: preview?.url ?? "No active preview",
    },
    {
      label: "Deploy",
      status: deploy.lifecycle === "deployed" ? "complete" : deploy.ready ? "approved" : stageTaskStatus(tasks, ["deploy"], "needs_review"),
      detail: deploy.lifecycle === "deployed" ? "Deployed" : deploy.ready ? "Ready to deploy" : "Deployment checklist",
    },
  ]
}

function stageArtifactStatus(tasks: ForgeTaskRow[], artifacts: ForgeArtifactRow[], agentTypes: ForgeTaskAgentType[], artifactTypes: ForgeArtifactType[]): CockpitStageStatus {
  const taskStatus = stageTaskStatus(tasks, agentTypes, "needs_review")
  if (taskStatus === "running" || taskStatus === "failed") return taskStatus
  return artifacts.some((artifact) => artifactTypes.includes(artifact.type)) ? "complete" : "needs_review"
}

function stageTaskStatus(tasks: ForgeTaskRow[], agentTypes: ForgeTaskAgentType[], fallback: CockpitStageStatus): CockpitStageStatus {
  const scoped = tasks.filter((task) => agentTypes.includes(task.agentType))
  if (scoped.some((task) => task.status === "failed")) return "failed"
  if (scoped.some((task) => task.status === "running" || task.status === "queued")) return "running"
  if (scoped.some((task) => task.status === "completed")) return "complete"
  return fallback
}

function StatusBadge({ value, status }: { value: string; status: CockpitStageStatus }) {
  const color = status === "approved" || status === "complete" ? T.grn : status === "failed" ? T.red : status === "running" ? T.acc : T.amb
  return (
    <span className="inline-flex w-fit rounded px-2 py-0.5 font-dm text-[10px] font-semibold uppercase tracking-[.05em]" style={{ background:T.s2, border:`1px solid ${T.b2}`, color }}>
      {value}
    </span>
  )
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof Activity; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border p-5" style={{ background:T.s1, borderColor:T.b1 }}>
      <div className="mb-4 flex items-center gap-2">
        <Icon size={16} style={{ color:T.acc }} aria-hidden="true" />
        <h2 className="font-syne text-lg font-bold">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function DetailGrid({ rows }: { rows: [string, string][] }) {
  return (
    <div className="grid gap-3">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-lg border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
          <div className="font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>{label}</div>
          <div className="mt-1 whitespace-pre-wrap font-dm text-sm leading-relaxed" style={{ color:T.t1 }}>{value}</div>
        </div>
      ))}
    </div>
  )
}

function MemoryList({ rows }: { rows: ForgeMemoryRow[] }) {
  if (rows.length === 0) return <Empty icon={Brain} text="No project memory has been captured yet." />
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.id} className="rounded-lg border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
          <div className="font-dm text-sm font-semibold">{row.key}</div>
          <p className="mt-1 font-dm text-xs leading-relaxed" style={{ color:T.t2 }}>{row.value}</p>
          <div className="mt-2 font-dm text-[11px]" style={{ color:T.t3 }}>{row.source ?? "manual"} / {formatDate(row.updatedAt)}</div>
        </div>
      ))}
    </div>
  )
}

function TaskList({ rows }: { rows: ForgeTaskRow[] }) {
  if (rows.length === 0) return <Empty icon={ListChecks} text="No production tasks have been queued yet." />
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.id} className="rounded-lg border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
          <div className="flex items-center justify-between gap-3">
            <div className="font-dm text-sm font-semibold">{row.title}</div>
            <Badge value={row.status} tone={row.status === "completed" ? "good" : row.status === "failed" ? "bad" : "accent"} />
          </div>
          <div className="mt-1 font-dm text-[11px]" style={{ color:T.t2 }}>{labelize(row.agentType)} / {formatDate(row.createdAt)}</div>
          {row.description && <p className="mt-2 font-dm text-xs leading-relaxed" style={{ color:T.t2 }}>{row.description}</p>}
        </div>
      ))}
    </div>
  )
}

function IntegrationList({ rows }: { rows: ForgeIntegrationRow[] }) {
  if (rows.length === 0) return <Empty icon={Link2} text="No integration configs are connected for this project." />
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.id} className="rounded-lg border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
          <div className="flex items-center justify-between gap-3">
            <div className="font-dm text-sm font-semibold">{labelize(row.provider)}</div>
            <Badge value={row.enabled ? "Enabled" : "Disabled"} tone={row.enabled ? "good" : "muted"} />
          </div>
          <pre className="mt-2 overflow-auto rounded border p-2 font-mono text-[11px]" style={{ background:T.s3, borderColor:T.b1, color:T.t2 }}>
            {JSON.stringify(redactIntegrationConfig(row.configJson), null, 2)}
          </pre>
        </div>
      ))}
    </div>
  )
}

function ActivityList({ rows }: { rows: ForgeActivityRow[] }) {
  if (rows.length === 0) return <Empty icon={Activity} text="No actions have been logged for this project." />
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.id} className="rounded-lg border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
          <div className="flex items-center justify-between gap-3">
            <div className="font-dm text-xs font-semibold">{labelize(row.action)}</div>
            <div className="font-dm text-[11px]" style={{ color:T.t3 }}>{formatDate(row.createdAt)}</div>
          </div>
          <p className="mt-1 font-dm text-xs leading-relaxed" style={{ color:T.t2 }}>{row.message}</p>
          <div className="mt-2 font-dm text-[11px]" style={{ color:T.t3 }}>{row.actor ?? "admin"}</div>
        </div>
      ))}
    </div>
  )
}

function Empty({ icon: Icon, text }: { icon: typeof Activity; text: string }) {
  return (
    <div className="rounded-lg border border-dashed p-4" style={{ background:T.s2, borderColor:T.b2 }}>
      <Icon size={16} className="mb-3 text-acc" aria-hidden="true" />
      <p className="font-dm text-sm" style={{ color:T.t2 }}>{text}</p>
    </div>
  )
}

function Badge({ value, tone }: { value: string; tone: "accent" | "good" | "warn" | "bad" | "muted" }) {
  const color = tone === "good" ? T.grn : tone === "warn" ? T.amb : tone === "bad" ? T.red : tone === "accent" ? T.acc : T.t2

  return (
    <span className="inline-flex w-fit rounded px-2 py-0.5 font-dm text-[10px] font-semibold uppercase tracking-[.05em]" style={{ background:T.s2, border:`1px solid ${T.b2}`, color }}>
      {value}
    </span>
  )
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "No date"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "No date"
  return date.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })
}

function labelize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}
