import { FORGE_PROJECT_STATUSES, type ForgeProjectStatus, type ForgeTaskAgentType, type ForgeTaskStatus } from "./forge"
import { deriveForgeAttentionItems as deriveUnifiedAttention, type ForgeHealthJob } from "./forge-operational-health"
import { normalizeForgeOperatorError } from "./forge-operator-error"

export type DashboardSeverity = "critical" | "high" | "medium" | "low"
export type DashboardRunStatus = "failed" | "paused" | "running" | "queued" | "complete" | "idle"

export interface DashboardProject {
  id: number
  name: string
  businessName: string
  status: ForgeProjectStatus
  priority: "low" | "medium" | "high"
  deadline: Date | string | null
  updatedAt: Date | string
}

export interface DashboardTask {
  id: number
  projectId: number
  title: string
  agentType: ForgeTaskAgentType
  status: ForgeTaskStatus
  resultQuality: string
  error: string | null
  providerAttempted: string | null
  humanApprovalRequired: boolean
  publicationBlocked: boolean
  qualityApprovedAt: Date | string | null
  createdAt: Date | string
  updatedAt: Date | string
}

export interface DashboardJob {
  id: number
  projectId: number
  kind: string
  status: string
  error: string | null
  heartbeatAt: Date | string | null
  scheduledAt: Date | string
  updatedAt: Date | string
}

export interface DashboardArtifact {
  id: number
  projectId: number
  title: string
  type: string
  version: number
  qualityState: string
  approvalState: string
  updatedAt: Date | string
}

export interface DashboardIntegration {
  projectId: number
  provider: string
  enabled: boolean
}

export interface DashboardProvider {
  provider: string
  state: string
}

export interface DashboardAttentionItem {
  id: string
  projectId: number
  projectName: string
  businessName: string
  reason: string
  severity: DashboardSeverity
  occurredAt: Date
  recommendedAction: string
  actionLabel: string
  href: string
  kind: "approval" | "failure" | "integration" | "budget" | "stale_job" | "provider" | "qa" | "deployment"
  availableActions: Array<"retry" | "retry_fallback" | "cancel" | "approve" | "configure" | "open">
  jobId: number | null
  technicalReference: string
}

export interface DashboardProjectView extends DashboardProject {
  progress: number
  runStatus: DashboardRunStatus
  attention: DashboardAttentionItem[]
  currentTask: DashboardTask | null
  latestArtifact: DashboardArtifact | null
  summary: string
}

const STAGE_PROGRESS = new Map(FORGE_PROJECT_STATUSES.map((status, index) => [status, Math.round((index / (FORGE_PROJECT_STATUSES.length - 2)) * 100)]))
STAGE_PROGRESS.set("deployed", 100)
STAGE_PROGRESS.set("archived", 100)

export function deriveAttentionItems(input: {
  projects: DashboardProject[]
  tasks: DashboardTask[]
  jobs: DashboardJob[]
  integrations: DashboardIntegration[]
  providers: DashboardProvider[]
  monthlyBudgetBlocked?: boolean
  now?: Date
}): DashboardAttentionItem[] {
  const now = input.now ?? new Date()
  const enabledIntegrations = new Set(input.integrations.filter((row) => row.enabled).map((row) => row.projectId))
  const unavailableProviders = new Set(input.providers.filter((provider) => provider.state === "open").map((provider) => provider.provider))
  const errors: Array<{ projectId: number; error: ReturnType<typeof normalizeForgeOperatorError> }> = []
  for (const task of input.tasks) {
    if (task.status === "failed") {
      const qaFailure = task.agentType === "qa"
      errors.push({ projectId: task.projectId, error: normalizeForgeOperatorError(task.error ?? `${task.title} failed.`, {
        stage: task.agentType,
        category: qaFailure ? "quality_failure" : task.agentType === "deploy" ? "deployment_blocked" : undefined,
        retryable: task.agentType !== "deploy",
        technicalReference: `forge:task:${task.id}`,
        timestamp: date(task.updatedAt),
        metadata: { taskId: task.id, agentType: task.agentType },
      }) })
      continue
    }
    if (task.status === "completed" && task.humanApprovalRequired && !task.qualityApprovedAt) {
      errors.push({ projectId: task.projectId, error: normalizeForgeOperatorError(`${task.title} is waiting for human approval.`, { stage: task.agentType, category: "approval_required", retryable: false, technicalReference: `forge:task:${task.id}:approval`, timestamp: date(task.updatedAt) }) })
    }
    if (task.publicationBlocked && task.status === "completed" && !task.qualityApprovedAt) {
      errors.push({ projectId: task.projectId, error: normalizeForgeOperatorError("Publication is blocked by an unapproved output.", { stage: task.agentType, category: "deployment_blocked", retryable: false, technicalReference: `forge:task:${task.id}:publication`, timestamp: date(task.updatedAt) }) })
    }
  }
  for (const project of input.projects) {
    if (project.status === "integrations" && !enabledIntegrations.has(project.id)) {
      errors.push({ projectId: project.id, error: normalizeForgeOperatorError("No enabled integration is configured for this stage.", { stage: "integrations", category: "integration_missing", retryable: false, technicalReference: `forge:project:${project.id}:integration`, timestamp: date(project.updatedAt) }) })
    }
  }
  if (input.monthlyBudgetBlocked) {
    const candidate = selectPriorityCandidate(input.projects, input.tasks, input.jobs)
    if (candidate) errors.push({ projectId: candidate.id, error: normalizeForgeOperatorError("The monthly Forge AI budget is exhausted.", { stage: "budget", category: "budget_exceeded", retryable: false, technicalReference: `forge:project:${candidate.id}:budget`, timestamp: now }) })
  }
  const jobs: ForgeHealthJob[] = input.jobs.map((job) => ({
    id: job.id, projectId: job.projectId, kind: job.kind, stage: job.kind, status: job.status,
    attempts: 0, maxAttempts: 3, scheduledAt: job.scheduledAt, heartbeatAt: job.heartbeatAt,
    failureReason: job.error, completedAt: ["failed", "dead_letter"].includes(job.status) ? job.updatedAt : null,
  }))
  const providerOutages = [...unavailableProviders].map((provider) => ({
    provider,
    projectIds: input.tasks.filter((task) => task.providerAttempted === provider && ["queued", "running"].includes(task.status)).map((task) => task.projectId),
    occurredAt: now,
    fallbackAvailable: input.providers.some((candidate) => candidate.provider !== provider && candidate.state !== "open"),
  }))
  return deriveUnifiedAttention({ projects: input.projects, jobs, providerOutages, errors, now }).map((item) => {
    const kind = dashboardKind(item.category)
    return {
      id: item.id,
      projectId: item.projectId,
      projectName: item.projectName,
      businessName: item.businessName,
      reason: item.explanation,
      severity: kind === "qa" ? "critical" : item.severity,
      occurredAt: item.occurredAt,
      recommendedAction: item.recommendedAction,
      actionLabel: actionLabelFor(kind),
      href: item.deepLink,
      kind,
      availableActions: item.availableActions,
      jobId: item.technicalDetails.jobId,
      technicalReference: item.technicalDetails.reference,
    }
  })
}

export function buildDashboardProjectViews(input: {
  projects: DashboardProject[]
  tasks: DashboardTask[]
  jobs: DashboardJob[]
  artifacts: DashboardArtifact[]
  attention: DashboardAttentionItem[]
}): DashboardProjectView[] {
  return input.projects.map((project) => {
    const tasks = input.tasks.filter((task) => task.projectId === project.id)
    const jobs = input.jobs.filter((job) => job.projectId === project.id)
    const currentTask = [...tasks]
      .filter((task) => task.status === "running" || task.status === "queued")
      .sort((a, b) => date(b.updatedAt).getTime() - date(a.updatedAt).getTime())[0] ?? null
    const latestArtifact = [...input.artifacts]
      .filter((artifact) => artifact.projectId === project.id && artifact.qualityState !== "failed")
      .sort((a, b) => date(b.updatedAt).getTime() - date(a.updatedAt).getTime())[0] ?? null
    const attention = input.attention.filter((item) => item.projectId === project.id)
    const runStatus = resolveRunStatus(tasks, jobs, project.status)
    return {
      ...project,
      progress: STAGE_PROGRESS.get(project.status) ?? 0,
      runStatus,
      attention,
      currentTask,
      latestArtifact,
      summary: currentTask
        ? `${currentTask.title} is ${currentTask.status}.`
        : attention[0]
          ? attention[0].recommendedAction
          : project.status === "deployed"
            ? "The site has been deployed."
            : `The project is ready to continue from ${label(project.status)}.`,
    }
  })
}

export function selectContinueProject(projects: DashboardProjectView[]): DashboardProjectView | null {
  return [...projects]
    .filter((project) => project.status !== "archived" && project.status !== "deployed")
    .sort((a, b) => {
      const humanA = a.attention.some((item) => item.kind === "approval" || item.kind === "deployment" || item.kind === "budget") ? 0 : 1
      const humanB = b.attention.some((item) => item.kind === "approval" || item.kind === "deployment" || item.kind === "budget") ? 0 : 1
      if (humanA !== humanB) return humanA - humanB
      const failureA = a.runStatus === "failed" || a.runStatus === "paused" ? 0 : 1
      const failureB = b.runStatus === "failed" || b.runStatus === "paused" ? 0 : 1
      if (failureA !== failureB) return failureA - failureB
      const activeA = a.runStatus === "running" || a.runStatus === "queued" ? 0 : 1
      const activeB = b.runStatus === "running" || b.runStatus === "queued" ? 0 : 1
      if (activeA !== activeB) return activeA - activeB
      const deadlineA = a.deadline ? date(a.deadline).getTime() : Number.POSITIVE_INFINITY
      const deadlineB = b.deadline ? date(b.deadline).getTime() : Number.POSITIVE_INFINITY
      if (deadlineA !== deadlineB) return deadlineA - deadlineB
      const updated = date(b.updatedAt).getTime() - date(a.updatedAt).getTime()
      return updated || a.id - b.id
    })[0] ?? null
}

function resolveRunStatus(tasks: DashboardTask[], jobs: DashboardJob[], projectStatus: ForgeProjectStatus): DashboardRunStatus {
  if (tasks.some((task) => task.status === "failed") || jobs.some((job) => job.status === "failed" || job.status === "dead_letter")) return "failed"
  if (jobs.some((job) => job.status === "cancelled")) return "paused"
  if (tasks.some((task) => task.status === "running") || jobs.some((job) => job.status === "running")) return "running"
  if (tasks.some((task) => task.status === "queued") || jobs.some((job) => job.status === "queued")) return "queued"
  if (projectStatus === "deployed" || projectStatus === "ready_to_deploy") return "complete"
  return "idle"
}

function selectPriorityCandidate(projects: DashboardProject[], tasks: DashboardTask[], jobs: DashboardJob[]) {
  return [...projects]
    .filter((project) => project.status !== "archived" && project.status !== "deployed")
    .sort((a, b) => {
      const activeA = tasks.some((task) => task.projectId === a.id && ["queued", "running"].includes(task.status)) || jobs.some((job) => job.projectId === a.id && ["queued", "running"].includes(job.status))
      const activeB = tasks.some((task) => task.projectId === b.id && ["queued", "running"].includes(task.status)) || jobs.some((job) => job.projectId === b.id && ["queued", "running"].includes(job.status))
      return Number(activeB) - Number(activeA) || date(b.updatedAt).getTime() - date(a.updatedAt).getTime()
    })[0] ?? null
}

function dashboardKind(category: string): DashboardAttentionItem["kind"] {
  if (category === "approval_required") return "approval"
  if (category === "integration_missing") return "integration"
  if (category === "budget_exceeded") return "budget"
  if (category === "queue_stalled") return "stale_job"
  if (category.startsWith("provider_")) return "provider"
  if (category === "quality_failure") return "qa"
  if (category === "deployment_blocked") return "deployment"
  return "failure"
}

function actionLabelFor(kind: DashboardAttentionItem["kind"]) {
  const values: Record<DashboardAttentionItem["kind"], string> = {
    approval: "Review output",
    failure: "Review failure",
    integration: "Configure",
    budget: "Review budget",
    stale_job: "Inspect queue",
    provider: "Review provider",
    qa: "Resolve QA",
    deployment: "Open release gate",
  }
  return values[kind]
}

function date(value: Date | string) {
  return value instanceof Date ? value : new Date(value)
}

export function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}
