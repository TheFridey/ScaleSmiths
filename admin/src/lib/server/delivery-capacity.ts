import "server-only"
import { desc, gte } from "drizzle-orm"
import { isBuildPhaseWithoutDatabase } from "@/lib/build-env"
import {
  buildCapacityForecast,
  type CapacityAdjustment,
  type CapacityForecast,
  type DeliveryConfidence,
  type DeliveryWorkItem,
} from "@/lib/delivery-capacity"
import type { ProjectEstimateResult } from "@/lib/project-estimator"

const DEFAULT_LOOKAHEAD_DAYS = 180

export async function loadDeliveryCapacityForecast(): Promise<CapacityForecast> {
  if (isBuildPhaseWithoutDatabase()) {
    return buildCapacityForecast({ workItems: [], adjustments: [], actuals: [] })
  }

  const { db } = await import("@/lib/db")
  const {
    clients,
    clientRequests,
    deliveryCapacityAdjustments,
    deliveryForecastActuals,
    forgeArtifacts,
    forgeProjects,
    forgeTasks,
    projectEstimateSnapshots,
    prospects,
  } = await import("@/lib/schema")

  const now = new Date()
  const since = new Date(now)
  since.setUTCDate(since.getUTCDate() - 30)

  const [projectRows, estimateRows, taskRows, artifactRows, requestRows, clientRows, prospectRows, adjustmentRows, actualRows] = await Promise.all([
    db.select().from(forgeProjects).orderBy(desc(forgeProjects.updatedAt)),
    db.select().from(projectEstimateSnapshots).orderBy(desc(projectEstimateSnapshots.createdAt)),
    db.select().from(forgeTasks).orderBy(desc(forgeTasks.updatedAt)),
    db.select().from(forgeArtifacts).orderBy(desc(forgeArtifacts.updatedAt)),
    db.select().from(clientRequests).orderBy(desc(clientRequests.updatedAt)),
    db.select().from(clients).orderBy(desc(clients.updatedAt)),
    db.select().from(prospects).orderBy(desc(prospects.updatedAt)),
    db.select().from(deliveryCapacityAdjustments).where(gte(deliveryCapacityAdjustments.weekStart, since)).orderBy(desc(deliveryCapacityAdjustments.weekStart)),
    db.select().from(deliveryForecastActuals).where(gte(deliveryForecastActuals.periodStart, since)).orderBy(desc(deliveryForecastActuals.periodStart)),
  ])

  const latestEstimateByProject = new Map<number, (typeof estimateRows)[number]>()
  for (const estimate of estimateRows) {
    if (!latestEstimateByProject.has(estimate.projectId)) latestEstimateByProject.set(estimate.projectId, estimate)
  }

  const tasksByProject = groupBy(taskRows, (task) => task.projectId)
  const artifactsByProject = groupBy(artifactRows, (artifact) => artifact.projectId)
  const workItems: DeliveryWorkItem[] = [
    ...projectRows
      .filter((project) => !["deployed", "archived"].includes(project.status))
      .map((project) => {
        const estimate = latestEstimateByProject.get(project.id)
        const projectTasks = tasksByProject.get(project.id) ?? []
        const projectArtifacts = artifactsByProject.get(project.id) ?? []
        const remaining = estimate ? remainingFromEstimate(estimate, project.status) : fallbackProjectHours(project.status)
        const blockedArtifacts = projectArtifacts.filter((artifact) => artifact.qualityState === "fallback" || artifact.qualityState === "degraded" || artifact.approvalState === "unapproved")
        const waitingClient = project.status === "client_review"
        const waitingInternal = projectTasks.some((task) => task.humanApprovalRequired && !task.qualityApprovedAt) || blockedArtifacts.length > 0
        const status = waitingClient ? "waiting_client" : waitingInternal ? "waiting_internal" : "confirmed"
        const forgeHours = Math.max(0, Math.round(remaining * 0.25))
        return {
          id: `forge:${project.id}`,
          name: project.businessName || project.name,
          source: "forge_project",
          status,
          owner: project.ownerActor,
          deadline: project.deadline?.toISOString() ?? null,
          estimatedHours: estimate?.manualHours ?? estimate?.estimatedHours ?? remaining,
          remainingHours: remaining,
          manualHours: Math.max(1, remaining - forgeHours),
          forgeHours,
          probability: 1,
          confidence: estimateConfidence(estimate?.confidence),
          risk: projectRisk(project.priority, remaining, project.deadline, blockedArtifacts.length),
          blockers: [
            waitingClient ? "Awaiting client review or content." : null,
            waitingInternal ? "Awaiting internal artifact/task approval." : null,
            blockedArtifacts.length ? `${blockedArtifacts.length} artifact(s) require approval or quality review.` : null,
          ].filter((item): item is string => Boolean(item)),
          assumptions: estimateAssumptions(estimate),
          singlePersonDependency: Boolean(project.ownerActor && remaining >= 12),
        } satisfies DeliveryWorkItem
      }),
    ...requestRows
      .filter((request) => !["completed", "cancelled"].includes(request.status))
      .map((request) => {
        const hours = requestHours(request.priority, request.category)
        return {
          id: `request:${request.id}`,
          name: request.title,
          source: "client_request",
          status: request.status === "waiting_client" ? "waiting_client" : "confirmed",
          owner: null,
          deadline: request.priority === "critical" ? addDays(new Date(), 2).toISOString() : addDays(new Date(), 14).toISOString(),
          estimatedHours: hours,
          remainingHours: hours,
          manualHours: hours,
          forgeHours: 0,
          probability: 1,
          confidence: "medium",
          risk: request.priority === "critical" ? "high" : request.priority === "high" ? "medium" : "low",
          blockers: request.status === "waiting_client" ? ["Awaiting client reply."] : [],
          assumptions: [`${request.category} request estimated from priority and category.`],
          singlePersonDependency: request.priority === "critical",
        } satisfies DeliveryWorkItem
      }),
    ...clientRows
      .filter((client) => client.status !== "archived" && client.mrr > 0)
      .map((client) => ({
        id: `retainer:${client.id}`,
        name: `${client.name} retainer`,
        source: "retainer",
        status: "retainer",
        owner: null,
        deadline: null,
        estimatedHours: Math.max(2, Math.round(client.mrr / 250)),
        remainingHours: Math.max(2, Math.round(client.mrr / 250)),
        manualHours: Math.max(2, Math.round(client.mrr / 250)),
        forgeHours: 0,
        probability: 1,
        confidence: "medium",
        risk: client.progress < 40 ? "medium" : "low",
        blockers: [],
        assumptions: ["Retainer hours are inferred from active MRR until explicit allocation exists."],
        singlePersonDependency: false,
      } satisfies DeliveryWorkItem)),
    ...prospectRows
      .filter((prospect) => ["discovery_booked", "proposal_sent", "follow_up_due"].includes(prospect.stage))
      .map((prospect) => {
        const probability = prospect.stage === "proposal_sent" ? 0.55 : prospect.stage === "discovery_booked" ? 0.35 : 0.25
        const hours = Math.max(12, Math.round((prospect.estimatedProjectValue || 3500) / 95))
        return {
          id: `prospect:${prospect.id}`,
          name: prospect.businessName,
          source: "sales_pipeline",
          status: "probable",
          owner: null,
          deadline: prospect.nextFollowUpAt?.toISOString() ?? addDays(new Date(), 28).toISOString(),
          estimatedHours: hours,
          remainingHours: hours,
          manualHours: Math.round(hours * 0.75),
          forgeHours: Math.round(hours * 0.25),
          probability,
          confidence: prospect.stage === "proposal_sent" ? "medium" : "low",
          risk: prospect.priority === "high" ? "medium" : "low",
          blockers: prospect.stage === "follow_up_due" ? ["Sales follow-up due before this becomes confirmed work."] : [],
          assumptions: ["Probable work is weighted by sales stage; not treated as confirmed capacity."],
          singlePersonDependency: false,
        } satisfies DeliveryWorkItem
      }),
  ]

  return buildCapacityForecast({
    now,
    workItems: workItems.filter((item) => withinLookahead(item, now)),
    adjustments: adjustmentRows.map((row) => ({
      id: row.id,
      weekStart: row.weekStart.toISOString(),
      adjustmentType: row.adjustmentType,
      staffName: row.staffName,
      role: row.role,
      hours: row.hours,
      reason: row.reason,
      confidence: estimateConfidence(row.confidence),
    })),
    actuals: actualRows.map((row) => ({
      periodStart: row.periodStart.toISOString(),
      periodType: row.periodType === "month" ? "month" : "week",
      forecastHours: row.forecastHours,
      actualHours: row.actualHours,
      notes: row.notes,
    })),
  })
}

export async function recordDeliveryCapacityAdjustment(input: {
  weekStart: Date
  adjustmentType: CapacityAdjustment["adjustmentType"]
  staffName: string | null
  role: string | null
  hours: number
  reason: string
  confidence: DeliveryConfidence
  actor: string
}) {
  if (isBuildPhaseWithoutDatabase()) return null
  const { db } = await import("@/lib/db")
  const { deliveryCapacityAdjustments } = await import("@/lib/schema")
  const [row] = await db.insert(deliveryCapacityAdjustments).values({
    weekStart: input.weekStart,
    adjustmentType: input.adjustmentType,
    staffName: input.staffName,
    role: input.role,
    hours: input.hours,
    reason: input.reason,
    confidence: input.confidence,
    createdBy: input.actor,
  }).returning()
  return row
}

export async function recordDeliveryForecastActual(input: {
  periodStart: Date
  periodType: "week" | "month"
  forecastHours: number
  actualHours: number
  notes: string | null
  actor: string
}) {
  if (isBuildPhaseWithoutDatabase()) return null
  const { db } = await import("@/lib/db")
  const { deliveryForecastActuals } = await import("@/lib/schema")
  const [row] = await db.insert(deliveryForecastActuals).values({
    periodStart: input.periodStart,
    periodType: input.periodType,
    forecastHours: input.forecastHours,
    actualHours: input.actualHours,
    notes: input.notes,
    recordedBy: input.actor,
  }).returning()
  return row
}

function remainingFromEstimate(estimate: {
  estimatedHours: number
  manualHours: number | null
  actualHours: number | null
}, status: string) {
  const base = estimate.manualHours ?? estimate.estimatedHours
  const actual = estimate.actualHours ?? 0
  const statusMultiplier: Record<string, number> = {
    intake: 1,
    research: 0.9,
    strategy: 0.82,
    sitemap: 0.72,
    copy: 0.62,
    design: 0.5,
    build: 0.38,
    qa: 0.24,
    integrations: 0.2,
    preview: 0.14,
    client_review: 0.1,
    ready_to_deploy: 0.06,
  }
  return Math.max(1, Math.round(base * (statusMultiplier[status] ?? 0.5) - actual))
}

function fallbackProjectHours(status: string) {
  const hours: Record<string, number> = { intake: 36, research: 32, strategy: 28, sitemap: 24, copy: 20, design: 18, build: 16, qa: 10, integrations: 8, preview: 6, client_review: 4, ready_to_deploy: 2 }
  return hours[status] ?? 16
}

function requestHours(priority: string, category: string) {
  const priorityHours: Record<string, number> = { low: 2, medium: 4, high: 8, critical: 12 }
  const categoryExtra = /new_page|content_assets|seo_request/.test(category) ? 3 : /website_issue|form_issue/.test(category) ? 2 : 0
  return (priorityHours[priority] ?? 4) + categoryExtra
}

function projectRisk(priority: string, remainingHours: number, deadline: Date | null, blockedCount: number): "low" | "medium" | "high" {
  const urgent = deadline ? deadline.getTime() - Date.now() < 14 * 86_400_000 : false
  if (priority === "high" || blockedCount > 0 || (urgent && remainingHours > 12)) return "high"
  if (remainingHours > 32 || urgent) return "medium"
  return "low"
}

function estimateConfidence(value: unknown): DeliveryConfidence {
  return value === "high" || value === "low" || value === "medium" ? value : "medium"
}

function estimateAssumptions(estimate: { assumptions: ProjectEstimateResult["assumptions"] } | undefined) {
  if (!estimate) return ["No project estimate snapshot exists yet; using status-based fallback hours."]
  return estimate.assumptions.slice(0, 4).map((item) => `${item.label}: ${String(item.value)} (${item.evidence})`)
}

function withinLookahead(item: DeliveryWorkItem, now: Date) {
  if (!item.deadline) return true
  return new Date(item.deadline).getTime() <= addDays(now, DEFAULT_LOOKAHEAD_DAYS).getTime()
}

function addDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setUTCDate(copy.getUTCDate() + days)
  return copy
}

function groupBy<T, K>(items: T[], key: (item: T) => K) {
  const map = new Map<K, T[]>()
  for (const item of items) {
    const group = map.get(key(item)) ?? []
    group.push(item)
    map.set(key(item), group)
  }
  return map
}
