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
  DollarSign,
  Download,
  Eye,
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
import { ForgeCostQualityPanel } from "./ForgeCostQualityPanel"
import { ForgeCommandChatPanel } from "./ForgeCommandChatPanel"
import { ForgeCopyPanel } from "./ForgeCopyPanel"
import { ForgeDesignDirectionPanel } from "./ForgeDesignDirectionPanel"
import { ForgeGenerateSitePanel } from "./ForgeGenerateSitePanel"
import { ForgeDeployPanel } from "./ForgeDeployPanel"
import { ForgeEstimatorPanel, type ProjectEstimateSnapshot } from "./ForgeEstimatorPanel"
import { ForgeExportPanel } from "./ForgeExportPanel"
import { ForgePreviewRail } from "./ForgePreviewRail"
import { ForgeProposalPanel } from "./ForgeProposalPanel"
import { ForgeQaPanel } from "./ForgeQaPanel"
import { ForgeResendConfigPanel } from "./ForgeResendConfigPanel"
import { ForgeResearchActions } from "./ForgeResearchActions"
import { ForgeSeoPanel } from "./ForgeSeoPanel"
import { ForgeSitemapStrategyPanel } from "./ForgeSitemapStrategyPanel"
import { ForgeVisualCritiquePanel } from "./ForgeVisualCritiquePanel"
import { ForgeVisualQaPanel } from "./ForgeVisualQaPanel"
import { ForgeWhatsAppConfigPanel } from "./ForgeWhatsAppConfigPanel"
import { ForgeWorkspacePanel } from "./ForgeWorkspacePanel"
import { redactIntegrationConfig, type ForgeArtifactType, type ForgeIntegrationProvider, type ForgeTaskAgentType, type ForgeTaskStatus } from "@/lib/forge"
import type { ForgeTaskResultQuality } from "@/lib/forge-task-quality"
import type { ForgeComponentSpecArtifactState } from "@/lib/forge-component-spec"
import type { ForgeCommandChatState } from "@/lib/forge-command-chat"
import type { ForgeCopyArtifactState } from "@/lib/forge-copy"
import type { ForgeDesignArtifactState } from "@/lib/forge-design"
import type { ForgeGeneratedCodeArtifactState } from "@/lib/forge-frontend-code"
import type { ForgePreviewState } from "@/lib/forge-preview"
import type { ForgeQaArtifactState } from "@/lib/forge-qa"
import type { ForgeCostQualitySummary } from "@/lib/forge-cost-quality"
import type { ForgeSeoArtifactState } from "@/lib/forge-seo"
import type { ForgeVisualCritiqueArtifactState } from "@/lib/forge-visual-critique"
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
type QaPane = "critique" | "checks" | "visual" | "cost"
type LaunchPane = "proposal" | "estimate" | "export" | "deploy"
type RecordsPane = "tasks" | "activity" | "usage" | "memory" | "integrations" | "details"

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
  resultQuality: ForgeTaskResultQuality
  fallbackReason: string | null
  providerAttempted: string | null
  modelAttempted: string | null
  retryCount: number
  qualityScore: string | null
  downstreamAllowed: boolean
  humanApprovalRequired: boolean
  publicationBlocked: boolean
  qualityApprovedBy: string | null
  qualityApprovedAt: Date | string | null
  qualityApprovalReason: string | null
  createdAt: Date | string
}

interface ForgeProjectSidebarSummary {
  id: number
  name: string
  businessName: string
  status: ForgeProjectFormValue["status"]
  priority: ForgeProjectFormValue["priority"]
  updatedAt: Date | string
}

interface ForgeArtifactRow {
  id: number
  type: ForgeArtifactType
  title: string
  content: string | null
  metadataJson: Record<string, unknown> | null
  version: number
  parentArtifactId: number | null
  sourceTaskId: number | null
  provider: string | null
  model: string | null
  promptVersion: string
  schemaVersion: string
  upstreamArtifactIds: number[]
  outputHash: string
  qualityState: ForgeTaskResultQuality
  approvalState: string
  approvalHistory: Array<Record<string, unknown>>
  supersededAt: Date | string | null
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

interface ForgeAiUsageMetrics {
  totals: ForgeAiUsageSummary
  today: ForgeAiUsageSummary
  week: ForgeAiUsageSummary
  month: ForgeAiUsageSummary
  budget: {
    project: ForgeAiBudgetState
    monthly: ForgeAiBudgetState
  }
  recent: Array<{
    id: number
    taskId: number | null
    provider: string
    model: string
    promptTokens: number
    completionTokens: number
    totalTokens: number
    estimatedCost: number
    completedAt: Date | string
  }>
}

interface ForgeAiUsageSummary {
  requests: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  estimatedCost: number
}

interface ForgeAiBudgetState {
  limit: number | null
  used: number
  remaining: number | null
  ratio: number | null
  blocked: boolean
  warning: boolean
}

export function ForgeProjectDetail({
  project,
  projectSummaries,
  tasks,
  artifacts,
  integrations,
  activityLogs,
  memories,
  aiUsage,
  costQuality,
  initialIntake,
  initialSitemap,
  initialCopy,
  initialDesign,
  initialComponentSpec,
  initialWorkspace,
  initialGeneratedCode,
  initialVisualCritique,
  initialPreview,
  initialQa,
  initialSeo,
  initialVisualQa,
  initialProposal,
  latestEstimate,
  initialExport,
  initialDeploy,
  initialCommandChat,
  initialResendConfig,
  initialWhatsAppConfig,
}: {
  project: ForgeProjectFormValue
  projectSummaries: ForgeProjectSidebarSummary[]
  tasks: ForgeTaskRow[]
  artifacts: ForgeArtifactRow[]
  integrations: ForgeIntegrationRow[]
  activityLogs: ForgeActivityRow[]
  memories: ForgeMemoryRow[]
  aiUsage: ForgeAiUsageMetrics
  costQuality: ForgeCostQualitySummary
  initialIntake: ForgeIntakeState
  initialSitemap: ForgeSitemapArtifactState
  initialCopy: ForgeCopyArtifactState
  initialDesign: ForgeDesignArtifactState
  initialComponentSpec: ForgeComponentSpecArtifactState
  initialWorkspace: ForgeWorkspaceMetadata | null
  initialGeneratedCode: ForgeGeneratedCodeArtifactState
  initialVisualCritique: ForgeVisualCritiqueArtifactState
  initialPreview: ForgePreviewState | null
  initialQa: ForgeQaArtifactState
  initialSeo: ForgeSeoArtifactState
  initialVisualQa: ForgeVisualQaArtifactState
  initialProposal: ForgeProposalArtifactState
  latestEstimate: ProjectEstimateSnapshot | null
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
  const [qaPane, setQaPane] = useState<QaPane>("critique")
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
      visualCritique: initialVisualCritique,
      qa: initialQa,
      seo: initialSeo,
      preview: initialPreview,
      deploy: initialDeploy,
      tasks,
      artifacts,
    }),
    [artifacts, initialCopy, initialDeploy, initialDesign, initialGeneratedCode, initialIntake, initialPreview, initialQa, initialSeo, initialSitemap, initialVisualCritique, tasks],
  )
  const completedStages = stages.filter((stage) => stage.status === "approved" || stage.status === "complete").length
  const activeTasks = tasks.filter((task) => task.status === "queued" || task.status === "running")
  const failedTasks = tasks.filter((task) => task.status === "failed")
  const approvedFallbackTasks = tasks.filter((task) => task.resultQuality === "fallback" && task.qualityApprovedAt)
  const currentStep = resolveCurrentStep(stages)

  return (
    <div
      className="mx-auto flex h-[calc(100vh-1rem)] w-full max-w-none flex-col overflow-hidden rounded-[8px] border sm:h-[calc(100vh-1.5rem)] lg:h-[calc(100vh-2.5rem)]"
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
          <HeaderSignal icon={DollarSign} label={`${formatCost(costQuality.costSoFarUsd)} / ${costQuality.draft.label}`} tone={costQuality.draft.isDraft ? "amber" : "green"} />
        </div>

        {archived && (
          <div className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 font-dm text-xs font-semibold" style={{ background:T.s2, borderColor:T.b1, color:T.t2 }}>
            <Archive size={14} aria-hidden="true" />
            Archived
          </div>
        )}
      </header>
      {approvedFallbackTasks.length > 0 && <div className="shrink-0 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 font-dm text-xs text-amber-200"><strong>Fallback dependency warning:</strong> this project contains human-approved fallback output. Deployment remains subject to the recorded quality approval{approvedFallbackTasks.length > 1 ? "s" : ""}.</div>}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_380px]">
        <aside className="hidden min-h-0 flex-col border-r p-4 lg:flex" style={{ borderColor:"rgba(148,163,184,.14)" }}>
          <WorkspaceSidebar
            project={project}
            projects={projectSummaries}
            tasks={tasks}
            activityLogs={activityLogs}
            stages={stages}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            completedStages={completedStages}
          />
        </aside>

        <main className="flex min-h-0 flex-col p-3 sm:p-4">
          <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-dm text-[11px] font-semibold uppercase tracking-[.22em]" style={{ color:"#7dd3fc" }}>AI Build Workspace</p>
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

          <div className="mb-3 grid gap-3 xl:hidden">
            <MobileContextBar
              currentStep={currentStep}
              qaStatus={initialQa.status}
              cost={aiUsage.totals.estimatedCost}
              activeTasks={activeTasks.length}
              failedTasks={failedTasks.length}
            />
          </div>

          <section className="min-h-0 flex-1 overflow-hidden rounded-[8px] border" style={{ background:T.s1, borderColor:T.b1 }}>
            <div className="h-full overflow-auto p-3 sm:p-4">
              {activeTab === "command" && (
                <div className="grid gap-4">
                  <ForgeCommandChatPanel projectId={projectId} initialChat={initialCommandChat} disabled={archived} />
                  <ForgeArtifactTabs artifacts={artifacts} />
                </div>
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
                  {intakePane === "brief" && <ForgeIntakeForm projectId={projectId} initialIntake={initialIntake} websiteUrl={project.websiteUrl} />}
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
                    { key: "critique", label: "Critique", Icon: Eye },
                    { key: "checks", label: "Checks", Icon: ShieldCheck },
                    { key: "visual", label: "Visual QA", Icon: Monitor },
                    { key: "cost", label: "Cost / Quality", Icon: DollarSign },
                  ]}
                  active={qaPane}
                  onChange={setQaPane}
                >
                  {qaPane === "critique" && (
                    <ForgeVisualCritiquePanel
                      projectId={projectId}
                      initialDesign={initialDesign}
                      initialCopy={initialCopy}
                      initialComponentSpec={initialComponentSpec}
                      initialGeneratedCode={initialGeneratedCode}
                      initialCritique={initialVisualCritique}
                      disabled={archived}
                    />
                  )}
                  {qaPane === "checks" && <ForgeQaPanel projectId={projectId} initialWorkspace={initialWorkspace} initialGeneratedCode={initialGeneratedCode} initialVisualCritique={initialVisualCritique} initialQa={initialQa} disabled={archived} />}
                  {qaPane === "visual" && <ForgeVisualQaPanel projectId={projectId} initialWorkspace={initialWorkspace} initialGeneratedCode={initialGeneratedCode} initialVisualQa={initialVisualQa} disabled={archived} />}
                  {qaPane === "cost" && <ForgeCostQualityPanel costQuality={costQuality} />}
                </SectionDeck>
              )}

              {activeTab === "launch" && (
                <SectionDeck
                  options={[
                    { key: "proposal", label: "Proposal", Icon: FileText },
                    { key: "estimate", label: "Estimate", Icon: DollarSign },
                    { key: "export", label: "Export", Icon: Archive },
                    { key: "deploy", label: "Deploy", Icon: Rocket },
                  ]}
                  active={launchPane}
                  onChange={setLaunchPane}
                >
                  {launchPane === "proposal" && <ForgeProposalPanel projectId={projectId} initialProposal={initialProposal} intakeReady={(initialIntake.completenessScore ?? 0) > 0} disabled={archived} />}
                  {launchPane === "estimate" && <ForgeEstimatorPanel projectId={projectId} initialEstimate={latestEstimate} disabled={archived} />}
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
                    { key: "usage", label: "AI Usage", Icon: DollarSign },
                    { key: "memory", label: "Memory", Icon: Brain },
                    { key: "integrations", label: "Integrations", Icon: Link2 },
                    { key: "details", label: "Details", Icon: Box },
                  ]}
                  active={recordsPane}
                  onChange={setRecordsPane}
                >
                  {recordsPane === "tasks" && <Panel title="Tasks" icon={ListChecks}><TaskList rows={tasks} /></Panel>}
                  {recordsPane === "activity" && <Panel title="Activity Log" icon={Activity}><ActivityList rows={activityLogs} /></Panel>}
                  {recordsPane === "usage" && <Panel title="AI Usage" icon={DollarSign}><AiUsagePanel projectId={projectId} usage={aiUsage} /></Panel>}
                  {recordsPane === "memory" && <Panel title="Project Memory" icon={Brain}><MemoryList rows={memories} /></Panel>}
                  {recordsPane === "integrations" && <Panel title="Integrations" icon={Link2}><IntegrationList rows={integrations} /></Panel>}
                  {recordsPane === "details" && <Panel title="Core Details" icon={Box}><DetailGrid project={project} /></Panel>}
                </SectionDeck>
              )}
            </div>
          </section>
        </main>

        <aside className="hidden min-h-0 border-l p-4 xl:block" style={{ borderColor:"rgba(148,163,184,.14)" }}>
          <div className="h-full overflow-auto">
            <LiveContextRail
              stages={stages}
              activeTasks={activeTasks}
              failedTasks={failedTasks}
              artifacts={artifacts}
              design={initialDesign}
              qa={initialQa}
              generatedCode={initialGeneratedCode}
              aiUsage={aiUsage}
            />
            <div className="mt-4">
              <ForgePreviewRail
              projectId={projectId}
              initialWorkspace={initialWorkspace}
              initialGeneratedCode={initialGeneratedCode}
              initialPreview={initialPreview}
              disabled={archived}
              />
            </div>
          </div>
        </aside>
      </div>

      <StatusDock
        currentStep={currentStep}
        aiUsage={aiUsage}
        activeTasks={activeTasks}
        failedTasks={failedTasks}
        qa={initialQa}
        visualCritique={initialVisualCritique}
      />
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

function WorkspaceSidebar({
  project,
  projects,
  tasks,
  activityLogs,
  stages,
  activeTab,
  setActiveTab,
  completedStages,
}: {
  project: ForgeProjectFormValue
  projects: ForgeProjectSidebarSummary[]
  tasks: ForgeTaskRow[]
  activityLogs: ForgeActivityRow[]
  stages: CockpitStage[]
  activeTab: ProjectTab
  setActiveTab: (tab: ProjectTab) => void
  completedStages: number
}) {
  const visibleProjects = projects.length ? projects : [{
    id: project.id ?? 0,
    name: project.name,
    businessName: project.businessName,
    status: project.status,
    priority: project.priority,
    updatedAt: new Date().toISOString(),
  }]

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <ProjectSummary project={project} completedStages={completedStages} totalStages={stages.length} />

      <div className="min-h-0 flex-1 overflow-auto rounded-[8px] border" style={{ background:"rgba(2,6,23,.45)", borderColor:"rgba(148,163,184,.14)" }}>
        <SidebarBlock title="Projects" icon={Box}>
          <div className="space-y-2">
            {visibleProjects.slice(0, 8).map((item) => {
              const active = item.id === project.id
              return (
                <Link
                  key={item.id}
                  href={`/forge/${item.id}`}
                  className="block rounded-[8px] border p-3 transition-colors"
                  style={{ background:active ? "rgba(56,189,248,.09)" : T.s2, borderColor:active ? "rgba(56,189,248,.45)" : T.b1 }}
                >
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <span className="truncate font-dm text-sm font-semibold text-white">{item.businessName}</span>
                    <Badge value={labelize(item.status ?? "intake")} tone={item.status === "ready_to_deploy" ? "good" : "muted"} />
                  </div>
                  <div className="mt-1 truncate font-dm text-[11px]" style={{ color:T.t2 }}>{item.name}</div>
                </Link>
              )
            })}
          </div>
        </SidebarBlock>

        <SidebarBlock title="Build Flow" icon={Workflow}>
          <div className="space-y-2">
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
        </SidebarBlock>

        <SidebarBlock title="Jobs" icon={ListChecks}>
          {tasks.length === 0 ? (
            <p className="font-dm text-xs" style={{ color:T.t2 }}>No jobs queued yet.</p>
          ) : (
            <div className="space-y-2">
              {tasks.slice(0, 5).map((task) => (
                <div key={task.id} className="rounded-[8px] border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-dm text-xs font-semibold">{task.title}</span>
                    <Badge value={task.status} tone={task.status === "completed" ? "good" : task.status === "failed" ? "bad" : "accent"} />
                  </div>
                  <div className="mt-1 font-dm text-[11px]" style={{ color:T.t3 }}>{labelize(task.agentType)} / {formatDate(task.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </SidebarBlock>

        <SidebarBlock title="History" icon={Activity}>
          {activityLogs.length === 0 ? (
            <p className="font-dm text-xs" style={{ color:T.t2 }}>No history recorded.</p>
          ) : (
            <div className="space-y-2">
              {activityLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="rounded-[8px] border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-dm text-xs font-semibold">{labelize(log.action)}</span>
                    <span className="shrink-0 font-dm text-[10px]" style={{ color:T.t3 }}>{formatDate(log.createdAt)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 font-dm text-[11px] leading-4" style={{ color:T.t2 }}>{log.message}</p>
                </div>
              ))}
            </div>
          )}
        </SidebarBlock>
      </div>
    </div>
  )
}

function SidebarBlock({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <section className="border-b p-3 last:border-b-0" style={{ borderColor:"rgba(148,163,184,.12)" }}>
      <div className="mb-3 flex items-center gap-2">
        <Icon size={14} style={{ color:"#22d3ee" }} aria-hidden="true" />
        <h2 className="font-dm text-xs font-bold uppercase tracking-[.12em]" style={{ color:"#cbd5e1" }}>{title}</h2>
      </div>
      {children}
    </section>
  )
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

function MobileContextBar({
  currentStep,
  qaStatus,
  cost,
  activeTasks,
  failedTasks,
}: {
  currentStep: CockpitStage
  qaStatus: ForgeQaArtifactState["status"]
  cost: number
  activeTasks: number
  failedTasks: number
}) {
  return (
    <div className="grid gap-2 rounded-[8px] border p-3 sm:grid-cols-4" style={{ background:"rgba(2,6,23,.5)", borderColor:"rgba(56,189,248,.18)" }}>
      <CompactSignal label="Step" value={currentStep.label} tone={currentStep.status === "failed" ? "bad" : currentStep.status === "running" ? "accent" : "muted"} />
      <CompactSignal label="QA" value={labelize(qaStatus)} tone={qaStatus === "passed" ? "good" : qaStatus === "failed" ? "bad" : "muted"} />
      <CompactSignal label="Cost" value={formatCost(cost)} tone="accent" />
      <CompactSignal label="Jobs" value={`${activeTasks} active / ${failedTasks} failed`} tone={failedTasks ? "bad" : activeTasks ? "accent" : "muted"} />
    </div>
  )
}

function LiveContextRail({
  stages,
  activeTasks,
  failedTasks,
  artifacts,
  design,
  qa,
  generatedCode,
  aiUsage,
}: {
  stages: CockpitStage[]
  activeTasks: ForgeTaskRow[]
  failedTasks: ForgeTaskRow[]
  artifacts: ForgeArtifactRow[]
  design: ForgeDesignArtifactState
  qa: ForgeQaArtifactState
  generatedCode: ForgeGeneratedCodeArtifactState
  aiUsage: ForgeAiUsageMetrics
}) {
  const direction = design.approvedDirection ?? design.direction
  const currentStep = resolveCurrentStep(stages)
  const buildStatus = resolveBuildStatus(stages, qa, generatedCode)

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-[8px] border p-4" style={{ background:"rgba(2,6,23,.58)", borderColor:"rgba(56,189,248,.18)" }}>
        <GridWash />
        <div className="relative">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-dm text-[11px] font-semibold uppercase tracking-[.2em]" style={{ color:"#7dd3fc" }}>Live Context</p>
              <h2 className="mt-1 font-syne text-xl font-extrabold text-white">{buildStatus}</h2>
            </div>
            <StageBadge status={currentStep.status} />
          </div>

          <div className="grid gap-2">
            <RailRow icon={Workflow} label="Current step" value={`${currentStep.label} / ${currentStep.detail}`} />
            <RailRow icon={Monitor} label="Style" value={direction ? `${direction.designStyleName} / ${direction.selectedStylePack}` : "No design direction selected"} />
            <RailRow icon={Activity} label="Animation" value={direction?.selectedAnimationPack ?? "Not selected"} />
            <RailRow icon={ShieldCheck} label="QA" value={qa.report ? `${labelize(qa.status)} / ${qa.report.commands.length} checks` : labelize(qa.status)} />
            <RailRow icon={Code2} label="Build" value={generatedCode.summary ? `${generatedCode.summary.fileCount} files / ${generatedCode.summary.routes.length} routes` : "No generated code yet"} />
            <RailRow icon={DollarSign} label="Cost" value={`${formatCost(aiUsage.totals.estimatedCost)} total / ${aiUsage.totals.totalTokens.toLocaleString()} tokens`} />
          </div>
        </div>
      </section>

      <section className="rounded-[8px] border p-4" style={{ background:T.s1, borderColor:T.b1 }}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-syne text-lg font-bold">Build Progress</h2>
          <Badge value={`${stages.filter((stage) => stage.status === "approved" || stage.status === "complete").length}/${stages.length}`} tone="accent" />
        </div>
        <div className="space-y-2">
          {stages.map((stage) => (
            <div key={stage.label} className="grid grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-2">
              <span className="truncate font-dm text-[11px]" style={{ color:T.t2 }}>{stage.label}</span>
              <div className="h-1.5 overflow-hidden rounded-full" style={{ background:T.s2 }}>
                <div className="h-full rounded-full" style={{ width: stageProgressWidth(stage.status), background: stageProgressColor(stage.status) }} />
              </div>
              <StageBadge status={stage.status} />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[8px] border p-4" style={{ background:T.s1, borderColor:T.b1 }}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-syne text-lg font-bold">Queue</h2>
          <Badge value={`${activeTasks.length} active`} tone={activeTasks.length ? "accent" : "muted"} />
        </div>
        {failedTasks.length > 0 && (
          <div className="mb-3 rounded-[8px] border px-3 py-2 font-dm text-xs" style={{ background:"rgba(239,68,68,.08)", borderColor:"rgba(239,68,68,.28)", color:T.t1 }}>
            {failedTasks[0].title}: {failedTasks[0].description ?? "Check logs for details."}
          </div>
        )}
        {activeTasks.length === 0 ? (
          <p className="font-dm text-sm" style={{ color:T.t2 }}>No jobs currently running.</p>
        ) : (
          <div className="space-y-2">
            {activeTasks.slice(0, 3).map((task) => (
              <RailRow key={task.id} icon={ListChecks} label={labelize(task.agentType)} value={task.title} />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[8px] border p-4" style={{ background:T.s1, borderColor:T.b1 }}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-syne text-lg font-bold">Artifacts</h2>
          <Badge value={`${artifacts.length}`} tone="muted" />
        </div>
        {artifacts.length === 0 ? (
          <p className="font-dm text-sm" style={{ color:T.t2 }}>Generated artifacts will appear here as Forge works.</p>
        ) : (
          <div className="space-y-2">
            {artifacts.slice(0, 5).map((artifact) => (
              <div key={artifact.id} className="rounded-[8px] border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
                <div className="truncate font-dm text-xs font-semibold">{artifact.title}</div>
                <div className="mt-1 font-dm text-[11px]" style={{ color:T.t3 }}>{labelize(artifact.type)} / {formatDate(artifact.createdAt)}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function StatusDock({
  currentStep,
  aiUsage,
  activeTasks,
  failedTasks,
  qa,
  visualCritique,
}: {
  currentStep: CockpitStage
  aiUsage: ForgeAiUsageMetrics
  activeTasks: ForgeTaskRow[]
  failedTasks: ForgeTaskRow[]
  qa: ForgeQaArtifactState
  visualCritique: ForgeVisualCritiqueArtifactState
}) {
  const validation = qa.status === "failed"
    ? qa.report?.failureSummary ?? "QA failed. View logs for command output."
    : visualCritique.score !== null
      ? `Visual critique ${visualCritique.score}/100`
      : "Validation pending"

  return (
    <footer className="grid shrink-0 gap-2 border-t px-3 py-2 md:grid-cols-[1.1fr_.8fr_.8fr_1.4fr]" style={{ background:"rgba(2,6,23,.82)", borderColor:"rgba(148,163,184,.14)" }}>
      <CompactSignal label="Current Step" value={`${currentStep.label} / ${labelize(currentStep.status)}`} tone={currentStep.status === "failed" ? "bad" : currentStep.status === "running" ? "accent" : "muted"} />
      <CompactSignal label="Usage" value={`${aiUsage.totals.totalTokens.toLocaleString()} tokens / ${formatCost(aiUsage.totals.estimatedCost)}`} tone={aiUsage.budget.project.blocked || aiUsage.budget.monthly.blocked ? "bad" : "accent"} />
      <CompactSignal label="Jobs" value={`${activeTasks.length} active / ${failedTasks.length} failed`} tone={failedTasks.length ? "bad" : activeTasks.length ? "accent" : "muted"} />
      <CompactSignal label="Validation" value={validation} tone={qa.status === "passed" ? "good" : qa.status === "failed" ? "bad" : "muted"} />
    </footer>
  )
}

function RailRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-[8px] border px-3 py-2" style={{ background:T.s2, borderColor:T.b1 }}>
      <Icon size={13} style={{ color:"#38bdf8" }} aria-hidden="true" />
      <span className="shrink-0 font-dm text-[11px]" style={{ color:T.t3 }}>{label}</span>
      <span className="truncate font-dm text-[11px] font-semibold" style={{ color:T.t1 }}>{value}</span>
    </div>
  )
}

function CompactSignal({ label, value, tone }: { label: string; value: string; tone: "accent" | "good" | "bad" | "muted" }) {
  const color = tone === "good" ? T.grn : tone === "bad" ? T.red : tone === "accent" ? "#38bdf8" : T.t2
  return (
    <div className="min-w-0 rounded-[8px] border px-3 py-2" style={{ background:"rgba(15,23,42,.62)", borderColor:"rgba(148,163,184,.14)" }}>
      <div className="font-dm text-[10px] font-semibold uppercase tracking-[.1em]" style={{ color:T.t3 }}>{label}</div>
      <div className="mt-0.5 truncate font-dm text-xs font-semibold" style={{ color }}>{value}</div>
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
  visualCritique,
  qa,
  seo,
  preview,
  deploy,
  tasks,
  artifacts,
}: {
  intake: ForgeIntakeState
  sitemap: ForgeSitemapArtifactState
  copy: ForgeCopyArtifactState
  design: ForgeDesignArtifactState
  generatedCode: ForgeGeneratedCodeArtifactState
  visualCritique: ForgeVisualCritiqueArtifactState
  qa: ForgeQaArtifactState
  seo: ForgeSeoArtifactState
  preview: ForgePreviewState | null
  deploy: ForgeDeployArtifactState
  tasks: ForgeTaskRow[]
  artifacts: ForgeArtifactRow[]
}): CockpitStage[] {
  const strategyStatus = sitemap.status === "approved" ? "approved" : sitemap.status === "draft" ? "needs_review" : stageTaskStatus(tasks, ["strategy", "sitemap"], "needs_review")
  const copyStatus = copy.status === "approved" ? "approved" : copy.status === "draft" ? "needs_review" : stageTaskStatus(tasks, ["copy"], "needs_review")
  const designStatus = design.status === "approved" ? "approved" : design.status === "draft" ? "needs_review" : stageTaskStatus(tasks, ["design"], "needs_review")
  const buildStatus = generatedCode.status === "generated" ? "complete" : stageTaskStatus(tasks, ["frontend"], "needs_review")
  const critiqueStatus = visualCritique.status === "approved" ? "approved" : visualCritique.status === "draft" ? "needs_review" : stageTaskStatus(tasks, ["qa"], "needs_review")
  const qaStatus = qa.status === "passed" ? "complete" : qa.status === "failed" ? "failed" : stageTaskStatus(tasks, ["qa", "repair"], "needs_review")
  const repairStatus = qa.status === "failed"
    ? stageTaskStatus(tasks, ["repair"], "failed")
    : qa.report?.repairHistory.length ? "complete" : buildStatus === "complete" ? "needs_review" : stageTaskStatus(tasks, ["repair"], "needs_review")

  return [
    {
      label: "Intake",
      status: intake.status === "completed" ? "approved" : (intake.completenessScore ?? 0) > 0 ? "needs_review" : stageTaskStatus(tasks, ["intake"], "needs_review"),
      detail: `${intake.completenessScore ?? 0}% complete`,
      tab: "intake",
    },
    {
      label: "Strategy selection",
      status: stageArtifactStatus(tasks, artifacts, ["research"], ["research_report"]),
      detail: "Industry and site-type strategy pack",
      tab: "strategy",
    },
    {
      label: "Brief confirmation",
      status: intake.status === "completed" && strategyStatus !== "needs_review" ? "approved" : strategyStatus,
      detail: "Structured build brief confirmed",
      tab: "strategy",
    },
    {
      label: "Site plan",
      status: strategyStatus,
      detail: sitemap.approvedStrategy ? `${sitemap.approvedStrategy.sitemap.length} planned page${sitemap.approvedStrategy.sitemap.length === 1 ? "" : "s"}` : "Sitemap and section plan",
      tab: "strategy",
    },
    {
      label: "Design tokens",
      status: designStatus,
      detail: design.approvedDirection ? design.approvedDirection.selectedStylePack : "Style pack, motion, and locked tokens",
      tab: "strategy",
    },
    {
      label: "Code generation",
      status: buildStatus,
      detail: generatedCode.summary ? `${generatedCode.summary.fileCount} generated files` : "Generated site workspace",
      tab: "build",
    },
    {
      label: "Copy generation",
      status: copyStatus,
      detail: copy.approvedCopy ? `${copy.approvedCopy.pages.length} approved page${copy.approvedCopy.pages.length === 1 ? "" : "s"}` : "Page copy and CTA language",
      tab: "strategy",
    },
    {
      label: "SEO/schema generation",
      status: seo.status === "generated" ? "complete" : stageTaskStatus(tasks, ["seo"], "needs_review"),
      detail: seo.score ? `SEO/AEO/GEO ${seo.score.overall}/100` : "Metadata and JSON-LD",
      tab: "build",
    },
    {
      label: "Internal critique",
      status: visualCritique.report && forgeCritiqueHasLowScore(visualCritique.report) && !visualCritique.autoFixAppliedAt ? "running" : critiqueStatus,
      detail: visualCritique.score === null ? "Brand, content, SEO, mobile, and readiness scoring" : `Score ${visualCritique.score}/100`,
      tab: "qa",
    },
    {
      label: "Design critique",
      status: visualCritique.report && visualCritique.report.scores.visualQuality < 75 && !visualCritique.autoFixAppliedAt ? "running" : critiqueStatus,
      detail: visualCritique.report ? `Visual quality ${visualCritique.report.scores.visualQuality}/100` : "Visual alignment and design quality",
      tab: "qa",
    },
    {
      label: "Copy rewrite",
      status: copyStatus === "approved" && visualCritique.report && visualCritique.report.scores.contentSpecificity < 75 && !visualCritique.autoFixAppliedAt ? "running" : copyStatus,
      detail: visualCritique.report?.scores.contentSpecificity !== undefined ? `Specificity ${visualCritique.report.scores.contentSpecificity}/100` : "Rewrite if critique finds generic copy",
      tab: "strategy",
    },
    {
      label: "Code repair",
      status: repairStatus,
      detail: qa.report ? `${qa.report.repairHistory.length} repair attempt${qa.report.repairHistory.length === 1 ? "" : "s"}` : "Repair loop after failed validation",
      tab: "qa",
    },
    {
      label: "Final validation",
      status: qaStatus,
      detail: qa.report ? `${qa.report.commands.length} mandatory checks` : "Typecheck, build, copy, SEO, design, mobile",
      tab: "qa",
    },
    {
      label: "Export/preview",
      status: deploy.lifecycle === "deployed" ? "complete" : preview?.status === "running" ? "running" : preview?.status === "failed" ? "failed" : qa.status === "passed" || deploy.ready ? "approved" : "needs_review",
      detail: preview?.url ?? (deploy.ready ? "Ready to export/deploy" : "Preview and export after validation"),
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

function forgeCritiqueHasLowScore(report: ForgeVisualCritiqueArtifactState["report"]) {
  if (!report) return false
  return Object.values(report.scores).some((score) => typeof score === "number" && score < 75)
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
  const [qualityFilter, setQualityFilter] = useState<"all" | "degraded" | "fallback">("all")
  const visible = qualityFilter === "all" ? rows : rows.filter((row) => row.resultQuality === qualityFilter)
  if (rows.length === 0) return <Empty icon={ListChecks} text="No production tasks have been queued yet." />
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 font-dm text-xs" style={{ color:T.t2 }}>Quality filter
        <select value={qualityFilter} onChange={(event) => setQualityFilter(event.target.value as typeof qualityFilter)}><option value="all">All</option><option value="degraded">Degraded</option><option value="fallback">Fallback</option></select>
      </label>
      {visible.map((row) => (
        <div key={row.id} className="rounded-[8px] border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
          <div className="flex items-center justify-between gap-3">
            <div className="font-dm text-sm font-semibold">{row.title}</div>
            <Badge value={row.status} tone={row.status === "completed" ? "good" : row.status === "failed" ? "bad" : "accent"} />
            <Badge value={row.resultQuality.replace("_", " ")} tone={row.resultQuality === "validated" ? "good" : row.resultQuality === "failed" ? "bad" : "warn"} />
          </div>
          <div className="mt-1 font-dm text-[11px]" style={{ color:T.t2 }}>{labelize(row.agentType)} / {formatDate(row.createdAt)}</div>
          {row.description && <p className="mt-2 font-dm text-xs leading-relaxed" style={{ color:T.t2 }}>{row.description}</p>}
          {row.resultQuality !== "validated" && <div className="mt-2 rounded border border-amber-500/30 bg-amber-500/10 p-2 font-dm text-xs text-amber-200">This output is not validated{row.fallbackReason ? `: ${row.fallbackReason}` : "."} {row.publicationBlocked ? "Publication is blocked." : "Human approval recorded."}</div>}
          <div className="mt-2 font-dm text-[11px]" style={{ color:T.t3 }}>{row.providerAttempted ?? "No provider recorded"}{row.modelAttempted ? ` / ${row.modelAttempted}` : ""} / {row.retryCount} retries{row.qualityApprovedBy ? ` / approved by ${row.qualityApprovedBy}` : ""}</div>
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

function AiUsagePanel({ projectId, usage }: { projectId: number; usage: ForgeAiUsageMetrics }) {
  const warning = usage.budget.project.blocked || usage.budget.monthly.blocked
    ? "AI budget reached. Further AI jobs are blocked until limits are increased or the monthly window resets."
    : usage.budget.project.warning || usage.budget.monthly.warning
      ? "AI usage is approaching a configured budget limit."
      : null

  return (
    <div className="space-y-4">
      {warning && (
        <div className="rounded-[8px] border px-3 py-2 font-dm text-sm" style={{ background:"rgba(245,158,11,.08)", borderColor:"rgba(245,158,11,.28)", color:T.t1 }}>
          {warning}
        </div>
      )}

      <div className="grid gap-2 md:grid-cols-4">
        <UsageMetric label="Today" value={formatCost(usage.today.estimatedCost)} detail={`${usage.today.requests} request${usage.today.requests === 1 ? "" : "s"}`} />
        <UsageMetric label="This Week" value={formatCost(usage.week.estimatedCost)} detail={`${usage.week.totalTokens.toLocaleString()} tokens`} />
        <UsageMetric label="This Month" value={formatCost(usage.month.estimatedCost)} detail={budgetDetail(usage.budget.monthly)} />
        <UsageMetric label="Project Total" value={formatCost(usage.totals.estimatedCost)} detail={budgetDetail(usage.budget.project)} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-dm text-sm font-semibold">Recent AI Requests</h3>
          <p className="font-dm text-xs" style={{ color:T.t2 }}>Provider, model, token usage, and estimated cost.</p>
        </div>
        <Link href={`/api/forge/ai-usage/export?projectId=${projectId}`} className="inline-flex h-9 items-center gap-2 rounded-[8px] border px-3 font-dm text-xs font-semibold" style={{ background:T.s2, borderColor:T.b1, color:T.t1 }}>
          <Download size={14} aria-hidden="true" />
          Export CSV
        </Link>
      </div>

      {usage.recent.length === 0 ? (
        <Empty icon={DollarSign} text="No AI usage has been recorded for this project yet." />
      ) : (
        <div className="space-y-2">
          {usage.recent.map((row) => (
            <div key={row.id} className="grid gap-3 rounded-[8px] border p-3 md:grid-cols-[1fr_.7fr_.8fr_.6fr]" style={{ background:T.s2, borderColor:T.b1 }}>
              <div className="min-w-0">
                <div className="truncate font-dm text-sm font-semibold">{labelize(row.provider)} / {row.model}</div>
                <div className="font-dm text-[11px]" style={{ color:T.t2 }}>{formatDate(row.completedAt)}{row.taskId ? ` / Task #${row.taskId}` : ""}</div>
              </div>
              <div className="font-dm text-xs" style={{ color:T.t2 }}>Prompt: {row.promptTokens.toLocaleString()}</div>
              <div className="font-dm text-xs" style={{ color:T.t2 }}>Completion: {row.completionTokens.toLocaleString()} / Total: {row.totalTokens.toLocaleString()}</div>
              <div className="font-syne text-sm font-extrabold" style={{ color:"#22d3ee" }}>{formatCost(row.estimatedCost)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function UsageMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[8px] border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
      <div className="font-dm text-[10px] font-semibold uppercase tracking-[.1em]" style={{ color:T.t2 }}>{label}</div>
      <div className="mt-1 font-syne text-xl font-extrabold" style={{ color:"#22d3ee" }}>{value}</div>
      <div className="mt-1 truncate font-dm text-[11px]" style={{ color:T.t2 }}>{detail}</div>
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

function resolveCurrentStep(stages: CockpitStage[]) {
  return stages.find((stage) => stage.status === "running")
    ?? stages.find((stage) => stage.status === "failed")
    ?? stages.find((stage) => stage.status === "needs_review")
    ?? stages[stages.length - 1]
}

function resolveBuildStatus(stages: CockpitStage[], qa: ForgeQaArtifactState, generatedCode: ForgeGeneratedCodeArtifactState) {
  if (qa.status === "passed") return "Ready"
  if (qa.status === "failed") return "Fixing"
  if (stages.some((stage) => stage.status === "running")) return "Generating"
  if (generatedCode.status === "generated") return "QA"
  return "Planning"
}

function stageProgressWidth(status: CockpitStageStatus) {
  if (status === "approved" || status === "complete") return "100%"
  if (status === "running") return "66%"
  if (status === "failed") return "42%"
  return "24%"
}

function stageProgressColor(status: CockpitStageStatus) {
  if (status === "approved" || status === "complete") return T.grn
  if (status === "failed") return T.red
  if (status === "running") return "#38bdf8"
  return T.amb
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "No date"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "No date"
  return date.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })
}

function formatCost(value: number) {
  return `$${value.toFixed(value >= 10 ? 2 : 4)}`
}

function budgetDetail(budget: ForgeAiBudgetState) {
  if (!budget.limit) return "No limit set"
  const percent = Math.round(((budget.used / budget.limit) || 0) * 100)
  return `${percent}% of ${formatCost(budget.limit)}`
}

function labelize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}
