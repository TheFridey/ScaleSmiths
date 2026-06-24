import type { Metadata } from "next"
import { desc, eq } from "drizzle-orm"
import { DashboardContent } from "@/components/Dashboard"
import { db } from "@/lib/db"
import { clientRequestMessages, clientRequests, clientTimelineEvents, clients, monthlyReports, outreachActivities, proposalTrackings, prospects, salesProposals } from "@/lib/schema"
import { computeSalesMetrics } from "@/lib/prospects"

export const metadata: Metadata = { title: "Dashboard" }
export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const [
    rows,
    prospectRows,
    activityRows,
    proposalRows,
    requestRows,
    clientReplyRows,
    timelineRows,
    reportRows,
    salesProposalRows,
    proposalStageProspects,
  ] = await Promise.all([
    db
      .select({
        id: clients.id,
        name: clients.name,
        tier: clients.tier,
        mrr: clients.mrr,
        status: clients.status,
        progress: clients.progress,
      })
      .from(clients)
      .orderBy(desc(clients.createdAt)),
    db
      .select({
        stage: prospects.stage,
        estimatedProjectValue: prospects.estimatedProjectValue,
        estimatedMonthlyRetainer: prospects.estimatedMonthlyRetainer,
        nextFollowUpAt: prospects.nextFollowUpAt,
        discoveryCallAt: prospects.discoveryCallAt,
        proposalSentAt: prospects.proposalSentAt,
        wonAt: prospects.wonAt,
        lostAt: prospects.lostAt,
      })
      .from(prospects),
    db
      .select({
        direction: outreachActivities.direction,
        createdAt: outreachActivities.createdAt,
      })
      .from(outreachActivities),
    db
      .select({
        status: proposalTrackings.status,
        sentAt: proposalTrackings.sentAt,
      })
      .from(proposalTrackings),
    db
      .select({
        id: clientRequests.id,
        clientId: clientRequests.clientId,
        title: clientRequests.title,
        priority: clientRequests.priority,
        status: clientRequests.status,
        updatedAt: clientRequests.updatedAt,
      })
      .from(clientRequests)
      .orderBy(desc(clientRequests.updatedAt)),
    db
      .select({
        id: clientRequestMessages.id,
        requestId: clientRequestMessages.requestId,
        senderName: clientRequestMessages.senderName,
        body: clientRequestMessages.body,
        createdAt: clientRequestMessages.createdAt,
        requestTitle: clientRequests.title,
        clientId: clientRequests.clientId,
        requestStatus: clientRequests.status,
      })
      .from(clientRequestMessages)
      .innerJoin(clientRequests, eq(clientRequestMessages.requestId, clientRequests.id))
      .where(eq(clientRequestMessages.senderType, "client"))
      .orderBy(desc(clientRequestMessages.createdAt))
      .limit(8),
    db
      .select({
        id: clientTimelineEvents.id,
        clientId: clientTimelineEvents.clientId,
        title: clientTimelineEvents.title,
        description: clientTimelineEvents.description,
        visibility: clientTimelineEvents.visibility,
        createdAt: clientTimelineEvents.createdAt,
      })
      .from(clientTimelineEvents)
      .orderBy(desc(clientTimelineEvents.createdAt))
      .limit(8),
    db
      .select({
        id: monthlyReports.id,
        clientId: monthlyReports.clientId,
        month: monthlyReports.month,
        year: monthlyReports.year,
        status: monthlyReports.status,
        updatedAt: monthlyReports.updatedAt,
      })
      .from(monthlyReports),
    db
      .select({
        id: salesProposals.id,
        prospectId: salesProposals.prospectId,
        status: salesProposals.status,
      })
      .from(salesProposals),
    db
      .select({
        id: prospects.id,
        businessName: prospects.businessName,
        contactName: prospects.contactName,
        proposalSentAt: prospects.proposalSentAt,
      })
      .from(prospects)
      .where(eq(prospects.stage, "proposal_sent")),
  ])

  const todayLabel = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  const currentMonthReports = reportRows.filter((report) => report.month === month && report.year === year)
  const clientIdsWithCurrentReport = new Set(currentMonthReports.map((report) => report.clientId))
  const proposalProspectsWithDraft = new Set(salesProposalRows.map((proposal) => proposal.prospectId).filter((id): id is number => typeof id === "number"))
  const operational = {
    unreadClientReplies: clientReplyRows.map((reply) => ({
      ...reply,
      createdAt: reply.createdAt.toISOString(),
    })),
    criticalRequests: requestRows.filter((request) => request.priority === "critical" && request.status !== "completed" && request.status !== "cancelled").slice(0, 6).map(serializeRequest),
    waitingClientRequests: requestRows.filter((request) => request.status === "waiting_client").slice(0, 6).map(serializeRequest),
    reportsDueThisMonth: rows
      .filter((client) => client.status !== "archived" && !clientIdsWithCurrentReport.has(client.name))
      .map((client) => ({ id: client.id, name: client.name, tier: client.tier, status: client.status }))
      .slice(0, 8),
    proposalsMissing: proposalStageProspects
      .filter((prospect) => !proposalProspectsWithDraft.has(prospect.id))
      .map((prospect) => ({
        id: prospect.id,
        businessName: prospect.businessName,
        contactName: prospect.contactName,
        proposalSentAt: prospect.proposalSentAt?.toISOString() ?? null,
      }))
      .slice(0, 8),
    recentTimeline: timelineRows.map((event) => ({
      ...event,
      createdAt: event.createdAt.toISOString(),
    })),
    currentMonthReportCount: currentMonthReports.length,
  }

  return (
    <DashboardContent
      clients={rows}
      salesMetrics={computeSalesMetrics(prospectRows, activityRows, proposalRows)}
      todayLabel={todayLabel}
      operational={operational}
    />
  )
}

function serializeRequest(request: {
  id: number
  clientId: string
  title: string
  priority: "low" | "medium" | "high" | "critical"
  status: "new" | "triaged" | "in_progress" | "waiting_client" | "completed" | "cancelled"
  updatedAt: Date
}) {
  return {
    ...request,
    updatedAt: request.updatedAt.toISOString(),
  }
}
