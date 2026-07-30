import { describe, expect, it } from "vitest"
import {
  buildDashboardProjectViews,
  deriveAttentionItems,
  selectContinueProject,
  type DashboardJob,
  type DashboardProject,
  type DashboardTask,
} from "./forge-dashboard-model"

const now = new Date("2026-07-29T12:00:00.000Z")

function project(id: number, overrides: Partial<DashboardProject> = {}): DashboardProject {
  return {
    id,
    name: `Project ${id}`,
    businessName: `Business ${id}`,
    status: "design",
    priority: "medium",
    deadline: null,
    updatedAt: new Date(`2026-07-${20 + id}T10:00:00.000Z`),
    ...overrides,
  }
}

function task(id: number, projectId: number, overrides: Partial<DashboardTask> = {}): DashboardTask {
  return {
    id,
    projectId,
    title: `Task ${id}`,
    agentType: "design",
    status: "completed",
    resultQuality: "validated",
    error: null,
    providerAttempted: null,
    humanApprovalRequired: false,
    publicationBlocked: false,
    qualityApprovedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function job(id: number, projectId: number, overrides: Partial<DashboardJob> = {}): DashboardJob {
  return {
    id,
    projectId,
    kind: "generate_site",
    status: "completed",
    error: null,
    heartbeatAt: now,
    scheduledAt: now,
    updatedAt: now,
    ...overrides,
  }
}

it("prioritises human intervention, then failures, active runs, deadlines, and recency", () => {
  const projects = [
    project(1, { deadline: "2026-07-30T12:00:00.000Z" }),
    project(2),
    project(3),
    project(4, { updatedAt: "2026-07-29T11:00:00.000Z" }),
  ]
  const tasks = [
    task(1, 1, { status: "running" }),
    task(2, 2, { status: "failed", error: "Provider failed" }),
    task(3, 3, { humanApprovalRequired: true, qualityApprovedAt: null }),
  ]
  const attention = deriveAttentionItems({ projects, tasks, jobs: [], integrations: [], providers: [], now })
  const views = buildDashboardProjectViews({ projects, tasks, jobs: [], artifacts: [], attention })
  expect(selectContinueProject(views)?.id).toBe(3)

  const withoutApproval = views.map((view) => view.id === 3 ? { ...view, attention: [] } : view)
  expect(selectContinueProject(withoutApproval)?.id).toBe(2)

  const withoutFailure = withoutApproval.map((view) => view.id === 2 ? { ...view, runStatus: "idle" as const } : view)
  expect(selectContinueProject(withoutFailure)?.id).toBe(1)

  const idleWithDeadlines = [
    { ...withoutFailure[1], deadline: "2026-08-04T12:00:00.000Z", runStatus: "idle" as const },
    { ...withoutFailure[2], deadline: "2026-08-01T12:00:00.000Z", runStatus: "idle" as const },
  ]
  expect(selectContinueProject(idleWithDeadlines)?.id).toBe(3)

  const idleWithoutDeadlines = idleWithDeadlines.map((view) => ({ ...view, deadline: null }))
  expect(selectContinueProject(idleWithoutDeadlines)?.id).toBe(3)
})

describe("attention derivation", () => {
  it("derives failed QA, approvals, missing integrations, stale jobs, provider outages and deployment blocks", () => {
    const projects = [project(1, { status: "qa" }), project(2, { status: "integrations" })]
    const tasks = [
      task(1, 1, { agentType: "qa", status: "failed", error: "Accessibility gate failed" }),
      task(2, 1, { humanApprovalRequired: true, publicationBlocked: true }),
      task(3, 2, { status: "running", providerAttempted: "openai" }),
    ]
    const jobs = [job(1, 2, { status: "queued", scheduledAt: "2026-07-29T11:30:00.000Z" })]
    const items = deriveAttentionItems({
      projects,
      tasks,
      jobs,
      integrations: [],
      providers: [{ provider: "openai", state: "open" }],
      now,
    })

    expect(items.map((item) => item.kind)).toEqual(expect.arrayContaining(["qa", "approval", "deployment", "provider", "stale_job", "integration"]))
    expect(items.find((item) => item.kind === "qa")).toMatchObject({ severity: "critical", actionLabel: "Resolve QA" })
    expect(items.every((item) => item.href.startsWith(`/forge/${item.projectId}?view=attention&item=`))).toBe(true)
  })

  it("creates one budget intervention for the most relevant active project", () => {
    const projects = [project(1), project(2)]
    const items = deriveAttentionItems({
      projects,
      tasks: [task(1, 2, { status: "running" })],
      jobs: [],
      integrations: [],
      providers: [],
      monthlyBudgetBlocked: true,
      now,
    })
    expect(items.filter((item) => item.kind === "budget")).toHaveLength(1)
    expect(items.find((item) => item.kind === "budget")?.projectId).toBe(2)
  })
})
