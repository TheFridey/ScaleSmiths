"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Download,
  Filter,
  Gauge,
  HeartPulse,
  Layers3,
  PanelLeftClose,
  Plus,
  Search,
  ServerCog,
  Sparkles,
  Wrench,
} from "lucide-react"
import { MobileSheet } from "@/components/admin-shell/AdminShell"
import { useAdminShell } from "@/components/admin-shell/AdminShellContext"
import {
  DetailDrawer,
  EmptyState,
  InlineAlert,
  MetricSummary,
  PageSection,
  StatusBadge,
  WorkspaceHeader,
  WorkspaceShell,
} from "@/components/admin-shell/primitives"
import {
  buildDashboardProjectViews,
  deriveAttentionItems,
  label,
  selectContinueProject,
  type DashboardArtifact,
  type DashboardAttentionItem,
  type DashboardIntegration,
  type DashboardJob,
  type DashboardProject,
  type DashboardProjectView,
  type DashboardRunStatus,
  type DashboardSeverity,
  type DashboardTask,
} from "@/lib/forge-dashboard-model"
import { FORGE_PROJECT_STATUSES, type ForgeProjectStatus } from "@/lib/forge"
import type { ProviderHealthSnapshot } from "@/lib/server/forge-provider-health"
import type { ForgeOperationalHealth } from "@/lib/forge-operational-health"

interface ForgeActivitySummary {
  id: number
  projectId: number
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

type ProjectFilterStatus = "all" | DashboardRunStatus

export function ForgeDashboard({
  projects,
  recentActivity,
  aiMetrics,
  providerHealth,
  dashboardTasks,
  dashboardJobs,
  dashboardArtifacts,
  dashboardIntegrations,
}: {
  projects: DashboardProject[]
  recentActivity: ForgeActivitySummary[]
  aiMetrics: ForgeAiDashboardMetrics
  averageDesignScore: number | null
  providerHealth: ProviderHealthSnapshot
  dashboardTasks: DashboardTask[]
  dashboardJobs: DashboardJob[]
  dashboardArtifacts: DashboardArtifact[]
  dashboardIntegrations: DashboardIntegration[]
}) {
  const { toggleFocusMode } = useAdminShell()
  const [query, setQuery] = useState("")
  const [stage, setStage] = useState<"all" | ForgeProjectStatus>("all")
  const [runStatus, setRunStatus] = useState<ProjectFilterStatus>("all")
  const [telemetryOpen, setTelemetryOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [operationalHealth, setOperationalHealth] = useState<ForgeOperationalHealth | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k" || event.key === "/") {
        const target = event.target
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener("keydown", handleShortcut)
    return () => window.removeEventListener("keydown", handleShortcut)
  }, [])

  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      const response = await fetch("/api/forge/health", { cache: "no-store" })
      const payload = await response.json().catch(() => ({}))
      if (!cancelled && response.ok && payload.health) setOperationalHealth(payload.health)
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 10_000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [])

  const attention = useMemo(
    () => deriveAttentionItems({
      projects,
      tasks: dashboardTasks,
      jobs: dashboardJobs,
      integrations: dashboardIntegrations,
      providers: providerHealth.providers,
      monthlyBudgetBlocked: aiMetrics.budget.monthly.blocked,
    }),
    [aiMetrics.budget.monthly.blocked, dashboardIntegrations, dashboardJobs, dashboardTasks, projects, providerHealth.providers],
  )
  const projectViews = useMemo(
    () => buildDashboardProjectViews({ projects, tasks: dashboardTasks, jobs: dashboardJobs, artifacts: dashboardArtifacts, attention }),
    [attention, dashboardArtifacts, dashboardJobs, dashboardTasks, projects],
  )
  const continueProject = useMemo(() => selectContinueProject(projectViews), [projectViews])
  const filteredProjects = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return projectViews.filter((project) => {
      const matchesQuery = !needle || `${project.name} ${project.businessName}`.toLowerCase().includes(needle)
      return matchesQuery && (stage === "all" || project.status === stage) && (runStatus === "all" || project.runStatus === runStatus)
    })
  }, [projectViews, query, runStatus, stage])
  const systemHealth = deriveSystemHealth(providerHealth, dashboardJobs, operationalHealth)

  return (
    <WorkspaceShell className="forge-dashboard-v2">
      <WorkspaceHeader
        eyebrow="Client production"
        title="Forge"
        description="Move active client sites from the next decision to a production-ready release."
        actions={(
          <>
            {continueProject ? (
              <Link href={`/forge/${continueProject.id}`} className="forge-secondary-action forge-continue-latest">
                <ArrowRight size={17} aria-hidden="true" />
                Continue latest run
              </Link>
            ) : null}
            <button type="button" className="forge-secondary-action" onClick={() => searchRef.current?.focus()}>
              <Search size={17} aria-hidden="true" />
              <span>Search</span>
              <kbd>⌘K</kbd>
            </button>
            <button
              type="button"
              className="forge-secondary-action"
              onClick={toggleFocusMode}
            >
              <PanelLeftClose size={17} aria-hidden="true" />
              Focus mode
            </button>
            <SystemHealthButton health={systemHealth} onClick={() => setTelemetryOpen(true)} />
            <Link href="/forge/new" className="forge-primary-action">
              <Plus size={18} aria-hidden="true" />
              New Project
            </Link>
          </>
        )}
      />

      <div className="forge-dashboard-scroll">
        <div className="forge-dashboard-content">
          {continueProject ? <ContinueWork project={continueProject} /> : (
            <EmptyState
              title="No active production run"
              description="Create a project to start a client website production run."
              action={<Link className="forge-primary-action mt-3" href="/forge/new"><Plus size={17} aria-hidden="true" />New Project</Link>}
            />
          )}

          <AttentionQueue items={attention} />

          <PageSection
            title="Projects"
            description={`${filteredProjects.length} of ${projectViews.length} project${projectViews.length === 1 ? "" : "s"}`}
            actions={(
              <div className="flex items-center gap-2">
                <button type="button" className="forge-filter-button md:hidden" onClick={() => setFiltersOpen(true)}>
                  <Filter size={16} aria-hidden="true" /> Filters
                </button>
                <button type="button" className="forge-filter-button" onClick={() => setTelemetryOpen(true)}>
                  <ServerCog size={16} aria-hidden="true" /> System
                </button>
              </div>
            )}
          >
            <div className="forge-project-filters">
              <label className="forge-search">
                <Search size={17} aria-hidden="true" />
                <span className="sr-only">Search projects</span>
                <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects or clients" />
              </label>
              <div className="hidden gap-2 md:flex">
                <FilterSelect label="Stage" value={stage} onChange={(value) => setStage(value as typeof stage)}>
                  <option value="all">All stages</option>
                  {FORGE_PROJECT_STATUSES.filter((value) => value !== "archived").map((value) => <option key={value} value={value}>{label(value)}</option>)}
                </FilterSelect>
                <FilterSelect label="Run status" value={runStatus} onChange={(value) => setRunStatus(value as ProjectFilterStatus)}>
                  <option value="all">All statuses</option>
                  {(["running", "queued", "failed", "paused", "complete", "idle"] as const).map((value) => <option key={value} value={value}>{label(value)}</option>)}
                </FilterSelect>
              </div>
            </div>

            {filteredProjects.length ? (
              <>
                <ProjectTable projects={filteredProjects} />
                <div className="forge-project-cards">
                  {filteredProjects.map((project) => <ProjectCard key={project.id} project={project} />)}
                </div>
              </>
            ) : (
              <EmptyState title="No projects match" description="Adjust the search or filters to see more projects." />
            )}
          </PageSection>
        </div>
      </div>

      <DetailDrawer open={telemetryOpen} onClose={() => setTelemetryOpen(false)} title="System telemetry">
        <SystemTelemetry
          aiMetrics={aiMetrics}
          providerHealth={providerHealth}
          jobs={dashboardJobs}
          activity={recentActivity}
          systemHealth={systemHealth}
          operationalHealth={operationalHealth}
        />
      </DetailDrawer>

      <MobileSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Project filters">
        <div className="space-y-5 p-2">
          <FilterSelect label="Stage" value={stage} onChange={(value) => setStage(value as typeof stage)}>
            <option value="all">All stages</option>
            {FORGE_PROJECT_STATUSES.filter((value) => value !== "archived").map((value) => <option key={value} value={value}>{label(value)}</option>)}
          </FilterSelect>
          <FilterSelect label="Run status" value={runStatus} onChange={(value) => setRunStatus(value as ProjectFilterStatus)}>
            <option value="all">All statuses</option>
            {(["running", "queued", "failed", "paused", "complete", "idle"] as const).map((value) => <option key={value} value={value}>{label(value)}</option>)}
          </FilterSelect>
          <button type="button" className="forge-primary-action w-full justify-center" onClick={() => setFiltersOpen(false)}>Apply filters</button>
        </div>
      </MobileSheet>
    </WorkspaceShell>
  )
}

function ContinueWork({ project }: { project: DashboardProjectView }) {
  const intervention = project.attention[0]
  const actionLabel = intervention?.actionLabel ?? (project.runStatus === "running" ? "View active run" : "Continue")
  return (
    <section className="continue-work" aria-labelledby="continue-work-title">
      <div className="continue-work-main">
        <div className="flex flex-wrap items-center gap-2">
          <p className="workspace-eyebrow">Continue work</p>
          <StatusBadge tone={runTone(project.runStatus)}>{label(project.runStatus)}</StatusBadge>
          {intervention && <StatusBadge tone={severityTone(intervention.severity)}>{label(intervention.severity)} attention</StatusBadge>}
        </div>
        <h2 id="continue-work-title">{project.name}</h2>
        <p className="continue-business">{project.businessName} · {label(project.status)}</p>
        <p className="continue-summary">{project.summary}</p>

        <div className="continue-progress">
          <div>
            <span>Production progress</span>
            <strong>{project.progress}%</strong>
          </div>
          <div className="progress-track" aria-label={`${project.progress}% complete`}>
            <span style={{ width: `${project.progress}%` }} />
          </div>
        </div>

        {intervention && (
          <InlineAlert tone={intervention.severity === "critical" ? "danger" : "warning"}>
            <strong>{intervention.reason}</strong>
            <span>{intervention.recommendedAction}</span>
          </InlineAlert>
        )}

        <div className="continue-actions">
          <Link href={`/forge/${project.id}`} className="forge-primary-action">
            {intervention ? <Wrench size={17} aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}
            {actionLabel}
          </Link>
          <span>Updated {relativeAge(project.updatedAt)}</span>
        </div>
      </div>

      <div className="latest-output">
        {project.latestArtifact ? (
          <>
            <div className="latest-output-icon"><Sparkles size={22} aria-hidden="true" /></div>
            <p>Latest successful output</p>
            <h3>{project.latestArtifact.title}</h3>
            <span>{label(project.latestArtifact.type)} · Version {project.latestArtifact.version}</span>
            <Link href={`/forge/${project.id}`}>Open output <ArrowRight size={14} aria-hidden="true" /></Link>
          </>
        ) : (
          <>
            <div className="latest-output-icon"><Layers3 size={22} aria-hidden="true" /></div>
            <p>Latest output</p>
            <h3>Nothing generated yet</h3>
            <span>Continue the current stage to create the first production artifact.</span>
          </>
        )}
      </div>
    </section>
  )
}

function AttentionQueue({ items }: { items: DashboardAttentionItem[] }) {
  const groups = [...items.reduce((grouped, item) => grouped.set(item.projectId, [...(grouped.get(item.projectId) ?? []), item]), new Map<number, DashboardAttentionItem[]>()).values()]
  return (
    <PageSection
      title="Needs Attention"
      description={items.length ? `${items.length} intervention${items.length === 1 ? "" : "s"} blocking or slowing client work` : "No recorded intervention is blocking active work"}
      className="attention-section"
    >
      {items.length ? (
        <div className="attention-list">
          {groups.map((group) => group?.length ? <details key={group[0].projectId} open={groups.length === 1} className="attention-project-group"><summary><strong>{group[0].projectName}</strong><span>{group.length} active incident{group.length === 1 ? "" : "s"}</span></summary>{group.map((item) => (
            <article key={item.id} className="attention-item">
              <SeverityMark severity={item.severity} />
              <div className="attention-copy">
                <div className="flex flex-wrap items-center gap-2">
                  <h3>{item.stageLabel}</h3>
                  <StatusBadge tone={severityTone(item.severity)}>{label(item.severity)}</StatusBadge>
                  {item.runId ? <span>Run #{item.runId}</span> : null}
                  {item.jobId ? <span>Job #{item.jobId}</span> : null}
                  <span>{relativeAge(item.occurredAt)}</span>
                </div>
                <p>{item.reason}</p>
                <small>{item.recommendedAction}</small>
                {item.retryState ? <small>Attempt {item.retryState.latestAttempt} of {item.retryState.maxAttempts} · {item.retryState.priorAttemptCount} prior</small> : null}
                <details><summary>Technical details</summary><code>{item.technicalReference}</code></details>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {item.jobId && item.availableActions.includes("retry_fallback") ? <JobActionButton jobId={item.jobId} action="retry" label="Retry with fallback provider" /> : null}
                {item.jobId && item.availableActions.includes("retry") ? <JobActionButton jobId={item.jobId} action="retry" label="Retry" /> : null}
                {item.jobId && item.availableActions.includes("cancel") ? <JobActionButton jobId={item.jobId} action="cancel" label="Cancel" /> : null}
                <Link href={item.href} className="forge-row-action">{item.actionLabel}<ArrowRight size={15} aria-hidden="true" /></Link>
              </div>
            </article>
          ))}</details> : null)}
        </div>
      ) : (
        <div className="attention-clear"><CheckCircle2 size={20} aria-hidden="true" /><span>Active projects have no recorded blockers.</span></div>
      )}
    </PageSection>
  )
}

function JobActionButton({ jobId, action, label: buttonLabel }: { jobId: number; action: "retry" | "cancel"; label: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const run = async () => {
    setBusy(true)
    setError("")
    const response = await fetch(`/api/forge/jobs/${jobId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) setError(result.operatorError?.summary ?? result.error ?? "The job action is unavailable.")
    else window.location.reload()
    setBusy(false)
  }
  return <span><button type="button" className="forge-row-action" disabled={busy} onClick={() => void run()}>{busy ? "Working…" : buttonLabel}</button>{error ? <small role="alert">{error}</small> : null}</span>
}

function ProjectTable({ projects }: { projects: DashboardProjectView[] }) {
  return (
    <div className="forge-project-table-wrap">
      <table className="forge-project-table">
        <thead>
          <tr>
            <th>Project</th>
            <th>Client / business</th>
            <th>Current stage</th>
            <th>Run status</th>
            <th>Progress</th>
            <th>Attention</th>
            <th>Updated</th>
            <th><span className="sr-only">Action</span></th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr key={project.id}>
              <td><Link href={`/forge/${project.id}`}>{project.name}</Link></td>
              <td>{project.businessName}</td>
              <td>{label(project.status)}</td>
              <td><StatusBadge tone={runTone(project.runStatus)}>{label(project.runStatus)}</StatusBadge></td>
              <td><CompactProgress value={project.progress} /></td>
              <td>{project.attention[0] ? <StatusBadge tone={severityTone(project.attention[0].severity)}>{shortAttention(project.attention[0])}</StatusBadge> : <span className="muted-value">Clear</span>}</td>
              <td>{relativeAge(project.updatedAt)}</td>
              <td><Link href={`/forge/${project.id}`} className="forge-row-action">{project.attention[0] ? "Resolve" : "Open"}<ArrowRight size={15} aria-hidden="true" /></Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ProjectCard({ project }: { project: DashboardProjectView }) {
  return (
    <article className="forge-project-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3>{project.name}</h3>
          <p>{project.businessName}</p>
        </div>
        <StatusBadge tone={runTone(project.runStatus)}>{label(project.runStatus)}</StatusBadge>
      </div>
      <dl>
        <div><dt>Stage</dt><dd>{label(project.status)}</dd></div>
        <div><dt>Updated</dt><dd>{relativeAge(project.updatedAt)}</dd></div>
      </dl>
      <CompactProgress value={project.progress} />
      {project.attention[0] && <InlineAlert tone={project.attention[0].severity === "critical" ? "danger" : "warning"}>{project.attention[0].reason}</InlineAlert>}
      <Link href={`/forge/${project.id}`} className="forge-primary-action w-full justify-center">{project.attention[0] ? "Resolve" : "Open project"}<ArrowRight size={16} aria-hidden="true" /></Link>
    </article>
  )
}

function SystemTelemetry({
  aiMetrics,
  providerHealth,
  jobs,
  activity,
  systemHealth,
  operationalHealth,
}: {
  aiMetrics: ForgeAiDashboardMetrics
  providerHealth: ProviderHealthSnapshot
  jobs: DashboardJob[]
  activity: ForgeActivitySummary[]
  systemHealth: ReturnType<typeof deriveSystemHealth>
  operationalHealth: ForgeOperationalHealth | null
}) {
  const activeJobs = jobs.filter((job) => job.status === "queued" || job.status === "running")
  const latestHeartbeat = operationalHealth?.lastHeartbeat ?? [...jobs].filter((job) => job.heartbeatAt).sort((a, b) => new Date(b.heartbeatAt!).getTime() - new Date(a.heartbeatAt!).getTime())[0]?.heartbeatAt
  return (
    <div className="system-telemetry">
      <InlineAlert tone={systemHealth.tone === "danger" ? "danger" : systemHealth.tone === "warning" ? "warning" : "success"}>
        <strong>{systemHealth.label}</strong>
        <span>{systemHealth.detail}</span>
      </InlineAlert>

      <div className="telemetry-grid">
        <MetricSummary label="AI spend today" value={formatGbp(aiMetrics.todaySpend)} detail="Estimated provider usage completed today" />
        <MetricSummary label="Monthly AI spend" value={formatGbp(aiMetrics.monthSpend)} detail={budgetDescription(aiMetrics)} tone={aiMetrics.budget.monthly.blocked ? "critical" : aiMetrics.budget.monthly.warning ? "warning" : "default"} />
        <MetricSummary
          label="Average cost per completed site"
          value={aiMetrics.averageCostPerSite > 0 ? formatGbp(aiMetrics.averageCostPerSite) : "No completed sites"}
          detail={aiMetrics.averageCostPerSite > 0 ? "Deployed sites with usage this month" : "A value appears after a site is deployed with recorded AI usage."}
        />
        <MetricSummary label="Queue health" value={`${operationalHealth?.queueDepth ?? activeJobs.length} queued`} detail={`${operationalHealth?.activeJobs ?? activeJobs.length} active; ${operationalHealth?.deadLetterJobs ?? jobs.filter((job) => job.status === "dead_letter").length} dead-letter`} />
      </div>

      <section className="telemetry-section">
        <h3><HeartPulse size={17} aria-hidden="true" /> Provider health</h3>
        {providerHealth.providers.length ? providerHealth.providers.map((provider) => (
          <div key={provider.provider} className="telemetry-row">
            <span>{label(provider.provider)}</span>
            <StatusBadge tone={provider.state === "closed" ? "success" : provider.state === "open" ? "danger" : "warning"}>{label(provider.state)}</StatusBadge>
          </div>
        )) : <p className="telemetry-empty">No real AI providers are configured, so provider health is unavailable.</p>}
      </section>

      <section className="telemetry-section">
        <h3><Gauge size={17} aria-hidden="true" /> Worker heartbeat</h3>
        <p>{latestHeartbeat ? `${operationalHealth?.currentWorkerIdentity ?? "Worker"} · last heartbeat ${relativeAge(latestHeartbeat)}.` : "No Forge worker heartbeat has been recorded."}</p>
        {operationalHealth ? <p>Average queue wait {duration(operationalHealth.averageQueueWaitMs)} · average run {duration(operationalHealth.averageRunDurationMs)} · recovered leases {operationalHealth.recoveredLeases}.</p> : null}
      </section>

      <section className="telemetry-section">
        <h3><Activity size={17} aria-hidden="true" /> Recent technical events</h3>
        {activity.length ? activity.map((event) => (
          <div key={event.id} className="technical-event">
            <strong>{label(event.action)}</strong>
            <span>{event.message}</span>
            <small>{relativeAge(event.createdAt)}</small>
          </div>
        )) : <p className="telemetry-empty">No Forge activity has been recorded yet.</p>}
      </section>

      <div className="telemetry-actions">
        <Link href="/forge/economics" className="forge-secondary-action"><CircleDollarSign size={17} aria-hidden="true" />Economics</Link>
        <Link href="/api/forge/ai-usage/export" className="forge-secondary-action"><Download size={17} aria-hidden="true" />Export CSV</Link>
      </div>
    </div>
  )
}

function SystemHealthButton({ health, onClick }: { health: ReturnType<typeof deriveSystemHealth>; onClick: () => void }) {
  return (
    <button type="button" className="system-health-button" onClick={onClick}>
      <span className={`system-health-dot tone-${health.tone}`} />
      <span>{health.label}</span>
      <ChevronDown size={15} aria-hidden="true" />
    </button>
  )
}

function deriveSystemHealth(providerHealth: ProviderHealthSnapshot, jobs: DashboardJob[], operationalHealth: ForgeOperationalHealth | null) {
  const unavailable = providerHealth.providers.filter((provider) => provider.state === "open").length
  const failed = jobs.filter((job) => job.status === "failed" || job.status === "dead_letter").length
  const stale = jobs.filter((job) => job.status === "queued" && Date.now() - new Date(job.scheduledAt).getTime() >= 15 * 60_000).length
  if (operationalHealth?.state === "offline" || operationalHealth?.deadLetterJobs || unavailable || failed) return { label: "System attention", detail: operationalHealth?.signals[0]?.summary ?? `${unavailable} unavailable provider${unavailable === 1 ? "" : "s"}; ${failed} failed job${failed === 1 ? "" : "s"}.`, tone: "danger" as const }
  if (operationalHealth?.state === "degraded") return { label: "System degraded", detail: operationalHealth.signals[0]?.summary ?? "Worker heartbeat is degraded.", tone: "warning" as const }
  if (stale) return { label: "System degraded", detail: `${stale} queued job${stale === 1 ? "" : "s"} may be stale.`, tone: "warning" as const }
  return { label: "Systems healthy", detail: "Providers and durable jobs have no recorded blocker.", tone: "success" as const }
}

function duration(value: number | null) {
  if (value === null) return "not available"
  if (value < 1_000) return `${Math.round(value)}ms`
  if (value < 60_000) return `${Math.round(value / 1_000)}s`
  return `${Math.round(value / 60_000)}m`
}

function FilterSelect({ label: selectLabel, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label className="forge-filter-select">
      <span>{selectLabel}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>
    </label>
  )
}

function CompactProgress({ value }: { value: number }) {
  return (
    <div className="compact-progress">
      <div className="progress-track"><span style={{ width: `${value}%` }} /></div>
      <span>{value}%</span>
    </div>
  )
}

function SeverityMark({ severity }: { severity: DashboardSeverity }) {
  return <span className={`severity-mark tone-${severity}`}><AlertTriangle size={17} aria-hidden="true" /><span className="sr-only">{label(severity)} severity</span></span>
}

function runTone(status: DashboardRunStatus): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "failed") return "danger"
  if (status === "paused" || status === "queued") return "warning"
  if (status === "running") return "info"
  if (status === "complete") return "success"
  return "neutral"
}

function severityTone(severity: DashboardSeverity): "neutral" | "info" | "success" | "warning" | "danger" {
  if (severity === "critical" || severity === "high") return "danger"
  if (severity === "medium") return "warning"
  return "neutral"
}

function shortAttention(item: DashboardAttentionItem) {
  const labels: Record<DashboardAttentionItem["kind"], string> = {
    approval: "Approval required",
    failure: "Run failed",
    integration: "Integration missing",
    budget: "Budget exhausted",
    stale_job: "Queue stale",
    provider: "Provider unavailable",
    qa: "QA failed",
    deployment: "Deployment blocked",
  }
  return labels[item.kind]
}

function relativeAge(value: Date | string) {
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return "date unavailable"
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000))
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatGbp(value: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value)
}

function budgetDescription(metrics: ForgeAiDashboardMetrics) {
  if (metrics.budget.monthly.limit === null) return "No monthly budget limit is configured."
  return `${formatGbp(metrics.monthSpend)} of ${formatGbp(metrics.budget.monthly.limit)} configured monthly budget.`
}
