"use client"

import { Children, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import {
  Activity,
  Archive,
  Bot,
  Box,
  Brain,
  ChevronLeft,
  Code2,
  FileText,
  Gauge,
  Globe2,
  Link2,
  ListChecks,
  Monitor,
  Rocket,
  Settings2,
  ShieldCheck,
  Target,
  Workflow,
} from "lucide-react"
import { ForgeArtifactTabs } from "./ForgeArtifactTabs"
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
import { ForgeQaPanel } from "./ForgeQaPanel"
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

type ProjectTab = "command" | "intake" | "strategy" | "build" | "qa" | "launch" | "records"
type IntakePane = "brief" | "settings"
type StrategyPane = "research" | "sitemap" | "copy" | "design" | "spec"
type BuildPane = "workspace" | "integrations" | "generate" | "seo"
type QaPane = "checks" | "visual"
type LaunchPane = "proposal" | "export" | "deploy"
type RecordsPane = "tasks" | "activity" | "memory" | "integrations" | "details"

const TABS: Array<{ key: ProjectTab; label: string; Icon: LucideIcon }> = [
  { key: "command", label: "Command", Icon: Bot },
  { key: "intake", label: "Intake", Icon: Target },
  { key: "strategy", label: "Strategy", Icon: Workflow },
  { key: "build", label: "Build", Icon: Code2 },
  { key: "qa", label: "QA", Icon: ShieldCheck },
  { key: "launch", label: "Launch", Icon: Rocket },
  { key: "records", label: "Records", Icon: FileText },
]

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
  const [activeTab, setActiveTab] = useState<ProjectTab>("command")
  const [intakePane, setIntakePane] = useState<IntakePane>("brief")
  const [strategyPane, setStrategyPane] = useState<StrategyPane>("research")
  const [buildPane, setBuildPane] = useState<BuildPane>("workspace")
  const [qaPane, setQaPane] = useState<QaPane>("checks")
  const [launchPane, setLaunchPane] = useState<LaunchPane>("proposal")
  const [recordsPane, setRecordsPane] = useState<RecordsPane>("tasks")
  const projectId = project.id ?? 0
  const archived = project.status === "archived"
  const stages = useMemo(
    () => buildStageTimeline({
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
    }),
    [artifacts, initialCopy, initialDeploy, initialDesign, initialGeneratedCode, initialIntake, initialPreview, initialQa, initialSitemap, integrations, tasks],
  )
  const completedStages = stages.filter((stage) => stage.status === "approved" || stage.status === "complete").length
  const activeTasks = tasks.filter((task) => task.status === "queued" || task.status === "running")
  const failedTasks = tasks.filter((task) => task.status === "failed")

  return (
    <div
      className="mx-auto flex h-[calc(100vh-1rem)] max-w-[1600px] flex-col overflow-hidden rounded-[8px] border sm:h-[calc(100vh-1.5rem)] lg:h-[calc(100vh-2.5rem)]"
      style={{
        borderColor: "rgba(56,189,248,.18)",
        background: "linear-gradient(135deg, #070b13 0%, #0b1020 48%, #060b10 100%)",
        boxShadow: "0 24px 80px rgba(0,0,0,.34)",
      }}
    >
      <header className="flex h-[58px] shrink-0 items-center justify-between gap-3 border-b px-3 sm:px-4" style={{ borderColor:"rgba(148,163,184,.14)" }}>
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/forge" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border" style={{ background:"rgba(15,23,42,.72)", borderColor:"rgba(148,163,184,.16)", color:"#cbd5e1" }} aria-label="Back to Forge projects">
            <ChevronLeft size={17} aria-hidden="true" />
          </Link>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate font-syne text-base font-extrabold text-white sm:text-lg">{project.name}</h1>
              <div className="hidden shrink-0 items-center gap-2 sm:flex">
                <Badge value={labelize(project.status ?? "intake")} tone={archived ? "muted" : project.status === "ready_to_deploy" ? "good" : "accent"} />
                <Badge value={project.priority} tone={project.priority === "high" ? "warn" : project.priority === "low" ? "good" : "muted"} />
              </div>
            </div>
            <p className="truncate font-dm text-xs" style={{ color:"#94a3b8" }}>{project.businessName} / {project.industry ?? "No industry set"}</p>
          </div>
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <HeaderSignal icon={Gauge} label={`${completedStages}/${stages.length} ready`} tone={completedStages === stages.length ? "green" : "cyan"} />
          <HeaderSignal icon={ListChecks} label={`${activeTasks.length} active tasks`} tone="violet" />
          <HeaderSignal icon={Activity} label={`${failedTasks.length} failed`} tone={failedTasks.length ? "amber" : "green"} />
        </div>

        {archived && (
          <div className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 font-dm text-xs font-semibold" style={{ background:T.s2, borderColor:T.b1, color:T.t2 }}>
            <Archive size={14} aria-hidden="true" />
            Archived
          </div>
        )}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)_420px]">
        <aside className="hidden min-h-0 flex-col border-r p-4 lg:flex" style={{ borderColor:"rgba(148,163,184,.14)" }}>
          <ProjectSummary project={project} completedStages={completedStages} totalStages={stages.length} />
          <div className="mt-4 min-h-0 flex-1 overflow-auto rounded-[8px] border" style={{ background:T.s1, borderColor:T.b1 }}>
            <div className="sticky top-0 z-10 flex h-11 items-center gap-2 border-b px-3" style={{ borderColor:T.b1, background:T.s1 }}>
              <Workflow size={15} style={{ color:"#22d3ee" }} aria-hidden="true" />
              <h2 className="font-dm text-sm font-semibold">Production Stages</h2>
            </div>
            <div className="space-y-2 p-3">
              {stages.map((stage, index) => (
                <button
                  key={stage.label}
                  type="button"
                  onClick={() => setActiveTab(stage.tab)}
                  className="group w-full rounded-[8px] border p-3 text-left transition-colors hover:bg-[rgba(56,189,248,.045)]"
                  style={{ background:T.s2, borderColor:activeTab === stage.tab ? "rgba(56,189,248,.45)" : T.b1 }}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="font-syne text-xs font-extrabold" style={{ color:T.t2 }}>{String(index + 1).padStart(2, "0")}</span>
                      <span className="truncate font-dm text-sm font-semibold">{stage.label}</span>
                    </div>
                    <StageBadge status={stage.status} />
                  </div>
                  <p className="line-clamp-2 font-dm text-[11px] leading-4" style={{ color:T.t2 }}>{stage.detail}</p>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="flex min-h-0 flex-col p-3 sm:p-4">
          <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-dm text-[11px] font-semibold uppercase tracking-[.22em]" style={{ color:"#7dd3fc" }}>Project Cockpit</p>
              <h2 className="font-syne text-xl font-extrabold text-white">{tabTitle(activeTab)}</h2>
            </div>
            <div className="flex max-w-full overflow-x-auto rounded-full border p-1" style={{ background:"rgba(15,23,42,.72)", borderColor:"rgba(148,163,184,.16)" }}>
              {TABS.map(({ key, label, Icon }) => {
                const active = activeTab === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key)}
                    className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3 font-dm text-xs font-semibold transition-colors"
                    style={{ background:active ? "#f8fafc" : "transparent", color:active ? "#06121f" : "#94a3b8" }}
                  >
                    <Icon size={14} aria-hidden="true" />
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <section className="min-h-0 flex-1 overflow-hidden rounded-[8px] border" style={{ background:T.s1, borderColor:T.b1 }}>
            <div className="h-full overflow-auto p-3 sm:p-4">
              {activeTab === "command" && (
                <TabGrid>
                  <ForgeCommandChatPanel projectId={projectId} initialChat={initialCommandChat} disabled={archived} />
                  <ForgeArtifactTabs artifacts={artifacts} />
                </TabGrid>
              )}

              {activeTab === "intake" && (
                <SectionDeck
                  options={[
                    { key: "brief", label: "Brief", Icon: FileText },
                    { key: "settings", label: "Settings", Icon: Settings2 },
                  ]}
                  active={intakePane}
                  onChange={setIntakePane}
                >
                  {intakePane === "brief" && <ForgeIntakeForm projectId={projectId} initialIntake={initialIntake} />}
                  {intakePane === "settings" && (
                    <Panel title="Project Settings" icon={Settings2}>
                      <ForgeProjectForm mode="edit" project={project} />
                    </Panel>
                  )}
                </SectionDeck>
              )}

              {activeTab === "strategy" && (
                <SectionDeck
                  options={[
                    { key: "research", label: "Research", Icon: Brain },
                    { key: "sitemap", label: "Sitemap", Icon: Workflow },
                    { key: "copy", label: "Copy", Icon: FileText },
                    { key: "design", label: "Design", Icon: Monitor },
                    { key: "spec", label: "Spec", Icon: Box },
                  ]}
                  active={strategyPane}
                  onChange={setStrategyPane}
                >
                  {strategyPane === "research" && <ForgeResearchActions projectId={projectId} disabled={archived} />}
                  {strategyPane === "sitemap" && <ForgeSitemapStrategyPanel projectId={projectId} initialState={initialSitemap} disabled={archived} />}
                  {strategyPane === "copy" && <ForgeCopyPanel projectId={projectId} initialState={initialCopy} sitemapState={initialSitemap} disabled={archived} />}
                  {strategyPane === "design" && <ForgeDesignDirectionPanel projectId={projectId} initialState={initialDesign} copyState={initialCopy} disabled={archived} />}
                  {strategyPane === "spec" && <ForgeComponentSpecPanel projectId={projectId} initialState={initialComponentSpec} designState={initialDesign} disabled={archived} />}
                </SectionDeck>
              )}

              {activeTab === "build" && (
                <SectionDeck
                  options={[
                    { key: "workspace", label: "Workspace", Icon: Box },
                    { key: "integrations", label: "Integrations", Icon: Link2 },
                    { key: "generate", label: "Generate", Icon: Code2 },
                    { key: "seo", label: "SEO", Icon: Globe2 },
                  ]}
                  active={buildPane}
                  onChange={setBuildPane}
                >
                  {buildPane === "workspace" && <ForgeWorkspacePanel projectId={projectId} initialWorkspace={initialWorkspace} disabled={archived} />}
                  {buildPane === "integrations" && (
                    <TabGrid>
                      <ForgeResendConfigPanel projectId={projectId} initialConfig={initialResendConfig} disabled={archived} />
                      <ForgeWhatsAppConfigPanel projectId={projectId} initialConfig={initialWhatsAppConfig} disabled={archived} />
                    </TabGrid>
                  )}
                  {buildPane === "generate" && (
                    <ForgeGenerateSitePanel
                      projectId={projectId}
                      initialWorkspace={initialWorkspace}
                      componentSpecState={initialComponentSpec}
                      initialGeneratedCode={initialGeneratedCode}
                      disabled={archived}
                    />
                  )}
                  {buildPane === "seo" && <ForgeSeoPanel projectId={projectId} initialSeo={initialSeo} sitemapState={initialSitemap} copyState={initialCopy} disabled={archived} />}
                </SectionDeck>
              )}

              {activeTab === "qa" && (
                <SectionDeck
                  options={[
                    { key: "checks", label: "Checks", Icon: ShieldCheck },
                    { key: "visual", label: "Visual QA", Icon: Monitor },
                  ]}
                  active={qaPane}
                  onChange={setQaPane}
                >
                  {qaPane === "checks" && <ForgeQaPanel projectId={projectId} initialWorkspace={initialWorkspace} initialGeneratedCode={initialGeneratedCode} initialQa={initialQa} disabled={archived} />}
                  {qaPane === "visual" && <ForgeVisualQaPanel projectId={projectId} initialWorkspace={initialWorkspace} initialGeneratedCode={initialGeneratedCode} initialVisualQa={initialVisualQa} disabled={archived} />}
                </SectionDeck>
              )}

              {activeTab === "launch" && (
                <SectionDeck
                  options={[
                    { key: "proposal", label: "Proposal", Icon: FileText },
                    { key: "export", label: "Export", Icon: Archive },
                    { key: "deploy", label: "Deploy", Icon: Rocket },
                  ]}
                  active={launchPane}
                  onChange={setLaunchPane}
                >
                  {launchPane === "proposal" && <ForgeProposalPanel projectId={projectId} initialProposal={initialProposal} intakeReady={(initialIntake.completenessScore ?? 0) > 0} disabled={archived} />}
                  {launchPane === "export" && (
                    <ForgeExportPanel
                      projectId={projectId}
                      initialExport={initialExport}
                      siteReady={initialGeneratedCode.status === "generated"}
                      proposalReady={initialProposal.status === "generated"}
                      disabled={archived}
                    />
                  )}
                  {launchPane === "deploy" && <ForgeDeployPanel projectId={projectId} initialDeploy={initialDeploy} siteReady={initialGeneratedCode.status === "generated"} disabled={archived} />}
                </SectionDeck>
              )}

              {activeTab === "records" && (
                <SectionDeck
                  options={[
                    { key: "tasks", label: "Tasks", Icon: ListChecks },
                    { key: "activity", label: "Activity", Icon: Activity },
                    { key: "memory", label: "Memory", Icon: Brain },
                    { key: "integrations", label: "Integrations", Icon: Link2 },
                    { key: "details", label: "Details", Icon: Box },
                  ]}
                  active={recordsPane}
                  onChange={setRecordsPane}
                >
                  {recordsPane === "tasks" && <Panel title="Tasks" icon={ListChecks}><TaskList rows={tasks} /></Panel>}
                  {recordsPane === "activity" && <Panel title="Activity Log" icon={Activity}><ActivityList rows={activityLogs} /></Panel>}
                  {recordsPane === "memory" && <Panel title="Project Memory" icon={Brain}><MemoryList rows={memories} /></Panel>}
                  {recordsPane === "integrations" && <Panel title="Integrations" icon={Link2}><IntegrationList rows={integrations} /></Panel>}
                  {recordsPane === "details" && <Panel title="Core Details" icon={Box}><DetailGrid project={project} /></Panel>}
                </SectionDeck>
              )}
            </div>
          </section>
        </main>

        <aside className="hidden min-h-0 border-l p-4 2xl:block" style={{ borderColor:"rgba(148,163,184,.14)" }}>
          <div className="h-full overflow-auto">
            <ForgePreviewRail
              projectId={projectId}
              initialWorkspace={initialWorkspace}
              initialGeneratedCode={initialGeneratedCode}
              initialPreview={initialPreview}
              disabled={archived}
            />
          </div>
        </aside>
      </div>
    </div>
  )
}

type CockpitStageStatus = "approved" | "needs_review" | "failed" | "running" | "complete"

interface CockpitStage {
  label: string
  status: CockpitStageStatus
  detail: string
  tab: ProjectTab
}

function ProjectSummary({ project, completedStages, totalStages }: { project: ForgeProjectFormValue; completedStages: number; totalStages: number }) {
  return (
    <section className="relative shrink-0 overflow-hidden rounded-[8px] border p-4" style={{ background:"rgba(2,6,23,.58)", borderColor:"rgba(56,189,248,.18)" }}>
      <GridWash />
      <div className="relative">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="font-dm text-[11px] font-semibold uppercase tracking-[.22em]" style={{ color:"#7dd3fc" }}>Live Run</p>
            <h2 className="mt-1 truncate font-syne text-2xl font-extrabold leading-none text-white">{project.businessName}</h2>
          </div>
          <Monitor size={20} style={{ color:"#22d3ee" }} aria-hidden="true" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Metric label="Ready" value={`${completedStages}/${totalStages}`} tone={completedStages === totalStages ? "green" : "cyan"} />
          <Metric label="Priority" value={project.priority} tone={project.priority === "high" ? "amber" : "violet"} />
          <Metric label="Status" value={labelize(project.status ?? "intake")} tone="cyan" />
        </div>
        <div className="mt-3 grid gap-2">
          <MiniDetail icon={Globe2} label="Website" value={project.websiteUrl ?? "No website set"} />
          <MiniDetail icon={Target} label="Goal" value={project.primaryGoal ?? "No goal set"} />
        </div>
      </div>
    </section>
  )
}

function HeaderSignal({ icon: Icon, label, tone }: { icon: LucideIcon; label: string; tone: "cyan" | "green" | "amber" | "violet" }) {
  return (
    <div className="inline-flex h-8 items-center gap-2 rounded-full border px-3" style={{ background:"rgba(15,23,42,.7)", borderColor:"rgba(148,163,184,.16)" }}>
      <Icon size={13} style={{ color:toneColor(tone) }} aria-hidden="true" />
      <span className="font-dm text-[11px] font-semibold" style={{ color:"#cbd5e1" }}>{label}</span>
    </div>
  )
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone: "cyan" | "green" | "amber" | "violet" }) {
  return (
    <div className="rounded-[8px] border p-3" style={{ background:"rgba(15,23,42,.64)", borderColor:"rgba(148,163,184,.14)" }}>
      <div className="font-dm text-[10px] font-semibold uppercase tracking-[.1em]" style={{ color:"#94a3b8" }}>{label}</div>
      <div className="mt-1 truncate font-syne text-lg font-extrabold" style={{ color:toneColor(tone) }}>{value}</div>
    </div>
  )
}

function MiniDetail({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-[8px] border px-3 py-2" style={{ background:"rgba(15,23,42,.54)", borderColor:"rgba(148,163,184,.14)" }}>
      <Icon size={13} style={{ color:"#94a3b8" }} aria-hidden="true" />
      <span className="shrink-0 font-dm text-[11px]" style={{ color:"#64748b" }}>{label}</span>
      <span className="truncate font-dm text-[11px]" style={{ color:"#cbd5e1" }}>{value}</span>
    </div>
  )
}

function TabGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-2">
      {Children.map(children, (child, index) => (
        <div key={index} className="min-w-0">
          {child}
        </div>
      ))}
    </div>
  )
}

function SectionDeck<T extends string>({
  options,
  active,
  onChange,
  children,
}: {
  options: Array<{ key: T; label: string; Icon: LucideIcon }>
  active: T
  onChange: (value: T) => void
  children: ReactNode
}) {
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex max-w-full overflow-x-auto rounded-[8px] border p-1" style={{ background:T.s2, borderColor:T.b1 }}>
        {options.map(({ key, label, Icon }) => {
          const selected = active === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-[7px] px-3 font-dm text-xs font-semibold transition-colors"
              style={{ background:selected ? "#f8fafc" : "transparent", color:selected ? "#06121f" : T.t2 }}
            >
              <Icon size={14} aria-hidden="true" />
              {label}
            </button>
          )
        })}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function Panel({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <section className="rounded-[8px] border p-4" style={{ background:T.s1, borderColor:T.b1 }}>
      <div className="mb-4 flex items-center gap-2">
        <Icon size={16} style={{ color:"#38bdf8" }} aria-hidden="true" />
        <h2 className="font-syne text-lg font-bold">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function DetailGrid({ project }: { project: ForgeProjectFormValue }) {
  const rows: [string, string][] = [
    ["Business", project.businessName],
    ["Industry", project.industry ?? "Not set"],
    ["Website", project.websiteUrl ?? "Not set"],
    ["Audience", project.targetAudience ?? "Not set"],
    ["Goal", project.primaryGoal ?? "Not set"],
    ["Budget", project.budgetRange ?? "Not set"],
    ["Deadline", formatDate(project.deadline)],
    ["Brand notes", project.brandNotes ?? "Not set"],
  ]

  return (
    <div className="grid gap-2">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-[8px] border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
          <div className="font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>{label}</div>
          <div className="mt-1 whitespace-pre-wrap font-dm text-sm leading-relaxed" style={{ color:T.t1 }}>{value}</div>
        </div>
      ))}
    </div>
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
      status: intake.status === "completed" ? "approved" : (intake.completenessScore ?? 0) > 0 ? "needs_review" : stageTaskStatus(tasks, ["intake"], "needs_review"),
      detail: `${intake.completenessScore ?? 0}% complete`,
      tab: "intake",
    },
    {
      label: "Research",
      status: stageArtifactStatus(tasks, artifacts, ["research"], ["research_report"]),
      detail: "Business and market research",
      tab: "strategy",
    },
    {
      label: "Strategy",
      status: sitemap.status === "approved" ? "approved" : sitemap.status === "draft" ? "needs_review" : stageTaskStatus(tasks, ["strategy", "sitemap"], "needs_review"),
      detail: "Sitemap and page strategy",
      tab: "strategy",
    },
    {
      label: "Copy",
      status: copy.status === "approved" ? "approved" : copy.status === "draft" ? "needs_review" : stageTaskStatus(tasks, ["copy"], "needs_review"),
      detail: "SEO copy and page content",
      tab: "strategy",
    },
    {
      label: "Design",
      status: design.status === "approved" ? "approved" : design.status === "draft" ? "needs_review" : stageTaskStatus(tasks, ["design"], "needs_review"),
      detail: "Style, motion, and component direction",
      tab: "strategy",
    },
    {
      label: "Build",
      status: generatedCode.status === "generated" ? "complete" : stageTaskStatus(tasks, ["frontend"], "needs_review"),
      detail: generatedCode.summary ? `${generatedCode.summary.fileCount} generated files` : "Generated site workspace",
      tab: "build",
    },
    {
      label: "QA",
      status: qa.status === "passed" ? "complete" : qa.status === "failed" ? "failed" : stageTaskStatus(tasks, ["qa", "repair"], "needs_review"),
      detail: qa.report ? `${qa.report.commands.length} checks` : "Build and repair checks",
      tab: "qa",
    },
    {
      label: "Integrations",
      status: integrations.some((integration) => integration.enabled) ? "complete" : stageTaskStatus(tasks, ["integration"], "needs_review"),
      detail: `${integrations.filter((integration) => integration.enabled).length} enabled`,
      tab: "build",
    },
    {
      label: "Preview",
      status: preview?.status === "running" ? "running" : preview?.status === "failed" ? "failed" : generatedCode.status === "generated" ? "complete" : "needs_review",
      detail: preview?.url ?? "No active preview",
      tab: "build",
    },
    {
      label: "Launch",
      status: deploy.lifecycle === "deployed" ? "complete" : deploy.ready ? "approved" : stageTaskStatus(tasks, ["deploy"], "needs_review"),
      detail: deploy.lifecycle === "deployed" ? "Deployed" : deploy.ready ? "Ready to deploy" : "Deployment checklist",
      tab: "launch",
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

function StageBadge({ status }: { status: CockpitStageStatus }) {
  const color = status === "approved" || status === "complete" ? T.grn : status === "failed" ? T.red : status === "running" ? "#38bdf8" : T.amb
  return (
    <span className="inline-flex w-fit rounded-full px-2 py-0.5 font-dm text-[9px] font-semibold uppercase tracking-[.05em]" style={{ background:T.s2, border:`1px solid ${T.b2}`, color }}>
      {status.replace("_", " ")}
    </span>
  )
}

function TaskList({ rows }: { rows: ForgeTaskRow[] }) {
  if (rows.length === 0) return <Empty icon={ListChecks} text="No production tasks have been queued yet." />
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.id} className="rounded-[8px] border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
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

function ActivityList({ rows }: { rows: ForgeActivityRow[] }) {
  if (rows.length === 0) return <Empty icon={Activity} text="No actions have been logged for this project." />
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.id} className="rounded-[8px] border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
          <div className="flex items-center justify-between gap-3">
            <div className="truncate font-dm text-xs font-semibold">{labelize(row.action)}</div>
            <div className="shrink-0 font-dm text-[11px]" style={{ color:T.t3 }}>{formatDate(row.createdAt)}</div>
          </div>
          <p className="mt-1 line-clamp-2 font-dm text-xs leading-relaxed" style={{ color:T.t2 }}>{row.message}</p>
          <div className="mt-2 font-dm text-[11px]" style={{ color:T.t3 }}>{row.actor ?? "admin"}</div>
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
        <div key={row.id} className="rounded-[8px] border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
          <div className="font-dm text-sm font-semibold">{row.key}</div>
          <p className="mt-1 line-clamp-3 font-dm text-xs leading-relaxed" style={{ color:T.t2 }}>{row.value}</p>
          <div className="mt-2 font-dm text-[11px]" style={{ color:T.t3 }}>{row.source ?? "manual"} / {formatDate(row.updatedAt)}</div>
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
        <div key={row.id} className="rounded-[8px] border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
          <div className="flex items-center justify-between gap-3">
            <div className="font-dm text-sm font-semibold">{labelize(row.provider)}</div>
            <Badge value={row.enabled ? "Enabled" : "Disabled"} tone={row.enabled ? "good" : "muted"} />
          </div>
          <pre className="mt-2 max-h-40 overflow-auto rounded border p-2 font-mono text-[11px]" style={{ background:T.s3, borderColor:T.b1, color:T.t2 }}>
            {JSON.stringify(redactIntegrationConfig(row.configJson), null, 2)}
          </pre>
        </div>
      ))}
    </div>
  )
}

function Empty({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="rounded-[8px] border border-dashed p-4" style={{ background:T.s2, borderColor:T.b2 }}>
      <Icon size={16} className="mb-3 text-acc" aria-hidden="true" />
      <p className="font-dm text-sm" style={{ color:T.t2 }}>{text}</p>
    </div>
  )
}

function Badge({ value, tone }: { value: string; tone: "accent" | "good" | "warn" | "bad" | "muted" }) {
  const color = tone === "good" ? T.grn : tone === "warn" ? T.amb : tone === "bad" ? T.red : tone === "accent" ? "#38bdf8" : T.t2

  return (
    <span className="inline-flex w-fit rounded-full px-2 py-0.5 font-dm text-[10px] font-semibold uppercase tracking-[.05em]" style={{ background:T.s2, border:`1px solid ${T.b2}`, color }}>
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

function tabTitle(tab: ProjectTab) {
  if (tab === "command") return "Command & Artifacts"
  if (tab === "intake") return "Intake & Settings"
  if (tab === "strategy") return "Strategy, Copy & Design"
  if (tab === "build") return "Build & Integrations"
  if (tab === "qa") return "QA & Repair"
  if (tab === "launch") return "Proposal, Export & Deploy"
  return "Project Records"
}

function toneColor(tone: "cyan" | "green" | "amber" | "violet") {
  if (tone === "green") return T.grn
  if (tone === "amber") return T.amb
  if (tone === "violet") return "#a78bfa"
  return "#22d3ee"
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
