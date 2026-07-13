import "server-only"
import { desc } from "drizzle-orm"
import { isBuildPhaseWithoutDatabase } from "@/lib/build-env"
import { buildOperatingBrief, makeRecommendation, type OperatingBrief, type OperatingBriefEvidence, type OperatingBriefRecommendation } from "@/lib/operating-brief"

type Candidate = Omit<OperatingBriefRecommendation, "evidenceHash">

export async function loadDailyOperatingBrief(): Promise<OperatingBrief> {
  if (isBuildPhaseWithoutDatabase()) return buildOperatingBrief({ candidates: [] })
  const { db } = await import("@/lib/db")
  const {
    clients,
    clientRequests,
    forgeProjects,
    forgeTasks,
    leadScoreSnapshots,
    operatingBriefActions,
    proposalTrackings,
    prospects,
  } = await import("@/lib/schema")

  const now = new Date()
  const [clientRows, requestRows, projectRows, taskRows, prospectRows, scoreRows, proposalRows, actionRows] = await Promise.all([
    db.select().from(clients).orderBy(desc(clients.updatedAt)),
    db.select().from(clientRequests).orderBy(desc(clientRequests.updatedAt)),
    db.select().from(forgeProjects).orderBy(desc(forgeProjects.updatedAt)),
    db.select().from(forgeTasks).orderBy(desc(forgeTasks.updatedAt)),
    db.select().from(prospects).orderBy(desc(prospects.updatedAt)),
    db.select().from(leadScoreSnapshots).orderBy(desc(leadScoreSnapshots.createdAt)),
    db.select().from(proposalTrackings).orderBy(desc(proposalTrackings.updatedAt)),
    db.select().from(operatingBriefActions).orderBy(desc(operatingBriefActions.createdAt)),
  ])

  const latestScoreByProspect = firstBy(scoreRows, (row) => row.prospectId)
  const proposalsByProspect = groupBy(proposalRows, (row) => row.prospectId)
  const candidates: Candidate[] = []

  const clientWait = requestRows
    .filter((row) => !["completed", "cancelled", "waiting_client"].includes(row.status))
    .map((row) => ({ row, ageDays: daysSince(row.updatedAt, now) }))
    .sort((a, b) => b.ageDays - a.ageDays || priorityScore(b.row.priority) - priorityScore(a.row.priority))[0]
  if (clientWait && clientWait.ageDays >= 5) {
    candidates.push(makeRecommendation({
      key: `waiting-client:${clientWait.row.id}`,
      category: "waiting_client",
      title: `${clientWait.row.clientId} has waited ${clientWait.ageDays} days`,
      summary: clientWait.row.title,
      recommendedAction: "Review the request, send a progress update, or move it to waiting-client with a clear ask.",
      priority: clientWait.ageDays >= 10 || clientWait.row.priority === "critical" ? "critical" : "high",
      score: 80 + clientWait.ageDays,
      confidence: "high",
      reasoning: [`Request status is ${clientWait.row.status}.`, `Updated ${clientWait.ageDays} day(s) ago.`, `Priority is ${clientWait.row.priority}.`],
      evidence: [requestEvidence(clientWait.row)],
    }))
  }

  const failedTask = taskRows
    .filter((task) => task.status === "failed" || task.resultQuality === "failed" || task.resultQuality === "degraded" || task.resultQuality === "fallback")
    .sort((a, b) => taskRiskScore(b) - taskRiskScore(a))[0]
  if (failedTask) {
    candidates.push(makeRecommendation({
      key: `forge-task:${failedTask.id}`,
      category: "forge_task",
      title: `Forge task needs review: ${failedTask.title}`,
      summary: `${failedTask.status} / ${failedTask.resultQuality}`,
      recommendedAction: "Open the Forge project, inspect the task evidence, and approve, repair or rerun it before downstream work depends on it.",
      priority: failedTask.status === "failed" || failedTask.resultQuality === "failed" ? "critical" : "high",
      score: taskRiskScore(failedTask),
      confidence: "high",
      reasoning: [`Execution status is ${failedTask.status}.`, `Result quality is ${failedTask.resultQuality}.`, failedTask.error ? `Error recorded: ${failedTask.error.slice(0, 140)}` : "No safe error detail recorded."],
      evidence: [taskEvidence(failedTask)],
    }))
  }

  const blockedProject = projectRows
    .filter((project) => !["deployed", "archived"].includes(project.status))
    .map((project) => {
      const projectTasks = taskRows.filter((task) => task.projectId === project.id)
      const blockers = projectTasks.filter((task) => task.status === "failed" || task.humanApprovalRequired && !task.qualityApprovedAt || task.resultQuality === "degraded" || task.resultQuality === "fallback")
      return { project, blockers }
    })
    .filter((item) => item.blockers.length > 0 || item.project.status === "client_review")
    .sort((a, b) => b.blockers.length - a.blockers.length)[0]
  if (blockedProject) {
    candidates.push(makeRecommendation({
      key: `blocked-project:${blockedProject.project.id}`,
      category: "blocked_project",
      title: `${blockedProject.project.businessName} is blocked`,
      summary: blockedProject.project.status === "client_review" ? "Project is waiting on client review." : `${blockedProject.blockers.length} task(s) need approval or repair.`,
      recommendedAction: blockedProject.project.status === "client_review" ? "Send a concise client nudge with the exact decision needed." : "Clear the highest-risk Forge task before creating more downstream work.",
      priority: blockedProject.blockers.some((task) => task.status === "failed") ? "critical" : "high",
      score: 76 + blockedProject.blockers.length * 4,
      confidence: "high",
      reasoning: [`Project status is ${blockedProject.project.status}.`, `${blockedProject.blockers.length} blocking task signal(s) found.`],
      evidence: [projectEvidence(blockedProject.project), ...blockedProject.blockers.slice(0, 2).map(taskEvidence)],
    }))
  }

  const riskyDeadline = projectRows
    .filter((project) => project.deadline && !["deployed", "archived"].includes(project.status))
    .map((project) => ({ project, days: daysUntil(project.deadline!, now) }))
    .filter((item) => item.days <= 14)
    .sort((a, b) => a.days - b.days)[0]
  if (riskyDeadline) {
    candidates.push(makeRecommendation({
      key: `deadline-risk:${riskyDeadline.project.id}`,
      category: "deadline_risk",
      title: `${riskyDeadline.project.businessName} deadline is at risk`,
      summary: `${riskyDeadline.days} day(s) until deadline; status is ${riskyDeadline.project.status}.`,
      recommendedAction: "Confirm remaining approvals, scope and launch path before committing more sales dates.",
      priority: riskyDeadline.days <= 3 ? "critical" : "high",
      score: 82 - riskyDeadline.days,
      confidence: "high",
      reasoning: [`Deadline is ${riskyDeadline.project.deadline!.toISOString().slice(0, 10)}.`, `Current status is ${riskyDeadline.project.status}, not deployed.`],
      evidence: [projectEvidence(riskyDeadline.project)],
    }))
  }

  const proposalFollowUp = proposalRows
    .filter((proposal) => ["sent", "viewed", "follow_up_due"].includes(proposal.status))
    .map((proposal) => ({ proposal, days: daysSince(proposal.sentAt ?? proposal.updatedAt, now), prospect: prospectRows.find((prospect) => prospect.id === proposal.prospectId) }))
    .filter((item) => item.days >= 3)
    .sort((a, b) => b.proposal.quotedAmount - a.proposal.quotedAmount || b.days - a.days)[0]
  if (proposalFollowUp) {
    candidates.push(makeRecommendation({
      key: `proposal-follow-up:${proposalFollowUp.proposal.id}`,
      category: "proposal_follow_up",
      title: `Follow up ${proposalFollowUp.prospect?.businessName ?? "proposal"} proposal`,
      summary: `GBP ${proposalFollowUp.proposal.quotedAmount.toLocaleString("en-GB")} proposal has waited ${proposalFollowUp.days} day(s).`,
      recommendedAction: "Send a specific follow-up tied to the proposal outcome and next decision.",
      priority: proposalFollowUp.proposal.status === "follow_up_due" ? "high" : "medium",
      score: 65 + Math.min(20, proposalFollowUp.days) + Math.round(proposalFollowUp.proposal.quotedAmount / 1000),
      confidence: proposalFollowUp.prospect ? "high" : "medium",
      reasoning: [`Proposal status is ${proposalFollowUp.proposal.status}.`, `Sent/updated ${proposalFollowUp.days} day(s) ago.`, `Quoted amount is GBP ${proposalFollowUp.proposal.quotedAmount.toLocaleString("en-GB")}.`],
      evidence: [proposalEvidence(proposalFollowUp.proposal, proposalFollowUp.prospect)],
    }))
  }

  const bestLead = prospectRows
    .filter((prospect) => !["won", "lost"].includes(prospect.stage))
    .map((prospect) => ({ prospect, score: latestScoreByProspect.get(prospect.id) }))
    .sort((a, b) => leadValue(b.prospect, b.score) - leadValue(a.prospect, a.score))[0]
  if (bestLead) {
    const value = leadValue(bestLead.prospect, bestLead.score)
    candidates.push(makeRecommendation({
      key: `lead-contact:${bestLead.prospect.id}`,
      category: "lead_contact",
      title: `Most valuable lead to contact: ${bestLead.prospect.businessName}`,
      summary: `Estimated project GBP ${bestLead.prospect.estimatedProjectValue.toLocaleString("en-GB")} and retainer GBP ${bestLead.prospect.estimatedMonthlyRetainer.toLocaleString("en-GB")}/mo.`,
      recommendedAction: bestLead.score?.recommendedNextAction ?? "Contact with a specific next step based on the recorded pain points and opportunity notes.",
      priority: bestLead.prospect.priority === "high" || value >= 70 ? "high" : "medium",
      score: value,
      confidence: bestLead.score ? confidenceOf(bestLead.score.confidence) : "medium",
      reasoning: [`Lead stage is ${bestLead.prospect.stage}.`, `Priority is ${bestLead.prospect.priority}.`, bestLead.score ? `Lead score snapshot is ${bestLead.score.score}/100.` : "No lead-score snapshot found; using recorded value and priority."],
      evidence: [prospectEvidence(bestLead.prospect), ...(bestLead.score ? [scoreEvidence(bestLead.score, bestLead.prospect)] : [])],
    }))
  }

  const disengaging = clientRows
    .filter((client) => client.status === "active" && client.mrr > 0)
    .map((client) => {
      const openRequests = requestRows.filter((request) => request.clientId === String(client.id) && !["completed", "cancelled"].includes(request.status))
      const age = daysSince(client.updatedAt, now)
      return { client, age, openRequests }
    })
    .filter((item) => item.age >= 21 || item.openRequests.length > 2)
    .sort((a, b) => b.client.mrr - a.client.mrr || b.age - a.age)[0]
  if (disengaging) {
    candidates.push(makeRecommendation({
      key: `retainer-disengagement:${disengaging.client.id}`,
      category: "retainer_disengagement",
      title: `${disengaging.client.name} may be disengaging`,
      summary: `${disengaging.age} day(s) since recent client signal; ${disengaging.openRequests.length} open request(s).`,
      recommendedAction: "Send a value-led check-in or schedule the next retainer review before the account goes cold.",
      priority: disengaging.client.mrr >= 1000 || disengaging.openRequests.length > 2 ? "high" : "medium",
      score: 60 + Math.round(disengaging.client.mrr / 100) + disengaging.openRequests.length * 5,
      confidence: disengaging.openRequests.length > 0 ? "medium" : "low",
      reasoning: [`Client is active with GBP ${disengaging.client.mrr.toLocaleString("en-GB")} MRR.`, `${disengaging.openRequests.length} open request(s).`, "Engagement is inferred from admin activity and messages, not external analytics."],
      evidence: [clientEvidence(disengaging.client), ...disengaging.openRequests.slice(0, 2).map(requestEvidence)],
    }))
  }

  const critical = candidates.find((candidate) => candidate.priority === "critical") ?? candidates.sort((a, b) => b.score - a.score)[0]
  if (critical) {
    candidates.push(makeRecommendation({
      ...critical,
      key: `highest-value:${critical.key}`,
      category: "highest_value_action",
      title: `Highest-value action: ${critical.recommendedAction}`,
      score: critical.score + 5,
    }))
  }

  for (const candidate of canWaitCandidates(requestRows, projectRows, proposalsByProspect)) candidates.push(candidate)

  return buildOperatingBrief({
    now,
    candidates,
    actionStates: actionRows.map((row) => ({
      recommendationKey: row.recommendationKey,
      evidenceHash: row.evidenceHash,
      status: row.status,
      snoozedUntil: row.snoozedUntil?.toISOString() ?? null,
    })),
  })
}

export async function recordOperatingBriefAction(input: { key: string; evidenceHash: string; status: "dismissed" | "completed" | "snoozed"; reason: string | null; snoozedUntil: Date | null; actor: string }) {
  if (isBuildPhaseWithoutDatabase()) return null
  const { db } = await import("@/lib/db")
  const { operatingBriefActions } = await import("@/lib/schema")
  const [row] = await db.insert(operatingBriefActions).values({
    recommendationKey: input.key,
    evidenceHash: input.evidenceHash,
    status: input.status,
    reason: input.reason,
    snoozedUntil: input.status === "snoozed" ? input.snoozedUntil : null,
    actor: input.actor,
  }).returning()
  return row
}

function canWaitCandidates(requestRows: Array<{ id: number; title: string; status: string; priority: string; updatedAt: Date; clientId: string }>, projectRows: Array<{ id: number; businessName: string; status: string; updatedAt: Date }>, proposals: Map<number, unknown[]>): Candidate[] {
  const lowRequest = requestRows.find((request) => request.priority === "low" && ["new", "triaged"].includes(request.status))
  const draftProject = projectRows.find((project) => project.status === "intake")
  const result: Candidate[] = []
  if (lowRequest) result.push(makeRecommendation({
    key: `can-wait:request:${lowRequest.id}`,
    category: "can_wait",
    title: `Can wait: ${lowRequest.title}`,
    summary: "Low-priority request is not blocking delivery today.",
    recommendedAction: "Leave queued unless capacity opens after high-value actions.",
    priority: "low",
    score: 20,
    confidence: "medium",
    reasoning: [`Priority is ${lowRequest.priority}.`, `Status is ${lowRequest.status}.`],
    evidence: [requestEvidence(lowRequest)],
  }))
  if (draftProject && proposals.size >= 0) result.push(makeRecommendation({
    key: `can-wait:project:${draftProject.id}`,
    category: "can_wait",
    title: `Can wait: ${draftProject.businessName} intake`,
    summary: "Project is still in intake and has no urgent deadline signal in this brief.",
    recommendedAction: "Do not start downstream Forge work until higher-risk actions are cleared.",
    priority: "low",
    score: 18,
    confidence: "medium",
    reasoning: [`Project status is ${draftProject.status}.`],
    evidence: [projectEvidence(draftProject)],
  }))
  return result
}

function requestEvidence(row: { id: number; clientId: string; title: string; status: string; priority: string; updatedAt: Date }): OperatingBriefEvidence {
  return { label: row.title, href: `/requests?request=${row.id}`, recordType: "client_request", recordId: String(row.id), summary: `${row.priority} / ${row.status}`, updatedAt: row.updatedAt.toISOString() }
}
function taskEvidence(row: { id: number; projectId: number; title: string; status: string; resultQuality: string; updatedAt: Date }): OperatingBriefEvidence {
  return { label: row.title, href: `/forge/${row.projectId}`, recordType: "forge_task", recordId: String(row.id), summary: `${row.status} / ${row.resultQuality}`, updatedAt: row.updatedAt.toISOString() }
}
function projectEvidence(row: { id: number; businessName: string; status: string; updatedAt: Date }): OperatingBriefEvidence {
  return { label: row.businessName, href: `/forge/${row.id}`, recordType: "forge_project", recordId: String(row.id), summary: row.status, updatedAt: row.updatedAt.toISOString() }
}
function prospectEvidence(row: { id: number; businessName: string; stage: string; updatedAt: Date }): OperatingBriefEvidence {
  return { label: row.businessName, href: `/prospects#prospect-${row.id}`, recordType: "prospect", recordId: String(row.id), summary: row.stage, updatedAt: row.updatedAt.toISOString() }
}
function scoreEvidence(row: { id: number; score: number; confidence: string; createdAt: Date }, prospect: { businessName: string }): OperatingBriefEvidence {
  return { label: `${prospect.businessName} lead score`, href: `/prospects#lead-score-${row.id}`, recordType: "lead_score", recordId: String(row.id), summary: `${row.score}/100 ${row.confidence}`, updatedAt: row.createdAt.toISOString() }
}
function proposalEvidence(row: { id: number; prospectId: number; status: string; quotedAmount: number; updatedAt: Date }, prospect?: { businessName: string } | null): OperatingBriefEvidence {
  return { label: `${prospect?.businessName ?? "Prospect"} proposal`, href: `/prospects#proposal-${row.id}`, recordType: "proposal_tracking", recordId: String(row.id), summary: `${row.status} / GBP ${row.quotedAmount}`, updatedAt: row.updatedAt.toISOString() }
}
function clientEvidence(row: { id: number; name: string; status: string; mrr: number; updatedAt: Date }): OperatingBriefEvidence {
  return { label: row.name, href: `/clients/${row.id}`, recordType: "client", recordId: String(row.id), summary: `${row.status} / GBP ${row.mrr} MRR`, updatedAt: row.updatedAt.toISOString() }
}

function leadValue(prospect: { estimatedProjectValue: number; estimatedMonthlyRetainer: number; priority: string }, score?: { score: number } | undefined) {
  return (score?.score ?? 40) + Math.round(prospect.estimatedProjectValue / 1000) + Math.round(prospect.estimatedMonthlyRetainer / 100) + priorityScore(prospect.priority) * 5
}
function taskRiskScore(task: { status: string; resultQuality: string; humanApprovalRequired: boolean }) {
  return (task.status === "failed" ? 95 : 70) + (task.resultQuality === "fallback" || task.resultQuality === "degraded" ? 10 : 0) + (task.humanApprovalRequired ? 5 : 0)
}
function priorityScore(priority: string) {
  return priority === "critical" || priority === "high" ? 3 : priority === "medium" ? 2 : 1
}
function confidenceOf(value: string): "high" | "medium" | "low" {
  return value === "high" || value === "medium" || value === "low" ? value : "medium"
}
function daysSince(date: Date, now: Date) {
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000))
}
function daysUntil(date: Date, now: Date) {
  return Math.ceil((date.getTime() - now.getTime()) / 86_400_000)
}
function firstBy<T, K>(items: T[], key: (item: T) => K) {
  const map = new Map<K, T>()
  for (const item of items) if (!map.has(key(item))) map.set(key(item), item)
  return map
}
function groupBy<T, K>(items: T[], key: (item: T) => K) {
  const map = new Map<K, T[]>()
  for (const item of items) {
    const current = map.get(key(item)) ?? []
    current.push(item)
    map.set(key(item), current)
  }
  return map
}
