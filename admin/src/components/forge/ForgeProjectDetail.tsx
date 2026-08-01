"use client"

import { Children, useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import {
  Activity,
  Archive,
  Box,
  Brain,
  CheckCircle2,
  ChevronRight,
  Code2,
  DollarSign,
  Download,
  Eye,
  FileText,
  Link2,
  ListChecks,
  Monitor,
  PanelRightOpen,
  Rocket,
  Settings2,
  ShieldCheck,
  Workflow,
} from "lucide-react"
import { ForgeIntakeForm, type ForgeIntakeState } from "./ForgeIntakeForm"
import type { ForgeProjectFormValue } from "./ForgeProjectForm"
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
import { ForgeResearchActions } from "./ForgeResearchActions"
import { ForgeSeoPanel } from "./ForgeSeoPanel"
import { ForgeSitemapStrategyPanel } from "./ForgeSitemapStrategyPanel"
import { ForgeVisualCritiquePanel } from "./ForgeVisualCritiquePanel"
import { ForgeVisualQaPanel } from "./ForgeVisualQaPanel"
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
import { ContextDrawer, DetailDrawer, WorkspaceShell } from "@/components/admin-shell/primitives"
import { useAdminShell } from "@/components/admin-shell/AdminShellContext"
import { deriveForgeAttentionItems, type ForgeHealthJob } from "@/lib/forge-operational-health"
import { normalizeForgeOperatorError } from "@/lib/forge-operator-error"
import { useForgeWorkspaceNavigation, type ProductionStage, type WorkspaceStage, type WorkspaceView } from "./useForgeWorkspaceNavigation"
import { ForgeProjectHeader, ForgeProjectNavigation, ForgeStageRail } from "./ForgeProjectChrome"

const T = { s1:"var(--s1)", s2:"var(--s2)", s3:"var(--s3)", b1:"var(--b1)", b2:"var(--b2)", t1:"var(--t1)", t2:"var(--t2)", t3:"var(--t3)", acc:"var(--acc)", grn:"var(--grn)", amb:"var(--amb)", red:"var(--red)" }

const advancedPanelLoading = () => <div className="forge-empty" role="status">Loading advanced project tools…</div>
const ForgeArtifactTabs = dynamic(() => import("./ForgeArtifactTabs").then((module) => module.ForgeArtifactTabs), { loading: advancedPanelLoading })
const ForgeProjectForm = dynamic(() => import("./ForgeProjectForm").then((module) => module.ForgeProjectForm), { loading: advancedPanelLoading })
const ForgeResendConfigPanel = dynamic(() => import("./ForgeResendConfigPanel").then((module) => module.ForgeResendConfigPanel), { loading: advancedPanelLoading })
const ForgeWhatsAppConfigPanel = dynamic(() => import("./ForgeWhatsAppConfigPanel").then((module) => module.ForgeWhatsAppConfigPanel), { loading: advancedPanelLoading })


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

interface ForgeJobRow {
  id: number
  kind: string
  status: string
  error: string | null
  heartbeatAt: Date | string | null
  scheduledAt: Date | string
  updatedAt: Date | string
}

interface ForgeRunStepAttentionRow {
  runId: number
  jobId: number | null
  stage: string
  operatorErrorJson: ReturnType<typeof normalizeForgeOperatorError> | null
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
  tasks,
  jobs,
  runSteps,
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
  jobs: ForgeJobRow[]
  runSteps: ForgeRunStepAttentionRow[]
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
  const { toggleFocusMode } = useAdminShell()
  const router = useRouter()
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
      projectStatus: project.status,
    }),
    [artifacts, initialCopy, initialDeploy, initialDesign, initialGeneratedCode, initialIntake, initialPreview, initialQa, initialSeo, initialSitemap, initialVisualCritique, project.status, tasks],
  )
  const completedStages = stages.filter((stage) => stage.status === "approved" || stage.status === "complete").length
  const activeTasks = tasks.filter((task) => task.status === "queued" || task.status === "running")
  const failedTasks = tasks.filter((task) => task.status === "failed")
  const approvedFallbackTasks = tasks.filter((task) => task.resultQuality === "fallback" && task.qualityApprovedAt)
  const currentStep = resolveCurrentStep(stages)
  const [contextOpen, setContextOpen] = useState(false)
  const [overflowOpen, setOverflowOpen] = useState(false)
  const [previewContextOpen, setPreviewContextOpen] = useState(false)
  const [previewDecisionBusy, setPreviewDecisionBusy] = useState(false)
  const [previewDecisionError, setPreviewDecisionError] = useState("")
  const attentionItems = useMemo(() => buildProjectAttention({ project, tasks, jobs, runSteps, integrations, stages, aiUsage, preview: initialPreview, deploy: initialDeploy }), [aiUsage, initialDeploy, initialPreview, integrations, jobs, project, runSteps, stages, tasks])
  const activeJobs = jobs.filter((job) => job.status === "queued" || job.status === "running")
  const failedJobs = jobs.filter((job) => job.status === "failed" || job.status === "dead_letter")
  const runStatus = failedTasks.length || failedJobs.length ? "failed" : activeTasks.some((task) => task.status === "running") || activeJobs.some((job) => job.status === "running") ? "running" : activeTasks.length || activeJobs.length ? "queued" : project.status === "deployed" ? "complete" : "idle"
  const progress = Math.round((completedStages / stages.length) * 100)
  const primaryAction = resolvePrimaryProjectAction({ projectStatus: project.status, currentStep, failedTasks, activeTasks, intake: initialIntake, generatedCode: initialGeneratedCode, qa: initialQa, preview: initialPreview, deploy: initialDeploy })
  const { activeView, activeStage, qaPane, setQaPane, launchPane, setLaunchPane, recordsPane, setRecordsPane, workflowOpen, setWorkflowOpen, navigate, selectStage } = useForgeWorkspaceNavigation(stages, currentStep)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "i") {
        event.preventDefault()
        setContextOpen((open) => !open)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  async function approvePreview() {
    if (previewDecisionBusy) return
    if (project.status !== "preview" && project.status !== "client_review") {
      setLaunchPane("deploy")
      navigate("build", "launch")
      return
    }
    setPreviewDecisionBusy(true)
    setPreviewDecisionError("")
    const nextStatus = project.status === "preview" ? "client_review" : "ready_to_deploy"
    try {
      const response = await fetch(`/api/forge/projects/${projectId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus, approvalScope: nextStatus === "ready_to_deploy" ? "client" : "internal" }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error || "Unable to record preview approval.")
      router.refresh()
      if (nextStatus === "ready_to_deploy") {
        setLaunchPane("deploy")
        navigate("build", "launch")
      } else {
        navigate("preview", "client-review")
      }
    } catch (error) {
      setPreviewDecisionError(error instanceof Error ? error.message : "Unable to record preview approval.")
    } finally {
      setPreviewDecisionBusy(false)
    }
  }

  return (
    <WorkspaceShell className="forge-workspace forge-project-workspace">
      <ForgeProjectHeader projectId={projectId} name={project.name} businessName={project.businessName} industry={project.industry} currentStage={currentStep.label} progress={progress} cost={formatCost(aiUsage.totals.estimatedCost)} status={<Badge value={runStatus} tone={runStatus === "failed" ? "bad" : runStatus === "complete" ? "good" : runStatus === "running" ? "accent" : "muted"} />} primaryAction={primaryAction.label} overflowOpen={overflowOpen} onPrimaryAction={() => navigate(primaryAction.view, primaryAction.stage)} onOpenContext={() => { setContextOpen(true); setOverflowOpen(false) }} onToggleFocus={toggleFocusMode} onToggleOverflow={() => setOverflowOpen((open) => !open)} onOpenSettings={() => { navigate("advanced"); setRecordsPane("settings"); setOverflowOpen(false) }} />

      {approvedFallbackTasks.length > 0 && <div className="project-workspace-warning"><strong>Fallback dependency warning:</strong> deployment remains subject to {approvedFallbackTasks.length} recorded quality approval{approvedFallbackTasks.length === 1 ? "" : "s"}.</div>}

      <ForgeProjectNavigation activeView={activeView} attentionCount={attentionItems.length} onNavigate={navigate} onOpenWorkflow={() => setWorkflowOpen(true)} />

      <div className="project-workspace-body">
        <aside className="project-stage-rail" aria-label="Production stages">
          <button type="button" className="project-stage-rail-heading" onClick={() => setWorkflowOpen(true)}><Workflow size={16} aria-hidden="true" /><span>Production journey</span></button>
          <ForgeStageRail stages={stages} activeStage={activeStage} onSelect={selectStage} />
        </aside>

        <main className="project-workspace-main">
          {activeView === "overview" && <div className="project-overview">
            <section className="operator-summary">
              <div><p className="workspace-eyebrow">Current run</p><h2>{currentStep.label}</h2><p>{currentStep.detail}</p></div>
              <div className="operator-summary-actions"><StageBadge status={currentStep.status} /><button type="button" className="forge-primary-action" onClick={() => navigate(primaryAction.view, primaryAction.stage)}>{primaryAction.label}<ChevronRight size={16} aria-hidden="true" /></button></div>
            </section>
            {attentionItems[0] && <button type="button" className="project-intervention" onClick={() => navigate("attention", undefined, { item: attentionItems[0].id })}><ShieldCheck size={19} aria-hidden="true" /><span><strong>Intervention required</strong>{attentionItems[0].reason}<small>{attentionItems[0].action}</small></span><ChevronRight size={18} aria-hidden="true" /></button>}
            <div className="project-overview-grid">
              <section className="project-overview-section"><div className="project-section-heading"><div><p>Production journey</p><h2>Run timeline</h2></div><span>{completedStages}/{stages.length} complete</span></div><StageTimeline stages={stages} onSelect={selectStage} /></section>
              <section className="project-overview-section"><div className="project-section-heading"><div><p>Latest meaningful output</p><h2>{artifacts[0]?.title ?? "No output yet"}</h2></div>{artifacts[0] && <Badge value={`v${artifacts[0].version}`} tone="muted" />}</div><p className="project-section-copy">{artifacts[0] ? `${labelize(artifacts[0].type)} · ${labelize(artifacts[0].qualityState)}` : "The first validated production artifact will appear here."}</p>{initialPreview?.url && <button type="button" className="forge-secondary-action" onClick={() => navigate("preview")}>Open preview<Eye size={16} aria-hidden="true" /></button>}</section>
            </div>
            <ForgeCommandChatPanel projectId={projectId} initialChat={initialCommandChat} disabled={archived} />
            <div className="project-overview-grid">
              <section className="project-overview-section"><div className="project-section-heading"><div><p>Recent decisions</p><h2>Operator history</h2></div></div><ActivityList rows={activityLogs.slice(0, 4)} /></section>
              <section className="project-overview-section project-next-stage"><p className="workspace-eyebrow">Next expected stage</p><h2>{nextStage(stages, currentStep)?.label ?? "Production complete"}</h2><p>{nextStage(stages, currentStep)?.detail ?? "No further production stage is pending."}</p><dl><div><dt>Estimated remaining cost</dt><dd>{estimateRemainingCost(aiUsage, progress)}</dd></div><div><dt>Preview</dt><dd>{initialPreview?.status ? labelize(initialPreview.status) : "Not started"}</dd></div></dl></section>
            </div>
          </div>}

          {activeView === "build" && <div className="stage-workspace">
            <header className="stage-workspace-header"><div><p className="workspace-eyebrow">Stage {stages.findIndex((stage) => stage.key === activeStage) + 1} of {stages.length}</p><h2>{stages.find((stage) => stage.key === activeStage)?.label}</h2><p>{stages.find((stage) => stage.key === activeStage)?.detail}</p></div><StageBadge status={stages.find((stage) => stage.key === activeStage)?.status ?? "needs_review"} /></header>
            {activeStage === "brief" && <ForgeIntakeForm projectId={projectId} initialIntake={initialIntake} websiteUrl={project.websiteUrl} />}
            {activeStage === "research" && <ForgeResearchActions projectId={projectId} disabled={archived} />}
            {activeStage === "site-plan" && <ForgeSitemapStrategyPanel projectId={projectId} initialState={initialSitemap} disabled={archived} />}
            {activeStage === "copy" && <ForgeCopyPanel projectId={projectId} initialState={initialCopy} sitemapState={initialSitemap} disabled={archived} />}
            {activeStage === "design" && <ForgeDesignDirectionPanel projectId={projectId} initialState={initialDesign} copyState={initialCopy} disabled={archived} />}
            {activeStage === "components" && <ForgeComponentSpecPanel projectId={projectId} initialState={initialComponentSpec} designState={initialDesign} disabled={archived} />}
            {activeStage === "build" && <div className="grid gap-4"><ForgeWorkspacePanel projectId={projectId} initialWorkspace={initialWorkspace} disabled={archived} /><ForgeGenerateSitePanel projectId={projectId} initialWorkspace={initialWorkspace} componentSpecState={initialComponentSpec} initialGeneratedCode={initialGeneratedCode} disabled={archived} /></div>}
            {activeStage === "seo" && <ForgeSeoPanel projectId={projectId} initialSeo={initialSeo} sitemapState={initialSitemap} copyState={initialCopy} disabled={archived} />}
            {activeStage === "quality" && <SectionDeck options={[{ key:"critique", label:"Critique", Icon:Eye }, { key:"checks", label:"Checks", Icon:ShieldCheck }, { key:"visual", label:"Visual QA", Icon:Monitor }, { key:"cost", label:"Cost / Quality", Icon:DollarSign }]} active={qaPane} onChange={setQaPane}>
              {qaPane === "critique" && <ForgeVisualCritiquePanel projectId={projectId} initialDesign={initialDesign} initialCopy={initialCopy} initialComponentSpec={initialComponentSpec} initialGeneratedCode={initialGeneratedCode} initialCritique={initialVisualCritique} disabled={archived} />}
              {qaPane === "checks" && <ForgeQaPanel projectId={projectId} initialWorkspace={initialWorkspace} initialGeneratedCode={initialGeneratedCode} initialVisualCritique={initialVisualCritique} initialQa={initialQa} disabled={archived} />}
              {qaPane === "visual" && <ForgeVisualQaPanel projectId={projectId} initialWorkspace={initialWorkspace} initialGeneratedCode={initialGeneratedCode} initialVisualQa={initialVisualQa} disabled={archived} />}
              {qaPane === "cost" && <ForgeCostQualityPanel costQuality={costQuality} />}
            </SectionDeck>}
            {(activeStage === "preview" || activeStage === "client-review") && <ForgePreviewRail projectId={projectId} initialWorkspace={initialWorkspace} initialGeneratedCode={initialGeneratedCode} initialPreview={initialPreview} disabled={archived} />}
            {activeStage === "launch" && <SectionDeck options={[{ key:"proposal", label:"Proposal", Icon:FileText }, { key:"estimate", label:"Estimate", Icon:DollarSign }, { key:"export", label:"Export", Icon:Archive }, { key:"deploy", label:"Deploy", Icon:Rocket }]} active={launchPane} onChange={setLaunchPane}>
              {launchPane === "proposal" && <ForgeProposalPanel projectId={projectId} initialProposal={initialProposal} intakeReady={(initialIntake.completenessScore ?? 0) > 0} disabled={archived} />}
              {launchPane === "estimate" && <ForgeEstimatorPanel projectId={projectId} initialEstimate={latestEstimate} disabled={archived} />}
              {launchPane === "export" && <ForgeExportPanel projectId={projectId} initialExport={initialExport} siteReady={initialGeneratedCode.status === "generated"} proposalReady={initialProposal.status === "generated"} disabled={archived} />}
              {launchPane === "deploy" && <ForgeDeployPanel projectId={projectId} initialDeploy={initialDeploy} siteReady={initialGeneratedCode.status === "generated"} disabled={archived} />}
            </SectionDeck>}
            <details className="stage-technical-details"><summary>Technical details and provenance</summary><TaskList rows={tasks.filter((task) => stageAgentTypes(activeStage).includes(task.agentType))} /></details>
          </div>}

          {activeView === "preview" && <div className="preview-workspace">
            <div className="preview-workspace-toolbar"><div><p className="workspace-eyebrow">Generated site</p><h2>Review preview</h2></div><div><button type="button" className="forge-secondary-action" onClick={() => { setQaPane("visual"); navigate("build", "quality") }}><Monitor size={16} aria-hidden="true" />Capture screenshots</button><button type="button" className="forge-secondary-action" onClick={() => setPreviewContextOpen((open) => !open)}><PanelRightOpen size={16} aria-hidden="true" />{previewContextOpen ? "Hide feedback" : "Feedback"}</button></div></div>
            <div className={previewContextOpen ? "preview-workspace-grid is-split" : "preview-workspace-grid"}><ForgePreviewRail projectId={projectId} initialWorkspace={initialWorkspace} initialGeneratedCode={initialGeneratedCode} initialPreview={initialPreview} disabled={archived} />{previewContextOpen && <aside className="preview-feedback"><h2>Preview feedback</h2><p>Record approval or requested changes through the project command surface.</p><ForgeCommandChatPanel projectId={projectId} initialChat={initialCommandChat} disabled={archived} /></aside>}</div>
            {previewDecisionError && <div className="inline-alert tone-danger" role="alert">{previewDecisionError}</div>}
            <div className="preview-decision-bar"><button type="button" className="forge-secondary-action" onClick={() => setPreviewContextOpen(true)}>Request changes</button><button type="button" className="forge-primary-action" disabled={previewDecisionBusy} onClick={() => void approvePreview()}>{project.status === "client_review" ? "Record client approval" : "Internally approve preview"}<CheckCircle2 size={16} aria-hidden="true" /></button></div>
          </div>}

          {activeView === "attention" && <div className="project-attention-view"><header><p className="workspace-eyebrow">Interventions</p><h2>Needs attention</h2><p>Failures, approvals and production blockers for this project.</p></header>{attentionItems.length ? attentionItems.map((item) => <article key={item.id} id={item.id} data-incident-id={item.id} tabIndex={-1} className="project-attention-item"><span className={`tone-${item.severity}`}><ShieldCheck size={18} aria-hidden="true" /></span><div><div><h3>{item.title}</h3><Badge value={item.severity} tone={item.severity === "critical" || item.severity === "high" ? "bad" : "warn"} /></div><p>{item.reason}</p><small>{item.action}</small><details><summary>Technical details</summary><code>{item.technicalReference}</code></details></div><div className="flex flex-wrap gap-2">{item.jobId && item.availableActions.includes("retry") ? <ProjectJobAction jobId={item.jobId} action="retry" /> : null}{item.jobId && item.availableActions.includes("cancel") ? <ProjectJobAction jobId={item.jobId} action="cancel" /> : null}<button type="button" className="forge-row-action" onClick={() => navigate(item.view, item.stage)}>{item.actionLabel}<ChevronRight size={15} aria-hidden="true" /></button></div></article>) : <div className="attention-clear"><CheckCircle2 size={20} aria-hidden="true" />No recorded blocker requires intervention.</div>}</div>}

          {activeView === "advanced" && <SectionDeck options={[{ key:"tasks", label:"Tasks", Icon:ListChecks }, { key:"activity", label:"Activity", Icon:Activity }, { key:"usage", label:"AI Usage", Icon:DollarSign }, { key:"memory", label:"Memory", Icon:Brain }, { key:"integrations", label:"Integrations", Icon:Link2 }, { key:"artifacts", label:"Artifacts", Icon:Archive }, { key:"technical", label:"Technical QA", Icon:ShieldCheck }, { key:"settings", label:"Settings", Icon:Settings2 }, { key:"details", label:"Metadata", Icon:Box }]} active={recordsPane} onChange={setRecordsPane}>
            {recordsPane === "tasks" && <Panel title="Raw Tasks" icon={ListChecks}><TaskList rows={tasks} /></Panel>}
            {recordsPane === "activity" && <Panel title="Activity Log" icon={Activity}><ActivityList rows={activityLogs} /></Panel>}
            {recordsPane === "usage" && <Panel title="AI Usage and Providers" icon={DollarSign}><AiUsagePanel projectId={projectId} usage={aiUsage} /></Panel>}
            {recordsPane === "memory" && <Panel title="Project Memory" icon={Brain}><MemoryList rows={memories} /></Panel>}
            {recordsPane === "integrations" && <div className="grid gap-4"><Panel title="Integration Records" icon={Link2}><IntegrationList rows={integrations} /></Panel><TabGrid><ForgeResendConfigPanel projectId={projectId} initialConfig={initialResendConfig} disabled={archived} /><ForgeWhatsAppConfigPanel projectId={projectId} initialConfig={initialWhatsAppConfig} disabled={archived} /></TabGrid></div>}
            {recordsPane === "artifacts" && <ForgeArtifactTabs artifacts={artifacts} />}
            {recordsPane === "technical" && <div className="grid gap-4"><ForgeVisualQaPanel projectId={projectId} initialWorkspace={initialWorkspace} initialGeneratedCode={initialGeneratedCode} initialVisualQa={initialVisualQa} disabled={archived} /><ForgeCostQualityPanel costQuality={costQuality} /></div>}
            {recordsPane === "settings" && <Panel title="Project Settings" icon={Settings2}><ForgeProjectForm mode="edit" project={project} /></Panel>}
            {recordsPane === "details" && <Panel title="System Metadata" icon={Box}><DetailGrid project={project} /></Panel>}
          </SectionDeck>}
        </main>
      </div>

      <ContextDrawer open={workflowOpen} title="Production stages" onClose={() => setWorkflowOpen(false)}><ForgeStageRail stages={stages} activeStage={activeStage} onSelect={selectStage} /></ContextDrawer>
      <DetailDrawer open={contextOpen} title="Project context" onClose={() => setContextOpen(false)}><LiveContextRail stages={stages} activeTasks={activeTasks} failedTasks={failedTasks} artifacts={artifacts} design={initialDesign} qa={initialQa} generatedCode={initialGeneratedCode} aiUsage={aiUsage} /></DetailDrawer>
      {activeTasks.length + activeJobs.length > 0 && <div className="project-active-run-strip"><span className="system-health-dot tone-success" /><strong>{activeTasks.length + activeJobs.length} active</strong><span>{activeTasks[0]?.title ?? labelize(activeJobs[0]?.kind ?? "Forge job")}</span><button type="button" onClick={() => setContextOpen(true)}>View run</button></div>}
    </WorkspaceShell>
  )
}

type CockpitStageStatus = WorkspaceStage["status"]
type CockpitStage = WorkspaceStage

interface ProjectAttentionItem {
  id: string
  title: string
  reason: string
  action: string
  actionLabel: string
  severity: "critical" | "high" | "medium"
  view: WorkspaceView
  stage?: ProductionStage
  availableActions: Array<"retry" | "retry_fallback" | "cancel" | "approve" | "configure" | "open">
  jobId: number | null
  technicalReference: string
}

function StageTimeline({ stages, onSelect }: { stages: CockpitStage[]; onSelect: (stage: CockpitStage) => void }) {
  return <ol className="project-stage-timeline">{stages.map((stage) => <li key={stage.key}><button type="button" onClick={() => onSelect(stage)}><span className={`stage-state tone-${stage.status}`} /><span><strong>{stage.label}</strong><small>{stage.detail}</small></span><StageBadge status={stage.status} /></button></li>)}</ol>
}

function stageAgentTypes(stage: ProductionStage): ForgeTaskAgentType[] {
  const mapping: Record<ProductionStage, ForgeTaskAgentType[]> = {
    brief: ["intake"],
    research: ["research"],
    "site-plan": ["strategy", "sitemap"],
    copy: ["copy"],
    design: ["design"],
    components: ["design"],
    build: ["frontend"],
    seo: ["seo"],
    quality: ["qa", "repair"],
    preview: [],
    "client-review": [],
    launch: ["deploy"],
  }
  return mapping[stage]
}

function buildProjectAttention({
  project,
  tasks,
  jobs,
  runSteps,
  integrations,
  stages,
  aiUsage,
  preview,
  deploy,
}: {
  project: ForgeProjectFormValue
  tasks: ForgeTaskRow[]
  jobs: ForgeJobRow[]
  runSteps: ForgeRunStepAttentionRow[]
  integrations: ForgeIntegrationRow[]
  stages: CockpitStage[]
  aiUsage: ForgeAiUsageMetrics
  preview: ForgePreviewState | null
  deploy: ForgeDeployArtifactState
}): ProjectAttentionItem[] {
  const projectId = project.id
  if (!projectId) return []
  const errors: Array<{ projectId: number; runId?: number | null; error: ReturnType<typeof normalizeForgeOperatorError> }> = []
  for (const step of runSteps) {
    if (step.operatorErrorJson) errors.push({ projectId, runId: step.runId, error: { ...step.operatorErrorJson, runId: step.operatorErrorJson.runId ?? step.runId, jobId: step.operatorErrorJson.jobId ?? step.jobId, stage: step.operatorErrorJson.stage ?? step.stage } })
  }
  for (const task of tasks) {
    const stage = stageForAgent(task.agentType)
    if (task.status === "failed") errors.push({ projectId, error: normalizeForgeOperatorError(task.description ?? `${task.title} failed.`, { stage, category: task.agentType === "qa" ? "quality_failure" : task.agentType === "deploy" ? "deployment_blocked" : undefined, retryable: task.agentType !== "deploy", technicalReference: `forge:task:${task.id}`, timestamp: new Date(task.createdAt), metadata: { taskId: task.id, provider: task.providerAttempted } }) })
    else if (task.humanApprovalRequired && !task.qualityApprovedAt) errors.push({ projectId, error: normalizeForgeOperatorError(`${task.title} is waiting for a recorded decision.`, { stage, category: "approval_required", retryable: false, technicalReference: `forge:task:${task.id}:approval`, timestamp: new Date(task.createdAt) }) })
    if (task.publicationBlocked) errors.push({ projectId, error: normalizeForgeOperatorError(`${task.title} currently blocks publication.`, { stage: "quality", category: "deployment_blocked", retryable: false, technicalReference: `forge:task:${task.id}:publication`, timestamp: new Date(task.createdAt) }) })
  }
  if (stages.find((stage) => stage.key === "preview")?.status === "failed" || preview?.status === "failed") errors.push({ projectId, error: normalizeForgeOperatorError(preview?.error ?? "The generated-site preview did not start.", { stage: "preview", category: "workspace_error", technicalReference: `forge:project:${projectId}:preview` }) })
  if (aiUsage.budget.project.blocked || aiUsage.budget.monthly.blocked) errors.push({ projectId, error: normalizeForgeOperatorError("Further AI work is blocked by a configured budget limit.", { stage: "budget", category: "budget_exceeded", retryable: false, technicalReference: `forge:project:${projectId}:budget` }) })
  if (!integrations.some((integration) => integration.enabled) && stages.find((stage) => stage.key === "launch")?.status !== "pending") errors.push({ projectId, error: normalizeForgeOperatorError("No enabled project integration is recorded.", { stage: "launch", category: "integration_missing", retryable: false, technicalReference: `forge:project:${projectId}:integration` }) })
  if (deploy.notes && !deploy.ready && deploy.notes.readiness.failed.length) errors.push({ projectId, error: normalizeForgeOperatorError(deploy.notes.readiness.failed.join(" "), { stage: "launch", category: "deployment_blocked", retryable: false, technicalReference: `forge:project:${projectId}:deployment` }) })
  const stepByJob = new Map(runSteps.filter((step) => step.jobId).map((step) => [step.jobId!, step]))
  const healthJobs: ForgeHealthJob[] = jobs.map((job) => { const step = stepByJob.get(job.id); return { id: job.id, projectId, runId: step?.runId ?? null, kind: job.kind, stage: step?.stage ?? job.kind, status: job.status, attempts: 0, maxAttempts: 3, scheduledAt: job.scheduledAt, heartbeatAt: job.heartbeatAt, completedAt: ["failed", "dead_letter"].includes(job.status) ? job.updatedAt : null, failureReason: job.error, operatorError: step?.operatorErrorJson ?? null } })
  return deriveForgeAttentionItems({ projects: [{ id: projectId, name: project.name, businessName: project.businessName }], jobs: healthJobs, errors }).map((item) => ({
    id: item.id,
    title: attentionTitle(item.category),
    reason: item.explanation,
    action: item.recommendedAction,
    actionLabel: item.availableActions.includes("approve") ? "Review output" : item.availableActions.includes("configure") ? "Configure" : item.availableActions.includes("retry") ? "Retry safely" : "Open details",
    severity: item.severity === "low" ? "medium" : item.severity,
    view: item.category === "workspace_error" ? "preview" : item.category === "approval_required" || item.category === "quality_failure" || item.category === "deployment_blocked" ? "build" : "advanced",
    stage: productionStage(item.stage),
    availableActions: item.availableActions,
    jobId: item.technicalDetails.jobId,
    technicalReference: item.technicalDetails.reference,
  }))
}

function ProjectJobAction({ jobId, action }: { jobId: number; action: "retry" | "cancel" }) {
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    const response = await fetch(`/api/forge/jobs/${jobId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) })
    if (response.ok) window.location.reload()
    setBusy(false)
  }
  return <button type="button" disabled={busy} className="forge-row-action" onClick={() => void run()}>{busy ? "Working…" : labelize(action)}</button>
}

function attentionTitle(category: string) {
  return labelize(category === "quality_failure" ? "Quality check failed" : category)
}

function productionStage(stage: string | null): ProductionStage | undefined {
  return stage && ["brief", "research", "site-plan", "copy", "design", "components", "build", "seo", "quality", "preview", "client-review", "launch"].includes(stage)
    ? stage as ProductionStage
    : undefined
}

function stageForAgent(agent: ForgeTaskAgentType): ProductionStage {
  if (agent === "intake") return "brief"
  if (agent === "research") return "research"
  if (agent === "strategy" || agent === "sitemap") return "site-plan"
  if (agent === "copy") return "copy"
  if (agent === "design") return "design"
  if (agent === "frontend") return "build"
  if (agent === "seo") return "seo"
  if (agent === "qa" || agent === "repair") return "quality"
  if (agent === "deploy") return "launch"
  return "build"
}

function resolvePrimaryProjectAction(input: {
  projectStatus: ForgeProjectFormValue["status"]
  currentStep: CockpitStage
  failedTasks: ForgeTaskRow[]
  activeTasks: ForgeTaskRow[]
  intake: ForgeIntakeState
  generatedCode: ForgeGeneratedCodeArtifactState
  qa: ForgeQaArtifactState
  preview: ForgePreviewState | null
  deploy: ForgeDeployArtifactState
}): { label: string; view: WorkspaceView; stage?: ProductionStage } {
  if (input.failedTasks.length) return { label:"Resolve Failure", view:"attention" }
  if (input.activeTasks.length) return { label:"Continue Run", view:"build", stage:input.currentStep.key }
  if (input.deploy.ready || input.projectStatus === "ready_to_deploy") return { label:"Deploy", view:"build", stage:"launch" }
  if (input.qa.status === "passed" && input.preview?.status === "running") return { label:"Approve for Launch", view:"preview", stage:"client-review" }
  if (input.generatedCode.status === "generated") return { label:"Review Preview", view:"preview", stage:"preview" }
  if (input.intake.status !== "completed") return { label:"Approve Brief", view:"build", stage:"brief" }
  if (input.projectStatus === "build") return { label:"Continue Run", view:"build", stage:input.currentStep.key }
  return { label:"Start Build", view:"build", stage:input.currentStep.key }
}

function nextStage(stages: CockpitStage[], current: CockpitStage) {
  const index = stages.findIndex((stage) => stage.key === current.key)
  return stages[index + 1] ?? null
}

function estimateRemainingCost(usage: ForgeAiUsageMetrics, progress: number) {
  if (progress <= 0 || usage.totals.estimatedCost <= 0) return "Not enough run data"
  return formatCost(Math.max(0, usage.totals.estimatedCost * ((100 - progress) / progress)))
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

function RailRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-[8px] border px-3 py-2" style={{ background:T.s2, borderColor:T.b1 }}>
      <Icon size={13} style={{ color:"#38bdf8" }} aria-hidden="true" />
      <span className="shrink-0 font-dm text-[11px]" style={{ color:T.t3 }}>{label}</span>
      <span className="truncate font-dm text-[11px] font-semibold" style={{ color:T.t1 }}>{value}</span>
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
  projectStatus,
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
  projectStatus: ForgeProjectFormValue["status"]
}): CockpitStage[] {
  const strategyStatus = sitemap.status === "approved" ? "approved" : sitemap.status === "draft" ? "needs_review" : stageTaskStatus(tasks, ["strategy", "sitemap"], "needs_review")
  const copyStatus = copy.status === "approved" ? "approved" : copy.status === "draft" ? "needs_review" : stageTaskStatus(tasks, ["copy"], "needs_review")
  const designStatus = design.status === "approved" ? "approved" : design.status === "draft" ? "needs_review" : stageTaskStatus(tasks, ["design"], "needs_review")
  const buildStatus = generatedCode.status === "generated" ? "complete" : stageTaskStatus(tasks, ["frontend"], "needs_review")
  const critiqueStatus = visualCritique.status === "approved" ? "approved" : visualCritique.status === "draft" ? "needs_review" : stageTaskStatus(tasks, ["qa"], "needs_review")
  const qaStatus = qa.status === "passed" ? "complete" : qa.status === "failed" ? "failed" : stageTaskStatus(tasks, ["qa", "repair"], "needs_review")
  return [
    {
      key: "brief",
      label: "Brief",
      status: intake.status === "completed" ? "approved" : (intake.completenessScore ?? 0) > 0 ? "needs_review" : stageTaskStatus(tasks, ["intake"], "needs_review"),
      detail: `${intake.completenessScore ?? 0}% complete`,
      tab: "intake",
    },
    {
      key: "research",
      label: "Research",
      status: stageArtifactStatus(tasks, artifacts, ["research"], ["research_report"]),
      detail: "Industry and site-type strategy pack",
      tab: "strategy",
    },
    {
      key: "site-plan",
      label: "Site plan",
      status: strategyStatus,
      detail: sitemap.approvedStrategy ? `${sitemap.approvedStrategy.sitemap.length} planned page${sitemap.approvedStrategy.sitemap.length === 1 ? "" : "s"}` : "Sitemap and section plan",
      tab: "strategy",
    },
    {
      key: "copy",
      label: "Copy",
      status: copyStatus,
      detail: copy.approvedCopy ? `${copy.approvedCopy.pages.length} approved page${copy.approvedCopy.pages.length === 1 ? "" : "s"}` : "Page copy and CTA language",
      tab: "strategy",
    },
    {
      key: "design",
      label: "Design",
      status: designStatus,
      detail: design.approvedDirection ? design.approvedDirection.selectedStylePack : "Direction, tokens and motion",
      tab: "strategy",
    },
    {
      key: "components",
      label: "Components",
      status: stageArtifactStatus(tasks, artifacts, ["design"], ["component_spec"]),
      detail: "Reusable component specification",
      tab: "strategy",
    },
    {
      key: "build",
      label: "Build",
      status: buildStatus,
      detail: generatedCode.summary ? `${generatedCode.summary.fileCount} generated files` : "Generated site workspace",
      tab: "build",
    },
    {
      key: "seo",
      label: "SEO",
      status: seo.status === "generated" ? "complete" : stageTaskStatus(tasks, ["seo"], "needs_review"),
      detail: seo.score ? `SEO/AEO/GEO ${seo.score.overall}/100` : "Metadata and JSON-LD",
      tab: "build",
    },
    {
      key: "quality",
      label: "Quality",
      status: qaStatus === "needs_review" ? critiqueStatus : qaStatus,
      detail: qa.report ? `${qa.report.commands.length} mandatory checks` : visualCritique.score === null ? "Critique, QA and repair" : `Critique ${visualCritique.score}/100`,
      tab: "qa",
    },
    {
      key: "preview",
      label: "Preview",
      status: preview?.status === "running" ? "running" : preview?.status === "failed" ? "failed" : qa.status === "passed" ? "needs_review" : "pending",
      detail: preview?.url ?? "Generated-site preview",
      tab: "launch",
    },
    {
      key: "client-review",
      label: "Client review",
      status: projectStatus === "client_review" ? "running" : ["ready_to_deploy", "deployed"].includes(projectStatus ?? "") ? "complete" : "pending",
      detail: "Client feedback and release approval",
      tab: "launch",
    },
    {
      key: "launch",
      label: "Launch",
      status: deploy.lifecycle === "deployed" ? "complete" : deploy.ready || projectStatus === "ready_to_deploy" ? "needs_review" : "pending",
      detail: deploy.lifecycle === "deployed" ? "Production deployment complete" : "Release candidate, export and deploy",
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
